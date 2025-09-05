import { CancellationToken, Location, Range, ReferenceParams } from 'vscode-languageserver';
import {
	ANY, AhkSymbol, ClassNode, Context, FuncNode, FuncScope, Lexer, Property, SymbolKind, TokenType, Variable, ZERO_RANGE,
	ahkUris, ahkVars, decltypeExpr, findClass, findSymbols, getClassBase, lexers, symbolProvider
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
					symbolProvider({ textDocument: { uri } });
					const rgs = findAllFromScope(all_uris[uri] ?? lexers[uri] as unknown as AhkSymbol, name, SymbolKind.Variable);
					if (rgs.length)
						references[lexers[uri].document.uri] = rgs;
				}
				break;
			}
		// fall through
		case SymbolKind.Method:
		case SymbolKind.Property: {
			const cache = new Map<AhkSymbol | string, boolean>();
			const builtin_uris = new Set(Object.values(ahkUris));
			builtin_uris.delete(ahkUris.winapi), cache.set(undefined!, false);
			name = context.word.toUpperCase();
			for (const it of nodes) {
				const cls = add_cls(it.parent ?? it.node.parent!);
				if (!allow_builtin && builtin_uris.has(cls?.uri || it.uri))
					return null;
			}
			for (const uri of [lex.uri, ...Object.keys(lex.relevance)]) {
				if (!(lex = lexers[uri]))
					continue;
				const refs: Range[] = [], { document, tokens } = lex;
				for (const tk of Object.values(tokens)) {
					if (tk.ignore || tk.type !== TokenType.Identifier || tk.content.toUpperCase() !== name)
						continue;
					const t = tk.symbol;
					if (t) {
						let p;
						if (t.kind === SymbolKind.Class) {
							const n = t.full?.replace(/\.?[^.]+$/, '');
							p = n && findClass(lex, n);
							p && match(p) && refs.push(t.selectionRange);
						} else if (t.kind !== SymbolKind.Function)
							(p = t.parent) && match(p) && refs.push(t.selectionRange);
						continue;
					}
					if (tk.previous_token?.type !== TokenType.Dot)
						continue;
					const start = document.positionAt(tk.offset), end = { line: start.line, character: start.character + tk.length };
					const { token } = lex.getContext(start, true), tps = decltypeExpr(lex, token, tk.offset - 1);
					tps.some(tp => tp === ANY || match(tp)) && refs.push({ start, end });
				}
				if (refs.length)
					references[lex.document.uri] = refs;
			}
			break;
			function key(sym: AhkSymbol) {
				const t = sym.full?.toLowerCase();
				return !t ? sym : (sym as ClassNode).prototype ? `!${t}` : t;
			}
			function match(sym: AhkSymbol) {
				const syms: AhkSymbol[] = [];
				let r;
				do {
					if ((r = cache.get(key(sym))) !== undefined || syms.includes(sym))
						break;
					syms.push(sym);
				} while ((sym = getClassBase(sym, lex)!));
				add_cache(syms, r ??= false);
				return r;
			}
			function add_cls(sym: AhkSymbol) {
				const syms: AhkSymbol[] = [];
				let t, cls;
				do {
					if (cache.has(key(sym)) || syms.includes(sym))
						break;
					syms.push(sym);
					if ((t = (sym as ClassNode).property?.[name])){
						add_cache(syms, true), cls = sym;
						const uri = lexers[sym.uri!]?.document.uri;
						uri && (references[uri] ??= []).push(t.selectionRange);
					}
				} while ((sym = getClassBase(sym, lex)!));
				add_cache(syms, false);
				return cls;
			}
			function add_cache(syms: AhkSymbol[], r: boolean) {
				for (const s of syms)
					cache.set(key(s), r);
				syms.length = 0;
			}
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
				it?.parent === prop && it.children?.length && findAllFromScope(it, name, kind, ranges);
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
		else if (node.unresolved_vars?.[name] || name.substring(0, 2) === 'A_' && name in ahkVars)
			assume = true;

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