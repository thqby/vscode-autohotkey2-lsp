import { existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { CancellationToken, CompletionItem, CompletionItemKind, CompletionParams, DocumentSymbol, InsertTextFormat, Range, SymbolKind } from 'vscode-languageserver';
import { detectExp, detectExpType, detectVariableType, FuncNode, FuncScope, getClassMembers, getFuncCallInfo, searchNode } from './Lexer';
import { ahkclasses, ahkfunctions, completionItemCache, lexers, Maybe, pathenv } from './server';

export async function completionProvider(params: CompletionParams, token: CancellationToken): Promise<Maybe<CompletionItem[]>> {
	if (token.isCancellationRequested) return undefined;
	const { position, textDocument } = params, items: CompletionItem[] = [], vars: { [key: string]: any } = {}, funcs: { [key: string]: any } = {}, txs: any = {};
	let scopenode: DocumentSymbol | undefined, other = true, triggerKind = params.context?.triggerKind;
	let uri = textDocument.uri.toLowerCase(), doc = lexers[uri], content = doc.buildContext(position, false), nodes: DocumentSymbol[];
	let quote = '', char = '', _low = '', percent = false, linetext = content.linetext, prechar = linetext.charAt(content.range.start.character - 1);
	let list = doc.relevance, cpitem: CompletionItem, scope: FuncScope = FuncScope.GLOBAL, temp: any, path: string, { line, character } = position;
	['new', 'delete', 'get', 'set', 'call'].map(it => { funcs['__' + it] = true; });
	for (let i = 0; i < position.character; i++) {
		char = linetext.charAt(i);
		if (quote === char) {
			if (linetext.charAt(i - 1) === '`')
				continue;
			else quote = '', percent = false;
		} else if (char === '%') {
			percent = !percent;
		} else if (quote === '' && (char === '"' || char === "'"))
			quote = char;
	}
	if (quote || (prechar !== '.' && prechar !== '#'))
		prechar = '';
	if (!percent && prechar === '.' && content.pre.match(/^\s*#include/i))
		prechar = '';
	switch (prechar) {
		case '#':
			items.push(...completionItemCache.sharp);
			return items;
		case '.':
			let c = doc.buildContext(position, true);
			content.pre = c.text.slice(0, content.text === '' && content.pre.match(/\.$/) ? -1 : -content.text.length);
			content.text = c.text, content.kind = c.kind, content.linetext = c.linetext;;
			let p: any = content.pre.replace(/('|").*?(?<!`)\1/, `''`), t: any, unknown = true;
			let props: any = {}, meds: any = {}, l = '', isstatic = true, tps: any = [], isclass = false, isobj = false, hasparams = false;
			while (t = p.match(/\([^\(\)]+\)/))
				p = p.replace(t[0], '()');
			p = p.replace(/(\.new\(\))?\.?$/i, (...m: string[]) => {
				if (m[1])
					isstatic = false;
				return '';
			});
			if (!(t = p.match(/^[^\d]\w*(\.\w+)*$/))) {
				if (isstatic) {
					let ts: any = {};
					p = content.pre.toLowerCase();
					detectExpType(doc, p, position, ts);
					if (!ts['#any'])
						for (const tp in ts) {
							unknown = false;
							searchNode(doc, tp.replace(/^@/, ''), position, [SymbolKind.Class, SymbolKind.Variable])?.map(it => {
								tps.push(it.node);
								isstatic = false;
							});
						}
				}
			} else {
				t = t[0].toLowerCase();
				if (p = searchNode(doc, t, position, [SymbolKind.Class, SymbolKind.Variable])) {
					let node = p[0].node;
					if (node.kind === SymbolKind.Property) {
						if (node.typeexp && node.full?.charAt(0) === '(') {
							let ts: any = {};
							detectExp(doc, node.typeexp.toLowerCase(), node.range.start,
								lexers[p[0].uri].document.getText(Range.create(node.selectionRange.end, node.range.end))).map(tp => ts[tp] = true);
							if (!ts['#any'])
								for (const tp in ts) {
									unknown = false;
									searchNode(doc, tp.replace(/^@/, ''), position, [SymbolKind.Class, SymbolKind.Variable])?.map(it => {
										tps.push(it.node);
										isstatic = false;
									});
								}
						}
					} else if (node.kind !== SymbolKind.Class && node.kind !== SymbolKind.Object) {
						isstatic = false;
						for (const tp of detectVariableType(lexers[uri], node.name.toLowerCase(), position)) {
							unknown = false;
							searchNode(doc, tp.replace(/^@/, ''), position, [SymbolKind.Class, SymbolKind.Variable])?.map(it => { tps.push(it.node) });
						}
					} else
						tps.push(node), unknown = false, isstatic = isstatic && !(p[0].ref);
				}
			}
			for (const node of tps) {
				switch (node.kind) {
					case SymbolKind.Class:
						isclass = isobj = true;
						let mems = getClassMembers(doc, node, isstatic);
						mems.map(it => {
							if (it.kind === SymbolKind.Property || it.kind === SymbolKind.Class) {
								if (!props[l = it.name.toLowerCase()])
									items.push(props[l] = convertNodeCompletion(it));
								else props[l].detail = '(...) ' + it.name;
							} else if (it.kind === SymbolKind.Method) {
								if (!it.name.match(/^__(get|set|call|new|delete)$/i)) {
									if (!meds[l = it.name.toLowerCase()])
										items.push(meds[l] = convertNodeCompletion(it));
									else meds[l].detail = '(...) ' + it.name + '()', meds[l].documentation = '';
								} else if (it.name.toLowerCase() === '__new' && (<FuncNode>it).params.length)
									hasparams = true;
							}
						});
						break;
					case SymbolKind.Object:
						// (<DocumentSymbol>node).children?.map()
						isobj = true; break;
				}
			}
			if (isobj)
				ahkclasses['object'].map(it => {
					if (!meds[it.name.toLowerCase()])
						items.push(convertNodeCompletion(it));
				});
			if (isclass && isstatic) {
				items.push(p = CompletionItem.create('Prototype'));
				p.kind = CompletionItemKind.Property, p.detail = '检索或设置类的所有实例所基于的对象.';
				items.push(p = CompletionItem.create('New'));
				p.kind = CompletionItemKind.Method, p.detail = '构造类的新实例.', p.insertText = `New(${hasparams ? '$0' : ''})`;
				p.insertTextFormat = InsertTextFormat.Snippet;
			}
			if (!unknown && (triggerKind !== 1 || content.text.match(/\.\w{0,2}$/)))
				return items;
			items.push(...completionItemCache.method);
			let objs = [doc.object];
			for (const uri in list)
				objs.push(lexers[uri].object);
			for (const obj of objs) {
				for (const it in obj['property'])
					if (!props[it])
						items.push(props[it] = convertNodeCompletion({ name: obj['property'][it], kind: SymbolKind.Property }));
					else props[it].detail = '(...) ' + props[it].label;
				for (const it in obj['method'])
					if (!funcs[it])
						items.push(funcs[it] = convertNodeCompletion(obj['method'][it][0]));
					else if (typeof funcs[it] === 'object')
						funcs[it].detail = '(...) ' + funcs[it].label;
			}
			return items;
		default:
			if (percent) {
				other = false, completionItemCache.other.map((value: CompletionItem) => {
					if (value.kind !== CompletionItemKind.Text)
						items.push(value);
				});
			} else if (linetext.match(/^\s*#include/i)) {
				let tt = linetext.replace(/^\s*#include(again)?\s+/i, '').replace(/\s*\*i\s+/i, ''), paths: string[] = [], inlib = false, lchar = '';
				let pre = linetext.substring(linetext.length - tt.length, position.character), xg = '\\', m: any, a_ = '';
				if (pre.charAt(0).match(/['"<]/)) {
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
					doc.getScopeChildren(scopenode).map(it => {
						if (it.kind === SymbolKind.Field)
							items.push(convertNodeCompletion(it));
					});
				else {
					doc.label.map(it => {
						items.push(convertNodeCompletion(it));
					});
					for (const t in list) lexers[t].label.map(it => {
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
						case 'func':
							if (res.index !== 0) break;
							for (const name in ahkfunctions)
								if (name.charAt(0) !== '.')
									cpitem = CompletionItem.create(ahkfunctions[name].name), cpitem.kind = CompletionItemKind.Function,
										items.push(cpitem), vars[name] = true;
							if (scopenode = doc.searchScopedNode(position)) {
								nodes = doc.getScopeChildren(scopenode);
								for (const it of nodes)
									if (it.kind === SymbolKind.Function && !vars[_low = it.name.toLowerCase()]) {
										vars[_low] = true, cpitem = CompletionItem.create(it.name),
											cpitem.kind = CompletionItemKind.Function, items.push(cpitem);
									}
							}
							for (const name in (temp = doc.function))
								if (!vars[name]) vars[name] = true, cpitem = CompletionItem.create(temp[name].name),
									cpitem.kind = CompletionItemKind.Function, items.push(cpitem);
							for (const t in list)
								for (const name in (temp = lexers[t].function))
									if (!vars[name])
										vars[name] = true, cpitem = CompletionItem.create(temp[name].name),
											cpitem.kind = CompletionItemKind.Function, items.push(cpitem);
							return items;
						case 'dllcall':
							if (res.index === 0) {

							} else if (res.index > 0 && res.index % 2 === 1) {
								for (const name of ['str', 'astr', 'wstr', 'int64', 'int', 'uint', 'short', 'ushort', 'char', 'uchar', 'float', 'double', 'ptr', 'uptr', 'HRESULT', 'cdecl'])
									cpitem = CompletionItem.create(name), cpitem.kind = CompletionItemKind.TypeParameter, items.push(cpitem);
								return items;
							}
							break;
						case 'comcall':
							if (res.index > 1 && res.index % 2 === 0) {
								for (const name of ['str', 'astr', 'wstr', 'int64', 'int', 'uint', 'short', 'ushort', 'char', 'uchar', 'float', 'double', 'ptr', 'uptr', 'HRESULT', 'cdecl'])
									cpitem = CompletionItem.create(name), cpitem.kind = CompletionItemKind.TypeParameter, items.push(cpitem);
								return items;
							}
							break;
						case 'objbindmethod':
							if (res.index === 1) {
								let meds = [doc.object.method];
								for (const uri in list)
									meds.push(lexers[uri].object.method);
								for (const med of meds)
									for (const it in med)
										if (!funcs[it])
											funcs[it] = true, cpitem = CompletionItem.create(med[it][0].name),
												cpitem.kind = CompletionItemKind.Method, items.push(cpitem);
								return items;
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
			} else {
				items.push(...completionItemCache.snippet);
				if (triggerKind === 1 && content.text.length > 2 && content.text.match(/^[a-z]+_/i)) {
					const rg = new RegExp(content.text.replace(/(.)/g, '$1.*'), 'i'), constants = completionItemCache.constant;
					for (const it of constants)
						if (rg.test(it.label))
							items.push(it);
				}
			}
			scopenode = doc.searchScopedNode(position);
			if (scopenode) {
				if (!linetext.match(/^\s*global\s/i)) {
					let s = (<FuncNode>scopenode).statement;
					if (!s) scope = FuncScope.DEFAULT;
					else if (s.assume & FuncScope.LOCAL)
						scope = FuncScope.LOCAL;
					else if (s.assume !== FuncScope.GLOBAL)
						scope = FuncScope.DEFAULT;
				}
				if (other)
					completionItemCache.other.map(value => {
						if (value.kind !== CompletionItemKind.Text)
							items.push(value);
					});
			} else if (other)
				items.push(...completionItemCache.other);
			if (scope === FuncScope.GLOBAL) {
				addGlobalVar();
				if (scopenode)
					addNodesIgnoreCurpos(doc.getScopeChildren(scopenode));
				addFunction();
				for (const name in (temp = doc.define)) {
					const item = temp[name];
					if (!vars[name] && !(item.range.end.line === line && item.range.start.character <= character && character <= item.range.end.character))
						vars[name] = true, items.push(convertNodeCompletion(item));
				}
				for (const t in list) {
					path = list[t].path;
					for (const name in (temp = lexers[t].define))
						if (!vars[name])
							vars[name] = true, addincludeitem(temp[name]);
				}
			} else {
				if (scope === FuncScope.DEFAULT) addGlobalVar();
				addNodesIgnoreCurpos(doc.getScopeChildren(scopenode)), addFunction();
			}
			return items;
	}
	function addincludeitem(item: DocumentSymbol) {
		cpitem = convertNodeCompletion(item), cpitem.detail = `从'${path}'自动导入  ` + (cpitem.detail || ''), items.push(cpitem);
	}
	function addNodesIgnoreCurpos(nodes: DocumentSymbol[]) {
		for (const item of nodes) {
			if (item.kind === SymbolKind.Variable) {
				if (!vars[_low = item.name.toLowerCase()] && !(item.range.end.line === line && item.range.start.character <= character && character <= item.range.end.character))
					vars[_low] = true, items.push(convertNodeCompletion(item));
			} else if (item.kind === SymbolKind.Function) {
				if (!funcs[_low = item.name.toLowerCase()])
					funcs[_low] = true, items.push(convertNodeCompletion(item));
			}
		}
	}
	function addGlobalVar() {
		for (const name in (temp = doc.global)) {
			const item = temp[name];
			if (!(item.range.end.line === line && item.range.start.character <= character && character <= item.range.end.character))
				vars[name] = true, items.push(convertNodeCompletion(item));
		}
		for (const t in list) {
			path = list[t].path;
			for (const name in (temp = lexers[t].global))
				if (!vars[name]) vars[name] = true, addincludeitem(temp[name]);
		}
	}
	function addFunction() {
		for (const name in (temp = doc.function))
			if (!funcs[name])
				funcs[name] = true, items.push(convertNodeCompletion(temp[name]));
		for (const t in list) {
			path = list[t].path;
			for (const name in (temp = lexers[t].function))
				if (!funcs[name]) funcs[name] = true, addincludeitem(temp[name]);
		}
	}
}

function convertNodeCompletion(info: any): CompletionItem {
	let ci = CompletionItem.create(info.name);
	switch (info.kind) {
		case SymbolKind.Function:
		case SymbolKind.Method:
			ci.kind = info.kind === SymbolKind.Method ? CompletionItemKind.Method : CompletionItemKind.Function;
			if ((<FuncNode>info).params.length) {
				if ((<FuncNode>info).params[0].name.includes('|')) {
					ci.insertText = ci.label + '(${1|' + (<FuncNode>info).params[0].name.replace(/\|/g, ',') + '|})';
				} else ci.insertText = ci.label + '($0)';
				ci.insertTextFormat = InsertTextFormat.Snippet;
				ci.command = { title: 'Trigger Parameter Hints', command: 'editor.action.triggerParameterHints' };
			} else ci.insertText = ci.label + '()';
			ci.detail = info.full, ci.documentation = info.detail; break;
		case SymbolKind.Variable:
			ci.kind = CompletionItemKind.Variable, ci.detail = info.detail; break;
		case SymbolKind.Class:
			ci.kind = CompletionItemKind.Class, ci.commitCharacters = ['.'];
			ci.detail = 'class ' + ci.label, ci.documentation = info.detail; break;
		case SymbolKind.Event:
			ci.kind = CompletionItemKind.Event; break;
		case SymbolKind.Field:
			ci.kind = CompletionItemKind.Field, ci.insertText = ci.label.replace(/:$/, ''); break;
		case SymbolKind.Property:
			ci.kind = CompletionItemKind.Property, ci.detail = (info.full || ci.label), ci.documentation = (info.detail || ''); break;
		default:
			ci.kind = CompletionItemKind.Text; break;
	}
	return ci;
}