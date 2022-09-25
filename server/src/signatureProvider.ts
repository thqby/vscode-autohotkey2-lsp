import { CancellationToken, Position, Range, SignatureHelp, SignatureHelpParams, SymbolKind } from 'vscode-languageserver';
import { ClassNode, cleardetectcache, detectExp, detectExpType, detectVariableType, formatMarkdowndetail, FuncNode, getClassMembers, getFuncCallInfo, Lexer, searchNode, Variable } from './Lexer';
import { ahkvars, lexers, Maybe } from './common';
import { TextDocument } from 'vscode-languageserver-textdocument';

export async function signatureProvider(params: SignatureHelpParams, cancellation: CancellationToken): Promise<Maybe<SignatureHelp>> {
	if (cancellation.isCancellationRequested) return undefined;
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri], kind: SymbolKind = SymbolKind.Function, nodes: any;
	let res: any, name: string, pos: Position, index: number, signinfo: SignatureHelp = { activeSignature: 0, signatures: [], activeParameter: 0 };
	if (!(res = getFuncCallInfo(doc, params.position)) || res.index < 0)
		return undefined;
	name = res.name, pos = res.pos, index = res.index;
	if (pos.character > 0)
		if (doc.document.getText(Range.create({ line: pos.line, character: pos.character - 1 }, pos)) === '.')
			kind = SymbolKind.Method;
	if (kind === SymbolKind.Method || res.full) {
		let context: any, t = res.full;
		if (t === '')
			context = doc.buildContext(pos), t = context.text.toLowerCase();
		if (t.match(/^(((\w|[^\x00-\x7f])+\.)+(\w|[^\x00-\x7f])+)$/)) {
			nodes = searchNode(doc, t, pos, SymbolKind.Method);
			if (!nodes) {
				let word: string = t, ts: any = {};
				nodes = [], cleardetectcache();
				detectExpType(doc, word.replace(/\.[^.]+$/, m => {
					word = m.match(/^\.[^.]+$/) ? m : '';
					return '';
				}), params.position, ts);
				if (word && ts['#any'] === undefined)
					for (const tp in ts)
						searchNode(doc, tp + word, t ? res.pos : context.range.end, kind)?.map(it => {
							if (!nodes.map((i: any) => i.node).includes(it.node))
								nodes.push(it);
						});
				if (!nodes.length)
					nodes = undefined;
			}
		} else {
			let ts: any = {};
			t = t.replace(/\.(\w|[^\x00-\x7f])+$/, '');
			nodes = [], cleardetectcache(), detectExpType(doc, t, params.position, ts);
			if (ts['#any'] === undefined)
				for (const tp in ts)
					searchNode(doc, tp + '.' + name, params.position, SymbolKind.Method)?.map(it => {
						if (!nodes.map((i: any) => i.node).includes(it.node))
							nodes.push(it);
					});
			if (!nodes.length)
				nodes = undefined;
		}
	} else
		nodes = searchNode(doc, name, pos, kind);
	let tns: any;
	do {
		tns = nodes || [], nodes = [];
		tns.map((it: any) => {
			let nn = it.node, kind = nn.kind, m: RegExpExecArray | null;
			if (kind === SymbolKind.Class) {
				let mems = getClassMembers(lexers[nn.uri || it.uri] || doc, nn, !it.ref);
				let n: FuncNode | undefined = (it.ref ? mems['call'] : mems['__new'] ?? mems['call']) as FuncNode;
				if (mems['call'] && (<any>mems['call']).def !== false)
					n = mems['call'] as FuncNode;
				if (n)
					nodes.push({ node: n, uri: '' });
			} else if (kind === SymbolKind.Function || kind === SymbolKind.Method)
				nodes.push(it);
			else if (it.uri) {
				function gen(def: string) {
					if (def.startsWith('(('))
						def = def.slice(1, -1);
					let m = def.match(/^\(([^)]*)\)=>(.*)$/);
					if (m) {
						let d = new Lexer(TextDocument.create('', 'ahk2', 0, `${nn.name}(${m[1]})=>${m[2].includes('=>') ? 'void' : m[2]}`), undefined, -1);
						d.parseScript();
						let node = d.declaration[nn.name.toLowerCase()];
						if (node?.kind === SymbolKind.Function) {
							if (m[2].includes('=>'))
								node.returntypes = { [m[2]]: true };
							nodes.push({ node });
							if (nn.kind === SymbolKind.TypeParameter) {
								let scope = it.scope, p = scope.parent;
								if (p?.parent?.kind === SymbolKind.Property && p.parent.parent?.kind === SymbolKind.Class)
									scope = p.parent;
								formatMarkdowndetail(scope);
							} else formatMarkdowndetail(nn);
							let detail = nn.detail?.split('\n___\n').pop();
							if (detail)
								node.detail = detail.trim();
						}
					}
				}
				if (kind === SymbolKind.Property) {
					let s = Object.keys(nn.returntypes || {}).pop() || '';
					if (s) {
						cleardetectcache(), detectExp(lexers[it.uri], s, Position.is(nn.returntypes[s]) ? nn.returntypes[s] : pos).map(tp => {
							if (tp.includes('=>')) {
								gen(tp);
							} else searchNode(doc, tp, pos, SymbolKind.Function)?.map(it => {
								if (it.node.kind === SymbolKind.Function || it.node.kind === SymbolKind.Method || (it.node.kind === SymbolKind.Class && (<ClassNode>it.node).extends !== 'Primitive'))
									nodes.push(it);
							});
						});
					}
				} else if (kind === SymbolKind.Variable || kind === SymbolKind.TypeParameter)
					cleardetectcache(), detectVariableType(lexers[it.uri], it, it.uri === doc.uri ? pos : it.node.selectionRange.end).map(tp => {
						if (tp.includes('=>')) {
							gen(tp);
						} else searchNode(doc, tp, pos, SymbolKind.Function)?.map(it => {
							if (it.node.kind === SymbolKind.Function || it.node.kind === SymbolKind.Method || (it.node.kind === SymbolKind.Class && (<ClassNode>it.node).extends !== 'Primitive'))
								nodes.push(it);
						});
					});
			}
		});
	} while (nodes.length > 0 && (nodes[0].node.kind !== SymbolKind.Function && nodes[0].node.kind !== SymbolKind.Method && nodes[0].node.kind !== SymbolKind.Class));
	if (!nodes || !nodes.length) {
		if (kind === SymbolKind.Method) {
			nodes = [];
			for (const key in ahkvars)
				ahkvars[key].children?.map(node => {
					if (node.kind === SymbolKind.Method && node.name.toLowerCase() === name &&
						!nodes.map((it: any) => it.node).includes(node))
						nodes.push({ node, uri: '' });
				});
			doc.object.method[name]?.map(node => {
				nodes?.push({ node, uri: '' })
			});
			for (const u in doc.relevance)
				lexers[u].object.method[name]?.map(node => {
					nodes?.push({ node, uri: '' })
				});
			if (!nodes?.length) return undefined;
		} else return undefined;
	}
	nodes?.map((it: any) => {
		const node = it.node as FuncNode, overloads: string[] = [];
		let params: Variable[] | undefined, name: string | undefined;
		if (params = node.params)
			signinfo.signatures.push({
				label: node.full,
				parameters: params.map(param => ({
					label: param.name.trim().replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, '$1|...')
				})),
				documentation: node.detail ? {
					kind: 'markdown',
					value: formatMarkdowndetail(node, name = params[index]?.name ?? '', overloads)
				} : undefined
			});
		if (overloads.length) {
			let lex = new Lexer(TextDocument.create('', 'ahk2', -10, overloads.join('\n')), undefined, -1);
			let { label, documentation } = signinfo.signatures[0], n = node;
			label = label.replace(new RegExp(`(?<=\\b${node.name})\\(.+$`), '');
			lex.parseScript();
			lex.children.map((node: any) => {
				if (params = node.params)
					signinfo.signatures.push({
						label: label + node.full.replace(/^[^(]+/, ''),
						parameters: params.map((param: any) => ({
							label: param.name.trim().replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, '$1|...')
						})),
						documentation: (name === params[index]?.name) ? documentation : {
							kind: 'markdown',
							value: formatMarkdowndetail(n, params[index]?.name ?? '', [])
						}
					});
			});
		}
	});
	signinfo.activeParameter = index;
	return signinfo;
}