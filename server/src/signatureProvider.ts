import { CancellationToken, Position, Range, SignatureHelp, SignatureHelpParams, SymbolKind } from 'vscode-languageserver';
import { cleardetectcache, detectExpType, formatMarkdowndetail, FuncNode, getClassMembers, getFuncCallInfo, Lexer, Variable } from './Lexer';
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
	let ts: any = {};
	if (cleardetectcache(), kind === SymbolKind.Method || res.full) {
		let t = res.full;
		t ||= doc.buildContext(pos).text.toLowerCase();
		detectExpType(doc, t, pos, ts);
	} else
		detectExpType(doc, name, pos, ts);
	nodes = Object.values(ts).filter((it: any) => it?.node);
	let tns: any;
	tns = nodes ?? [], nodes = [];
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
	});
	if (!nodes.length) {
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
	nodes.map((it: any) => {
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