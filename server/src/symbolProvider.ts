import { CancellationToken, DocumentSymbolParams, Range, SymbolInformation, WorkspaceSymbolParams } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	ANY, ASSIGN_TYPE, AhkSymbol, CallSite, ClassNode, DiagnosticSeverity, DiagnosticTag, FuncNode, FuncScope, Lexer, Maybe, Module, Property, SK2STT,
	SUPER, SemanticToken, SemanticTokenModifiers, SemanticTokenTypes, SymbolKind, THIS, Token, TokenType, UNSET, URI, VARREF, VOID, Variable, ZERO_RANGE,
	ahkUris, ahkVars, ahkVersion, alpha_3, checkDupError, configCache, decltypeExpr, decltypeReturns, diagnostic, enumFiles, findClass, getAllModules,
	getClassBase, getClassConstructor, getClassMember, getClassMembers, getImplicitImports, getModuleImporteds, getParamCount, getWorkspaceFile, hint, inactiveVars,
	invokeCheck, isContinuousLine, lexers, openFile, resolveVarAlias, sym_related_msg, sym_type, utils, warn, workspaceFolders
} from './common';

export function symbolProvider(params: DocumentSymbolParams, token?: CancellationToken): SymbolInformation[] {
	const lex = Lexer.curr = lexers[params.textDocument.uri.toLowerCase()];
	if (!lex || token?.isCancellationRequested)
		return [];
	return lex.symbolInformation ?? getSymbolInfo(lex) ?? [];
}

export function getSymbolInfo(lex: Lexer, mod?: Module, result_?: AhkSymbol[],
	oncomp?: Array<() => Maybe<() => void>>, caches = new Map<ClassNode, Record<string, AhkSymbol>>()) {
	const fns = oncomp ?? [];
	const uri = lex.document.uri;
	const unused = new Set<AhkSymbol>;
	const { document, tokens } = lex;
	const gvar: Record<string, Variable> = {};
	const mods = getAllModules(lex, mod);
	const undefined_props = new Map<Token, ClassNode>();
	const ClassNonDynamicMemberCheck = configCache.Diagnostics?.ClassNonDynamicMemberCheck;
	let p_this: ClassNode | undefined;
	mod ??= (lex.symbolInformation = [], lex);
	for (let m of mods) {
		const { d } = m as Lexer, { declaration: dec } = m, lex = m instanceof Lexer ? m : lexers[m.uri!];
		let t;
		d || lex && (lex.symbolInformation ?? getSymbolInfo(lex, undefined, undefined, fns, caches));
		for (const k in dec) {
			if (!(t = gvar[k]) || d || t.kind === SymbolKind.Variable && dec[k].kind !== SymbolKind.Variable)
				gvar[k] = dec[k];
			else if (t.kind === SymbolKind.Variable && (t.assigned ||= (dec[k] as Variable).assigned, dec[k].def))
				t.def ??= false;
		}
	}
	let implicitVars;
	if (ahkVersion < alpha_3 + 8) {
		for (const n in ahkVars)
			if (!gvar[n]?.children)
				gvar[n] = ahkVars[n];
		implicitVars = lexers[ahkUris.winapi]?.declaration ?? {};
	}
	implicitVars ??= getImplicitImports(mods, undefined, lexers[ahkUris.winapi]?.declaration, ahkVars);
	for (const n in implicitVars)
		if (gvar[n]?.def === undefined)
			gvar[n] = implicitVars[n];
		else gvar[n] ??= implicitVars[n];
	const warnLocalSameAsGlobal = configCache.Warn?.LocalSameAsGlobal;
	const result = result_ ?? [], unset_vars = new Map<Variable, Variable>();
	for (const [k, v] of Object.entries(mod.declaration)) {
		let t = gvar[k];
		if (t.kind === SymbolKind.Variable && !t.assigned && !v.decl)
			if (v.returns === undefined)
				unset_vars.set(t, v);
		if (v.kind === SymbolKind.Variable ? t === v && (check_name(v), true) : t === v || (gvar[k] = v))
			(v as Variable).from ?? result.push(v), (v as FuncNode).in_expr || unused.add(v), converttype(v, v);
	}
	const gu = new Set(unused);
	flatTree(mod);
	!lex.d && fns.push(function () {
		const mm = mods.filter(m => m !== mod);
		for (const t of unused.intersection(gu)) {
			if (t.exported) {
				unused.delete(t);
				continue;
			}
			const n = t.name.toUpperCase();
			for (const m of mm)
				if (m.declaration[n]) {
					unused.delete(t);
					break;
				}
		}
		const ug = unused.intersection(gu);
		if (ug.size) {
			const ns = new Set(ug.values().map(t => t.name.toUpperCase()));
			let s;
			for (const imps of getModuleImporteds(mod).values()) {
				for (const imp of imps)
					for (const v of imp.var)
						ns.has(s = v.alias?.toUpperCase()!) && ns.delete(s);
			}
			ug.forEach(n => !ns.has(n.name.toUpperCase()) && unused.delete(n));
		}
		const diag = {
			message: hint.unused(), tags: [DiagnosticTag.Unnecessary],
			severity: configCache.Warn?.Unused ? DiagnosticSeverity.Warning : DiagnosticSeverity.Hint,
		};
		for (const t of unused)
			t.name[0] !== '_' && lex.diagnostics.push({ range: t.selectionRange, ...diag });
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
			checksamename(lex, mod);
			resolveUndefinedProp();
			if (lex === mod)
				return () => lex.sendDiagnostics(false, true);
		}
	});
	if (mod !== lex) return;
	if (lex.module)
		for (const m of Object.values(lex.module)) {
			m.name && result.push(...m.ranges!.map(r => ({
				...m, range: {
					start: document.positionAt(r[0]),
					end: document.positionAt(r[1]),
				}
			})));
			getSymbolInfo(lex, m, result, fns, caches);
		}
	oncomp ?? fns.map(f => f()).forEach(f => f?.());
	return lex.symbolInformation = result.map(info => SymbolInformation.create(info.name, info.kind, info.range, uri));

	function maybe_unset(k: Variable, v: Variable) {
		if (!(k.assigned ||= v.assigned) && !v.decl && v.returns === undefined)
			unset_vars.has(k) || unset_vars.set(k, v);
	}
	function add(v: AhkSymbol) {
		return unused.add(v), result.push(v);
	}
	function flatTree(node: { children?: AhkSymbol[] }, vars: Record<string, Variable> = {}, outer_is_global = false) {
		const t: AhkSymbol[] = [];
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
				unused.delete(sym);
				converttype(info, sym);
				if (info.kind !== SymbolKind.Variable)
					result.push(info);
				else if (sym.kind === SymbolKind.Variable)
					maybe_unset(sym, info);
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
						let p;
						inherit = { THIS, SUPER };
						if ((p = fn.parent)?.kind === SymbolKind.Property)
							Object.assign(inherit, (p as Property).local), p = p!.parent;
						p_this = p as ClassNode;
					} else {
						if (vars.SUPER?.selectionRange === ZERO_RANGE)
							delete vars.SUPER;
						if (fn.assume !== FuncScope.GLOBAL) {
							if (fn.static) {
								for (const [k, v] of Object.entries(vars))
									if (v.static || v === gvar[k])
										inherit[k] = v;
							} else inherit = { ...vars };
						} else oig = true;
					}
				// fall through
				case SymbolKind.Event:
					oig ||= fn.assume === FuncScope.GLOBAL;
					assme_static = fn.assume === FuncScope.STATIC && !(oig = false);
					for (const [k, v] of Object.entries(fn.global ?? {}))
						s = inherit[k] = gvar[k] ??= v, converttype(v, s);
					for (const [k, v] of Object.entries(fn.local ?? {})) {
						converttype(inherit[k] = v, v);
						if (v.kind === SymbolKind.Variable) {
							check_name(v), unused.add(v);
							if (v.is_param && (v.selectionRange !== ZERO_RANGE || unused.delete(v)) ||
								v.decl && result.push(v)) continue;
							if (!v.assigned && v.returns === undefined)
								unset_vars.set(v, v);
							else if (warnLocalSameAsGlobal && gvar[k])
								lex.diagnostics.push({ message: warn.localsameasglobal(v.name), range: v.selectionRange, severity: DiagnosticSeverity.Warning });
						} else (v as FuncNode).in_expr || unused.add(v)
						result.push(v);
					}
					if (fn.static === null) {
						const vars = { ...fn.global, ...fn.local };
						for (const [k, v] of Object.entries(fn.declaration ??= {}))
							if (!vars[k])
								converttype(inherit[k] = v, v);
						break;
					}
					for (const [k, v] of Object.entries(fn.declaration ??= {}))
						if ((s = inherit[k]))
							s !== v && (converttype(v, s),
								s.kind === SymbolKind.Variable && maybe_unset(s, v as Variable));
						else if (oig)
							s = gvar[k] ??= (add(v), check_name(v), lex.declaration[k] = (v.uri = lex.uri, v)),
								(v as Variable).is_global = true, (fn.global ??= {})[v.name.toUpperCase()] = v,
								converttype(v, s),
								s.kind === SymbolKind.Variable && maybe_unset(s, v as Variable);
						else if (!v.def && (s = gvar[k]))
							converttype(v, s);
						else {
							converttype(inherit[k] = fn.local[k] = v, v), add(v);
							assme_static && (v.static = true), check_name(v);
							if (warnLocalSameAsGlobal && v.kind === SymbolKind.Variable && gvar[k])
								lex.diagnostics.push({ message: warn.localsameasglobal(v.name), range: v.selectionRange, severity: DiagnosticSeverity.Warning });
						}
					for (const [k, v] of Object.entries(fn.unresolved_vars ?? {}))
						if ((s = inherit[k] ?? gvar[k])) {
							converttype(v, s);
							if (s === gvar[k])
								(fn.global ??= {})[k] = v, lex.declaration[k] ??= (v.is_global = true, v);
							else fn.declaration[k] = v;
						} else {
							converttype(fn.declaration[k] = fn.local[k] = v, v);
							add(inherit[k] = v), check_name(v);
							if (fn.assume === FuncScope.STATIC)
								v.static = true;
							if (v.returns === undefined)
								unset_vars.set(v, v);
						}
					delete fn.unresolved_vars;
					break;
				default: inherit = { ...vars }; break;
			}
			const h = info.kind === SymbolKind.Function && unused.has(info);
			flatTree(info, inherit, oig);
			h && unused.add(info);
		}
	}
	function checksamename(lex: Lexer, mod: Module) {
		const dec = { ...ahkVars }, lbs: Record<string, string> = {};
		const severity = DiagnosticSeverity.Error;
		const { uri } = lex, mi = mods.indexOf(mod);
		let dd: Lexer, sym: AhkSymbol, rele;
		mod.labels && Object.entries(mod.labels).forEach(e => e[1][0].def && (lbs[e[0]] = uri));
		if (mods.some(m => m.selectionRange !== ZERO_RANGE))
			rele = Object.fromEntries(mods.map(m => [m.uri!, ' ']));
		mi !== -1 && mods.splice(mi, 1);
		for (const m of mods) {
			if ((m as Lexer).d || !(dd = m instanceof Lexer ? m : lexers[m.uri!]))
				continue;
			checkDupError(dec, Object.values(m.declaration).filter(it => it.kind !== SymbolKind.Variable), dd, false, rele);
			const labels = m.labels;
			if (!labels) continue;
			const r = rele ? undefined : dd.relevance;
			for (const l in labels) {
				if (!(sym = labels[l][0]).def)
					continue;
				const u = lbs[l];
				if (!u)
					lbs[l] = uri;
				else if (!r || r[u])
					sym.has_warned ??=
						dd.diagnostics.push({ message: diagnostic.duplabel(), range: sym.selectionRange, severity });
			}
		}
		const t = Object.values(mod.declaration);
		checkDupError(dec, t, lex, false, rele);
		for (const m of mods) {
			if ((dd = m instanceof Lexer ? m : lexers[m.uri!]))
				checkDupError(dec, Object.values(m.declaration).filter(it => it.kind === SymbolKind.Variable), dd, false, rele);
		}
		let cls: ClassNode;
		mods.splice(mi, 0, mod);
		for (const m of mods) {
			if ((dd = m instanceof Lexer ? m : lexers[m.uri!]))
				for (const it of Object.values(m.declaration))
					if (it.kind === SymbolKind.Class && (cls = it as ClassNode).extendsuri === undefined) {
						const l = cls.extends?.toUpperCase();
						if (l === it.name.toUpperCase())
							err_extends(dd, cls, false);
						else if (l && !findClass(dd, l, it.selectionRange.start)?.prototype)
							err_extends(dd, cls);
					}
		}
		function err_extends(lex: Lexer, it: ClassNode, not_exist = true) {
			let o = lex.document.offsetAt(it.selectionRange.start), tk, lk;
			const tks = lex.tokens;
			if (!(lk = tks[tks[o].next_token_offset]) || !(tk = tks[lk.next_token_offset]) || tk.has_warned)
				return;
			if (tk.type !== TokenType.Identifier || lk.content.toLowerCase() !== 'extends')
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
	function converttype(it: AhkSymbol, source: AhkSymbol) {
		let stk: SemanticToken | undefined, st: SemanticTokenTypes | undefined, ss;
		let { is_builtin, kind } = ss = source;
		switch (kind) {
			case SymbolKind.Variable:
				if ((source as Variable).is_param) {
					if (it.selectionRange === ZERO_RANGE)
						return;
					if (source.selectionRange !== ZERO_RANGE)
						st = SemanticTokenTypes.parameter;
				} else if (!is_builtin) {
					const r = resolveVarAlias(source);
					({ is_builtin, kind } = r);
					if (kind === SymbolKind.Variable)
						st = SemanticTokenTypes.variable;
					else if (source = r, kind === SymbolKind.Function)
						st = SemanticTokenTypes.function;
					else if (kind === SymbolKind.Class)
						st = SemanticTokenTypes.class;
					else if (kind === SymbolKind.Module)
						st = SemanticTokenTypes.module;
				}
				break;
			case SymbolKind.Class:
				st = SemanticTokenTypes.class; break;
			case SymbolKind.Function:
				st = SemanticTokenTypes.function; break;
			case SymbolKind.Module:
				st = SemanticTokenTypes.module; break;
		}
		const tk = tokens[document.offsetAt(it.selectionRange.start)];
		if (!tk) return;
		if (st === undefined)
			delete tk.semantic;
		else if (!tk.ignore) {
			if (!(stk = tk.semantic)) {
				tk.semantic = stk = { type: st };
				if (it.kind === SymbolKind.Variable && it.def) {
					const { assigned, decl } = it as Variable;
					if (kind === SymbolKind.Class ? assigned === true :
						kind === SymbolKind.Function && (is_builtin || decl ? assigned === true : assigned !== 1))
						it.has_warned ??= lex.diagnostics.push({
							message: diagnostic.assignerr(sym_type(source), ss.name),
							range: it.selectionRange,
							relatedInformation: [sym_related_msg(source, source.uri ? undefined : uri)]
						});
				}
				if (!tk.callsite && st === SemanticTokenTypes.function) {
					const nk = lex.tokens[tk.next_token_offset];
					if (nk && nk.topofline < 1 && !(nk.op_type! >= 0 || ':?.+-*/=%<>,)]}'.includes(nk.content.charAt(0)) || !nk.data && nk.content === '{'))
						lex.diagnostics.push({
							message: diagnostic.funccallerr2(),
							range: it.selectionRange, severity: DiagnosticSeverity.Warning
						});
				}
			} else if (kind !== undefined)
				stk.type = st;
			let modifier = stk.modifier ?? 0;
			if (st <= SemanticTokenTypes.module)
				modifier |= SemanticTokenModifiers.readonly;
			if (is_builtin)
				modifier |= SemanticTokenModifiers.defaultLibrary;
			if (source.static)
				modifier |= SemanticTokenModifiers.static;
			if (modifier) stk.modifier = modifier;
		}
		tk.definition = ss;
		if (st === undefined) {
			ss = source === THIS ? p_this : source === SUPER ? getClassBase(p_this!, lex) : undefined;
			if (!ss) return;
			source = ss, st = SemanticTokenTypes.class;
		}
		if ((ss = tk.callsite))
			return checkParamInfo(lex, source as FuncNode, ss);
		let o;
		if (st <= SemanticTokenTypes.module && tokens[o = tk.next_token_offset]?.type === TokenType.Dot && (ss = (o = tokens[o + 1])?.semantic) &&
			!o.ignore && (ss.type === SemanticTokenTypes.method || ss.type === SemanticTokenTypes.property))
			resolvePropSemanticType(o, ss, source as ClassNode);
	}

	interface _Flag {
		'#checkmember'?: boolean
	}

	function resolvePropSemanticType(tk: Token, sem: SemanticToken, obj: ClassNode) {
		let n, t, kind, ps, name;
		do {
			name = tk.content.toUpperCase();
			n = obj.property?.[name];
			if (!n || n.def === false) {
				t = (ps = caches.get(obj) ?? (caches.set(obj, ps = getClassMembers(lex, obj)), ps))[name];
				if (t)
					n = t, kind = t.kind;
				else if ((sem.type === SemanticTokenTypes.method ? '__CALL' : '__GET') in ps)
					return;
				else kind = undefined;
			} else ({ kind } = n);
			switch (kind) {
				case SymbolKind.Method:
					sem.modifier = (sem.modifier ?? 0) | SemanticTokenModifiers.readonly | (n.static ? SemanticTokenModifiers.static : 0);
					sem.type = SemanticTokenTypes.method, tk.definition = n;
					if ((t = tk.callsite)) {
						let tt, nk;
						if ((n as FuncNode).construct !== undefined)
							n = obj.prototype && getClassMember(lex, obj.prototype, (n as FuncNode).construct || '__new', true) || n;
						else if (obj.property && n.full?.startsWith('(Object) DefineProp(')) {
							tt = tokens[tk.next_token_offset];
							if (tt?.content === '(' && tk.offset + tk.length === tt.offset)
								nk = tokens[tt.next_pair_pos!], tt = tokens[tt.next_token_offset];
							if (tt) {
								if (tt.type === TokenType.String &&
									tt.next_token_offset === tk.callsite.paraminfo?.comma[0]) {
									addClassProp(obj, tt.content.slice(1, -1), tt.offset + 1);
								} else addClassProp(obj, '');
							}
						}
						checkParamInfo(lex, n as FuncNode, t);
						if (!nk) return;
						tk = nk;
					} else obj = n as ClassNode;
					break;
				case SymbolKind.Class:
					sem.type = SemanticTokenTypes.class;
					sem.modifier = (sem.modifier ?? 0) | SemanticTokenModifiers.readonly;
					obj = n as ClassNode, tk.definition = n;
					if ((t = tk.callsite)) checkParamInfo(lex, n as FuncNode, t);
					break;
				case SymbolKind.Property: {
					const t = n as Property;
					sem.type = SemanticTokenTypes.property;
					sem.modifier = (sem.modifier ?? 0) | (n.static ? SemanticTokenModifiers.static : 0) | (!t.set && t.children ? SemanticTokenModifiers.readonly : 0);
					tk.definition = n;
					if (obj.range !== n.range || !(obj = obj.prototype!))
						return;
					break;
				}
				case SymbolKind.Function:
					sem.type = SemanticTokenTypes.function;
					sem.modifier = (sem.modifier ?? 0) | SemanticTokenModifiers.readonly;
					tk.definition = n, obj = n as ClassNode;
					break;
				case SymbolKind.Variable: {
					const t = resolveVarAlias(tk.definition = n);
					sem.type = SK2STT.get(t.kind) ?? SemanticTokenTypes.variable;
					if (t.kind === SymbolKind.Variable)
						return;
					sem.modifier = (sem.modifier ?? 0) | SemanticTokenModifiers.readonly;
					obj = t as ClassNode;
					break;
				}
				case undefined:
					if (ClassNonDynamicMemberCheck && (obj.checkmember ?? lex.checkmember) !== false) {
						const tt = lex.tokens[tk.next_token_offset];
						if (obj.kind === SymbolKind.Module) {
							if (!tk.__ref || tt?.content[0] !== '?' || !tt.ignore && tt.content === '?')
								tk.has_warned ??= (lex.addDiagnostic(diagnostic.varundefined(tk.content), tk.offset), true);
						} else if (obj.kind !== SymbolKind.Class)
							return;
						else if (ASSIGN_TYPE.includes(tt?.content)) {
							('__SET' in ps!) || addClassProp(obj, tk.content, tk.offset);
						} else if ((tk.__ref || tt?.content[0] !== '?' || !tt.ignore && tt.content === '?') &&
							(ps as _Flag)?.['#checkmember'] !== false) {
							t = obj.undefined ??= {};
							if (tk.__ref)
								t[name] = false;
							else t[name] ??= (undefined_props.set(tk, obj), true);
						}
					}
				// fall through
				default: return;
			}
			tk = tokens[tk.next_token_offset];
			if (tk?.type !== TokenType.Dot)
				return;
			tk = tokens[tk.next_token_offset];
			sem = tk?.semantic!;
		} while (sem && !tk.ignore && (sem.type === SemanticTokenTypes.method || sem.type === SemanticTokenTypes.property));
	}

	function addClassProp(cls: ClassNode, name: string, offset?: number) {
		const l = lexers[cls.uri!];
		if (l && offset) {
			const n = name.toUpperCase();
			if (cls.property[n])
				return;
			const range = Range.create(l.document.positionAt(offset), l.document.positionAt(offset + name.length));
			const p: Variable = {
				name, kind: SymbolKind.Property,
				range, selectionRange: range, static: !!cls.prototype
			};
			if (l === lex && l.d < 2)
				cls.children?.push(p), cls.property[n] ??= p;
			else {
				const t = caches.get(cls);
				if (t)
					t[n] ??= p;
			}
			if (cls.undefined)
				delete cls.undefined[n];
		} else {
			delete cls.undefined;
			if (l && l.d < 2)
				cls.checkmember = false;
			else {
				const t = caches.get(cls) as _Flag;
				if (t)
					t['#checkmember'] = false;
			}
		}
	}

	function resolveUndefinedProp() {
		for (const [tk, cls] of undefined_props.entries()) {
			if (cls.undefined?.[tk.content.toUpperCase()])
				lex.addDiagnostic(diagnostic.maybehavenotmember(cls.name, tk.content), tk.offset, tk.length, { severity: 2 });
		}
	}
}

export function checkParamInfo(lex: Lexer, node: FuncNode, info: CallSite) {
	const { paraminfo } = info;
	let is_cls: boolean, params, tr: number;
	if (!paraminfo || !invokeCheck) return;
	if ((is_cls = node?.kind === SymbolKind.Class))
		node = getClassConstructor(node as unknown as ClassNode) as FuncNode;
	if (!(params = node?.params)) return;
	const { ParamCount: fPC, ByrefParam: fBP, ReturnUnset: fRU, ReturnVoid: fRV } = invokeCheck;
	if (fPC || fBP && node.hasref) {
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
			fPC && lex.diagnostics.push({
				message: diagnostic.paramcounterr(min === max ? min : max === Infinity ? `${min}+` : `${min}-${max}`, count),
				range: info.range, severity: DiagnosticSeverity.Error
			});
		for (index of miss) {
			if (index >= l)
				break;
			if (_miss[index] = true, fPC && param_is_miss(params, index))
				lex.addDiagnostic(diagnostic.missingparam(),
					paraminfo.comma[index] ?? lex.document.offsetAt(info.range.end), 1);
		}
		if (fBP && node.hasref) {
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
	}
	if (test_returns()) {
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
		let ret;
		if (tk.type === TokenType.Operator)
			ret = tk.content === '=>';
		else ret = tk.type === TokenType.Reserved && tk.content.toLowerCase() === 'return' &&
			!lex.tokens[tk.next_token_offset]?.topofline;
		if (ret && tr === 2 && (info.outer?.type_annotations || null)?.includes(VOID))
			ret = false;
		return ret;
	}
	function test_returns() {
		if (is_cls && !node.static)
			return false;
		if ((tr = node.test_return!) !== undefined)
			return tr === 2 ? fRV : tr && fRU;
		const ta = node.type_annotations || decltypeReturns(node, lexers[node.uri!] ?? lex);
		let r;
		if (ta?.length) {
			if (ta.includes(UNSET))
				return tr = node.test_return = 1, fRU;
			r = ta.length === 1 && ta[0] === VOID;
		} else r = !node.returns?.length;
		return (tr = node.test_return = r ? 2 : 0) && fRV;
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


function get_global_var(lexs: Module[]) {
	const vars: Record<string, Variable> = {};
	for (const l of lexs) {
		for (const [n, s] of Object.entries(l.declaration as typeof vars)) {
			const v = vars[n];
			if (v) {
				if (v.kind !== SymbolKind.Variable)
					continue;
				if (!(v.kind === SymbolKind.Variable && s.children ||
					v.from === undefined && s.from !== undefined ||
					!v.decl && s.decl || !v.def && s.def || v.is_global && !s.is_global))
					continue;
			}
			vars[n] = s;
		}
	}
	return vars;
}