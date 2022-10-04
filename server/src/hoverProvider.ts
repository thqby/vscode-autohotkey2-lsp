import { CancellationToken, DocumentSymbol, Hover, HoverParams, SymbolKind } from 'vscode-languageserver';
import { ClassNode, cleardetectcache, detectExpType, formatMarkdowndetail, FuncNode, searchNode, Variable } from './Lexer';
import { lexers, hoverCache, Maybe, ahkvars } from './common';

export async function hoverProvider(params: HoverParams, token: CancellationToken): Promise<Maybe<Hover>> {
	if (token.isCancellationRequested) return undefined;
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri];
	let context = doc?.buildContext(params.position), t: any, hover: any[] = [];
	if (context) {
		let word = context.text.toLowerCase(), kind: SymbolKind = SymbolKind.Variable;
		let nodes: [{ node: DocumentSymbol, uri: string, scope?: DocumentSymbol }] | undefined | null, node: DocumentSymbol | undefined, uri: string = '';
		if (!word || context.kind === SymbolKind.Null) {
			if (context.token) {
				if ((t = hoverCache[1]) && (t = t[context.token.content.toLowerCase()]))
					return t[0];
			}
			return undefined;
		}
		if (undefined === (nodes = searchNode(doc, word, context.range.end, kind = context.kind)) && word.includes('.') && (kind == SymbolKind.Property || kind === SymbolKind.Method)) {
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
			if (!nodes?.length)
				nodes = undefined;
		} else if (nodes === null)
			return undefined;
		if (!nodes) {
			if (kind === SymbolKind.Method || kind === SymbolKind.Property) {
			} else if (ahkvars[word])
				nodes = [{ node: ahkvars[word], uri: '' }];
			else if ((t = hoverCache[kind === SymbolKind.Function ? 0 : 1]) && (t = t[word]))
				return t[0];
		}
		if (nodes) {
			if (nodes.length > 1) {
				nodes.map(it => {
					if ((<any>(it.node)).full)
						hover.push({ kind: 'ahk2', value: (<any>(it.node)).full })
				});
			} else {
				let { node, scope } = nodes[0];
				if (node.kind === SymbolKind.Function || node.kind === SymbolKind.Method || node.kind === SymbolKind.Property) {
					if ((<FuncNode>node).full)
						hover.push({ kind: 'ahk2', value: (<FuncNode>node).full });
				} else if (node.kind === SymbolKind.Class)
					hover.push({ kind: 'ahk2', value: 'class ' + ((<ClassNode>node).full || node.name) });
				else if (scope && node.kind === SymbolKind.TypeParameter) {
					let p = (scope as any).parent;
					if (p?.kind === SymbolKind.Property && p.parent?.kind === SymbolKind.Class)
						scope = p as DocumentSymbol;
					formatMarkdowndetail(scope);
				}

				if (node.detail) {
					let md = formatMarkdowndetail(node);
					if (node.kind === SymbolKind.Variable) {
						let re = /^/;
						if (md.startsWith('\n*@var* ')) {
							md = md.replace(' — ', '\n___\n');
							re = /^\n\*@var\*\s/;
						} else if (md.startsWith('\n*@type* '))
							md = md.replace(' — ', '\n___\n').replace(/^\n\*@type\*\s*/, `\`${node.name}\`: `);
						else
							md = `\`${node.name}\`\n___\n${md}`;
						md = md.replace(re, !scope ? '*@global* ' : (node as Variable).static ? '*@static* ' : '*@local* ');
					}
					hover.push({ kind: 'markdown', value: (hover.length ? '___\n' : '') + md });
				}
			}
			if (hover.length)
				return {
					contents: {
						kind: 'markdown', value: hover.map(it => {
							if (it.kind === 'ahk2') {
								return '```ahk2\n' + it.value + '\n```';
							} else
								return it.value;
						}).join('\n\n')
					}
				};
		}
	}
	return undefined;
}