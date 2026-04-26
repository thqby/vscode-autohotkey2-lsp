import { CancellationToken, InlayHint, InlayHintParams } from 'vscode-languageserver';
import { ClassNode, configCache, FuncNode, getClassConstructor, getSymbolInfo, lexers, resolveVarAlias, SymbolKind, Token, TokenType } from './common';

export function inlayHintProvider(params: InlayHintParams, token?: CancellationToken) {
	const { ParameterNames, SuppressWhenArgumentMatchesName } = configCache.InlayHints ?? {};
	const { range, textDocument: { uri } } = params;
	const lex = lexers[uri.toLowerCase()];
	if (!lex || !ParameterNames || token?.isCancellationRequested) return;
	const result: InlayHint[] = [], { document, tokens } = lex;
	const start = document.offsetAt(range.start);
	const end = document.offsetAt(range.end);
	lex.symbolInformation ?? getSymbolInfo(lex);
	for (const tk of Object.values(lex.tokens)) {
		if (tk.offset < start)
			continue;
		if (tk.offset > end)
			break;
		if (tk.callsite)
			paramNames(tk);
	}
	return result;
	function paramNames(tk: Token) {
		const { paraminfo: pi } = tk.callsite!;
		if (!pi?.count || !tk.definition) return;
		let node = resolveVarAlias(tk.definition) as FuncNode, params;
		if (node?.kind === SymbolKind.Class)
			node = getClassConstructor(node as unknown as ClassNode) as FuncNode;
		if (!(params = node?.params)) return;
		let p = params.at(-1), fc, pc, n, param, i = 0, ppi = Infinity;
		let { count, miss: arr } = pi, ll = lexers[node.uri!];
		for (arr = [...arr]; (n = arr.pop()) === --count;);
		(arr = [pi.offset, ...pi.comma]).length = ++count;
		if (p?.arr === 2) {
			pc = params.length, ppi = p.index!;
			fc = pc % 2 !== p.data;
			n = fc ? 2 : 1;
		}
		for (const o of arr) {
			const tk = tokens[tokens[o].next_token_offset];
			if (i >= ppi) {
				let ii = Math.min(i, pc! - 1);
				if (ii === pc! - 1) {
					if ((!(i % 2 !== p!.data) || ++ii && fc) && i >= pi.count - n!)
						if (i === pi.count - 1 || ii - n! !== pc! - 2)
							ii -= n!;
				} else if (i < pi.count - n! && !params[ii + n!]?.name.length)
					ii += n!;
				param = params[ii] ?? p;
				if (param.arr === 2)
					param = params[param.index! - (pc === ii ? 1 : 2)];
			} else param = params[i];
			if (i++, !param?.name)
				break;
			if (SuppressWhenArgumentMatchesName && tk.type === TokenType.Identifier &&
				(tk.next_token_offset === arr[i] || tk.offset + tk.length === pi.end) &&
				param.name.toLowerCase() === tk.content.toLowerCase())
				continue;
			result.push({
				label: ll ? [{
					value: param.name, location: { uri: ll.document.uri, range: param.selectionRange }
				}, { value: ':' }] : param.name + ':',
				paddingRight: true, position: tk.pos ??= document.positionAt(tk.offset),
			});
		}
	}
}