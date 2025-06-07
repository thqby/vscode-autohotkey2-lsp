import { CancellationToken, Location, Range, ReferenceParams } from 'vscode-languageserver';
import {
	ANY, AhkSymbol, Context, FuncNode, FuncScope, Lexer, Property, SymbolKind, USAGE, Variable, ZERO_RANGE,
	ahkUris, ahkVars, decltypeExpr, findSymbols, getClassMember, lexers, typeNaming
} from './common';

export async function referenceProvider(params: ReferenceParams, token: CancellationToken): Promise<Location[] | undefined> {
	const result: Location[] = [], lex = lexers[params.textDocument.uri.toLowerCase()];
	if (!lex || token.isCancellationRequested) return;
	const refs = getAllReferences(lex, lex.getContext(params.position));
	for (const uri in refs)
		result.push(...refs[uri].map(range => ({ uri, range })));
	return result;
}

export function getAllReferences(lex: Lexer, context: Context, allow_builtin = true): Record<string, Range[]> | null | undefined {
	if (context.kind === SymbolKind.Null) return;
	const nodes = findSymbols(lex, context);
	if (!nodes?.length)
		return;
	let name = context.text.toUpperCase();
	const references: Record<string, Range[]> = {};
	const { node, parent, uri, scope, is_this, is_global } = nodes[0];
	if (is_this) {	// this
		const range = scope?.children && findAllFromScope(scope, name, SymbolKind.Variable);
		return range?.length ? { [lexers[uri].document.uri]: range } : undefined;
	}

	if (!uri || /* super */ is_this === false)
		return;

	if (!allow_builtin && (node === ahkVars[name] || uri === ahkUris.winapi))
		return null;

	switch (node.kind) {
		case SymbolKind.Field:
			if (scope) {
				const lbs = (scope as FuncNode).labels;
				if (lbs && lbs[name])
					references[lexers[uri].document.uri] = lbs[name].map(it => it.selectionRange);
			} else {
				let lbs = lex.labels;
				if (lbs[name])
					references[lex.document.uri] = lbs[name].map(it => it.selectionRange);
				for (const uri in lex.relevance) {
					lbs = lexers[uri].labels;
					if (lbs[name])
						references[lexers[uri].document.uri] = lbs[name].map(it => it.selectionRange);
				}
			}
			break;
		case SymbolKind.Function:
		case SymbolKind.Variable:
		case SymbolKind.Class:
			if (node.kind !== SymbolKind.Class || !(node as FuncNode).full.includes('.')) {
				const scope = is_global === true ? undefined : parent;
				const all_uris = { [lex.uri]: scope };
				if (uri !== lex.uri)
					all_uris[uri] = undefined;
				if (!scope)
					for (const uri in lex.relevance)
						all_uris[uri] = undefined;
				for (const uri in all_uris) {
					const rgs = findAllFromScope(all_uris[uri] ?? lexers[uri] as unknown as AhkSymbol, name, SymbolKind.Variable);
					if (rgs.length)
						references[lexers[uri].document.uri] = rgs;
				}
				break;
			}
		// fall through
		case SymbolKind.Method:
		case SymbolKind.Property: {
			const syms = nodes.map(it => {
				const s = it.node;
				if (s.full)
					s.type_name ??= typeNaming(s);
				return s;
			});
			name = context.word.toUpperCase();
			for (const uri of [lex.uri, ...Object.keys(lex.relevance)]) {
				if (!(lex = lexers[uri]))
					continue;
				const refs: Range[] = [], { document, tokens } = lex;
				for (const tk of Object.values(tokens)) {
					if (tk.ignore || tk.type !== 'TK_WORD' || tk.content.toUpperCase() !== name)
						continue;
					let t = tk.symbol;
					if (t) {
						if (t.parent && t.kind !== SymbolKind.Function) {
							if (!t.children)
								t = getClassMember(lex, t.parent!, name, t.def ? null : false) ?? t;
							syms.includes(t) && refs.push(tk.symbol!.selectionRange);
						}
						continue;
					}
					if (tk.previous_token?.type !== 'TK_DOT')
						continue;
					const start = document.positionAt(tk.offset), end = { line: start.line, character: start.character + tk.length };
					const { token, usage } = lex.getContext(start, true), tps = decltypeExpr(lex, token, tk.offset - 1);
					tps.some(tp => {
						if (tp === ANY)
							return true;
						if (!(tp = getClassMember(lex, tp, name, context.kind === SymbolKind.Method || usage === USAGE.Write && null)!))
							return false;
						return syms.some(it => it === tp || it.kind === tp.kind && tp.name === it.name && it.type_name === typeNaming(tp));
					}) && refs.push({ start, end });
				}
				if (refs.length)
					references[lex.document.uri] = refs;
			}
			break;
		}
	}
	for (const [uri, range] of Object.entries(references)) {
		const m = new Set(range);
		m.delete(ZERO_RANGE);
		if (m.size)
			references[uri] = Array.from(m);
		else delete references[uri];
	}
	return references;
}

function findAllFromScope(scope: AhkSymbol, name: string, kind: SymbolKind, ranges: Range[] = []) {
	if (kind === SymbolKind.Method || kind === SymbolKind.Property) {
		//
	} else {
		const node = scope as FuncNode, gg = !scope.kind;
		let not_static = !(node?.local?.[name]?.static), assume: boolean | undefined = gg;
		if (not_static && !gg && node.declaration?.[name]?.static === null)
			not_static = false;
		if (!assume) {
			const local = node.local, dec = node.declaration;
			if (!(local?.[name] || dec?.[name]))
				assume = undefined;
		} else assume = false;
		for (const it of node.children ?? []) {
			if (it.name.toUpperCase() === name)
				ranges.push(it.selectionRange);
			if (it.children?.length)
				findAllVar(it as FuncNode, name, ranges, gg, gg || it.kind === SymbolKind.Function ? assume : undefined, not_static);
		}
		if (node.kind === SymbolKind.Property) {
			const prop = node as Property;
			for (const it of [prop.get, prop.set])
				it?.parent === prop && it.children?.length && findAllVar(it, name, ranges, false, false, not_static);
		}
	}
	return ranges;
}

function findAllVar(node: FuncNode, name: string, ranges: Range[], global: boolean, assume_glo?: boolean, not_static = true) {
	const fn_is_static = node.kind === SymbolKind.Function && node.static;
	const can_inherit = fn_is_static || node.closure || node.parent?.kind === SymbolKind.Property;
	let t: Variable, assume = assume_glo;
	if (!global && (node.kind !== SymbolKind.Function || fn_is_static && not_static))
		return;
	if (global && node.has_this_param && ['THIS', 'SUPER'].includes(name))
		assume_glo = assume = false;
	else if (node.assume === FuncScope.GLOBAL || node.global?.[name]) {
		if (!global)
			return;
		assume_glo = assume = true;
	} else if (node.local?.[name] || ((!can_inherit || global && !assume_glo) && node.declaration?.[name])) {
		if (!global)
			return;
		assume_glo = assume = false;
	} else if (global && !assume_glo)
		if (fn_is_static && (!(t = node.declaration?.[name]) || t.kind === SymbolKind.Variable && !t.def))
			assume = true;
		else if (node.unresolved_vars?.[name] || name.substring(0, 2) === 'A_')
			assume = true;

	if (not_static)
		not_static = !(node?.local?.[name]?.static);
	if (assume === global) {
		node.children?.forEach(it => {
			if (it.name.toUpperCase() === name && (it.kind !== SymbolKind.Property && it.kind !== SymbolKind.Method && it.kind !== SymbolKind.Class))
				ranges.push(it.selectionRange);
			if (it.children?.length)
				findAllVar(it as FuncNode, name, ranges, global, it.kind === SymbolKind.Function ? assume_glo : global || undefined, not_static);
		});
	} else {
		node.children?.forEach(it => {
			if (it.children?.length)
				findAllVar(it as FuncNode, name, ranges, global, global ? false : undefined, not_static);
			if (global && it.kind === SymbolKind.Property) {
				const prop = it as Property;
				for (const it of [prop.get, prop.set, prop.call])
					it?.children?.length && findAllVar(it, name, ranges, true, false, not_static);
			}
		});
	}
}