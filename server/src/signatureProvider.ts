import { CancellationToken, SignatureHelp, SignatureHelpParams, SymbolKind } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	ANY, AhkSymbol, ClassNode, FuncNode, Lexer, Maybe, Variable,
	ahkuris, format_markdown_detail, get_callinfo, get_class_constructor,
	get_class_member, lexers, decltype_expr, decltype_returns
} from './common';

export async function signatureProvider(params: SignatureHelpParams, token: CancellationToken): Promise<Maybe<SignatureHelp>> {
	if (token.isCancellationRequested) return undefined;
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri];
	let signinfo: SignatureHelp = { activeSignature: 0, signatures: [], activeParameter: 0 };
	let res = get_callinfo(doc, params.position);
	if (!res || res.index < 0)
		return undefined;
	let { name, pos, index, kind } = res;
	let context = doc.getContext(pos), iscall = true;
	let prop = context.text ? '' : context.word.toLowerCase();
	if (context.kind === SymbolKind.Null || context.token.symbol)
		return;
	if (kind === SymbolKind.Property)
		prop ||= '__item', iscall = false;
	else prop ||= 'call';
	let tps = decltype_expr(doc, context.token, context.range.end);
	let set = new Set<AhkSymbol>(), nodes: { node: AhkSymbol, uri: string, needthis?: number }[] = [];
	if (tps.includes(ANY)) {
		if (kind !== SymbolKind.Method) return;
		name = name.toUpperCase(), nodes = [];
		for (const u of new Set([ahkuris.ahk2, ahkuris.ahk2_h, doc.uri, ...Object.keys(doc.relevance)]))
			for (const node of lexers[u]?.object.method[name] ?? [])
				nodes.push({ node, uri: u });
	} else for (let it of tps)
		add(it, prop);
	function add(it: AhkSymbol, prop: string, needthis = 0) {
		let fn: FuncNode | undefined, uri = it.uri!;
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
			case SymbolKind.Class:
				add_cls();
				break;
		}
		function add_cls() {
			let n: AhkSymbol | undefined, cls = it as ClassNode;
			if (!(n = get_class_member(doc, cls, prop, iscall)))
				return;
			if (iscall) {
				if (n.kind === SymbolKind.Class)
					n = get_class_constructor(n as ClassNode);
				else if ((n as FuncNode).full?.startsWith('(Object) static Call('))
					n = get_class_member(doc, cls.prototype!, '__new', true) ?? n;
				else if (n.kind === SymbolKind.Property || (n as FuncNode).alias)
					return decltype_returns(n, lexers[n.uri!], cls).forEach(it => add(it, 'call', -1));
				else if (fn && prop === 'bind') {
					if (set.has(fn)) return; else set.add(fn);
					let b = fn.full.indexOf('(', fn.name ? 1 : 0);
					fn = {
						...fn, name: n.name, detail: undefined,
						full: `(Func) Bind${fn.full.slice(b, b + fn.param_def_len)} => BoundFunc`,
						formated_detail: (format_markdown_detail(n, null), n.formated_detail)
					};
					n = fn;
				}
			} else if (n.kind === SymbolKind.Class)
				n = get_class_member(doc, n as any, '__item', false);
			else if (n.kind !== SymbolKind.Property)
				return;
			else if (!(n as FuncNode).params) {
				for (let t of decltype_returns(n, lexers[n.uri!], cls))
					(t = get_class_member(doc, t as any, '__item', false)!) &&
						nodes.push({ node: t, needthis, uri: t.uri! });
				return;
			} 
			n && nodes.push({ node: n, needthis, uri: n.uri! });
		}
	}
	for (let it of nodes) {
		let fn = it.node as FuncNode, lex = lexers[it.uri], needthis = it.needthis ?? 0;
		if (!fn.params || set.has(fn))
			continue;
		let fns = [fn], q = fn.name && fn.full.match(/^(\(.+?\))?[^([]+/)?.[0].length || 0, pi = index - needthis;
		let parameters: { label: string | [number, number], documentation?: any }[] = [];
		let params: Variable[] | undefined, param: Variable | undefined;
		let activeParameter: number, pc: number, label: string, name: string;
		let documentation: any = (fn.detail || fn.formated_detail) && {
			kind: 'markdown',
			value: format_markdown_detail(fn, lex,
				/(^|\n)\*@param\*(.|\n|\r)*?(?=\n\*@|$)|^\*@overload\*\n```(.|\n)*?\n```/g)
		};
		if (fn.overloads) {
			if (typeof fn.overloads === 'string') {
				let lex = new Lexer(TextDocument.create('', 'ahk2', -10,
					fn.kind === SymbolKind.Function ? fn.overloads :
						`class _ {\n${fn.overloads}\n}`), undefined, -1);
				lex.parseScript(), label = fn.name || '_';
				let children = (fn.kind === SymbolKind.Function ? lex.children : lex.declaration._?.children ?? []) as FuncNode[];
				let pre = fn.full.match(/^(\(.+?\))?[^([]+/)?.[0] ?? label;
				for (let it of children) {
					if (it.name !== label || !it.params)
						continue;
					it.full = pre + it.full.replace(/^(\(.+?\))?[^([]+/, '');
					fns.push(it);
				}
				fn.overloads = fns.slice(1);
			} else fns.push(...fn.overloads);
		}
		q += needthis > 0 ? 7 : 1, set.add(fn);
		for (let f of fns) {
			label = f.full, params = f.params;
			activeParameter = f.variadic && params[(pc = params.length) - 1].arr ? Math.min(pi, pc - 1) : pi;
			name = params[activeParameter]?.name.toUpperCase() ?? (needthis && activeParameter === -1 ? 'this' : '\0');
			param = fn.params.find(p => p.name.toUpperCase() === name) ?? fn.overload_params?.[name];
			parameters = f.param_offsets.map((p, i) => ({ label: [p += q, p + (params![i].name.length || 1)] }));
			if (needthis > 0) {
				parameters.unshift({ label: 'this' }), activeParameter++;
				label = label.replace(/(?<=.)\(/, '(this' + (params.length ? ', ' : ''));
			}
			if (param?.formated_detail)
				parameters[activeParameter].documentation = {
					kind: 'markdown',
					value: format_markdown_detail(param, lex)
				};
			signinfo.signatures.push({ label, parameters, documentation, activeParameter });
		}
	}
	return signinfo;
}