import { CancellationToken, DocumentSymbol, Range, SemanticTokens, SemanticTokensParams, SemanticTokensRangeParams } from 'vscode-languageserver';
import {
	ASSIGN_TYPE, AhkSymbol, ClassNode, FuncNode, Lexer, Property, SemanticTokenModifiers,
	SemanticTokenTypes, SymbolKind, TT2STT, Token, TokenType, Variable,
	checkParamInfo, configCache, diagnostic, getClassMember, getClassMembers, lexers, symbolProvider
} from './common';

let resolve = resolveSemantic;
let curclass: ClassNode | undefined;
const memscache = new Map<ClassNode, Record<string, AhkSymbol>>();

function resolveSemantic(tk: Token, lex: Lexer, fully?: boolean) {
	const sem = tk.semantic;
	let t, m, n;
	if (sem) {
		const stb = lex.STB;
		const pos = tk.pos ??= lex.document.positionAt(tk.offset);
		const { type, modifier } = sem;
		switch (type) {
			case SemanticTokenTypes.string:
				curclass = undefined;
				if (tk.ignore) {
					t = pos.line;
					const data = tk.data as number[];
					for (let i = 1; i < data.length; i += 2, t++) {
						(m = data[i]) && stb.push(t, 0, m, SemanticTokenTypes.string, 0);
						fully && (n = data[i - 1]) && stb.push(t, m, n, SemanticTokenTypes.comment, 0);
					}
					break;
				}
			// fall through
			case SemanticTokenTypes.comment:
				if (tk.has_LF) {
					let o;
					n = (m = tk.content).indexOf('\n'), t = pos.line;
					stb.push(t++, pos.character, n, type, 0);
					for (; n > 0; t++) {
						n = m.indexOf('\n', o = n + 1);
						(o = (n > 0 ? n : m.length) - o) && stb.push(t, 0, o, type, 0);
					}
				} else stb.push(pos.line, pos.character, tk.length, type, 0);
				break;
			case SemanticTokenTypes.class:
				curclass = tk.definition as ClassNode;
				stb.push(pos.line, pos.character, tk.length, type, modifier ?? 0);
				break;
			case SemanticTokenTypes.method:
			case SemanticTokenTypes.property:
				stb.push(pos.line, pos.character, tk.length,
					tk.topofline ? type : resolvePropSemanticType(tk, lex),
					sem.modifier ?? 0);
				break;
			default:
				curclass = undefined;
				stb.push(pos.line, pos.character, tk.length, type, modifier ?? 0);
		}
	} else if (tk.type === TokenType.Identifier) {
		if (tk.previous_token?.type !== TokenType.Dot && ['THIS', 'SUPER'].includes(t = tk.content.toUpperCase()) &&
			(t = lex.findSymbol(t, SymbolKind.Variable, lex.document.positionAt(tk.offset)))?.is_this !== undefined) {
			curclass = t!.node as ClassNode;
			tk.callsite && checkParamInfo(lex, t!.node as FuncNode, tk.callsite);
		} else curclass = undefined;
	} else if (curclass && tk.type !== TokenType.Dot && !(tk.type & TokenType.Comment))
		curclass = undefined;
}

function resolveSemanticFully(tk: Token, lex: Lexer) {
	tk.semantic ??= TT2STT[tk.type];
	resolveSemantic(tk, lex, true);
}

export function fullySemanticToken() {
	resolve = resolveSemanticFully;
}

export function semanticTokensOnFull(params: SemanticTokensParams, token?: CancellationToken): SemanticTokens {
	const lex = lexers[params.textDocument.uri.toLowerCase()];
	if (!lex || token?.isCancellationRequested) return { data: [] };
	lex.STB.previousResult(''), curclass = undefined, memscache.clear();
	symbolProvider({ textDocument: params.textDocument }, null);
	Object.values(lex.tokens).forEach(tk => resolve(tk, lex));
	resolveUndefinedProp(lex), memscache.clear();
	lex.sendDiagnostics();
	return lex.STB.build();
}

export function semanticTokensOnRange(params: SemanticTokensRangeParams, token?: CancellationToken): SemanticTokens {
	const lex = lexers[params.textDocument.uri.toLowerCase()];
	if (!lex || token?.isCancellationRequested) return { data: [] };
	const start = lex.document.offsetAt(params.range.start), end = lex.document.offsetAt(params.range.end);
	lex.STB.previousResult(''), curclass = undefined, memscache.clear();
	symbolProvider({ textDocument: params.textDocument }, null);
	for (const tk of Object.values(lex.tokens)) {
		if (tk.offset < start)
			continue;
		if (tk.offset > end)
			break;
		resolve(tk, lex);
	}
	resolveUndefinedProp(lex), memscache.clear();
	return lex.STB.build();
}

interface _Flag {
	'#checkmember'?: boolean
}

function resolvePropSemanticType(tk: Token, lex: Lexer) {
	const sem = tk.semantic!;
	if (curclass && !tk.ignore) {
		const name = tk.content.toUpperCase();
		let n = curclass.property[name], kind = n?.kind, temp: Record<string, AhkSymbol>;
		if (!n || n.def === false) {
			const t = (temp = memscache.get(curclass) ?? (memscache.set(curclass, temp = getClassMembers(lex, curclass)), temp))[name];
			if (t)
				n = t, kind = t.kind;
			else if (sem.type === SemanticTokenTypes.method) {
				if (temp['__CALL'])
					kind = SymbolKind.Null;
			} else if (temp['__GET'])
				kind = SymbolKind.Null;
		}
		switch (kind) {
			case SymbolKind.Method:
				sem.modifier = (sem.modifier ?? 0) | SemanticTokenModifiers.readonly | (n.static ? SemanticTokenModifiers.static : 0);
				if (tk.callsite) {
					if (n.full?.startsWith('(Object) static Call('))
						n = getClassMember(lex, curclass.prototype!, '__new', true) ?? n;
					else if (n.full?.startsWith('(Object) DefineProp(')) {
						let tt = lex.tokens[tk.next_token_offset];
						if (tt?.content === '(')
							tt = lex.tokens[tt.next_token_offset];
						if (tt) {
							if (tt.type === TokenType.String) {
								cls_add_prop(curclass, tt.content.slice(1, -1), tt.offset + 1);
							} else cls_add_prop(curclass, '');
						}
					}
					checkParamInfo(lex, n as FuncNode, tk.callsite);
				}
				curclass = undefined;
				return sem.type = SemanticTokenTypes.method;
			case SymbolKind.Class:
				sem.modifier = (sem.modifier ?? 0) | SemanticTokenModifiers.readonly;
				curclass = n as ClassNode;
				if (tk.callsite) checkParamInfo(lex, n as FuncNode, tk.callsite);
				return sem.type = SemanticTokenTypes.class;
			case SymbolKind.Property: {
				const t = n as Property;
				sem.modifier = (sem.modifier ?? 0) | (n.static ? SemanticTokenModifiers.static : 0) | (!t.set && t.children ? SemanticTokenModifiers.readonly : 0);
				curclass = curclass.range === n.range ? curclass.prototype : undefined;
				return sem.type = SemanticTokenTypes.property;
			}
			case undefined:
				if ((curclass.checkmember ?? lex.checkmember) !== false && configCache.Diagnostics.ClassNonDynamicMemberCheck) {
					const tt = lex.tokens[tk.next_token_offset];
					if (ASSIGN_TYPE.includes(tt?.content)) {
						cls_add_prop(curclass, tk.content, tk.offset);
					} else if ((tk.__ref || tt?.content[0] !== '?' || !tt.ignore && tt.content === '?') &&
						(memscache.get(curclass) as _Flag)?.['#checkmember'] !== false)
						((curclass.undefined ??= {})[name] ??= tk).has_warned ||= tk.__ref;
				}
		}
	}
	curclass = undefined;
	return sem.type;

	function cls_add_prop(cls: ClassNode, name: string, offset?: number) {
		const d = lexers[cls.uri!];
		if (d && offset) {
			if (cls.property[name.toUpperCase()])
				return;
			const rg = Range.create(d.document.positionAt(offset), d.document.positionAt(offset + name.length));
			const p = DocumentSymbol.create(name, undefined, SymbolKind.Property, rg, rg) as Variable;
			p.static = p.def = true, name = name.toUpperCase();
			if (d === lex && d.d < 2)
				cls.children?.push(p), cls.property[name] ??= p;
			else {
				const t = memscache.get(cls);
				if (t)
					t[name] ??= p;
			}
			if (cls.undefined)
				delete cls.undefined[name];
		} else {
			delete cls.undefined;
			if (d && d.d < 2)
				cls.checkmember = false;
			else {
				const t = memscache.get(cls) as _Flag;
				if (t)
					t['#checkmember'] = false;
			}
		}
	}
}

function resolveUndefinedProp(lex: Lexer) {
	for (const cls of memscache.keys()) {
		if (!cls.undefined)
			continue;
		const name = cls.name;
		for (const tk of Object.values(cls.undefined))
			if (!tk.has_warned) {
				tk.has_warned = true;
				lex.addDiagnostic(diagnostic.maybehavenotmember(name, tk.content), tk.offset, tk.length, { severity: 2 });
			}
		delete cls.undefined;
	}
}