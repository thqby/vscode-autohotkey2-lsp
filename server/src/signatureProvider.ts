import { CancellationToken, Position, Range, SignatureHelp, SignatureHelpParams, SymbolKind } from 'vscode-languageserver';
import { ClassNode, detectExp, detectExpType, detectVariableType, formatMarkdowndetail, FuncNode, getClassMembers, getFuncCallInfo, searchNode } from './Lexer';
import { ahkvars, lexers, Maybe } from './server';

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
		if (t.match(/^(((\w|[^\x00-\xff])+\.)+(\w|[^\x00-\xff])+)$/)) {
			nodes = searchNode(doc, t, pos, SymbolKind.Method);
			if (!nodes) {
				let word: string = t, ts: any = {};
				nodes = [];
				detectExpType(doc, word.replace(/\.[^.]+$/, m => {
					word = m.match(/^\.[^.]+$/) ? m : '';
					return '';
				}), params.position, ts);
				if (word && ts['#any'] === undefined)
					for (const tp in ts)
						searchNode(doc, tp + word, context.range.end, kind)?.map(it => {
							if (!nodes?.map((i: any) => i.node).includes(it.node))
								nodes?.push(it);
						});
				if (!nodes.length)
					nodes = undefined;
			}
		} else {
			let ts: any = {};
			t = t.replace(/\.(\w|[^\x00-\xff])+$/, '');
			nodes = [], detectExpType(doc, t, params.position, ts);
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
				let mems = getClassMembers(lexers[nn.uri || it.uri] || doc, nn, true);
				let n: FuncNode | undefined;
				for (const m of mems) {
					let _ = m.name.toLowerCase();
					if (_  === 'call') {
						n = m as FuncNode;
						if ((<any>m).def !== false)
							break;
					} else if (_ === '__new')
						n = m as FuncNode;
				}
				if (n)
					nodes.push({ node: n, uri: '' });
			} else if (kind === SymbolKind.Function || kind === SymbolKind.Method)
				nodes.push(it);
			else if (it.uri) {
				if (kind === SymbolKind.Property) {
					let s = Object.keys(nn.returntypes || {}).pop() || '';
					if (s) {
						detectExp(lexers[it.uri], s, Position.is(nn.returntypes[s]) ? nn.returntypes[s] : pos).map(tp => {
							searchNode(doc, tp, pos, SymbolKind.Function)?.map(it => {
								if (it.node.kind === SymbolKind.Function || it.node.kind === SymbolKind.Method || (it.node.kind === SymbolKind.Class && (<ClassNode>it.node).extends !== 'Primitive'))
									nodes.push(it);
							});
						});
					}
				} else if (kind === SymbolKind.Variable)
					detectVariableType(lexers[it.uri], it.node.name.toLowerCase(), it.uri === doc.uri ? pos : undefined).map(tp => {
						searchNode(doc, tp, pos, SymbolKind.Function)?.map(it => {
							if (it.node.kind === SymbolKind.Function || it.node.kind === SymbolKind.Method || (it.node.kind === SymbolKind.Class && (<ClassNode>it.node).extends !== 'Primitive'))
								nodes.push(it);
						});
					});
				else
					return;
				if (tns.length === 1 && !nodes.length && nn.detail && (m = new RegExp('\\b' + nn.name + '\\([^)]*\\)').exec(nn.detail))) {
					let params: any = [], rg = Range.create(0, 0, 0, 0), node: FuncNode;
					m[0].match(/(?<=[(,]\s*)(\w|[^\x00-\xff])+/g)?.map(name => params.push({ name }));
					node = FuncNode.create(nn.name, SymbolKind.Function, rg, rg, params);
					node.detail = nn.detail.replace(m[0], ''), nodes.push({ node });
				}
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
		const node = it.node as FuncNode;
		if (node.params)
			signinfo.signatures.push({
				label: node.full,
				parameters: node.params.map(param => {
					return {
						label: param.name.trim().replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, '$1|...')
					}
				}),
				documentation: node.detail ? {
					kind: 'markdown',
					value: formatMarkdowndetail(node.detail, index < node.params.length ? node.params[index].name : undefined)
				} : undefined
			});
	});
	signinfo.activeParameter = index;
	return signinfo;
}