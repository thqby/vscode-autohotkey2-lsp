import { existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { CancellationToken, CompletionItem, CompletionItemKind, CompletionParams, DocumentSymbol, InsertTextFormat, SymbolKind, TextEdit } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { cleardetectcache, detectExpType, FuncNode, getClassMembers, getFuncCallInfo, searchNode, Variable } from './Lexer';
import { completionitem } from './localize';
import { ahkvars, completionItemCache, connection, dllcalltpe, extsettings, getDllExport, inBrowser, inWorkspaceFolders, lexers, libfuncs, Maybe, pathenv, winapis, workspaceFolders } from './common';

export async function completionProvider(params: CompletionParams, token: CancellationToken): Promise<Maybe<CompletionItem[]>> {
	if (token.isCancellationRequested || params.context?.triggerCharacter === null) return undefined;
	const { position, textDocument } = params, items: CompletionItem[] = [], vars: { [key: string]: any } = {}, txs: any = {};
	let scopenode: DocumentSymbol | undefined, other = true, triggerKind = params.context?.triggerKind;
	let uri = textDocument.uri.toLowerCase(), doc = lexers[uri], content = doc.buildContext(position, false);
	let quote = '', char = '', _low = '', percent = false, lt = content.linetext, triggerchar = lt.charAt(content.range.start.character - 1);
	let list = doc.relevance, cpitem: CompletionItem, temp: any, path: string, { line, character } = position;
	let expg = new RegExp(content.text.match(/[^\w]/) ? content.text.replace(/(.)/g, '$1.*') : '(' + content.text.replace(/(.)/g, '$1.*') + '|[^\\w])', 'i');
	let istr = doc.instrorcomm(position);
	if (istr === 1)
		return;
	if (istr) {
		if (triggerKind === 2)
			return;
		triggerchar = '';
	} else {
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
	if (!percent && triggerchar === '.' && content.pre.match(/^\s*#include/i))
		triggerchar = '###';
	if (temp = lt.match(/^\s*((class\s+(\w|[^\x00-\xff])+\s+)?(extends)|class)\s/i)) {
		if (triggerchar === '.') {
			if (temp[3]) {
				searchNode(doc, doc.buildContext(position, true).text.replace(/\.[^.]*$/, '').toLowerCase(), position, SymbolKind.Class)?.map(it => {
					getClassMembers(doc, it.node, true).map(it => {
						if (it.kind === SymbolKind.Class && !vars[_low = it.name.toLowerCase()] && expg.test(_low))
							items.push(convertNodeCompletion(it)), vars[_low] = true;
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
			let c = doc.buildContext(position, true);
			if (c.text.match(/\b\d+\.$/) || c.linetext.match(/\s\.$/))
				return;
			content.pre = c.text.slice(0, content.text === '' && content.pre.match(/\.$/) ? -1 : -content.text.length);
			content.text = c.text, content.kind = c.kind, content.linetext = c.linetext;;
			let p: any = content.pre.replace(/('|").*?(?<!`)\1/, `''`), t: any, unknown = true;
			let props: any = {}, l = '', isstatic = true, tps: any = [], isclass = false, isfunc = false, isobj = false, hasparams = false;
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
			for (const node of tps) {
				switch (node.kind) {
					case SymbolKind.Class:
						let mems = getClassMembers(doc, node, isstatic);
						mems.map((it: any) => {
							if (expg.test(it.name)) {
								if (it.kind === SymbolKind.Property || it.kind === SymbolKind.Class) {
									if (!props[l = it.name.toLowerCase()])
										items.push(props[l] = convertNodeCompletion(it));
									else if (props[l].detail !== it.full)
										props[l].detail = '(...) ' + it.name, props[l].insertText = it.name;
								} else if (it.kind === SymbolKind.Method) {
									if (!it.name.match(/^__(get|set|call|new|delete)$/i)) {
										if (!props[l = it.name.toLowerCase()])
											items.push(props[l] = convertNodeCompletion(it));
										else if (props[l].detail !== it.full)
											props[l].detail = '(...) ' + it.name + '()', props[l].documentation = '';
									}
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
				if ((isobj && cl === 'object') || (isfunc && cl === 'func') || (isclass && cl === 'class') || !ahkvars[cl].children)
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
					if (expg.test(_low = it.name.toLowerCase()))
						if (!props[_low])
							items.push(props[_low] = convertNodeCompletion(it));
						else if (props[_low].detail !== it.full)
							props[_low].detail = '(...) ' + it.name, props[_low].insertText = it.name, props[_low].documentation = undefined;
				});
			}
			return items;
		default:
			if (lt.match(/^\s*#include/i)) {
				if (inBrowser)
					return;
				let tt = lt.replace(/^\s*#include(again)?\s+/i, '').replace(/\s*\*i\s+/i, ''), paths: string[] = [], inlib = false, lchar = '';
				let pre = lt.substring(lt.length - tt.length, position.character), xg = '\\', m: any, a_ = '';
				if (percent) {
					completionItemCache.other.map(it => {
						if (it.kind === CompletionItemKind.Variable && expg.test(it.label))
							items.push(it);
					})
					return items;
				} else if (pre.charAt(0).match(/['"<]/)) {
					if (pre.substring(1).match(/['">]/)) return;
					else {
						if ((lchar = pre.charAt(0)) === '<')
							inlib = true, paths = doc.libdirs;
						else if (temp = doc.includedir.get(position.line))
							paths = [temp];
						else paths = [doc.scriptpath];
						pre = pre.substring(1), lchar = lchar === '<' ? '>' : lchar;
						if (lt.substring(position.character).indexOf(lchar) !== -1)
							lchar = '';
					}
				} else if (pre.match(/\s+;/))
					return;
				else if (temp = doc.includedir.get(position.line))
					paths = [temp];
				else paths = [doc.scriptpath];
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
				let extreg = inlib ? new RegExp(/\.ahk$/i) : new RegExp(/\.(ahk2?|ah2)$/i), ts = tt.replace(/['"<>]/g, '').replace(/^.*[\\/]/, '');
				let expg = new RegExp((ts.match(/[^\w]/) ? ts.replace(/(.)/g, '$1.*') : '(' + ts.replace(/(.)/g, '$1.*') + '|[^\\w])').replace(/\.\./, '\\..'), 'i');
				let textedit: TextEdit | undefined;
				if (ts.includes('.'))
					textedit = TextEdit.replace({ start: { line: position.line, character: position.character - ts.length }, end: position }, '');
				for (let path of paths) {
					if (!existsSync(path = resolve(path, pre) + '\\') || !statSync(path).isDirectory())
						continue;
					for (let it of readdirSync(path)) {
						try {
							if (statSync(path + it).isDirectory()) {
								if (expg.test(it)) {
									cpitem = CompletionItem.create(it), cpitem.kind = CompletionItemKind.Folder;
									cpitem.command = { title: 'Trigger Suggest', command: 'editor.action.triggerSuggest' };
									if (textedit)
										cpitem.textEdit = Object.assign({}, textedit, { newText: cpitem.label + xg });
									else
										cpitem.insertText = cpitem.label + xg;
									items.push(cpitem);
								}
							} else if (extreg.test(it) && expg.test(inlib ? it = it.replace(extreg, '') : it)) {
								cpitem = CompletionItem.create(it), cpitem.kind = CompletionItemKind.File;
								if (textedit)
									cpitem.textEdit = Object.assign({}, textedit, { newText: cpitem.label + lchar });
								else
									cpitem.insertText = cpitem.label + lchar;
								items.push(cpitem);
							}
						} catch (err) { };
					}
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
				let res = getFuncCallInfo(doc, position), t: any;
				if (res) {
					switch (res.name) {
						case 'add':
							if (res.index === 0 && lt.charAt(res.pos.character - 1) === '.') {
								let c = doc.buildContext(res.pos, true), n = searchNode(doc, c.text, res.pos, SymbolKind.Method);
								if (n && (<FuncNode>n[0].node).full?.match(/\(gui\)\s+add\(/i)) {
									return ['Text', 'Edit', 'UpDown', 'Picture', 'Button', 'Checkbox', 'Radio', 'DropDownList',
										'ComboBox', 'ListBox', 'ListView', 'TreeView', 'Link', 'Hotkey', 'DateTime', 'MonthCal',
										'Slider', 'Progress', 'GroupBox', 'Tab', 'Tab2', 'Tab3', 'StatusBar', 'ActiveX', 'Custom'].map(maptextitem);
								}
							}
							break;
						case 'dynacall':
							if (res.index !== 0)
								break;
						case 'dllcall':
							if (res.index === 0) {
								if (inBrowser) break;
								let offset = doc.document.offsetAt(res.pos), tks = Object.values(doc.tokens), index = tks.findIndex(it => it.offset === offset);
								if (index > -1) {
									index++;
									while (tks[index] && (tks[index].type.endsWith('COMMENT') || tks[index].content === '(')) index++;
									if (tks[index] && tks[index].type === 'TK_STRING') {
										let offset = doc.document.offsetAt(position);
										if (offset > tks[index].offset && offset <= tks[index].offset + tks[index].length) {
											let pre = tks[index].content.substring(1, offset - tks[index].offset);
											if (!pre.match(/[\\/]/)) {
												readdirSync('C:\\Windows\\System32').map(file => {
													if (file.toLowerCase().endsWith('.dll') && expg.test(file = file.slice(0, -4)))
														items.push(cpitem = CompletionItem.create(file)), cpitem.kind = CompletionItemKind.File;
												});
												winapis.map(f => {
													if (expg.test(f))
														items.push(cpitem = CompletionItem.create(f)), cpitem.kind = CompletionItemKind.Function;
												});
												return items;
											} else {
												items.splice(0);
												getDllExport([pre.replace(/[\\/]\w*$/, '')]).map(it => { items.push(cpitem = CompletionItem.create(it)), cpitem.kind = CompletionItemKind.Function; });
												return items;
											}
										}
									}
								}
							} else if (res.index > 0 && res.index % 2 === 1) {
								for (const name of ['cdecl'].concat(dllcalltpe))
									cpitem = CompletionItem.create(name), cpitem.commitCharacters = ['*'], cpitem.kind = CompletionItemKind.TypeParameter, items.push(cpitem);
								return items;
							}
							break;
						case 'comcall':
							if (res.index > 1 && res.index % 2 === 0) {
								for (const name of ['cdecl'].concat(dllcalltpe))
									cpitem = CompletionItem.create(name), cpitem.commitCharacters = ['*'], cpitem.kind = CompletionItemKind.TypeParameter, items.push(cpitem);
								return items;
							}
							break;
						case 'numget':
							if (res.index === 2 || res.index === 1) {
								for (const name of dllcalltpe.filter(v => (v.match(/str$/i) ? false : true)))
									cpitem = CompletionItem.create(name), cpitem.kind = CompletionItemKind.TypeParameter, items.push(cpitem);
								return items;
							}
							break;
						case 'numput':
							if (res.index % 2 === 0) {
								for (const name of dllcalltpe.filter(v => (v.match(/str$/i) ? false : true)))
									cpitem = CompletionItem.create(name), cpitem.kind = CompletionItemKind.TypeParameter, items.push(cpitem);
								return items;
							}
							break;
						case 'objbindmethod':
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
												getClassMembers(doc, it.node, !tp.match(/[@#][^.]+$/)).map(it => {
													if (it.kind === SymbolKind.Method && !funcs[temp = it.name.toLowerCase()] && expg.test(temp)) {
														funcs[temp] = true, cpitem = CompletionItem.create(it.name), cpitem.kind = CompletionItemKind.Method, items.push(cpitem);
													}
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
												funcs[it] = true, cpitem = CompletionItem.create(med[it][0].name),
													cpitem.kind = CompletionItemKind.Method, items.push(cpitem);
								}
								return items;
							}
							break;
						case 'processsetpriority':
							if (res.index === 0)
								return ['Low', 'BelowNormal', 'Normal', 'AboveNormal', 'High', 'Realtime'].map(maptextitem);
							break;
						case 'thread':
							if (res.index === 0)
								return ['NoTimers', 'Priority', 'Interrupt'].map(maptextitem);
							break;
						case 'settitlematchmode':
							if (res.index === 0)
								return ['Fast', 'Slow', 'RegEx'].map(maptextitem);
							break;
						case 'setnumlockstate':
						case 'setcapslockstate':
						case 'setscrolllockstate':
							if (res.index === 0)
								return ['On', 'Off', 'AlwaysOn', 'AlwaysOff'].map(maptextitem);
							break;
						case 'sendmode':
							if (res.index === 0)
								return ['Event', 'Input', 'InputThenPlay', 'Play'].map(maptextitem);
							break;
						case 'blockinput':
							if (res.index === 0)
								return ['On', 'Off', 'Send', 'Mouse', 'SendAndMouse', 'Default', 'MouseMove', 'MouseMoveOff'].map(maptextitem);
							break;
						case 'coordmode':
							if (res.index === 0)
								return ['ToolTip', 'Pixel', 'Mouse', 'Caret', 'Menu'].map(maptextitem);
							else if (res.index === 1)
								return ['Screen', 'Window', 'Client'].map(maptextitem);
							break;
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
						txs[t] = true, items.push(cpitem = CompletionItem.create(doc.texts[t])), cpitem.kind = CompletionItemKind.Text;
				for (const u in list)
					for (const t in (temp = lexers[u].texts))
						if (!txs[t] && expg.test(t))
							txs[t] = true, items.push(cpitem = CompletionItem.create(temp[t])), cpitem.kind = CompletionItemKind.Text;
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
						})
						if (position.line === scopenode.range.end.line && position.character > scopenode.range.end.character)
							return undefined;
						return its;
					} else if (t.match(/^(static\s+)?(\w|[^\x00-\xff])+(\(|$)/i))
						return undefined;
				} else if (scopenode.kind === SymbolKind.Property && scopenode.children)
					return [{ label: 'get', kind: CompletionItemKind.Function }, { label: 'set', kind: CompletionItemKind.Function }]
			}
			for (const n in ahkvars)
				if (expg.test(n))
					vars[n] = convertNodeCompletion(ahkvars[n]);
			Object.values(doc.declaration).map(it => {
				if (expg.test(_low = it.name.toLowerCase()) && !ateditpos(it) && (!vars[_low] || it.kind !== SymbolKind.Variable))
					vars[_low] = convertNodeCompletion(it);
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
					if (expg.test(_low = it.name.toLowerCase()) && (!vars[_low] || it.kind !== SymbolKind.Variable || (<Variable>it).returntypes))
						vars[_low] = convertNodeCompletion(it);
				});
			}
			completionItemCache.other.map(it => {
				if (expg.test(it.label)) {
					if (it.kind === CompletionItemKind.Text) {
						if (!scopenode && !percent)
							items.push(it);
					} else if (it.kind === CompletionItemKind.Function) {
						if (!vars[_low = it.label.toLowerCase()])
							vars[_low] = it;
					} else
						items.push(it);
				}
			});
			let dir = inWorkspaceFolders(doc.document.uri) || doc.document.uri.toLowerCase(), exportnum = 0;
			if (extsettings.AutoLibInclude)
				for (const u in libfuncs) {
					if (!list || !list[u]) {
						path = URI.parse(u).fsPath;
						if ((extsettings.AutoLibInclude > 1 && (<any>libfuncs[u]).islib) || ((extsettings.AutoLibInclude & 1) && u.startsWith(dir))) {
							libfuncs[u].map(it => {
								if (!vars[_low = it.name.toLowerCase()] && expg.test(_low)) {
									cpitem = convertNodeCompletion(it);
									cpitem.detail = `${completionitem.include(path)}  ` + (cpitem.detail || '');
									cpitem.command = { title: 'ahk2.fix.include', command: 'ahk2.fix.include', arguments: [path, uri] };
									delete cpitem.commitCharacters;
									vars[_low] = cpitem, exportnum++;
								}
							});
							if (exportnum > 300)
								break;
						}
					}
				}
			scopenode?.children?.map(it => {
				if (!vars[_low = it.name.toLowerCase()] && expg.test(_low) && !ateditpos(it))
					vars[_low] = convertNodeCompletion(it);
			});
			if (other)
				addOther();
			return items.concat(Object.values(vars));
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
			if (extsettings.completeFunctionParens) {
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