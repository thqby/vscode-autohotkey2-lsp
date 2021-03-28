import { existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { CancellationToken, CompletionItem, CompletionItemKind, CompletionParams, DocumentSymbol, InsertTextFormat, SymbolKind } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { detectExpType, FuncNode, getClassMembers, getFuncCallInfo, searchNode } from './Lexer';
import { completionitem } from './localize';
import { ahkvars, completionItemCache, dllcalltpe, lexers, libfuncs, Maybe, pathenv, workfolder } from './server';

export async function completionProvider(params: CompletionParams, token: CancellationToken): Promise<Maybe<CompletionItem[]>> {
	if (token.isCancellationRequested) return undefined;
	const { position, textDocument } = params, items: CompletionItem[] = [], vars: { [key: string]: any } = {}, funcs: { [key: string]: any } = {}, txs: any = {};
	let scopenode: DocumentSymbol | undefined, other = true, triggerKind = params.context?.triggerKind;
	let uri = textDocument.uri.toLowerCase(), doc = lexers[uri], content = doc.buildContext(position, false), nodes: DocumentSymbol[];
	let quote = '', char = '', _low = '', percent = false, linetext = content.linetext, triggerchar = linetext.charAt(content.range.start.character - 1);
	let list = doc.relevance, cpitem: CompletionItem, temp: any, path: string, { line, character } = position;
	['new', 'delete', 'get', 'set', 'call'].map(it => { funcs['__' + it] = true; });
	for (let i = 0; i < position.character; i++) {
		char = linetext.charAt(i);
		if (quote === char) {
			if (linetext.charAt(i - 1) === '`')
				continue;
			else quote = '', percent = false;
		} else if (char === '%') {
			percent = !percent;
		} else if (quote === '' && (char === '"' || char === "'") && (i === 0 || linetext.charAt(i - 1).match(/[([%,\s]/)))
			quote = char;
	}
	if (quote || (triggerchar !== '.' && triggerchar !== '#'))
		triggerchar = '';
	if (!percent && triggerchar === '.' && content.pre.match(/^\s*#include/i))
		triggerchar = '';
	if (temp = linetext.match(/^\s*((class\s+\S+\s+)?(extends)|class)\s/i)) {
		if (triggerchar === '.') {
			if (temp[3]) {
				searchNode(doc, doc.buildContext(position, true).text.replace(/\.[^.]*$/, ''), position, SymbolKind.Class)?.map(it => {
					getClassMembers(doc, it.node, true).map(it => {
						if (it.kind === SymbolKind.Class && !vars[_low = it.name.toLowerCase()])
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
			for (const name in g) {
				if (g[name].kind === SymbolKind.Class && !vars[name])
					items.push(convertNodeCompletion(g[name])), vars[name] = true;
			}
		});
		for (const cl in ahkvars)
			if (ahkvars[cl].kind === SymbolKind.Class && !vars[cl])
				items.push(convertNodeCompletion(ahkvars[cl])), vars[cl] = true;
		return items;
	}
	switch (triggerchar) {
		case '#':
			items.push(...completionItemCache.sharp);
			return items;
		case '.':
			let c = doc.buildContext(position, true);
			content.pre = c.text.slice(0, content.text === '' && content.pre.match(/\.$/) ? -1 : -content.text.length);
			content.text = c.text, content.kind = c.kind, content.linetext = c.linetext;;
			let p: any = content.pre.replace(/('|").*?(?<!`)\1/, `''`), t: any, unknown = true;
			let props: any = {}, l = '', isstatic = true, tps: any = [], isclass = false, isfunc = false, isobj = false, hasparams = false;
			let ts: any = {};
			p = content.pre.toLowerCase();
			detectExpType(doc, p, position, ts);
			if (ts['#any'] === undefined)
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
			for (const node of tps) {
				switch (node.kind) {
					case SymbolKind.Class:
						isclass = isobj = true;
						let mems = getClassMembers(doc, node, isstatic);
						mems.map((it: any) => {
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
								} else if (it.name.toLowerCase() === '__new' && (<FuncNode>it).params.length)
									hasparams = true;
							}
						});
						if (node.name.match(/^(number|string)$/i))
							isclass = false;
						break;
					case SymbolKind.Object:
						isobj = true; break;
				}
			}
			if (isobj)
				getClassMembers(doc, ahkvars['object'], false).map((it: any) => {
					_low = it.name.toLowerCase();
					if (it.kind === SymbolKind.Property) {
						if (!props[_low])
							items.push(props[_low] = convertNodeCompletion(it));
					} else if (isclass && it.kind === SymbolKind.Method) {
						if (!props[_low])
							items.push(props[_low] = convertNodeCompletion(it));
					}
				});
			if (isclass && isstatic) {
				if (!props['prototype'])
					items.push(p = CompletionItem.create('Prototype')), props['prototype'] = p, p.kind = CompletionItemKind.Property, p.detail = completionitem.prototype();
				if (!props['call'])
					items.push(p = CompletionItem.create('Call')), props['call'] = p, p.kind = CompletionItemKind.Method, p.detail = completionitem._new(), p.insertText = `Call(${hasparams ? '$0' : ''})`, p.insertTextFormat = InsertTextFormat.Snippet;
			}
			if (!unknown && (triggerKind !== 1 || content.text.match(/\..{0,2}$/)))
				return items;
			let objs = [doc.object];
			for (const uri in list)
				objs.push(lexers[uri].object);
			for (const obj of objs) {
				for (const it in obj.property)
					if (!props[it])
						items.push(props[it] = convertNodeCompletion({ name: obj.property[it], kind: SymbolKind.Property }));
					else props[it].detail = props[it].label;
				for (const it in obj.method)
					if (!props[it])
						items.push(props[it] = convertNodeCompletion(obj.method[it][0]));
					else if (typeof props[it] === 'object')
						props[it].detail = '(...) ' + props[it].label;
				for (const it in obj.userdef)
					if (!props[it])
						items.push(props[it] = convertNodeCompletion(obj.userdef[it]));
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
					_low = it.name.toLowerCase();
					if (!props[_low])
						items.push(props[_low] = convertNodeCompletion(it));
					else if (props[_low].detail !== it.full)
						props[_low].detail = '(...) ' + it.name, props[_low].insertText = it.name, props[_low].documentation = undefined;
				});
			}
			return items;
		default:
			if (linetext.match(/^\s*#include/i)) {
				let tt = linetext.replace(/^\s*#include(again)?\s+/i, '').replace(/\s*\*i\s+/i, ''), paths: string[] = [], inlib = false, lchar = '';
				let pre = linetext.substring(linetext.length - tt.length, position.character), xg = '\\', m: any, a_ = '';
				if (percent) {
					completionItemCache.other.map(it => {
						if (it.kind === CompletionItemKind.Variable)
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
						if (linetext.substring(position.character).indexOf(lchar) !== -1)
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
					else return;
				if (pre.charAt(pre.length - 1) === '/')
					xg = '/';
				for (let path of paths) {
					if (!existsSync(path = resolve(path, pre) + '\\')) continue;
					for (const it of readdirSync(path)) {
						try {
							if (inlib) {
								if (it.match(/\.ahk$/i))
									cpitem = CompletionItem.create(it.replace(/\.ahk/i, '')), cpitem.insertText = cpitem.label + lchar,
										cpitem.kind = CompletionItemKind.File, items.push(cpitem);
							} else if (statSync(path + it).isDirectory())
								cpitem = CompletionItem.create(it), cpitem.insertText = cpitem.label + xg,
									cpitem.command = { title: 'Trigger Suggest', command: 'editor.action.triggerSuggest' },
									cpitem.kind = CompletionItemKind.Folder, items.push(cpitem);
							else if (it.match(/\.(ahk2?|ah2)$/i))
								cpitem = CompletionItem.create(it), cpitem.insertText = cpitem.label + lchar,
									cpitem.kind = CompletionItemKind.File, items.push(cpitem);
						} catch (err) { };
					}
				}
				return items;
			} else if (temp = linetext.match(/(?<!\.)\b(goto|continue|break)\b(?!\s*:)(\s+|\(\s*('|")?)/i)) {
				let t = temp[2].trim();
				if (scopenode = doc.searchScopedNode(position))
					scopenode.children?.map(it => {
						if (it.kind === SymbolKind.Field)
							items.push(convertNodeCompletion(it));
					});
				else {
					doc.children.map(it => {
						if (it.kind === SymbolKind.Field)
							items.push(convertNodeCompletion(it));
					});
					for (const t in list) lexers[t].children.map(it => {
						if (it.kind === SymbolKind.Field)
							items.push(convertNodeCompletion(it));
					});
				}
				if (t === '' || temp[3])
					return items;
				else for (let it of items)
					it.insertText = `'${it.insertText}'`;
			} else if (quote) {
				let res = getFuncCallInfo(doc, position);
				if (res) {
					switch (res.name) {
						case 'add':
							if (res.index === 0 && linetext.charAt(res.pos.character - 1) === '.') {
								let c = doc.buildContext(res.pos, true), n = searchNode(doc, c.text, res.pos, SymbolKind.Method);
								if (n && (<FuncNode>n[0].node).full?.match(/\(gui\)\s+add\(/i)) {
									return ['Text', 'Edit', 'UpDown', 'Picture', 'Button', 'Checkbox', 'Radio', 'DropDownList', 'ComboBox', 'ListBox', 'ListView', 'TreeView', 'Link', 'Hotkey', 'DateTime', 'MonthCal', 'Slider', 'Progress', 'GroupBox', 'Tab', 'Tab2', 'Tab3', 'StatusBar', 'ActiveX', 'Custom'].map(name => {
										cpitem = CompletionItem.create(name), cpitem.kind = CompletionItemKind.Text, cpitem.command = { title: 'cursorRight', command: 'cursorRight' };
										return cpitem;
									});
								}
							}
							break;
						case 'dllcall':
							if (res.index === 0) {

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
								let ns: any;
								if (temp = content.pre.match(/objbindmethod\(\s*(([\w.]|[^\x00-\xff])+)\s*,/i)) {
									let ts: any = {};
									detectExpType(doc, temp[1], position, ts);
									if (ts['#any'] === undefined) {
										for (const tp in ts) {
											if (ts[tp] === false) {
												ns = searchNode(doc, tp, position, SymbolKind.Class);
											} else if (ts[tp])
												ns = [ts[tp]];
											ns?.map((it: any) => {
												getClassMembers(doc, it.node, !tp.match(/[@#][^.]+$/)).map(it => {
													if (it.kind === SymbolKind.Method && !funcs[temp = it.name.toLowerCase()]) {
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
											if (!funcs[it])
												funcs[it] = true, cpitem = CompletionItem.create(med[it][0].name),
													cpitem.kind = CompletionItemKind.Method, items.push(cpitem);
								}
								let defs = [doc.object.userdef];
								for (const uri in list)
									defs.push(lexers[uri].object.userdef);
								defs.map(def => {
									for (const name in def) {
										if (!funcs[name])
											funcs[name] = true, cpitem = CompletionItem.create(def[name].name), cpitem.kind = CompletionItemKind.Method, items.push(cpitem);
									}
								});
								return items;
							}
							break;
						case 'processsetpriority':
							if (res.index === 0) {
								return ['Low', 'BelowNormal', 'Normal', 'AboveNormal', 'High', 'Realtime'].map(name => {
									cpitem = CompletionItem.create(name), cpitem.kind = CompletionItemKind.Text, cpitem.command = { title: 'cursorRight', command: 'cursorRight' };
									return cpitem;
								});
							}
							break;
					}
				}
				if (other)
					completionItemCache.other.map(value => {
						if (value.kind === CompletionItemKind.Text)
							vars[value.label.toLowerCase()] = true, items.push(value);
					});
				for (const t in vars)
					txs[t] = true;
				for (const t in funcs) txs[t] = true;
				for (const t in doc.texts)
					if (!txs[t])
						txs[t] = true, items.push(cpitem = CompletionItem.create(doc.texts[t])), cpitem.kind = CompletionItemKind.Text;
				for (const u in list)
					for (const t in (temp = lexers[u].texts))
						if (!txs[t])
							txs[t] = true, items.push(cpitem = CompletionItem.create(temp[t])), cpitem.kind = CompletionItemKind.Text;
				return items;
			} else
				other = !percent;
			scopenode = doc.searchScopedNode(position);
			if (scopenode && scopenode.kind === SymbolKind.Class) {
				let its: CompletionItem[] = [], t = linetext.trim();
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
					return its;
				} else if (t.match(/^(static\s+)?(\w|[^\x00-\xff])+(\(|$)/i))
					return undefined;
			}
			for (const n in ahkvars)
				vars[n] = convertNodeCompletion(ahkvars[n]);
			for (const n in doc.declaration) {
				const item = doc.declaration[n];
				if (item.range.end.line === line && item.range.start.character <= character && character <= item.range.end.character)
					continue;
				vars[n] = convertNodeCompletion(item);
			}
			for (const t in list) {
				path = list[t].path;
				for (const n in (temp = lexers[t]?.declaration)) {
					if (!vars[n] || (vars[n].kind === CompletionItemKind.Variable && temp[n].kind !== SymbolKind.Variable)) {
						cpitem = convertNodeCompletion(temp[n]), cpitem.detail = `${completionitem.include(path)}  ` + (cpitem.detail || '');
						vars[n] = cpitem;
					}
				}
			}
			if (scopenode) {
				doc.getScopeChildren(scopenode).map(it => {
					vars[it.name.toLowerCase()] = convertNodeCompletion(it);
				});
			}
			completionItemCache.other.map(it => {
				if (it.kind === CompletionItemKind.Text) {
					if (!scopenode && !percent)
						items.push(it);
				} else if (it.kind === CompletionItemKind.Function) {
					if (!vars[_low = it.label.toLowerCase()])
						vars[_low] = it;
				} else
					items.push(it);
			});
			let dir = (workfolder && doc.scriptpath.startsWith(workfolder + '\\') ? workfolder : doc.scriptdir);
			for (const u in libfuncs) {
				if (!list || !list[u]) {
					path = URI.parse(u).fsPath;
					if ((<any>libfuncs[u]).islib || path.startsWith(dir + '\\'))
						libfuncs[u].map(it => {
							if (!vars[_low = it.name.toLowerCase()]) {
								cpitem = convertNodeCompletion(it), cpitem.insertText = cpitem.label + '($0)', cpitem.insertTextFormat = 2;
								cpitem.detail = `${completionitem.include(path)}  ` + (cpitem.detail || '');
								delete cpitem.commitCharacters;
								cpitem.command = { title: 'ahk2.fix.include', command: 'ahk2.fix.include', arguments: [path, uri] };
								vars[_low] = cpitem;
							}
						});
				}
			}
			if (other)
				addOther();
			return items.concat(Object.values(vars));
	}
	function addOther() {
		items.push(...completionItemCache.snippet);
		if (triggerKind === 1 && content.text.length > 2 && content.text.match(/^[a-z]+_/i)) {
			const rg = new RegExp(content.text.replace(/(.)/g, '$1.*'), 'i'), constants = completionItemCache.constant;
			for (const it of constants)
				if (rg.test(it.label))
					items.push(it);
		}
	}
}

function convertNodeCompletion(info: any): CompletionItem {
	let ci = CompletionItem.create(info.name);
	switch (info.kind) {
		case SymbolKind.Function:
		case SymbolKind.Method:
			ci.kind = info.kind === SymbolKind.Method ? CompletionItemKind.Method : CompletionItemKind.Function;
			ci.command = { title: 'ahk2.parameterhints', command: 'ahk2.parameterhints' };
			ci.commitCharacters = ['.', '('];
			if ((<FuncNode>info).params.length) {
				if ((<FuncNode>info).params[0].name.includes('|')) {
					ci.insertText = ci.label + '(${1|' + (<FuncNode>info).params[0].name.replace(/\|/g, ',') + '|})';
					ci.command = { title: 'Trigger Parameter Hints', command: 'editor.action.triggerParameterHints' };
					ci.insertTextFormat = InsertTextFormat.Snippet, delete ci.commitCharacters;
				}
			}
			ci.detail = info.full, ci.documentation = info.detail; break;
		case SymbolKind.Variable:
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