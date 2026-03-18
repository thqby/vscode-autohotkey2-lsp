import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { MarkupContent, Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	URI, a_Vars, ahkUris, ahkVars, diagnostic, lexers,
	openAndParse, parseInclude, restorePath, utils
} from './common';
import {
	ANY, ARRAY, EMPTY_TOKEN, FLOAT, INTEGER, Lexer,
	NUMBER, OBJECT, STRING, UNSET, VARREF, VOID, ZERO_RANGE,
	ahkModule, ahkVersion, alpha_3, createModules, derefVar,
	isContinuousLine, isIdentifier, isYieldsOperand,
	resolveVarAlias, sym_related_msg, sym_type
} from './lexer';
import { SymbolKind } from './lsp-enums';
import {
	AhkSymbol, ClassNode, Context, FuncNode, Import, Module,
	ParamInfo, Property, Token, TokenType, USAGE, Variable
} from './types';

//#region type Inference
export function decltypeExpr(lex: Lexer, tk: Token, end_pos: number | Position, _this?: ClassNode): AhkSymbol[] {
	const stack: Token[] = [], op_stack: Token[] = [], { document, tokens } = lex;
	let operand = [0], pre = EMPTY_TOKEN, end: number, t, tt;
	if (typeof end_pos === 'object')
		end = document.offsetAt(end_pos);
	else end = end_pos;
	loop: while (tk && tk.offset < end) {
		switch (tk.type) {
			case TokenType.String:
			case TokenType.Number:
				if (check_concat())
					break loop;
				stack.push(tk), pre = tk;
				break;
			case TokenType.Identifier:
				if (check_concat())
					break loop;
				stack.push(tk), pre = tk;
				if (tk.symbol) {
					tk = lex.findToken(document.offsetAt(tk.symbol!.range.end), true);
					continue;
				} else if (tk.callsite) {
					if (tk.next_token_offset >= end || tk.next_token_offset === -1)
						break loop;
					stack.push(t = {
						content: '', type: TokenType.Invoke,
						paraminfo: tk.callsite.paraminfo ?? tk.paraminfo
					} as Token);
					tk = tokens[tk.next_token_offset];
					t.data = tk?.content === '(';
					if (!tk || !(tk = tokens[tk.next_pair_pos!])) {
						stack.length = 0;
						break loop;
					}
				}
				break;
			case TokenType.Dot:
				if ((tk = tokens[tk.next_token_offset])?.type === TokenType.Identifier) {
					t = tokens[tk.next_token_offset];
					if (t?.content === '[' && t.topofline < 1 || t?.content === '(' && !t.prefix_is_whitespace) {
						const call = { content: tk.content, type: TokenType.Invoke } as Token;
						stack.push(call);
						if (t.offset >= end)
							break loop;
						call.data = t.content === '(';
						call.paraminfo = t.paraminfo;
						if (!(tk = tokens[t.next_pair_pos!])) {
							stack.length = 0;
							break loop;
						}
						break;
					}
					if (t?.content === '%' && !t.prefix_is_whitespace && t.previous_pair_pos === undefined)
						skip_operand();

					else
						stack.push({ content: tk.content, type: TokenType.Invoke } as Token);
				} else if (tk?.type === TokenType.BracketStart) {
					if (tk.offset >= end)
						break loop;
					stack.push({
						content: '', type: TokenType.Invoke,
						data: tk.content === '(',
						paraminfo: tk.paraminfo
					} as Token);
					if (!(tk = tokens[tk.next_pair_pos!])) {
						stack.length = 0;
						break loop;
					}
				} else skip_operand();
				break;
			case TokenType.Operator:
				if (tk.content === '%' && tk.previous_pair_pos === undefined) {
					if (!tk.prefix_is_whitespace)
						skip_operand();
					else {
						if (check_concat())
							break loop;
						skip_operand();
					}
					break;
				}
			// fall through
			case TokenType.Assign:
				if (op_push(tk))
					break loop;
				break;
			case TokenType.BracketStart:
				if (!(tk = tokens[(t = tk).next_pair_pos!])) {
					stack.length = 0;
					break loop;
				}
				if (!t.symbol && (!t.prefix_is_whitespace || t.content === '[' && t.topofline < 1) &&
					(pre.op_type === 1 || [TokenType.Identifier, TokenType.Number, TokenType.String, TokenType.BracketEnd].includes(pre.type) ||
						pre.type === TokenType.BlockEnd && (tt = tokens[pre.previous_pair_pos!]) && (tt.data ?? tt.in_expr !== undefined))) {
					stack.push({
						content: '', type: TokenType.Invoke,
						paraminfo: t.paraminfo, data: t.content === '('
					} as Token);
				} else if (t.content === '[') {
					stack.push({ symbol: ARRAY } as Token);
				} else {
					if (check_concat())
						break loop;
					stack.push(t);
					if (t.symbol) {
						pre = tk;
						tk = lex.findToken(document.offsetAt(t.symbol!.range.end), true);
						continue;
					}
				}
				pre = tk;
				break;
			case TokenType.BlockStart:
				if (!(tk = tokens[(t = tk).next_pair_pos!])) {
					stack.length = 0;
					break loop;
				}
				stack.push(t);
				break;
			case TokenType.Comment:
			case TokenType.InlineComment:
			case TokenType.BlockComment:
				break;
			case TokenType.Comma:
				stack.length = op_stack.length = 0;
				pre = EMPTY_TOKEN, operand = [0];
				break;
			case TokenType.BlockEnd:
			case TokenType.BracketEnd:
				if (tk.offset === end - 1)
					break loop;
			// fall through
			default:
				stack.length = 0;
				break loop;
		}
		tk = tokens[tk.next_token_offset];
	}
	if (!stack.length)
		return [];
	while ((tk = op_stack.pop()!))
		calculate(tk);
	const result = new Set<AhkSymbol>;
	let syms: Set<AhkSymbol> | AhkSymbol[] = [], that;
	for (tk of stack) {
		if (tk.symbol) {
			if (tk.symbol.kind === SymbolKind.Property) {
				let prop = tk.symbol as Property;
				const cls = prop.parent as ClassNode;
				if ((prop = cls?.property?.[prop.name.toUpperCase()])) {
					if (!prop.get && ((t = prop).kind !== SymbolKind.Property || (t = prop.call)))
						syms = [t];
					else syms = decltypeReturns(prop, lexers[cls.uri!] ?? lex, cls);
				} else syms = [];
			} else syms = [tk.symbol], tk.symbol.uri ??= lex.uri;
		} else switch (tk.type) {
			case TokenType.Invoke: {
				const call = !!tk.data, name = tk.content.toLowerCase();
				syms = decltypeInvoke(lex, syms, name, call, tk.paraminfo, that);
				break;
			}
			case TokenType.Identifier: {
				const pos = document.positionAt(tk.offset);
				const r = findSymbol(lex, tk.content, SymbolKind.Variable, pos);
				if (!r) break;
				syms = new Set;
				const node = r.node;
				if (node.kind === SymbolKind.Variable) {
					if (r.uri !== lex.uri)
						pos.line = NaN;
					for (const n of decltypeVar(node, lexers[r.uri] ?? lex, pos, r.scope, _this))
						syms.add(n);
				} else if (syms.add(node), r.is_this !== undefined) {
					that = _this ?? node as ClassNode;
					if (_this && r.is_this === false)
						(node as ClassNode).prototype = _this.prototype;
					continue;
				}
				break;
			}
			case TokenType.Number:
				syms = [tk.data as AhkSymbol ?? NUMBER];
				break;
			case TokenType.String: syms = [STRING]; break;
			case TokenType.BlockStart:
				if (!(t = tk.data as ClassNode)) break;
				syms = [t], t.uri ??= lex.uri;
				if ((tt = !t.extends && t.property?.BASE)) {
					const tps = decltypeReturns(tt, lex, _this);
					if (tps.length < 2)
						t.base = tps[0];
					else {
						syms = [];
						for (const base of tps)
							syms.push({ ...t, base } as ClassNode);
					}
				}
				break;
			case TokenType.BracketStart: {
				const b = (t = tk.paraminfo?.comma)?.length ? t.at(-1)! : tk.next_token_offset;
				syms = decltypeExpr(lex, tokens[b], tk.next_pair_pos!, _this);
				break;
			}
			default:
				if (tk.content === '||')
					for (const n of syms)
						result.add(n);
				syms = [];
				break;
		}
		that = undefined;
	}
	for (const n of syms)
		result.add(n);
	return [...result];
	function calculate(op: Token) {
		let l = operand.pop(), ret = { content: '', type: TokenType.Number } as Token;
		const rv = stack.splice(l ?? 0);
		if (l === undefined || !rv.length)
			return !(stack.length = 0);
		switch (op.op_type ?? (op.type === TokenType.Assign && 0)) {
			case -1:
				if (op.content === '&' && rv[0]?.offset && rv[0].type === TokenType.Identifier) {
					if (rv.length === 1)
						ret = { symbol: VARREF } as Token;
					else {
						const t = rv.at(-1)!;
						if (t.type !== TokenType.Invoke || t.data)
							return !(stack.length = 0);
						operand.push(stack.length);
						t.content = '__ref', t.data = true;
						stack.push(...rv);
						return;
					}
					break;
				}
			// fall through
			case 1:
				if (rv.length === 1 && rv[0].type === TokenType.Number)
					ret.data = '++--?'.includes(op.content) ? rv[0].data : INTEGER;
				break;
			case 0: {
				const lv = stack.splice((l = operand.pop()) ?? 0);
				let s;
				if (l === undefined || !lv.length)
					return !(stack.length = 0);
				if ((s = op.content) === '.' || s === '.=') {
					ret.type = TokenType.String;
					break;
				}
				if (s === ':=') {
					operand.push(stack.length), stack.push(...rv);
					return;
				} else if (['&&', 'and'].includes(s = s.toLowerCase())) {
					operand.push(stack.length);
					stack.push(...rv);
					return;
				} else if (['||', 'or', '??', '??=', ':'].includes(s)) {
					operand.push(stack.length);
					stack.push(...lv), stack.push({ type: TokenType.Operator, content: '||', op_type: 0 } as Token);
					stack.push(...rv);
					return;
				}
				if (/[<>&|^!~iI]|\/\/|^==?$/.test(s))
					ret.data = INTEGER;
				else if (s === '/' || s === '/=')
					ret.data = FLOAT;
				else if (/[-+*]/.test(s) && lv.length === 1 && rv.length === 1) {
					ret.data = INTEGER;
					for (const v of lv.concat(rv))
						if (v.type !== TokenType.Number) {
							delete ret.data;
						} else if (v.data === FLOAT) {
							ret.data = FLOAT; break;
						}
				}
				break;
			}
			default: return !(stack.length = 0);
		}
		operand.push(stack.length), stack.push(ret);
	}
	function op_push(tk: Token) {
		const p2 = precedence(tk, false);
		let p1 = op_stack.length ? precedence(op_stack[op_stack.length - 1]) : -1;
		while (p2 <= p1) {
			if (calculate(op_stack.pop()!))
				return true;
			p1 = op_stack.length ? precedence(op_stack[op_stack.length - 1]) : -1;
		}
		if (tk.content === '?') {
			if (!tk.ignore)
				stack.splice(operand[operand.length - 1] ?? 0);
		}
		else
			op_stack.push(tk), !tk.op_type && operand.push(stack.length);
		pre = tk;
	}
	function check_concat() {
		if (isYieldsOperand(pre))
			return op_push(pre = { content: '.', type: TokenType.Operator, op_type: 0 } as Token);
	}
	function skip_operand() {
		let lk = tk;
		stack.splice(operand[operand.length - 1]);
		stack.push({ symbol: ANY } as Token);
		do {
			while (tk) {
				if (tk.type === TokenType.Identifier) {
					lk = tk, tk = tokens[tk.next_token_offset];
					if (!tk || tk.content !== '%' || tk.prefix_is_whitespace)
						break;
				} else if (tk.content === '%' && tk.previous_pair_pos === undefined) {
					lk = tokens[tk.next_pair_pos!], tk = tokens[lk?.next_token_offset];
					if (!tk || tk.type !== TokenType.Identifier || tk.prefix_is_whitespace)
						break;
				} else break;
			}
			if (tk && (tk.content === '[' || tk.content === '(' && !tk.prefix_is_whitespace)) {
				lk = tk, tk = tokens[tk.next_pair_pos!];
				if (!tk) break;
				lk = tk, tk = tokens[tk.next_token_offset];
			}
			if (tk?.type === TokenType.Dot && tk.offset < end)
				lk = tk, tk = tokens[tk.next_token_offset];
			else break;
		} while (tk);
		pre = tk = lk;
	}
	function precedence(tk: Token, in_stack = true) {
		if (tk.type === TokenType.Operator) {
			switch (tk.content.toLowerCase()) {
				case '++':
				case '--':
					return tk.op_type === -1 ? 77 : 82;
				case '||':
				case 'or': return 17;
				case '&&':
				case 'and': return 21;
				case 'is': return 28;
				case '>':
				case '<':
				case '>=':
				case '<=': return 34;
				case '=':
				case '==':
				case '!=':
				case '!==': return 30;
				case '~=': return 36;
				case '.': return 38;
				case '|': return 42;
				case '^': return 46;
				case '&': return tk.op_type === -1 ? 67 : 50;
				case '<<':
				case '>>':
				case '<<<': return 54;
				case '//': return 62;
				case '+':
				case '-': return tk.op_type === -1 ? 67 : 58;
				case '*':
				case '/': return 62;
				case '**': return 73;
				case 'not': return 25;
				case '!': return 67;
				case '?': return tk.ignore ? 85 : 11;
				case ':': return 11;
				default: return 0;
			}
		}
		if (tk.type === TokenType.Dot)
			return 86;
		if (tk.type === TokenType.Assign)
			return in_stack ? 7 : 99;
		if (tk.type === TokenType.Comma)
			return 6;
		return 0;
	}
}

export function decltypeInvoke(lex: Lexer, syms: Set<AhkSymbol> | AhkSymbol[], name: string, call: boolean, paraminfo?: ParamInfo, _this?: ClassNode) {
	const tps = new Set<AhkSymbol>, _name = name || (call ? 'call' : '__item');
	let that = _this;
	for (let n of syms) {
		const cls = n as ClassNode;
		that = _this ?? cls;
		switch (n.kind) {
			case 0 as SymbolKind: return [ANY];
			case SymbolKind.Class:
				if (call && _name === 'call') {
					switch (cls.is_builtin && cls.prototype && cls.full) {
						case 'Class':
							if (ahkVersion >= alpha_3 && paraminfo?.end) {
								const tks = lex.tokens, ofs = [paraminfo.offset, ...paraminfo.comma, paraminfo.end], l = Math.min(2, paraminfo.count);
								let tt;
								for (let i = 0; i < l; tt = undefined) {
									tt = decltypeExpr(lex, tks[tks[ofs[i]].next_token_offset], ofs[++i]);
									if ((tt = tt.filter(t => t.kind === SymbolKind.Class)).length)
										break;
								}
								if (tt) {
									const o = {}, c: ClassNode = {
										full: '', extends: '', name: '', kind: SymbolKind.Class,
										range: ZERO_RANGE, selectionRange: ZERO_RANGE, property: {},
									};
									for (const t of tt) {
										const n = { ...c, $property: o };
										n.prototype = { ...c, property: o };
										if (t.full)
											n.extends = n.prototype.extends = t.full;
										else n.base = t, n.prototype.base = (t as ClassNode).prototype;
										tps.add(n);
									}
									continue;
								}
							}
							break;
						case 'ComObject': {
							const tks = lex.tokens, s = [];
							let tk = tks[tks[(paraminfo?.offset)!]?.next_token_offset];
							if (tk?.type === TokenType.String) {
								s.push(tk.content);
								if ((tk = tks[tk.next_token_offset])?.content === ',') {
									tk = tks[tk.next_token_offset];
									if (tk?.type === TokenType.String)
										s.push(tk.content), tk = tks[tk.next_token_offset];
								}
								if (tk?.content === ')') {
									tps.add({
										kind: SymbolKind.Interface, name: 'ComObject',
										full: `ComObject<${s.join(', ')}>`, generic_types: [s],
										range: ZERO_RANGE, selectionRange: ZERO_RANGE
									} as ClassNode);
									continue;
								}
							}
							break;
						}
						case 'Map':
							if (paraminfo?.end) {
								const tks = lex.tokens, ofs = [paraminfo.offset, ...paraminfo.comma, paraminfo.end];
								const l = ofs.length, s = [];
								for (let i = 0; i < l; i += 2) {
									const p = tks[ofs[i + 1]]?.previous_token;
									if (p?.previous_token?.offset === ofs[i] && p.type === TokenType.String)
										s.push(p.content);
								}
								let r = cls.prototype!;
								if (s.length)
									r = { ...r, generic_types: [s] };
								tps.add(r);
								continue;
							}
							break;
					}
					if (!(n = getClassMember(lex, cls, _name, call)!))
						if ((n = invoke_meta_func(cls)!))
							break;
						else continue;
					break;
				}
			// fall through
			case SymbolKind.Function:
			case SymbolKind.Method:
				if (call && _name === 'call') {
					if (!(n as FuncNode).has_this_param || (that = undefined, !paraminfo))
						break;
					for (const that of decltypeExpr(lex, lex.findToken(paraminfo.offset + 1),
						paraminfo.comma[0] ?? paraminfo.end, _this))
						for (const t of decltypeReturns(n, lexers[n.uri!] ?? lex, that as ClassNode))
							tps.add(t);
					continue;
				}
			// fall through
			default:
				if (!(n = getClassMember(lex, cls, _name, call)!))
					if ((n = invoke_meta_func(cls)!))
						break;
					else continue;
				if (n.kind === SymbolKind.Class) {
					if (n.type_annotations) {
						const tt = decltypeTypeAnnotation(n.type_annotations, lex,
							that, cls.type_params);
						for (const t of call ? decltypeInvoke(lex, tt, '', true, paraminfo) : tt)
							tps.add(t);
						continue;
					}
					that = n as ClassNode;
					if (call)
						n = getClassMember(lex, n, 'call', true) ?? n;
				}
				if (n.kind !== SymbolKind.Property) {
					if ((n as FuncNode).eval) {
						// if (paraminfo) continue;
						const tt = decltypeReturns(n, lexers[n.uri!] ?? lex, that);
						for (const t of call ? decltypeInvoke(lex, tt, 'call', true) : tt)
							tps.add(t);
						continue;
					} else if (call) break;
					if (!paraminfo)
						tps.add(n);
					else for (const t of decltypeInvoke(lex, [n], '__item', false, paraminfo, that))
						tps.add(t);
					continue;
				} else if ((n as FuncNode).eval) {
					const tt = decltypeInvoke(lex, decltypeReturns(n, lexers[n.uri!] ?? lex, that), 'call', true);
					for (const t of call ? decltypeInvoke(lex, tt, 'call', true) : tt)
						tps.add(t);
					continue;
				} else if (call || paraminfo && !(n as Property).get?.params.length) {
					for (const t of decltypeInvoke(lex, decltypeReturns(n, lexers[n.uri!] ?? lex, that),
						call ? 'call' : '__item', call, paraminfo))
						tps.add(t);
					continue;
				}
				break;
			case SymbolKind.Module:
				if (name && (n = getClassMember(lex, cls, name, false)!)) {
					let r;
					r = n.kind !== SymbolKind.Variable ? [n] :
						decltypeVar(n, lexers[cls.uri!] ?? lex, n.selectionRange.end);
					if (call)
						r = decltypeInvoke(lexers[cls.uri!] ?? lex, r, '', true, paraminfo);
					for (const t of r)
						tps.add(t);
				}
				continue;
		}
		for (const t of decltypeReturns(n, lexers[n.uri!] ?? lex, that))
			tps.add(t);
	}
	return tps;
	function invoke_meta_func(_this: ClassNode) {
		const n = getClassMember(lex, _this, call ? '__call' : '__get', call);
		if (!n) return;
		if (n.kind === SymbolKind.Method && !(n as FuncNode).eval)
			return n;
		const syms = n.kind === SymbolKind.Class ? [n] : !n.children ?
			decltypeReturns(n, lexers[n.uri!] ?? lex, that) : undefined;
		if (!syms?.length)
			return;
		for (const t of decltypeInvoke(lex, syms, 'call', true, paraminfo))
			tps.add(t);
	}
}

function decltypeByref(sym: Variable, lex: Lexer, types: AhkSymbol[], _this?: ClassNode) {
	const nk = lex.tokens[lex.tokens[lex.document.offsetAt(sym.selectionRange.start)]?.next_token_offset];
	let pi;
	switch (nk?.type) {
		case TokenType.Comma:
			pi = nk.paraminfo;
			if (pi) break;
			return;
		case TokenType.BracketEnd:
			pi = lex.tokens[nk.previous_pair_pos!]?.previous_token?.callsite?.paraminfo;
			if (pi && nk.offset <= pi.end!) break;
			return;
		default:
			if (nk && isContinuousLine(nk.previous_token ?? EMPTY_TOKEN, nk))
				return;
	}
	const res = getCallInfo(lex, sym.selectionRange.start, pi);
	if (!res || res.index < 0)
		return;
	const { pos, index, kind } = res;
	const context = lex.getContext(pos);
	const tps = decltypeExpr(lex, context.token, context.range.end, _this);
	if (!tps.length)
		return;
	if (tps.includes(ANY))
		return [ANY];
	let iscall = true;
	let prop = context.text ? '' : context.word.toLowerCase();
	if (kind === SymbolKind.Property)
		prop ||= '__item', iscall = false;
	else prop ||= 'call';
	for (const it of tps)
		if (resolve(it, prop, types))
			return [ANY];
	types = [...new Set(types)];
	return types.includes(ANY) ? [ANY] : types;
	function resolve(it: AhkSymbol, prop: string, types: AhkSymbol[], needthis = 0) {
		switch (it.kind) {
			case SymbolKind.Method:
				needthis++;
			// fall through
			case SymbolKind.Function:
				if (!iscall || prop !== 'call')
					break;
			// fall through
			case SymbolKind.Property: {
				const param = (it as FuncNode).params?.[index - needthis];
				let annotations;
				if (!param || !(annotations = param.type_annotations))
					break;
				for (const t of annotations) {
					if (t === VARREF)
						return true;
					if ((t as AhkSymbol).data !== VARREF)
						continue;
					types.push(...decltypeTypeAnnotation((t as ClassNode).generic_types?.[0] ?? [], lex,
						_this, getDeclareClass(lex, _this)?.type_params));
				}
				break;
			}
			case SymbolKind.Class: {
				let n = getClassMember(lex, it, prop, iscall);
				const cls = it as ClassNode;
				if (!n)
					break;
				if (iscall) {
					if (n.kind === SymbolKind.Class)
						n = getClassConstructor(n as ClassNode);
					else if ((n as FuncNode).full?.startsWith('(Object) static Call('))
						n = getClassMember(lex, cls.prototype!, '__new', true) ?? n;
					else if (n.kind === SymbolKind.Property || (n as FuncNode).eval) {
						let tps: AhkSymbol[] | Set<AhkSymbol> = decltypeReturns(n, lexers[n.uri!] ?? lex, cls);
						if (n.kind === SymbolKind.Property && (n as FuncNode).eval)
							tps = decltypeInvoke(lex, tps, 'call', true);
						tps.forEach(it => resolve(it, 'call', types, -1));
						return;
					}
					if (n?.kind === SymbolKind.Method)
						resolve(n, 'call', types, -1);
					return;
				} else if (n.kind === SymbolKind.Class)
					n = getClassMember(lex, n, '__item', false);
				else if (n.kind !== SymbolKind.Property)
					return;
				else if (!(n as FuncNode).params) {
					for (let t of decltypeReturns(n, lexers[n.uri!] ?? lex, cls))
						(t = getClassMember(lex, t, '__item', false)!) &&
							resolve(t, '', types);
					return;
				}
				n && resolve(n, '', types);
			}
		}
		return;
	}
}

function decltypeVar(sym: Variable, lex: Lexer, pos: Position, scope?: AhkSymbol, _this?: ClassNode): AhkSymbol[] {
	const name = sym.name.toUpperCase(), _def = sym, syms = sym.type_annotations ? [sym] : [];
	if (!scope)
		for (const uri in lex?.relevance) {
			const v = lexers[uri]?.declaration?.[name];
			v?.type_annotations && (syms.includes(v) || syms.push(v));
		}
	let ts: AhkSymbol[] | undefined, t, ref;
	if (sym.from !== undefined) {
		t = resolveVarAlias(sym);
		if (t.kind !== SymbolKind.Variable)
			return [t];
		t.type_annotations && (syms.includes(t) || syms.push(t));
	}
	for (const sym of syms) {
		if ((t = sym.returns))
			sym.returns = undefined;
		ts = decltypeReturns(sym, lex, _this);
		t && (sym.returns = t);
		if (sym.is_param && sym.pass_by_ref) {
			const tt = new Set<AhkSymbol>;
			for (const t of ts) {
				if (t === VARREF)
					return [ANY];
				if (t.data === VARREF)
					resolveCachedTypes((t as ClassNode).generic_types?.[1] ?? [ANY], tt, lex, _this);
				else tt.add(t);
			}
			ts = [...tt];
		}
		if (ts.includes(ANY) && (ts = [ANY]) || !ts.includes(OBJECT))
			return ts;
		break;
	}
	ts ??= [], t = undefined;
	for (const it of (scope ?? lex).children as Variable[] ?? [])
		if (name === it.name.toUpperCase()) {
			if (it.kind === SymbolKind.Variable) {
				if (it.range.end.line > pos.line || (it.range.end.line === pos.line && it.range.end.character > pos.character))
					break;
				if (it.returns)
					sym = ref = it;
				else if (it.pass_by_ref)
					ref = it;
			} else return [it];
		}
	if (sym.for_index !== undefined) {
		const tps = decltypeReturns(sym.data as AhkSymbol, lex, _this);
		for (const it of tps)
			if (resolve(it))
				return [ANY];
		ts = [...new Set(ts)];
		return ts.includes(ANY) ? [ANY] : ts;
		function resolve(it: AhkSymbol, invoke_enum = true) {
			let needthis = 0, cls: ClassNode | undefined;
			switch (it.kind) {
				case SymbolKind.Class: {
					const bases: ClassNode[] = [];
					if (invoke_enum && (t = getClassMember(lex, it, '__enum', true, bases))) {
						if (t.kind !== SymbolKind.Method)
							break;
						for (const tp of decltypeReturns(t, lexers[t.uri!] ?? lex, it as ClassNode))
							resolve(tp, false);
						break;
					} else if ((t = getClassMember(lex, it, 'call', true, bases))?.kind === SymbolKind.Method)
						needthis = -1, cls = it as ClassNode, it = t!;
					else break;
				}
				// fall through
				case SymbolKind.Method:
					needthis++;
				// fall through
				case SymbolKind.Function: {
					const param = (it as FuncNode).params?.[sym.for_index! - needthis];
					let annotations;
					if (!param || !(annotations = param.type_annotations))
						break;
					for (const t of annotations) {
						if (t === VARREF)
							return true;
						if ((t as AhkSymbol).data !== VARREF)
							continue;
						ts!.push(...decltypeTypeAnnotation((t as ClassNode).generic_types?.[0] ?? [], lex,
							cls, getDeclareClass(lex, cls)?.type_params));
					}
					break;
				}
			}
		}
	}
	if (ref?.pass_by_ref && !ref.is_param) {
		const t = decltypeByref(ref, lex, ts, _this);
		if (t) return t;
	}
	ts.push(...decltypeReturns(sym, lex, _this));
	if (ts.length)
		ts = [...new Set(ts)];
	else if (!sym.assigned)
		ts.push(UNSET);
	return ts.includes(ANY) ? [ANY] : ts;
}

function decltypeTypeAnnotation(annotations: (string | AhkSymbol)[], lex: Lexer, _this?: ClassNode, type_params?: Record<string, AhkSymbol>) {
	const types = new Set<string | AhkSymbol>;
	let is_typeof;
	for (let tp of annotations) {
		if (typeof tp === 'object') {
			types.add(tp);
			continue;
		}
		if ((is_typeof = tp.startsWith('typeof ')))
			tp = tp.substring(7);
		if ('\'"'.includes(tp[0]))
			types.add(STRING);
		else if (/^[-+]?(\d+$|0[xX])/.test(tp))
			types.add(INTEGER);
		else if (/^[-+]?\d+[.eE]/.test(tp))
			types.add(FLOAT);
		else types.add(`${is_typeof ? 'typeof ' : ''}${tp}`);
	}
	const tps = new Set<AhkSymbol>;
	resolveCachedTypes([...types], tps, lex, _this, type_params);
	return [...tps];
}

export function decltypeReturns(sym: AhkSymbol, lex: Lexer, _this?: ClassNode): AhkSymbol[] {
	let types: Set<AhkSymbol> | undefined, ct: Array<string | AhkSymbol> | undefined, is_typeof, has_obj;
	switch (!sym.cached_types) {
		case true: {
			const annotations = sym.type_annotations;
			if (!annotations) break;
			types = new Set;
			for (let tp of annotations) {
				if (typeof tp === 'object') {
					types.add(tp);
					continue;
				}
				if ((is_typeof = tp.startsWith('typeof ')))
					tp = tp.substring(7);
				if ('\'"'.includes(tp[0]))
					types.add(STRING);
				else if (/^[-+]?(\d+$|0[xX])/.test(tp))
					types.add(INTEGER);
				else if (/^[-+]?\d+[.eE]/.test(tp))
					types.add(FLOAT);
				else types.add(`${is_typeof ? 'typeof ' : ''}${tp}` as unknown as AhkSymbol);
			}
			if (types.has(ANY))
				return sym.cached_types = [ANY];
			sym.cached_types = [...types], has_obj = types.has(OBJECT);
		}
		// fall through
		default:
			resolveCachedTypes(ct = sym.cached_types!, types = new Set, lex, _this, _this && (sym.parent as ClassNode)?.type_params);
			if (!has_obj)
				return [...types];
	}

	let tps: AhkSymbol[];
	if (lex && sym.returns) {
		sym.cached_types = [ANY], tps = [], sym.return_void && tps.push(VOID);
		for (let i = 0, r = sym.returns, l = r.length; i < l; i += 2)
			tps.push(...decltypeExpr(lex, lex.findToken(r[i], true), r[i + 1], _this));
		if (types) {
			for (const n of new Set(tps as ClassNode[]))
				if (n.property && !n.name && !types.has(n))
					types.add(n), ct!.push(n);
			tps = [...types], sym.cached_types = ct;
		} else types = new Set(tps), sym.cached_types = tps = [...types];
	} else tps = types ? [...types] : [];
	return tps;
}

export function generateTypeAnnotation(sym: AhkSymbol, lex?: Lexer, _this?: ClassNode) {
	return joinTypes((sym.type_annotations || decltypeReturns(sym, lexers[sym.uri!] ?? lex, _this)));
}

export function joinTypes(tps?: Array<string | AhkSymbol> | false) {
	if (!tps) return '';
	let ts = [...new Set(tps.map(s => typeof s === 'string' ? s : typeNaming(s)))];
	const t = ts.pop();
	if (!t) return '';
	(ts = ts.map(s => s.includes('=>') && !'"\''.includes(s[0]) ? `(${s})` : s)).push(t);
	return ts.join(' | ');
}

function resolveCachedTypes(tps: (string | AhkSymbol)[], resolved_types: Set<AhkSymbol>, lex: Lexer,
	_this?: ClassNode, type_params?: Record<string, AhkSymbol>) {
	let re: RegExp | false, i = -1, is_this, is_typeof, t, param, update;
	for (let tp of tps) {
		if (i++, typeof tp === 'string') {
			(is_typeof = tp.startsWith('typeof ')) && (tp = tp.substring(7));
			if ((param = type_params?.[tp.toUpperCase()]))
				resolveCachedTypes(_this!.generic_types?.[param.data as number] ?? (param.type_annotations || []),
					resolved_types, lex, _this, type_params);
			else if ((t = (is_this = tp === 'this') && _this || findSymbol(Lexer.curr ?? lex, tp)?.node as ClassNode))
				if (t.kind === SymbolKind.TypeParameter)
					update = true, tps[i] = '', tps.push(...decltypeTypeAnnotation(t.type_annotations || [], lex));
				else if (t.kind !== SymbolKind.Variable)
					resolved_types.add(t = !is_typeof && t.prototype || t), !is_this && (tps[i] = t);
		} else if (tp.kind === SymbolKind.TypeParameter)
			update = true, tps[i] = '', tps.push(...decltypeTypeAnnotation(tp.type_annotations || [], lex));
		else
			resolved_types.add(resolve_generic_type(tp as ClassNode));
	}
	if (update)
		tps.push(...new Set(tps.splice(0).filter(Boolean)));

	function resolve_generic_type(cls: ClassNode): AhkSymbol {
		let generic_types = cls.generic_types;
		if (!generic_types)
			return cls;
		re ??= make_re();
		if (!re || !re.test(cls.full))
			return cls;
		generic_types = generic_types.map(gt => gt.flatMap(tp => {
			if (typeof tp === 'object')
				return [resolve_generic_type(tp as ClassNode)];
			if ((param = type_params?.[tp.toUpperCase()]))
				return _this!.generic_types?.[param.data as number] ?? (param.type_annotations || []);
			if (tp === 'this')
				return _this ? [_this.prototype ?? _this] : [];
			if (tp === 'typeof this')
				return _this ? [_this] : [];
			return [tp];
		}));
		if (!generic_types.length)
			generic_types = undefined;
		cls = {
			...cls, generic_types,
			full: cls.full.replace(/<.+/, !generic_types ? '' :
				`<${generic_types.map(t => joinTypes(t)).join(', ')}>`)
		} as ClassNode;
		if (cls.prototype)
			cls.prototype = { ...cls.prototype, generic_types, full: cls.full };
		return cls;
	}

	function make_re() {
		let p = Object.keys(type_params ?? {});
		_this && p.push('this');
		if (!p.length)
			return false;
		return new RegExp(`[< ](${p.join('|')})[,>]`);
	}
}

export function resolveTypeAnnotation(annotation?: string) {
	if (annotation) {
		const lex = new Lexer(TextDocument.create('', 'ahk2', 0, `$:${annotation}`), undefined, -1);
		lex.parseScript();
		return lex.declaration.$?.type_annotations ?? false;
	}
	return false;
}

export function typeNaming(sym: AhkSymbol) {
	let s;
	switch (sym.kind) {
		case SymbolKind.Interface:
			return (sym as ClassNode).full;
		case SymbolKind.Class:
			s = sym as ClassNode;
			if (s.prototype)
				return s.full ? `typeof ${s.full}` : 'Class';
			return s.full || 'Object';
		case SymbolKind.Function: {
			if (sym.name) {
				let s = sym;
				const ps = [sym], names = [sym.name];
				while ((s.parent as FuncNode)?.params)
					ps.push(s = s.parent!), names.push(s.name);
				if (!names.includes('') && s.kind !== SymbolKind.Property) {
					if (s.kind !== SymbolKind.Function)
						names.splice(-1, 1, typeNaming(s));
					return names.reverse().join('~');
				}
			}
			const fn = sym as FuncNode;
			s = fn.full.replace(/^[^()]+/, '');
			if (s.length === fn.param_def_len) {
				if (fn.params.some(param => param.range_offset))
					s = `(${fn.params.map(param => `${param.pass_by_ref ? '&' : ''}${param.name}${param.defaultVal === null || param.range_offset ?
						'?' : param.defaultVal ? ` := ${param.defaultVal}` : param.arr ? '*' : ''}`).join(', ')})`;
				s += ` => ${generateTypeAnnotation(sym) || 'void'}`;
			}
			return s;
		}
		case SymbolKind.String:
		case SymbolKind.Number:
			return (sym.data as string | number ?? sym.name).toString();
		case 0 as SymbolKind:
			return 'Any';
		case SymbolKind.Null:
			return sym.name || 'unset';
		case SymbolKind.Method:
		case SymbolKind.Property:
			if ((s = (sym as FuncNode).full?.match(/^\((.+?)\)/)?.[1]))
				return `${s}${sym.static ? '.' : '#'}${sym.name}`;
		// fall through
		default: return 'unknown';
	}
}
//#endregion

export function findClass(lex: Lexer, name: string, uri?: string) {
	const arr = name.toUpperCase().split('.');
	let n = arr.shift()!;
	let cls = (uri ? lexers[uri]?.declaration[n] : findSymbol(lex, n)?.node) as ClassNode;
	if (!uri && cls?.kind === SymbolKind.Variable)
		cls = resolveVarAlias(cls) as ClassNode;
	if (!cls?.property || cls.def === false)
		return;
	uri ??= cls.uri;
	for (n of arr)
		if (!(cls = getClassOwnProp(lex, cls, n) as ClassNode))
			return;
	return cls.uri ??= uri, cls;
}

const MaybeLocalKind: SymbolKind[] = [SymbolKind.Variable, SymbolKind.Function, SymbolKind.Field];
export function findSymbol(lex: Lexer, fullname: string, kind?: SymbolKind, pos?: Position) {
	const names = fullname.toUpperCase().split(/[.#~]/), l = names.length - 1;
	let name = names.shift()!, notdef = true, uri, t;
	let res = lex.findSymbol(name, kind,
		!l && MaybeLocalKind.includes(kind!) ? pos : undefined);
	if (res === null)
		return;
	const scope = res?.scope;
	if (!res || res.is_global === 1)
		res = find_include_symbol(lex.relevance, name) ?? res;
	else if (res.is_global && res.node.kind === SymbolKind.Variable) {
		t = find_include_symbol(lex.relevance, name);
		if (t && (t.node.kind !== SymbolKind.Variable || t.node.def && !res.node.def))
			res = t;
	}
	if (kind === SymbolKind.Field)
		return res;
	if ((!res || res.node.kind === SymbolKind.Variable && ((notdef = !res.node.def) || res.is_global)) && (t = find_builtin_symbol(name)))
		res = { uri: t.uri!, node: t, is_global: true };
	else if (scope)
		scope.uri ??= lex.uri, res!.scope = scope;
	if (!res)
		return;
	let p = name.length, parent: AhkSymbol | undefined, node: typeof parent = res.node;
	node.uri ??= res.uri;
	for (name of names) {
		switch (fullname[p]) {
			default: return;
			case '#': if (!(node = (node as ClassNode).prototype)) return;
			// fall through
			case '.':
				if (!(node = getClassOwnProp(lex, parent = node as ClassNode, name)))
					return;
				break;
			case '~':
				if (!(node = (parent = node as FuncNode).declaration?.[name]))
					return;
				node.uri ??= parent.uri;
		}
		p += name.length + 1;
	}
	if (l) {
		if (kind === SymbolKind.Method && (t = (node as Property).call))
			t.uri ??= node.uri, node = t;
		res = { node, uri: node.uri!, parent };
	}
	return res;
	function find_builtin_symbol(name: string) {
		if ((t = ahkVars[name]))
			return t;
		for (const uri of [ahkUris.ahk2_h, ahkUris.ahk2])
			if ((t = lexers[uri]?.typedef[name]))
				return t.uri ??= uri, t;
		if (notdef && !l)
			if ((t = lexers[uri = ahkUris.winapi]?.declaration[name]))
				return t.uri ??= uri, t;
	}
	function find_include_symbol(list: Record<string, string>, name: string) {
		if (process.env.BROWSER)
			return;
		let ret, t;
		for (const uri in list) {
			if ((t = (lexers[uri] ?? openAndParse(restorePath(list[uri]), false))?.findSymbol(name, kind)))
				if (t.node.kind !== SymbolKind.Variable)
					return t;
				else if (!ret || t.node.def && !ret.node.def)
					ret = t;
		}
		return ret;
	}
}

export function findSymbols(lex: Lexer, context: Context) {
	const { text, word, range, kind, token, usage } = context;
	let t;
	t = context.symbol;
	if (t?.parent && !t.children) // kind === SymbolKind.Property
		if ((t = getClassMember(lex, t.parent, t.name, t.def === false ? false : null)))
			return [{ node: t, uri: t.uri ?? lex.uri, parent: context.symbol!.parent }];
	if ((t = token.as) !== undefined) {
		if (!t)
			return;
		return [{ node: t = resolveVarAlias(t), uri: t.uri!, }];
	}
	if (text)
		return (t = findSymbol(lex, text, kind, range.end)) && [t];
	const syms = [], ismethod = kind === SymbolKind.Method || usage === USAGE.Write && null;
	const tps = decltypeExpr(lex, token, range.end);
	if (!word && tps.length) {
		for (const node of tps)
			syms.push({ node, uri: node.uri! });
		return syms;
	}
	for (const tp of tps) {
		const is_global = tp.kind === SymbolKind.Module || undefined;
		if ((t = getClassMember(lex, tp, word, ismethod)))
			syms.push({ node: t, uri: t.uri!, is_global, parent: tp });
	}
	if (syms.length)
		return syms;
}

export function getCallInfo(lex: Lexer, position: Position, pi?: ParamInfo) {
	let pos: Position, index: number, kind: SymbolKind, pt: Token | undefined;
	const tokens = lex.tokens, offset = lex.document.offsetAt(position);
	function get(pi: ParamInfo) {
		const tk = tokens[pi.offset];
		pos = lex.document.positionAt(pi.offset);
		if (tk.type === TokenType.Identifier) {
			if (pt && position.line > lex.document.positionAt(pt.offset + pt.length).line && !isContinuousLine(pt, EMPTY_TOKEN))
				return;
			index = offset > pi.offset + tk.content.length ? 0 : -1;
		} else {
			const prev = tk.previous_token ?? EMPTY_TOKEN;
			if (prev.symbol || prev.ignore)
				return null;
			if ((index = 0, tk.content === '[')) {
				if (tk.topofline === 1 || !isYieldsOperand(tk.previous_token!))
					return;
				kind = SymbolKind.Property;
			} else if (tk.prefix_is_whitespace || !isYieldsOperand(prev))
				return;
		}
		if (index !== -1)
			for (const c of pi.comma)
				if (offset > c) ++index; else break;
		kind ??= pi.method ? SymbolKind.Method : SymbolKind.Function;
		return { name: pi.name ?? '', pos, index, kind, count: pi.count };
	}
	if (pi)
		return get(pi);
	let tk: Token | undefined = lex.findToken(offset), nk = pt = tk.previous_token;
	if (offset <= tk.offset && !(tk = nk))
		return;
	if (tk.callsite && offset > tk.offset + tk.length && position.line <= tk.callsite.range.end.line)
		return get(tk.paraminfo!);
	if (tk.topofline > 0)
		return;
	while (tk.topofline <= 0) {
		switch (tk.type) {
			case TokenType.BlockEnd:
				tk = tokens[tk.previous_pair_pos!];
				break;
			case TokenType.BracketEnd:
				tk = tokens[(nk = tk).previous_pair_pos!];
				tk = tk?.previous_token;
				break;
			case TokenType.BracketStart:
			case TokenType.Comma:
				if ((nk = tk, tk.paraminfo))
					return get(tk.paraminfo);
				break;
			case TokenType.Operator:
				if (tk.content === '%' && !tk.next_pair_pos)
					tk = tokens[tk.previous_pair_pos!];
			// fall through
			default: break;
		}
		if (!(tk = tk?.previous_token))
			break;
		if (tk.callsite && tk.paraminfo)
			return get(tk.paraminfo);
	}
}

export function getClassBase(node: AhkSymbol, lex?: Lexer) {
	let iscls = false, uri, base, name: string, cls: ClassNode;
	switch (node.kind) {
		case SymbolKind.Method:
		case SymbolKind.Function: name = 'func'; break;
		case SymbolKind.Number: name = node.name; break;
		case SymbolKind.String: name = 'string'; break;
		case SymbolKind.Module: name = 'any'; break;
		default: if (!(node as ClassNode).property) return;
		// fall through
		case SymbolKind.Class:
			cls = node as ClassNode, base;
			if ((base = cls.base))
				return base;
			iscls = !!cls.prototype, name = cls.extends;
			lex ??= lexers[cls.uri!], uri = cls.extendsuri;
			if (!name) {
				if ((cls.full || cls.name).toLowerCase() === 'any')
					if (iscls)
						iscls = false, name = 'class';
					else return;
				else name = 'object';
			}
			break;
	}
	cls = findClass(lex ?? lexers[ahkUris.ahk2], name, uri)!;
	return iscls ? cls : cls?.prototype;
}

export function getClassConstructor(cls: ClassNode, lex?: Lexer) {
	const fn = getClassMember(lex ??= lexers[cls.uri!], cls, 'call', true) as FuncNode;
	if (fn?.construct !== undefined)
		return getClassMember(lex, cls.prototype!, fn.construct || '__new', true) ?? fn;
	return fn;
}

export function getClassMember(lex: Lexer, node: AhkSymbol, name: string, ismethod: boolean | null, bases?: (ClassNode | null)[]): AhkSymbol | undefined {
	let prop, method, sym, t, i = 0, cls = node as ClassNode;
	name = name.toUpperCase();
	if (node.kind === SymbolKind.Module) {
		for (const m of (t = node as Module).modules ?? [t]) {
			if ((t = m.declaration[name]))
				if (t.kind !== SymbolKind.Variable)
					return t;
				else if (t.decl)
					method ??= t;
				else if ((t as Variable).from !== undefined)
					sym ??= t;
				else if (t.def)
					prop ??= t;
		}
		if ((t = sym ?? method ?? prop))
			return t;
		cls = ahkVars.ANY as ClassNode;
		return (t = cls?.$property?.[name]) && (t.uri ??= cls.uri, t);
	}
	const _bases = bases ??= [];
	while (true) {
		if (i === _bases.length) {
			if (_bases.includes(cls))
				break;
			_bases.push(cls);
		}
		if ((sym = cls.property?.[name])) {
			if (ismethod) { // call
				if (sym.kind === SymbolKind.Method)
					return sym.uri ??= cls.uri, sym;
				if ((t = sym).kind === SymbolKind.Class || (t = (sym as Property).call))
					return t.uri ??= cls.uri, t;
				if (!sym.children)
					prop?.decl || (prop = (sym.uri ??= cls.uri, sym));
				else if ((sym as Property).get)
					method ??= (sym.uri ??= cls.uri, sym);
			} else if (ismethod === null) { // set
				if ((sym as Property).set)
					return sym.uri ??= cls.uri, sym;
				if (!sym.children)
					prop?.decl || (prop = (sym.uri ??= cls.uri, sym));
				else method ??= (sym.uri ??= cls.uri, sym);
			} else if ((sym as Property).get || sym.kind === SymbolKind.Class)
				return sym.uri ??= cls.uri, sym;
			else if (!sym.children)
				prop?.decl || (prop = (sym.uri ??= cls.uri, sym));
			else if (sym.kind === SymbolKind.Method || (sym = (sym as Property).call))
				method ??= (sym.uri ??= cls.uri, sym);
		}

		if ((t = _bases[++i]) === null)
			break;
		if (!(cls = t ?? getClassBase(cls, lex))) {
			_bases.push(null);
			break;
		}
	}
	if (ismethod === false)
		return prop ?? method;
	return method ?? prop;
}

export function getClassMembers(lex: Lexer, node: AhkSymbol, bases?: ClassNode[]): Record<string, AhkSymbol> {
	let cls = node as ClassNode;
	const _bases = bases ?? [], properties = [];
	if (node.kind === SymbolKind.Module) {
		let m = node as Module, t;
		if (!m.modules)
			return Object.fromEntries(Object.entries(m.declaration).filter(t => t[1].def));
		const nv: Record<string, AhkSymbol> = {},
			vv: typeof nv = {}, dd: typeof nv = {}, rr: typeof nv = {}, tt: typeof nv = {};
		for (t of m.modules) {
			for (const [n, s] of Object.entries(t.declaration))
				(s.kind !== SymbolKind.Variable ? nv :
					(s as Variable).from !== undefined ? vv :
						s.decl ? dd : s.def ? rr : tt)[n] ??= s;
		}
		return Object.assign({ ...(ahkVars.ANY as ClassNode)?.$property }, rr, dd, vv, nv);
	}
	while (cls && !_bases.includes(cls))
		_bases.push(cls), properties.push(cls.property), cls = getClassBase(cls, lex) as ClassNode;
	if (!bases) for (let t; (cls = _bases.pop()!); t = cls.checkmember ??= t);
	return Object.assign({}, ...properties.reverse());
}

export function getClassOwnProp(lex: Lexer, cls: ClassNode, name: string) {
	const bases: ClassNode[] = [];
	let t;
	do {
		if ((t = cls.property?.[name]))
			return t.uri ??= cls.uri, t;
	} while ((cls = ((t = cls.extends?.toLowerCase()) && [t, `(${t}) prototype`].includes(cls.full.toLowerCase()) &&
		!bases.includes(cls) && bases.push(cls) ? getClassBase(cls, lex) as ClassNode : undefined)!));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getClassOwnProps(doc: Lexer, node: AhkSymbol) {
	const cls = node as ClassNode;
	if (!cls.extends || cls.extends.toLowerCase() !== cls.full.toLowerCase())
		return cls.property ?? {};
	let ex = findClass(doc, cls.extends, cls.extendsuri);
	!cls.prototype && (ex = ex?.prototype);
	return { ...ex?.property, ...cls.property };
}

function getDeclareClass(lex: Lexer, cls?: ClassNode): ClassNode | undefined {
	if (!cls || cls.children)
		return cls;
	const t = findSymbol(lex, cls.full.replace(/<.+/, ''))?.node as ClassNode;
	if (t?.prototype)
		return t;
}

export function getParamCount(fn: FuncNode) {
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

export function getSymbolDetail(sym: AhkSymbol, lex?: Lexer, remove_re?: RegExp): string | MarkupContent {
	let detail = sym.markdown_detail;
	if (detail === undefined)
		return sym.detail ?? '';
	if (remove_re)
		detail = detail.replace(remove_re, '');
	detail = detail.replace(/\{@link(code|plain)?\b([^{}\n]*)\}/gm, (...m) => {
		let link: string = m[2]?.trim() ?? '', tag = '', name: string | undefined;
		const p = link.search(/[|\s]/);
		if (p !== -1)
			tag = link.substring(p + 1).trim(), link = link.slice(0, p).trim();
		if (lex && (name = link.match(/^(([\w.$#~]|[^\x00-\x7f])+)(\(\))?$/)?.[1])) {
			const n = findSymbol(lex, name, name.includes('.') ?
				link.endsWith(')') ? SymbolKind.Method : SymbolKind.Property :
				link.endsWith(')') ? SymbolKind.Function : SymbolKind.Class);
			if (n && (lex = lexers[n.uri])) {
				const { start: { line, character } } = n.node.selectionRange;
				const encode_params = encodeURIComponent(JSON.stringify([
					URI.parse(lex.document.uri).toJSON(),
					[-1, { selection: { startLineNumber: line + 1, startColumn: character + 1 } }]
				]));
				tag ||= link, link = `command:_workbench.open?${encode_params}`;
			}
		}
		return /^[a-z]+:/.test(link) && (tag ||= link) ? `[${m[1] === 'code' ? `\`${tag}\`` : tag}](${link})` : ` ${link} ${tag} `;
	});
	if (detail)
		return { kind: 'markdown', value: detail };
	return '';
}

//#region library
export let includeCache: Record<string, Record<string, string>> = {};
export let includedCache: Record<string, Record<string, string>> = {};
export function updateIncludeCache() {
	includeCache = {}, includedCache = {};
	for (const lex of Object.values(lexers))
		traverseInclude(lex);
}

export function traverseInclude(lex: Lexer, included?: Record<string, string>) {
	const { uri, fsPath, include, is_virtual, module } = lex;
	let hascache = true, u;
	let cache = includeCache[uri] ??= (hascache = false, { [uri]: fsPath });
	included = ((included ??= includedCache[uri])) ? { ...included } : {};
	if (!is_virtual)
		included[uri] ??= fsPath;
	for (u in include) {
		if (!(u in cache)) {
			Object.assign(includedCache[u] ??= {}, included);
			if (!(lex = lexers[u]))
				continue;
			if (hascache && (u in included)) {
				cache[u] = included[u];
				continue;
			}
			const c = traverseInclude(lex, included);
			if (c[uri]) {
				cache = includeCache[uri] = Object.assign(c, cache);
			} else Object.assign(cache, c);
		} else if (includedCache[u] ??= { ...included }, !(u in included) && (lex = lexers[u]))
			traverseInclude(lex, included);
	}
	for (const n in module) {
		u = `${uri}|${n}`;
		(u in included) || traverseInclude({
			uri: u, fsPath: '', is_virtual, include: module[n].include
		} as Lexer);
	}
	return cache;
}

export function findLibrary(path: string, libdirs: string[], workdir: string = '', check_exists = false) {
	let m: RegExpMatchArray | null, uri = '';
	const raw = path;

	if (path.startsWith('<') && path.endsWith('>')) {
		if (!(path = path.slice(1, -1))) return;
		const search: string[] = [path + '.ahk'];
		if ((m = path.match(/^((\w|[^\x00-\x7f])+)_.*/))) search.push(m[1] + '.ahk');
		for (const dir of libdirs) {
			for (const file of search)
				if (existsSync(path = dir + file)) {
					uri = URI.file(path).toString().toLowerCase();
					return { uri, path: lexers[uri]?.fsPath ?? path, raw };
				}
		}
	} else {
		if (path.indexOf(':') < 0)
			path = resolve(workdir, path);
		else if (path.includes('..'))
			path = resolve(path);
		if (check_exists && !existsSync(path))
			return;
		uri = URI.file(path).toString().toLowerCase();
		return { uri, path: lexers[uri]?.fsPath ?? path, raw };
	}
}

export function resolveImport(lex: Lexer) {
	let imp = lex.import, module;
	const imps = [];
	imp && !imp.alias && imps.push(imp);
	for (const n in (module = lex.module)) {
		imp = module[n].import;
		imp && !imp.alias && imps.push(imp);
	}
	if (!imps.length) return;
	const cache = {};
	imps.forEach(done);
	function done(imp: Import) {
		const mods = imp.mod ??= {}, alias = imp.alias ??= {}, decl: Record<string, Variable> = {};
		for (const i of imp.imp) {
			let n = i.from.toUpperCase();
			const m = mods[n] ??= findDirectiveModule(n, lex, cache) ??
				findFileModule(n, lex, cache) ?? false;
			if (!m) {
				lex.addDiagnostic(diagnostic.modulenotfound(i.from), i.tk.offset, i.tk.length);
				continue;
			}
			for (const v of i.var) {
				let r, t;
				n = v.alias?.toUpperCase() ?? '';
				if (!n) {
					for (const o of m.modules ?? [m])
						if (r = o.export?.[''])
							break;
					r ??= m;
				} else for (const o of m.modules ?? [m]) {
					t = o.declaration[n];
					if (t && (t.kind !== SymbolKind.Variable || (t as Variable).from !== undefined)) {
						r = t; break;
					} else r ??= t;
				}
				v.alias_to = r ?? (r = v, null), decl[n = v.name.toUpperCase()] ??= v;
				if (r !== (t = alias[n] ??= r)) {
					if (r.selectionRange === t.selectionRange) {
						const a = (r as Module).modules, b = (t as Module).modules;
						if (a?.length === b?.length && new Set(a).isSubsetOf(new Set(b)))
							continue;
					}
					v.has_warned ??= lex.diagnostics.push({
						message: diagnostic.conflictserr('import', t instanceof Array ? 'Module' :
							t.kind === SymbolKind.Variable ? 'import variable' : sym_type(t), v.name),
						range: v.selectionRange, relatedInformation: [sym_related_msg(decl[n])]
					});
				}
			}
		}
	}
}

function traverseRelevance(lex: Lexer) {
	const r = Object.keys(lex.getRelevance(undefined, true)), ls: Lexer[] = [];
	let i, l, m, n;
	for (let u of r) {
		if ((i = u.indexOf('|')) !== -1) {
			if (!r.includes(u = u.substring(0, i))) {
				for (n in lexers[u]?.getRelevance(undefined, true))
					r.includes(n) || r.push(n);
			}
			continue;
		}
		for (n in (l = lexers[u])?.module)
			if (!r.includes(i = `${u}|${n}`))
				for (m in includeCache[i])
					r.includes(m) || r.push(m);
		l && ls.push(l);
	}
	return ls;
}

function findIncludeEntry(lex: Lexer) {
	let t = includedCache[lex.uri];
	if (!t) return [lex];
	const uris = Object.keys(t), r = [], result = [];
	let u, mu = '', mn = Infinity, i;
	for (u of uris) {
		i = 0, u = u.replace(/\|.+/, '');
		for (let t in includedCache[u])
			i++, uris.includes(t) || uris.push(t);
		!i ? r.push(u) : i < mn && (mu = u, mn = i);
	}
	!r.length && r.push(mu);
	for (u of r)
		(u = lexers[u]) && result.push(u);
	!result.length && result.push(lex);
	return result;
}

function findMainEntry(lex: Lexer) {
	let ml = lex, mn = Infinity, i, l;
	const lexs = findIncludeEntry(lex), result = [];
	for (l of lexs) {
		if (!(i = l.importedLex?.size))
			result.push(l);
		else {
			i < mn && (ml = l, mn = i);
			for (l of l.importedLex)
				if (!lexs.includes(l))
					for (l of findIncludeEntry(l))
						lexs.includes(l) || lexs.push(l);
		}
	}
	!result.length && result.push(ml);
	return result;
}

function findDirectiveModule(n: string, lex: Lexer, cache: Record<string, Lexer[]>) {
	let mods: Module[] = [], u;
	if (!n) {
		mods.push(...findIncludeEntry(lex));
	} else if (isIdentifier(n)) {
		if (n === 'AHK')
			mods.push(ahkModule);
		else if (n === '__MAIN')
			mods.push(...cache.__MAIN ??= findMainEntry(lex));
		for (u of cache[lex.uri] ??= traverseRelevance(lex))
			(u = u.module?.[n]) && mods.push(u);
	} else return;
	if (mods.length > 1)
		return flatModule(createModules(n, mods));
	return (u = mods.pop()) && flatModule(u);
}

function findFileModule(path: string, lex: Lexer, cache: Record<string, Lexer[]>) {
	if (process.env.BROWSER) return;
	let m;
	m = /:([^\x00-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7f]*)$/.exec(path);
	m && (path = path.substring(0, m.index), m = m[1]);
	if (path[0] === '*') {
		let lex = utils.getRCData?.(path.substring(1))?.lex;
		if (!lex)
			return;
		return m ? findDirectiveModule(m, lex, cache) : flatModule(lex);
	}
	const dirs = a_Vars.$import ? derefVar(a_Vars.$import, undefined, {
		...a_Vars, scriptdir: lex.scriptdir, linefile: lex.scriptdir
	}).split(';') : lex.libdirs.map(s => s.slice(0, -4));
	for (let d of dirs) {
		let f = resolve(d, path), s;
		try {
			s = statSync(d = f);
			if (s.isDirectory())
				s = statSync(d = `${f}\\__Init.ahk`);
			if (!s.isFile())
				throw 0;
		} catch {
			try {
				if (!statSync(d = `${f}.ahk`).isFile())
					continue;
			} catch { continue; }
		}
		let t = lexers[URI.file(d).toString().toLowerCase()];
		if (!t && (t = openAndParse(restorePath(d), false)!)) {
			parseInclude(t, lex.scriptdir);
			traverseInclude(t);
		}
		if (!t) break;
		t !== lex && (t.importedLex ??= new Set).add(lex) && (lex.importLex ??= new Set).add(t);
		return (cache as unknown as Record<string, Module | undefined>)[`${t.uri}|${m}`] ??=
			m ? findDirectiveModule(m, t, cache) : flatModule(t);
	}
}

export function flatModule(mod: Module) {
	if (mod.flat) return mod;
	const mods = mod.modules ?? [mod];
	const set = new Set(mods);
	let t, u;
	t = Object.assign({}, ...mods.map(m => includeCache[`${m.uri!}${m.name && `|${m.name}`}`]));
	for (u in t)
		if ((t = lexers[u]) && !set.has(t))
			set.add(t), mods.push(t);
	if (mods.length > 1 && !mod.modules)
		mod = createModules(mod.name, mods);
	return mod.flat = true, mod;
}

//#endregion

function getModule(uri: string) {
	const i = uri.lastIndexOf('|');
	return i === -1 ? lexers[uri] : lexers[uri.substring(0, i)]?.module?.[uri.substring(i + 1)];
}

export function getAllModules(lex: Lexer, mod?: Module): Module[] {
	let r1: Module[] = [], r2: Module[] = [];
	let i, u, t, mm: Record<string, boolean> = {}, cc = {};
	if (mod) {
		t = findDirectiveModule(mod.name.toUpperCase(), lex, cc) ?? flatModule(mod);
		r1 = t.modules ?? [t];
		(r1 as Lexer[]).sort((a, b) => (b.d ?? 0) - (a.d ?? 0) || (a === mod ? -1 : 0));
	} else {
		let r = lex.relevance, rr = { ...r };
		r2.push(lex);
		for (u in r) {
			if ((i = u.indexOf('|')) !== -1 && !mm[u = u.substring(i + 1)]) {
				mm[u] = true, t = findDirectiveModule(u, lex, cc);
				if (!t) continue;
				for (let o of t.modules ?? [t])
					if (!((u = `${o.uri!}|${o.name.toUpperCase()}`) in rr))
						Object.assign(rr, includeCache[u]);
			}
		}
		delete rr[lex.uri];
		for (u in rr)
			(t = getModule(u)) && ((t as Lexer).d ? r1 : r2).push(t);
	}
	return r1.concat(r2);
}