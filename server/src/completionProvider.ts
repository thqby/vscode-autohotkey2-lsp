import { existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { CancellationToken, CompletionItem, CompletionItemKind, CompletionParams, DocumentSymbol, InsertTextFormat, SymbolKind, TextEdit } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { cleardetectcache, detectExpType, FuncNode, getClassMembers, getFuncCallInfo, searchNode, Variable } from './Lexer';
import { completionitem } from './localize';
import { ahkvars, completionItemCache, dllcalltpe, extsettings, getDllExport, inBrowser, inWorkspaceFolders, lexers, libfuncs, Maybe, pathenv, winapis, workspaceFolders } from './common';

export async function completionProvider(params: CompletionParams, token: CancellationToken): Promise<Maybe<CompletionItem[]>> {
	if (token.isCancellationRequested || params.context?.triggerCharacter === null) return undefined;
	const { position, textDocument } = params, items: CompletionItem[] = [], vars: { [key: string]: any } = {}, txs: any = {};
	let scopenode: DocumentSymbol | undefined, other = true, triggerKind = params.context?.triggerKind;
	let uri = textDocument.uri.toLowerCase(), doc = lexers[uri], content = doc.buildContext(position, false, true);
	let quote = '', char = '', l = '', percent = false, lt = content.linetext, triggerchar = lt.charAt(content.range.start.character - 1);
	let list = doc.relevance, cpitem: CompletionItem = { label: '' }, temp: any, path: string, { line, character } = position;
	let expg = new RegExp(content.text.match(/[^\w]/) ? content.text.replace(/(.)/g, '$1.*') : '(' + content.text.replace(/(.)/g, '$1.*') + '|[^\\w])', 'i');
	let istr = doc.instrorcomm(position);
	if (istr === 1)
		return;
	if (istr) {
		if (triggerKind === 2)
			return;
		triggerchar = '';
	} else if (content.pre.startsWith('#')) {
		for (let i = 0; i < position.character; i++) {
			char = lt.charAt(i);
			if (quote === char) {
				if (lt.charAt(i - 1) === '`')
					continue;
				else quote = '', percent = false;
			} else if (char === '%') {
				percent = !percent;
			} else if (quote === '' && (char === '"' || char === "'") && (i === 0 || lt.charAt(i - 1).match(/[([%,\s]/)))
				quote = char;
		}
	}
	if (!percent && triggerchar === '.' && content.pre.match(/^\s*#(include|dllload)/i))
		triggerchar = '###';
	if (temp = lt.match(/^\s*((class\s+(\w|[^\x00-\xff])+\s+)?(extends)|class)\s/i)) {
		if (triggerchar === '.') {
			if (temp[3]) {
				searchNode(doc, doc.buildContext(position, true, true).text.replace(/\.[^.]*$/, '').toLowerCase(), position, SymbolKind.Class)?.map(it => {
					Object.values(getClassMembers(doc, it.node, true)).map(it => {
						if (it.kind === SymbolKind.Class && !vars[l = it.name.toLowerCase()] && expg.test(l))
							items.push(convertNodeCompletion(it)), vars[l] = true;
					});
				});
			}
			return items;
		}
		if (!temp[3] && !temp[2]) {
			cpitem = CompletionItem.create('extends');
			cpitem.kind = CompletionItemKind.Keyword;
			return [cpitem];
		}
		let glo = [doc.declaration];
		for (const uri in list)
			if (lexers[uri])
				glo.push(lexers[uri].declaration);
		glo.map(g => {
			for (const cl in g) {
				if (g[cl].kind === SymbolKind.Class && !vars[cl] && expg.test(cl))
					items.push(convertNodeCompletion(g[cl])), vars[cl] = true;
			}
		});
		for (const cl in ahkvars)
			if (ahkvars[cl].kind === SymbolKind.Class && !vars[cl] && expg.test(cl))
				items.push(convertNodeCompletion(ahkvars[cl])), vars[cl] = true;
		return items;
	}
	switch (triggerchar) {
		case '#':
			items.push(...completionItemCache.sharp);
			items.push(...completionItemCache.snippet);
			return items;
		case '.':
			let c = doc.buildContext(position, true, true);
			if (c.text.match(/\b\d+\.$/) || c.linetext.match(/(^|\s)\.$/))
				return;
			content.pre = c.text.slice(0, content.text === '' && content.pre.match(/\.$/) ? -1 : -content.text.length);
			content.text = c.text, content.kind = c.kind, content.linetext = c.linetext;;
			let p: any = content.pre.replace(/('|").*?(?<!`)\1/, `''`), t: any, unknown = true;
			let props: any = {}, isstatic = true, tps: any = [], isclass = false, isfunc = false, isobj = false, hasparams = false;
			let ts: any = {};
			p = content.pre.toLowerCase();
			cleardetectcache(), detectExpType(doc, p, position, ts);
			if (ts['#any'] === undefined) {
				for (const tp in ts) {
					unknown = false, isstatic = !tp.match(/[@#][^.]+$/);
					if (ts[tp]) {
						let kind = ts[tp].node.kind;
						if (kind === SymbolKind.Function || kind === SymbolKind.Method) {
							if (isfunc)
								continue;
							else {
								isfunc = true;
								if (ahkvars['func'])
									tps.push(ahkvars['func']), isstatic = false;
							}
						}
						tps.push(ts[tp].node);
					} else searchNode(doc, tp, position, SymbolKind.Variable)?.map(it => {
						tps.push(it.node);
					});
				}
				if (ts['#object'] !== undefined) {
					let n = searchNode(doc, p, position, SymbolKind.Variable), t: string[];
					if (n && (t = (<any>n[0].node).property)) {
						t.map(s => {
							if (!props[l = s.toLowerCase()]) {
								items.push(props[l] = CompletionItem.create(s));
								props[l].kind = CompletionItemKind.Property;
							}
						})
					}
				}
			}
			if (ts = ahkvars['any'])
				tps.push(ts);
			for (const node of tps) {
				switch (node.kind) {
					case SymbolKind.Class:
						let omems = getClassMembers(doc, node, isstatic);
						if (isstatic && (<FuncNode>omems['__new'])?.static === false)
							delete omems['__new'];
						Object.values(omems).map((it: any) => {
							if (expg.test(it.name)) {
								if (it.kind === SymbolKind.Property || it.kind === SymbolKind.Class) {
									if (!props[l = it.name.toLowerCase()])
										items.push(props[l] = convertNodeCompletion(it));
									else if (props[l].detail !== it.full)
										props[l].detail = '(...) ' + it.name, props[l].insertText = it.name;
								} else if (it.kind === SymbolKind.Method) {
									if (!props[l = it.name.toLowerCase()])
										items.push(props[l] = convertNodeCompletion(it));
									else if (props[l].detail !== it.full)
										props[l].detail = '(...) ' + it.name + '()', props[l].documentation = '';
								}
							}
						});
						break;
					case SymbolKind.Object:
						isobj = true; break;
				}
			}
			if (!unknown && (triggerKind !== 1 || content.text.match(/\..{0,2}$/)))
				return items;
			let objs = [doc.object];
			for (const uri in list)
				objs.push(lexers[uri].object);
			for (const obj of objs) {
				if (obj === doc.object) {
					for (const n in obj.property)
						if (expg.test(n))
							if (!props[n]) {
								let i = obj.property[n];
								if (!ateditpos(i))
									items.push(props[n] = convertNodeCompletion(i));
							} else props[n].detail = props[n].label;
				} else for (const n in obj.property)
					if (expg.test(n))
						if (!props[n])
							items.push(props[n] = convertNodeCompletion(obj.property[n]));
						else props[n].detail = props[n].label;
				for (const n in obj.method)
					if (expg.test(n))
						if (!props[n])
							items.push(props[n] = convertNodeCompletion(obj.method[n][0]));
						else if (typeof props[n] === 'object')
							props[n].detail = '(...) ' + props[n].label;
			}
			for (const cl in ahkvars) {
				if ((isobj && cl === 'object') || (isfunc && cl === 'func') || (isclass && cl === 'class') || cl === 'any' || !ahkvars[cl].children)
					continue;
				let cls: DocumentSymbol[] = [];
				ahkvars[cl].children?.map((it: any) => {
					if (it.kind === SymbolKind.Class) {
						cls.push(...it.children);
					} else
						cls.push(it);
				});
				cls.map((it: any) => {
					if (it.kind === SymbolKind.Class)
						return;
					if (expg.test(l = it.name.toLowerCase()))
						if (!props[l])
							items.push(props[l] = convertNodeCompletion(it));
						else if (props[l].detail !== it.full)
							props[l].detail = '(...) ' + it.name, props[l].insertText = it.name, props[l].documentation = undefined;
				});
			}
			return items;
		default:
			if (temp = lt.match(/^\s*#(include|(dllload))/i)) {
				if (inBrowser)
					return;
				let tt = lt.replace(/^\s*#(include(again)?|dllload)\s+/i, '').replace(/\s*\*i\s+/i, ''), paths: string[] = [], inlib = false, lchar = '';
				let pre = lt.substring(lt.length - tt.length, position.character), xg = '\\', m: any, a_ = '', isdll = !!temp[2];
				if (percent) {
					completionItemCache.other.map(it => {
						if (it.kind === CompletionItemKind.Variable && expg.test(it.label))
							items.push(it);
					})
					return items;
				} else if (pre.match(/\s+;/))
					return;
				else if (pre.charAt(0).match(/['"<]/)) {
					if (pre.substring(1).match(/['">]/)) return;
					else {
						if ((lchar = pre.charAt(0)) === '<') {
							if (isdll) return;
							inlib = true, paths = doc.libdirs;
						} else if (!isdll)
							paths = (temp = doc.includedir.get(position.line)) ? [temp] : [doc.scriptpath];
						pre = pre.substring(1), lchar = lchar === '<' ? '>' : lchar;
						if (lt.substring(position.character).indexOf(lchar) !== -1)
							lchar = '';
					}
				} else if (!isdll)
					paths = (temp = doc.includedir.get(position.line)) ? [temp] : [doc.scriptpath];
				pre = pre.replace(/[^\\/]*$/, '');
				while (m = pre.match(/%a_(\w+)%/i))
					if (pathenv[a_ = m[1].toLowerCase()])
						pre = pre.replace(m[0], pathenv[a_]);
					else if (a_ === 'scriptdir')
						pre = pre.replace(m[0], doc.scriptdir);
					else if (a_ === 'linefile')
						pre = pre.replace(m[0], URI.parse(doc.uri).fsPath);
					else return;
				if (pre.charAt(pre.length - 1) === '/')
					xg = '/';
				let extreg = isdll ? new RegExp(/\.(dll|ocx|cpl)$/i) : inlib ? new RegExp(/\.ahk$/i) : new RegExp(/\.(ahk2?|ah2)$/i), ts = tt.replace(/['"<>]/g, '').replace(/^.*[\\/]/, '');
				if (ts.includes('*'))
					return undefined;
				let ep = new RegExp((ts.match(/[^\w]/) ? ts.replace(/(.)/g, '$1.*') : '(' + ts.replace(/(.)/g, '$1.*') + '|[^\\w])').replace(/\.\./, '\\..'), 'i');
				let textedit: TextEdit | undefined;
				if (isdll)
					paths = [(temp = doc.dlldir.get(position.line)) ? temp : doc.scriptpath, 'C:\\Windows\\System32'];
				if (ts.includes('.'))
					textedit = TextEdit.replace({ start: { line: position.line, character: position.character - ts.length }, end: position }, '');
				for (let path of paths) {
					if (!existsSync(path = resolve(path, pre) + '\\') || !statSync(path).isDirectory())
						continue;
					for (let it of readdirSync(path)) {
						try {
							if (statSync(path + it).isDirectory()) {
								if (ep.test(it)) {
									additem(it, CompletionItemKind.Folder);
									cpitem.command = { title: 'Trigger Suggest', command: 'editor.action.triggerSuggest' };
									if (textedit)
										cpitem.textEdit = Object.assign({}, textedit, { newText: cpitem.label + xg });
									else
										cpitem.insertText = cpitem.label + xg;
								}
							} else if (extreg.test(it) && ep.test(inlib ? it = it.replace(extreg, '') : it)) {
								additem(it, CompletionItemKind.File);
								if (textedit)
									cpitem.textEdit = Object.assign({}, textedit, { newText: cpitem.label + lchar });
								else
									cpitem.insertText = cpitem.label + lchar;
							}
						} catch (err) { };
					}
					if (pre.includes(':'))
						break;
				}
				return items;
			} else if (temp = lt.match(/(?<!\.)\b(goto|continue|break)\b(?!\s*:)(\s+|\(\s*('|")?)/i)) {
				let t = temp[2].trim();
				if (scopenode = doc.searchScopedNode(position))
					scopenode.children?.map(it => {
						if (it.kind === SymbolKind.Field && expg.test(it.name))
							items.push(convertNodeCompletion(it));
					});
				else {
					doc.children.map(it => {
						if (it.kind === SymbolKind.Field && expg.test(it.name))
							items.push(convertNodeCompletion(it));
					});
					for (const t in list) lexers[t].children.map(it => {
						if (it.kind === SymbolKind.Field && expg.test(it.name))
							items.push(convertNodeCompletion(it));
					});
				}
				if (t === '' || temp[3])
					return items;
				else for (let it of items)
					it.insertText = `'${it.insertText}'`;
			} else if (istr) {
				let res = getFuncCallInfo(doc, position);
				if (res) {
					let ismethod = lt.charAt(res.pos.character - 1) === '.';
					if (ismethod) {
						switch (res.name) {
							case 'add':
								if (res.index === 0) {
									let n = searchNode(doc, doc.buildContext(res.pos, true).text.toLowerCase(), res.pos, SymbolKind.Method);
									if (n && (<FuncNode>n[0].node).full?.match(/\(gui\)\s+add\(/i)) {
										return ['Text', 'Edit', 'UpDown', 'Picture', 'Button', 'Checkbox', 'Radio', 'DropDownList',
											'ComboBox', 'ListBox', 'ListView', 'TreeView', 'Link', 'Hotkey', 'DateTime', 'MonthCal',
											'Slider', 'Progress', 'GroupBox', 'Tab', 'Tab2', 'Tab3', 'StatusBar', 'ActiveX', 'Custom'].map(maptextitem);
									}
								}
								break;
							case 'bind':
							case 'call': {
								let t = doc.buildContext(res.pos, true).text.toLowerCase();
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
					if (!ismethod) {
						switch (res.name) {
							case 'dynacall':
								if (res.index !== 0)
									break;
							case 'dllcall':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index === 0) {
									if (inBrowser) break;
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
											docs.map(d => d.dllpaths.map(path => {
												path = path.replace(/^.*[\\/]/, '').replace(/\.dll$/i, '');
												if (!files[l = path.toLowerCase()])
													files[l] = true, additem(path + '\\', CompletionItemKind.File);
											}));
											readdirSync('C:\\Windows\\System32').map(file => {
												if (file.toLowerCase().endsWith('.dll') && expg.test(file = file.slice(0, -4)))
													additem(file + '\\', CompletionItemKind.File);
											});
											winapis.map(f => { if (expg.test(f)) additem(f, CompletionItemKind.Function); });
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
												docs.map(d => {
													d.dllpaths.map(path => {
														if (path.endsWith(l)) {
															dlls[path] = 1;
															if (onlyfile && path.includes('/'))
																onlyfile = false;
														}
													});
													if (onlyfile)
														dlls[l] = dlls[d.scriptpath + '/' + l] = 1;
												});
											}
											getDllExport(Object.keys(dlls), true).map(it => additem(it, CompletionItemKind.Function));
											return items;
										}
									}
								} else if (res.index > 0 && res.index % 2 === 1) {
									for (const name of ['cdecl'].concat(dllcalltpe))
										additem(name, CompletionItemKind.TypeParameter), cpitem.commitCharacters = ['*'];
									return items;
								}
								break;
							case 'comcall':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index > 1 && res.index % 2 === 0) {
									for (const name of ['cdecl'].concat(dllcalltpe))
										additem(name, CompletionItemKind.TypeParameter), cpitem.commitCharacters = ['*'];
									return items;
								}
								break;
							case 'numget':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index === 2 || res.index === 1) {
									for (const name of dllcalltpe.filter(v => (v.match(/str$/i) ? false : true)))
										additem(name, CompletionItemKind.TypeParameter);
									return items;
								}
								break;
							case 'numput':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index % 2 === 0) {
									for (const name of dllcalltpe.filter(v => (v.match(/str$/i) ? false : true)))
										additem(name, CompletionItemKind.TypeParameter);
									return items;
								}
								break;
							case 'objbindmethod':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index === 1) {
									let ns: any, funcs: { [key: string]: any } = {};
									['new', 'delete', 'get', 'set', 'call'].map(it => { funcs['__' + it] = true; });
									if (temp = content.pre.match(/objbindmethod\(\s*(([\w.]|[^\x00-\xff])+)\s*,/i)) {
										let ts: any = {};
										cleardetectcache(), detectExpType(doc, temp[1], position, ts);
										if (ts['#any'] === undefined) {
											for (const tp in ts) {
												if (ts[tp] === false) {
													ns = searchNode(doc, tp, position, SymbolKind.Class);
												} else if (ts[tp])
													ns = [ts[tp]];
												ns?.map((it: any) => {
													Object.values(getClassMembers(doc, it.node, !tp.match(/[@#][^.]+$/))).map(it => {
														if (it.kind === SymbolKind.Method && !funcs[temp = it.name.toLowerCase()] && expg.test(temp))
															funcs[temp] = true, additem(it.name, CompletionItemKind.Method);
													});
												});
											}
										}
									}
									if (!ns) {
										let meds = [doc.object.method];
										for (const uri in list)
											meds.push(lexers[uri].object.method);
										for (const med of meds)
											for (const it in med)
												if (!funcs[it] && expg.test(it))
													funcs[it] = true, additem(med[it][0].name, CompletionItemKind.Method);
									}
									return items;
								}
								break;
							case 'processsetpriority':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index === 0)
									return ['Low', 'BelowNormal', 'Normal', 'AboveNormal', 'High', 'Realtime'].map(maptextitem);
								break;
							case 'thread':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index === 0)
									return ['NoTimers', 'Priority', 'Interrupt'].map(maptextitem);
								break;
							case 'settitlematchmode':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index === 0)
									return ['Fast', 'Slow', 'RegEx'].map(maptextitem);
								break;
							case 'setnumlockstate':
							case 'setcapslockstate':
							case 'setscrolllockstate':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index === 0)
									return ['On', 'Off', 'AlwaysOn', 'AlwaysOff'].map(maptextitem);
								break;
							case 'sendmode':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index === 0)
									return ['Event', 'Input', 'InputThenPlay', 'Play'].map(maptextitem);
								break;
							case 'blockinput':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index === 0)
									return ['On', 'Off', 'Send', 'Mouse', 'SendAndMouse', 'Default', 'MouseMove', 'MouseMoveOff'].map(maptextitem);
								break;
							case 'coordmode':
								if (!isbuiltin(res.name, res.pos)) break;
								if (res.index === 0)
									return ['ToolTip', 'Pixel', 'Mouse', 'Caret', 'Menu'].map(maptextitem);
								else if (res.index === 1)
									return ['Screen', 'Window', 'Client'].map(maptextitem);
								break;
						}
					}
				}
				if (other)
					completionItemCache.other.map(it => {
						if (it.kind === CompletionItemKind.Text && expg.test(it.label))
							vars[it.label.toLowerCase()] = true, items.push(it);
					});
				for (const t in vars)
					txs[t] = true;
				for (const t in doc.texts)
					if (!txs[t] && expg.test(t))
						txs[t] = true, additem(doc.texts[t], CompletionItemKind.Text);
				for (const u in list)
					for (const t in (temp = lexers[u].texts))
						if (!txs[t] && expg.test(t))
							txs[t] = true, additem(temp[t], CompletionItemKind.Text);
				return items;
			} else
				other = !percent;
			if (scopenode = doc.searchScopedNode(position)) {
				if (scopenode.kind === SymbolKind.Class) {
					let its: CompletionItem[] = [], t = lt.trim();
					if (t.match(/^\S*$/)) {
						completionItemCache.other.map(it => {
							if (it.label.match(/\b(static|class)\b/))
								its.push(it);
							else if (it.label.match(/^__\w+/)) {
								let t = Object.assign({}, it);
								t.insertText = t.insertText?.replace('$0', '$1') + ' {\n\t$0\n}';
								its.push(t);
							}
						});
						if (position.line === scopenode.range.end.line && position.character > scopenode.range.end.character)
							return undefined;
						return its;
					} else if (t.match(/^(static\s+)?(\w|[^\x00-\xff])+(\(|$)/i))
						return completionItemCache.other.filter(it => it.label.match(/^__\w+/)).map(it => {
							let t = Object.assign({}, it);
							t.insertText = t.insertText?.replace('$0', '$1') + ' {\n\t$0\n}';
							return t;
						});
				} else if (scopenode.kind === SymbolKind.Property && scopenode.children)
					return [{ label: 'get', kind: CompletionItemKind.Function }, { label: 'set', kind: CompletionItemKind.Function }]
			}
			for (const n in ahkvars)
				if (expg.test(n))
					vars[n] = convertNodeCompletion(ahkvars[n]);
			Object.values(doc.declaration).map(it => {
				if (expg.test(l = it.name.toLowerCase()) && !ateditpos(it) && (!vars[l] || it.kind !== SymbolKind.Variable))
					vars[l] = convertNodeCompletion(it);
			});
			for (const t in list) {
				path = list[t].path;
				for (const n in (temp = lexers[t]?.declaration)) {
					if (expg.test(n) && (!vars[n] || (vars[n].kind === CompletionItemKind.Variable && temp[n].kind !== SymbolKind.Variable))) {
						cpitem = convertNodeCompletion(temp[n]), cpitem.detail = `${completionitem.include(path)}  ` + (cpitem.detail || '');
						vars[n] = cpitem;
					}
				}
			}
			if (scopenode) {
				doc.getScopeChildren(scopenode).map(it => {
					if (expg.test(l = it.name.toLowerCase()) && (!vars[l] || it.kind !== SymbolKind.Variable || (<Variable>it).returntypes))
						vars[l] = convertNodeCompletion(it);
				});
			}
			completionItemCache.other.map(it => {
				if (expg.test(it.label)) {
					if (it.kind === CompletionItemKind.Text) {
						if (!scopenode && !percent)
							items.push(it);
					} else if (it.kind === CompletionItemKind.Function) {
						if (!vars[l = it.label.toLowerCase()])
							vars[l] = it;
					} else
						items.push(it);
				}
			});
			let dir = inWorkspaceFolders(doc.document.uri) || doc.scriptdir, exportnum = 0;
			if (extsettings.AutoLibInclude)
				for (const u in libfuncs) {
					if (!list || !list[u]) {
						path = URI.parse(u).fsPath;
						if ((extsettings.AutoLibInclude > 1 && (<any>libfuncs[u]).islib) || ((extsettings.AutoLibInclude & 1) && path.startsWith(dir))) {
							libfuncs[u].map(it => {
								if (!vars[l = it.name.toLowerCase()] && expg.test(l)) {
									cpitem = convertNodeCompletion(it);
									cpitem.detail = `${completionitem.include(path)}  ` + (cpitem.detail || '');
									cpitem.command = { title: 'ahk2.fix.include', command: 'ahk2.fix.include', arguments: [path, uri] };
									delete cpitem.commitCharacters;
									vars[l] = cpitem, exportnum++;
								}
							});
							if (exportnum > 300)
								break;
						}
					}
				}
			scopenode?.children?.map(it => {
				if (!vars[l = it.name.toLowerCase()] && expg.test(l) && !ateditpos(it))
					vars[l] = convertNodeCompletion(it);
			});
			if (other)
				addOther();
			return items.concat(Object.values(vars));
	}
	function isbuiltin(name: string, pos: any) {
		let n = searchNode(doc, name, pos, SymbolKind.Variable)?.[0].node;
		return n && n === ahkvars[name];
	}
	function addOther() {
		items.push(...completionItemCache.snippet);
		if (triggerKind === 1 && content.text.length > 2 && content.text.match(/^[a-z]+_/i)) {
			const constants = completionItemCache.constant;
			for (const it of constants)
				if (expg.test(it.label))
					items.push(it);
		}
	}
	function additem(label: string, kind: CompletionItemKind) { items.push(cpitem = CompletionItem.create(label)), cpitem.kind = kind; };
	function ateditpos(it: DocumentSymbol) {
		return it.range.end.line === line && it.range.start.character <= character && character <= it.range.end.character;
	}
	function maptextitem(name: string) {
		const cpitem = CompletionItem.create(name);
		cpitem.kind = CompletionItemKind.Text, cpitem.command = { title: 'cursorRight', command: 'cursorRight' };
		return cpitem
	}
}

function convertNodeCompletion(info: any): CompletionItem {
	let ci = CompletionItem.create(info.name);
	switch (info.kind) {
		case SymbolKind.Function:
		case SymbolKind.Method:
			ci.kind = info.kind === SymbolKind.Method ? CompletionItemKind.Method : CompletionItemKind.Function;
			if (extsettings.CompleteFunctionParens) {
				if ((<FuncNode>info).params.length) {
					ci.command = { title: 'Trigger Parameter Hints', command: 'editor.action.triggerParameterHints' };
					if ((<FuncNode>info).params[0].name.includes('|')) {
						ci.insertText = ci.label + '(${1|' + (<FuncNode>info).params[0].name.replace(/\|/g, ',') + '|})';
						ci.insertTextFormat = InsertTextFormat.Snippet;
					} else ci.insertText = ci.label + '($0)', ci.insertTextFormat = InsertTextFormat.Snippet;
				} else ci.insertText = ci.label + '()';
			} else
				ci.commitCharacters = ['\t', '('];
			ci.detail = info.full, ci.documentation = info.detail; break;
		case SymbolKind.Variable:
		case SymbolKind.TypeParameter:
			ci.kind = CompletionItemKind.Variable, ci.detail = info.detail; break;
		case SymbolKind.Class:
			ci.kind = CompletionItemKind.Class, ci.commitCharacters = ['.', '('];
			ci.detail = 'class ' + ci.label, ci.documentation = info.detail; break;
		case SymbolKind.Event:
			ci.kind = CompletionItemKind.Event; break;
		case SymbolKind.Field:
			ci.kind = CompletionItemKind.Field, ci.label = ci.insertText = ci.label.replace(/:$/, ''); break;
		case SymbolKind.Property:
			ci.kind = CompletionItemKind.Property, ci.detail = (info.full || ci.label), ci.documentation = (info.detail || '');
			if (info.children) for (const it of info.children) {
				if (it.kind === SymbolKind.Function && it.name.toLowerCase() === 'get' && it.params.length) {
					ci.insertTextFormat = InsertTextFormat.Snippet;
					ci.insertText = ci.label + '[$0]';
					break;
				}
			}
			break;
		default:
			ci.kind = CompletionItemKind.Text; break;
	}
	return ci;
}