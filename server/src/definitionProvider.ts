import { DefinitionParams, Definition, LocationLink, DocumentSymbol, Location, SymbolKind, Range } from 'vscode-languageserver';
import { detectExpType, searchNode } from './Lexer';
import { lexers, restorePath } from './server';
import { URI } from 'vscode-uri';

export async function defintionProvider(params: DefinitionParams): Promise<Definition | LocationLink[] | undefined> {
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri], context = doc.buildContext(params.position), m: any;
	let nodes: [{ node: DocumentSymbol, uri: string }] | undefined, locas: Location[] = [];
	if (context) {
		let word = '', kind: SymbolKind | SymbolKind[] = SymbolKind.Variable, t: any;
		if (context.pre.match(/^\s*#/i)) {
			if ((m = context.linetext.match(/^(\s*#include(again)?\s+)(<.+>|(['"]?)(\s*\*i\s+)?.+?\4)\s*(\s;.*)?$/i)) && m[3]) {
				let line = context.range.start.line, file = m[3].trim();
				for (let t in doc.include)
					if (doc.include[t].raw === file) {
						let rg = Range.create(0, 0, 0, 0);
						if (lexers[t])
							rg = Range.create(0, 0, lexers[t].document.lineCount, 0);
						return [LocationLink.create(URI.file(restorePath(URI.parse(t).fsPath)).toString(), rg, rg, Range.create(line, m[1].length, line, m[1].length + m[3].length))];
					}
			}
			return undefined;
		} else word = context.text.toLowerCase(), kind = context.kind;
		if (word === '')
			return undefined;
		else if (!(nodes = searchNode(doc, word, context.range.end, kind)) && (kind == SymbolKind.Property || kind === SymbolKind.Method)) {
			let ts: any = {};
			nodes = <any>[], detectExpType(doc, word.replace(/\.[^.]+$/, m => {
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
		}
		if (nodes) {
			let uri = '';
			nodes.map(it => {
				if (uri = (<any>it.node).uri || it.uri)
					locas.push(Location.create(URI.file(restorePath(URI.parse(uri).fsPath)).toString(), it.node.selectionRange));
			});
			if (locas.length)
				return locas;
		}
	}
	return undefined;
}