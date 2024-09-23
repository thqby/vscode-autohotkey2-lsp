import { CancellationToken, ParameterInformation, SignatureHelp, SignatureHelpParams, SymbolKind } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	ANY, AhkSymbol, ClassNode, FuncNode, Lexer, Maybe, Variable,
	ahkuris, decltype_expr, decltype_invoke, decltype_returns, get_detail,
	get_callinfo, get_class_constructor, get_class_member, lexers
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
					const tk = lex.find_token(offset);
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
	const res = get_callinfo(lex, position, pi);
	if (!res || res.index < 0)
		return;
	const { name, pos, index, kind } = res;
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
		const tps = decltype_expr(lex, context.token, context.range.end);
		if (tps.includes(ANY)) {
			if (kind !== SymbolKind.Method) return;
			const uname = name.toUpperCase();
			nodes = [];
			for (const u of new Set([ahkuris.ahk2, ahkuris.ahk2_h, lex.uri, ...Object.keys(lex.relevance)]))
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
				if (!(n = get_class_member(lex, cls, prop, iscall)))
					return;
				if (iscall) {
					if (n.kind === SymbolKind.Class)
						n = get_class_constructor(n as ClassNode);
					else if ((n as FuncNode).full?.startsWith('(Object) static Call('))
						n = get_class_member(lex, cls.prototype!, '__new', true) ?? n;
					else if (n.kind === SymbolKind.Property || (n as FuncNode).alias) {
						let tps: AhkSymbol[] | Set<AhkSymbol> = decltype_returns(n, lexers[n.uri!] ?? lex, cls);
						if (n.kind === SymbolKind.Property && (n as FuncNode).alias)
							tps = decltype_invoke(lex, tps, 'call', true);
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
					n = get_class_member(lex, n, '__item', false);
				else if (n.kind !== SymbolKind.Property)
					return;
				else if (!(n as FuncNode).params) {
					for (let t of decltype_returns(n, lexers[n.uri!] ?? lex, cls))
						(t = get_class_member(lex, t, '__item', false)!) &&
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
		const documentation = get_detail(fn, lex,
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
			label = f.full, params = f.params;
			activeParameter = f.variadic && params[(pc = params.length) - 1].arr ? Math.min(pi, pc - 1) : pi;
			name = params[activeParameter]?.name.toUpperCase() ?? (needthis && activeParameter === -1 ? 'this' : '\0');
			param = fn.params.find(p => p.name.toUpperCase() === name) ?? fn.overload_params?.[name];
			parameters = f.param_offsets.map((p, i) => ({ label: [p += q, p + (params![i].name.length || 1)] }));
			if (needthis > 0) {
				parameters.unshift({ label: 'this' }), activeParameter++;
				label = label.replace(/(?<=.)\(/, '(this' + (params.length ? ', ' : ''));
			}
			const detail = param && get_detail(param, lex);
			if (detail)
				parameters[activeParameter].documentation = detail;
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