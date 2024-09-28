import { DefinitionParams, LocationLink, SymbolKind, Range, CancellationToken } from 'vscode-languageserver';
import { AhkSymbol, lexers, restorePath, find_symbols, Token } from './common.js';
import { URI } from 'vscode-uri';

export async function defintionProvider(params: DefinitionParams, token: CancellationToken): Promise<LocationLink[] | undefined> {
	if (token.isCancellationRequested) return;
	let uri = params.textDocument.uri.toLowerCase();
	const lex = lexers[uri], context = lex?.getContext(params.position);
	const locas: LocationLink[] = [];
	if (!context)
		return;
	if (!context.token.type) {
		const tk = context.token.previous_token;
		if (tk?.content.match(/^#include/i)) {
			const line = params.position.line;
			let character = context.linetext.indexOf('#');
			const d = tk.data as Token, p = d?.data as string[];
			if (p) {
				character += d.offset - tk.offset;
				const rg = Range.create(0, 0, lexers[p[1]]?.document.lineCount ?? 0, 0);
				const end = character + d.content.length;
				const uri = p[0] ? URI.file(restorePath(p[0].replace(/`;/g, ';'))).toString() : p[1];
				return [LocationLink.create(uri, rg, rg, Range.create(line, character, line, end))];
			}
		}
		return;
	}
	if (context.kind === SymbolKind.Null)
		return;
	const set: AhkSymbol[] = [];
	find_symbols(lex, context)?.forEach(it => {
		if (!set.includes(it.node) && set.push(it.node) && it.node.selectionRange.end.character && (uri = it.node.uri ?? it.uri))
			locas.push(LocationLink.create(lexers[uri].document.uri, it.node.range, it.node.selectionRange));
	});
	return locas;
}