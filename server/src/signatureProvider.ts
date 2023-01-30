import { CancellationToken, Position, Range, SignatureHelp, SignatureHelpParams, SymbolKind } from 'vscode-languageserver';
import { cleardetectcache, detectExpType, formatMarkdowndetail, FuncNode, getClassMembers, getFuncCallInfo, Lexer, searchNode, Variable } from './Lexer';
import { ahkvars, lexers, Maybe } from './common';
import { TextDocument } from 'vscode-languageserver-textdocument';

export async function signatureProvider(params: SignatureHelpParams, token: CancellationToken): Promise<Maybe<SignatureHelp>> {
	if (token.isCancellationRequested) return undefined;
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
		if (kind === SymbolKind.Method) {
			if ((res.name === 'call' && ts['func.call']) || (res.name === 'bind' && ts['func.bind'])) {
				let tt: any = {};
				detectExpType(doc, t.replace(new RegExp(`\.${res.name}$`, 'i'), ''), pos, tt);
				if (Object.keys(tt).length) {
					if (res.name === 'bind') {
						let t = ts['func.bind'].node = Object.assign({}, ts['func.bind'].node) as FuncNode;
						let f = t;
						for (let n in tt) {
							if (!(f = tt[n]?.node) && n.startsWith('$'))
								f = searchNode(doc, n, pos, SymbolKind.Variable)?.pop()?.node as FuncNode;
							if (!f) return undefined;
							break;
						}
						t.params = f.params;
						t.detail = t.detail && f.detail ? t.detail + '\n___\n' + f.detail : (t.detail ?? '') + (f.detail ?? '');
						let rp = f.full.lastIndexOf(')'), lp = f.full.indexOf('(', 1);
						lp === -1 && f.full.startsWith('(') && lp++;
						t.full = t.full.replace(/Bind\([^)]*\)/i, `Bind(${f.full.slice(lp + 1, rp)})`);
						if (f.kind === SymbolKind.Method)
							kind = SymbolKind.Function;
					} else ts = tt;
				}
			}
		}
	} else
		detectExpType(doc, name, pos, ts);
	nodes = Object.values(ts).filter((it: any) => it?.node);
	let tns: any;
	tns = nodes ?? [], nodes = [];
	tns.map((it: any) => {
		let nn = it.node;
		switch (nn.kind) {
			case SymbolKind.Class: {
				let mems = getClassMembers(lexers[nn.uri || it.uri] || doc, nn, !it.ref);
				let n: FuncNode | undefined = (it.ref ? mems['call'] : mems['__new'] ?? mems['call']) as FuncNode;
				if (mems['call'] && (<any>mems['call']).def !== false)
					n = mems['call'] as FuncNode;
				if (n)
					nodes.push({ node: n, uri: '' });
				break;
			}
			case SymbolKind.Method:
				if (kind === SymbolKind.Function)
					it.needthis = 1;
			case SymbolKind.Function:
				nodes.push(it);
				break;
		}
	});
	if (!nodes.length) {
		if (kind === SymbolKind.Method) {
			for (const key in ahkvars)
				ahkvars[key].children?.map(node => {
					if (node.kind === SymbolKind.Method && node.name.toLowerCase() === name &&
						!nodes.map((it: any) => it.node).includes(node))
						nodes.push({ node, uri: '' });
				});
			doc.object.method[name]?.map(node => nodes.push({ node, uri: '' }));
			for (const u in doc.relevance)
				lexers[u].object.method[name]?.map(node => nodes.push({ node, uri: '' }));
			if (!nodes.length) return undefined;
		} else return undefined;
	}
	nodes.map((it: any) => {
		const node = it.node as FuncNode, overloads: string[] = [], needthis = it.needthis ?? 0;
		let params: Variable[] | undefined, name: string | undefined, paramindex: number;
		if (params = node.params) {
			let label = node.full, parameters = params.map(param =>
				({ label: param.name.trim().replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, '$1|...') }));
			if (needthis)
				label = label.replace(/(?<=(\w|[^\x00-\x7f])+)\(/, '(@this' + (params.length ? ', ' : '')),
					parameters.unshift({ label: '@this' });
			paramindex = index - needthis;
			signinfo.signatures.push({
				label,
				parameters,
				documentation: node.detail ? {
					kind: 'markdown',
					value: formatMarkdowndetail(node, name = params[paramindex]?.name ?? '', overloads)
				} : undefined
			});
			if (overloads.length) {
				let lex = new Lexer(TextDocument.create('', 'ahk2', -10, overloads.join('\n')), undefined, -1);
				let { label, documentation } = signinfo.signatures[0], n = node;
				let fn = label.replace(new RegExp(`(?<=\\b${node.name})\\(.+$`), '');
				lex.parseScript();
				lex.children.map((node: any) => {
					if (params = node.params) {
						parameters = params.map(param => ({ label: param.name.trim().replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, '$1|...') }));
						if (needthis)
							label = fn + node.full.replace(/^[^(]+/, '').replace('(', '(@this' + (params.length ? ', ' : '')),
								parameters.unshift({ label: '@this' });
						else
							label = fn + node.full.replace(/^[^(]+/, '');
						signinfo.signatures.push({
							label,
							parameters,
							documentation: (name === params[paramindex]?.name) ? documentation : {
								kind: 'markdown',
								value: formatMarkdowndetail(n, params[paramindex]?.name ?? '', [])
							}
						});
					}
				});
			}
		}
	});
	signinfo.activeParameter = index;
	return signinfo;
}