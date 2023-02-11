import { DefinitionParams, Definition, LocationLink, DocumentSymbol, SymbolKind, Range, CancellationToken } from 'vscode-languageserver';
import { cleardetectcache, detectExpType, searchNode, Token } from './Lexer';
import { lexers, restorePath } from './common';
import { URI } from 'vscode-uri';

export async function defintionProvider(params: DefinitionParams, token: CancellationToken): Promise<Definition | LocationLink[] | undefined> {
	if (token.isCancellationRequested) return;
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri], context = doc?.buildContext(params.position), m: any;
	let nodes: [{ node: DocumentSymbol, uri: string }] | undefined | null, locas: LocationLink[] = [];
	if (context) {
		let word = '', kind: SymbolKind = SymbolKind.Variable, tk: Token;
		if (context.pre.startsWith('#') && !context.token) {
			let line = params.position.line, character = context.linetext.indexOf('#');
			tk = doc.tokens[doc.document.offsetAt({line, character})];
			if (tk && tk.content.match(/^#include/i)) {
				let d = tk.data, p = d?.data as string[];
				if (p) {
					character += d.offset - tk.offset;
					let rg = Range.create(0, 0, lexers[p[1]]?.document.lineCount ?? 0, 0);
					let end = character + d.content.replace(/\s+;.*$/, '').length;
					let uri = p[0] ? URI.file(restorePath(p[0])).toString() : p[1];
					return [LocationLink.create(uri, rg, rg, Range.create(line, character, line, end))];
				}
			}
			return undefined;
		} else word = context.text.toLowerCase(), kind = context.kind;
		if (!word || kind === SymbolKind.Null)
			return undefined;
		else if (undefined === (nodes = searchNode(doc, word, context.range.end, kind)) && (kind == SymbolKind.Property || kind === SymbolKind.Method)) {
			let ts: any = {};
			nodes = <any>[], cleardetectcache(), detectExpType(doc, word.replace(/\.[^.]+$/, m => {
				word = m.match(/^\.[^.]+$/) ? m : '';
				return '';
			}), params.position, ts);
			if (word && ts['#any'] === undefined)
				for (const tp in ts)
					searchNode(doc, tp + word, context.range.end, kind)?.map(it => {
						if (!nodes?.map(i => i.node).includes(it.node))
							nodes?.push(it);
					});
			if (!nodes?.length && kind === SymbolKind.Method) {
				nodes = <any>[];
				let docs = [doc];
				word.replace(/\.([^.]+)$/, (...m) => {
					word = m[1];
					for (const u in doc.relevance)
						docs.push(lexers[u]);
					for (const doc of docs) {
						if (doc.object.method[word]?.length)
							nodes?.push(...doc.object.method[word].map(it => { return { node: it, uri: doc.uri }; }));
					}
					return '';
				});
			}
		} else if (nodes === null)
			return undefined;
		if (nodes) {
			let uri = '';
			nodes.map(it => {
				if (it.node.selectionRange.end.character && (uri = (<any>it.node).uri || it.uri))
					locas.push(LocationLink.create(lexers[uri].document.uri, it.node.range, it.node.selectionRange));
			});
			if (locas.length)
				return locas;
		}
	}
	return undefined;
}