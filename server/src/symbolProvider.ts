import { DiagnosticSeverity, DocumentSymbol, DocumentSymbolParams, Range, SymbolInformation, SymbolKind, WorkspaceSymbolParams } from 'vscode-languageserver';
import { checksamenameerr, ClassNode, CallInfo, FuncNode, FuncScope, Lexer, SemanticToken, SemanticTokenModifiers, SemanticTokenTypes, Token, Variable, getClassMembers, ParamInfo, samenameerr } from './Lexer';
import { diagnostic } from './localize';
import { ahkvars, connection, extsettings, getallahkfiles, inBrowser, lexers, openFile, sendDiagnostics, symbolcache, workspaceFolders } from './common';
import { URI } from 'vscode-uri';
import { TextDocument } from 'vscode-languageserver-textdocument';

export let globalsymbolcache: { [name: string]: DocumentSymbol } = {};

export async function symbolProvider(params: DocumentSymbolParams): Promise<SymbolInformation[]> {
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri];
	if (!doc || (!doc.reflat && symbolcache[uri])) return symbolcache[uri];
	let gvar: any = {}, glo = doc.declaration;
	for (const key in ahkvars)
		gvar[key] = ahkvars[key];
	let list = doc.relevance;
	for (const uri in list) {
		const gg = lexers[uri]?.declaration;
		for (let key in gg)
			if (!gvar[key] || gg[key].kind !== SymbolKind.Variable)
				gvar[key] = gg[key], (<any>gg[key]).uri = uri;
	}
	for (const key in glo) {
		if (!gvar[key] || gvar[key].kind === SymbolKind.Variable || (gvar[key] === ahkvars[key] && glo[key].kind !== SymbolKind.Variable && (gvar[key].kind === SymbolKind.Function || gvar[key].def === false)))
			gvar[key] = glo[key], (<any>glo[key]).uri = uri;
	}
	doc.reflat = false, globalsymbolcache = gvar;
	let rawuri = doc.document.uri;
	symbolcache[uri] = flatTree(doc).map(info => {
		return SymbolInformation.create(info.name, info.kind, info.children ? info.range : info.selectionRange, rawuri,
			info.kind === SymbolKind.Class && (<ClassNode>info).extends ? (<ClassNode>info).extends : undefined);
	});
	if (doc.actived)
		checksamename(doc), setTimeout(sendDiagnostics, 200);
	return symbolcache[uri];

	function flatTree(node: { children?: DocumentSymbol[], funccall?: CallInfo[] }, vars: { [key: string]: DocumentSymbol } = {}, global = false): DocumentSymbol[] {
		const result: DocumentSymbol[] = [], t: DocumentSymbol[] = [];
		let tk: Token;
		vars['isset'] = ahkvars['isset'];
		node.children?.map(info => {
			if (info.children)
				t.push(info);
			if (!info.name)
				return;
			if (info.kind === SymbolKind.Function || info.kind === SymbolKind.Variable || info.kind === SymbolKind.Class) {
				let _l = info.name.toLowerCase();
				if (!vars[_l]) {
					if (info.kind === SymbolKind.Variable && !(<Variable>info).def && gvar[_l]) {
						vars[_l] = gvar[_l];
						if (info === gvar[_l])
							result.push(info);
						converttype(info, gvar[_l] === ahkvars[_l], gvar[_l].kind);
					} else {
						vars[_l] = info, result.push(info);
						if (info.kind !== SymbolKind.Class || !(<any>info).parent)
							converttype(info, ahkvars[_l] && gvar[_l] === ahkvars[_l], gvar[_l]?.kind || info.kind);
					}
				} else if (info.kind === SymbolKind.Variable) {
					if (info !== vars[_l])
						if (vars[_l].kind !== SymbolKind.TypeParameter || vars[_l].selectionRange.start.character !== vars[_l].selectionRange.end.character)
							converttype(info, vars[_l] === ahkvars[_l], vars[_l].kind);
						else if (tk = doc.tokens[doc.document.offsetAt(info.selectionRange.start)]) {
							if (tk.semantic)
								delete tk.semantic;
						}
				} else if (info !== vars[_l])
					result.push(info), vars[_l] = info, converttype(info, info === ahkvars[_l]);
				else if (info === gvar[_l])
					result.push(info), converttype(info, info === ahkvars[_l]);
			} else if (info.kind !== SymbolKind.TypeParameter) {
				result.push(info);
				if ((info.kind === SymbolKind.Method || info.kind === SymbolKind.Property) && info.name.match(/^__(new|init|enum|get|call|set|delete)$/i))
					if (tk = doc.tokens[doc.document.offsetAt(info.selectionRange.start)]) {
						if (tk.semantic)
							delete tk.semantic;
					}
			}
		});
		node.funccall?.map(info => {
			if (info.kind === SymbolKind.Function)
				checkParams(doc, vars[info.name.toLowerCase()] as FuncNode, info);
		});
		t.map(info => {
			if (info.children) {
				let inherit: { [key: string]: DocumentSymbol } = {}, gg = false;
				if (info.kind === SymbolKind.Function || info.kind === SymbolKind.Method || info.kind === SymbolKind.Event) {
					let p = info as FuncNode, ps: any = {}, ll = '', fn_is_static = info.kind === SymbolKind.Function && (<FuncNode>info).static;
					for (const k in p.global)
						inherit[k] = p.global[k];
					(<FuncNode>info).params?.map(it => {
						inherit[ll = it.name.toLowerCase()] = it, ps[ll] = true;
						converttype(it, false, SymbolKind.TypeParameter);
					});
					for (const k in p.local)
						if (k && !ps[k]) {
							let it = p.local[k];
							result.push(it), converttype(it);
							inherit[k] = it;
						}
					if (p.assume === FuncScope.GLOBAL || global) {
						gg = true;
					} else {
						gg = false;
						let kk = (<FuncNode>info).parent, tt = p.declaration;
						if (kk) {
							if (kk.kind === SymbolKind.Property && kk.children?.length && (<FuncNode>kk).parent?.kind === SymbolKind.Class)
								kk = (<FuncNode>kk).parent as DocumentSymbol;
							if (kk.kind === SymbolKind.Class) {
								let rg = Range.create(0, 0, 0, 0);
								inherit['this'] = DocumentSymbol.create('this', undefined, SymbolKind.TypeParameter, rg, rg);
								if ((<ClassNode>kk).extends)
									inherit['super'] = DocumentSymbol.create('super', undefined, SymbolKind.TypeParameter, rg, rg);
							}
							if (kk.kind === SymbolKind.Function || kk.kind === SymbolKind.Method || kk.kind === SymbolKind.Event)
								if (fn_is_static) {
									for (const k in vars)
										if (!inherit[k] && ((<Variable>vars[k]).static || vars[k] === gvar[k]))
											inherit[k] = vars[k];
								} else for (const k in vars)
									if (!inherit[k])
										inherit[k] = vars[k];
						}
						for (const k in tt) {
							if (!k)
								continue;
							if (!inherit[k]) {
								inherit[k] = tt[k], result.push(inherit[k]), converttype(tt[k]);
							} else if (tt[k] !== inherit[k]) {
								if (tt[k].kind !== SymbolKind.Variable || (inherit[k] === gvar[k] && (<Variable>tt[k]).def))
									inherit[k] = tt[k], result.push(tt[k]), converttype(tt[k]);
								else converttype(tt[k], false, inherit[k].kind);
							} else if (!ps[k]) converttype(tt[k]);
						}
					}
				} else if (info.kind === SymbolKind.Class) {
					let rg = Range.create(0, 0, 0, 0);
					inherit['this'] = DocumentSymbol.create('this', undefined, SymbolKind.TypeParameter, rg, rg);
					if ((<ClassNode>info).extends)
						inherit['super'] = DocumentSymbol.create('super', undefined, SymbolKind.TypeParameter, rg, rg);
				}
				result.push(...flatTree(info, inherit, gg));
			}
		});
		return result;
	}
	function checksamename(doc: Lexer) {
		let dec: any = {}, dd: Lexer, lbs: any = {};
		if (doc.d)
			return;
		Object.keys(doc.labels).map(lb => lbs[lb] = true);
		for (const k in ahkvars) {
			let t = ahkvars[k];
			dec[k] = t;
			if (t.kind === SymbolKind.Function || t.name.toLowerCase() === 'struct')
				(<Variable>t).def = false;
		}
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
		t.map(it => {
			if (it.kind === SymbolKind.Class) {
				let l = (<ClassNode>it).extends?.toLowerCase();
				if (l === it.name.toLowerCase())
					err_extends(doc, <ClassNode>it, false);
				else if (l && !checkextendsclassexist(l))
					err_extends(doc, <ClassNode>it);
			}
		});
		for (const uri in doc.relevance) {
			if (dd = lexers[uri])
				for (const it of Object.values(dd.declaration))
					if (it.kind === SymbolKind.Class) {
						let l = (<ClassNode>it).extends?.toLowerCase();
						if (l === it.name.toLowerCase())
							err_extends(dd, <ClassNode>it, false);
						else if (l && !checkextendsclassexist(l))
							err_extends(dd, <ClassNode>it);
					}
		}

		function checkextendsclassexist(name: string) {
			let n = name.toLowerCase().split('.'), l = n.length, c: ClassNode | undefined;
			for (let i = 0; i < l; i++) {
				c = c ? c.staticdeclaration[n[i]] : dec[n[i]];
				if (!c || c.kind !== SymbolKind.Class || (<any>c).def === false)
					return false;
			}
			return true;
		}
		function err_extends(doc: Lexer, it: ClassNode, not_exist = true) {
			let o = doc.document.offsetAt(it.selectionRange.start), tks = doc.tokens, tk: Token;
			tk = tks[tks[o].next_token_offset];
			tk = tks[tk.next_token_offset];
			o = tk.offset;
			let rg: Range = { start: doc.document.positionAt(o), end: doc.document.positionAt(o + it.extends.length) };
			doc.diagnostics.push({ message: not_exist ? diagnostic.unknown("class '" + it.extends) + "'" : diagnostic.unexpected(it.extends), range: rg, severity: DiagnosticSeverity.Error });
		}
	}
	function converttype(it: DocumentSymbol, islib: boolean = false, kind?: number) {
		let tk: Token, stk: SemanticToken | undefined, st: SemanticTokenTypes | undefined, offset: number;
		switch (kind || it.kind) {
			case SymbolKind.TypeParameter:
				if (it.range.start.line === 0 && it.range.start.character === 0)
					return;
				st = SemanticTokenTypes.parameter; break;
			case SymbolKind.Variable:
				st = SemanticTokenTypes.variable; break;
			case SymbolKind.Class:
				st = SemanticTokenTypes.class; break;
			case SymbolKind.Function:
				st = SemanticTokenTypes.function; break;
		}
		if (st !== undefined && (tk = doc.tokens[offset = doc.document.offsetAt(it.selectionRange.start)])) {
			if ((stk = tk.semantic) === undefined) {
				tk.semantic = stk = { type: st };
				if (it.kind === SymbolKind.Variable && (<Variable>it).def && (kind === SymbolKind.Class || kind === SymbolKind.Function))
					doc.addDiagnostic(samenameerr(it, { kind } as DocumentSymbol), offset, it.name.length);
			} else if (kind !== undefined)
				stk.type = st;
			if (st < 3)
				stk.modifier = (stk.modifier || 0) | (1 << SemanticTokenModifiers.readonly) | (islib ? 1 << SemanticTokenModifiers.defaultLibrary : 0);
		}
	}
}

export function checkParams(doc: Lexer, node: FuncNode, info: CallInfo) {
	let paraminfo = info.paraminfo as ParamInfo;
	if (!extsettings.Diagnostics.ParamsCheck || !paraminfo) return;
	if (node && node.kind === SymbolKind.Class) {
		let cl = node as unknown as ClassNode;
		node = (cl.staticdeclaration['call'] ?? cl.declaration['__new']) as FuncNode;
		if (!node && cl.extends) {
			let t = getClassMembers(doc, cl, true);
			if (t['call'] && (<any>t['call']).def !== false)
				node = t['call'] as FuncNode;
			else node = (t['__new'] ?? t['call']) as FuncNode;
		}
	}
	if (!node) return;
	if (node.kind === SymbolKind.Function || node.kind === SymbolKind.Method) {
		let paramcount = node.params.length, isVariadic = false, pc = paraminfo.count, miss: { [index: number]: boolean } = {};
		if (isVariadic = node.full.includes('*')) {
			if (paramcount > 0 && node.params[paramcount - 1].arr)
				paramcount--;
			while (paramcount > 0 && node.params[paramcount - 1].defaultVal !== undefined) --paramcount;
			for (let i = 0; i < paramcount; ++i)
				if (node.params[i].defaultVal === false)
					--paramcount;
			if (pc < paramcount && !paraminfo.unknown)
				doc.diagnostics.push({ message: diagnostic.paramcounterr(paramcount + '+', pc), range: info.range, severity: 1 });
			paraminfo.miss.map(index => {
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
			node.params.map((param, index) => {
				if (index < pc && param.ref && !miss[index]) {
					let o: number, t: Token;
					if (index === 0)
						o = info.offset as number + info.name.length + 1;
					else o = paraminfo.comma[index - 1] + 1;
					if ((t = doc.find_token(o)).content !== '&')
						doc.addDiagnostic(diagnostic.typemaybenot('VarRef'), t.offset, t.length, 2);
				}
			});
		}
	}
}

export async function workspaceSymbolProvider(params: WorkspaceSymbolParams): Promise<SymbolInformation[]> {
	let symbols: SymbolInformation[] = [], n = 0, query = params.query;
	if (!query || !query.match(/^(\w|[^\x00-\x7f])+$/))
		return symbols;
	let reg = new RegExp(query.replace(/(?<=[^A-Z])([A-Z])/g, '.*$1'), 'i');
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
		for (let it of await symbolProvider({ textDocument: { uri } })) {
			if (reg.test(it.name)) {
				symbols.push(it);
				if (++n >= 1000)
					return true;
			}
		}
		return false;
	}
}