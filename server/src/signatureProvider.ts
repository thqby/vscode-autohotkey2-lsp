import { CancellationToken, ParameterInformation, SignatureHelp, SignatureHelpParams } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	ANY, AhkSymbol, ClassNode, FuncNode, Lexer, Maybe, SymbolKind, Variable,
	ahkUris, decltypeExpr, decltypeInvoke, decltypeReturns, getCallInfo,
	getClassConstructor, getClassMember, getClassOwnProp, getSymbolDetail, lexers
} from './common';

let cache: {
	index?: number,
	loc?: string,
	nodes?: { node: AhkSymbol, uri: string, needthis?: number }[],
	signinfo?: SignatureHelp
} = {};

export async function signatureProvider(params: SignatureHelpParams, token: CancellationToken): Promise<Maybe<SignatureHelp>> {
	if (token.isCancellationRequested) return;
	const { textDocument: { uri }, context, position } = params;
	const lex = lexers[uri.toLowerCase()], activeSignature = context?.activeSignatureHelp?.activeSignature;
	let offset, pi;
	switch (context?.triggerKind) {
		case 2:	// TriggerCharacter
			if (!context.isRetrigger) {
				offset = lex.document.offsetAt(position);
				if (context.triggerCharacter === ' ') {
					const tk = lex.findToken(offset);
					if (tk.offset >= offset && (pi = tk.previous_token?.callsite))
						pi = pi.range.start.line === position.line && pi.paraminfo;
				} else pi = lex.tokens[offset - 1]?.paraminfo;
				if (!pi)
					return;
			} else if (context.triggerCharacter === ' ' ||
				!(pi = lex.tokens[offset = lex.document.offsetAt(position) - 1]?.paraminfo))
				return cached_sh();
			break;
	}
	const res = getCallInfo(lex, position, pi);
	if (!res || res.index < 0) {
		if (res === null)
			cache.loc = '';
		return;
	}
	const { name, pos, index, kind, count } = res;
	const loc = `${lex.uri}?${name},${pos.line},${pos.character}`;
	if (loc === cache.loc) {
		if (index === cache.index)
			return cached_sh();
		cache.index = index;
	} else cache = { loc, index };
	let nodes = cache.nodes!;
	const set = new Set<AhkSymbol>(), signinfo: SignatureHelp = { activeSignature, signatures: [] };
	if (!nodes) {
		const context = lex.getContext(pos);
		let iscall = true;
		cache.nodes = nodes = [];
		if (context.kind === SymbolKind.Null || context.token.symbol)
			return;
		const tps = decltypeExpr(lex, context.token, context.range.end);
		if (tps.includes(ANY)) {
			if (kind !== SymbolKind.Method) return;
			const uname = name.toUpperCase();
			nodes = [];
			for (const u of new Set([ahkUris.ahk2, ahkUris.ahk2_h, lex.uri, ...Object.keys(lex.relevance)]))
				for (const node of lexers[u]?.object.method[uname] ?? [])
					nodes.push({ node, uri: u });
		} else {
			let prop = context.text ? '' : context.word.toLowerCase();
			if (kind === SymbolKind.Property)
				prop ||= '__item', iscall = false;
			else prop ||= 'call';
			for (const it of tps)
				add(it, prop);
		}
		function add(it: AhkSymbol, prop: string, needthis = 0) {
			let fn: FuncNode | undefined;
			const uri = it.uri!;
			switch (it.kind) {
				case SymbolKind.Method:
					if (!iscall)
						break;
					needthis++;
					if (prop === 'call') {
						nodes.push({ node: it, needthis, uri });
						break;
					}
					fn = it as FuncNode;
					add_cls();
					break;
				case SymbolKind.Function:
					if (!iscall)
						break;
					if (prop === 'call') {
						nodes.push({ node: it, needthis, uri });
						break;
					}
					fn = it as FuncNode;
				// fall through
				default:
					add_cls();
					break;
			}
			function add_cls() {
				let n: AhkSymbol | undefined;
				const cls = it as ClassNode;
				if (!(n = getClassMember(lex, cls, prop, iscall)))
					return;
				if (iscall) {
					if (n.kind === SymbolKind.Class)
						n = getClassConstructor(n as ClassNode);
					else if ((n as FuncNode).full?.startsWith('(Object) static Call(')) {
						let proto: AhkSymbol | undefined = cls.prototype, has_new;
						if (!proto) {
							proto = getClassOwnProp(lex, cls, 'PROTOTYPE');
							if (proto?.kind === SymbolKind.Property) {
								decltypeReturns(proto, lex).forEach(it => {
									it = getClassMember(lexers[it.uri!] ?? lex, it, '__new', true)!;
									it && nodes.push({ node: has_new = it, needthis, uri: it.uri! });
								});
								if (has_new) return;
								proto = undefined;
							}
						}
						if (proto)
							n = getClassMember(lex, proto, '__new', true) ?? n;
					} else if (n.kind === SymbolKind.Property || (n as FuncNode).eval) {
						let tps: AhkSymbol[] | Set<AhkSymbol> = decltypeReturns(n, lexers[n.uri!] ?? lex, cls);
						if (n.kind === SymbolKind.Property && (n as FuncNode).eval)
							tps = decltypeInvoke(lex, tps, 'call', true);
						return tps.forEach(it => add(it, 'call', -1));
					} else if (fn && prop === 'bind') {
						if (set.has(fn)) return; else set.add(fn);
						const b = fn.full.indexOf('(', fn.name ? 1 : 0);
						fn = {
							...fn, name: n.name, detail: n.markdown_detail === undefined ? n.detail : undefined,
							full: `(Func) Bind${fn.full.slice(b, b + fn.param_def_len)} => BoundFunc`,
							markdown_detail: n.markdown_detail
						};
						n = fn;
					}
				} else if (n.kind === SymbolKind.Class)
					n = getClassMember(lex, n, '__item', false);
				else if (n.kind !== SymbolKind.Property)
					return;
				else if (!(n as FuncNode).params) {
					for (let t of decltypeReturns(n, lexers[n.uri!] ?? lex, cls))
						(t = getClassMember(lex, t, '__item', false)!) &&
							nodes.push({ node: t, needthis, uri: t.uri! });
					return;
				}
				n && nodes.push({ node: n, needthis, uri: n.uri! });
			}
		}
	}
	for (const it of nodes) {
		const fn = it.node as FuncNode, lex = lexers[it.uri], needthis = it.needthis ?? 0;
		if (!fn.params || set.has(fn))
			continue;
		const fns = [fn], pi = index - needthis;
		let parameters: ParameterInformation[] = [], q = fn.name && fn.full.match(/^(\(.+?\))?[^([]+/)?.[0].length || 0;
		let params: Variable[] | undefined, param: Variable | undefined;
		let activeParameter: number, pc: number, label: string, name: string;
		const documentation = getSymbolDetail(fn, lex,
			/(^|\n)\*@param\*(.|\n|\r)*?(?=\n\*@|$)/g);
		if (fn.overloads) {
			if (typeof fn.overloads === 'string') {
				const lex = new Lexer(TextDocument.create('', 'ahk2', -10,
					fn.kind === SymbolKind.Function ? fn.overloads :
						`class _ {\n${fn.overloads}\n}`), undefined, -1);
				lex.parseScript(), label = fn.name || '_';
				const children = (fn.kind === SymbolKind.Function ? lex.children : lex.declaration._?.children ?? []) as FuncNode[];
				const pre = fn.full.match(/^(\(.+?\))?[^([]+/)?.[0] ?? label;
				for (const it of children) {
					if (it.name !== label || !it.params)
						continue;
					it.full = pre + it.full.replace(/^(\(.+?\))?[^([]+/, '');
					fns.push(it);
				}
				fn.overloads = fns.slice(1);
			} else fns.push(...fn.overloads);
		}
		q += needthis > 0 ? 7 : 1, set.add(fn);
		for (const f of fns) {
			label = f.full, params = f.params, pc = params.length;
			activeParameter = f.variadic && params[pc - 1].arr ? Math.min(pi, pc - 1) : pi;
			name = params[activeParameter]?.name.toUpperCase() ?? (needthis && activeParameter === -1 ? 'this' : '\0');
			param = fn.params.find(p => p.name.toUpperCase() === name) ?? fn.overload_params?.[name];
			parameters = f.param_offsets.map((p, i) => ({ label: [p += q, p + (params![i]?.name.length || 1)] }));
			if (needthis > 0) {
				parameters.unshift({ label: 'this' }), activeParameter++;
				label = label.replace(/(?<=.)\(/, '(this' + (params.length ? ', ' : ''));
			}
			if (param) {
				if (param.arr === 2) {
					const fi = pi % 2 !== param.data, fc = pc % 2 !== param.data, n = fc ? 2 : 1;
					if ((!fi || ++activeParameter && fc) && index >= count - n)
						if (index === count - 1 || activeParameter - n !== pc - 2)
							activeParameter -= n;
					param = params[activeParameter] ?? param;
				} else if (index < count - 1 && params.at(-1)?.arr === 2) {
					const p = params.at(-1)!, fc = pc % 2 !== p.data, n = fc ? 2 : 1;
					if (index < count - n && !params[activeParameter + n]?.name.length)
						param = params[activeParameter += n] ?? p;
				}
				parameters[activeParameter].documentation = getSymbolDetail(param, lex);
			}
			signinfo.signatures.push({ label, parameters, documentation, activeParameter });
		}
	}
	return cache.signinfo = signinfo;
	function cached_sh() {
		const sh = cache.signinfo;
		sh && (sh.activeSignature = activeSignature);
		return sh;
	}
}