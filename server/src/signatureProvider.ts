import { CancellationToken, Position, Range, SignatureHelp, SignatureHelpParams, SymbolKind } from 'vscode-languageserver';
import { detectExpType, FuncNode, getFuncCallInfo, searchNode } from './Lexer';
import { ahkclasses, ahkfunctions, lexers, Maybe } from './server';

export async function signatureProvider(params: SignatureHelpParams, cancellation: CancellationToken): Promise<Maybe<SignatureHelp>> {
	if (cancellation.isCancellationRequested) return undefined;
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri], kind: SymbolKind = SymbolKind.Function, nodes: any;
	let res: any, name: string, pos: Position, index: number, signinfo: SignatureHelp = { activeSignature: 0, signatures: [], activeParameter: 0 }
	if (!(res = getFuncCallInfo(doc, params.position)))
		return undefined;
	name = res.name, pos = res.pos, index = res.index;
	if (pos.character > 0)
		if (doc.document.getText(Range.create({ line: pos.line, character: pos.character - 1 }, pos)) === '.')
			kind = SymbolKind.Method;
	if (kind === SymbolKind.Method) {
		let context = doc.buildContext(pos), t = context.text.toLowerCase();
		if (t.match(/^(((\w|[^\x00-\xff])+\.)+(\w|[^\x00-\xff])+)$/))
			nodes = searchNode(doc, t, pos, SymbolKind.Method);
		else {
			let ts: any = {};
			t = t.replace(/\.(\w|[^\x00-\xff])+$/, '');
			nodes = [], detectExpType(doc, t, params.position, ts);
			if (!ts['#any'])
				for (const tp in ts)
					searchNode(doc, tp + '.' + name, params.position, SymbolKind.Method, false)?.map(it => {
						nodes.push(it);
					});
			if (!nodes.length)
				nodes = undefined;
		}
	} else
		nodes = searchNode(doc, name, pos, kind);
	if (!nodes) {
		if (kind === SymbolKind.Method) {
			nodes = [];
			for (const key in ahkclasses)
				ahkclasses[key].map(node => {
					if (!key.match(/^(tab\d|listbox|ddl|dropdownlist|combobox)$/i) && node.kind === SymbolKind.Method && node.name.toLowerCase() === name)
						nodes?.push({ node, uri: '' })
				});
			doc.object.method[name]?.map(node => {
				nodes?.push({ node, uri: '' })
			});
			for (const u in doc.relevance)
				lexers[u].object.method[name]?.map(node => {
					nodes?.push({ node, uri: '' })
				});
			if (!nodes?.length) return undefined;
		} else if (kind === SymbolKind.Function && ahkfunctions[name])
			nodes = [{ node: ahkfunctions[name], uri: '' }];
		else return undefined;
	}
	nodes?.map((it: any) => {
		const node = it.node;
		signinfo.signatures.push({
			label: (<FuncNode>node).full,
			parameters: (<FuncNode>node).params.map(param => {
				return {
					label: param.name.trim().replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, '$1|...')
				}
			}),
			documentation: node.detail
		});
	});
	signinfo.activeParameter = index < 0 ? 9999 : index;
	return signinfo;
}