import { CancellationToken, DocumentSymbol, Hover, HoverParams, SymbolKind } from 'vscode-languageserver';
import { detectExpType, FuncNode, searchNode } from './Lexer';
import { lexers, hoverCache, Maybe } from './server';

export async function hoverProvider(params: HoverParams, token: CancellationToken): Promise<Maybe<Hover>> {
	if (token.isCancellationRequested) return undefined;
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri];
	if (!doc) return;
	let context = doc.buildContext(params.position), t: any, hover: any[] = [];
	if (context) {
		let word = context.text.toLowerCase(), kind: SymbolKind | SymbolKind[] = SymbolKind.Variable;
		let nodes: [{ node: DocumentSymbol, uri: string }] | undefined, node: DocumentSymbol | undefined, uri: string = '';
		if (context.pre === '#') {
			if ((t = hoverCache[1]) && (t = t[word = '#' + word]))
				return t[0];
			else return undefined;
		} else if (context.pre.match(/(?<!\.)\b(goto|break|continue)(?!\s*:)(\(\s*['"]|\s*)$/i)) {
			kind = SymbolKind.Field, word = word + ':';
		} else kind = context.kind;
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
			if (!nodes?.length)
				nodes = undefined;
		}
		if (nodes) {
			if (nodes.length > 1) {
				nodes.map(it => {
					hover.push({ language: 'ahk2', value: (<any>(it.node)).full })
				})
				if (hover.length)
					return { contents: hover }; else return undefined;
			}
			node = nodes[0].node, uri = nodes[0].uri;
			if (node.kind === SymbolKind.Function || node.kind === SymbolKind.Method)
				hover.push({ language: 'ahk2', value: (<FuncNode>node).full });
			else if (node.kind === SymbolKind.Class)
				hover.push({ language: 'ahk2', value: 'class ' + node.name });
			if (node.detail)
				hover.push(node.detail.replace(/(\r?\n)+/g, '$1$1'));
			if (hover.length)
				return { contents: hover };
		}
		if (typeof kind === 'object') {
			if ((t = hoverCache[1]) && t[word])
				return t[word][0];
		} else if (kind === SymbolKind.Function) {
			if ((t = hoverCache[0]) && t[word])
				return t[word][0];
		} else if (kind === SymbolKind.Method) {

		}
	}
	return undefined;
}