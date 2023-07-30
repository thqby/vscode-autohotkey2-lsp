import { URI } from 'vscode-uri';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CancellationToken, DiagnosticSeverity, DocumentSymbol, DocumentSymbolParams, Range, SymbolInformation, SymbolKind, WorkspaceSymbolParams } from 'vscode-languageserver';
import { checksamenameerr, ClassNode, CallInfo, FuncNode, FuncScope, Lexer, SemanticToken, SemanticTokenModifiers, SemanticTokenTypes, Token, Variable, samenameerr, get_class_call } from './Lexer';
import { ahkuris, ahkvars, connection, extsettings, getallahkfiles, inBrowser, is_line_continue, lexers, openFile, sendDiagnostics, symbolcache, workspaceFolders } from './common';
import { diagnostic } from './localize';

export let globalsymbolcache: { [name: string]: DocumentSymbol } = {};

export function symbolProvider(params: DocumentSymbolParams, token?: CancellationToken): SymbolInformation[] {
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri];
	if (!doc || token?.isCancellationRequested || (!doc.reflat && symbolcache[uri])) return symbolcache[uri];
	let gvar: { [name: string]: Variable } = { ...ahkvars }, winapis: any = {};
	let list = [uri, ...Object.keys(doc.relevance ?? {})];
	list = list.map(u => lexers[u]?.d_uri).concat(list);
	for (const uri of list) {
		let lex = lexers[uri];
		if (!lex) continue;
		let d = lex.d, dec = lex.declaration, t;
		for (let k in dec) {
			if (!(t = gvar[k]) || d || dec[k].kind !== SymbolKind.Variable && (t.kind === SymbolKind.Variable || t.def === false))
				gvar[k] = dec[k];
			else if (t.kind === SymbolKind.Variable && (t.assigned ||= (dec[k] as Variable).assigned, (dec[k] as Variable).def))
				t.def ??= false;
		}
	}
	if (ahkuris.winapi && !list.includes(ahkuris.winapi))
		winapis = lexers[ahkuris.winapi]?.declaration ?? winapis;
	doc.reflat = false, globalsymbolcache = gvar;
	let rawuri = doc.document.uri;
	const result: DocumentSymbol[] = [], unset_vars = new Map<Variable, Variable>();
	const filter_types: SymbolKind[] = [SymbolKind.Method, SymbolKind.Property, SymbolKind.Class, SymbolKind.TypeParameter];
	function maybe_unset(k: Variable, v: Variable) {
		if (!(k.assigned ||= v.assigned) && v.returntypes === undefined)
			unset_vars.has(k) || unset_vars.set(k, v);
	}
	for (let [k, v] of Object.entries(doc.declaration)) {
		let t = gvar[k];
		if (t.kind === SymbolKind.Variable && !t.assigned)
			if (winapis[k])
				t = gvar[k] = winapis[k];
			else if (v.returntypes === undefined)
				unset_vars.set(t, v);
		if (t === v || v.kind !== SymbolKind.Variable)
			result.push(v), converttype(v, false, v.kind);
	}
	flatTree(doc);
	if (extsettings.Diagnostics.VarUnset)
		for (let [k, v] of unset_vars)
			k.assigned || doc.diagnostics.push({ message: diagnostic.varisunset(v.name), range: v.selectionRange, severity: 2 });
	if (doc.actived)
		checksamename(doc), setTimeout(sendDiagnostics, 200);
	return symbolcache[uri] = result.map(info => SymbolInformation.create(info.name, info.kind, info.children ? info.range : info.selectionRange, rawuri));

	function flatTree(node: { children?: DocumentSymbol[], funccall?: CallInfo[] }, vars: { [key: string]: Variable } = {}, outer_is_global = false) {
		const t: DocumentSymbol[] = [];
		let tk: Token, iscls = (node as DocumentSymbol).kind === SymbolKind.Class;
		node.children?.forEach((info: Variable) => {
			if (info.children)
				t.push(info);
			if (!info.name)
				return;
			let kind = info.kind;
			if (kind === SymbolKind.Variable || kind === SymbolKind.Function || !iscls && kind === SymbolKind.Class) {
				let name = info.name.toUpperCase(), sym = vars[name] ?? gvar[name];
				if (sym === info || !sym)
					return;
				(tk = converttype(info, sym === ahkvars[name], sym.kind)).definition = sym;
				if (!sym.selectionRange.end.character)
					delete tk.semantic;
				else if (info.kind !== SymbolKind.Variable)
					result.push(info);
				else if (sym.kind === SymbolKind.Variable)
					maybe_unset(sym, info);
			} else if (!filter_types.includes(kind))
				result.push(info);
		});
		node.funccall?.forEach(info => {
			if (info.kind !== SymbolKind.Function)
				return;
			let name = info.name.toUpperCase();
			checkParams(doc, (vars[name] ?? gvar[name]) as FuncNode, info);
		});
		t.forEach(info => {
			let inherit: { [key: string]: DocumentSymbol } = {}, fn = info as FuncNode, s: Variable;
			switch (info.kind) {
				case SymbolKind.Class:
					let rg = Range.create(0, 0, 0, 0), cls = info as ClassNode;
					inherit = {
						THIS: DocumentSymbol.create('this', undefined, SymbolKind.TypeParameter, rg, rg),
						SUPER: !cls.extends ? false as any :
							DocumentSymbol.create('super', undefined, SymbolKind.TypeParameter, rg, rg)
					}, outer_is_global = false;
					for (let dec of [cls.staticdeclaration, cls.declaration])
						Object.values(dec).forEach(it => it.selectionRange.end.character && result.push(it));
					break;
				case SymbolKind.Method:
					inherit = { THIS: vars.THIS, SUPER: vars.SUPER ?? false }, outer_is_global ||= fn.assume === FuncScope.GLOBAL;
				case SymbolKind.Event:
				case SymbolKind.Function:
					if (!fn.parent)
						outer_is_global ||= fn.assume === FuncScope.GLOBAL;
					else if (fn.kind !== SymbolKind.Method)
						if (fn.assume !== FuncScope.GLOBAL) {
							if (fn.assume === FuncScope.STATIC)
								outer_is_global = false;
							if (fn.static) {
								for (let [k, v] of Object.entries(vars))
									if ((v as Variable).static || v === gvar[k])
										inherit[k] = v;
							} else inherit = { ...vars };
						} else outer_is_global = true;
					for (let [k, v] of Object.entries(fn.global ?? {}))
						s = inherit[k] = gvar[k] ??= v, converttype(v, !!ahkvars[k], s.kind).definition = s,
							s.kind === SymbolKind.Variable && maybe_unset(s, v);
					for (let [k, v] of Object.entries(fn.local ?? {})) {
						converttype(inherit[k] = v, false, v.kind).definition = v;
						if (v.kind !== SymbolKind.TypeParameter) {
							result.push(v);
							if (v.kind === SymbolKind.Variable && !v.assigned && v.returntypes === undefined)
								unset_vars.set(v, v);
						}
					}
					for (let [k, v] of Object.entries(fn.declaration ??= {}))
						if (s = inherit[k])
							s !== v && (converttype(v, s === ahkvars[k], s.kind).definition = s,
								s.kind === SymbolKind.Variable && maybe_unset(s, v as Variable));
						else if (outer_is_global)
							s = gvar[k] ??= (result.push(v), (v as any).infunc = true, doc.declaration[k] = v),
								converttype(v, !!ahkvars[k], s.kind).definition = s,
								s.kind === SymbolKind.Variable && maybe_unset(s, v as Variable);
						else if (!(v as Variable).def && (s = gvar[k]))
							converttype(v, !!ahkvars[k], s.kind).definition = s;
						else converttype(inherit[k] = fn.local[k] = v).definition = v, result.push(v);
					for (let [k, v] of Object.entries(fn.unresolved_vars ??= {}))
						if (s = inherit[k] ?? gvar[k] ?? winapis[k])
							converttype(v, s === ahkvars[k], s.kind).definition = s;
						else {
							converttype(v, false, v.kind).definition = v;
							result.push(inherit[k] = v);
							if (fn.assume === FuncScope.STATIC)
								v.static = true;
							if (v.returntypes === undefined)
								unset_vars.set(v, v);
						}
					break;
				case SymbolKind.Property:
					if ((info as FuncNode).parent?.kind === SymbolKind.Class) {
						inherit = { THIS: vars.THIS, SUPER: vars.SUPER ?? false };
						let t = info as any;
						for (let s of ['get', 'set', 'call'])
							(t[s] as DocumentSymbol)?.selectionRange.end.character && result.push(t[s]),
								inherit[s.toUpperCase()] = false as any;
						break;
					}
				default: inherit = { ...vars }; break;
			}
			flatTree(info, inherit, outer_is_global);
		});
	}
	function checksamename(doc: Lexer) {
		if (doc.d)
			return;
		let dec: any = { ...ahkvars }, dd: Lexer, lbs: any = {};
		Object.keys(doc.labels).forEach(lb => lbs[lb] = true);
		for (const uri in doc.relevance) {
			if (dd = lexers[uri]) {
				dd.diagnostics.splice(dd.diags);
				checksamenameerr(dec, Object.values(dd.declaration).filter(it => it.kind !== SymbolKind.Variable), dd.diagnostics);
				for (const lb in dd.labels)
					if ((<any>dd.labels[lb][0]).def)
						if (lbs[lb])
							dd.diagnostics.push({ message: diagnostic.duplabel(), range: dd.labels[lb][0].selectionRange, severity: 1 });
						else lbs[lb] = true;
			}
		}
		let t = Object.values(doc.declaration);
		checksamenameerr(dec, t, doc.diagnostics);
		for (const uri in doc.relevance) {
			if (dd = lexers[uri])
				checksamenameerr(dec, Object.values(dd.declaration).filter(it => it.kind === SymbolKind.Variable), dd.diagnostics);
		}
		let cls: ClassNode;
		t.forEach(it => {
			if (it.kind === SymbolKind.Class && (cls = it as ClassNode).extendsuri === undefined) {
				let l = cls.extends?.toUpperCase();
				if (l === it.name.toUpperCase())
					err_extends(doc, cls, false);
				else if (l && !checkextendsclassexist(l))
					err_extends(doc, cls);
			}
		});
		for (const uri in doc.relevance) {
			if (dd = lexers[uri])
				for (const it of Object.values(dd.declaration))
					if (it.kind === SymbolKind.Class && (cls = it as ClassNode).extendsuri === undefined) {
						let l = cls.extends?.toUpperCase();
						if (l === it.name.toUpperCase())
							err_extends(dd, cls, false);
						else if (l && !checkextendsclassexist(l))
							err_extends(dd, cls);
					}
		}
		function checkextendsclassexist(name: string) {
			let n = name.split('.'), c: ClassNode | undefined;
			for (let t of n) {
				c = c?.staticdeclaration[t] ?? dec[t];
				if (c?.kind !== SymbolKind.Class || (<any>c).def === false)
					return false;
			}
			return true;
		}
		function err_extends(doc: Lexer, it: ClassNode, not_exist = true) {
			let o = doc.document.offsetAt(it.selectionRange.start), tks = doc.tokens, tk: Token;
			if (!(tk = tks[tks[o].next_token_offset]) || !(tk = tks[tk.next_token_offset]))
				return;
			o = tk.offset;
			let rg: Range = { start: doc.document.positionAt(o), end: doc.document.positionAt(o + it.extends.length) };
			doc.diagnostics.push({ message: not_exist ? diagnostic.unknown("class '" + it.extends) + "'" : diagnostic.unexpected(it.extends), range: rg, severity: DiagnosticSeverity.Warning });
		}
	}
	function converttype(it: DocumentSymbol, islib: boolean = false, kind?: number): Token {
		let tk: Token, stk: SemanticToken | undefined, st: SemanticTokenTypes | undefined, offset: number;
		switch (kind ?? it.kind) {
			case SymbolKind.TypeParameter:
				if (it.range.start.line === 0 && it.range.start.character === 0)
					return {} as Token;
				st = SemanticTokenTypes.parameter; break;
			case SymbolKind.Variable:
				st = SemanticTokenTypes.variable; break;
			case SymbolKind.Class:
				st = SemanticTokenTypes.class; break;
			case SymbolKind.Function:
				st = SemanticTokenTypes.function; break;
		}
		if ((tk = doc.tokens[offset = doc.document.offsetAt(it.selectionRange.start)]) && st !== undefined) {
			if ((stk = tk.semantic) === undefined) {
				tk.semantic = stk = { type: st };
				if (it.kind === SymbolKind.Variable && (<Variable>it).def && (kind === SymbolKind.Class || kind === SymbolKind.Function))
					doc.addDiagnostic(samenameerr(it, { kind } as DocumentSymbol), offset, it.name.length), delete (<Variable>it).def;
				if (!tk.callinfo && st === SemanticTokenTypes.function) {
					let nk = doc.tokens[tk.next_token_offset];
					if (nk && nk.topofline < 1 && !':?.+-*/=%<>,)]}'.includes(nk.content.charAt(0)))
						doc.addDiagnostic(diagnostic.funccallerr2(), tk.offset, tk.length, 2);
				}
			} else if (kind !== undefined)
				stk.type = st;
			if (st < 3)
				stk.modifier = (stk.modifier || 0) | (1 << SemanticTokenModifiers.readonly) | (islib ? 1 << SemanticTokenModifiers.defaultLibrary : 0);
		}
		return tk ?? {};
	}
}

export function checkParams(doc: Lexer, node: FuncNode, info: CallInfo) {
	let paraminfo = info.paraminfo!, is_cls: boolean;
	if (!paraminfo || !extsettings.Diagnostics.ParamsCheck) return;
	if (is_cls = node?.kind === SymbolKind.Class)
		node = get_class_call(node as any) as any;
	if (!node) return;
	if (node.kind === SymbolKind.Function || node.kind === SymbolKind.Method) {
		let paramcount = node.params.length, pc = paraminfo.count, miss: { [index: number]: boolean } = {};
		if (node.variadic) {
			if (paramcount > 0 && node.params[paramcount - 1].arr)
				paramcount--;
			while (paramcount > 0 && node.params[paramcount - 1].defaultVal !== undefined) --paramcount;
			for (let i = 0; i < paramcount; ++i)
				if (node.params[i].defaultVal === false)
					--paramcount;
			if (pc < paramcount && !paraminfo.unknown)
				doc.diagnostics.push({ message: diagnostic.paramcounterr(paramcount + '+', pc), range: info.range, severity: 1 });
			paraminfo.miss.forEach(index => {
				miss[index] = true;
				if (index < paramcount && node.params[index].defaultVal === undefined)
					doc.addDiagnostic(diagnostic.missingparam(), paraminfo.comma[index] ?? doc.document.offsetAt(info.range.end), 1);
			});
		} else {
			let maxcount = paramcount, l = paraminfo.miss.length, t = 0;
			while (paramcount > 0 && node.params[paramcount - 1].defaultVal !== undefined) --paramcount;
			for (let i = 0; i < paramcount; ++i)
				if (node.params[i].defaultVal === false)
					--paramcount;
			while (l > 0) {
				if ((t = paraminfo.miss[l - 1]) >= maxcount) {
					if (t + 1 === pc) --pc;
				} else if (node.params[t].defaultVal === undefined)
					doc.addDiagnostic(diagnostic.missingparam(), paraminfo.comma[t] ?? doc.document.offsetAt(info.range.end), 1);
				miss[t] = true, --l;
			}
			if ((pc < paramcount && !paraminfo.unknown) || pc > maxcount)
				doc.diagnostics.push({ message: diagnostic.paramcounterr(paramcount === maxcount ? maxcount : paramcount + '-' + maxcount, pc), range: info.range, severity: 1 });
		}
		if (node.hasref) {
			node.params.forEach((param, index) => {
				if (index < pc && param.ref && !miss[index]) {
					let o: number, t: Token;
					if (index === 0)
						o = info.offset as number + info.name.length + 1;
					else o = paraminfo.comma[index - 1] + 1;
					if ((t = doc.find_token(o)).content !== '&' && (t.content.toLowerCase() !== 'unset' || param.defaultVal === undefined))
						if (doc.tokens[t.next_token_offset]?.type !== 'TK_DOT')
							doc.addDiagnostic(diagnostic.typemaybenot('VarRef'), t.offset, t.length, 2);
				}
			});
		}
		if (!node.returntypes && !(is_cls && node.name.toLowerCase() === '__new')) {
			let tk = doc.tokens[info.offset as number];
			if (tk?.previous_token?.type === 'TK_EQUALS') {
				let nt = doc.get_token(doc.document.offsetAt(info.range.end), true);
				if (!nt || !is_line_continue(nt.previous_token as Token, nt) || nt.content !== '??')
					doc.addDiagnostic(diagnostic.missingretval(), tk.offset, tk.length, 2);
			}
		}
	}
}

export async function workspaceSymbolProvider(params: WorkspaceSymbolParams, token: CancellationToken): Promise<SymbolInformation[]> {
	let symbols: SymbolInformation[] = [], n = 0, query = params.query;
	if (token.isCancellationRequested || !query || !query.match(/^(\w|[^\x00-\x7f])+$/))
		return symbols;
	let reg = new RegExp(query.match(/[^\w]/) ? query.replace(/(.)/g, '$1.*') : '(' + query.replace(/(.)/g, '$1.*') + '|[^\\w])', 'i');
	for (let uri in lexers)
		if (await filterSymbols(uri)) return symbols;
	if (!inBrowser) {
		let uri: string, d: Lexer, t: TextDocument | undefined;
		for (let dir of workspaceFolders) {
			dir = URI.parse(dir).fsPath;
			for (let path of getallahkfiles(dir)) {
				uri = URI.file(path).toString().toLowerCase();
				if (!lexers[uri] && (t = openFile(path))) {
					d = new Lexer(t);
					d.parseScript(), lexers[uri] = d;
					if (await filterSymbols(uri)) return symbols;
				}
			}
		}
	} else {
		let uris = (await connection.sendRequest('ahk2.getWorkspaceFiles', []) || []) as string[];
		for (let uri_ of uris) {
			let uri = uri_.toLowerCase(), d: Lexer;
			if (!lexers[uri]) {
				let content = (await connection.sendRequest('ahk2.getWorkspaceFileContent', [uri_])) as string;
				d = new Lexer(TextDocument.create(uri_, 'ahk2', -10, content));
				d.parseScript(), lexers[uri] = d;
				if (await filterSymbols(uri)) return symbols;
			}
		}
	}
	return symbols;
	async function filterSymbols(uri: string) {
		for (let it of symbolProvider({ textDocument: { uri } })) {
			if (reg.test(it.name)) {
				symbols.push(it);
				if (++n >= 1000)
					return true;
			}
		}
		return false;
	}
}