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
	InitializeResult, ProposedFeatures, SymbolKind, TextDocumentChangeEvent, TextDocuments, TextDocumentSyncKind, WorkspaceFoldersChangeEvent
} from 'vscode-languageserver/node';
import {
	AHKLSSettings, chinese_punctuations, clearLibfuns, codeActionProvider, colorPresentation, colorProvider, completionProvider, defintionProvider,
	documentFormatting, extsettings, fixinclude, generateAuthor, generateComment, getallahkfiles, getincludetable, hoverProvider,
	initahk2cache, isahk2_h, Lexer, lexers, libdirs, libfuncs, loadahk2, loadlocalize, openFile, parseinclude, pathenv, prepareRename,
	rangeFormatting, referenceProvider, renameProvider, runscript, semanticTokensOnDelta, semanticTokensOnFull, semanticTokensOnRange,
	sendDiagnostics, set_ahk_h, set_Connection, set_dirname, set_locale, set_Workspacefolder, setting, signatureProvider, sleep,
	symbolProvider, typeFormatting, workspaceFolders, ahkpath_cur, set_ahkpath, workspaceSymbolProvider, inWorkspaceFolders,
	parseWorkspaceFolders, winapis, update_settings
} from './common';
import { PEFile, RESOURCE_TYPE, searchAndOpenPEFile } from './PEFile';

const languageServer = 'ahk2-language-server';
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument), hasahk2_hcache = false, connection: Connection;
let hasConfigurationCapability: boolean = false, hasWorkspaceFolderCapability: boolean = false, hasDiagnosticRelatedInformationCapability: boolean = false;
let initnum = 0, uri_switch_to_ahk2 = '';

connection = createConnection(ProposedFeatures.all);
set_Connection(connection, false, getDllExport, getRCDATA);
set_dirname(__dirname);

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
	set_Workspacefolder(params.workspaceFolders?.map(it => it.uri.toLowerCase() + '/'));
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
			documentOnTypeFormattingProvider: { firstTriggerCharacter: '}', moreTriggerCharacter: ['\n', ...Object.keys(chinese_punctuations)] },
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
						'number'
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

	let configs: AHKLSSettings | undefined;
	if (process.env.AHK2_LS_CONFIG)
		try { configs = JSON.parse(process.env.AHK2_LS_CONFIG); } catch { }
	if (params.initializationOptions)
		configs = Object.assign(configs ?? {}, params.initializationOptions);
	let locale = configs?.locale ?? params.locale;
	if (locale)
		set_locale(locale);
	loadlocalize();
	initahk2cache();
	loadahk2();
	if (configs) {
		locale = configs.locale;
		update_settings(configs);
		if (existsSync(extsettings.InterpreterPath))
			initpathenv();
		else connection.window.showErrorMessage(setting.ahkpatherr());
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
			set_Workspacefolder(workspaceFolders.filter(it => !del.includes(it)));
			event.added.map(it => workspaceFolders.push(it.uri.toLowerCase() + '/'));
			parseWorkspaceFolders();
		});
	}
	setTimeout(async () => {
		parseWorkspaceFolders();
		winapis.push(...getDllExport(['user32', 'kernel32', 'comctl32', 'gdi32'].map(it => `C:\\Windows\\System32\\${it}.dll`)));
	}, 500);
});

connection.onDidChangeConfiguration(async (change: any) => {
	let newset: AHKLSSettings | undefined = change?.settings;
	if (hasConfigurationCapability && !newset)
		newset = await connection.workspace.getConfiguration('AutoHotkey2');
	if (!newset) {
		connection.window.showWarningMessage('Failed to obtain the configuration');
		return;
	}
	let old = extsettings.AutoLibInclude;
	if (newset.InterpreterPath !== extsettings.InterpreterPath) {
		setInterpreter(newset.InterpreterPath);
		connection.sendRequest('ahk2.updateStatusBar', [newset.InterpreterPath]);
	}
	update_settings(newset);
	if (old !== extsettings.AutoLibInclude) {
		if (extsettings.AutoLibInclude > 1)
			parseuserlibs();
		if (extsettings.AutoLibInclude & 1)
			documents.all().forEach(async (e) => parseproject(e.uri.toLowerCase()));
	}
});

documents.onDidOpen(async e => {
	let to_ahk2 = uri_switch_to_ahk2 === e.document.uri;
	let uri = e.document.uri.toLowerCase(), doc = lexers[uri];
	if (doc) doc.document = e.document;
	else lexers[uri] = doc = new Lexer(e.document);
	doc.actived = true;
	if (to_ahk2)
		doc.actionwhenv1 = 'Continue';
	if (extsettings.AutoLibInclude & 1)
		parseproject(uri);
});

// Only keep settings for open documents
documents.onDidClose(e => lexers[e.document.uri.toLowerCase()]?.close());

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => lexers[change.document.uri.toLowerCase()].update());

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
connection.onRequest('ahk2.getAHKversion', getAHKversion);
connection.onRequest('ahk2.getVersionInfo', (uri: string) => {
	let doc = lexers[uri.toLowerCase()];
	if (doc) {
		let tk = doc.get_token(0);
		if ((tk.type === 'TK_BLOCK_COMMENT' || tk.type === '') && tk.content.match(/^\s*[;*]?\s*@(date|version)\b/im)) {
			return {
				uri: uri,
				content: tk.content,
				range: {
					start: doc.document.positionAt(tk.offset),
					end: doc.document.positionAt(tk.offset + tk.length)
				}
			};
		}
	}
	return null;
});
connection.onRequest('ahk2.getContent', (uri: string) => lexers[uri.toLowerCase()]?.document.getText());
connection.onNotification('onDidCloseTextDocument',
	(params: { uri: string, id: string }) => {
		if (params.id === 'ahk2')
			lexers[params.uri.toLowerCase()]?.close(true);
		else uri_switch_to_ahk2 = params.uri;
	});
	connection.onDidCloseTextDocument
documents.listen(connection);
connection.listen();

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
		if (libfuncs[uri]) {
			libfuncs[uri].length = 0;
			libfuncs[uri].push(...Object.values(doc.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function));
		}
	}
	if (extsettings.AutoLibInclude & 1)
		parseproject(uri);
}

function initpathenv(samefolder = false) {
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
	}`;
	let fail = 0;
	let ret = runscript(script, (data: string) => {
		if (!(data = data.trim())) {
			let path = ahkpath_cur || extsettings.InterpreterPath;
			if (getAHKversion([path])[0].endsWith('[UIAccess]')) {
				let ret = false, n = path.replace(/_uia\.exe$/i, '.exe');
				fail = 2;
				if (path !== n && existsSync(n) && !getAHKversion([n])[0].endsWith('[UIAccess]')) {
					set_ahkpath(n);
					if (ret = initpathenv(samefolder))
						fail = 0;
					set_ahkpath(path);
				}
				connection.window.showWarningMessage(setting.uialimit());
				if (ret)
					return;
			} else fail = 1;
			if (!pathenv.mydocuments)
				connection.window.showErrorMessage(setting.getenverr());
			return;
		}
		let paths = data.split('|'), s = ['mydocuments', 'desktop', 'ahkpath', 'programfiles', 'programs', 'version', 'h'], path = '';
		for (let i in paths)
			pathenv[s[i]] = paths[i].toLowerCase();
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
					doc.parseScript(), parseinclude(doc.include, doc.scriptdir);
					doc.relevance = getincludetable(doc.uri).list;
				}
			}
		}
		sendDiagnostics();
		clearLibfuns();
		if (extsettings.AutoLibInclude > 1)
			parseuserlibs();
	});
	if (!ret)
		connection.window.showErrorMessage(setting.ahkpatherr());
	else if (!pathenv.ahkpath && fail !== 2) {
		if (initnum < 3)
			setTimeout(() => {
				initnum++, initpathenv();
			}, 1000);
		return false;
	}
	return ret && !fail;
}

async function parseuserlibs() {
	for (let dir of libdirs)
		for (let path of getallahkfiles(dir)) {
			let uri = URI.file(path).toString().toLowerCase(), d: Lexer, t: TextDocument | undefined;
			if (!libfuncs[uri]) {
				if (!(d = lexers[uri])) {
					if (!(t = openFile(path))) continue;
					d = new Lexer(t), d.parseScript();
					if (d.maybev1) {
						d.close();
						continue;
					}
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
	if (initpathenv(samefolder))
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
			let u = URI.file(path).toString().toLowerCase(), d: Lexer, t: TextDocument | undefined;
			if (u !== uri && !libfuncs[u]) {
				if (!(d = lexers[u])) {
					if (!(t = openFile(path))) continue;
					d = new Lexer(t), d.parseScript();
					if (d.maybev1) {
						d.close();
						continue;
					}
					if (workspace)
						lexers[u] = d;
				}
				libfuncs[u] = Object.values(d.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function);
				Object.defineProperty(libfuncs[u], 'islib', { value: inlibdirs(path, ...libdirs), enumerable: false });
				await sleep(50);
			}
		}
	}, 500);
}

function getAHKversion(params: string[]) {
	return params.map(path => {
		try {
			let pe = new PEFile(path);
			let props = pe.getResource(RESOURCE_TYPE.VERSION)[0].StringTable[0];
			if (props.ProductName?.toLowerCase().startsWith('autohotkey')) {
				let m = pe.getResource(RESOURCE_TYPE.MANIFEST)[0]?.replace(/<!--[\s\S]*?-->/g, '') ?? '';
				let version = `${props.ProductName} ${props.ProductVersion ?? 'unknown version'} ${pe.isBit64 ? '64' : '32'} bit`;
				if (m.includes('uiAccess="true"'))
					version += ' [UIAccess]';
				return version;
			}
		} catch (e) { }
		return '';
	});
}

function getDllExport(paths: string[], onlyone = false) {
	let funcs: any = {};
	for (let path of paths) {
		let pe = searchAndOpenPEFile(path);
		if (pe) {
			pe.getExport()?.Functions.map((it) => funcs[it.Name] = true);
			if (onlyone) break;
		}
	}
	delete funcs[''];
	return Object.keys(funcs);
}

let curPERCDATA: { exe: string, data: Map<number | string, Buffer> } | undefined = undefined;
function getRCDATA(name: string | undefined) {
	let exe = ahkpath_cur || extsettings.InterpreterPath, path = `${exe}:${name}`;
	let uri = URI.from({ scheme: 'ahkres', path }).toString().toLowerCase();
	if (lexers[uri])
		return { uri, path };
	if (!existsSync(exe))
		return undefined;
	exe = exe.toLowerCase();
	let rc: { [name: string]: Buffer } = curPERCDATA?.exe === exe ? curPERCDATA.data :
		(curPERCDATA = { exe, data: new PEFile(exe).getResource(RESOURCE_TYPE.RCDATA) }).data;
	if (!name || !rc)
		return rc;
	let data = rc[name];
	if (data) {
		try {
			let doc = lexers[uri] = new Lexer(TextDocument.create(uri, 'ahk2', -10, new TextDecoder('utf8', { fatal: true }).decode(data)));
			doc.parseScript();
			return { uri, path };
		} catch {
			delete rc[name];
		}
	}
	return undefined;
}