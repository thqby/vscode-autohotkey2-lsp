import { CancellationToken, Position, Range, SignatureHelp, SignatureHelpParams, SymbolKind } from 'vscode-languageserver';
import { cleardetectcache, detectExpType, formatMarkdowndetail, FuncNode, getClassMembers, getFuncCallInfo, Lexer, searchNode, Variable } from './Lexer';
import { ahkuris, lexers, Maybe } from './common';
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
		let t: string = res.full, c = doc.buildContext(pos);
		t ||= c.text.toLowerCase();
		detectExpType(doc, t, c.range.end, ts);
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
	tns.forEach((it: any) => {
		let nn = it.node;
		switch (nn.kind) {
			case SymbolKind.Class: {
				let mems = getClassMembers(lexers[nn.uri || it.uri] || doc, nn, !it.ref);
				let n: FuncNode | undefined = (it.ref ? mems['CALL'] : mems['__NEW'] ?? mems['CALL']) as FuncNode;
				if (mems['CALL'] && (<any>mems['CALL']).def !== false)
					n = mems['CALL'] as FuncNode;
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
			name = name.toUpperCase();
			lexers[ahkuris.ahk2]?.object.method[name]?.forEach(node => nodes.push({ node, uri: '' }));
			lexers[ahkuris.ahk2_h]?.object.method[name]?.forEach(node => nodes.push({ node, uri: '' }));
			if (!Object.values(ahkuris).includes(doc.uri))
				doc.object.method[name]?.forEach(node => nodes.push({ node, uri: '' }));
			for (const u in doc.relevance)
				lexers[u]?.object.method[name]?.forEach(node => nodes.push({ node, uri: '' }));
			if (!nodes.length) return undefined;
		} else return undefined;
	}
	nodes.forEach((it: any) => {
		const node = it.node as FuncNode, overloads: string[] = [], needthis = it.needthis ?? 0;
		let params: Variable[] | undefined, name: string | undefined, paramindex: number;
		if (params = node.params) {
			let label = node.full, parameters = params.map(param =>
				({ label: param.name.trim().replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, '$1|...') }));
			if (needthis)
				label = label.replace(/((\w|[^\x00-\x7f])+)\(/, '$1(@this' + (params.length ? ', ' : '')),
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
				let fn = label.substring(0, label.indexOf('(', 1));
				lex.parseScript();
				lex.children.forEach((node: any) => {
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