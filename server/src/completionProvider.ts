import { existsSync, readdirSync, statSync } from 'fs';
import { basename, relative, resolve } from 'path';
import {
	CancellationToken, CompletionItem, CompletionItemKind,
	CompletionParams, InsertTextFormat, SymbolKind, TextEdit
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import {
	$DIRPATH, $DLLFUNC, $FILEPATH, ANY, AhkSymbol, ClassNode, Context, FuncNode, Maybe, Property, STRING, SemanticTokenTypes, Token, Variable,
	a_vars, ahkuris, ahkvars, allIdentifierChar, completionItemCache,
	completionitem, decltype_expr, dllcalltpe, extsettings, find_class, find_symbols, get_detail,
	generate_fn_comment, get_callinfo, get_class_constructor, get_class_member, get_class_members,
	isBrowser, lexers, libfuncs, make_search_re, sendAhkRequest, utils, winapis
} from './common';

export async function completionProvider(params: CompletionParams, _token: CancellationToken): Promise<Maybe<CompletionItem[]>> {
	let { position, textDocument: { uri } } = params, doc = lexers[uri = uri.toLowerCase()];
	if (!doc || _token.isCancellationRequested) return;
	let items: CompletionItem[] = [], vars: { [key: string]: any } = {}, cpitem = items.pop()!;
	let l: string, path: string, pt: Token | undefined, scope: AhkSymbol | undefined, temp: any;
	let { triggerKind, triggerCharacter } = params.context ?? {};

	//#region /**|
	if (triggerCharacter === '*') {
		let tk = doc.tokens[doc.document.offsetAt(position) - 3];
		if (tk?.type === 'TK_BLOCK_COMMENT') {
			if (!tk.previous_token?.type) {
				items.push({
					label: '/** */', detail: 'File Doc',
					kind: CompletionItemKind.Text,
					insertTextFormat: InsertTextFormat.Snippet,
					textEdit: TextEdit.replace({
						start: doc.document.positionAt(tk.offset),
						end: doc.document.positionAt(tk.offset + tk.length)
					}, [
						'/************************************************************************',
						' * @description ${1:}',
						' * @file $TM_FILENAME',
						' * @author ${2:}',
						' * @date ${3:$CURRENT_YEAR/$CURRENT_MONTH/$CURRENT_DATE}',
						' * @version ${4:0.0.0}',
						' ***********************************************************************/',
						'$0'
					].join('\n'))
				});
			}
			let symbol = is_symbol_comment(tk);
			if (symbol) {
				let fn = symbol as FuncNode;
				items = [{
					label: '/** */', detail: 'JSDoc Comment',
					kind: CompletionItemKind.Snippet,
					insertTextFormat: InsertTextFormat.Snippet,
					textEdit: TextEdit.replace({
						start: doc.document.positionAt(tk.offset),
						end: doc.document.positionAt(tk.offset + tk.length)
					}, '/**\n * $0\n */')
				}];
				if (fn.params)
					items[0].textEdit!.newText = generate_fn_comment(doc, fn);
			}
		}
		return items;
	}
	//#endregion

	//#region ;@| /*@|
	if (triggerCharacter === '@') {
		let tk = doc.findStrOrComment(doc.document.offsetAt(position) - 1);
		if (tk?.type.endsWith('COMMENT')) {
			let is_same_line = doc.document.positionAt(tk.offset).line === position.line;
			let comment_prefix = tk.type === 'TK_BLOCK_COMMENT' ? '/*' : ';';
			return completionItemCache.directive['@'].filter(it => comment_prefix.includes(l = it.data) && (is_same_line || l !== '/'));
		}
		return;
	}
	//#endregion

	let commitCharacters = Object.fromEntries(Object.entries(extsettings.CompletionCommitCharacters ?? {})
		.map((v: any) => (v[1] = (v[1] || undefined)?.split(''), v)));
	let { text, word, token, range, linetext, kind, symbol } = doc.getContext(position, true);
	let list = doc.relevance, { line, character } = position, offset;
	let isexpr = false, expg = make_search_re(word);

	switch (token.type) {
		case 'TK_UNKNOWN':
			if (token.content === '.')
				break;
			if (token.content !== '#')
				return;
		// #|
		case 'TK_SHARP':
			return token.topofline === 1 ? completionItemCache.directive['#'] : [];
		// x|::
		// :|:xxx::
		case 'TK_HOT':
		case 'TK_HOTLINE':
			if (!token.ignore)
				return completionItemCache.key.filter(it => !it.label.toLowerCase().includes('alttab'));
			let o = doc.document.offsetAt(position) - token.offset;
			if (0 < o && o <= text.indexOf(':', 1))
				return completionItemCache.option.hotstring;
			return;
		// #include |
		// ::xxx::|
		// xxx::|
		case '':
		case 'TK_EOF':
			// #include |
			if ((pt = token.previous_token)?.type === 'TK_SHARP') {
				let isdll = false;
				switch (pt!.content.toLowerCase()) {
					case '#dllload': isdll = true;
					case '#include':
					case '#includeagain': {
						if (isBrowser)
							return;
						let l = doc.document.offsetAt(position) - token.offset;
						let pre = (text = token!.content).slice(0, l);
						let paths: string[], c = pre[0], inlib = false, suf = '';
						if ('\'"'.includes(c))
							pre = pre.slice(1);
						else c = '';
						pre = pre.replace(/^\*i[ \t]/i, '');
						if (pre.startsWith('*')) {
							expg = make_search_re(pre.slice(1));
							for (let k in utils.get_RCDATA() ?? {})
								expg.test(k) && add_item(k, CompletionItemKind.File);
							return items;
						}
						if (pre[0] === '<')
							c = '>' + c, pre = pre.slice(1);
						if (/["<>*?|]/.test(pre) || isdll && c.startsWith('>'))
							return;
						pre = pre.replace(/`(.)/g, '$1').replace(/[^\\/]+$/, m => (suf = m, ''));
						if (!c.startsWith('>') && text.includes('%')) {
							if (text.replace(/%[^%]+%/g, m => '\0'.repeat(m.length))[l] === '\0')
								return Object.values(ahkvars).filter(it =>
									it.kind === SymbolKind.Variable && expg.test(it.name))
									.map(convertNodeCompletion);
							let t: any = { ...a_vars, scriptdir: doc.scriptdir, linefile: doc.fsPath };
							pre = pre.replace(/%a_(\w+)%/i, (m0, m1) => {
								let a_ = t[m1.toLowerCase()];
								return typeof a_ === 'string' ? a_ : '\0';
							});
							if (pre.includes('\0'))
								return;
						}
						if (isdll)
							paths = [(temp = doc.dlldir.get(position.line)) ? temp : doc.scriptpath, 'C:\\Windows\\System32'];
						else if (c.startsWith('>'))
							paths = doc.libdirs, inlib = true;
						else {
							let t = doc.scriptpath, l = position.line;
							for (let [k, v] of doc.includedir)
								if (k < l)
									t = v;
								else break;
							paths = [t];
						}
						if (c) {
							if (text.endsWith(c) || text.endsWith('>'))
								c = '';
							else if (c.length === 2 && text.endsWith(c[1]))
								c = c[0];
						}

						let xg = pre.endsWith('/') ? '/' : '\\', ep = make_search_re(suf);
						let extreg = isdll ? /\.(dll|ocx|cpl)$/i : inlib ? /\.ahk$/i : /\.(ahk2?|ah2)$/i;
						let command = { title: 'Trigger Suggest', command: 'editor.action.triggerSuggest' };
						let range = !allIdentifierChar.test(suf) ? {
							start: {
								line: position.line,
								character: position.character - suf.length
							},
							end: position
						} : undefined;
						let set_folder_text = range ? (item: CompletionItem, newText: string) => (item.textEdit = { newText, range }) :
							(item: CompletionItem, newText: string) => item.insertText = newText;
						let set_file_text = range || c ? set_folder_text : (item: CompletionItem, newText: string) => undefined;
						for (let path of paths) {
							if (!existsSync(path = resolve(path, pre) + '\\') || !statSync(path).isDirectory() || vars[path = path.toUpperCase()])
								continue;
							try {
								vars[path] = 1;
								for (let label of readdirSync(path)) {
									try {
										if (statSync(path + label).isDirectory()) {
											if (!ep.test(label))
												continue;
											vars[`${label.toUpperCase()}/`] ??= (
												label = label.replace(/(`|(?<= );)/g, '`$1'),
												set_folder_text(cpitem = { label, command, kind: CompletionItemKind.Folder }, label + xg),
												1
											);
										} else {
											if (!extreg.test(label) || !ep.test(inlib ? label = label.replace(extreg, '') : label))
												continue;
											vars[label.toUpperCase()] ??= (label = label.replace(/(`|(?<= );)/g, '`$1'),
												set_file_text(cpitem = { label, kind: CompletionItemKind.File }, label + c),
												1
											);
										}
										items.push(cpitem);
									} catch { }
								}
							} catch { }
							if (pre.includes(':'))
								break;
						}
						return items;
					}
					default: return;
				}
			} else if (pt?.type !== 'TK_HOTLINE')
				return;
			// ::xxx::|
			if (pt.ignore)
				return (add_texts(), items);
			// xxx::|
			items.push(...completionItemCache.key), kind = SymbolKind.Event;
			break;
		case 'TK_BLOCK_COMMENT':
			add_classes();
			return items;
		case 'TK_COMMENT':
		case 'TK_INLINE_COMMENT': return;
		default:
			if (token.callsite || token.topofline > 0)
				break;
			let tp = ['TK_COMMA', 'TK_DOT', 'TK_EQUALS', 'TK_NUMBER', 'TK_OPERATOR', 'TK_RESERVED', 'TK_STRING', 'TK_WORD'];
			let maxn = token.type === 'TK_STRING' ? 0 : 3, i = 0, t;
			let cs = (pt = token).callsite, tokens = doc.tokens, pi = cs?.paraminfo;
			while (pt = (t = tokens[pt.previous_pair_pos!]) ?? pt.previous_token) {
				if (++i === maxn)
					break;
				if (t) {
					isexpr = true;
					if (pt.topofline > 0 || !(i++, pt = t.previous_token) || pt.topofline > 0) {
						pt = undefined;
						break;
					}
					continue;
				}
				isexpr ||= pt.next_pair_pos !== undefined || tp.includes(pt.type);
				if (pi ??= pt.paraminfo) {
					pt = tokens[pi.offset]?.previous_token, i++, isexpr = true;
					break;
				}
				if ((cs ??= pt.callsite) || pt.topofline > 0)
					break;
			}
			(cs ?? pi) && (pi ??= cs?.paraminfo, isexpr = true);
			if (pt?.type === 'TK_RESERVED') {
				switch (l = pt.content.toLowerCase()) {
					case 'class':
						if (i === 2)
							return [{ label: 'extends', kind: CompletionItemKind.Keyword, preselect: true }];
						if (i === 3 && token.previous_token?.content.toLowerCase() === 'extends')
							i = 1;
						else return;
					case 'catch':
						if (i !== 1) return;
						if (!text) {
							let tk = token, off = doc.document.offsetAt(range.end);
							for (text = token.content; (tk = tokens[tk.next_token_offset!]) && tk.offset < off; text += tk.content);
							if (allIdentifierChar.test(text.replace(/\./g, ''))) {
								for (let it of Object.values(find_class(doc, text)?.property ?? {})) {
									if (it.kind === SymbolKind.Class && !vars[l = it.name.toUpperCase()] && expg.test(l))
										items.push(convertNodeCompletion(it)), vars[l] = true;
								}
							}
							return items;
						}
						add_classes();
						return items;
					case 'break':
					case 'continue':
					case 'goto':
						if (i === 1 && token.type !== 'TK_WORD')
							return;
						scope = doc.searchScopedNode(position);
						let labels = ((scope as FuncNode) ?? doc).labels;
						let offset = doc.document.offsetAt(position), data;
						for (let n in labels) {
							if (!expg.test(n))
								continue;
							for (let it of labels[n]) {
								if (!it.def) break;
								if ((data = it.data) === -1 || data < offset &&
									(!(data = tokens[tokens[data].next_pair_pos!]?.offset) || offset < data)) {
									items.push(convertNodeCompletion(it));
									break;
								}
							}
						}
						if (!scope) {
							for (let u in list) {
								for (let n in labels = lexers[u]?.labels) {
									if (!expg.test(n))
										continue;
									for (let it of labels[n]) {
										if (!it.def) break;
										if (it.data !== -1)
											continue;
										items.push(convertNodeCompletion(it));
										break;
									}
								}
							}
						}
						if (i === 1 || i === 2 && !maxn)
							return items;
						if (maxn)
							for (let it of items)
								it.insertText = `'${it.insertText}'`;
				}
			} else if (!maxn && !token.ignore) {
				let ci = (pi && get_callinfo(doc, position, pi))!;
				if (ci) {
					let kind: CompletionItemKind, command: { title: string, command: string } | undefined;
					let endchar = text.substring(1).endsWith(text[0]) ? '' : text[0];
					let ct: Context | undefined, fn: FuncNode, l: string, index: number, is_builtin: boolean;
					let text2item: (label: string) => CompletionItem = !endchar ? (label) => ({ label, kind, command }) :
						(label) => ({ label, kind, insertText: `${label}${endchar}` });
					let syms = find_symbols(doc, ct = doc.getContext(ci.pos)) ?? [], it;
					let uris = Object.values(ahkuris);
					let bases: ClassNode[] = [], set: AhkSymbol[] = [];
					for (it of syms) {
						fn = it.node as FuncNode;
						if (set.includes(fn)) continue; set.push(fn);
						is_builtin = uris.includes(fn.uri!), index = ci.index, l = fn.name.toLowerCase();
						kind = CompletionItemKind.Value, command = { title: 'cursorRight', command: 'cursorRight' };
						switch (is_builtin && ci.kind) {
							case SymbolKind.Method:
								switch (l) {
									case 'deleteprop': case 'getmethod': case 'getownpropdesc':
									case 'hasownprop': case 'hasmethod': case 'hasprop':
										if (index !== 0 || !it.parent)
											continue;
										let filter = l.endsWith('method') ? (kind: SymbolKind) => kind !== SymbolKind.Method : undefined;
										for (let m of Object.values(get_class_members(doc, it.parent as ClassNode, bases)))
											if (expg.test(m.name) && !filter?.(m.kind))
												add_item(m.name, m.kind === SymbolKind.Method ?
													CompletionItemKind.Method : CompletionItemKind.Property);
										continue;
									case 'bind': case 'call':
										if (![SymbolKind.Function, l === 'call' && SymbolKind.Class].includes(it.parent?.kind as any))
											break;
										syms.push({ node: it.parent!, uri: '' });
										continue;
								}
								break;
							case SymbolKind.Function:
								switch (l) {
									case 'dynacall':
										if (index !== 0)
											continue;
									case 'dllcall':
										if (index === 0) {
											await add_dllexports();
											continue;
										}
										index++;
									case 'comcall':
										if (index > 1 && index % 2 === 0) {
											for (const name of ['cdecl'].concat(dllcalltpe))
												add_item(name, CompletionItemKind.TypeParameter) && (cpitem.commitCharacters = ['*']);
										}
										continue;
									case 'comobject':
										if (index === 0)
											items.push(...(await sendAhkRequest('GetProgID', []) as string[])
												?.filter(s => expg.test(s)).map(text2item) ?? []);
										continue;
									case 'numget':
										if (index === 2 || index === 1)
											index = 0;
										else continue;
									case 'numput':
										if (index % 2 === 0)
											for (const name of dllcalltpe.filter(v => !/str$/i.test(v)))
												add_item(name, CompletionItemKind.TypeParameter);
										continue;
									case 'hotkey':
										if (index < 2)
											items.push(...completionItemCache.key.filter(it => expg.test(it.label)));
										continue;
									case 'objbindmethod': case 'hasmethod':
									case 'objhasownprop': case 'hasprop':
										if (index === 1) {
											let comma = pi!.comma[0];
											if (!comma) continue;
											let filter = l.endsWith('method') ? (kind: SymbolKind) => kind !== SymbolKind.Method : undefined;
											for (let cls of decltype_expr(doc, doc.find_token(pi!.offset + 1, true), comma))
												for (let it of Object.values(get_class_members(doc, cls, bases)))
													if (expg.test(it.name) && !filter?.(it.kind))
														add_item(it.name, it.kind === SymbolKind.Method ?
															CompletionItemKind.Method : CompletionItemKind.Property);
										}
										continue;
								}
						}
						if (fn.kind === SymbolKind.Class) {
							if (ci.kind === SymbolKind.Property)
								fn = get_class_member(lexers[fn.uri!], fn, '__item', false) as FuncNode;
							else fn = get_class_constructor(fn as any) as FuncNode;
						}
						let param = fn?.params?.[index];
						if (!param) continue;
						if (is_builtin) {
							if (param.name === 'Keys') {
								kind = CompletionItemKind.Text, command = undefined;
								l.includes('send') && items.push(text2item('Blind'));
								items.push(...completionItemCache.key.filter(it => expg.test(it.label)));
								continue;
							}
							if (param.name === 'WinTitle') {
								items.push(...completionItemCache.option.ahk_criteria.filter(it => expg.test(it.label)));
								continue;
							}
						}
						await add_annotations(param.type_annotations || []);
					}
					async function add_annotations(annotations: (string | AhkSymbol)[]) {
						for (let s of annotations) {
							switch (s) {
								case $DIRPATH:
									add_paths(true);
									break;
								case $DLLFUNC:
									await add_dllexports();
									break;
								case $FILEPATH:
									add_paths();
									break;
								case STRING:
									kind = CompletionItemKind.Text, command = undefined;
									break;
								default:
									if (typeof s === 'string') {
										if (/['"]/.test(s[0]) && s.endsWith(s[0]) && expg.test(s = s.slice(1, -1)))
											items.push(text2item(s));
										break;
									}
									if (s.data === $FILEPATH) {
										s = (s as ClassNode).generic_types?.[0]?.[0] ?? '';
										if (typeof s === 'string' && /^(['"])\w+(\|\w+)*\1$/.test(s))
											add_paths(false, new RegExp(`[^.\\/]+$(?<!\.(${s.slice(1, -1)}))`, 'i'));
									}
									break;
							}
						}
					}
				}
				!items.length && add_texts();
				return items;
			}
	}

	let right_is_paren = '(['.includes(linetext[range.end.character] || '\0');
	let join_c = extsettings.FormatOptions.brace_style === 0 ? '\n' : ' ';

	// fn|()=>...
	if (symbol) {
		if (!symbol.children && (scope ??= doc.searchScopedNode(position))?.kind === SymbolKind.Class) {
			let cls = scope as ClassNode;
			let metafns = ['__Init()', '__Call(${1:Name}, ${2:Params})', '__Delete()',
				'__Enum(${1:NumberOfVars})', '__Get(${1:Key}, ${2:Params})',
				'__Item[$1]', '__New($1)', '__Set(${1:Key}, ${2:Params}, ${3:Value})'];
			items.push(...completionItemCache.snippet);
			if (token.topofline === 1)
				items.push(completionItemCache.static, {
					label: 'class', insertText: ['class $1', '{\n\t$0\n}'].join(join_c),
					kind: CompletionItemKind.Snippet, insertTextFormat: InsertTextFormat.Snippet
				});
			if (doc.tokens[token.next_token_offset]?.topofline === 0)
				return token.topofline === 1 ? (items.pop(), items) : undefined;
			let is_static = (symbol as Variable).static ?? false;
			if (is_static)
				metafns.splice(0, 1);
			if (token.topofline)
				metafns.forEach(s => {
					let label = s.replace(/[(\[].*$/, '');
					items.push({
						label, kind: CompletionItemKind.Snippet,
						insertTextFormat: InsertTextFormat.Snippet,
						insertText: s + join_c + '{\n\t$0\n}'
					});
				});
			for (let it of Object.values(get_class_members(doc, cls)))
				add_item(it.name, it.kind === SymbolKind.Method ?
					CompletionItemKind.Method : CompletionItemKind.Property);
			return items;
		}
		return;
	}

	if (kind === SymbolKind.Null)
		return;

	// obj.xxx|
	if (kind === SymbolKind.Property || kind === SymbolKind.Method) {
		if (!token.symbol && token.semantic?.type === SemanticTokenTypes.property)
			return;
		let props: { [k: string]: CompletionItem } = {};
		let tps = decltype_expr(doc, token, range.end);
		let is_any = tps.includes(ANY), bases: ClassNode[] = [];
		if (linetext[range.end.character] === '.')
			right_is_paren = '(['.includes(linetext.charAt(range.end.character + word.length + 1) || '\0');
		if (is_any) tps = [];
		for (const node of tps) {
			if (node.kind === SymbolKind.Interface) {
				let params = ((node as ClassNode).generic_types?.[0] as string[])?.map(s => `'"`.includes(s[0]) ? s.slice(1, -1) : s);
				if (!params?.length) continue;
				let result = (await sendAhkRequest('GetDispMember', params) ?? {}) as { [func: string]: number };
				Object.entries(result).forEach(it => expg.test(it[0]) &&
					add_item(it[0], it[1] === 1 ? CompletionItemKind.Method : CompletionItemKind.Property));
				continue;
			}
			let omems = get_class_members(doc, node, bases);
			for (const [k, it] of Object.entries(omems)) {
				if (expg.test(k)) {
					if (!(temp = props[k]))
						items.push(props[k] = convertNodeCompletion(it));
					else if (!temp.detail?.endsWith((it as Variable).full ?? '')) {
						temp.detail = '(...) ' + (temp.insertText = it.name);
						temp.commitCharacters = temp.command = temp.documentation = undefined;
					}
				}
			}
		}
		if (!is_any && (triggerKind !== 1 || word.length < 3))
			return items;
		let objs = new Set([doc.object, lexers[ahkuris.ahk2]?.object, lexers[ahkuris.ahk2_h]?.object]);
		objs.delete(undefined as any);
		for (const uri in list)
			objs.add(lexers[uri].object);
		for (const k in (temp = doc.object.property)) {
			let v = temp[k];
			if (v.length === 1 && !v[0].full && at_edit_pos(v[0]))
				delete temp[k];
		}
		for (const obj of objs) {
			for (const arr of Object.values(obj))
				for (const [k, its] of Object.entries(arr) as [string, Variable[]][])
					if (expg.test(k)) {
						if (!(temp = props[k])) {
							items.push(props[k] = temp = convertNodeCompletion(its[0]));
							if (its.length === 1)
								continue;
						} else if (temp.detail?.endsWith(its[0].full ?? ''))
							continue;
						temp.detail = '(...) ' + temp.label;
						if (temp.insertText?.endsWith(')') && its.some(it => it.kind === SymbolKind.Property))
							temp.insertText = temp.label, temp.kind = CompletionItemKind.Property;
						temp.commitCharacters = temp.command = temp.documentation = undefined;
					}
		}
		return items;
	}

	//#region completion item in a block
	// snippet
	items.push(...completionItemCache.snippet);

	scope ??= doc.searchScopedNode(position);
	// class cls {\nprop {\n|\n}\n}
	if (scope?.children && scope.kind === SymbolKind.Property) {
		if (token.topofline !== 1)
			return;
		return [{ label: 'get', kind: CompletionItemKind.Function }, { label: 'set', kind: CompletionItemKind.Function }]
	}

	// keyword
	let keyword_start_with_uppercase = extsettings.FormatOptions?.keyword_start_with_uppercase;
	let addkeyword = keyword_start_with_uppercase ? function (it: CompletionItem) {
		items.push(it = Object.assign({}, it));
		it.insertText = (it.insertText ?? it.label).replace(/(?<=^(loop\s)?)[a-z]/g, m => m.toUpperCase());
	} : (it: CompletionItem) => items.push(it);
	if (isexpr) {
		for (let it of completionItemCache.keyword) {
			if (it.label === 'break') break;
			expg.test(it.label) && addkeyword(it);
		}
	} else {
		let kind = CompletionItemKind.Snippet, insertTextFormat = InsertTextFormat.Snippet;
		let uppercase = (s: string) => s, remove_indent = uppercase;
		if (keyword_start_with_uppercase)
			uppercase = (s: string) => s.replace(/\b[a-z](?=\w)/g, m => m.toUpperCase());
		if (extsettings.FormatOptions?.switch_case_alignment)
			remove_indent = (s: string) => s.replace(/^\t/gm, '');
		for (let [label, arr] of [
			['switch', ['switch ${1:[SwitchValue, CaseSense]}', remove_indent('{\n\tcase ${2:}:\n\t\t${3:}\n\tdefault:\n\t\t$0\n}')]],
			['trycatch', ['try', '{\n\t$1\n}', 'catch ${2:Error} as ${3:e}', '{\n\t$0\n}']],
			['class', ['class $1', '{\n\t$0\n}']]
		] as [string, string[]][])
			items.push({ label, kind, insertTextFormat, insertText: uppercase(arr.join(join_c)) });
		for (let it of completionItemCache.keyword)
			expg.test(it.label) && addkeyword(it);
	}

	// hotkey
	if (!scope && (temp = linetext.match(/^\s*(((([<>$~*!+#^]*?)(`?;|[a-z]\w+|[\x21-\x3A\x3C-\x7E]|[^\x00-\x7f]))|~?(`?;|[\x21-\x3A\x3C-\x7E]|[a-z]\w+|[^\x00-\x7f])\s*&\s*~?(`?;|[\x21-\x3A\x3C-\x7E]|[a-z]\w+|[^\x00-\x7f]))\s*(\s(up?)?)?)$/i)))
		items = items.concat(temp[8] ? { label: 'Up', kind: CompletionItemKind.Keyword } :
			completionItemCache.key.filter(it => !it.label.toLowerCase().includes('alttab')));

	// built-in vars
	for (const n in ahkvars)
		if (expg.test(n))
			vars[n] = convertNodeCompletion(ahkvars[n]);

	// global vars
	for (let it of Object.values(doc.declaration)) {
		if (expg.test(l = it.name.toUpperCase()) && !at_edit_pos(it) && (!vars[l] || it.kind !== SymbolKind.Variable))
			vars[l] = convertNodeCompletion(it);
	}
	let list_arr = Object.keys(list);
	for (let uri of [doc.d_uri, ...list_arr.map(p => lexers[p]?.d_uri), ...list_arr]) {
		if (!(temp = lexers[uri]?.declaration))
			continue;
		path = lexers[uri].fsPath;
		let all = !!list[uri];
		for (const n in temp) {
			let it = temp[n];
			if (all && expg.test(n) && (!vars[n] || (vars[n].kind === CompletionItemKind.Variable && it.kind !== SymbolKind.Variable)))
				vars[n] = cpitem = convertNodeCompletion(it), cpitem.detail = `${completionitem.include(path)}\n\n${cpitem.detail ?? ''}`;
		}
	}

	// local vars
	if (scope) {
		position = range.end;
		Object.entries(doc.getScopeSymbols(scope)).forEach(([l, it]) => {
			if (expg.test(l) && (it.def !== false || !vars[l] && !at_edit_pos(it)))
				vars[l] = convertNodeCompletion(it);
		});
	}

	// auto-include
	if (extsettings.AutoLibInclude) {
		let exportnum = 0, line = -1, libdirs = doc.libdirs, first_is_comment: boolean | undefined, cm: Token;
		let dir = doc.workspaceFolder, caches: { [path: string]: TextEdit[] } = {};
		dir = (dir ? URI.parse(dir).fsPath : doc.scriptdir).toLowerCase();
		doc.includedir.forEach((v, k) => line = k);
		for (const u in libfuncs) {
			if (!list[u] && (path = libfuncs[u].fsPath) && ((extsettings.AutoLibInclude > 1 && libfuncs[u].islib) ||
				((extsettings.AutoLibInclude & 1) && path.toLowerCase().startsWith(dir)))) {
				for (let it of libfuncs[u]) {
					expg.test(l = it.name) && (vars[l.toUpperCase()] ??= (
						cpitem = convertNodeCompletion(it), exportnum++,
						cpitem.additionalTextEdits = caches[path] ??= autoinclude(path),
						cpitem.detail = `${completionitem.include(path)}\n\n${cpitem.detail ?? ''}`,
						cpitem
					));
				}
				if (exportnum > 300)
					break;
			}
		}
		function autoinclude(path: string) {
			let lp = (path = path.replace(/(\s);/g, '$1`;')).toLowerCase(), i = 0, l = -1;
			let curdir = doc.scriptpath, texts: string[] = [];
			for (const p of libdirs) {
				if (++i, lp.startsWith(p.toLowerCase())) {
					let n = basename(path);
					if (lp.endsWith('.ahk') && !libdirs.slice(0, i - 1).some(p => existsSync(p + n)))
						texts.push(`#Include <${relative(p, path.slice(0, -4))}>`);
					else if (i === 1)
						texts.push(`#Include %A_MyDocuments%\\AutoHotkey\\Lib\\${n}`);
					else if (i === 2)
						texts.push(`#Include %A_AhkPath%\\..\\Lib\\${n}`);
					else texts.push(`#Include %A_ScriptDir%\\Lib\\${n}`);
				}
			}
			doc.includedir.forEach((v, k) => {
				if (lp.startsWith(v.toLowerCase() + '\\')) {
					if (v.length >= curdir.length)
						l = k, curdir = v;
				} else if (!curdir)
					l = k;
			});
			l === -1 && (l = line);
			if (curdir.charAt(0) === lp.charAt(0))
				texts.push(`#Include ${relative(curdir, path)}`);
			let pos = { line: doc.document.lineCount, character: 0 }, text = `#Include ${path}`, t;
			texts.forEach(t => t.length < text.length && (text = t)), text = '\n' + text;
			if (l !== -1) {
				t = doc.document.getText({ start: { line: l, character: 0 }, end: { line: l + 1, character: 0 } });
				pos = { line: l, character: t.length };
			} else if (position.line === pos.line - 1) {
				if (first_is_comment ??= (cm = doc.find_token(0))?.type.endsWith('COMMENT') && !is_symbol_comment(cm))
					pos = doc.document.positionAt(cm.offset + cm.length), text = '\n' + text;
				else pos.line = 0, text = text.trimLeft() + '\n';
			}
			return [TextEdit.insert(pos, text)];
		}
	}

	if ((list_arr.unshift(doc.uri), !list_arr.includes(ahkuris.winapi)) && list_arr.some(u => lexers[u]?.include[ahkuris.winapi]))
		for (const n in temp = lexers[ahkuris.winapi]?.declaration)
			expg.test(n) && (vars[n] ??= convertNodeCompletion(temp[n]));

	// constant
	if (!isexpr && kind !== SymbolKind.Event) {
		if (triggerKind === 1 && text.length > 2 && text.includes('_') || /[A-Z]{2,}/.test(text))
			for (const it of completionItemCache.constant)
				expg.test(it.label) && items.push(it);
	}
	return items.concat(Object.values(vars));
	//#endregion

	//#region utils
	function is_symbol_comment(tk: Token) {
		if (tk.symbol)
			return tk.symbol;
		let nk = doc.tokens[tk.next_token_offset], t;
		if (nk && (((t = nk.symbol)?.detail ?? (t = doc.tokens[nk.next_token_offset]?.symbol)?.detail) !== undefined))
			return t;
	}
	function add_classes() {
		let decls = [ahkvars, doc.declaration], t;
		for (const uri in list)
			(t = lexers[uri]) && decls.push(t.declaration);
		for (const decl of decls)
			for (const cl in decl)
				if ((t = decl[cl]).kind === SymbolKind.Class && expg.test(cl))
					vars[cl] ??= items.push(convertNodeCompletion(t));
	}
	function add_paths(only_folder = false, ext_re?: RegExp) {
		if (isBrowser)
			return;
		offset ??= doc.document.offsetAt(position);
		let path = token.content.substring(1, offset - token.offset), suf = '';
		if (!/^\w:[\\/]/.test(path) || /[*?"<>|\t]/.test(path))
			return;
		path = path.replace(/`(.)/g, '$1').replace(/[^\\/]+$/, m => (suf = m, ''));
		try {
			if (!existsSync(path) || !statSync(path).isDirectory())
				return;
		} catch { return; };

		let slash = path.endsWith('/') ? '/' : '\\', re = make_search_re(suf);
		let command = { title: 'Trigger Suggest', command: 'editor.action.triggerSuggest' };
		let range = !allIdentifierChar.test(suf) ? {
			start: {
				line: position.line,
				character: position.character - suf.length
			},
			end: position
		} : undefined;
		let set_folder_text = range ? (item: CompletionItem, newText: string) => (item.textEdit = { newText, range }) :
			(item: CompletionItem, newText: string) => item.insertText = newText;
		try {
			for (let label of readdirSync(path)) {
				if (!re.test(label))
					continue;
				try {
					if (statSync(path + label).isDirectory()) {
						label = label.replace(/(`|(?<= );)/g, '`$1');
						set_folder_text(cpitem = { label, command, kind: CompletionItemKind.Folder }, label + slash);
					} else if (only_folder || ext_re?.test(label))
						continue;
					else {
						label = label.replace(/(`|(?<= );)/g, '`$1');
						cpitem = { label, kind: CompletionItemKind.File };
						if (range)
							cpitem.textEdit = { range, newText: label };
					}
					items.push(cpitem);
				} catch { }
			}
		} catch { }
	}
	async function add_dllexports() {
		if (isBrowser)
			return;
		offset ??= doc.document.offsetAt(position);
		let pre = token.content.substring(1, offset - token.offset), suf = '';
		let docs = [doc], ls: any = {}, t;
		for (let u in list)
			(t = lexers[u]) && docs.push(t);
		pre = pre.replace(/`(.)/g, '$1').replace(/[^\\/]+$/, m => (suf = m, ''));
		let expg = make_search_re(suf), kind = CompletionItemKind.Function;
		let range = !allIdentifierChar.test(suf) ? {
			start: {
				line: position.line,
				character: position.character - suf.length
			},
			end: position
		} : undefined;
		let file2item = (label: string) => {
			label = label.replace(/(`|(?<= );)/g, '`$1');
			cpitem = { label, kind: CompletionItemKind.File };
			if (range) cpitem.textEdit = { range, newText: `${label}\\` };
			else cpitem.insertText = `${label}\\`;
			return cpitem;
		}
		if (!pre) {
			docs.forEach(d => d.dllpaths.forEach(file =>
				expg.test(file = file.replace(/^.*[\\/]/, '')) &&
				(ls[file.toUpperCase()] ??= items.push(file2item(file.replace(/\.dll$/i, ''))))));
			try {
				for (let file of readdirSync('C:\\Windows\\System32'))
					/\.(dll|ocx|cpl)$/i.test(file) && expg.test(file) &&
						(ls[file.toUpperCase()] ??= items.push(file2item(file.replace(/\.dll$/i, ''))));
			} catch { }
			for (let label of winapis)
				expg.test(label) && items.push({ label, kind });
		} else {
			add_paths(false, /[^.\\/]+$(?<!\.(dll|ocx|cpl))/i);
			if (pre.endsWith('/') || pre.endsWith(':\\'))
				return;
			let dlls = new Set<string>, onlyfile = true;
			let l = pre.slice(0, -1).replace(/\\/g, '/').toLowerCase();
			if (!/\.\w+$/.test(l))
				l += '.dll';
			if (l.includes(':'))
				dlls.add(l);
			else if (l.includes('/'))
				dlls.add(doc.scriptpath + (l.startsWith('/') ? l : `/${l}`));
			else {
				l = `/${l}`;
				docs.forEach(d => d.dllpaths.forEach(path => {
					if ((path = path.toLowerCase()).endsWith(l))
						dlls.add(path), onlyfile = false;
				}));
				if (onlyfile) {
					dlls.add(l.substring(1));
					docs.forEach(d => dlls.add(d.scriptpath + l));
				}
			}
			for (let label of await utils.get_DllExport(dlls, true))
				expg.test(label) && items.push({ label, kind });
		}
	}
	function add_texts() {
		for (let it of completionItemCache.text) {
			if (expg.test(it.label))
				vars[it.label.toUpperCase()] = true, items.push(it);
		}
		for (const t in (temp = doc.texts))
			expg.test(t) && add_item(temp[t], CompletionItemKind.Text);
		for (const u in list)
			for (const t in (temp = lexers[u]?.texts))
				expg.test(t) && add_item(temp[t], CompletionItemKind.Text);
	}
	function add_item(label: string, kind: CompletionItemKind) {
		if (vars[l = label.toUpperCase()])
			return false;
		items.push(cpitem = { label, kind });
		return vars[l] = true;
	};
	function at_edit_pos(it: AhkSymbol) {
		return it.selectionRange.end.line === line && character === it.selectionRange.end.character;
	}
	function convertNodeCompletion(info: AhkSymbol): CompletionItem {
		let ci = CompletionItem.create(info.name);
		switch (info.kind) {
			case SymbolKind.Function:
			case SymbolKind.Method:
				ci.kind = info.kind === SymbolKind.Method ? CompletionItemKind.Method : CompletionItemKind.Function;
				if (extsettings.CompleteFunctionParens) {
					let fn = info as FuncNode;
					if (right_is_paren)
						ci.command = { title: 'cursorRight', command: 'cursorRight' };
					else if (fn.params.length) {
						ci.command = { title: 'Trigger Parameter Hints', command: 'editor.action.triggerParameterHints' };
						if (fn.params[0].name.includes('|')) {
							ci.insertText = ci.label + '(${1|' + fn.params[0].name.replace(/\|/g, ',') + '|})';
							ci.insertTextFormat = InsertTextFormat.Snippet;
						} else ci.insertText = ci.label + '($0)', ci.insertTextFormat = InsertTextFormat.Snippet;
					} else ci.insertText = ci.label + '()';
				} else
					ci.commitCharacters = commitCharacters.Function;
				ci.detail = info.full;
				break;
			case SymbolKind.Variable:
				ci.kind = CompletionItemKind.Variable;
				if (!info.range.end.character) {
					ci.detail = info.detail;
					return ci;
				}
				break;
			case SymbolKind.Class:
				ci.kind = CompletionItemKind.Class, ci.commitCharacters = commitCharacters.Class;
				ci.detail = 'class ' + (info.full || ci.label); break;
			case SymbolKind.Event:
				ci.kind = CompletionItemKind.Event;
				return ci;
			case SymbolKind.Field:
				ci.kind = CompletionItemKind.Field, ci.label = ci.insertText = ci.label.slice(0, -1);
				return ci;
			case SymbolKind.Property:
				ci.kind = CompletionItemKind.Property, ci.detail = info.full || ci.label;
				let prop = info as Property;
				if (!prop.call && prop.get?.params.length)
					ci.insertTextFormat = InsertTextFormat.Snippet, ci.insertText = ci.label + '[$0]';
				break;
			default:
				ci.kind = CompletionItemKind.Text;
				return ci;
		}
		if (info.tags)
			ci.tags = info.tags;
		let value = get_detail(info, doc);
		if (value)
			ci.documentation = value;
		return ci;
	}
	//#endregion
}