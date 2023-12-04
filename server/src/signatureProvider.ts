import { CancellationToken, DocumentSymbol, SignatureHelp, SignatureHelpParams, SymbolKind } from 'vscode-languageserver';
import { reset_detect_cache, detectExpType, formatMarkdowndetail, FuncNode, getFuncCallInfo, Lexer, searchNode, Variable, allIdentifierChar, get_class_member, get_class_call } from './Lexer';
import { ahkuris, ahkvars, lexers, Maybe } from './common';
import { TextDocument } from 'vscode-languageserver-textdocument';

export async function signatureProvider(params: SignatureHelpParams, token: CancellationToken): Promise<Maybe<SignatureHelp>> {
	if (token.isCancellationRequested) return undefined;
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri], nodes: any, context: any;
	let signinfo: SignatureHelp = { activeSignature: 0, signatures: [], activeParameter: 0 };
	let res = getFuncCallInfo(doc, params.position);
	if (!res || res.index < 0)
		return undefined;
	let { name, pos, index, kind } = res, ts: any = {}, iscall = true, prop = '';
	if (reset_detect_cache(), kind !== SymbolKind.Function) {
		let t = (context = doc.buildContext(pos)).text.toLowerCase();
		t = t.replace(/\.([^.()]*)$/, (_, m) => (prop = m.toLowerCase(), ''));
		if (prop && !allIdentifierChar.test(prop))
			return;
		if (kind === SymbolKind.Property)
			prop ||= '__item', iscall = false;
		detectExpType(doc, t, context.range.end, ts);
		// name = name.toLowerCase();
		// if (kind === SymbolKind.Method && ((name === 'call' && ts['@func.call']) || (name === 'bind' && ts['@func.bind']))) {
		// 	let tt: any = {};
		// 	detectExpType(doc, t.replace(new RegExp(`\.${res.name}$`, 'i'), ''), pos, tt);
		// 	if (Object.keys(tt).length) {
		// 		if (res.name === 'bind') {
		// 			let t = ts['func.bind'].node = Object.assign({}, ts['func.bind'].node) as FuncNode;
		// 			let f = t;
		// 			for (let n in tt) {
		// 				if (!(f = tt[n]?.node) && n.startsWith('$'))
		// 					f = searchNode(doc, n, pos, SymbolKind.Variable)?.pop()?.node as FuncNode;
		// 				if (!f) return undefined;
		// 				break;
		// 			}
		// 			t.params = f.params;
		// 			t.detail = t.detail && f.detail ? t.detail + '\n___\n' + f.detail : (t.detail ?? '') + (f.detail ?? '');
		// 			let rp = f.full.lastIndexOf(')'), lp = f.full.indexOf('(', 1);
		// 			lp === -1 && f.full.startsWith('(') && lp++;
		// 			t.full = t.full.replace(/Bind\([^)]*\)/i, `Bind(${f.full.slice(lp + 1, rp)})`);
		// 			if (f.kind === SymbolKind.Method)
		// 				kind = SymbolKind.Function;
		// 		} else ts = tt;
		// 	}
		// }
	} else
		detectExpType(doc, name, pos, ts), prop = 'call';
	let st = new Set<any>();
	nodes = [];
	for (const tp in ts) {
		let t = ts[tp], n: any;
		if (t)
			add(t.node, t.uri, !/[#@]/.test(tp));
		else if (tp.includes('=>'))
			add(n = ahkvars['FUNC'] as any, n.uri, false);
		else for (let t of searchNode(doc, tp, pos, SymbolKind.Variable) ?? [])
			add(t.node as any, t.uri, !/[#@]/.test(tp));
		function add(it: FuncNode, uri: string, isstatic = false) {
			let fn: FuncNode | undefined, needthis = false;
			if (st.has(it))
				return;
			st.add(it);
			switch (it.kind) {
				case SymbolKind.Method:
					if (!iscall)
						break;
					if ((needthis = !prop && kind !== SymbolKind.Method) || !prop) {
						nodes.push({ node: it, needthis });
						break;
					} else needthis = true;
					fn = it as any;
					if (!(it = ahkvars['FUNC'] as any))
						break;
					uri = (it as any).uri, isstatic = false;
					add_cls();
					break;
				case SymbolKind.Function:
					if (!iscall)
						break;
					if (!prop || prop === 'call') {
						nodes.push({ node: it });
						break;
					}
					fn = it as any;
					if (!(it = ahkvars['FUNC'] as any))
						break;
					uri = (it as any).uri, isstatic = false;
				case SymbolKind.Class:
					add_cls();
					break;
				// case SymbolKind.Property:
				// 	if (kind === SymbolKind.Property || itemname) {
				// 		it.params && nodes.push({ node: it });
				// 	} else if ((it as any).call)
				// 		nodes.push({ node: (it as any).call });
				// 	break;
			}
			function add_cls() {
				let n: DocumentSymbol | undefined;
				let d = lexers[uri];
				if (d.d) d = doc;
				if (!iscall)
					n = get_class_member(d, it as any, prop, isstatic, false);
				else if (isstatic && prop === 'call')
					n = get_class_call(it as any);
				else {
					n = get_class_member(d, it as any, prop, isstatic, true);
					if (!n)
						return;
					if (fn) {
						if (prop === 'bind') {
							let arr: string[] = [];
							fn.detail && arr.push(fn.detail);
							n.detail && arr.push(n.detail);
							fn = Object.assign({}, fn);
							fn.detail = arr.join('\n___\n');
							fn.name = n.name;
							fn.full = '(Func) Bind' + fn.full.slice(fn.full.indexOf('(', 1));
							n = fn;
						}
					} else if (n.kind === SymbolKind.Class)
						n = get_class_call(n as any);
				}
				n && nodes.push({ node: n, needthis });
			}
		}
	}
	if (!nodes.length) {
		if (kind === SymbolKind.Method) {
			name = name.toUpperCase();
			for (const u of new Set([ahkuris.ahk2, ahkuris.ahk2_h, doc.uri, ...Object.keys(doc.relevance)]))
				for (const node of lexers[u]?.object.method[name] ?? [])
					nodes.push({ node });
			if (!nodes.length) return undefined;
		} else return undefined;
	}
	nodes.forEach((it: any) => {
		const node = it.node as FuncNode, ll = lexers[it.uri], overloads: string[] = [], needthis = it.needthis ?? 0;
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
					value: formatMarkdowndetail(node, ll, name = params[paramindex]?.name ?? '', overloads)
				} : undefined
			});
			if (overloads.length) {
				let lex = new Lexer(TextDocument.create('', 'ahk2', -10, overloads.join('\n')), undefined, -1);
				let { label, documentation } = signinfo.signatures[0], n = node;
				let fn = label.substring(0, label.indexOf(n.kind === SymbolKind.Property ? '[' : '(', 1));
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
								value: formatMarkdowndetail(n, ll, params[paramindex]?.name ?? '', [])
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