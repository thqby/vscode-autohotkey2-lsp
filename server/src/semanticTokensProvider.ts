import { CancellationToken, DocumentSymbol, Range, SemanticTokens, SemanticTokensParams, SemanticTokensRangeParams, SymbolKind } from 'vscode-languageserver';
import {
	ASSIGN_TYPE, AhkSymbol, ClassNode, FuncNode, Lexer, SemanticToken, SemanticTokenModifiers, SemanticTokenTypes, Token, Variable,
	checkParams, diagnostic, ahkppConfig, get_class_member, get_class_members, globalsymbolcache, lexers, symbolProvider
} from './common';

let curclass: ClassNode | undefined;
const memscache = new Map<ClassNode, { [name: string]: AhkSymbol }>();

function resolve_sem(tk: Token, doc: Lexer) {
	const sem = tk.semantic;
	let l: string;
	if (sem) {
		const pos = tk.pos ?? (tk.pos = doc.document.positionAt(tk.offset));
		let type = sem.type;
		if (type === SemanticTokenTypes.string) {
			if (tk.ignore) {
				let l = pos.line + 1;
				const data = tk.data as number[];
				for (let i = 0; i < data.length; i++)
					doc.STB.push(l++, 0, data[i], type, 0);
			} else doc.STB.push(pos.line, pos.character, tk.length, type, 0);
		} else {
			if (curclass && (type === SemanticTokenTypes.method || type === SemanticTokenTypes.property) && tk.previous_token?.type === 'TK_DOT'
				|| (curclass = undefined, type === SemanticTokenTypes.class))
				type = resolveSemanticType(tk.content.toUpperCase(), tk, doc);
			doc.STB.push(pos.line, pos.character, tk.length, type, (sem.modifier ?? 0) | ((tk.definition as Variable)?.static === true) as unknown as number);
		}
	} else if (curclass && tk.type !== 'TK_DOT' && !tk.type.endsWith('COMMENT'))
		curclass = undefined;
	else if (tk.type === 'TK_WORD' && ['THIS', 'SUPER'].includes(l = tk.content.toUpperCase()) && tk.previous_token?.type !== 'TK_DOT') {
		const r = doc.findSymbol(l, SymbolKind.Variable, doc.document.positionAt(tk.offset));
		if (r?.is_this !== undefined)
			curclass = r.node as ClassNode;
	}
}

export function semanticTokensOnFull(params: SemanticTokensParams, token?: CancellationToken): SemanticTokens {
	const doc = lexers[params.textDocument.uri.toLowerCase()];
	if (!doc || token?.isCancellationRequested) return { data: [] };
	doc.STB.previousResult(''), curclass = undefined, memscache.clear();
	symbolProvider({ textDocument: params.textDocument }, null);
	Object.values(doc.tokens).forEach(tk => resolve_sem(tk, doc));
	resolve_class_undefined_member(doc), memscache.clear();
	doc.sendDiagnostics();
	return doc.STB.build();
}

export function semanticTokensOnRange(params: SemanticTokensRangeParams, token?: CancellationToken): SemanticTokens {
	const doc = lexers[params.textDocument.uri.toLowerCase()];
	if (!doc || token?.isCancellationRequested) return { data: [] };
	const start = doc.document.offsetAt(params.range.start), end = doc.document.offsetAt(params.range.end);
	doc.STB.previousResult(''), curclass = undefined, memscache.clear();
	symbolProvider({ textDocument: params.textDocument }, null);
	for (const tk of Object.values(doc.tokens)) {
		if (tk.offset < start)
			continue;
		if (tk.offset > end)
			break;
		resolve_sem(tk, doc);
	}
	resolve_class_undefined_member(doc), memscache.clear();
	return doc.STB.build();
}

interface _Flag {
	'#checkmember'?: boolean
}

function resolveSemanticType(name: string, tk: Token, doc: Lexer) {
	const sem = tk.semantic as SemanticToken;
	switch (sem.type) {
		case SemanticTokenTypes.class:
			curclass = globalsymbolcache[name] as ClassNode;
			if (curclass?.kind !== SymbolKind.Class)
				curclass = undefined;
			return SemanticTokenTypes.class;
		case SemanticTokenTypes.method:
		case SemanticTokenTypes.property:
			if (curclass && !tk.ignore) {
				let n = curclass.property[name], kind = n?.kind, temp: { [name: string]: AhkSymbol };
				if (!n || n.def === false) {
					const t = (temp = memscache.get(curclass) ?? (memscache.set(curclass, temp = get_class_members(doc, curclass)), temp))[name];
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
						sem.modifier = (sem.modifier ?? 0) | SemanticTokenModifiers.readonly | SemanticTokenModifiers.static;
						if (tk.callsite) {
							if (curclass) {
								if (n.full?.startsWith('(Object) static Call('))
									n = get_class_member(doc, curclass.prototype!, '__new', true) ?? n;
								else if (n.full?.startsWith('(Object) DefineProp(')) {
									let tt = doc.tokens[tk.next_token_offset];
									if (tt?.content === '(')
										tt = doc.tokens[tt.next_token_offset];
									if (tt) {
										if (tt.type === 'TK_STRING') {
											cls_add_prop(curclass, tt.content.slice(1, -1), tt.offset + 1);
										} else cls_add_prop(curclass, '');
									}
								}
							}
							checkParams(doc, n as FuncNode, tk.callsite);
						}
						curclass = undefined;
						return sem.type = SemanticTokenTypes.method;
					case SymbolKind.Class:
						sem.modifier = (sem.modifier ?? 0) | SemanticTokenModifiers.readonly;
						curclass = curclass.property[name] as ClassNode;
						if (tk.callsite) checkParams(doc, curclass as unknown as FuncNode, tk.callsite);
						return sem.type = SemanticTokenTypes.class;
					case SymbolKind.Property: {
						const t = n.children;
						if (t?.length === 1 && t[0].name.toLowerCase() === 'get')
							sem.modifier = (sem.modifier ?? 0) | SemanticTokenModifiers.readonly | SemanticTokenModifiers.static;
						curclass = curclass.range === n.range ? curclass.prototype : undefined;
						return sem.type = SemanticTokenTypes.property;
					}
					case undefined:
						if ((curclass.checkmember ?? doc.checkmember) !== false && ahkppConfig.v2.diagnostics.classNonDynamicMemberCheck) {
							const tt = doc.tokens[tk.next_token_offset];
							if (ASSIGN_TYPE.includes(tt?.content)) {
								cls_add_prop(curclass, tk.content, tk.offset);
							} else if ((memscache.get(curclass) as _Flag)?.['#checkmember'] !== false)
								((curclass.undefined ??= {})[tk.content.toUpperCase()] ??= []).push(tk);
						}
				}
			}
		// fallthrough
		default:
			curclass = undefined;
			return sem.type;
	}

	function cls_add_prop(cls: ClassNode, name: string, offset?: number) {
		const d = lexers[cls.uri!];
		if (d && offset) {
			if (cls.property[name.toUpperCase()])
				return;
			const rg = Range.create(d.document.positionAt(offset), d.document.positionAt(offset + name.length));
			const p = DocumentSymbol.create(name, undefined, SymbolKind.Property, rg, rg) as Variable;
			p.static = p.def = true, name = name.toUpperCase();
			if (d === doc && d.d < 2)
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

function resolve_class_undefined_member(doc: Lexer) {
	for (const cls of memscache.keys()) {
		if (cls.undefined) {
			const name = cls.name;
			for (const tks of Object.values(cls.undefined))
				for (const tk of tks)
					doc.addDiagnostic(diagnostic.maybehavenotmember(name, tk.content), tk.offset, tk.length, 2);
			delete cls.undefined;
		}
	}
}