import { CancellationToken, DocumentSymbol, Location, Range, ReferenceParams, SymbolKind } from 'vscode-languageserver';
import { Lexer, FuncScope, FuncNode, searchNode, Variable, ClassNode } from './Lexer';
import { lexers, ahkvars } from './common';

export async function referenceProvider(params: ReferenceParams, token: CancellationToken): Promise<Location[] | undefined> {
	let result: any = [], doc = lexers[params.textDocument.uri.toLowerCase()];
	if (!doc || token.isCancellationRequested) return;
	let refs = getAllReferences(doc, doc.buildContext(params.position));
	for (const uri in refs)
		result.push(...refs[uri].map(range => ({ uri, range })));
	return result;
}

export function getAllReferences(doc: Lexer, context: any, allow_builtin = true): { [uri: string]: Range[] } | null | undefined {
	if (!context.text) return undefined;
	let name: string = context.text.toUpperCase(), references: { [uri: string]: Range[] } = {};
	let nodes = searchNode(doc, name, context.range.end, context.kind);
	if (!nodes || nodes.length > 1)
		return undefined;
	let { node, uri, scope, ref } = nodes[0];
	if (!uri || !node.selectionRange.end.character)
		return undefined;

	if (ref === true) { // this.prop
		return undefined;
	} else if (ref === false) { // this.staticprop
		let cls = scope as ClassNode, range: Range[] = [];
		for (let it of Object.values(cls.staticdeclaration ?? {}))
			it.children && findAllVar(it as FuncNode, name, false, range, false);
		if (range.length)
			return { [lexers[uri].document.uri]: range };
		return undefined;
	}

	if (node === lexers[uri].declaration[name])
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
					if (scope.kind === SymbolKind.Function || scope.kind === SymbolKind.Method || scope.kind === SymbolKind.Event) {
						if ((<FuncNode>scope).global?.[name])
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
				if (node.kind === SymbolKind.Class)
					name = (node as ClassNode).full.toUpperCase();
				else {
					let m = (node as FuncNode).full?.match(/^\(([^)]+)\)\sstatic\s([^(]+)($|[(\[])/);
					if (!m) return;
					name = `${m[1]}.${m[2]}`.toUpperCase();
				}
				let c = name.split('.'), l = c.length, i = 0, refs: { [uri: string]: Range[] } = {};
				for (const uri of new Set([doc.uri, ...Object.keys(doc.relevance ?? {})]))
					refs[lexers[uri].document.uri] = findAllFromDoc(lexers[uri], c[0], SymbolKind.Variable);
				while (i < l) {
					let name = c.slice(0, ++i).join('.');
					let nodes = searchNode(doc, name, undefined, SymbolKind.Variable);
					if (nodes?.[0].node.kind === SymbolKind.Class) {
						for (let it of Object.values((nodes[0].node as ClassNode).staticdeclaration ?? {}))
							it.children && findAllVar(it as FuncNode, 'THIS', false, refs[lexers[nodes[0].uri].document.uri] ??= [], false);
					}
					for (const uri in refs) {
						let rgs = refs[uri], doc = lexers[uri.toLowerCase()], arr: Range[] = references[uri] ??= [];
						let document = doc.document, tokens = doc.tokens;
						next_rg:
						for (let rg of rgs) {
							let tk = tokens[document.offsetAt(rg.start)];
							if (!tk) continue;
							for (let j = i; j < l; j++){
								if ((tk = tokens[tk.next_token_offset])?.type !== 'TK_DOT')
									continue next_rg;
								if ((tk = tokens[tk.next_token_offset])?.type !== 'TK_WORD' || tk.content.toUpperCase() !== c[j])
									continue next_rg;
							}
							arr.push({ start: document.positionAt(tk.offset), end: document.positionAt(tk.offset + tk.length) });
						}
						if (!references[uri].length)
							delete references[uri];
					}
					refs = {};
				}
				let _uri = lexers[uri].document.uri;
				(references[_uri] ??= []).unshift(node.selectionRange);
				references[_uri] = [...new Set(references[_uri])];
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