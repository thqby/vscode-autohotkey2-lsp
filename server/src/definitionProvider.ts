import { DefinitionParams, Definition, LocationLink, SymbolKind, Range, CancellationToken } from 'vscode-languageserver';
import { lexers, restorePath, find_symbols } from './common';
import { URI } from 'vscode-uri';

export async function defintionProvider(params: DefinitionParams, token: CancellationToken): Promise<Definition | LocationLink[] | undefined> {
	if (token.isCancellationRequested) return;
	let uri = params.textDocument.uri.toLowerCase(), locas: LocationLink[] = [];
	let lex = lexers[uri], context = lex?.getContext(params.position);
	if (!context)
		return;
	if (!context.token.type) {
		let tk = context.token.previous_token;
		if (tk?.content.match(/^#include/i)) {
			let line = params.position.line, character = context.linetext.indexOf('#');
			let d = tk.data, p = d?.data as string[];
			if (p) {
				character += d.offset - tk.offset;
				let rg = Range.create(0, 0, lexers[p[1]]?.document.lineCount ?? 0, 0);
				let end = character + d.content.length;
				let uri = p[0] ? URI.file(restorePath(p[0].replace(/`;/g, ';'))).toString() : p[1];
				return [LocationLink.create(uri, rg, rg, Range.create(line, character, line, end))];
			}
		}
		return;
	}
	if (context.kind === SymbolKind.Null)
		return;
	find_symbols(lex, context)?.forEach(it => {
		if (it.node.selectionRange.end.character && (uri = it.node.uri || it.uri))
			locas.push(LocationLink.create(lexers[uri].document.uri, it.node.range, it.node.selectionRange));
	});
	return locas;
}