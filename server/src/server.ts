/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as fs from "fs";
import { resolve } from 'path';
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	SymbolInformation,
	DocumentSymbolParams,
	SymbolKind,
	SignatureHelpParams,
	SignatureHelp,
	SignatureInformation,
	ParameterInformation,
	CancellationToken,
	DefinitionParams,
	Definition,
	Location,
	Position,
	HoverParams,
	Hover,
	MarkedString,
	DocumentFormattingParams,
	Range,
	DocumentSymbol,
	LocationLink,
	InsertTextFormat,
	CompletionParams,
	TextDocumentChangeEvent,
	Command,
	MarkupKind
} from 'vscode-languageserver';

import {
	TextDocument, TextEdit
} from 'vscode-languageserver-textdocument';
import { Lexer, ClassNode, FuncNode, Variable, Word, FuncScope } from './Lexer'
import { runscript } from './scriptrunner';

export const serverName = 'mock-ahk-vscode';
export const languageServer = 'ahk2-language-server';
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. 
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;
// let keyWordCompletions: CompletionItem[] = buildKeyWordCompletions();
// let builtinVariableCompletions: CompletionItem[] = buildbuiltin_variable();
let treedict: { [key: string]: Lexer } = {};
let completionItemCache: { [key: string]: CompletionItem[] } = { sharp: [], method: [], other: [], constant: [] };
let hoverCache: { [key: string]: Hover[] }[] = [{}, {}], funcCache: { [key: string]: { prefix: string, body: string, description?: string } } = {};
let nodecache: { [key: string]: { uri: string, line: number, character: number, ruri: string, node: DocumentSymbol } } = {};
let pathenv: { [key: string]: string } = {};
let logger = connection.console.log;

type Maybe<T> = T | undefined;

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
			textDocumentSync: TextDocumentSyncKind.Incremental,
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
			hoverProvider: true
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
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The AHK Language Server settings
enum docLangName {
	CN = 'CN',
	NO = 'no'		// No Doc
};

interface AHKLSSettings {
	path: string;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: AHKLSSettings = {
	path: 'C:\\Program Files\\AutoHotkey\\AutoHotkey32.exe'
};
export let globalSettings: AHKLSSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<AHKLSSettings>> = new Map();

connection.onDidChangeConfiguration(async change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <AHKLSSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

connection.onDocumentSymbol((params: DocumentSymbolParams): SymbolInformation[] => {
	let uri = params.textDocument.uri.toLowerCase(), doc = treedict[uri], glo = doc.root.statement.global;
	let tree = <DocumentSymbol[]>doc.symboltree, gv: { [key: string]: DocumentSymbol } = {}, gvar = [];
	for (const key of ['gui', 'menu', 'menubar', 'class', 'array', 'map', 'object', 'guicontrol'])
		gv[key] = DocumentSymbol.create(key, undefined, SymbolKind.Class, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0));
	for (const key in glo) {
		gv[key.toLowerCase()] = glo[key];
		if (glo[key].kind === SymbolKind.Variable) gvar.push(glo[key]);
	}
	return (treedict[uri].cache = flatTree(tree, gv)).map(info => {
		return SymbolInformation.create(info.name, info.kind, info.range, uri, info.kind === SymbolKind.Class && (<ClassNode>info).extends ? (<ClassNode>info).extends : undefined);
	});
});

connection.onHover(async (params: HoverParams, token: CancellationToken): Promise<Maybe<Hover>> => {
	if (token.isCancellationRequested)
		return undefined;
	let uri = params.textDocument.uri.toLowerCase(), docLexer = treedict[uri], context = docLexer.buildContext(params.position), value = '';
	if (context) {
		let word = context.text.toLowerCase(), kind: SymbolKind | SymbolKind[] = SymbolKind.Variable, node: DocumentSymbol | null, hover: Hover | undefined;
		if (context.pre === '#') {
			if (hoverCache[1][word = '#' + word]) return hoverCache[1][word][0];
			return undefined;
		} else if (context.pre.match(/\b(goto|break|continue)(\(\s*['"]|\s*)$/i)) {
			kind = SymbolKind.Field, word = word + ':';
		} else kind = context.kind;
		if (kind === SymbolKind.Variable) kind = [SymbolKind.Variable, SymbolKind.Class];
		node = docLexer.searchNode(word, context.range.end, kind);
		if (!node) {
			let pos = Position.create(0, 0);
			for (let u in treedict)
				if (u !== uri && (node = treedict[u].searchNode(word, pos, kind))) {
					uri = u;
					break;
				}
		}
		if (node) {
			value = ((node.kind === SymbolKind.Function || node.kind === SymbolKind.Method) ? (<FuncNode>node).full + '\n' : '') + (node.detail ? node.detail : '');
			nodecache.hover = { uri, line: params.position.line, character: context.range.end.character, ruri: uri, node };
			if (value)
				return { contents: { language: 'ahk2', value: value } };
		}
		if (typeof kind === 'object') { if (hoverCache[1][word]) return hoverCache[0][word][0]; }
		else if (kind === SymbolKind.Function) {
			if (hoverCache[0][word]) return hoverCache[0][word][0];
		} else if (kind === SymbolKind.Method) {

		}
	}
	return undefined;
})

connection.onSignatureHelp(async (params: SignatureHelpParams, cancellation: CancellationToken): Promise<Maybe<SignatureHelp>> => {
	if (cancellation.isCancellationRequested) return undefined;
	let docLexer = treedict[params.textDocument.uri.toLowerCase()], offset = docLexer.document.offsetAt(params.position);
	let func: DocumentSymbol | undefined, same = false, off = { start: 0, end: 0 }, pos: Position = { line: 0, character: 0 };
	for (const item of docLexer.root.funccall) {
		const start = docLexer.document.offsetAt(item.range.start), end = docLexer.document.offsetAt(item.range.end);
		if (start <= offset) {
			if (offset > end) {
				const line = item.range.start.line, character = item.range.start.character + item.name.length;
				let char = docLexer.document.getText(Range.create(line, character, line, character + 1));
				if (char === '(' || line !== params.position.line) continue;
			}
			if (!func || (off.start <= start && end <= off.end)) func = item, off = { start, end }, pos = item.range.start;
		}
	}
	if (!func) return undefined;
	offset = offset - off.start;
	let text = docLexer.document.getText(func.range), tt: any, kind: SymbolKind = SymbolKind.Function;
	let node: DocumentSymbol | null, uri = '', name = func.name.toLowerCase(), index = -1, signinfo: SignatureHelp;
	signinfo = { activeSignature: 0, signatures: [], activeParameter: 0 }
	if (pos.character > 0) {
		let p = { line: pos.line, character: pos.character - 1 };
		if (docLexer.document.getText(Range.create(p, pos)) === '.') kind = SymbolKind.Method;
	}
	if (kind === SymbolKind.Method) {
		return undefined;
	} else {
		node = docLexer.searchNode(name, pos, kind);
		if (!node) {
			let p = Position.create(0, 0);
			for (let u in treedict)
				if (u !== uri && (node = treedict[u].searchNode(name, p, kind))) {
					uri = u; break;
				}
		}
		if (node) {
			signinfo.signatures.push({
				label: (<FuncNode>node).full,
				parameters: (<FuncNode>node).params.map(param => { return { label: param.name.trim() } }),
				documentation: node.detail
			});
		} else if (!funcCache[name]) return undefined;
		else {
			let t = funcCache[name];
			signinfo.signatures.push({
				label: t.body,
				parameters: t.body.replace(/^\w+\(|\)/g, '').split(',').map(param => { return { label: param.trim() } }),
				documentation: t.description
			});
		}
	}
	while (tt = text.match(/('|").*?(?<!`)\1/)) text = text.replace(tt[0], '_'.repeat(tt[0].length));
	const len = off.end - off.start - func.name.length, maxparam = signinfo.signatures[0].parameters?.length || 0;
	for (const pair of [['\\{', '\\}'], ['\\[', '\\]'], ['\\(', '\\)']]) {
		const rg = new RegExp(pair[0] + '[^' + pair[0] + ']*?' + pair[1]);
		while (tt = rg.exec(text)) {
			// if (offset >= tt.index && offset < tt.index + tt[0].length) break;
			if (tt[0].length >= len) break;
			text = text.replace(tt[0], '_'.repeat(tt[0].length));
		}
	}
	if (offset > func.name.length) index += 1;
	for (let i = func.name.length + 1; i < offset; i++)
		if (text.charAt(i) === ',') index++;
		else if (text.charAt(i) === ')' && i >= text.length - 1) { index = maxparam; break; }
	signinfo.activeParameter = index < 0 ? maxparam : index;
	return signinfo;
})

connection.onDefinition(async (params: DefinitionParams, token: CancellationToken): Promise<Definition | LocationLink[] | undefined> => {
	if (token.isCancellationRequested) {
		return undefined;
	}
	let uri = params.textDocument.uri.toLowerCase(), docLexer = treedict[uri], context = docLexer.buildContext(params.position), m: any;
	if (context) {
		let word = '', kind: SymbolKind | SymbolKind[] = SymbolKind.Variable, node: DocumentSymbol | null, cache = nodecache.hover;
		if (context.pre.match(/^\s*#/i)) {
			if (m = context.linetext.match(/^(\s*#include(again)?\s+)(<.+>|(['"]?).+\.(ahk2?|ah2)\4)/i)) {
				let line = context.range.start.line;
				for (let t in docLexer.includetable)
					if (docLexer.includetable[t].raw === m[3])
						return [LocationLink.create(t, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0), Range.create(line, m[1].length, line, m[0].length))];
			} return undefined;
		} else if (context.pre.match(/\b(goto|break|continue)(\(\s*['"]|\s*)$/i) || (context.pre.trim() === '' && context.suf.match(/^:\s*(\s;.*)?$/))) {
			kind = SymbolKind.Field, word = context.text.toLowerCase() + ':';
		} else word = context.text.toLowerCase(), kind = context.kind;
		if (kind === SymbolKind.Variable) kind = [SymbolKind.Variable, SymbolKind.Class];
		node = docLexer.searchNode(word, context.range.end, kind);
		if (!node) {
			let pos = Position.create(0, 0);
			for (let u in treedict)
				if (u !== uri && (node = treedict[u].searchNode(word, pos, kind))) {
					uri = u;
					break;
				}
		}
		if (node)
			return Location.create(uri, node.selectionRange);
	}
	return undefined;
});

connection.onDocumentFormatting(async (params: DocumentFormattingParams, cancellation: CancellationToken): Promise<TextEdit[]> => {
	let uri = params.textDocument.uri.toLowerCase(), docLexer = treedict[uri];
	const opts = { "indent_size": "1", "indent_char": "\t", "max_preserve_newlines": "2", "preserve_newlines": true, "keep_array_indentation": true, "break_chained_methods": false, "indent_scripts": "keep", "brace_style": "collapse", "space_before_conditional": true, "wrap_line_length": "0", "space_after_anon_function": true, "jslint_happy": true };
	if (params.options.insertSpaces) {
		opts.indent_char = " ", opts.indent_size = params.options.tabSize.toString();
	}
	let newText = docLexer.beautify(opts);
	let range = Range.create(0, 0, docLexer.document.lineCount, 0);
	return [{ range, newText }];
});

documents.onDidOpen(async e => {
	let uri = e.document.uri.toLowerCase(), docLexer = treedict[uri];
	if (!docLexer) docLexer = new Lexer(e.document), treedict[uri] = docLexer;
	else if (docLexer.document.version < 0) docLexer.document = e.document;
	if (pathenv.ahkpath) docLexer.parseScript(), parseinclude(docLexer.includetable);
	else initpathenv(docLexer);
});

// Only keep settings for open documents
documents.onDidClose(e => {
	let uri = e.document.uri.toLowerCase();
	documentSettings.delete(uri);
	for (let u in treedict)
		if (u !== uri) {
			for (let f in treedict[u].includetable)
				if (f === uri)
					return;
		}
	delete treedict[uri];
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
	let uri = change.document.uri.toLowerCase(), docLexer = treedict[uri];
	if (!docLexer)
		docLexer = new Lexer(change.document), treedict[uri] = docLexer;
	docLexer.parseScript();
	// parseinclude(docLexer.includetable);
	validateTextDocument(change.document);
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(async (params: CompletionParams, token: CancellationToken): Promise<Maybe<CompletionItem[]>> => {
	if (token.isCancellationRequested) {
		return undefined;
	}
	const { position, textDocument } = params, items: CompletionItem[] = [], { line, character } = position;
	// const triggerKind = params.context?.triggerKind, triggerCharacter = params.context?.triggerCharacter;
	let docLexer = treedict[textDocument.uri.toLowerCase()], content = docLexer.buildContext(position, false);
	let quote = '', char = '', percent = false, linetext = content.linetext, prechar = linetext.charAt(content.range.start.character - 1);
	for (let i = 0; i < position.character; i++) {
		char = linetext.charAt(i);
		if (quote === char) {
			if (linetext.charAt(i - 1) === '`') continue; else quote = '', percent = false;
		} else if (char === '%') {
			percent = !percent;
		} else if (quote === '' && (char === '"' || char === "'")) quote = char;
	}
	if (quote || (prechar !== '.' && prechar !== '#')) prechar = '';
	switch (prechar) {
		case '#':
			items.push(...completionItemCache.sharp);
			return items;
		case '.':
			items.push(...completionItemCache.method);
			return items;
		default:
			if (percent) {
				completionItemCache.other.map(value => { if (value.kind !== CompletionItemKind.Text) items.push(value); });
			} else if (quote) {
				completionItemCache.other.map(value => { if (value.kind === CompletionItemKind.Text) items.push(value); });
				return items;
			} else {
				items.push(...completionItemCache.other);
				if (content.text.length > 2 && content.text.match(/^[a-z]+_/i)) {
					const rg = new RegExp(content.text.replace(/(.)/g, '$1.*'), 'i'), constant = completionItemCache.constant;
					for (const it of constant) if (rg.test(it.label)) items.push(it);
				}
			}
			let scopenode = docLexer.searchScopedNode(position), nodes: DocumentSymbol[] = docLexer.getScopeChildren(scopenode);
			for (const item of nodes) {
				if (item.kind === SymbolKind.Variable && item.range.end.line === line && item.range.start.character <= character && character <= item.range.end.character) continue;
				items.push(convertNodeCompletion(item));
			}
			if (!scopenode) {

			}
			return items;
	}
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(async (item: CompletionItem): Promise<CompletionItem> => item);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
connection.console.log('Starting AHK Server');
initAHKCache();

async function initAHKCache() {
	const ahk2 = JSON.parse(fs.readFileSync(resolve(__dirname, '../../syntaxes/ahk2.json'), "UTF8"));
	const cmd: Command = { title: 'Trigger Parameter Hints', command: 'editor.action.triggerParameterHints' };
	let type: CompletionItemKind, t = '', snip: { prefix: string, body: string, description?: string };
	for (const it of ['Gui', 'Class', 'Menu', 'MenuBar']) {
		const completionItem = CompletionItem.create(it);
		completionItem.insertText = it, completionItem.kind = CompletionItemKind.Class;
		completionItemCache.other.push(completionItem);
	}
	for (const key in ahk2) {
		if (key === 'methods') {
			t = 'method';
			for (const objname in ahk2[key]) {
				let arr: any[] = ahk2[key][objname];
				for (snip of arr) {
					const completionItem = CompletionItem.create(snip.prefix), hover: Hover = { contents: [] }, _low = snip.prefix.toLowerCase();
					completionItem.kind = snip.body.indexOf('(') === -1 ? CompletionItemKind.Property : CompletionItemKind.Method;
					completionItem.insertText = snip.body.replace(/^\./, ''), completionItem.insertTextFormat = InsertTextFormat.Snippet;
					completionItem.detail = `(${objname}) ` + snip.description, snip.body = snip.body.replace(/\$\{\d+:([^}]+)\}/g, '$1');
					completionItem.documentation = { kind: MarkupKind.Markdown, value: '```ahk2\n' + snip.body + '\n```' }, completionItemCache[t].push(completionItem);
					hover.contents = { kind: MarkupKind.Markdown, value: '```ahk2\n' + snip.body + '\n```\n\n' + snip.description };
					if (!hoverCache[0][_low]) hoverCache[0][_low] = [];
					hoverCache[0][_low].push(hover), funcCache[_low] = snip;
				}
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
		const completionItem = CompletionItem.create(snip.prefix), hover: Hover = { contents: [] }, _low = snip.prefix.toLowerCase();
		completionItem.kind = type;
		if (type === CompletionItemKind.Keyword && snip.prefix.charAt(0) === '#') t = 'sharp', snip.body = snip.body.replace(/^#/, '');
		else if (type === CompletionItemKind.Constant) t = 'constant'; else t = 'other';
		if (type === CompletionItemKind.Function && snip.body.indexOf('|}') === -1 && snip.body.indexOf('(${') !== -1)
			completionItem.insertText = snip.prefix + '($0)', completionItem.command = cmd, completionItem.detail = snip.description;
		else if (type === CompletionItemKind.Constant) completionItem.insertText = '${1:' + snip.prefix + ' := }' + snip.body + '$0', completionItem.detail = snip.body;
		else completionItem.insertText = snip.body, completionItem.detail = snip.description;
		completionItem.insertTextFormat = InsertTextFormat.Snippet, snip.body = snip.body.replace(/\$\{\d+:([^}]+)\}/g, '$1');
		completionItem.documentation = { kind: MarkupKind.Markdown, value: '```ahk2\n' + snip.body + '\n```' }, completionItemCache[t].push(completionItem);
		if (type === CompletionItemKind.Constant || type === CompletionItemKind.Text) return;
		hover.contents = { kind: MarkupKind.Markdown, value: '```ahk2\n' + snip.body + '\n```\n\n' + snip.description };
		let n = type === CompletionItemKind.Function ? 0 : 1;
		if (!hoverCache[n][_low]) hoverCache[n][_low] = [];
		if (!n) funcCache[_low] = snip;
		hoverCache[n][_low].push(hover);
	}
}

export function pathanalyze(path: string, workdir: string = '') {
	let m: RegExpMatchArray | null, url = '', uri = '';
	path = path.replace(/['"]/g, '').replace(/\\+/g, '/').toLowerCase();

	if (path[0] === '<') {

	} else {
		if (m = path.match(/%(a_[a-z]+)%/i)) {
			let a_ = m[1].substring(2);
			if (pathenv[a_])
				path = path.replace(m[0], pathenv[a_]);
		}
		if (path.indexOf(':') === -1)
			path = workdir + path;
		url = 'file:///' + encodeURI(path);
		uri = url.replace(/\/([a-z]):\//, '/$1%3a/');
	}
	return { url, uri, path };
}

export function getDocumentSettings(resource: string): Thenable<AHKLSSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'Autohotkey2LanguageServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	let result = await getDocumentSettings(textDocument.uri.toLowerCase());
	if (result)
		globalSettings.path = pathenv.ahkpath = result.path;
}

async function initpathenv(doc: Lexer) {
	let result = await connection.workspace.getConfiguration('Autohotkey2LanguageServer');
	globalSettings.path = result.path;
	runscript(`#NoTrayIcon\nfor _,p in [A_AhkPath,A_Desktop,A_Programs,A_ProgramFiles,A_MyDocuments]\nFileAppend(p "\`n", "*")`, (data: string) => {
		let paths = data.trim().split('\n'), s = ['ahkpath', 'desktop', 'programs', 'programfiles', 'mydocuments'];
		for (let i in paths)
			pathenv[s[i]] = paths[i].replace(/\\/g, '/').toLowerCase();
		doc.parseScript(), parseinclude(doc.includetable);
		pathenv.ahkpath = result.path;
	});
}

async function parseinclude(include: { [uri: string]: { url: string, path: string, raw: string } }) {
	for (let uri in include) {
		let path = include[uri].path;
		if (!treedict[uri] && fs.existsSync(path)) {
			let buf: any = fs.readFileSync(path);
			if (buf[0] === 0xff && buf[1] === 0xfe)
				buf = buf.toString('utf16le');
			else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
				buf = buf.toString('utf8').substring(1);
			else buf = buf.toString('utf8');
			let doc = new Lexer(TextDocument.create(uri, 'ahk2', -10, buf));
			treedict[uri] = doc;
			doc.parseScript();
		}
	}
}
function flatTree(tree: DocumentSymbol[], superglobal: { [key: string]: DocumentSymbol }, vars: { [key: string]: DocumentSymbol } = {}, global = false): DocumentSymbol[] {
	const result: DocumentSymbol[] = [], t: DocumentSymbol[] = [];
	tree.map(info => {
		if (info.kind === SymbolKind.Variable || info.kind === SymbolKind.Property) {
			let nm_l = info.name.toLowerCase();
			if (!vars[nm_l]) { vars[nm_l] = info; if (!global) result.push(info); }
		} else if (info.children) t.push(info); else result.push(info);
	});
	t.map(info => {
		result.push(info);
		if (info.children) {
			let inherit: { [key: string]: DocumentSymbol } = {}, gg = false;
			if (info.kind === SymbolKind.Function || info.kind === SymbolKind.Method) {
				let s = (<FuncNode>info).statement;
				if (vars['#parent']) (<FuncNode>info).parent = vars['#parent'];
				for (const k in s.global) inherit[k] = s.global[k];
				for (const k in s.local) inherit[k] = s.local[k], result.push(inherit[k]);
				(<FuncNode>info).params?.map(it => inherit[it.name.toLowerCase()] = it);
				if (s && s.assume === FuncScope.GLOBAL) {
					gg = true;
					for (const k in superglobal) if (!inherit[k]) inherit[k] = superglobal[k];
				} else if (s && (s.assume & FuncScope.LOCAL)) {
					// for (const k in vars) if (!inherit[k]) inherit[k] = vars[k];
				} else {
					gg = global;
					for (const k in superglobal) if (!inherit[k]) inherit[k] = superglobal[k];
					if (vars['#parent']) for (const k in vars) if (!inherit[k]) inherit[k] = vars[k];
				}
				inherit['#parent'] = info;
			} else if (info.kind === SymbolKind.Class) {
				inherit['#parent'] = info;
				inherit['this'] = DocumentSymbol.create('this', undefined, SymbolKind.Variable, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0));
			}
			result.push(...flatTree(info.children, superglobal, inherit, gg));
		}
	});
	return result;
}

function convertNodeCompletion(info: any): CompletionItem {
	let ci = CompletionItem.create(info.name);
	switch (info.kind) {
		case SymbolKind.Function:
		case SymbolKind.Method:
			ci.kind = info.kind === SymbolKind.Method ? CompletionItemKind.Method : CompletionItemKind.Function;
			ci.commitCharacters = ['('], ci.insertText = ci.label + '($0)', ci.insertTextFormat = InsertTextFormat.Snippet;
			ci.detail = info.full, ci.documentation = info.detail; break;
		case SymbolKind.Variable:
			ci.kind = CompletionItemKind.Variable; break;
		case SymbolKind.Class:
			ci.kind = CompletionItemKind.Class, ci.commitCharacters = ['.']; break;
		case SymbolKind.Event:
			ci.kind = CompletionItemKind.Event; break;
		case SymbolKind.Field:
			ci.kind = CompletionItemKind.Field, ci.insertText = ci.label.replace(/:$/, ''), ci.detail = 'labal'; break;
		default:
			ci.kind = CompletionItemKind.Text; break;
	}
	return ci;
}