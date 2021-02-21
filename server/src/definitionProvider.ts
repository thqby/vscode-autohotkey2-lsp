import { DefinitionParams, Definition, LocationLink, DocumentSymbol, Location, SymbolKind, Range } from 'vscode-languageserver';
import { detectExpType, searchNode } from './Lexer';
import { lexers } from './server';

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
						return [LocationLink.create(t, rg, rg, Range.create(line, m[1].length, line, m[1].length + m[3].length))];
					}
			}
			return undefined;
		} else if (context.pre.match(/(?<!\.)\b(goto|break|continue)(?!\s*:)(\(\s*['"]|\s*)$/i) || (context.pre.trim() === '' && context.suf.match(/^:\s*(\s;.*)?$/))) {
			kind = SymbolKind.Field, word = context.text.toLowerCase() + ':';
		} else word = context.text.toLowerCase(), kind = context.kind;
		if (kind === SymbolKind.Variable)
			kind = [SymbolKind.Variable, SymbolKind.Class];
		if (word === '')
			return undefined;
		else if (!(nodes = searchNode(doc, word, context.range.end, kind))) {
			let ts: any = {};
			nodes = <any>[], detectExpType(doc, word.replace(/\.[^.]+$/, m => {
				word = m.match(/^\.\w+$/) ? m : '';
				return '';
			}), params.position, ts);
			if (word && !ts['#any'])
				for (const tp in ts)
					searchNode(doc, tp + word, context.range.end, kind, false)?.map(it => {
						nodes?.push(it);
					});
			if (!nodes?.length) {
				if (kind === SymbolKind.Method) {
					let docs = [doc];
					word = word.replace(/^\./, '');
					for (const u in doc.relevance)
						docs.push(lexers[u]);
					for (const doc of docs) {
						let n = doc.object.method[word]?.length;
						if (doc.object.method[word]?.length)
							nodes?.push(...doc.object.method[word].map(it => { return { node: it, uri: doc.uri }; }));
					}
				}
			}
		}
		if (nodes) {
			nodes.map(it => {
				if (it.uri)
					locas.push(Location.create(it.uri, it.node.selectionRange));
			});
			if (locas.length)
				return locas;
		}
	}
	return undefined;
}