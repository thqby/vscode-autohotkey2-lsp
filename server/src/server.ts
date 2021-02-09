/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as fs from "fs";
import { type } from 'os';
import { resolve } from 'path';
import { version } from 'process';
import {
	CancellationToken,
	CodeAction,
	CodeActionKind,
	Color, ColorInformation, ColorPresentation, Command, CompletionItem,
	CompletionItemKind, CompletionParams, createConnection,
	Definition, DefinitionParams, DidChangeConfigurationNotification,
	DocumentFormattingParams, DocumentRangeFormattingParams,
	DocumentSymbol, DocumentSymbolParams,
	FoldingRange, FoldingRangeParams, Hover, HoverParams, InitializeParams,
	InitializeResult, InsertTextFormat, Location, LocationLink,
	MarkupKind, Position, ProposedFeatures,
	Range, SignatureHelp, SignatureHelpParams, SymbolInformation, SymbolKind,
	TextDocumentChangeEvent, TextDocuments, TextDocumentSyncKind, TextEdit as TE
} from 'vscode-languageserver';
import {
	TextDocument, TextEdit
} from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { ClassNode, FuncNode, FuncScope, Lexer, Variable } from './Lexer';
import { runscript } from './scriptrunner';
export const languageServer = 'ahk2-language-server';
export let globalSettings: AHKLSSettings = {
	Path: 'C:\\Program Files\\AutoHotkey\\AutoHotkey32.exe'
}, libdirs: string[] = [], documentSettings: Map<string, Thenable<AHKLSSettings>> = new Map();

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all), documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
let hasConfigurationCapability: boolean = false, hasWorkspaceFolderCapability: boolean = false, hasDiagnosticRelatedInformationCapability: boolean = false;
let doctree: { [key: string]: Lexer } = {}, pathenv: { [key: string]: string } = {}, symbolcache: { uri: string, sym: SymbolInformation[] } = { uri: '', sym: [] };
let completionItemCache: { [key: string]: CompletionItem[] } = { sharp: [], method: [], other: [], constant: [], snippet: [] };
let hoverCache: { [key: string]: Hover[] }[] = [{}, {}], ahkclasses: { [key: string]: DocumentSymbol[] } = {}, ahkfunctions: { [key: string]: FuncNode } = {};
type Maybe<T> = T | undefined;
interface AHKLSSettings {
	Path: string;
}

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		serverInfo: {
			// The name of the server as defined by the server.
			name: languageServer,

			// The servers's version as defined by the server.
			// version: this.version,
		},
		capabilities: {
			textDocumentSync: {
				openClose: true,
				willSave: true,
				willSaveWaitUntil: true,
				change: TextDocumentSyncKind.Incremental
			},
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: ['.', '#', '_']
			},
			signatureHelpProvider: {
				triggerCharacters: ['(', ',']
			},
			documentSymbolProvider: true,
			definitionProvider: true,
			documentFormattingProvider: true,
			documentRangeFormattingProvider: true,
			hoverProvider: true,
			foldingRangeProvider: true,
			colorProvider: true,
			codeActionProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			// console.log('Workspace folder change event received.');
		});
	}
	initpathenv();
});

connection.onDidChangeConfiguration(async change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	}
	if (initpathenv())
		documents.all().forEach(validateTextDocument);
});

documents.onDidOpen(async e => {
	let uri = e.document.uri.toLowerCase(), docLexer = doctree[uri];
	if (!docLexer)
		docLexer = new Lexer(e.document), doctree[uri] = docLexer;
	else docLexer.document = e.document;
	docLexer.actived = true, docLexer.version = e.document.version;
	// docLexer.parseScript(), parseinclude(docLexer.include), sendDiagnostics();
	// if (docLexer.diagnostics.length) connection.sendDiagnostics({ uri: uri, diagnostics: docLexer.diagnostics });
	// if (!docLexer.relevance) docLexer.relevance = getincludetable(uri);
});

// Only keep settings for open documents
documents.onDidClose(async e => {
	let uri = e.document.uri.toLowerCase();
	documentSettings.delete(uri), doctree[uri].actived = false;
	for (let u in doctree)
		if (doctree[u].actived)
			for (let f in doctree[u].include)
				if (f === uri) return;
	delete doctree[uri];
	connection.sendDiagnostics({ uri, diagnostics: [] });
	let deldocs: string[] = [];
	for (let u in doctree)
		if (!doctree[u].actived) {
			let del = true;
			for (let f in doctree[u].include)
				if (doctree[f] && doctree[f].actived) {
					del = false; break;
				}
			if (del)
				deldocs.push(u);
		}
	for (let u of deldocs) {
		delete doctree[u];
		connection.sendDiagnostics({ uri: u, diagnostics: [] });
	}
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
	let document = change.document, uri = document.uri.toLowerCase(), docLexer = doctree[uri];
	if (!docLexer)
		docLexer = new Lexer(document), doctree[uri] = docLexer;
	let initial = docLexer.include, cg = false;
	docLexer.parseScript();
	for (const t in docLexer.include)
		if (!initial[t])
			initial[t] = docLexer.include[t], cg = true;
	if (!cg && Object.keys(initial).length === Object.keys(docLexer.include).length) {
		sendDiagnostics(); return;
	}
	parseinclude(docLexer.include), docLexer.relevance = getincludetable(uri);
	resetrelevance(), sendDiagnostics();
	function resetrelevance() {
		for (const u in initial)
			if (doctree[u])
				doctree[u].relevance = getincludetable(u);
	}
});

documents.onWillSaveWaitUntil((e) => {
	let docLexer = doctree[e.document.uri.toLowerCase()];
	if (docLexer.version !== e.document.version) {
		setTimeout(() => {
			docLexer.version = docLexer.document.version;
		}, 200);
		let tk = docLexer.get_tokon(0);
		if (tk.type === 'TK_BLOCK_COMMENT') {
			let t: string = updateFileInfo(tk.content);
			if (t !== tk.content)
				return [TE.replace(Range.create(docLexer.document.positionAt(tk.offset), docLexer.document.positionAt(tk.offset + tk.length)), t)];
		}
	}
	return [];
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	// console.log('We received an file change event');
});

connection.onDocumentFormatting(async (params: DocumentFormattingParams, cancellation: CancellationToken): Promise<TextEdit[]> => {
	let docLexer = doctree[params.textDocument.uri.toLowerCase()];
	const opts = { "indent_size": "1", "indent_char": "\t", "max_preserve_newlines": "2", "preserve_newlines": true, "keep_array_indentation": true, "break_chained_methods": false, "indent_scripts": "keep", "brace_style": "collapse", "space_before_conditional": true, "wrap_line_length": "0", "space_after_anon_function": true };
	if (params.options.insertSpaces) opts.indent_char = " ", opts.indent_size = params.options.tabSize.toString();
	let newText = docLexer.beautify(opts), range = Range.create(0, 0, docLexer.document.lineCount, 0);
	return [{ range, newText }];
});

connection.onDocumentRangeFormatting(async (params: DocumentRangeFormattingParams, cancellation: CancellationToken): Promise<TextEdit[]> => {
	const opts = { "indent_size": "1", "indent_char": "\t", "max_preserve_newlines": "2", "preserve_newlines": true, "keep_array_indentation": true, "break_chained_methods": false, "indent_scripts": "keep", "brace_style": "collapse", "space_before_conditional": true, "wrap_line_length": "0", "space_after_anon_function": true };
	if (params.options.insertSpaces) opts.indent_char = " ", opts.indent_size = params.options.tabSize.toString();
	let range = params.range, document = doctree[params.textDocument.uri.toLowerCase()].document, newText = document.getText(range);
	let t = '';
	if (range.start.character > 0 && (t = document.getText(Range.create(range.start.line, 0, range.start.line, range.start.character))).trim() === '')
		newText = t + newText, range.start.character = 0;
	newText = new Lexer(TextDocument.create('', 'ahk2', -10, newText)).beautify(opts);
	return [{ range, newText }];
});

connection.onDocumentSymbol((params: DocumentSymbolParams): SymbolInformation[] => {
	let uri = params.textDocument.uri.toLowerCase(), doc = doctree[uri];
	if (!doc || (!doc.reflat && symbolcache.uri === uri)) return symbolcache.sym;
	let tree = <DocumentSymbol[]>doc.symboltree, superglobal: { [key: string]: DocumentSymbol } = {}, gvar: any = {}, glo = doc.global;
	for (const key of ['gui', 'menu', 'menubar', 'class', 'array', 'map', 'object'])
		gvar[key] = superglobal[key] = DocumentSymbol.create(key, undefined, SymbolKind.Class, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0));
	for (const key in glo) {
		superglobal[key] = glo[key];
		if (glo[key].kind === SymbolKind.Class)
			gvar[key] = glo[key];
	}
	let list = doc.relevance;
	for (const uri in list) {
		const gg = doctree[uri].global;
		for (let key in gg) {
			superglobal[key] = superglobal[key] || gg[key];
			if (gg[key].kind === SymbolKind.Class && !glo[key])
				gvar[key] = gg[key];
		}
	}
	symbolcache.uri = uri, doc.reflat = false;
	return symbolcache.sym = (doctree[uri].flattreecache = flatTree(tree, gvar)).map(info => {
		return SymbolInformation.create(info.name, info.kind, info.range, uri,
			info.kind === SymbolKind.Class && (<ClassNode>info).extends ? (<ClassNode>info).extends : undefined);
	});

	function flatTree(tree: DocumentSymbol[], vars: { [key: string]: DocumentSymbol } = {}, global = false): DocumentSymbol[] {
		const result: DocumentSymbol[] = [], t: DocumentSymbol[] = [];
		tree.map(info => {
			if (info.kind === SymbolKind.Variable) {
				let nm_l = info.name.toLowerCase();
				if (!vars[nm_l]) {
					vars[nm_l] = info;
					if (!global)
						result.push(info);
				}
			} else if (info.children)
				t.push(info);
			else result.push(info);
		});
		t.map(info => {
			result.push(info);
			if (info.children) {
				let inherit: { [key: string]: DocumentSymbol } = {}, gg = false;
				if (info.kind === SymbolKind.Function || info.kind === SymbolKind.Method) {
					let s = (<FuncNode>info).statement;
					if (vars['#parent'])
						(<FuncNode>info).parent = vars['#parent'];
					for (const k in s.global)
						inherit[k] = s.global[k];
					for (const k in s.local)
						inherit[k] = s.local[k], result.push(inherit[k]);
					(<FuncNode>info).params?.map(it => {
						inherit[it.name.toLowerCase()] = it
					});
					if (s && s.assume === FuncScope.GLOBAL) {
						gg = true;
						for (const k in superglobal)
							if (!inherit[k])
								inherit[k] = superglobal[k];
					} else if (s && (s.assume & FuncScope.LOCAL)) {
						// for (const k in vars) if (!inherit[k]) inherit[k] = vars[k];
					} else {
						gg = global;
						for (const k in superglobal)
							if (!inherit[k])
								inherit[k] = superglobal[k];
						if (vars['#parent'])
							for (const k in vars)
								if (!inherit[k])
									inherit[k] = vars[k];
					}
					inherit['#parent'] = info;
				} else if (info.kind === SymbolKind.Class) {
					inherit['#parent'] = info;
					inherit['this'] = DocumentSymbol.create('this', undefined, SymbolKind.Variable, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0));
				}
				result.push(...flatTree(info.children, inherit, gg));
			}
		});
		return result;
	}
});

connection.onHover(async (params: HoverParams, token: CancellationToken): Promise<Maybe<Hover>> => {
	if (token.isCancellationRequested) return undefined;
	let uri = params.textDocument.uri.toLowerCase(), docLexer = doctree[uri];
	if (!docLexer) return;
	let context = docLexer.buildContext(params.position), t: any, hover: any[] = [];
	if (context) {
		let word = context.text.toLowerCase(), kind: SymbolKind | SymbolKind[] = SymbolKind.Variable;
		if (context.pre === '#') {
			if ((t = hoverCache[1]) && (t = t[word = '#' + word]))
				return t[0];
			else return undefined;
		} else if (context.pre.match(/(?<!\.)\b(goto|break|continue)(?!\s*:)(\(\s*['"]|\s*)$/i)) {
			kind = SymbolKind.Field, word = word + ':';
		} else kind = context.kind;
		if (kind === SymbolKind.Variable)
			kind = [SymbolKind.Variable, SymbolKind.Class];
		let nodes = searchNode(docLexer, word, context.range.end, kind), node: DocumentSymbol | undefined, uri: string = '';
		if (nodes) {
			if (nodes.length > 1) {
				nodes.map(it => {
					hover.push({ language: 'ahk2', value: (<any>(it.node)).full })
				})
				if (hover.length)
					return { contents: hover }; else return undefined;
			}
			node = nodes[0].node, uri = nodes[0].uri;
			if (node.kind === SymbolKind.Function || node.kind === SymbolKind.Method)
				hover.push({ language: 'ahk2', value: (<FuncNode>node).full });
			else if (node.kind === SymbolKind.Class)
				hover.push({ language: 'ahk2', value: 'class ' + node.name });
			if (node.detail)
				hover.push(node.detail.replace(/(\r?\n)+/g, '$1$1'));
			if (hover.length)
				return { contents: hover };
		}
		if (typeof kind === 'object') {
			if ((t = hoverCache[1]) && t[word])
				return t[word][0];
		} else if (kind === SymbolKind.Function) {
			if ((t = hoverCache[0]) && t[word])
				return t[word][0];
		} else if (kind === SymbolKind.Method) {

		}
	}
	return undefined;
});

connection.onDefinition(async (params: DefinitionParams, token: CancellationToken): Promise<Definition | LocationLink[] | undefined> => {
	if (token.isCancellationRequested) return undefined;
	let uri = params.textDocument.uri.toLowerCase(), docLexer = doctree[uri], context = docLexer.buildContext(params.position), m: any;
	if (context) {
		let word = '', kind: SymbolKind | SymbolKind[] = SymbolKind.Variable, t: any;
		if (context.pre.match(/^\s*#/i)) {
			if ((m = context.linetext.match(/^(\s*#include(again)?\s+)(<.+>|(['"]?)(\s*\*i\s+)?.+?\4)\s*(\s;.*)?$/i)) && m[3]) {
				let line = context.range.start.line, file = m[3].trim();
				for (let t in docLexer.include)
					if (docLexer.include[t].raw === file) {
						let rg = Range.create(0, 0, 0, 0);
						if (doctree[t])
							rg = Range.create(0, 0, doctree[t].document.lineCount, 0);
						return [LocationLink.create(t, rg, rg, Range.create(line, m[1].length, line, m[1].length + m[3].length))];
					}
			}
			return undefined;
		} else if (context.pre.match(/(?<!\.)\b(goto|break|continue)(?!\s*:)(\(\s*['"]|\s*)$/i) || (context.pre.trim() === '' && context.suf.match(/^:\s*(\s;.*)?$/))) {
			kind = SymbolKind.Field, word = context.text.toLowerCase() + ':';
		} else word = context.text.toLowerCase(), kind = context.kind;
		if (kind === SymbolKind.Variable)
			kind = [SymbolKind.Variable, SymbolKind.Class];
		let nodes = searchNode(docLexer, word, context.range.end, kind), locas: Location[] = [];
		if (nodes) {
			nodes.map(it => {
				if (it.uri)
					locas.push(Location.create(it.uri, it.node.selectionRange));
			});
			if (locas.length)
				return locas;
		}
	}
	return undefined;
});

connection.onSignatureHelp(async (params: SignatureHelpParams, cancellation: CancellationToken): Promise<Maybe<SignatureHelp>> => {
	if (cancellation.isCancellationRequested) return undefined;
	let uri = params.textDocument.uri.toLowerCase(), docLexer = doctree[uri], kind: SymbolKind = SymbolKind.Function;
	let res: any, name: string, pos: Position, index: number, signinfo: SignatureHelp = { activeSignature: 0, signatures: [], activeParameter: 0 }
	if (!(res = getFuncCallInfo(docLexer, params.position)))
		return undefined;
	name = res.name, pos = res.pos, index = res.index;
	if (pos.character > 0)
		if (docLexer.document.getText(Range.create({ line: pos.line, character: pos.character - 1 }, pos)) === '.')
			kind = SymbolKind.Method;
	if (kind === SymbolKind.Method) {
		let p = docLexer.document.getText(Range.create({ line: pos.line, character: 0 }, pos)).match(/((\w+\.)+)$/);
		if (!p)
			return undefined;
		name = p[1].toLowerCase() + name;
	}
	let nodes = searchNode(docLexer, name, pos, kind);
	if (!nodes) {
		if (kind === SymbolKind.Method) {
			let n = name.split('.').pop() || '';
			if (n) {
				nodes = <any>[];
				for (const key in ahkclasses)
					ahkclasses[key].map(node => {
						if (node.kind === SymbolKind.Method && node.name.toLowerCase() === n)
							nodes?.push({ node, uri: '' })
					});
				docLexer.object.method[n]?.map(node => {
					nodes?.push({ node, uri: '' })
				});
				for (const u in docLexer.relevance)
					doctree[u].object.method[n]?.map(node => {
						nodes?.push({ node, uri: '' })
					});
				if (!nodes?.length) return undefined;
			}
		} else if (kind === SymbolKind.Function && ahkfunctions[name])
			nodes = [{ node: ahkfunctions[name], uri: '' }];
		else return undefined;
	}
	nodes?.map(it => {
		const node = it.node;
		signinfo.signatures.push({
			label: (<FuncNode>node).full,
			parameters: (<FuncNode>node).params.map(param => {
				return {
					label: param.name.trim().replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, '$1|...')
				}
			}),
			documentation: node.detail
		});
	});
	signinfo.activeParameter = index < 0 ? 9999 : index;
	return signinfo;
});

connection.onCompletion(async (params: CompletionParams, token: CancellationToken): Promise<Maybe<CompletionItem[]>> => {
	if (token.isCancellationRequested) return undefined;
	const { position, textDocument } = params, items: CompletionItem[] = [], vars: { [key: string]: any } = {}, funcs: { [key: string]: any } = {}, txs: any = {};
	let scopenode: DocumentSymbol | undefined, other = true;
	let uri = textDocument.uri.toLowerCase(), docLexer = doctree[uri], content = docLexer.buildContext(position, false), nodes: DocumentSymbol[];
	let quote = '', char = '', _low = '', percent = false, linetext = content.linetext, prechar = linetext.charAt(content.range.start.character - 1);
	let list = docLexer.relevance, cpitem: CompletionItem, scope: FuncScope = FuncScope.GLOBAL, temp: any, path: string, { line, character } = position;
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
	switch (prechar) {
		case '#':
			items.push(...completionItemCache.sharp);
			return items;
		case '.':
			let p: any = content.pre.replace(/('|")(`\1|.)*?\1/, `''`), t: any, s = true;
			while (t = p.match(/\([^\(\)]+\)/))
				p = p.replace(t[0], '()');
			p = p.replace(/\.new\(\)\.$/i, () => {
				s = false; return '.';
			});
			p = p.match(/\b(\w+\.)+$/);
			if (p = p ? p[0].toLowerCase() : '') {
				p = p.replace(/\.$/, '');
				let nodes = searchNode(docLexer, p, position, [SymbolKind.Class, SymbolKind.Variable]), tps: any = [], cl = false, ob = false;
				let props: any = {}, meds: any = {}, l = '';
				if (nodes) {
					let node = nodes[0].node;
					if (node.kind !== SymbolKind.Class) {
						s = false;
						for (const tp of detectVariableType(doctree[uri], node.name.toLowerCase(), node.selectionRange.start)) {
							nodes = searchNode(docLexer, tp, position, [SymbolKind.Class, SymbolKind.Variable]);
							if (nodes)
								nodes.map(it => { tps.push(it.node) });
						}
					} else tps.push(node);
					for (const node of tps) {
						switch (node.kind) {
							case SymbolKind.Class:
								cl = ob = true;
								let mems = getClassMembers(docLexer, node, s);
								if (mems.length) {
									if (mems[mems.length - 1].kind === SymbolKind.Object)
										mems.pop();
									mems.map(it => {
										if (it.kind === SymbolKind.Property) {
											if (!props[l = it.name.toLowerCase()])
												items.push(props[l] = convertNodeCompletion(it));
											else props[l].detail = '(...) ' + it.name;
										} else if (it.kind !== SymbolKind.Method || !it.name.match(/^__(get|set|call|new|delete)$/i)) {
											if (!meds[l = it.name.toLowerCase()])
												items.push(meds[l] = convertNodeCompletion(it));
											else meds[l].detail = '(...) ' + it.name + '()', meds[l].documentation = '';
										}
									});
								}
								break;
							case SymbolKind.Object:
								ob = true; break;
						}
					}
					if (ob)
						ahkclasses['object'].map(it => {
							if (!meds[it.name.toLowerCase()])
								items.push(convertNodeCompletion(it));
						});
					if (cl && s) {
						items.push(p = CompletionItem.create('Prototype'));
						p.kind = CompletionItemKind.Property, p.detail = '检索或设置类的所有实例所基于的对象.';
						items.push(p = CompletionItem.create('New'));
						p.kind = CompletionItemKind.Method, p.detail = '构造类的新实例.', p.insertText = 'New()';
						p.insertTextFormat = InsertTextFormat.Snippet;
						for (t of getClassMembers(docLexer, node, false)) {
							if (t.kind === SymbolKind.Method && t.name.toLowerCase() === '__new') {
								if (t.params.length)
									p.insertText = 'New($0)';
								break;
							}
						}
					}
				}
				if (items.length) return items;
			}
			items.push(...completionItemCache.method);
			let objs = [docLexer.object];
			for (const uri in list)
				objs.push(doctree[uri].object);
			for (const obj of objs)
				for (const it in obj['property'])
					if (!vars[it])
						items.push(vars[it] = convertNodeCompletion(obj['property'][it]));
					else vars[it].detail = '(...) ' + vars[it].label;
			for (const obj of objs)
				for (const it in obj['method'])
					if (!funcs[it])
						items.push(funcs[it] = convertNodeCompletion(obj['method'][it][0]));
					else if (typeof funcs[it] === 'object')
						funcs[it].detail = '(...) ' + funcs[it].label;
			return items;
		default:
			if (percent) {
				other = false, completionItemCache.other.map(value => {
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
							inlib = true, paths = docLexer.libdirs;
						else if (temp = docLexer.includedir.get(position.line))
							paths = [temp];
						else paths = [docLexer.scriptpath];
						pre = pre.substring(1), lchar = lchar === '<' ? '>' : lchar;
						if (linetext.substring(position.character).indexOf(lchar) !== -1)
							lchar = '';
					}
				} else if (pre.match(/\s+;/))
					return;
				else if (temp = docLexer.includedir.get(position.line))
					paths = [temp];
				else paths = [docLexer.scriptpath];
				pre = pre.replace(/[^\\/]*$/, '');
				while (m = pre.match(/%a_(\w+)%/i))
					if (pathenv[a_ = m[1].toLowerCase()])
						pre = pre.replace(m[0], pathenv[a_]);
					else return;
				if (pre.charAt(pre.length - 1) === '/')
					xg = '/';
				for (let path of paths) {
					if (!fs.existsSync(path = resolve(path, pre) + '\\')) continue;
					for (const it of fs.readdirSync(path)) {
						try {
							if (inlib) {
								if (it.match(/\.ahk$/i))
									cpitem = CompletionItem.create(it.replace(/\.ahk/i, '')), cpitem.insertText = cpitem.label + lchar,
										cpitem.kind = CompletionItemKind.File, items.push(cpitem);
							} else if (fs.statSync(path + it).isDirectory())
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
				if (scopenode = docLexer.searchScopedNode(position))
					docLexer.getScopeChildren(scopenode).map(it => {
						if (it.kind === SymbolKind.Field)
							items.push(convertNodeCompletion(it));
					});
				else {
					docLexer.label.map(it => {
						items.push(convertNodeCompletion(it));
					});
					for (const t in list) doctree[t].label.map(it => {
						items.push(convertNodeCompletion(it));
					});
				}
				if (t === '' || temp[3])
					return items;
				else for (let it of items)
					it.insertText = `'${it.insertText}'`;
			} else if (quote) {
				let res = getFuncCallInfo(docLexer, position);
				if (res) {
					switch (res.name) {
						case 'func':
							if (res.index !== 0) break;
							for (const name in ahkfunctions)
								if (name.charAt(0) !== '.')
									cpitem = CompletionItem.create(ahkfunctions[name].name), cpitem.kind = CompletionItemKind.Function,
										items.push(cpitem), vars[name] = true;
							if (scopenode = docLexer.searchScopedNode(position)) {
								nodes = docLexer.getScopeChildren(scopenode);
								for (const it of nodes)
									if (it.kind === SymbolKind.Function && !vars[_low = it.name.toLowerCase()]) {
										vars[_low] = true, cpitem = CompletionItem.create(it.name),
											cpitem.kind = CompletionItemKind.Function, items.push(cpitem);
									}
							}
							for (const name in (temp = docLexer.function))
								if (!vars[name]) vars[name] = true, cpitem = CompletionItem.create(temp[name].name),
									cpitem.kind = CompletionItemKind.Function, items.push(cpitem);
							for (const t in list)
								for (const name in (temp = doctree[t].function))
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
								let meds = [docLexer.object.method];
								for (const uri in list)
									meds.push(doctree[uri].object.method);
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
				for (const t in docLexer.texts)
					if (!txs[t])
						txs[t] = true, items.push(cpitem = CompletionItem.create(docLexer.texts[t])), cpitem.kind = CompletionItemKind.Text;
				for (const u in list)
					for (const t in (temp = doctree[u].texts))
						if (!txs[t])
							txs[t] = true, items.push(cpitem = CompletionItem.create(temp[t])), cpitem.kind = CompletionItemKind.Text;
				return items;
			} else {
				items.push(...completionItemCache.snippet);
				if (content.text.length > 2 && content.text.match(/^[a-z]+_/i)) {
					const rg = new RegExp(content.text.replace(/(.)/g, '$1.*'), 'i'), constant = completionItemCache.constant;
					for (const it of constant)
						if (rg.test(it.label))
							items.push(it);
				}
			}
			scopenode = docLexer.searchScopedNode(position);
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
					addNodesIgnoreCurpos(docLexer.getScopeChildren(scopenode));
				addFunction();
				for (const name in (temp = docLexer.define)) {
					const item = temp[name];
					if (!vars[name] && !(item.range.end.line === line && item.range.start.character <= character && character <= item.range.end.character))
						vars[name] = true, items.push(convertNodeCompletion(item));
				}
				for (const t in list) {
					path = list[t].path;
					for (const name in (temp = doctree[t].define))
						if (!vars[name])
							vars[name] = true, addincludeitem(temp[name]);
				}
			} else {
				if (scope === FuncScope.DEFAULT) addGlobalVar();
				addNodesIgnoreCurpos(docLexer.getScopeChildren(scopenode)), addFunction();
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
			} else {
				if (item.kind === SymbolKind.Function)
					funcs[item.name.toLowerCase()] = true; items.push(convertNodeCompletion(item));
			}
		}
	}
	function addGlobalVar() {
		for (const name in (temp = docLexer.global)) {
			const item = temp[name];
			if (!(item.range.end.line === line && item.range.start.character <= character && character <= item.range.end.character))
				vars[name] = true, items.push(convertNodeCompletion(item));
		}
		for (const t in list) {
			path = list[t].path;
			for (const name in (temp = doctree[t].global))
				if (!vars[name]) vars[name] = true, addincludeitem(temp[name]);
		}
	}
	function addFunction() {
		for (const name in (temp = docLexer.function))
			if (!funcs[name])
				funcs[name] = true, items.push(convertNodeCompletion(temp[name]));
		for (const t in list) {
			path = list[t].path;
			for (const name in (temp = doctree[t].function))
				if (!funcs[name]) addincludeitem(temp[name]);
		}
	}
});

connection.onCompletionResolve(async (item: CompletionItem): Promise<CompletionItem> => item);

connection.onFoldingRanges(async (params: FoldingRangeParams): Promise<FoldingRange[]> => {
	return doctree[params.textDocument.uri.toLowerCase()].foldingranges;
});

connection.onCodeAction(async (params): Promise<Maybe<CodeAction[]>> => {
	let docLexer = doctree[params.textDocument.uri.toLowerCase()], diagnostics = docLexer.diagnostics;
	for (const it of diagnostics) {
		if (it.message.indexOf(' 文件不存在') !== -1) {
			let t: any = it.message.replace(/^'(.+)' 文件不存在$/, '$1'), r = docLexer.document.getText(it.range);
			if (t = t.match(/^(.+)\*(\.\w+)$/)) {
				let path = t[1], reg = new RegExp(t[2] + '$', 'i'), includes = [];
				for (const it of fs.readdirSync(path)) {
					try {
						if (reg.test(it)) includes.push(r.replace('*' + t[2], it));
					} catch (err) { };
				}
				let textEdit: TextEdit = { range: it.range, newText: includes.join('\n') };
				let act: any = { title: '导入include文件', edit: { changes: {} }, kind: CodeActionKind.QuickFix };
				act.edit.changes[params.textDocument.uri] = [textEdit];
				return [act];
			}
		}
	}
	return undefined;
});

connection.onDocumentColor(async (params): Promise<ColorInformation[]> => {
	return doctree[params.textDocument.uri.toLowerCase()].colors;
});

connection.onColorPresentation(async (params): Promise<Maybe<ColorPresentation[]>> => {
	let label = 'RGB: ', textEdit: TextEdit = { range: params.range, newText: '' }, color = params.color, m: any;
	let text = doctree[params.textDocument.uri.toLowerCase()].document.getText(params.range), hex = '';
	for (const i of [color.alpha, color.red, color.green, color.blue])
		hex += ('00' + Math.round(i * 255).toString(16)).substr(-2);
	if (m = text.match(/^(0x)?([\da-f]{6}([\da-f]{2})?)/i))
		textEdit.newText = (m[1] === undefined ? '' : '0x') + hex.slice(-m[2].length);
	else textEdit.newText = hex.substring(2);
	label += textEdit.newText
	return [{ label, textEdit }];
});

documents.listen(connection);
connection.listen();
initAHKCache();

export function getDocumentSettings(resource: string): Thenable<AHKLSSettings> {
	if (!hasConfigurationCapability) return Promise.resolve(globalSettings);
	let result = documentSettings.get(resource.toLowerCase());
	if (!result)
		documentSettings.set(resource.toLowerCase(),
			result = connection.workspace.getConfiguration({ scopeUri: resource, section: 'AutoHotkey2' }));
	return result;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	getDocumentSettings(textDocument.uri);
	doctree[textDocument.uri.toLowerCase()].initlibdirs();
}

async function initAHKCache() {
	const ahk2 = JSON.parse(fs.readFileSync(resolve(__dirname, '../../syntaxes/ahk2.json'), { encoding: "utf8" }));
	const cmd: Command = { title: 'Trigger Parameter Hints', command: 'editor.action.triggerParameterHints' };
	let type: CompletionItemKind, t = '', snip: { prefix: string, body: string, description?: string }, rg = Range.create(0, 0, 0, 0);
	for (const it of ['Gui', 'Class', 'Menu', 'MenuBar', 'Array', 'Map', 'Object']) {
		const completionItem = CompletionItem.create(it);
		completionItem.insertText = it;
		completionItem.kind = CompletionItemKind.Class;
		completionItemCache.other.push(completionItem);
	}
	for (const key in ahk2) {
		if (key === 'methods') {
			let meds: any = {};
			t = 'method';
			for (const objname in ahk2[key]) {
				let arr: any[] = ahk2[key][objname], _ = objname.toLowerCase();
				ahkclasses[_] = [];
				for (snip of arr) {
					const completionItem = CompletionItem.create(snip.prefix), _low = snip.prefix.toLowerCase();
					snip.body = bodytostring(snip.body);
					completionItem.kind = snip.body.indexOf('(') === -1 ? CompletionItemKind.Property : CompletionItemKind.Method;
					if (snip.body.indexOf('|') === -1)
						completionItem.insertText = snip.body.replace(/\(.+\)/, () => {
							completionItem.command = cmd; return '($0)';
						});
					else
						completionItem.insertText = snip.body, completionItem.command = cmd;
					completionItem.insertTextFormat = InsertTextFormat.Snippet;
					completionItem.detail = `(${objname}) ` + snip.description;
					snip.body = snip.body.replace(/\$\{\d+((\|)|:)([^}]*)\2\}|\$\d/g, (...m) => {
						return m[2] ? m[3].replace(/,/g, '|') : m[3] || '';
					});
					if (!meds[_low])
						completionItem.documentation = { kind: MarkupKind.Markdown, value: '```ahk2\n' + snip.body + '\n```' },
							completionItemCache[t].push(meds[_low] = completionItem);
					else meds[_low].documentation = undefined, meds[_low].detail = '(...) ' + snip.prefix + '()',
						meds[_low].insertText = snip.prefix + (snip.body.indexOf('()') !== -1 ? '()' : '($0)');
					if (completionItem.kind === CompletionItemKind.Property)
						ahkclasses[_].push(DocumentSymbol.create(snip.prefix, `(${_}) ` + snip.description,
							SymbolKind.Property, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0)));
					else {
						let it = FuncNode.create(_low === 'new' ? '__New' : snip.prefix, SymbolKind.Method, rg, rg,
							snip.body.replace(/^\w+[(\s]|\)/g, '').split(',').filter(param => param != '').map(param => {
								return DocumentSymbol.create(param.trim(), undefined, SymbolKind.Variable, rg, rg);
							}));
						it.full = it.full.replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, (...m) => {
							snip.body = snip.body.replace(m[0], m[1] + '|...');
							return m[1] + '|...';
						});
						it.full = `(${_}) ${it.full}`, it.detail = snip.description, ahkclasses[_].push(it);
					}
				}
			}
		} else if (key === 'snippet') {
			for (snip of ahk2['snippet']) {
				const completionItem = CompletionItem.create(snip.prefix);
				completionItem.kind = CompletionItemKind.Snippet;
				completionItem.insertText = bodytostring(snip.body);
				completionItem.detail = snip.description;
				completionItem.insertTextFormat = InsertTextFormat.Snippet;
				completionItemCache.snippet.push(completionItem);
			}
		} else {
			let arr: any[] = ahk2[key];
			switch (key) {
				case 'keywords': type = CompletionItemKind.Keyword; break;
				case 'functions': type = CompletionItemKind.Function; break;
				case 'variables': type = CompletionItemKind.Variable; break;
				case 'constants': type = CompletionItemKind.Constant; break;
				default: type = CompletionItemKind.Text; break;
			}
			for (snip of arr) additem();
		}
	}
	function additem() {
		const completionItem = CompletionItem.create(snip.prefix.replace('.', '')), hover: Hover = { contents: [] }, _low = snip.prefix.toLowerCase();
		completionItem.kind = type;
		if (type === CompletionItemKind.Keyword && snip.prefix.charAt(0) === '#')
			t = 'sharp', snip.body = bodytostring(snip.body).replace(/^#/, '');
		else if (type === CompletionItemKind.Constant)
			t = 'constant'; else t = 'other';
		if (type === CompletionItemKind.Function && snip.body.indexOf('|}') === -1 && snip.body.indexOf('(${') !== -1)
			completionItem.insertText = snip.prefix + '($0)', completionItem.command = cmd, completionItem.detail = snip.description;
		else if (type === CompletionItemKind.Constant)
			completionItem.insertText = '${1:' + snip.prefix + ' := }' + snip.body + '$0', completionItem.detail = snip.body;
		else completionItem.insertText = snip.body.replace(/\$\{\d:\s*\[,[^\]\}]+\]\}/, () => {
			completionItem.command = cmd;
			return '';
		}), completionItem.detail = snip.description;
		completionItem.insertTextFormat = InsertTextFormat.Snippet;
		snip.body = snip.body.replace(/\$\{\d+((\|)|:)([^}]*)\2\}|\$\d/g, (...m) => {
			return m[2] ? m[3].replace(/,/g, '|') : m[3] || '';
		});
		completionItem.documentation = { kind: MarkupKind.Markdown, value: '```ahk2\n' + snip.body + '\n```' };
		completionItemCache[t].push(completionItem);
		if (type === CompletionItemKind.Constant || type === CompletionItemKind.Text)
			return;
		hover.contents = { kind: MarkupKind.Markdown, value: '```ahk2\n' + snip.body + '\n```\n\n' + snip.description };
		let n = type === CompletionItemKind.Function ? 0 : 1;
		if (!hoverCache[n][_low]) hoverCache[n][_low] = [];
		if (!n) {
			let it = FuncNode.create(snip.prefix, SymbolKind.Function, rg, rg,
				snip.body.replace(/^\w+[(\s]|\)/g, '').split(',').map(param => {
					return DocumentSymbol.create(param.trim(), undefined, SymbolKind.Variable, rg, rg);
				}));
			it.full = it.full.replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, (...m) => {
				snip.body = snip.body.replace(m[0], m[1] + '|...');
				return m[1] + '|...';
			});
			it.detail = snip.description, ahkfunctions[_low] = it;
		}
		hoverCache[n][_low].push(hover);
	}
	function bodytostring(body: any) { return (typeof body === 'object' ? body.join('\n') : body) };
}

export function pathanalyze(path: string, libdirs: string[], workdir: string = '') {
	let m: RegExpMatchArray | null, uri = '';

	if (path[0] === '<') {
		if (!(path = path.replace('<', '').replace('>', ''))) return;
		let search: string[] = [path + '.ahk'];
		if (m = path.match(/^(\w+)_.*/)) search.push(m[1] + '.ahk');
		for (const dir of libdirs) {
			for (const file of search)
				if (fs.existsSync(path = dir + '\\' + file)) {
					uri = URI.file(path).toString().toLowerCase();
					return { uri, path };
				}
		}
	} else {
		if (m = path.match(/%a_(\w+)%/i)) {
			let a_ = m[1];
			if (pathenv[a_]) path = path.replace(m[0], <string>pathenv[a_]); else return;
		}
		if (path.indexOf(':') === -1) path = resolve(workdir, path);
		uri = URI.file(path).toString().toLowerCase();
		return { uri, path };
	}
}
let initnum = 0;
async function initpathenv(config?: any) {
	config = config || await connection.workspace.getConfiguration('AutoHotkey2');
	if (!config) return false;
	globalSettings.Path = config.Path;
	let script = `
	#NoTrayIcon
	Append := SubStr(A_AhkVersion, 1, 3) = "2.0" ? "FileAppend" : "FileAppend2"
	for _, p in [A_MyDocuments,A_Desktop,A_AhkPath,A_ProgramFiles,A_Programs,A_AhkVersion]
		p .= "|", %Append%(p, "*")
	%Append%("\`n", "*")
	FileAppend2(text, file) {
		FileAppend %text%, %file%
	}
	`
	let ret = runscript(script, (data: string) => {
		let paths = data.trim().split('|'), s = ['mydocuments', 'desktop', 'ahkpath', 'programfiles', 'programs', 'version'], path = '', init = !pathenv.ahkpath;
		for (let i in paths)
			pathenv[s[i]] = paths[i].toLowerCase();
		if (!pathenv.ahkpath) {
			if (initnum < 3) setTimeout(() => {
				initnum++, initpathenv();
			}, 1000);
			return;
		}
		libdirs.length = 0, initnum = 1;
		if (pathenv.version && pathenv.version.match(/^1\./))
			connection.window.showErrorMessage('当前AutoHotkey.exe不是v2版本，无法获得正确的语法解析、补全等功能');
		if (fs.existsSync(path = pathenv.mydocuments + '\\autohotkey\\lib'))
			libdirs.push(path);
		if (fs.existsSync(path = pathenv.ahkpath.replace(/[^\\/]+$/, 'lib')))
			libdirs.push(path);
		if (init) {
			for (const uri in doctree) {
				let doc = doctree[uri];
				doc.initlibdirs(), doc.parseScript(), parseinclude(doc.include);
				doc.relevance = getincludetable(doc.uri);
			}
		}
	});
	if (!ret) connection.window.showErrorMessage('AutoHotkey可执行文件的路径不正确, 在"设置-AutoHotkey2.Path"中重新指定');
	return ret;
}

async function parseinclude(include: { [uri: string]: { path: string, raw: string } }) {
	for (const uri in include) {
		let path = include[uri].path;
		if (!(doctree[uri]) && fs.existsSync(path)) {
			let buf: any = fs.readFileSync(path);
			if (buf[0] === 0xff && buf[1] === 0xfe)
				buf = buf.toString('utf16le');
			else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
				buf = buf.toString('utf8').substring(1);
			else buf = buf.toString('utf8');
			let doc = new Lexer(TextDocument.create(uri, 'ahk2', -10, buf));
			doctree[uri] = doc, doc.parseScript(), parseinclude(doc.include);
			if (!doc.relevance)
				doc.relevance = getincludetable(uri);
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
			ci.kind = CompletionItemKind.Property, ci.detail = (info.full || '') + (info.detail || ''); break;
		default:
			ci.kind = CompletionItemKind.Text; break;
	}
	return ci;
}

function getClassMembers(doc: Lexer, node: DocumentSymbol, staticmem: boolean = true) {
	let v: any = {}, m: any = {}, l = '';
	return getmems(doc, node);

	function getmems(doc: Lexer, node: DocumentSymbol) {
		let members: DocumentSymbol[] = [], u = (<any>node).uri;
		if (staticmem) {
			node.children?.map(it => {
				switch (it.kind) {
					case SymbolKind.Method:
						if (!m[l = it.name.toLowerCase()]) {
							if (l === '__new') {
								if (!(<FuncNode>it).statement.static)
									m[l] = true, (<any>it).uri = u, members.push(it);
							} else if ((<FuncNode>it).statement.static)
								m[l] = true, (<any>it).uri = u, members.push(it);
						}
						break;
					case SymbolKind.Property:
						if ((<Variable>it).static && !v[l = it.name.toLowerCase()])
							v[l] = true, (<any>it).uri = u, members.push(it);
						break;
					case SymbolKind.Class:
						(<any>it).uri = u, members.push(it);
						break;
				}
			});
			members.push(DocumentSymbol.create('Prototype', undefined, SymbolKind.Object, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0)));
		} else {
			node.children?.map(it => {
				switch (it.kind) {
					case SymbolKind.Method:
						if (!(<FuncNode>it).statement?.static && !m[l = it.name.toLowerCase()])
							m[l] = true, (<any>it).uri = u, members.push(it);
						break;
					case SymbolKind.Property:
						if (!(<Variable>it).static && !v[l = it.name.toLowerCase()])
							v[l] = true, (<any>it).uri = u, members.push(it);
						break;
				}
			});
		}
		if (l = (<ClassNode>node).extends) {
			let p = l.toLowerCase().split('.'), cl: any, mems: DocumentSymbol[], nd: DocumentSymbol | undefined, dc: Lexer;
			cl = searchNode(doc, p[0], Position.create(0, 0), SymbolKind.Class);
			if (cl.node) {
				nd = cl.node, dc = doctree[cl.uri];
				while (nd) {
					mems = getmems(dc, nd);
					if (p.length === 1) {
						members.push(...mems);
						break;
					} else {
						p.splice(0, 1), nd = undefined;
						for (const it of mems)
							if (it.kind === SymbolKind.Class && it.name.toLowerCase() === p[0]) {
								nd = it; break;
							}
					}
				}
			}
		}
		return members;
	}
}

function detectVariableType(doc: Lexer, name: string, pos: Position) {
	let scope = doc.searchScopedNode(pos), types: any = {}, t: any;
	if (scope) scope.children?.map(detectit);
	else {
		for (const it of doc.symboltree)
			detectit(it);
		for (const uri in doc.relevance)
			if (types['?'])
				return [];
			else for (const it of doctree[uri].symboltree)
				detectit(it);
	}
	if (types['?'])
		return [];
	else return Object.keys(types);

	function detectit(it: DocumentSymbol) {
		if ((it.kind === SymbolKind.Variable) && name === it.name.toLowerCase()) {
			let line = doc.document.getText(Range.create(it.selectionRange.end, Position.create(it.selectionRange.end.line + 1, 0)));
			if (t = line.match(/\s*:=\s*((map\()|(\{|object\()|(\[|array\()|(inputhook\()|(bufferalloc\()|(fileopen\()|(func\(|objbindmethod\()|(guictrlfromhwnd\()|((\w+\.)*\w+)\.new\(|('|")|(\w+)\s*(([^\w\s])|,|;|$))?/i)) {
				if (t[2])
					types['map'] = true;
				else if (t[3])
					types['object'] = true;
				else if (t[4])
					types['array'] = true;
				else if (t[5])
					types['$inputhook'] = true;
				else if (t[6])
					types['$buffer'] = true;
				else if (t[7])
					types['$file'] = true;
				else if (t[8])
					types['$func'] = true;
				else if (t[9])
					types['$guicontrol'] = true;
				else if (t[10]) {
					if (!t[10].match(/\.\d/))
						types[t[10].toLowerCase()] = true;
				} else if (t[12])
					types['string'] = true;
				else if (t[13]) {
					if (t[13].match(/^\d/))
						types['number'] = true;
					else if (t[15])
						types['?'] = true;
					else if (!types['?']) {
						for (const tp of detectVariableType(doc, t[13], Position.create(pos.line, pos.character + name.length + 3)))
							types[tp] = true;
					}
				}
			}
		}
	}
}

function searchNode(doc: Lexer, name: string, pos: Position, kind: SymbolKind | SymbolKind[], isstatic = true): [{ node: DocumentSymbol, uri: string, type?: string }] | undefined {
	let node: DocumentSymbol | null = null, t: any, uri = doc.uri;
	if (kind === SymbolKind.Method || kind === SymbolKind.Property || name.indexOf('.') !== -1) {
		let p = name.split('.'), nodes = searchNode(doc, p[0], pos, [SymbolKind.Class, SymbolKind.Variable]), i = 0, ps = 0;
		if (!nodes)
			return undefined;
		let { node: n, uri: u } = nodes[0];
		if (n.kind === SymbolKind.Variable) {
			let tps = detectVariableType(doctree[uri], p[0], n.selectionRange.start), rs: any = [];
			if (tps.length === 0) {

			} else for (const tp of tps) {
				let i = searchNode(doctree[uri], name.replace(new RegExp('^' + p[0]), tp), pos, kind, false);
				if (i)
					(<any>i).type = tp, rs.push(...i);
			}
			if (rs.length)
				return rs;
			else return undefined;
		} else if (ps = p.length - 1) {
			while (i < ps) {
				node = null, i++;
				if (n.kind === SymbolKind.Class) {
					(<any>n).uri = u;
					let mem = getClassMembers(doc, n, isstatic || i < ps);
					if (kind === SymbolKind.Method && i === ps) {
						let reg = new RegExp((p[i] === 'new' ? '^(__)?' : '^') + p[i] + '$', 'i');
						for (const it of mem) {
							if (it.kind === SymbolKind.Method && reg.test(it.name)) {
								node = it, uri = (<any>it).uri || '';
								break;
							}
						}
						if (!node) mem.map(it => {
							if (it.kind === SymbolKind.Method && (<FuncNode>it).statement?.static && it.name.toLowerCase() === '__call')
								node = it, uri = (<any>it).uri || '';
						});
					} else {
						for (const it of mem) {
							if (it.kind !== SymbolKind.Method && it.name.toLowerCase() === p[i]) {
								node = it, uri = (<any>it).uri || '';
								break;
							}
						}
					}
				}
				if (!node) break; else n = node;
			}
		}
		if (n && !node && i === 1 && p.length === 2) {
			if (p[0].match(/^(array|map|object|class|gui|menu|menubar)$/i) && p[1] === 'prototype') {
				uri = node ? uri : '';
				node = DocumentSymbol.create(p[0], undefined, SymbolKind.Object, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0));
			}
		}
		if (node)
			return [{ node, uri }];
		else return undefined;
	} else if (!(node = doc.searchNode(name, pos, kind))) {
		let res = searchIncludeNode(doc.uri, name, kind);
		if (res)
			return res;
	} else if (typeof kind === 'object' && (<Variable>node).globalspace) {
		if ((t = doc.global) && t[name])
			node = t[name];
		else for (const u in doc.relevance)
			if ((t = doctree[u].global) && t[name]) {
				node = t[name], uri = u; break;
			}
	}
	if (((!node && name.charAt(0) === '$' && (name = name.substr(1))) || (node && !(<any>node).userdef)) &&
		name.match(/^(gui|menu(bar)?|class|array|map|object|buffer|file|func|exception|regexmatch|guicontrol|inputhook|listview|statusbar|treeview)$/i)) {
		uri = '', node = DocumentSymbol.create(name, undefined, SymbolKind.Class, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0), []);
		if (name === 'menubar')
			name = 'menu';
		node.children?.push(...ahkclasses[name]);
	}
	if (node)
		return [{ node, uri }];
	else return undefined;
	function searchIncludeNode(fileuri: string, name: string, kind: SymbolKind[] | SymbolKind): [{ node: DocumentSymbol, uri: string }] | undefined {
		let node: DocumentSymbol | null, list = doctree[fileuri].relevance, t: any;
		if (typeof kind === 'object') {
			for (const uri in list)
				if ((t = doctree[uri].global) && t[name])
					return [{ node: t[name], uri }];
			for (const uri in list)
				if ((t = doctree[uri].define) && t[name])
					return [{ node: t[name], uri }];
		} else for (const uri in list)
			if (node = doctree[uri].searchNode(name, undefined, kind))
				return [{ node, uri }];
		return undefined;
	}
}

function getFuncCallInfo(doc: Lexer, position: Position) {
	let func: DocumentSymbol | undefined, offset = doc.document.offsetAt(position), off = { start: 0, end: 0 }, pos: Position = { line: 0, character: 0 };
	for (const item of doc.funccall) {
		const start = doc.document.offsetAt(item.range.start), end = doc.document.offsetAt(item.range.end);
		if (start <= offset) {
			if (offset > end) {
				const line = item.range.start.line, character = item.range.start.character + item.name.length;
				let char = doc.document.getText(Range.create(line, character, line, character + 1));
				if (char === '(' || line !== position.line)
					continue;
			}
			if (!func || (off.start <= start && end <= off.end))
				func = item, off = { start, end }, pos = item.range.start;
		}
	}
	if (!func)
		return undefined;
	let text = doc.document.getText(func.range), index = -1, len = 0, name = func.name.toLowerCase(), tt: any;
	offset = offset - off.start;
	while (tt = text.match(/('|").*?(?<!`)\1/))
		text = text.replace(tt[0], '_'.repeat(tt[0].length));
	len = off.end - off.start - func.name.length;
	for (const pair of [['\\{', '\\}'], ['\\[', '\\]'], ['\\(', '\\)']]) {
		const rg = new RegExp(pair[0] + '[^' + pair[0] + ']*?' + pair[1]);
		while (tt = rg.exec(text)) {
			if (tt[0].length >= len)
				break;
			text = text.replace(tt[0], '_'.repeat(tt[0].length));
		}
	}
	if (offset > func.name.length)
		index += 1;
	for (let i = func.name.length + 1; i < offset; i++)
		if (text.charAt(i) === ',')
			index++;
		else if (text.charAt(i) === ')' && i >= text.length - 1) {
			index = -1; break;
		}
	return { name, pos, index };
}

function getincludetable(fileuri: string) {
	let list: { [uri: string]: any } = {}, count = 0, has = false, doc: Lexer, res: any = { list, count, main: '' };
	for (const uri in doctree) {
		list = {}, count = 0, has = (uri === fileuri);
		traverseinclude(doctree[uri].include);
		if (has && count > res.count)
			res = { list, count, main: uri };
	}
	if (res.count) {
		delete res.list[fileuri];
		return res.list;
	} else return {};
	function traverseinclude(include: any) {
		for (const uri in include) {
			if (fileuri === uri) {
				has = true; continue;
			}
			if (doc = doctree[uri]) {
				if (!list[uri])
					list[uri] = include[uri], count++; traverseinclude(doc.include);
			}
		}
	}
}

function sendDiagnostics() {
	let doc: Lexer;
	for (const uri in doctree) {
		doc = doctree[uri];
		connection.sendDiagnostics({
			uri: uri,
			diagnostics: (!doc.actived && (!doc.relevance || !Object.keys(doc.relevance).length) ? [] : doc.diagnostics)
		});
	}
}

function updateFileInfo(info: string, revised: boolean = true): string {
	let d: Date = new Date;
	info = info.replace(/(?<=@?(date|日期)[:\s]\s*)(\d+\/\d+\/\d+)/i, d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2));
	info = info.replace(/(?<=@?(version|版本号)[:\s]\s*)(\d+(\.\d+)*)/i, (m) => {
		let ver: string[] = m.split('.');
		while (ver.length < 3)
			ver.push('0');
		if (revised)
			ver[ver.length - 1] = (parseInt(ver[ver.length - 1]) + 1).toString();
		else ver[ver.length - 2] = (parseInt(ver[ver.length - 2]) + 1).toString(), ver[ver.length - 1] = '0';
		return ver.join('.');
	});
	return info;
}