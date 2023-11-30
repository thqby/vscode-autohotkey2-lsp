import { basename, resolve, relative } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';
import { CancellationToken, CompletionItem, CompletionItemKind, CompletionParams, DocumentSymbol, InsertTextFormat, SymbolKind, TextEdit } from 'vscode-languageserver';
import { allIdentifierChar, ClassNode, reset_detect_cache, detectExpType, FuncNode, getClassMembers, getFuncCallInfo, searchNode, Token, Variable, find_class, formatMarkdowndetail } from './Lexer';
import { completionitem } from './localize';
import { ahkuris, ahkvars, completionItemCache, dllcalltpe, extsettings, generate_fn_comment, isBrowser, lexers, libfuncs, make_search_re, Maybe, a_vars, sendAhkRequest, utils, winapis, Lexer } from './common';
import { URI } from 'vscode-uri';

export async function completionProvider(params: CompletionParams, _token: CancellationToken): Promise<Maybe<CompletionItem[]>> {
	let { position, textDocument: { uri } } = params, doc = lexers[uri = uri.toLowerCase()];
	if (!doc || _token.isCancellationRequested) return;
	let items: CompletionItem[] = [], vars: { [key: string]: any } = {}, cpitem = items.pop()!;
	let l: string, path: string, pt: Token | undefined, scope: DocumentSymbol | undefined, temp: any;
	let { triggerKind, triggerCharacter } = params.context ?? {};

	// /**|
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
					kind: CompletionItemKind.Text,
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

	// ;@| /*@|
	if (triggerCharacter === '@') {
		let tk = doc.find_str_cmm(doc.document.offsetAt(position) - 1);
		if (tk?.type.endsWith('COMMENT')) {
			let is_same_line = doc.document.positionAt(tk.offset).line === position.line;
			let comment_prefix = tk.type === 'TK_BLOCK_COMMENT' ? '/*' : ';';
			return completionItemCache.directive['@'].filter(it => comment_prefix.includes(l = it.data) && (is_same_line || l !== '/'));
		}
		return;
	}

	let commitCharacters = Object.fromEntries(Object.entries(extsettings.CompletionCommitCharacters ?? {})
		.map((v: any) => (v[1] = (v[1] || undefined)?.split(''), v)));
	let { text, word, token, range, linetext, kind, symbol } = doc.buildContext(position, true);
	let list = doc.relevance, { line, character } = position;
	let isexpr = false, expg = make_search_re(word);

	if (!token?.type || token.type === 'TK_EOF') {
		if ((pt = token?.previous_token)?.type === 'TK_SHARP') {
			let isdll = false;
			switch (pt!.content.toLowerCase()) {
				case '#dllload': isdll = true;
				case '#include':
				case '#includeagain': {
					if (isBrowser)
						return;
					let l = doc.document.offsetAt(position) - token!.offset;
					let pre = (text = token!.content).slice(0, l);
					let paths: string[], c = pre[0], inlib = false, suf = '';
					if ('\'"'.includes(c))
						pre = pre.slice(1);
					else c = '';
					pre = pre.replace(/^\*i\s/i, '');
					if (pre.startsWith('*')) {
						expg = make_search_re(pre.slice(1));
						for (let k in utils.get_RCDATA() ?? {})
							expg.test(k) && additem(k, CompletionItemKind.File);
						return items;
					}
					if (pre[0] === '<')
						c = '>' + c, pre = pre.slice(1);
					if (/["<>*?|]/.test(pre) || isdll && c.startsWith('>'))
						return;
					pre = pre.replace(/`;/g, ';').replace(/[^\\/]+$/, m => (suf = m, ''));
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
					let textedit: TextEdit | undefined;
					if (!allIdentifierChar.test(suf))
						textedit = TextEdit.replace({ start: { line: position.line, character: position.character - suf.length }, end: position }, '');
					for (let path of paths) {
						if (!existsSync(path = resolve(path, pre) + '\\') || !statSync(path).isDirectory())
							continue;
						for (let it of readdirSync(path)) {
							try {
								if (statSync(path + it).isDirectory()) {
									if (ep.test(it) && additem(it.replace(/(\s);/g, '$1`;'), CompletionItemKind.Folder)) {
										cpitem.command = { title: 'Trigger Suggest', command: 'editor.action.triggerSuggest' };
										if (textedit)
											cpitem.textEdit = Object.assign({}, textedit, { newText: cpitem.label + xg });
										else
											cpitem.insertText = cpitem.label + xg;
									}
								} else if (extreg.test(it) && ep.test(inlib ? it = it.replace(extreg, '') : it) &&
									additem(it.replace(/(\s);/g, '$1`;'), CompletionItemKind.File)) {
									if (textedit)
										cpitem.textEdit = Object.assign({}, textedit, { newText: cpitem.label + c });
									else
										cpitem.insertText = cpitem.label + c;
								}
							} catch { };
						}
						if (pre.includes(':'))
							break;
					}
					return items;
				}
				default: return;
			}
		} else if (pt?.type === 'TK_HOTLINE') {
			if (pt.ignore)
				return (addtexts(), items);
			items.push(...completionItemCache.key), kind = SymbolKind.Event;
		} else return;
	} else if (token.type.startsWith('TK_HOT')) {
		if (!token.ignore)
			return completionItemCache.key.filter(it => !it.label.toLowerCase().includes('alttab'));
		return;
	} else if (token.type === 'TK_SHARP' || token.content === '#') {
		token.topofline && items.push(...completionItemCache.directive['#']);
		return items;
	} else if (!token.callinfo && (pt = token).topofline <= 0) {
		let tp = ['TK_COMMA', 'TK_DOT', 'TK_EQUALS', 'TK_NUMBER', 'TK_OPERATOR', 'TK_RESERVED', 'TK_STRING', 'TK_WORD'];
		let maxn = token.type === 'TK_STRING' ? 0 : 3, i = 0, t;
		let ci = pt.callinfo, tokens = doc.tokens;
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
			if (pt.paraminfo)
				pt = tokens[pt.paraminfo.offset] ?? pt;
			if ((ci ??= pt.callinfo) || pt.topofline > 0)
				break;
		}
		ci && (isexpr = true);
		if (pt?.type === 'TK_RESERVED') {
			l = pt.content.toLowerCase();
			if (['goto', 'continue', 'break'].includes(l)) {
				if (i === 1 && token.type !== 'TK_WORD')
					return;
				let ts: any[] = [];
				if (scope = doc.searchScopedNode(position)) {
					(temp = (scope as FuncNode).labels) && ts.push(temp);
				} else {
					ts.push(doc.labels);
					for (let u in list)
						(temp = lexers[u]?.labels) && ts.push(temp);
				}
				for (let o of ts)
					for (let _ in o)
						expg.test(_) && (temp = o[_][0]).def && items.push(convertNodeCompletion(temp));
				if (i === 1 || i === 2 && !maxn)
					return items;
				if (maxn)
					for (let it of items)
						it.insertText = `'${it.insertText}'`;
			}
			// class xx (extends xx)? {
			else if (pt.topofline === 1 && l === 'class') {
				if (i === 2)
					return [{ label: 'extends', kind: CompletionItemKind.Keyword, preselect: true }];
				if (i === 3 && token.previous_token?.content.toLowerCase() === 'extends') {
					if (text.includes('.')) {
						let cls = find_class(doc, text.replace(/\.[^.]*$/, ''));
						for (let it of Object.values(cls?.staticdeclaration ?? {})) {
							if (it.kind === SymbolKind.Class && !vars[l = it.name.toUpperCase()] && expg.test(l))
								items.push(convertNodeCompletion(it)), vars[l] = true;
						}
						return items;
					}
					let glo = [doc.declaration];
					for (const uri in list)
						if (lexers[uri])
							glo.push(lexers[uri].declaration);
					for (const g of glo)
						for (const cl in g) {
							if (g[cl].kind === SymbolKind.Class && !vars[cl] && expg.test(cl))
								items.push(convertNodeCompletion(g[cl])), vars[cl] = true;
						}
					for (const cl in ahkvars)
						if (ahkvars[cl].kind === SymbolKind.Class && !vars[cl] && expg.test(cl))
							items.push(convertNodeCompletion(ahkvars[cl])), vars[cl] = true;
				}
				return items;
			}
		} else if (!maxn) {
			if (ci) {
				let kind: CompletionItemKind = CompletionItemKind.Value, command = { title: 'cursorRight', command: 'cursorRight' };
				let text2item = (label: string) => ({ label, kind, command });
				let res = getFuncCallInfo(doc, position, ci), ts: any;
				if (res) {
					let ismethod = res.kind === SymbolKind.Method;
					if (ismethod) {
						switch (l = res.name.toLowerCase()) {
							case 'deleteprop':
							case 'getmethod':
							case 'getownpropdesc':
							case 'hasownprop':
							case 'hasmethod':
							case 'hasprop':
								if (res.index === 0) {
									let c = doc.buildContext(res.pos);
									let getmems = !l.includes('ownprop') ? getClassMembers :
										(_: Lexer, cls: ClassNode, isstatic: boolean) => isstatic ? cls.staticdeclaration : cls.declaration;
									let filter = l.endsWith('method') ? (kind: SymbolKind) => kind !== SymbolKind.Method : undefined;
									reset_detect_cache(), detectExpType(doc, c.text.toLowerCase(), c.range.end, ts = {});
									if ((ts[`@object.${l}`] ?? ts[`@any.${l}`]) !== undefined) {
										detectExpType(doc, c.text.toLowerCase().slice(0, -1 - l.length), c.range.end, ts = {});
										if (ts['#any'] === undefined) {
											for (const tp in ts) {
												let ns;
												if (ts[tp] === false) {
													ns = searchNode(doc, tp, position, SymbolKind.Class);
												} else if (ts[tp]?.node)
													ns = [ts[tp]];
												ns?.forEach((it: any) => {
													if (it.node.kind !== SymbolKind.Class)
														return;
													Object.values(getmems(doc, it.node, !/[@#][^.]+$/.test(tp))).forEach(it => {
														if (expg.test(it.name) && !filter?.(it.kind))
															additem(it.name, it.kind === SymbolKind.Method ? CompletionItemKind.Method : CompletionItemKind.Property);
													});
												});
											}
										}
										return items;
									}
								}
								break;
							case 'add':
								if (res.index === 0) {
									let c = doc.buildContext(res.pos);
									reset_detect_cache(), detectExpType(doc, c.text.toLowerCase(), c.range.end, ts = {});
									if (ts['@gui.add'] !== undefined) {
										return ['Text', 'Edit', 'UpDown', 'Picture', 'Button', 'Checkbox', 'Radio', 'DropDownList',
											'ComboBox', 'ListBox', 'ListView', 'TreeView', 'Link', 'Hotkey', 'DateTime', 'MonthCal',
											'Slider', 'Progress', 'GroupBox', 'Tab', 'Tab2', 'Tab3', 'StatusBar', 'ActiveX', 'Custom'].map(text2item);
									}
								}
								break;
							case 'onevent':
								if (res.index === 0) {
									let c = doc.buildContext(res.pos);
									reset_detect_cache(), detectExpType(doc, c.text.toLowerCase(), c.range.end, ts = {});
									if (ts['@gui.onevent'] !== undefined)
										return ['Close', 'ContextMenu', 'DropFiles', 'Escape', 'Size'].map(text2item);
									else if (ts['gui.@control.onevent'] !== undefined)
										return ['Change', 'Click', 'DoubleClick', 'ColClick',
											'ContextMenu', 'Focus', 'LoseFocus', 'ItemCheck',
											'ItemEdit', 'ItemExpand', 'ItemFocus', 'ItemSelect'].map(text2item);;
								}
								break;
							case 'bind':
							case 'call': {
								let t = doc.buildContext(res.pos).text.toLowerCase();
								let n = searchNode(doc, t, res.pos, SymbolKind.Method)?.[0].node;
								if (n && (<FuncNode>n).full?.match(/\(func\)\s+\w+\(/i)) {
									res.name = t.slice(0, -5);
									ismethod = false;
								} else if (n && n.kind === SymbolKind.Function) {
									res.name = n.name.toLowerCase();
									ismethod = false;
								}
								break;
							}
						}
					}
					if (!ismethod && is_builtin_symbol(res.name, res.pos)) {
						switch (res.name.toLowerCase()) {
							case 'dynacall':
								if (res.index !== 0)
									break;
							case 'dllcall':
								if (res.index === 0) {
									if (isBrowser) break;
									let tk = doc.tokens[doc.document.offsetAt(res.pos)], offset = doc.document.offsetAt(position);
									if (!tk) break;
									while ((tk = doc.tokens[tk.next_token_offset]) && tk.content === '(')
										continue;
									if (tk && tk.type === 'TK_STRING' && offset > tk.offset && offset <= tk.offset + tk.length) {
										let pre = tk.content.substring(1, offset - tk.offset);
										let docs = [doc], files: any = {};
										for (let u in list) docs.push(lexers[u]);
										items.splice(0);
										if (!pre.match(/[\\/]/)) {
											docs.forEach(d => d.dllpaths.forEach(path => {
												path = path.replace(/^.*[\\/]/, '').replace(/\.dll$/i, '');
												if (!files[l = path.toLowerCase()])
													files[l] = true, additem(path + '\\', CompletionItemKind.File);
											}));
											readdirSync('C:\\Windows\\System32').forEach(file => {
												if (file.toLowerCase().endsWith('.dll') && expg.test(file = file.slice(0, -4)))
													additem(file + '\\', CompletionItemKind.File);
											});
											winapis.forEach(f => { if (expg.test(f)) additem(f, CompletionItemKind.Function); });
											return items;
										} else {
											let dlls: { [key: string]: any } = {}, onlyfile = true;
											l = pre.replace(/[\\/][^\\/]*$/, '').replace(/\\/g, '/').toLowerCase();
											if (!l.match(/\.\w+$/))
												l = l + '.dll';
											if (l.includes(':')) onlyfile = false, dlls[l] = 1;
											else if (l.includes('/')) {
												if (l.startsWith('/'))
													dlls[doc.scriptpath + l] = 1;
												else dlls[doc.scriptpath + '/' + l] = 1;
											} else {
												docs.forEach(d => {
													d.dllpaths.forEach(path => {
														if (path.toLowerCase().endsWith(l)) {
															dlls[path] = 1;
															if (onlyfile && path.includes('/'))
																onlyfile = false;
														}
													});
													if (onlyfile)
														dlls[l] = dlls[d.scriptpath + '/' + l] = 1;
												});
											}
											(await utils.get_DllExport(Object.keys(dlls), true)).forEach(
												it => expg.test(it) && additem(it, CompletionItemKind.Function));
											return items;
										}
									}
								} else if (res.index > 0 && res.index % 2 === 1) {
									for (const name of ['cdecl'].concat(dllcalltpe))
										additem(name, CompletionItemKind.TypeParameter) && (cpitem.commitCharacters = ['*']);
									return items;
								}
								break;
							case 'comcall':
								if (res.index > 1 && res.index % 2 === 0) {
									for (const name of ['cdecl'].concat(dllcalltpe))
										additem(name, CompletionItemKind.TypeParameter) && (cpitem.commitCharacters = ['*']);
									return items;
								}
								break;
							case 'comobject':
								if (res.index === 0) {
									let ids = (await sendAhkRequest('GetProgID', []) ?? []) as string[];
									ids.forEach(s => additem(s, CompletionItemKind.Value));
									return items;
								}
								break;
							case 'numget':
								if (res.index === 2 || res.index === 1) {
									for (const name of dllcalltpe.filter(v => !/str$/i.test(v)))
										additem(name, CompletionItemKind.TypeParameter);
									return items;
								}
								break;
							case 'numput':
								if (res.index % 2 === 0) {
									for (const name of dllcalltpe.filter(v => !/str$/i.test(v)))
										additem(name, CompletionItemKind.TypeParameter);
									return items;
								}
								break;
							case 'objbindmethod':
								if (res.index === 1) {
									let exp = ci.paraminfo?.data?.[0], unknown = true;
									['NEW', 'DELETE', 'GET', 'SET', 'CALL'].forEach(it => { vars['__' + it] = true; });
									if (exp) {
										let ts: any = {};
										reset_detect_cache(), detectExpType(doc, exp, position, ts);
										if (ts['#any'] === undefined) {
											for (const tp in ts) {
												let ns: any;
												if (ts[tp] === false) {
													ns = searchNode(doc, tp, position, SymbolKind.Class);
												} else if (ts[tp]?.node)
													ns = [ts[tp]];
												ns?.forEach((it: any) => {
													unknown = false;
													Object.values(getClassMembers(doc, it.node, !tp.match(/[@#][^.]+$/))).forEach(it => {
														if (it.kind === SymbolKind.Method && expg.test(temp))
															additem(it.name, CompletionItemKind.Method);
													});
												});
											}
										}
									}
									if (unknown) {
										let meds = [doc.object.method];
										for (const uri in list)
											(temp = lexers[uri]) && meds.push(temp.object.method);
										for (const med of meds)
											for (const it in med)
												expg.test(it) && additem(med[it][0].name, CompletionItemKind.Method);
									}
									return items;
								}
								break;
							case 'processsetpriority':
								if (res.index === 0)
									return ['Low', 'BelowNormal', 'Normal', 'AboveNormal', 'High', 'Realtime'].map(text2item);
								break;
							case 'thread':
								if (res.index === 0)
									return ['NoTimers', 'Priority', 'Interrupt'].map(text2item);
								break;
							case 'settitlematchmode':
								if (res.index === 0)
									return ['Fast', 'Slow', 'RegEx'].map(text2item);
								break;
							case 'setnumlockstate':
							case 'setcapslockstate':
							case 'setscrolllockstate':
								if (res.index === 0)
									return ['On', 'Off', 'AlwaysOn', 'AlwaysOff'].map(text2item);
								break;
							case 'sendmode':
								if (res.index === 0)
									return ['Event', 'Input', 'InputThenPlay', 'Play'].map(text2item);
								break;
							case 'blockinput':
								if (res.index === 0)
									return ['On', 'Off', 'Send', 'Mouse', 'SendAndMouse', 'Default', 'MouseMove', 'MouseMoveOff'].map(text2item);
								break;
							case 'coordmode':
								if (res.index === 0)
									return ['ToolTip', 'Pixel', 'Mouse', 'Caret', 'Menu'].map(text2item);
								else if (res.index === 1)
									return ['Screen', 'Window', 'Client'].map(text2item);
								break;
							case 'mouseclick':
								if (res.index === 0)
									return ['Left', 'Right', 'Middle', 'X1', 'X2', 'WheelUp', 'WheelDown', 'WheelLeft', 'WheelRight'].map(text2item);
								break;
							case 'controlsend':
							case 'getkeyname':
							case 'getkeysc':
							case 'getkeystate':
							case 'getkeyvk':
							case 'keywait':
							case 'send':
							case 'sendevent':
							case 'sendinput':
							case 'sendplay':
								if (res.index > 0)
									break;
								kind = CompletionItemKind.Text;
								command = undefined as any;
								items.push(text2item('Blind'));
							case 'hotkey':
								if (res.index > 1)
									break;
								items.push(...completionItemCache.key);
								return items;
						}
					}
					let fns: FuncNode[] = [];
					if (ismethod) {
						if (!ts) {
							let c = doc.buildContext(res.pos);
							reset_detect_cache(), detectExpType(doc, c.text.toLowerCase(), c.range.end, ts = {});
						}
						let n;
						for (let t in ts)
							if ((n = ts[t]?.node) && (n.kind === SymbolKind.Method || n.kind === SymbolKind.Function))
								fns.push(n);
					} else {
						for (let t of searchNode(doc, res.name, position, SymbolKind.Variable) ?? [])
							if (t.node.kind === SymbolKind.Function)
								fns.push(t.node as FuncNode);
					}
					for (let fn of fns) {
						let p = fn.params[res.index], s = '';
						if (allIdentifierChar.test(p?.name ?? ''))
							if (s = fn.detail?.match(new RegExp(`^@(param|arg)\\s+{(.*?)}\\s+${p.name}\\b`, 'mi'))?.[2].trim() ?? '')
								if (/^(['"])(`\1|.)+\1\|/.test(s)) {
									s.split('|').map(s => {
										if (/['"']/.test(s[0]) && s.endsWith(s[0]) && allIdentifierChar.test(s = s.slice(1, -1)))
											items.push(text2item(s));
									});
								}
					}
					if (items.length) {
						if (!text.substring(1).endsWith(text[0])) {
							let c = text[0];
							for (let t of items)
								t.insertText = t.label + c, delete t.command;
						}
						return items;
					}
				}
			}
			addtexts();
			return items;
		}
	}

	let right_is_paren = '(['.includes(linetext.charAt(range.end.character) || '\0');
	let join_c = extsettings.FormatOptions.brace_style === 0 ? '\n' : ' ';

	// fn|()=>...
	if (symbol) {
		if (!symbol.children && (scope ??= doc.searchScopedNode(position))?.kind === SymbolKind.Class) {
			let cls = scope as ClassNode;
			let metafns = ['__Init()', '__Call(${1:Name}, ${2:Params})', '__Delete()',
				'__Enum(${1:NumberOfVars})', '__Get(${1:Key}, ${2:Params})',
				'__Item[$1]', '__New($1)', '__Set(${1:Key}, ${2:Params}, ${3:Value})'];
			if (token.topofline === 1)
				items.push({ label: 'static', insertText: 'static', kind: CompletionItemKind.Keyword }, {
					label: 'class', insertText: ['class $1', '{\n\t$0\n}'].join(join_c),
					kind: CompletionItemKind.Keyword, insertTextFormat: InsertTextFormat.Snippet
				});
			if (doc.tokens[token.next_token_offset]?.topofline === 0)
				return token.topofline === 1 ? (items.pop(), items) : undefined;
			let is_static = (symbol as Variable).static ?? false;
			if (is_static)
				metafns.splice(0, 1);
			if (token.topofline)
				metafns.forEach(s => {
					let label = s.replace(/[(\[].*$/, '');
					if (!vars[label.toUpperCase()])
						items.push({
							label, kind: CompletionItemKind.Method,
							insertTextFormat: InsertTextFormat.Snippet,
							insertText: s + join_c + '{\n\t$0\n}'
						});
				});
			for (let it of Object.values(getClassMembers(doc, cls, is_static)))
				additem(it.name, it.kind === SymbolKind.Method ?
					CompletionItemKind.Method : CompletionItemKind.Property);
			return items;
		}
		return;
	} else if (kind === SymbolKind.Null)
		return;

	// obj.xxx|
	if (kind === SymbolKind.Property || kind === SymbolKind.Method) {
		if (!text.includes('.'))
			return;
		let unknown = true, isstatic = true, tps = new Set<DocumentSymbol>();
		let props: any = {}, ts: any = {}, p = text.replace(/\.(\w|[^\x00-\x7f])*$/, '').toLowerCase();
		reset_detect_cache(), detectExpType(doc, p, range.end, ts);
		delete ts['@comvalue'];
		let tsn = Object.keys(ts).length;
		if (ts['#any'] === undefined) {
			for (const tp in ts) {
				unknown = false, isstatic = !tp.match(/[@#][^.]+$/);
				if (ts[tp]) {
					let kind = ts[tp].node?.kind;
					if (kind === SymbolKind.Function || kind === SymbolKind.Method)
						tps.add(ahkvars['FUNC']), isstatic = false;
					else if (kind === SymbolKind.Class)
						tps.add(ts[tp].node);
				} else if (tp.match(/^@comobject\b/)) {
					let p: string[] = [];
					if (temp = tp.substring(10).match(/<([\w.{}-]+)(,([\w{}-]+))?>/))
						p.push(temp[1]), temp[3] && p.push(temp[3]);
					if (p.length) {
						let result = (await sendAhkRequest('GetDispMember', p) ?? {}) as { [func: string]: number };
						Object.entries(result).forEach(it => expg.test(it[0]) && additem(it[0], it[1] === 1 ? CompletionItemKind.Method : CompletionItemKind.Property));
					}
					if (tsn === 1)
						return items;
				} else if (tp.includes('=>')) {
					tps.add(ahkvars['FUNC']), isstatic = false;
				} else for (let it of searchNode(doc, tp, position, SymbolKind.Variable) ?? [])
					it.node.kind === SymbolKind.Class && tps.add(it.node);
			}
		}
		for (const node of tps) {
			let omems = getClassMembers(doc, node, isstatic);
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
		if (!unknown && (triggerKind !== 1 || text.match(/\..{0,2}$/)))
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
		let kind = CompletionItemKind.Keyword, insertTextFormat = InsertTextFormat.Snippet;
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
			if ((all || it.kind !== SymbolKind.Interface) && expg.test(n) && (!vars[n] || (vars[n].kind === CompletionItemKind.Variable && it.kind !== SymbolKind.Variable)))
				vars[n] = cpitem = convertNodeCompletion(it), cpitem.detail = `${completionitem.include(path)}\n\n${cpitem.detail ?? ''}`;
		}
	}

	// local vars
	if (scope) {
		position = range.end;
		Object.entries(doc.getScopeChildren(scope)).forEach(([l, it]) => {
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
			if (!list[u] && (path = (lexers[u] ?? (<any>libfuncs[u])).fsPath) && ((extsettings.AutoLibInclude > 1 && (<any>libfuncs[u]).islib) ||
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

	// snippet
	items.push(...completionItemCache.snippet);

	// constant
	if (!isexpr && kind !== SymbolKind.Event) {
		if (triggerKind === 1 && text.length > 2 && text.includes('_')) {
			for (const it of completionItemCache.constant)
				expg.test(it.label) && items.push(it);
		}
	}
	return items.concat(Object.values(vars));

	function is_symbol_comment(tk: Token) {
		let nk = doc.tokens[tk.next_token_offset], t;
		if (nk && ((t = nk.symbol)?.detail !== undefined || (t = doc.tokens[nk.next_token_offset]?.symbol)?.detail !== undefined))
			return t;
	}
	function is_builtin_symbol(name: string, pos: any) {
		let n = ahkvars[name = name.toUpperCase()];
		return n && n === (searchNode(doc, name, pos, SymbolKind.Variable)?.[0].node ?? n);
	}
	function addtexts() {
		for (let it of completionItemCache.text) {
			if (expg.test(it.label))
				vars[it.label.toUpperCase()] = true, items.push(it);
		}
		for (const t in (temp = doc.texts))
			expg.test(t) && additem(temp[t], CompletionItemKind.Text);
		for (const u in list)
			for (const t in (temp = lexers[u]?.texts))
				expg.test(t) && additem(temp[t], CompletionItemKind.Text);
	}
	function additem(label: string, kind: CompletionItemKind) {
		if (vars[l = label.toUpperCase()])
			return false;
		items.push(cpitem = { label, kind });
		return vars[l] = true;
	};
	function at_edit_pos(it: DocumentSymbol) {
		return it.selectionRange.end.line === line && character === it.selectionRange.end.character;
	}
	function convertNodeCompletion(info: any): CompletionItem {
		let ci = CompletionItem.create(info.name);
		switch (info.kind) {
			case SymbolKind.Function:
			case SymbolKind.Method:
				ci.kind = info.kind === SymbolKind.Method ? CompletionItemKind.Method : CompletionItemKind.Function;
				if (extsettings.CompleteFunctionParens) {
					if (right_is_paren)
						ci.command = { title: 'cursorRight', command: 'cursorRight' };
					else if ((<FuncNode>info).params.length) {
						ci.command = { title: 'Trigger Parameter Hints', command: 'editor.action.triggerParameterHints' };
						if ((<FuncNode>info).params[0].name.includes('|')) {
							ci.insertText = ci.label + '(${1|' + (<FuncNode>info).params[0].name.replace(/\|/g, ',') + '|})';
							ci.insertTextFormat = InsertTextFormat.Snippet;
						} else ci.insertText = ci.label + '($0)', ci.insertTextFormat = InsertTextFormat.Snippet;
					} else ci.insertText = ci.label + '()';
				} else
					ci.commitCharacters = commitCharacters.Function;
				ci.detail = info.full, ci.documentation = { kind: 'markdown', value: formatMarkdowndetail(info) };
				break;
			case SymbolKind.Variable:
			case SymbolKind.TypeParameter:
				ci.kind = CompletionItemKind.Variable;
				if (info.range.end.character)
					ci.documentation = { kind: 'markdown', value: formatMarkdowndetail(info) };
				else ci.detail = info.detail;
				break;
			case SymbolKind.Class:
				ci.kind = CompletionItemKind.Class, ci.commitCharacters = commitCharacters.Class;
				ci.detail = 'class ' + (info.full || ci.label), ci.documentation = { kind: 'markdown', value: formatMarkdowndetail(info) }; break;
			case SymbolKind.Event:
				ci.kind = CompletionItemKind.Event; break;
			case SymbolKind.Field:
				ci.kind = CompletionItemKind.Field, ci.label = ci.insertText = ci.label.slice(0, -1); break;
			case SymbolKind.Property:
				ci.kind = CompletionItemKind.Property, ci.detail = info.full || ci.label, ci.documentation = { kind: 'markdown', value: formatMarkdowndetail(info) };
				if (info.get?.params.length)
					ci.insertTextFormat = InsertTextFormat.Snippet, ci.insertText = ci.label + '[$0]';
				break;
			case SymbolKind.Interface:
				ci.kind = CompletionItemKind.Interface; break;
			default:
				ci.kind = CompletionItemKind.Text; break;
		}
		return ci;
	}
}