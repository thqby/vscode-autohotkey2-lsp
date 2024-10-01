import {
	CancellationToken, DiagnosticSeverity, DocumentSymbolParams,
	Range, SymbolInformation, SymbolKind, WorkspaceSymbolParams
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import {
	ANY, AhkSymbol, CallSite, ClassNode, FuncNode, FuncScope, Lexer, Property, SUPER, SemanticToken,
	SemanticTokenModifiers, SemanticTokenTypes, THIS, Token, VARREF, Variable,
	ahkuris, ahkvars, check_same_name_error, connection, decltype_expr,
	diagnostic, enum_ahkfiles, ahkppConfig, find_class, get_class_constructor,
	is_line_continue, lexers, make_same_name_error, openFile, warn, workspaceFolders
} from './common';
import { CfgKey, getCfg } from './config';

export let globalsymbolcache: Record<string, AhkSymbol> = {};

export function symbolProvider(params: DocumentSymbolParams, token?: CancellationToken | null): SymbolInformation[] {
	let uri = params.textDocument.uri.toLowerCase();
	const doc = lexers[uri];
	if (!doc || token?.isCancellationRequested)
		return [];
	if (token !== null && doc.symbolInformation)
		return doc.symbolInformation;
	const gvar: Record<string, Variable> = globalsymbolcache = { ...ahkvars };
	let list = [uri, ...Object.keys(doc.relevance)], winapis: Record<string, AhkSymbol> = {};
	list = list.map(u => lexers[u]?.d_uri).concat(list);
	for (const uri of list) {
		const lex = lexers[uri];
		if (!lex) continue;
		const d = lex.d, dec = lex.declaration;
		let t;
		for (const k in dec) {
			if (!(t = gvar[k]) || d || dec[k].kind !== SymbolKind.Variable && (t.kind === SymbolKind.Variable || t.def === false))
				gvar[k] = dec[k];
			else if (t.kind === SymbolKind.Variable && (t.assigned ||= (dec[k] as Variable).assigned, dec[k].def))
				t.def ??= false;
		}
	}
	if (doc.symbolInformation)
		return doc.symbolInformation;
	if (ahkuris.winapi && !list.includes(ahkuris.winapi))
		winapis = lexers[ahkuris.winapi]?.declaration ?? winapis;
	const warnLocalSameAsGlobal = getCfg(ahkppConfig, CfgKey.LocalSameAsGlobal);
	const result: AhkSymbol[] = [], unset_vars = new Map<Variable, Variable>();
	const filter_types: SymbolKind[] = [SymbolKind.Method, SymbolKind.Property, SymbolKind.Class];
	for (const [k, v] of Object.entries(doc.declaration)) {
		let t = gvar[k], islib = false;
		if (t.kind === SymbolKind.Variable && !t.assigned)
			if (winapis[k])
				t = gvar[k] = winapis[k], islib = true;
			else if (v.returns === undefined)
				unset_vars.set(t, v);
		if (t === v || v.kind !== SymbolKind.Variable)
			result.push(v), converttype(v, v, islib || v === ahkvars[k]).definition = v;
	}
	flatTree(doc);
	if (getCfg(ahkppConfig, CfgKey.VarUnset))
		for (const [k, v] of unset_vars) {
			if (k.assigned)
				continue;
			doc.diagnostics.push({ message: warn.varisunset(v.name), range: v.selectionRange, severity: DiagnosticSeverity.Warning });
		}
	if (doc.actived) {
		checksamename(doc);
		doc.sendDiagnostics(false, true);
	}
	uri = doc.document.uri;
	return doc.symbolInformation = result.map(info => SymbolInformation.create(info.name, info.kind, info.range, uri));

	function maybe_unset(k: Variable, v: Variable) {
		if (!(k.assigned ||= v.assigned) && v.returns === undefined)
			unset_vars.has(k) || unset_vars.set(k, v);
	}
	function flatTree(node: { children?: AhkSymbol[] }, vars: Record<string, Variable> = {}, outer_is_global = false) {
		const t: AhkSymbol[] = [], iscls = (node as AhkSymbol).kind === SymbolKind.Class;
		let tk: Token;
		node.children?.forEach((info: Variable) => {
			if (info.children)
				t.push(info);
			if (!info.name)
				return;
			const kind = info.kind;
			if (kind === SymbolKind.Variable || kind === SymbolKind.Function || !iscls && kind === SymbolKind.Class) {
				const name = info.name.toUpperCase(), sym = vars[name] ?? gvar[name];
				if (sym === info || !sym)
					return;
				(tk = converttype(info, sym, sym === ahkvars[name])).definition = sym;
				if (!sym.selectionRange.end.character)
					delete tk.semantic;
				else if (info.kind !== SymbolKind.Variable)
					result.push(info);
				else if (sym.kind === SymbolKind.Variable)
					maybe_unset(sym, info);
				else if (tk.callsite)
					checkParams(doc, sym as FuncNode, tk.callsite);
			} else if (!filter_types.includes(kind))
				result.push(info);
		});
		for (const info of t) {
			let inherit: Record<string, AhkSymbol> = {}, s: Variable;
			const oig = outer_is_global, fn = info as FuncNode;
			switch (info.kind) {
				case SymbolKind.Class: {
					const cls = info as ClassNode;
					inherit = { THIS, SUPER }, outer_is_global = false;
					for (const dec of [cls.property, cls.prototype?.property ?? {}])
						Object.values(dec).forEach(it => it.selectionRange.end.character && result.push(it));
					break;
				}
				case SymbolKind.Property:
					if (fn.has_this_param) {
						const prop = info as Property;
						for (const s of [prop.get, prop.set, prop.call]) {
							if (!s) continue;
							t.push(s), s.selectionRange.end.character && result.push(s);
						}
					} else break;
				// fall through
				case SymbolKind.Method:
				case SymbolKind.Function:
					if (fn.has_this_param)
						inherit = { THIS, SUPER };
					else {
						if (vars.SUPER?.range.end.character === 0)
							delete vars.SUPER;
						if (fn.assume !== FuncScope.GLOBAL) {
							if (fn.assume === FuncScope.STATIC)
								outer_is_global = false;
							if (fn.static) {
								for (const [k, v] of Object.entries(vars))
									if (v.static || v === gvar[k])
										inherit[k] = v;
							} else inherit = { ...vars };
						} else outer_is_global = true;
					}
				// fall through
				case SymbolKind.Event:
					outer_is_global ||= fn.assume === FuncScope.GLOBAL;
					for (const [k, v] of Object.entries(fn.global ?? {}))
						s = inherit[k] = gvar[k] ??= v, converttype(v, s, s === ahkvars[k]).definition = s,
							s.kind === SymbolKind.Variable && maybe_unset(s, v);
					for (const [k, v] of Object.entries(fn.local ?? {})) {
						converttype(inherit[k] = v, v).definition = v;
						if (v.kind === SymbolKind.Variable) {
							if (v.is_param) continue;
							if (!v.assigned && v.returns === undefined)
								unset_vars.set(v, v);
							else if (warnLocalSameAsGlobal && !v.decl && gvar[k])
								doc.diagnostics.push({ message: warn.localsameasglobal(v.name), range: v.selectionRange, severity: DiagnosticSeverity.Warning });
						}
						result.push(v);
					}
					for (const [k, v] of Object.entries(fn.declaration ??= {}))
						if ((s = inherit[k]))
							s !== v && (converttype(v, s, s === ahkvars[k]).definition = s,
								s.kind === SymbolKind.Variable && maybe_unset(s, v as Variable));
						else if (outer_is_global)
							s = gvar[k] ??= (result.push(v), (v as Variable).is_global = true, doc.declaration[k] = v),
								converttype(v, s, s === ahkvars[k]).definition = s,
								s.kind === SymbolKind.Variable && maybe_unset(s, v as Variable);
						else if (!v.def && (s = gvar[k]))
							converttype(v, s, s === ahkvars[k]).definition = s;
						else {
							converttype(inherit[k] = fn.local[k] = v, v).definition = v, result.push(v);
							v.static === null && (v.static = true);
							if (warnLocalSameAsGlobal && v.kind === SymbolKind.Variable && gvar[k])
								doc.diagnostics.push({ message: warn.localsameasglobal(v.name), range: v.selectionRange, severity: DiagnosticSeverity.Warning });
						}
					for (const [k, v] of Object.entries(fn.unresolved_vars ?? {}))
						if ((s = inherit[k] ?? gvar[k] ?? winapis[k]))
							converttype(v, s, s === ahkvars[k]).definition = s;
						else {
							converttype(v, v).definition = v;
							result.push(inherit[k] = v);
							if (fn.assume === FuncScope.STATIC)
								v.static = true;
							if (v.returns === undefined)
								unset_vars.set(v, v);
						}
					break;
				default: inherit = { ...vars }; break;
			}
			flatTree(info, inherit, outer_is_global);
			outer_is_global = oig;
		}
	}
	function checksamename(doc: Lexer) {
		if (doc.d)
			return;
		const dec = { ...ahkvars }, lbs: Record<string, boolean> = {};
		let dd: Lexer, sym: AhkSymbol;
		Object.keys(doc.labels).forEach(lb => lbs[lb] = true);
		for (const uri in doc.relevance) {
			if ((dd = lexers[uri])) {
				if (dd.d) continue;
				check_same_name_error(dec, Object.values(dd.declaration).filter(it => it.kind !== SymbolKind.Variable), dd.diagnostics);
				for (const lb in dd.labels)
					if ((sym = dd.labels[lb][0]).def)
						if (lbs[lb]) {
							sym.has_warned ??=
								dd.diagnostics.push({ message: diagnostic.duplabel(), range: sym.selectionRange, severity: DiagnosticSeverity.Error });
						} else lbs[lb] = true;
			}
		}
		const t = Object.values(doc.declaration);
		check_same_name_error(dec, t, doc.diagnostics);
		for (const uri in doc.relevance) {
			if ((dd = lexers[uri]))
				check_same_name_error(dec, Object.values(dd.declaration).filter(it => it.kind === SymbolKind.Variable), dd.diagnostics);
		}
		let cls: ClassNode;
		t.forEach(it => {
			if (it.kind === SymbolKind.Class && (cls = it as ClassNode).extendsuri === undefined) {
				const l = cls.extends?.toUpperCase();
				if (l === it.name.toUpperCase())
					err_extends(doc, cls, false);
				else if (l && !find_class(doc, l)?.prototype)
					err_extends(doc, cls);
			}
		});
		for (const uri in doc.relevance) {
			if ((dd = lexers[uri]))
				for (const it of Object.values(dd.declaration))
					if (it.kind === SymbolKind.Class && (cls = it as ClassNode).extendsuri === undefined) {
						const l = cls.extends?.toUpperCase();
						if (l === it.name.toUpperCase())
							err_extends(dd, cls, false);
						else if (l && !find_class(dd, l)?.prototype)
							err_extends(dd, cls);
					}
		}
		function err_extends(doc: Lexer, it: ClassNode, not_exist = true) {
			let o = doc.document.offsetAt(it.selectionRange.start), tk: Token;
			const tks = doc.tokens;
			if (!(tk = tks[tks[o].next_token_offset]) || !(tk = tks[tk.next_token_offset]) || tk.has_warned)
				return;
			o = tk.offset, tk.has_warned = true;
			const rg: Range = { start: doc.document.positionAt(o), end: doc.document.positionAt(o + it.extends.length) };
			doc.diagnostics.push({ message: not_exist ? diagnostic.unknown("class '" + it.extends) + "'" : diagnostic.unexpected(it.extends), range: rg, severity: DiagnosticSeverity.Warning });
		}
	}
	function converttype(it: AhkSymbol, source: Variable, islib = false): Token {
		let tk: Token, stk: SemanticToken | undefined, st: SemanticTokenTypes | undefined, offset: number;
		const kind = source.kind;
		switch (kind) {
			case SymbolKind.Variable:
				if (source.is_param) {
					if (!it.selectionRange.end.character)
						return {} as Token;
					st = SemanticTokenTypes.parameter; break;
				}
				st = SemanticTokenTypes.variable; break;
			case SymbolKind.Class:
				st = SemanticTokenTypes.class; break;
			case SymbolKind.Function:
				st = SemanticTokenTypes.function; break;
		}
		if ((tk = doc.tokens[offset = doc.document.offsetAt(it.selectionRange.start)]) && st !== undefined && !tk.ignore) {
			if ((stk = tk.semantic) === undefined) {
				tk.semantic = stk = { type: st };
				if (it.kind === SymbolKind.Variable && it.def && (kind === SymbolKind.Class || kind === SymbolKind.Function))
					doc.addDiagnostic(make_same_name_error(it, { kind } as AhkSymbol), offset, it.name.length), delete it.def;
				if (!tk.callsite && st === SemanticTokenTypes.function) {
					const nk = doc.tokens[tk.next_token_offset];
					if (nk && nk.topofline < 1 && !(nk.op_type! >= 0 || ':?.+-*/=%<>,)]}'.includes(nk.content.charAt(0)) || !nk.data && nk.content === '{'))
						doc.addDiagnostic(diagnostic.funccallerr2(), tk.offset, tk.length, 2);
				}
			} else if (kind !== undefined)
				stk.type = st;
			if (st < 3)
				stk.modifier = (stk.modifier ?? 0) | (SemanticTokenModifiers.readonly) | (islib ? SemanticTokenModifiers.defaultLibrary : 0);
		}
		return tk ?? {} as Token;
	}
}

function get_func_param_count(fn: FuncNode) {
	const params = fn.params;
	let min = params.length, max = min;
	if (fn.variadic) {
		max = Infinity;
		if (min > 0 && params[min - 1].arr)
			min--;
	}
	while (min > 0 && params[min - 1].defaultVal !== undefined)
		--min;
	for (let i = 0; i < min; ++i)
		if (params[i].defaultVal === false)
			--min;
	return { min, max, has_this_param: fn.has_this_param };
}

export function checkParams(doc: Lexer, node: FuncNode, info: CallSite) {
	const paraminfo = info.paraminfo;
	let is_cls: boolean, params;
	if (!paraminfo || !getCfg(ahkppConfig, CfgKey.ParamsCheck)) return;
	if ((is_cls = node?.kind === SymbolKind.Class))
		node = get_class_constructor(node as unknown as ClassNode) as FuncNode;
	if (!(params = node?.params)) return;

	const { max, min } = get_func_param_count(node), l = params.length - (node.variadic ? 1 : 0);
	const _miss: Record<number, boolean> = {};
	let { count, miss } = paraminfo, index;
	miss = [...miss];
	while ((index = miss.pop()) !== undefined) {
		if (index !== --count) {
			count++, miss.push(index);
			break;
		}
	}
	if ((count < min && !paraminfo.unknown) || count > max)
		doc.diagnostics.push({
			message: diagnostic.paramcounterr(min === max ? min : max === Infinity ? `${min}+` : `${min}-${max}`, count),
			range: info.range, severity: DiagnosticSeverity.Error
		});
	for (index of miss) {
		if (index >= l)
			break;
		if (_miss[index] = true, param_is_miss(params, index))
			doc.addDiagnostic(diagnostic.missingparam(),
				paraminfo.comma[index] ?? doc.document.offsetAt(info.range.end), 1);
	}
	if (node.hasref) {
		params.forEach((param, index) => {
			if (index < count && param.pass_by_ref && !_miss[index]) {
				let o: number, t: Token;
				if (index === 0)
					o = info.offset! + info.name.length + 1;
				else o = paraminfo.comma[index - 1] + 1;
				if ((t = doc.find_token(o)).content !== '&' && (t.content.toLowerCase() !== 'unset' || param.defaultVal === undefined) && doc.tokens[t.next_token_offset]?.type !== 'TK_DOT') {
					let end = 0;
					const ts = decltype_expr(doc, t, paraminfo.comma[index] ??
						(end = doc.document.offsetAt(info.range.end) - (doc.tokens[info.offset! + info.name.length] ? 1 : 0)));
					if (ts.some(it => it === VARREF || it === ANY || it.data === VARREF))
						return;
					const lk = doc.tokens[paraminfo.comma[index]]?.previous_token;
					if (lk)
						end = lk.offset + lk.length;
					doc.addDiagnostic(diagnostic.typemaybenot('VarRef'), t.offset,
						Math.max(0, end - t.offset), 2);
				}
			}
		});
	}
	if ((!node.returns?.length && !(node.type_annotations || null)?.length) && !(is_cls && node.name.toLowerCase() === '__new')) {
		const tk = doc.tokens[info.offset!];
		if (tk?.previous_token?.type === 'TK_EQUALS') {
			const nt = doc.get_token(doc.document.offsetAt(info.range.end), true);
			if (!nt || !is_line_continue(nt.previous_token!, nt) || nt.content !== '??' && (nt.content !== '?' || !nt.ignore))
				doc.addDiagnostic(diagnostic.missingretval(), tk.offset, tk.length, 2);
		}
	}
	function param_is_miss(params: Variable[], i: number) {
		if (params[i].defaultVal !== undefined)
			return false;
		let j = i - 1;
		while (j >= 0) {
			// Skip negligible parameters
			for (; j >= 0 && params[j].defaultVal === false; j--, i++);
			if (!params[i] || params[i].defaultVal !== undefined)
				return false;
			for (; j >= 0 && params[j].defaultVal !== false; j--);
		}
		return true;
	}
}

export async function workspaceSymbolProvider(params: WorkspaceSymbolParams, token: CancellationToken): Promise<SymbolInformation[]> {
	const symbols: SymbolInformation[] = [], query = params.query;
	let n = 0;
	if (token.isCancellationRequested || !query || !query.match(/^(\w|[^\x00-\x7f])+$/))
		return symbols;
	const reg = new RegExp(query.match(/[^\w]/) ? query.replace(/(.)/g, '$1.*') : '(' + query.replace(/(.)/g, '$1.*') + '|[^\\w])', 'i');
	for (const uri in lexers)
		if (filterSymbols(uri)) return symbols;
	if (!process.env.BROWSER) {
		let uri: string, d: Lexer, t: TextDocument | undefined;
		for (let dir of workspaceFolders) {
			dir = URI.parse(dir).fsPath;
			for await (const path of enum_ahkfiles(dir)) {
				uri = URI.file(path).toString().toLowerCase();
				if (!lexers[uri] && (t = openFile(path))) {
					if ((d = new Lexer(t)).parseScript(), d.maybev1) continue;
					if (lexers[uri] = d, filterSymbols(uri)) return symbols;
				}
			}
		}
	} else {
		const uris = (await connection?.sendRequest('ahk2.getWorkspaceFiles', []) || []) as string[];
		for (const uri_ of uris) {
			const uri = uri_.toLowerCase();
			let d: Lexer;
			if (!lexers[uri]) {
				const content = (await connection?.sendRequest('ahk2.getWorkspaceFileContent', [uri_])) as string;
				d = new Lexer(TextDocument.create(uri_, 'ahk2', -10, content));
				d.parseScript(), lexers[uri] = d;
				if (filterSymbols(uri)) return symbols;
			}
		}
	}
	return symbols;
	function filterSymbols(uri: string) {
		for (const it of symbolProvider({ textDocument: { uri } })) {
			if (reg.test(it.name)) {
				symbols.push(it);
				if (++n >= 1000)
					return true;
			}
		}
		return false;
	}
}