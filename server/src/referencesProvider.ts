import { CancellationToken, DocumentSymbol, Location, Range, ReferenceParams, SymbolKind } from 'vscode-languageserver';
import { Lexer, FuncScope, FuncNode, searchNode, Token, Variable } from './Lexer';
import { Maybe, lexers, ahkvars } from './common';

export async function referenceProvider(params: ReferenceParams, token: CancellationToken): Promise<Location[] | undefined> {
	let result: any = [], doc = lexers[params.textDocument.uri.toLowerCase()];
	if (!doc || token.isCancellationRequested) return;
	let refs = getAllReferences(doc, doc.buildContext(params.position));
	for (const uri in refs)
		result.push(...refs[uri].map(range => ({ uri, range })));
	return result;
}

export function getAllReferences(doc: Lexer, context: any, allow_builtin = true): { [uri: string]: Range[] } | null | undefined {
	let name: string = context.text.toUpperCase(), references: { [uri: string]: Range[] } = {};
	if (!context.text) return undefined;
	let nodes = searchNode(doc, name, context.range.end, context.kind);
	if (!nodes || nodes.length > 1)
		return undefined;
	let { node, uri, scope, ref } = nodes[0];
	if (!uri || !node.selectionRange.end.character || ref && name.match(/^(THIS|SUPER)$/))
		return undefined;
	if (node === doc.declaration[name])
		scope = undefined;
	else if (!scope)
		scope = doc.searchScopedNode(node.selectionRange.start);
	if (!allow_builtin && node === ahkvars[name])
		return null;
	switch (node.kind) {
		case SymbolKind.Field:
			if (scope) {
				let lbs = (<FuncNode>scope).labels;
				if (lbs && lbs[name])
					references[lexers[uri].document.uri] = lbs[name].map(it => it.selectionRange);
			} else {
				let lbs = doc.labels;
				if (lbs[name])
					references[doc.document.uri] = lbs[name].map(it => it.selectionRange);
				for (const uri in doc.relevance) {
					lbs = lexers[uri].labels;
					if (lbs[name])
						references[lexers[uri].document.uri] = lbs[name].map(it => it.selectionRange);
				}
			}
			break;
		case SymbolKind.Function:
		case SymbolKind.Variable:
		case SymbolKind.TypeParameter:
		case SymbolKind.Class:
			if (node.kind !== SymbolKind.Class || !(<any>node).full.includes('.')) {
				if (scope) {
					if (scope.kind === SymbolKind.Class || scope.kind === SymbolKind.Function || scope.kind === SymbolKind.Method || scope.kind === SymbolKind.Event) {
						if ((<FuncNode>scope).global && (<FuncNode>scope).global[name])
							scope = undefined;
					}
				}
				let all_uris: any = { [doc.uri]: scope };
				if (uri !== doc.uri)
					all_uris[uri] = undefined;
				if (!scope)
					for (const uri in doc.relevance)
						all_uris[uri] = undefined;
				for (const uri in all_uris) {
					let rgs = findAllFromDoc(lexers[uri], name, SymbolKind.Variable, all_uris[uri]);
					if (rgs.length)
						references[lexers[uri].document.uri] = rgs;
				}
				break;
			}
		default:
			if (node.kind === SymbolKind.Class || (<FuncNode>node).static) {
				let c = name.split('.'), rgs = findAllFromDoc(doc, c[0], SymbolKind.Variable);
				let refs: { [uri: string]: Range[] } = {}, incls = scope?.kind === SymbolKind.Class;
				c.splice(0, 1);
				if (incls && c[0] === scope?.name.toUpperCase())
					scope?.children?.forEach(it => it.name.toUpperCase() === 'THIS' && rgs.push(it.selectionRange));
				if (rgs.length)
					refs[doc.document.uri] = rgs;
				for (const uri in doc.relevance) {
					let rgs = findAllFromDoc(lexers[uri], name, SymbolKind.Variable, undefined);
					if (rgs.length)
						refs[lexers[uri].document.uri] = rgs;
				}
				for (const uri in refs) {
					let rgs = refs[uri], doc = lexers[uri.toLowerCase()], tt: Range[] = [];
					for (let rg of rgs) {
						let i = 0, offset = doc.document.offsetAt(rg.end), tk: Token | undefined;
						while (i < c.length) {
							tk = doc.get_token(offset, true);
							if (tk.type === 'TK_DOT') {
								if ((tk = doc.find_token(tk.offset + tk.length)).type === 'TK_WORD' && tk.content.toUpperCase() === c[i]) {
									offset = tk.offset + tk.length, i++;
									continue;
								}
							}
							break;
						}
						if (i === c.length && tk)
							tt.push({ start: doc.document.positionAt(tk.offset), end: doc.document.positionAt(tk.offset + tk.length) });
					}
					if (tt.length)
						references[doc.document.uri] = tt;
				}
				let t = references[lexers[uri].document.uri] ??= [], ns = node.selectionRange;
				name = node.name.toUpperCase();
				if (incls && (node.kind === SymbolKind.Property || node.kind === SymbolKind.Method))
					scope?.children?.forEach(it => it.name.toUpperCase() === name && it.kind === SymbolKind.Property
						&& it.selectionRange !== ns && t.push(it.selectionRange));
				if ((node as any).full)
					t.unshift(node.selectionRange);
				break;
			}
			return undefined;
	}
	if (Object.keys(references).length)
		return references;
	return undefined
}

function findAllFromDoc(doc: Lexer, name: string, kind: SymbolKind, scope?: DocumentSymbol) {
	let ranges: Range[] = [];
	if (kind === SymbolKind.Method || kind === SymbolKind.Property) {

	} else {
		let node = (scope ?? doc) as FuncNode, gg = !scope, c: boolean | undefined = gg;
		let not_static = !((<any>node)?.local?.[name]?.static);
		if (not_static && scope && (<any>node)?.declaration?.[name]?.static === null)
			not_static = false;
		if (node.kind === SymbolKind.Property && node.parent?.kind === SymbolKind.Class) {
			node.children?.forEach(it => {
				if (it.kind === SymbolKind.Function)
					it.children?.forEach(it => {
						if (it.name.toUpperCase() === name)
							ranges.push(it.selectionRange);
						if (it.children)
							findAllVar(it as FuncNode, name, gg, ranges, gg, not_static);
					});
			});
		} else {
			if (!c) {
				let local = (<FuncNode>node).local, dec = (<FuncNode>node).declaration;
				if (!((local && local[name]) || (dec && dec[name])))
					c = undefined;
			}
			node.children?.forEach(it => {
				if (it.name.toUpperCase() === name)
					ranges.push(it.selectionRange);
				if (it.children)
					findAllVar(it as FuncNode, name, gg, ranges, gg || it.kind === SymbolKind.Function ? c : undefined, not_static);
			});
		}
	}
	return ranges;
}

function findAllVar(node: FuncNode, name: string, global = false, ranges: Range[], assume_glo?: boolean, not_static?: boolean) {
	let fn_is_static = node.kind === SymbolKind.Function && node.static, f = fn_is_static || node.closure;
	let t: Variable;
	if (fn_is_static && not_static && !global)
		return;
	if (global && node.has_this_param && ['THIS', 'SUPER'].includes(name))
		assume_glo = false;
	else if (node.assume === FuncScope.GLOBAL || node.global?.[name]) {
		if (!global)
			return;
		assume_glo = true;
	} else if ((f && node.local?.[name]) || (!f && node.declaration?.[name])) {
		if (!global)
			return;
		assume_glo = false;
	} else if (fn_is_static && global && !assume_glo && (!(t = node.declaration?.[name]) || t.kind === SymbolKind.Variable && !t.def))
		assume_glo = true;
	// else if (assume_glo && node.declaration?.[name])
	// 	assume_glo = false;
	if (not_static)
		not_static = !((<any>node)?.local?.[name]?.static);
	if (assume_glo === global) {
		node.children?.forEach(it => {
			if (it.name.toUpperCase() === name && (it.kind !== SymbolKind.Property && it.kind !== SymbolKind.Method && it.kind !== SymbolKind.Class))
				ranges.push(it.selectionRange);
			if (it.children)
				findAllVar(it as FuncNode, name, global, ranges, it.kind === SymbolKind.Function ? assume_glo : global || undefined, not_static);
		});
	} else {
		node.children?.forEach(it => {
			if (it.children)
				findAllVar(it as FuncNode, name, global, ranges, global ? false : undefined, not_static);
		});
		// if (!global)
		// 	node.funccall?.forEach(it => {
		// 		if (it.kind === SymbolKind.Function && it.name.toUpperCase() === name)
		// 			ranges.push(it.selectionRange);
		// 	});
	}
}