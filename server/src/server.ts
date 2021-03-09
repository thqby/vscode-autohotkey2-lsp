/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, resolve } from 'path';
import {
	Command, CompletionItem, CompletionItemKind, createConnection,
	DidChangeConfigurationNotification, DocumentSymbol,
	FoldingRange, FoldingRangeParams, Hover, InitializeParams, InitializeResult, InsertTextFormat,
	MarkupKind, ProposedFeatures, Range, SymbolInformation, SymbolKind,
	TextDocumentChangeEvent, TextDocuments, TextDocumentSyncKind, TextEdit
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { codeActionProvider } from './CodeActionProvider';
import { colorPresentation, colorProvider } from './colorProvider';
import { completionProvider } from './completionProvider';
import { defintionProvider } from './definitionProvider';
import { executeCommandProvider } from './executeCommandProvider';
import { documentFormatting, rangeFormatting } from './formattingProvider';
import { hoverProvider } from './hoverProvider';
import { FuncNode, getincludetable, Lexer, parseinclude, Variable } from './Lexer';
import { setting } from './localize';
import { referenceProvider } from './referencesProvider';
import { prepareRename, renameProvider } from './renameProvider';
import { runscript } from './scriptrunner';
import { signatureProvider } from './signatureProvider';
import { symbolProvider } from './symbolProvider';

export const languageServer = 'ahk2-language-server';
export let globalSettings: AHKLSSettings = {
	Path: 'C:\\Program Files\\AutoHotkey\\AutoHotkey32.exe'
}, libdirs: string[] = [], documentSettings: Map<string, Thenable<AHKLSSettings>> = new Map();
export const connection = createConnection(ProposedFeatures.all);
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument), hasahk2_hcache = false;
let hasConfigurationCapability: boolean = false, hasWorkspaceFolderCapability: boolean = false, hasDiagnosticRelatedInformationCapability: boolean = false;
export let lexers: { [key: string]: Lexer } = {}, pathenv: { [key: string]: string } = {}, symbolcache: { uri: string, sym: SymbolInformation[] } = { uri: '', sym: [] };
export let completionItemCache: { [key: string]: CompletionItem[] } = { sharp: [], method: [], other: [], constant: [], snippet: [] };
export let hoverCache: { [key: string]: Hover[] }[] = [{}, {}], ahkclasses: { [key: string]: DocumentSymbol[] } = {}, ahkfunctions: { [key: string]: FuncNode } = {};
export let libfuncs: { [uri: string]: FuncNode[] } = {}, workfolder = '';
export type Maybe<T> = T | undefined;

interface AHKLSSettings {
	Path: string;
}

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
	workfolder = URI.parse(params.workspaceFolders?.pop()?.uri || '').fsPath.toLowerCase();
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
			name: languageServer,
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
				triggerCharacters: ['.', '#']
			},
			signatureHelpProvider: {
				triggerCharacters: ['('],
				retriggerCharacters: [',']
			},
			documentSymbolProvider: true,
			definitionProvider: true,
			documentFormattingProvider: true,
			documentRangeFormattingProvider: true,
			executeCommandProvider: { commands: ['ahk2.fix.include'] },
			hoverProvider: true,
			foldingRangeProvider: true,
			colorProvider: true,
			codeActionProvider: true,
			renameProvider: { prepareProvider: true },
			referencesProvider: { workDoneProgress: true }
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
	let uri = e.document.uri.toLowerCase(), doc = new Lexer(e.document);
	lexers[uri] = doc, doc.actived = true;
	parseproject(uri);
});

// Only keep settings for open documents
documents.onDidClose(async e => {
	let uri = e.document.uri.toLowerCase();
	documentSettings.delete(uri), lexers[uri].actived = false;
	for (let u in lexers)
		if (lexers[u].actived)
			for (let f in lexers[u].include)
				if (f === uri) return;
	delete lexers[uri];
	connection.sendDiagnostics({ uri, diagnostics: [] });
	let deldocs: string[] = [];
	for (let u in lexers)
		if (!lexers[u].actived) {
			let del = true;
			for (let f in lexers[u].include)
				if (lexers[f] && lexers[f].actived) {
					del = false; break;
				}
			if (del)
				deldocs.push(u);
		}
	for (let u of deldocs) {
		delete lexers[u];
		connection.sendDiagnostics({ uri: u, diagnostics: [] });
	}
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
	let uri = change.document.uri.toLowerCase(), doc = lexers[uri];
	let initial = doc.include, cg = false;
	doc.parseScript();
	if (libfuncs[uri]) {
		libfuncs[uri].length = 0;
		for (const f in doc.function)
			libfuncs[uri].push(doc.function[f]);
	}
	for (const t in doc.include)
		if (!initial[t])
			initial[t] = doc.include[t], cg = true;
	if (!cg && Object.keys(initial).length === Object.keys(doc.include).length) {
		sendDiagnostics();
		return;
	}
	parseinclude(doc.include), doc.relevance = getincludetable(uri), resetrelevance();
	sendDiagnostics();
	function resetrelevance() {
		for (const u in initial)
			if (lexers[u])
				lexers[u].relevance = getincludetable(u);
	}
});

documents.onWillSaveWaitUntil((e) => {
	let doc = lexers[e.document.uri.toLowerCase()];
	if (doc.version !== e.document.version) {
		let tk = doc.get_tokon(0);
		if (tk.type === 'TK_BLOCK_COMMENT') {
			let t: string = updateFileInfo(tk.content);
			if (t !== tk.content) {
				setTimeout(() => {
					doc.version = doc.document.version;
				}, 200);
				return [TextEdit.replace(Range.create(doc.document.positionAt(tk.offset), doc.document.positionAt(tk.offset + tk.length)), t)];
			}
		}
		doc.version = doc.document.version;
	}
	return [];
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	// console.log('We received an file change event');
});

connection.onCodeAction(codeActionProvider);
connection.onCompletion(completionProvider);
connection.onColorPresentation(colorPresentation);
connection.onDocumentColor(colorProvider);
connection.onDefinition(defintionProvider);
connection.onDocumentFormatting(documentFormatting);
connection.onDocumentRangeFormatting(rangeFormatting);
connection.onDocumentSymbol(symbolProvider);
connection.onFoldingRanges(async (params: FoldingRangeParams): Promise<FoldingRange[]> => lexers[params.textDocument.uri.toLowerCase()].foldingranges);
connection.onHover(hoverProvider);
connection.onPrepareRename(prepareRename);
connection.onReferences(referenceProvider);
connection.onRenameRequest(renameProvider);
connection.onSignatureHelp(signatureProvider);
connection.onExecuteCommand(executeCommandProvider);
documents.listen(connection);
connection.listen();
initahk2cache();
loadahk2();

export function getDocumentSettings(resource: string): Thenable<AHKLSSettings> {
	if (!hasConfigurationCapability) return Promise.resolve(globalSettings);
	let result = documentSettings.get(resource.toLowerCase());
	if (!result)
		documentSettings.set(resource.toLowerCase(),
			result = connection.workspace.getConfiguration({ scopeUri: resource, section: 'AutoHotkey2' }));
	return result;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	let uri = textDocument.uri, doc = lexers[uri];
	getDocumentSettings(uri);
	lexers[uri = textDocument.uri.toLowerCase()].initlibdirs();
	if (doc.diagnostics.length)
		doc.parseScript();
	parseproject(uri);
	for (const f in doc.function)
		libfuncs[uri].push(doc.function[f]);
}

function initahk2cache() {
	completionItemCache = {
		sharp: [],
		method: [],
		other: ['Any', 'Array', 'BoundFunc', 'Buffer', 'Class', 'ClipboardAll', 'Closure', 'Enumerator', 'Error', 'File', 'Float', 'Func', 'Gui', 'IndexError', 'InputHook', 'Integer', 'KeyError', 'Map', 'MemberError', 'MemoryError', 'Menu', 'MenuBar', 'MethodError', 'Number', 'Object', 'OSError', 'Primitive', 'PropertyError', 'RegExMatch', 'String', 'TargetError', 'TimeoutError', 'TypeError', 'ValueError', 'ZeroDivisionError'].map(it => {
			const completionItem = CompletionItem.create(it);
			completionItem.insertText = it;
			completionItem.kind = CompletionItemKind.Class;
			return completionItem;
		}),
		constant: [],
		snippet: []
	};
}

async function loadahk2(filename = 'ahk2') {
	const ahk2 = JSON.parse(readFileSync(resolve(__dirname, `../../syntaxes/${filename}.json`), { encoding: 'utf8' }));
	const cmd: Command = { title: 'Trigger Parameter Hints', command: 'editor.action.triggerParameterHints' };
	let type: CompletionItemKind, t = '', snip: { prefix: string, body: string, description?: string }, rg = Range.create(0, 0, 0, 0);
	for (const key in ahk2) {
		if (key === 'methods') {
			let meds: any = {};
			t = 'method';
			for (const objname in ahk2[key]) {
				let arr: any[] = ahk2[key][objname], _ = objname.toLowerCase();
				if (!ahkclasses[_])
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
					snip.body = snip.body.replace(/\$\{\d+((\|)|:)([^}]*)\2\}|\$\d/g, (...m) => {
						return m[2] ? m[3].replace(/,/g, '|') : m[3] || '';
					});
					if (!meds[_low]) {
						completionItem.documentation = snip.description;
						if (objname !== 'class')
							completionItemCache[t].push(meds[_low] = completionItem);
					} else {
						meds[_low].documentation = undefined;
						if (meds[_low].insertText !== completionItem.insertText) {
							meds[_low].detail = '(...) ' + snip.prefix + '()';
							meds[_low].insertText = snip.prefix + (snip.body.indexOf('()') !== -1 ? '()' : '($0)');
						} else
							meds[_low].detail = '(...) ' + snip.body;
					}
					if (completionItem.kind === CompletionItemKind.Property) {
						let it: Variable;
						ahkclasses[_].push(it = DocumentSymbol.create(snip.prefix, snip.description,
							SymbolKind.Property, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0)));
						it.full = completionItem.detail = `(${_}) ` + it.name;
						completionItem.documentation = snip.description;
					} else {
						let it = FuncNode.create(_low === 'new' ? '__New' : snip.prefix, SymbolKind.Method, rg, rg,
							snip.body.replace(/^\w+[(\s]|\)/g, '').split(',').filter(param => param != '').map(param => {
								return DocumentSymbol.create(param.trim(), undefined, SymbolKind.Variable, rg, rg);
							}));
						it.full = it.full.replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, (...m) => {
							snip.body = snip.body.replace(m[0], m[1] + '|...');
							return m[1] + '|...';
						});
						it.full = `(${_}) ${it.full}`, it.detail = snip.description, ahkclasses[_].push(it);
						completionItem.detail = completionItem.detail || it.full;
					}
				}
				if (_.indexOf(',') !== -1) {
					let cls = ahkclasses[_];
					delete ahkclasses[_];
					_.split(',').map(n => {
						if (!ahkclasses[n])
							ahkclasses[n] = [];
						ahkclasses[n].push(...cls);
					});
				}
			}
			ahkclasses['dropdownlist'] = ahkclasses['ddl'], ahkclasses['tab2'] = ahkclasses['tab3'] = ahkclasses['tab'];
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
		if (type === CompletionItemKind.Function && snip.body.indexOf('|}') === -1 && snip.body.indexOf('(') !== -1)
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
				snip.body.replace(/^\w+[(\s]?|\)/g, '').split(',').map(param => {
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

let initnum = 0;
async function initpathenv(config?: any) {
	config = config || await connection.workspace.getConfiguration('AutoHotkey2');
	if (!config) return false;
	globalSettings.Path = config.Path;
	let script = `
	#NoTrayIcon
	s := "", _H := false, Append := SubStr(A_AhkVersion, 1, 3) = "2.0" ? "FileAppend" : "FileAppend2"
	for _, p in [A_MyDocuments,A_Desktop,A_AhkPath,A_ProgramFiles,A_Programs,A_AhkVersion]
		s .= p "|"
	try
		_H := Func("NewThread").IsBuiltIn
	%Append%(s _H "\`n", "*")
	FileAppend2(text, file) {
		FileAppend %text%, %file%
	}
	`
	let ret = runscript(script, (data: string) => {
		let paths = data.trim().split('|'), s = ['mydocuments', 'desktop', 'ahkpath', 'programfiles', 'programs', 'version', 'h'], path = '';
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
			connection.window.showErrorMessage(setting.versionerr());
		if (existsSync(path = pathenv.mydocuments + '\\autohotkey\\lib'))
			libdirs.push(path);
		if (existsSync(path = pathenv.ahkpath.replace(/[^\\/]+$/, 'lib')))
			libdirs.push(path);
		if (!hasahk2_hcache && pathenv.h)
			hasahk2_hcache = true, loadahk2('ahk2_h');
		for (const uri in lexers) {
			let doc = lexers[uri];
			doc.initlibdirs(), doc.parseScript(), parseinclude(doc.include);
			doc.relevance = getincludetable(doc.uri);
		}
		libfuncs = {};
		setTimeout(() => {
			libdirs.map(dir => {
				getallahkfiles(dir).map(path => {
					let uri = URI.file(path).toString().toLowerCase(), d: Lexer;
					if (!(d = lexers[uri]))
						d = new Lexer(openFile(path)), d.parseScript();
					libfuncs[uri] = [], Object.defineProperty(libfuncs[uri], 'islib', { value: inlibdirs(path, ...libdirs), enumerable: false });
					for (const f in d.function)
						libfuncs[uri].push(d.function[f]);
				});
			});
		}, 1000);
	});
	if (!ret) connection.window.showErrorMessage(setting.ahkpatherr());
	return ret;
}

function sendDiagnostics() {
	let doc: Lexer;
	for (const uri in lexers) {
		doc = lexers[uri];
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

export function openFile(path: string): TextDocument {
	let buf: any = readFileSync(path);
	if (buf[0] === 0xff && buf[1] === 0xfe)
		buf = buf.toString('utf16le');
	else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
		buf = buf.toString('utf8').substring(1);
	else buf = buf.toString('utf8');
	return TextDocument.create(URI.file(path).toString(), 'ahk2', -10, buf);
}

function getallahkfiles(dirpath: string, maxdeep = 3): string[] {
	let files: string[] = [];
	if (existsSync(dirpath) && statSync(dirpath).isDirectory())
		enumfile(dirpath, 0);
	return files;

	function enumfile(dirpath: string, deep: number) {
		readdirSync(dirpath).map(file => {
			let path = resolve(dirpath, file);
			if (statSync(path).isDirectory()) {
				if (deep < maxdeep)
					enumfile(path, deep + 1);
			} else if (file.match(/\.(ahk2?|ah2)$/i))
				files.push(path.toLowerCase());
		});
	}
}

export function restorePath(path: string): string {
	if (!existsSync(path))
		return path;
	let dirs = path.toUpperCase().split('\\'), i = 1, s = dirs[0];
	while (i < dirs.length) {
		for (const d of readdirSync(s + '\\')) {
			if (d.toUpperCase() === dirs[i]) {
				s += '\\' + d;
				break;
			}
		}
		i++;
	}
	return s.toLowerCase() === path ? s : path;
}

export function inlibdirs(path: string, ...dirs: string[]) {
	let file = basename(path), i = 0, a = file.endsWith('.ahk');
	for (const p of dirs) {
		if (path.startsWith(p + '\\')) {
			if (a) for (let j = i - 1; j >= 0; j--) {
				if (libfuncs[dirs[j] + '\\' + file])
					return false;
			}
			return true;
		}
		i++;
	}
	return false;
}

async function parseproject(uri: string) {
	let doc: Lexer = lexers[uri];
	if (!libfuncs[uri])
		libfuncs[uri] = [], Object.defineProperty(libfuncs[uri], 'islib', { value: inlibdirs(URI.parse(uri).toString(), ...libdirs), enumerable: false });
	setTimeout(async () => {
		let searchdir = '', workspace = false;
		if (workfolder && (doc.scriptdir === workfolder || doc.scriptdir.startsWith(workfolder + '\\')))
			searchdir = workfolder, workspace = true;
		else
			searchdir = doc.scriptdir + '\\lib';
		getallahkfiles(searchdir).map(path => {
			let u = URI.file(path).toString().toLowerCase(), d: Lexer;
			if (u !== uri && !libfuncs[u]) {
				libfuncs[u] = [], Object.defineProperty(libfuncs[u], 'islib', { value: inlibdirs(path, ...libdirs), enumerable: false });
				if (!(d = lexers[u])) {
					d = new Lexer(openFile(path)), d.parseScript();
					if (workspace)
						lexers[u] = d;
				}
				for (const f in d.function)
					libfuncs[u].push(d.function[f]);
			}
		});
	}, 1000);
}