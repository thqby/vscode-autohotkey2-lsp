import { CancellationToken, DocumentSymbolParams, Range, SymbolInformation, WorkspaceSymbolParams } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	ANY, AhkSymbol, CallSite, ClassNode, DiagnosticSeverity, FuncNode, FuncScope, Lexer, Property, SUPER, SemanticToken,
	SemanticTokenModifiers, SemanticTokenTypes, SymbolKind, THIS, Token, TokenType, URI, VARREF, Variable, ZERO_RANGE,
	ahkUris, ahkVars, ahkVersion, alpha_3, checkDupError, configCache, decltypeExpr, diagnostic, enumFiles,
	findClass, getClassConstructor, getClassMember, getParamCount, getWorkspaceFile, inactiveVars,
	isContinuousLine, lexers, makeDupError, openFile, utils, warn, workspaceFolders
} from './common';

export function symbolProvider(params: DocumentSymbolParams, token?: CancellationToken | null): SymbolInformation[] {
	const lex = lexers[params.textDocument.uri.toLowerCase()];
	if (!lex || token?.isCancellationRequested)
		return [];
	return lex.symbolInformation ?? getSymbolInfo(lex);
}
function getSymbolInfo(lex: Lexer, oncomp?: Array<() => void>) {
	const fns = oncomp ?? [];
	const { document, tokens, relevance } = lex;
	const gvar: Record<string, Variable> = { ...ahkVars };
	let list = [lex.uri, ...Object.keys(relevance)], winapis: Record<string, AhkSymbol> = {};
	list = list.map(u => lexers[u]?.d_uri).concat(list);
	lex.symbolInformation = [];
	for (const uri of list) {
		const lex = lexers[uri];
		if (!lex) continue;
		const { d, declaration: dec } = lex;
		let t;
		d || (lex.symbolInformation ?? getSymbolInfo(lex, fns));
		for (const k in dec) {
			if (!(t = gvar[k]) || d || dec[k].kind !== SymbolKind.Variable && (t.kind === SymbolKind.Variable || t.def === false))
				gvar[k] = dec[k];
			else if (t.kind === SymbolKind.Variable && (t.assigned ||= (dec[k] as Variable).assigned, dec[k].def))
				t.def ??= false;
		}
	}
	if (ahkUris.winapi && !list.includes(ahkUris.winapi))
		winapis = lexers[ahkUris.winapi]?.declaration ?? winapis;
	const warnLocalSameAsGlobal = configCache.Warn?.LocalSameAsGlobal;
	const result: AhkSymbol[] = [], unset_vars = new Map<Variable, Variable>();
	for (const [k, v] of Object.entries(lex.declaration)) {
		let t = gvar[k], islib = false;
		if (t.kind === SymbolKind.Variable && !t.assigned && !v.decl)
			if (k in winapis)
				t = gvar[k] = winapis[k], islib = true;
			else if (v.returns === undefined)
				unset_vars.set(t, v);
		if (v.kind === SymbolKind.Variable ? t === v && (check_name(v), true) : t === v || (gvar[k] = v))
			result.push(v), converttype(v, v, islib || v === ahkVars[k]).definition = v;
	}
	flatTree(lex);
	fns.push(function () {
		if (configCache.Warn?.VarUnset)
			for (const [k, v] of unset_vars) {
				if (k.assigned || k.has_warned)
					continue;
				k.has_warned = true;
				let code, since, message = warn.varisunset(v.name);
				if (!k.decl && (since = inactiveVars[k.name.toUpperCase()]))
					message += `, ${diagnostic.requireversion(since)}`, code = 'built-in library';
				lex.diagnostics.push({ code, message, range: v.selectionRange, severity: DiagnosticSeverity.Warning });
			}
		if (lex.actived) {
			checksamename(lex);
			lex.sendDiagnostics(false, true);
		}
	});
	oncomp ?? fns.forEach(f => f());
	const uri = lex.document.uri;
	return lex.symbolInformation = result.map(info => SymbolInformation.create(info.name, info.kind, info.range, uri));

	function maybe_unset(k: Variable, v: Variable) {
		if (!(k.assigned ||= v.assigned) && v.returns === undefined)
			unset_vars.has(k) || unset_vars.set(k, v);
	}
	function flatTree(node: { children?: AhkSymbol[] }, vars: Record<string, Variable> = {}, outer_is_global = false) {
		const t: AhkSymbol[] = [];
		let tk: Token;
		if ((node as AhkSymbol).kind === SymbolKind.Class)
			node.children?.forEach(it => it.children && t.push(it));
		else node.children?.forEach((info: Variable) => {
			if (info.children)
				t.push(info);
			if (!info.name)
				return;
			const kind = info.kind;
			if (kind === SymbolKind.Variable || kind === SymbolKind.Function || kind === SymbolKind.Class) {
				const name = info.name.toUpperCase(), sym = vars[name] ?? gvar[name];
				if (sym === info || !sym)
					return;
				(tk = converttype(info, sym, sym === ahkVars[name])).definition = sym;
				if (sym.selectionRange === ZERO_RANGE)
					delete tk.semantic;
				else if (info.kind !== SymbolKind.Variable)
					result.push(info);
				else if (sym.kind === SymbolKind.Variable)
					maybe_unset(sym, info);
				else if (tk.callsite)
					checkParamInfo(lex, sym as FuncNode, tk.callsite);
			} else result.push(info);
		});
		for (const info of t) {
			let inherit: Record<string, AhkSymbol> = {}, oig = outer_is_global, s: Variable, assme_static;
			const fn = info as FuncNode;
			switch (info.kind) {
				case SymbolKind.Class: {
					const cls = info as ClassNode;
					inherit = { THIS, SUPER }, oig = false;
					for (const dec of [cls.property, cls.prototype?.property ?? {}])
						Object.values(dec).forEach(it => it.selectionRange !== ZERO_RANGE && it.name && result.push(it));
					break;
				}
				case SymbolKind.Property:
					if (fn.has_this_param) {
						const prop = info as Property;
						for (const s of [prop.get, prop.set, prop.call]) {
							if (s?.parent === prop || s?.kind === SymbolKind.Method)
								t.push(s), s.selectionRange !== ZERO_RANGE && result.push(s);
						}
					} else break;
				// fall through
				case SymbolKind.Method:
				case SymbolKind.Function:
					if (fn.has_this_param) {
						inherit = { THIS, SUPER };
						if (fn.parent?.kind === SymbolKind.Property)
							Object.assign(inherit, (fn.parent as Property).local);
					} else {
						if (vars.SUPER?.selectionRange === ZERO_RANGE)
							delete vars.SUPER;
						if (fn.assume !== FuncScope.GLOBAL) {
							if (fn.static) {
								const p = fn.parent as FuncNode;
								for (const [k, v] of Object.entries(p?.declaration ?? {}))
									v.static && (inherit[k] = v);
								for (const [k, v] of Object.entries(p?.global ?? {}))
									v.decl && (inherit[k] = gvar[k] ?? v);
							} else inherit = { ...vars };
						} else oig = true;
					}
				// fall through
				case SymbolKind.Event:
					oig ||= fn.assume === FuncScope.GLOBAL;
					assme_static = fn.assume === FuncScope.STATIC && !(oig = false);
					for (const [k, v] of Object.entries(fn.global ?? {}))
						s = inherit[k] = gvar[k] ??= v, converttype(v, s, s === ahkVars[k]).definition = s;
					for (const [k, v] of Object.entries(fn.local ?? {})) {
						converttype(inherit[k] = v, v).definition = v;
						if (v.kind === SymbolKind.Variable) {
							check_name(v);
							if (v.is_param || v.decl && result.push(v)) continue;
							if (!v.assigned && v.returns === undefined)
								unset_vars.set(v, v);
							else if (warnLocalSameAsGlobal && gvar[k])
								lex.diagnostics.push({ message: warn.localsameasglobal(v.name), range: v.selectionRange, severity: DiagnosticSeverity.Warning });
						}
						result.push(v);
					}
					if (fn.static === null) {
						const vars = { ...fn.global, ...fn.local };
						for (const [k, v] of Object.entries(fn.declaration ??= {}))
							if (!vars[k])
								converttype(inherit[k] = v, v).definition = v;
						break;
					}
					for (const [k, v] of Object.entries(fn.declaration ??= {}))
						if ((s = inherit[k]))
							s !== v && (converttype(v, s, s === ahkVars[k]).definition = s,
								s.kind === SymbolKind.Variable && maybe_unset(s, v as Variable));
						else if (oig)
							s = gvar[k] ??= (result.push(v), check_name(v), lex.declaration[k] = v),
								(v as Variable).is_global = true, (fn.global ??= {})[v.name.toUpperCase()] = v,
								converttype(v, s, s === ahkVars[k]).definition = s,
								s.kind === SymbolKind.Variable && maybe_unset(s, v as Variable);
						else if (!v.def && (s = gvar[k]))
							converttype(v, s, s === ahkVars[k]).definition = s;
						else {
							converttype(inherit[k] = fn.local[k] = v, v).definition = v, result.push(v);
							assme_static && (v.static = true), check_name(v);
							if (warnLocalSameAsGlobal && v.kind === SymbolKind.Variable && gvar[k])
								lex.diagnostics.push({ message: warn.localsameasglobal(v.name), range: v.selectionRange, severity: DiagnosticSeverity.Warning });
						}
					for (const [k, v] of Object.entries(fn.unresolved_vars ?? {}))
						if ((s = inherit[k] ?? (gvar[k] ??= winapis[k]))) {
							converttype(v, s, s === ahkVars[k]).definition = s;
							if (s === gvar[k])
								(fn.global ??= {})[k] = v;
							else fn.declaration[k] = v;
						} else {
							converttype(fn.declaration[k] = fn.local[k] = v, v).definition = v;
							result.push(inherit[k] = v), check_name(v);
							if (fn.assume === FuncScope.STATIC)
								v.static = true;
							if (v.returns === undefined)
								unset_vars.set(v, v);
						}
					delete fn.unresolved_vars;
					break;
				default: inherit = { ...vars }; break;
			}
			flatTree(info, inherit, oig);
		}
	}
	function checksamename(lex: Lexer) {
		if (lex.d)
			return;
		const dec = { ...ahkVars }, lbs: Record<string, string> = {};
		const severity = DiagnosticSeverity.Error;
		const { uri } = lex;
		let dd: Lexer, sym: AhkSymbol;
		Object.entries(lex.labels).forEach(e => e[1][0].def && (lbs[e[0]] = uri));
		for (const uri in relevance) {
			if ((dd = lexers[uri])) {
				if (dd.d) continue;
				checkDupError(dec, Object.values(dd.declaration).filter(it => it.kind !== SymbolKind.Variable), dd);
				const labels = dd.labels;
				if (!Object.keys(labels).length) continue;
				const r = dd.relevance;
				for (const l in labels) {
					if (!(sym = labels[l][0]).def)
						continue;
					const u = lbs[l];
					if (!u)
						lbs[l] = uri;
					else if (r[u])
						sym.has_warned ??=
							dd.diagnostics.push({ message: diagnostic.duplabel(), range: sym.selectionRange, severity });
				}
			}
		}
		const t = Object.values(lex.declaration);
		checkDupError(dec, t, lex);
		for (const uri in relevance) {
			if ((dd = lexers[uri]))
				checkDupError(dec, Object.values(dd.declaration).filter(it => it.kind === SymbolKind.Variable), dd);
		}
		let cls: ClassNode;
		t.forEach(it => {
			if (it.kind === SymbolKind.Class && (cls = it as ClassNode).extendsuri === undefined) {
				const l = cls.extends?.toUpperCase();
				if (l === it.name.toUpperCase())
					err_extends(lex, cls, false);
				else if (l && !findClass(lex, l)?.prototype)
					err_extends(lex, cls);
			}
		});
		for (const uri in relevance) {
			if ((dd = lexers[uri]))
				for (const it of Object.values(dd.declaration))
					if (it.kind === SymbolKind.Class && (cls = it as ClassNode).extendsuri === undefined) {
						const l = cls.extends?.toUpperCase();
						if (l === it.name.toUpperCase())
							err_extends(dd, cls, false);
						else if (l && !findClass(dd, l)?.prototype)
							err_extends(dd, cls);
					}
		}
		function err_extends(lex: Lexer, it: ClassNode, not_exist = true) {
			let o = lex.document.offsetAt(it.selectionRange.start), tk: Token;
			const tks = lex.tokens;
			if (!(tk = tks[tks[o].next_token_offset]) || !(tk = tks[tk.next_token_offset]) || tk.has_warned)
				return;
			o = tk.offset, tk.has_warned = true;
			const rg: Range = { start: lex.document.positionAt(o), end: lex.document.positionAt(o + it.extends.length) };
			lex.diagnostics.push({ message: not_exist ? diagnostic.unknown("class '" + it.extends) + "'" : diagnostic.unexpected(it.extends), range: rg, severity: DiagnosticSeverity.Warning });
		}
	}
	function check_name(sym: AhkSymbol) {
		if (sym.name[0] <= '9')
			lex.diagnostics.push({ message: diagnostic.invalidsymbolname(sym.name), range: sym.selectionRange });
	}
	function converttype(it: AhkSymbol, source: Variable, islib = false): Token {
		let stk: SemanticToken | undefined, st: SemanticTokenTypes | undefined;
		const kind = source.kind;
		switch (kind) {
			case SymbolKind.Variable:
				if (source.is_param) {
					if (it.selectionRange === ZERO_RANGE)
						return {} as Token;
					st = SemanticTokenTypes.parameter;
				} else if (!islib)
					st = SemanticTokenTypes.variable;
				break;
			case SymbolKind.Class:
				st = SemanticTokenTypes.class; break;
			case SymbolKind.Function:
				st = SemanticTokenTypes.function; break;
			case SymbolKind.Module:
				st = SemanticTokenTypes.module; break;
		}
		const tk = tokens[document.offsetAt(it.selectionRange.start)];
		if (!tk) return {} as Token;
		if (st === undefined)
			delete tk.semantic;
		else if (!tk.ignore) {
			if (!(stk = tk.semantic)) {
				tk.semantic = stk = { type: st };
				if (it.kind === SymbolKind.Variable && it.def) {
					const { assigned } = it as Variable;
					if (kind === SymbolKind.Class ? assigned === true :
						kind === SymbolKind.Function && (islib ? assigned === true : assigned !== 1))
						it.has_warned ??= lex.diagnostics.push({
							message: makeDupError(it, { kind } as AhkSymbol),
							range: it.selectionRange
						}), delete it.def;
				}
				if (!tk.callsite && st === SemanticTokenTypes.function) {
					const nk = lex.tokens[tk.next_token_offset];
					if (nk && nk.topofline < 1 && !(nk.op_type! >= 0 || ':?.+-*/=%<>,)]}'.includes(nk.content.charAt(0)) || !nk.data && nk.content === '{'))
						lex.diagnostics.push({
							message: diagnostic.funccallerr2(),
							range: it.selectionRange, severity: 2
						});
				}
			} else if (kind !== undefined)
				stk.type = st;
			let modifier = stk.modifier ?? 0;
			if (st <= SemanticTokenTypes.module)
				modifier |= SemanticTokenModifiers.readonly;
			if (islib)
				modifier |= SemanticTokenModifiers.defaultLibrary;
			if (source.static)
				modifier |= SemanticTokenModifiers.static;
			if (modifier) stk.modifier = modifier;
		}
		return tk;
	}
}

export function checkParamInfo(lex: Lexer, node: FuncNode, info: CallSite) {
	const { checked, paraminfo } = info;
	let is_cls: boolean, params;
	if (checked || !paraminfo || !configCache.Diagnostics.ParamsCheck) return;
	info.checked = true;
	if ((is_cls = node?.kind === SymbolKind.Class))
		node = getClassConstructor(node as unknown as ClassNode) as FuncNode;
	if (!(params = node?.params)) return;
	const { max, min } = getParamCount(node), l = params.length - (node.variadic ? 1 : 0);
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
		lex.diagnostics.push({
			message: diagnostic.paramcounterr(min === max ? min : max === Infinity ? `${min}+` : `${min}-${max}`, count),
			range: info.range, severity: DiagnosticSeverity.Error
		});
	for (index of miss) {
		if (index >= l)
			break;
		if (_miss[index] = true, param_is_miss(params, index))
			lex.addDiagnostic(diagnostic.missingparam(),
				paraminfo.comma[index] ?? lex.document.offsetAt(info.range.end), 1);
	}
	if (node.hasref) {
		params.forEach((param, index) => {
			if (index < count && param.pass_by_ref && !_miss[index]) {
				let o: number, t: Token;
				if (index === 0)
					o = info.offset! + info.name.length + 1;
				else o = paraminfo.comma[index - 1] + 1;
				if ((t = lex.findToken(o)).content !== '&' && (t.content.toLowerCase() !== 'unset' || param.defaultVal === undefined) && lex.tokens[t.next_token_offset]?.type !== TokenType.Dot) {
					let end = 0;
					const ts = decltypeExpr(lex, t, paraminfo.comma[index] ?? (end = paraminfo.end!));
					if (ts.some(it => it === VARREF || it === ANY || it.data === VARREF))
						return;
					if (ahkVersion >= alpha_3 + 7 && ts.some(it =>
						getClassMember(lex, it, '__value', false)))
						return;
					const lk = lex.tokens[paraminfo.comma[index]]?.previous_token;
					if (lk)
						end = lk.offset + lk.length;
					lex.addDiagnostic(diagnostic.typemaybenot('VarRef'), t.offset,
						Math.max(0, end - t.offset), { severity: 2 });
				}
			}
		});
	}
	if ((!node.returns?.length && !(node.type_annotations || null)?.length) && !(is_cls && node.name.toLowerCase() === '__new')) {
		const tk = lex.tokens[info.offset!];
		if (tk?.semantic?.type === SemanticTokenTypes.method) {
			let t = tk.previous_token;
			while (t?.type === TokenType.Dot)
				if ((t = t.previous_token)?.type === TokenType.Identifier)
					t = t!.previous_token;
				else return;
			if (!is_assign_or_return(t))
				return;
		} else if (!is_assign_or_return(tk?.previous_token))
			return;
		let nt = lex.getToken(lex.document.offsetAt(info.range.end), true);
		nt = lex.tokens[nt?.next_token_offset];
		if (!nt || !isContinuousLine(nt.previous_token!, nt) || nt.content !== '??' && (nt.content !== '?' || !nt.ignore))
			lex.addDiagnostic(diagnostic.missingretval(), tk.offset, tk.length, { severity: 2 });
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
	function is_assign_or_return(tk?: Token) {
		if (!tk) return false;
		if (tk.type === TokenType.Assign)
			return true;
		if (tk.type === TokenType.Operator)
			return tk.content === '=>';
		return tk.type === TokenType.Reserved && tk.content.toLowerCase() === 'return' &&
			!lex.tokens[tk.next_token_offset]?.topofline;
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
			for await (const path of enumFiles(dir)) {
				uri = URI.file(path).toString().toLowerCase();
				if (!lexers[uri] && (t = openFile(path))) {
					if ((d = new Lexer(t)).parseScript(), d.maybev1) continue;
					if (lexers[uri] = d, filterSymbols(uri)) return symbols;
				}
			}
		}
	} else {
		const uris = await utils.sendRequest!<string[]>('getWorkspaceFiles') ?? [];
		for (const uri of uris) {
			const u = uri.toLowerCase();
			let d: Lexer;
			if (!lexers[u]) {
				const content = (await getWorkspaceFile(uri))?.text;
				if (!content) continue;
				d = new Lexer(TextDocument.create(uri, 'ahk2', -10, content));
				d.parseScript(), lexers[u] = d;
				if (filterSymbols(u)) return symbols;
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