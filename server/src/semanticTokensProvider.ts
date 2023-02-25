import { CancellationToken, DocumentSymbol, Range, SemanticTokens, SemanticTokensDelta, SemanticTokensDeltaParams, SemanticTokensParams, SemanticTokensRangeParams, SymbolKind } from 'vscode-languageserver';
import { ClassNode, FuncNode, getClassMembers, Lexer, SemanticToken, SemanticTokenModifiers, SemanticTokenTypes, Token } from './Lexer';
import { diagnostic, extsettings, lexers, Variable } from './common';
import { checkParams, globalsymbolcache, symbolProvider } from './symbolProvider';

let curclass: ClassNode | undefined;
let memscache = new Map<ClassNode, { [name: string]: DocumentSymbol }>();

function resolve_sem(tk: Token, doc: Lexer) {
	let l: string, sem: SemanticToken | undefined;
	if (sem = tk.semantic) {
		let pos = tk.pos ?? (tk.pos = doc.document.positionAt(tk.offset)), type = sem.type;
		if (type === SemanticTokenTypes.string) {
			if (tk.ignore) {
				let l = pos.line + 1, data = tk.data as number[];
				for (let i = 0; i < data.length; i++)
					doc.STB.push(l++, 0, data[i], type, 0);
			} else doc.STB.push(pos.line, pos.character, tk.length, type, 0);
		} else {
			if (curclass && (type === SemanticTokenTypes.method || type === SemanticTokenTypes.property) && tk.previous_token?.type === 'TK_DOT'
				|| (curclass = undefined, type === SemanticTokenTypes.class))
				type = resolveSemanticType(tk.content.toLowerCase(), tk, doc);
			if (!tk.ignore || type === SemanticTokenTypes.keyword)
				doc.STB.push(pos.line, pos.character, tk.length, type, sem.modifier ?? 0);
		}
	} else if (curclass && tk.type !== 'TK_DOT' && !tk.type.endsWith('COMMENT'))
		curclass = undefined;
	else if (tk.type === 'TK_WORD' && ['this', 'super'].includes(l = tk.content.toLowerCase()) && tk.previous_token?.type !== 'TK_DOT') {
		let r = doc.searchNode(l, doc.document.positionAt(tk.offset), SymbolKind.Variable);
		if (r && r.ref === false)
			curclass = r.node as ClassNode;
	}
}

export async function semanticTokensOnFull(params: SemanticTokensParams, token: CancellationToken): Promise<SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()];
	if (!doc || token.isCancellationRequested) return { data: [] };
	doc.STB.previousResult(''), curclass = undefined, memscache.clear();
	symbolProvider({ textDocument: params.textDocument });
	Object.values(doc.tokens).forEach(tk => resolve_sem(tk, doc));
	resolve_class_undefined_member(doc), memscache.clear();
	return doc.STB.build();
}

export async function semanticTokensOnDelta(params: SemanticTokensDeltaParams, token: CancellationToken): Promise<SemanticTokensDelta | SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()];
	if (!doc || token.isCancellationRequested) return { data: [] };
	doc.STB.previousResult(''), curclass = undefined, memscache.clear();
	symbolProvider({ textDocument: params.textDocument });
	Object.values(doc.tokens).forEach(tk => resolve_sem(tk, doc));
	resolve_class_undefined_member(doc), memscache.clear();
	return doc.STB.buildEdits();
}

export async function semanticTokensOnRange(params: SemanticTokensRangeParams, token: CancellationToken): Promise<SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()];
	if (!doc || token.isCancellationRequested) return { data: [] };
	let start = doc.document.offsetAt(params.range.start), end = doc.document.offsetAt(params.range.end);
	doc.STB.previousResult(''), curclass = undefined, memscache.clear();
	symbolProvider({ textDocument: params.textDocument });
	for (let tk of Object.values(doc.tokens)) {
		if (tk.offset < start)
			continue;
		if (tk.offset > end)
			break;
		resolve_sem(tk, doc);
	}
	resolve_class_undefined_member(doc), memscache.clear();
	return doc.STB.build();
}

function resolveSemanticType(name: string, tk: Token, doc: Lexer) {
	let sem = tk.semantic as SemanticToken;
	switch (sem.type) {
		case SemanticTokenTypes.class:
			curclass = globalsymbolcache[name] as ClassNode;
			if (curclass?.kind !== SymbolKind.Class)
				curclass = undefined;
			return SemanticTokenTypes.class;
		case SemanticTokenTypes.method:
		case SemanticTokenTypes.property:
			if (curclass && sem.modifier !== 1 << SemanticTokenModifiers.modification) {
				let n = curclass.staticdeclaration[name], kind = n?.kind, temp: { [name: string]: DocumentSymbol };
				if (!n || (n as any).def === false) {
					let t = (temp = memscache.get(curclass) ?? (memscache.set(curclass, temp = getClassMembers(doc, curclass, true)), temp))[name];
					if (t)
						n = t, kind = t.kind;
					else if (sem.type === SemanticTokenTypes.method) {
						if (temp['__call'])
							kind = SymbolKind.Null;
					} else if (temp['__get'])
						kind = SymbolKind.Null;
				}
				switch (kind) {
					case SymbolKind.Method:
						sem.modifier = (sem.modifier || 0) | 1 << SemanticTokenModifiers.readonly | 1 << SemanticTokenModifiers.static;
						if (tk.callinfo) {
							checkParams(doc, n as FuncNode, tk.callinfo);
							if (curclass && n.full?.startsWith('(Object) DefineProp(')) {
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
						curclass = undefined;
						return sem.type = SemanticTokenTypes.method;
					case SymbolKind.Class:
						sem.modifier = (sem.modifier || 0) | 1 << SemanticTokenModifiers.readonly;
						curclass = curclass.staticdeclaration[name] as ClassNode;
						if (tk.callinfo) checkParams(doc, curclass as unknown as FuncNode, tk.callinfo);
						return sem.type = SemanticTokenTypes.class;
					case SymbolKind.Property:
						let t = n.children;
						if (t?.length === 1 && t[0].name === 'get')
							sem.modifier = (sem.modifier || 0) | 1 << SemanticTokenModifiers.readonly | 1 << SemanticTokenModifiers.static;
						curclass = undefined;
						return sem.type = SemanticTokenTypes.property;
					case undefined:
						if (((<any>curclass).checkmember ?? (<any>doc).checkmember) !== false && extsettings.Diagnostics.ClassStaticMemberCheck) {
							let tt = doc.tokens[tk.next_token_offset];
							if (tt?.content === ':=') {
								cls_add_prop(curclass, tk.content, tk.offset);
							} else if ((memscache.get(curclass) as any)?.['#checkmember'] !== false)
								((curclass.undefined ??= {})[tk.content.toLowerCase()] ??= []).push(tk);
								// doc.addDiagnostic(diagnostic.maybehavenotmember(curclass.name, tk.content), tk.offset, tk.length, 2);
						}
				}
			}
		default:
			curclass = undefined;
			return sem.type;
	}

	function cls_add_prop(cls: ClassNode, name: string, offset?: number) {
		let d = lexers[(<any>cls).uri];
		if (d && offset) {
			let rg = Range.create(d.document.positionAt(offset), d.document.positionAt(offset + name.length));
			let p = DocumentSymbol.create(name, undefined, SymbolKind.Property, rg, rg) as Variable;
			p.static = p.def = true, name = name.toLowerCase();
			if (d === doc && d.d < 2)
				cls.children?.push(p), cls.staticdeclaration[name] ??= p;
			else {
				let t = memscache.get(cls);
				if (t)
					t[name] ??= p;
			}
			if (cls.undefined)
				delete cls.undefined[name];
		} else {
			delete cls.undefined;
			if (d && d.d < 2)
				(<any>cls).checkmember = false;
			else {
				let t = memscache.get(cls) as any;
				if (t)
					t['#checkmember'] = false;
			}
		}
	}
}

function resolve_class_undefined_member(doc: Lexer) {
	for (let cls of memscache.keys()) {
		if (cls.undefined) {
			let name = cls.name;
			for (let tks of Object.values(cls.undefined))
				for (let tk of tks)
					doc.addDiagnostic(diagnostic.maybehavenotmember(name, tk.content), tk.offset, tk.length, 2);
			delete cls.undefined;
		}
	}
}