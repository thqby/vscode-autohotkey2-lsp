import { CancellationToken, Position, Range, SignatureHelp, SignatureHelpParams, SymbolKind } from 'vscode-languageserver';
import { executeCommands, parameterhints } from './executeCommandProvider';
import { ClassNode, detectExp, detectExpType, detectVariableType, formatMarkdowndetail, FuncNode, getFuncCallInfo, searchNode } from './Lexer';
import { ahkvars, lexers, Maybe } from './server';

export async function signatureProvider(params: SignatureHelpParams, cancellation: CancellationToken): Promise<Maybe<SignatureHelp>> {
	if (cancellation.isCancellationRequested) return undefined;
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri], kind: SymbolKind = SymbolKind.Function, nodes: any, mv = parameterhints();
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
		if (t.match(/^(((\w|[^\x00-\xff])+\.)+(\w|[^\x00-\xff])+)$/))
			nodes = searchNode(doc, t, pos, SymbolKind.Method);
		else {
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
	let ttt: any;
	do {
		ttt = nodes || [], nodes = [];
		ttt.map((it: any) => {
			let nn = it.node, kind = nn.kind;
			if (kind === SymbolKind.Class) {
				let dec = (<ClassNode>nn).staticdeclaration;
				if (dec && dec['call']) {
					nodes.push({ node: dec['call'], uri: '' });
				} else {
					dec = (<ClassNode>nn).declaration;
					if (dec && dec['__new'])
						nodes.push({ node: dec['__new'], uri: '' });
				}
			} else if (kind === SymbolKind.Function || kind === SymbolKind.Method)
				nodes.push(it);
			else if (it.uri) {
				if (kind === SymbolKind.Property) {
					let s = Object.keys(nn.returntypes || {}).pop() || '';
					if (s) {
						detectExp(lexers[it.uri], s, Position.is(nn.returntypes[s]) ? nn.returntypes[s] : pos).map(tp => {
							searchNode(doc, tp, pos, SymbolKind.Function)?.map(it => {
								if (it.node.kind === SymbolKind.Function || it.node.kind === SymbolKind.Method || it.node.kind === SymbolKind.Class)
									nodes.push(it);
							});
						});
					}
				} else if (kind === SymbolKind.Variable)
					detectVariableType(lexers[it.uri], it.node.name.toLowerCase(), it.uri === doc.uri ? pos : undefined).map(tp => {
						searchNode(doc, tp, pos, SymbolKind.Function)?.map(it => {
							if (it.node.kind === SymbolKind.Function || it.node.kind === SymbolKind.Method || it.node.kind === SymbolKind.Class)
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
		const node = it.node as FuncNode;
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
	if (mv && signinfo.signatures.length === 1 && signinfo.signatures[0].parameters?.length === 0)
		executeCommands([{ command: 'cursorRight' }]);
	return signinfo;
}