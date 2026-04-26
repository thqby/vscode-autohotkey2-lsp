import { CancellationToken, Position, SemanticTokensBuilder, SemanticTokensParams, SemanticTokensRangeParams } from 'vscode-languageserver';
import { SemanticToken, SemanticTokenTypes, TT2ST, Token, getSymbolInfo, lexers } from './common';

let fully = false;

function resolveSemantic(tk: Token, sem: SemanticToken, pos: Position, stb: SemanticTokensBuilder) {
	let t, m, n;
	const { type, modifier } = sem;
	switch (type) {
		case SemanticTokenTypes.string:
			if (tk.ignore) {
				t = pos.line;
				const data = tk.data as number[];
				for (let i = 1; i < data.length; i += 2, t++) {
					(m = data[i]) && stb.push(t, 0, m, SemanticTokenTypes.string, 0);
					fully && (n = data[i - 1]) && stb.push(t, m, n, SemanticTokenTypes.comment, 0);
				}
				break;
			}
		// fall through
		case SemanticTokenTypes.comment:
			if (tk.has_LF) {
				let o;
				n = (m = tk.content).indexOf('\n'), t = pos.line;
				stb.push(t++, pos.character, n, type, 0);
				for (; n > 0; t++) {
					n = m.indexOf('\n', o = n + 1);
					(o = (n > 0 ? n : m.length) - o) && stb.push(t, 0, o, type, 0);
				}
			} else stb.push(pos.line, pos.character, tk.length, type, 0);
			break;
		default:
			stb.push(pos.line, pos.character, tk.length, type, modifier ?? 0);
	}
}

export function fullySemanticToken() {
	fully = true;
}

export function semanticTokensOnFull(params: SemanticTokensParams, token?: CancellationToken) {
	const lex = lexers[params.textDocument.uri.toLowerCase()];
	if (!lex || token?.isCancellationRequested) return { data: [] };
	if (lex.st)
		return lex.st;
	const stb = new SemanticTokensBuilder, { document } = lex;
	lex.symbolInformation ?? getSymbolInfo(lex);
	for (const tk of Object.values(lex.tokens)) {
		const sem = tk.semantic ?? (fully && TT2ST.get(tk.type));
		sem && resolveSemantic(tk, sem, tk.pos ??= document.positionAt(tk.offset), stb);
	}
	return lex.st = stb.build();
}

export function semanticTokensOnRange(params: SemanticTokensRangeParams, token?: CancellationToken) {
	const lex = lexers[params.textDocument.uri.toLowerCase()];
	if (!lex || token?.isCancellationRequested) return { data: [] };
	const stb = new SemanticTokensBuilder, { document } = lex;
	const start = document.offsetAt(params.range.start), end = document.offsetAt(params.range.end);
	lex.symbolInformation ?? getSymbolInfo(lex);
	for (const tk of Object.values(lex.tokens)) {
		if (tk.offset < start)
			continue;
		if (tk.offset > end)
			break;
		const sem = tk.semantic ?? (fully && TT2ST.get(tk.type));
		sem && resolveSemantic(tk, sem, tk.pos ??= document.positionAt(tk.offset), stb);
	}
	return stb.build();
}