/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { existsSync } from 'fs';
import { URI } from 'vscode-uri';
import { basename, resolve } from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	createConnection, Connection, DidChangeConfigurationNotification, ExecuteCommandParams, FoldingRange, FoldingRangeParams, InitializeParams,
	InitializeResult, ProposedFeatures, Range, SymbolKind, TextDocumentChangeEvent, TextDocuments, TextDocumentSyncKind, TextEdit, WorkspaceFoldersChangeEvent
} from 'vscode-languageserver/node';
import {
	AHKLSSettings, clearLibfuns, codeActionProvider, colorPresentation, colorProvider, completionProvider, defintionProvider,
	documentFormatting, extsettings, fixinclude, generateAuthor, generateComment, getallahkfiles, getincludetable, hoverProvider,
	initahk2cache, isahk2_h, Lexer, lexers, libdirs, libfuncs, loadahk2, loadlocalize, openFile, parseinclude, pathenv, prepareRename,
	rangeFormatting, referenceProvider, renameProvider, runscript, semanticTokensOnDelta, semanticTokensOnFull, semanticTokensOnRange,
	sendDiagnostics, set_ahk_h, set_Connection, set_dirname, set_locale, set_Settings, set_Workfolder, setting, signatureProvider, sleep,
	symbolProvider, typeFormatting, updateFileInfo, workspaceFolders, ahkpath_cur, set_ahkpath, LibIncludeType, loadWinApi, workspaceSymbolProvider, inWorkspaceFolders, parseWorkspaceFolders
} from './common';

const languageServer = 'ahk2-language-server';
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument), hasahk2_hcache = false, connection: Connection;
let hasConfigurationCapability: boolean = false, hasWorkspaceFolderCapability: boolean = false, hasDiagnosticRelatedInformationCapability: boolean = false;

connection = createConnection(ProposedFeatures.all);
set_Connection(connection, false);
set_dirname(__dirname);
set_locale(JSON.parse(process.env.VSCODE_NLS_CONFIG || process.env.AHK2_LS_CONFIG || '{}').locale);

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
	if (params.locale)
		set_locale(params.locale);
	set_Workfolder(params.workspaceFolders?.map(it => it.uri.toLowerCase() + '/'));
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
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: ['.', '#']
			},
			signatureHelpProvider: {
				triggerCharacters: ['(', ',']
			},
			documentSymbolProvider: true,
			definitionProvider: true,
			documentFormattingProvider: true,
			documentRangeFormattingProvider: true,
			documentOnTypeFormattingProvider: { firstTriggerCharacter: '}', moreTriggerCharacter: ['{'] },
			executeCommandProvider: {
				commands: [
					'ahk2.fix.include',
					'ahk2.generate.comment',
					'ahk2.generate.author',
					'ahk2.resetinterpreterpath'
				]
			},
			hoverProvider: true,
			foldingRangeProvider: true,
			colorProvider: true,
			codeActionProvider: true,
			renameProvider: { prepareProvider: true },
			referencesProvider: { workDoneProgress: true },
			semanticTokensProvider: {
				legend: {
					tokenTypes: [
						'class',
						'function',
						'method',
						'parameter',
						'variable',
						'property',
						'keyword',
						'string',
						'number',
						'event',
						'modifier'
					],
					tokenModifiers: [
						'definition',
						'readonly',
						'static',
						'deprecated',
						'modification',
						'documentation',
						'defaultLibrary'
					]
				},
				full: { delta: true },
				range: true
			},
			workspaceSymbolProvider: true
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

connection.onInitialized(async () => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders((event: WorkspaceFoldersChangeEvent) => {
			let del = event.removed.map(it => it.uri.toLowerCase() + '/') || [];
			set_Workfolder(workspaceFolders.filter(it => !del.includes(it)));
			event.added.map(it => workspaceFolders.push(it.uri.toLowerCase() + '/'));
			parseWorkspaceFolders();
		});
	}
	loadWinApi();
	await initpathenv();
	parseWorkspaceFolders();
});

connection.onDidChangeConfiguration(async (change) => {
	if (hasConfigurationCapability) {
		let newset: AHKLSSettings = await connection.workspace.getConfiguration('AutoHotkey2');
		let changes: any = { InterpreterPath: false, AutoLibInclude: false }, oldpath = extsettings.InterpreterPath;
		if (typeof newset.AutoLibInclude === 'string')
			newset.AutoLibInclude = LibIncludeType[newset.AutoLibInclude] as unknown as LibIncludeType;
		else if (typeof newset.AutoLibInclude === 'boolean')
			newset.AutoLibInclude = newset.AutoLibInclude ? 3 : 0;
		for (let k in extsettings)
			if ((<any>extsettings)[k] !== (<any>newset)[k])
				changes[k] = true;
		Object.assign(extsettings, newset);
		if (changes['InterpreterPath'] && !ahkpath_cur) {
			changeInterpreter(oldpath, extsettings.InterpreterPath);
		} else if (changes['AutoLibInclude']) {
			if (extsettings.AutoLibInclude > 1)
				parseuserlibs();
			if (extsettings.AutoLibInclude & 1)
				documents.all().forEach(async (e) => parseproject(e.uri.toLowerCase()));
		}
	}
});

documents.onDidOpen(async e => {
	let uri = e.document.uri.toLowerCase(), doc = new Lexer(e.document);
	lexers[uri] = doc, doc.actived = true, doc.d = lexers[uri]?.d || doc.d;
	if (extsettings.AutoLibInclude & 1)
		parseproject(uri);
});

// Only keep settings for open documents
documents.onDidClose(async e => {
	let uri = e.document.uri.toLowerCase();
	if (!lexers[uri] || (lexers[uri].d && !uri.includes('?')))
		return;
	lexers[uri].actived = false;
	for (let u in lexers)
		if (lexers[u].actived)
			for (let f in lexers[u].relevance)
				if (f === uri) return;
	connection.sendDiagnostics({ uri: lexers[uri].document.uri, diagnostics: [] });
	delete lexers[uri];
	let deldocs: string[] = [];
	for (let u in lexers)
		if (!lexers[u].actived && !(lexers[u].d && !u.includes('?'))) {
			let del = true;
			for (let f in lexers[u].relevance)
				if (lexers[f] && lexers[f].actived) {
					del = false; break;
				}
			if (del)
				deldocs.push(u);
		}
	for (let u of deldocs) {
		connection.sendDiagnostics({ uri: lexers[u].document.uri, diagnostics: [] });
		delete lexers[u];
	}
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
	let uri = change.document.uri.toLowerCase(), doc = lexers[uri];
	let initial = doc.include, cg = false;
	doc.parseScript();
	if (libfuncs[uri]) {
		libfuncs[uri].length = 0;
		libfuncs[uri].push(...Object.values(doc.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function));
	}
	for (const t in doc.include)
		if (!initial[t])
			initial[t] = doc.include[t], cg = true;
	if (!cg && Object.keys(initial).length === Object.keys(doc.include).length) {
		if (!doc.relevance)
			doc.relevance = getincludetable(uri).list;
		sendDiagnostics();
		return;
	}
	parseinclude(doc.include);
	doc.relevance = getincludetable(uri).list, resetrelevance();
	sendDiagnostics();
	function resetrelevance() {
		for (const u in initial)
			if (lexers[u])
				lexers[u].relevance = getincludetable(u).list;
	}
});

documents.onWillSaveWaitUntil((e) => {
	let doc = lexers[e.document.uri.toLowerCase()];
	if (doc.version !== e.document.version) {
		let tk = doc.tokens[0];
		if (tk.type === 'TK_BLOCK_COMMENT' || tk.type === '') {
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

connection.onDidChangeWatchedFiles((change) => {
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
connection.onDocumentOnTypeFormatting(typeFormatting);
connection.onDocumentSymbol(symbolProvider);
connection.onFoldingRanges(async (params: FoldingRangeParams): Promise<FoldingRange[]> => lexers[params.textDocument.uri.toLowerCase()].foldingranges);
connection.onHover(hoverProvider);
connection.onPrepareRename(prepareRename);
connection.onReferences(referenceProvider);
connection.onRenameRequest(renameProvider);
connection.onSignatureHelp(signatureProvider);
connection.onExecuteCommand(executeCommandProvider);
connection.onWorkspaceSymbol(workspaceSymbolProvider);
connection.languages.semanticTokens.on(semanticTokensOnFull);
connection.languages.semanticTokens.onDelta(semanticTokensOnDelta);
connection.languages.semanticTokens.onRange(semanticTokensOnRange);
documents.listen(connection);
connection.listen();
loadlocalize();
initahk2cache();
loadahk2();

async function executeCommandProvider(params: ExecuteCommandParams) {
	let args = params.arguments || [];
	switch (params.command) {
		case 'ahk2.fix.include':
			fixinclude(args[0], args[1]);
			break;
		case 'ahk2.generate.comment':
			generateComment(args);
			break;
		case 'ahk2.generate.author':
			generateAuthor();
			break;
		case 'ahk2.resetinterpreterpath':
			setInterpreter(args[0]);
			break;
	}
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	let uri = textDocument.uri, doc: Lexer;
	if (doc = lexers[uri = uri.toLowerCase()]) {
		doc.initlibdirs();
		if (doc.diagnostics.length)
			doc.parseScript();
	}
	parseproject(uri);
	if (libfuncs[uri]) {
		libfuncs[uri].length = 0;
		libfuncs[uri].push(...Object.values(doc.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function));
	}
}

let initnum = 0;
async function initpathenv(hasconfig = false, samefolder = false) {
	if (!hasconfig) {
		let t = await connection.workspace.getConfiguration('AutoHotkey2');
		if (!t && process.env.AHK2_LS_CONFIG)
			t = JSON.parse(process.env.AHK2_LS_CONFIG);
		if (!(set_Settings(t || extsettings)).InterpreterPath && !ahkpath_cur) return false;
		if (typeof extsettings.AutoLibInclude === 'string')
			extsettings.AutoLibInclude = LibIncludeType[extsettings.AutoLibInclude] as unknown as LibIncludeType;
		else if (typeof extsettings.AutoLibInclude === 'boolean')
			extsettings.AutoLibInclude = extsettings.AutoLibInclude ? 3 : 0;
	}
	let script = `
	#NoTrayIcon
	#Warn All, Off
	s := "", _H := false, Append := SubStr(A_AhkVersion, 1, 3) = "2.0" ? "FileAppend" : "FileAppend2"
	for _, p in [A_MyDocuments,A_Desktop,A_AhkPath,A_ProgramFiles,A_Programs,A_AhkVersion]
		s .= p "|"
	try _H := !!A_ThreadID
	%Append%(s _H "\`n", "*", "UTF-8")
	FileAppend2(text, file) {
		encode := "UTF-8"
		FileAppend %text%, %file%, %encode%
	}
	`
	let ret = runscript(script, (data: string) => {
		if (!(data = data.trim())) {
			connection.window.showErrorMessage(setting.getenverr());
			ret = false;
			return;
		}
		let paths = data.split('|'), s = ['mydocuments', 'desktop', 'ahkpath', 'programfiles', 'programs', 'version', 'h'], path = '';
		for (let i in paths)
			pathenv[s[i]] = paths[i].toLowerCase();
		if (!pathenv.ahkpath) {
			if (initnum < 3)
				setTimeout(() => {
					initnum++, initpathenv(true);
				}, 1000);
			return;
		}
		initnum = 1;
		if (pathenv.version?.match(/^1\./))
			connection.window.showErrorMessage(setting.versionerr());
		if (!samefolder) {
			libdirs.length = 0;
			if (existsSync(path = pathenv.mydocuments + '\\autohotkey\\lib'))
				libdirs.push(path.toLowerCase());
			if (existsSync(path = (ahkpath_cur || pathenv.ahkpath).replace(/[^\\/]+$/, 'lib')))
				libdirs.push(path.toLowerCase());
		}
		pathenv.h = (pathenv.h ?? '0').slice(0, 1);
		if (pathenv.h === '1') {
			if (!isahk2_h)
				set_ahk_h(true), samefolder = false;
			if (!hasahk2_hcache)
				hasahk2_hcache = true, loadahk2('ahk2_h');
		} else {
			if (isahk2_h)
				set_ahk_h(false), samefolder = false;
			if (hasahk2_hcache)
				hasahk2_hcache = false, initahk2cache(), loadahk2();
		}
		if (samefolder)
			return;
		for (const uri in lexers) {
			let doc = lexers[uri];
			if (!doc.d) {
				doc.initlibdirs();
				if (Object.keys(doc.include).length || doc.diagnostics.length) {
					doc.parseScript(), parseinclude(doc.include);
					doc.relevance = getincludetable(doc.uri).list;
				}
			}
		}
		sendDiagnostics();
		clearLibfuns();
		if (extsettings.AutoLibInclude > 1)
			parseuserlibs();
	});
	if (!ret) connection.window.showErrorMessage(setting.ahkpatherr());
	return ret;
}

async function parseuserlibs() {
	for (let dir of libdirs)
		for (let path of getallahkfiles(dir)) {
			let uri = URI.file(path).toString().toLowerCase(), d: Lexer, t: TextDocument;
			if (!libfuncs[uri]) {
				if (!(d = lexers[uri])) {
					if (!(t = openFile(path))) continue;
					d = new Lexer(t), d.parseScript();
				}
				libfuncs[uri] = Object.values(d.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function);
				Object.defineProperty(libfuncs[uri], 'islib', { value: inlibdirs(path, ...libdirs), enumerable: false });
				await sleep(50);
			}
		}
}

function inlibdirs(path: string, ...dirs: string[]) {
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

async function changeInterpreter(oldpath: string, newpath: string) {
	let samefolder = resolve(oldpath, '..').toLowerCase() === resolve(newpath, '..').toLowerCase();
	if (!samefolder) {
		let uri = URI.file(resolve(oldpath, '../lib')).toString().toLowerCase();
		for (const u in libfuncs) {
			if (u.startsWith(uri))
				delete libfuncs[u];
		}
	}
	if (await initpathenv(true, samefolder))
		documents.all().forEach(validateTextDocument);
}

async function setInterpreter(path: string) {
	let old = ahkpath_cur || extsettings.InterpreterPath;
	if (path.toLowerCase() === old.toLowerCase())
		return;
	set_ahkpath(path);
	changeInterpreter(old, path || extsettings.InterpreterPath);
}

async function parseproject(uri: string) {
	let doc: Lexer = lexers[uri];
	if (!libfuncs[uri])
		libfuncs[uri] = [], Object.defineProperty(libfuncs[uri], 'islib', { value: inlibdirs(URI.parse(uri).toString(), ...libdirs), enumerable: false });
	setTimeout(async () => {
		let searchdir = '', workspace = false;
		if (searchdir = inWorkspaceFolders(doc.document.uri))
			searchdir = URI.parse(searchdir).fsPath, workspace = true;
		else
			searchdir = doc.scriptdir + '\\lib';
		for (let path of getallahkfiles(searchdir)) {
			let u = URI.file(path).toString().toLowerCase(), d: Lexer, t: TextDocument;
			if (u !== uri && !libfuncs[u]) {
				libfuncs[u] = [], Object.defineProperty(libfuncs[u], 'islib', { value: inlibdirs(path, ...libdirs), enumerable: false });
				if (!(d = lexers[u])) {
					if (!(t = openFile(path))) continue;
					d = new Lexer(t), d.parseScript();
					if (workspace)
						lexers[u] = d;
				}
				libfuncs[u].push(...Object.values(d.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function));
				await sleep(50);
			}
		}
	}, 500);
}