import { URI } from 'vscode-uri';
import { resolve } from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	CancellationToken, createConnection, DidChangeConfigurationNotification, ExecuteCommandParams,
	InitializeResult, ProposedFeatures, SymbolKind, TextDocuments, TextDocumentSyncKind
} from 'vscode-languageserver/node';
import {
	a_vars, AHKLSSettings, ahkpath_cur, chinese_punctuations, clearLibfuns, codeActionProvider,
	colorPresentation, colorProvider, completionProvider, defintionProvider, diagnosticFull,
	documentFormatting, enum_ahkfiles, exportSymbols, extsettings, generateComment, hoverProvider,
	initahk2cache, isahk2_h, Lexer, lexers, libdirs, libfuncs, loadahk2, loadlocalize, openFile,
	parseinclude, prepareRename, rangeFormatting, referenceProvider, renameProvider, SemanticTokenModifiers,
	semanticTokensOnFull, semanticTokensOnRange, SemanticTokenTypes, set_ahk_h, set_ahkpath, set_Connection,
	set_dirname, set_locale, set_version, set_WorkspaceFolders, setting, signatureProvider, sleep, symbolProvider,
	typeFormatting, update_settings, utils, winapis, workspaceSymbolProvider
} from './common';
import { get_ahkProvider } from './ahkProvider';
import { resolvePath, runscript } from './scriptrunner';
import { PEFile, RESOURCE_TYPE, searchAndOpenPEFile } from './PEFile';

const languageServer = 'ahk2-language-server';
const documents = new TextDocuments(TextDocument);
const connection = set_Connection(createConnection(ProposedFeatures.all));
let hasConfigurationCapability = false, hasWorkspaceFolderCapability = false;
let uri_switch_to_ahk2 = '', workspaceFolders = new Set<string>();

connection.onInitialize(async params => {
	let capabilities = params.capabilities;
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

	const result: InitializeResult = {
		serverInfo: {
			name: languageServer,
		},
		capabilities: {
			textDocumentSync: {
				change: TextDocumentSyncKind.Incremental,
				openClose: true
			},
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: ['.', '#', '*']
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
					'ahk2.diagnostic.full',
					'ahk2.generate.comment',
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
					tokenTypes: Object.values(SemanticTokenTypes).filter(t => typeof t === 'string') as string[],
					tokenModifiers: Object.values(SemanticTokenModifiers).filter(t => typeof t === 'string') as string[]
				},
				full: true,
				range: true
			},
			workspaceSymbolProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		params.workspaceFolders?.forEach(it => workspaceFolders.add(it.uri.toLowerCase() + '/'));
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
	set_dirname(resolve(__dirname, '../..'));
	set_locale(configs?.locale ?? params.locale);
	utils.get_RCDATA = getRCDATA;
	utils.get_DllExport = getDllExport;
	utils.get_ahkProvider = get_ahkProvider;
	loadlocalize();
	initahk2cache();
	if (configs)
		update_settings(configs);
	if (!(await setInterpreter(resolvePath(extsettings.InterpreterPath ??= ''))))
		connection.window.showErrorMessage(setting.ahkpatherr());
	loadahk2();
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(event => {
			event.removed.forEach(it => workspaceFolders.delete(it.uri.toLowerCase() + '/'));
			event.added.forEach(it => workspaceFolders.add(it.uri.toLowerCase() + '/'));
			set_WorkspaceFolders(workspaceFolders);
		});
	}
	getDllExport(['user32', 'kernel32', 'comctl32', 'gdi32'].map(name => `C:\\Windows\\System32\\${name}.dll`))
		.then(val => winapis.push(...val));
});

connection.onDidChangeConfiguration(async change => {
	let newset: AHKLSSettings | undefined = change?.settings;
	if (hasConfigurationCapability && !newset)
		newset = await connection.workspace.getConfiguration('AutoHotkey2');
	if (!newset) {
		connection.window.showWarningMessage('Failed to obtain the configuration');
		return;
	}
	let { AutoLibInclude, InterpreterPath } = extsettings;
	update_settings(newset);
	set_WorkspaceFolders(workspaceFolders);
	if (InterpreterPath !== extsettings.InterpreterPath) {
		if (await setInterpreter(resolvePath(extsettings.InterpreterPath ??= '')))
			connection.sendRequest('ahk2.updateStatusBar', [extsettings.InterpreterPath]);
	}
	if (AutoLibInclude !== extsettings.AutoLibInclude) {
		if (extsettings.AutoLibInclude > 1)
			parseuserlibs();
		if (extsettings.AutoLibInclude & 1)
			documents.all().forEach(e => parseproject(e.uri.toLowerCase()));
	}
});

documents.onDidOpen(e => {
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

documents.onDidClose(e => lexers[e.document.uri.toLowerCase()]?.close());
documents.onDidChangeContent(e => lexers[e.document.uri.toLowerCase()].update());

connection.onCodeAction(codeActionProvider);
connection.onCompletion(completionProvider);
connection.onColorPresentation(colorPresentation);
connection.onDocumentColor(colorProvider);
connection.onDefinition(defintionProvider);
connection.onDocumentFormatting(documentFormatting);
connection.onDocumentRangeFormatting(rangeFormatting);
connection.onDocumentOnTypeFormatting(typeFormatting);
connection.onDocumentSymbol(symbolProvider);
connection.onFoldingRanges(params => lexers[params.textDocument.uri.toLowerCase()].foldingranges);
connection.onHover(hoverProvider);
connection.onPrepareRename(prepareRename);
connection.onReferences(referenceProvider);
connection.onRenameRequest(renameProvider);
connection.onSignatureHelp(signatureProvider);
connection.onExecuteCommand(executeCommandProvider);
connection.onWorkspaceSymbol(workspaceSymbolProvider);
connection.languages.semanticTokens.on(semanticTokensOnFull);
connection.languages.semanticTokens.onRange(semanticTokensOnRange);
connection.onRequest('ahk2.exportSymbols', (uri: string) => exportSymbols(uri));
connection.onRequest('ahk2.getAHKversion', getAHKversion);
connection.onRequest('ahk2.getContent', (uri: string) => lexers[uri.toLowerCase()]?.document.getText());
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
connection.onNotification('onDidCloseTextDocument', (params: { uri: string, id: string }) => {
	if (params.id === 'ahk2')
		lexers[params.uri.toLowerCase()]?.close(true);
	else uri_switch_to_ahk2 = params.uri;
});
documents.listen(connection);
connection.listen();

function executeCommandProvider(params: ExecuteCommandParams, token?: CancellationToken) {
	if (token?.isCancellationRequested) return;
	let args = params.arguments || [];
	switch (params.command) {
		case 'ahk2.diagnostic.full':
			diagnosticFull();
			break;
		case 'ahk2.generate.comment':
			generateComment();
			break;
		case 'ahk2.resetinterpreterpath':
			setInterpreter(args[0]);
			break;
	}
}

function validateTextDocument(textDocument: TextDocument) {
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

async function initpathenv(samefolder = false, retry = true): Promise<boolean> {
	let script = `
	#NoTrayIcon
	#Warn All, Off
	s := "", _H := false, Append := SubStr(A_AhkVersion, 1, 1) = "1" ? "FileAppend2" : "FileAppend"
	for _, p in ["a_ahkpath","a_appdata","a_appdatacommon","a_computername","a_comspec","a_desktop","a_desktopcommon","a_iscompiled","a_mydocuments","a_programfiles","a_programs","a_programscommon","a_startmenu","a_startmenucommon","a_startup","a_startupcommon","a_temp","a_username","a_windir","a_ahkversion"]
		s .= SubStr(p, 3) "\`t" %p% "|"
	try _H := !!A_ThreadID
	%Append%(s "is64bit\`t" (A_PtrSize = 8) "|h\`t" _H "\`n", "*", "UTF-8")
	FileAppend2(text, file, encode) {
		FileAppend %text%, %file%, %encode%
	}`;
	let fail = 0, data = runscript(script);
	if (data === undefined) {
		if (retry)
			return initpathenv(samefolder, false);
		connection.window.showErrorMessage(setting.ahkpatherr());
		return false;
	}
	if (!(data = data.trim())) {
		let path = ahkpath_cur;
		if ((await getAHKversion([path]))[0].endsWith('[UIAccess]')) {
			let ret = false, n = path.replace(/_uia\.exe$/i, '.exe');
			fail = 2;
			if (path !== n && (n = resolvePath(n, true)) && !(await getAHKversion([n]))[0].endsWith('[UIAccess]')) {
				set_ahkpath(n);
				if (ret = await initpathenv(samefolder))
					fail = 0;
				set_ahkpath(path);
			}
			fail && connection.window.showWarningMessage(setting.uialimit());
			await update_rcdata();
			if (ret)
				return true;
		} else fail = 1;
		if (fail !== 2 && retry)
			return initpathenv(samefolder, false);
		if (!a_vars.mydocuments)
			connection.window.showErrorMessage(setting.getenverr());
		return false;
	}
	Object.assign(a_vars, Object.fromEntries(data.replace(/\t[A-Z]:\\/g, m => m.toLowerCase()).split('|').map(l => l.split('\t'))));
	a_vars.ahkpath = ahkpath_cur;
	set_version(a_vars.ahkversion ??= '2.0.0');
	if (a_vars.ahkversion.startsWith('1.'))
		connection.window.showErrorMessage(setting.versionerr());
	if (!samefolder) {
		libdirs.length = 0;
		libdirs.push(a_vars.mydocuments + '\\AutoHotkey\\Lib\\',
			a_vars.ahkpath.replace(/[^\\/]+$/, 'Lib\\'));
		let lb: any;
		for (lb of Object.values(libfuncs))
			lb.inlib = inlibdirs(lb.fsPath);
	}
	a_vars.h = (a_vars.h ?? '0').slice(0, 1);
	if (a_vars.h === '1') {
		if (!isahk2_h)
			set_ahk_h(true), samefolder = false, loadahk2('ahk2_h'), loadahk2('winapi', 4);
	} else {
		if (isahk2_h)
			set_ahk_h(false), samefolder = false, initahk2cache(), loadahk2();
	}
	await update_rcdata();
	if (samefolder)
		return true;
	for (const uri in lexers) {
		let doc = lexers[uri];
		if (!doc.d) {
			doc.initlibdirs();
			if (Object.keys(doc.include).length || doc.diagnostics.length)
				doc.update();
		}
	}
	clearLibfuns();
	if (extsettings.AutoLibInclude > 1)
		parseuserlibs();
	return true;
	async function update_rcdata() {
		let pe = new PEFile(ahkpath_cur);
		try {
			let rc = await pe.getResource(RESOURCE_TYPE.RCDATA);
			curPERCDATA = rc;
		} catch (e) { }
		finally { pe.close(); }
	}
}

async function parseuserlibs() {
	let dir: string, path: string, uri: string, d: Lexer, t: TextDocument | undefined;
	for (dir of libdirs)
		for await (path of enum_ahkfiles(dir)) {
			if (!libfuncs[uri = URI.file(path).toString().toLowerCase()]) {
				if (!(d = lexers[uri]))
					if (!(t = openFile(path)) || (d = new Lexer(t)).d || (d.parseScript(), d.maybev1))
						continue;
				if (d.d) continue;
				libfuncs[uri] = Object.values(d.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function);
				Object.defineProperties(libfuncs[uri], {
					islib: { value: inlibdirs(path), enumerable: false },
					fsPath: { value: path, enumerable: false }
				});
				await sleep(50);
			}
		}
}

function inlibdirs(path: string) {
	path = path.toLowerCase();
	for (const p of libdirs) {
		if (path.startsWith(p.toLowerCase()))
			return true;
	}
	return false;
}

async function changeInterpreter(oldpath: string, newpath: string) {
	let samefolder = resolve(oldpath, '..').toLowerCase() === resolve(newpath, '..').toLowerCase();
	if (!(await initpathenv(samefolder)))
		return false;
	if (!samefolder) {
		let uri = URI.file(resolve(oldpath, '../lib')).toString().toLowerCase();
		for (const u in libfuncs) {
			if (u.startsWith(uri))
				delete libfuncs[u];
		}
	}
	documents.all().forEach(validateTextDocument);
	return true;
}

async function setInterpreter(path: string) {
	let old = ahkpath_cur;
	if (!path || path.toLowerCase() === old.toLowerCase())
		return false;
	set_ahkpath(path);
	if (!(await changeInterpreter(old, path)))
		set_ahkpath(old);
	return true;
}

async function parseproject(uri: string) {
	let doc: Lexer = lexers[uri];
	if (!doc.d && !libfuncs[uri])
		Object.defineProperties(libfuncs[uri] = [], {
			islib: { value: inlibdirs(doc.fsPath), enumerable: false },
			fsPath: { value: doc.fsPath, enumerable: false }
		});
	setTimeout(async () => {
		let searchdir = '', workspace = false, uri: string, path: string, d: Lexer, t: TextDocument | undefined;
		if (searchdir = doc.workspaceFolder)
			searchdir = URI.parse(searchdir).fsPath, workspace = true;
		else
			searchdir = doc.scriptdir + '\\lib';
		for await (path of enum_ahkfiles(searchdir)) {
			if (!libfuncs[uri = URI.file(path).toString().toLowerCase()]) {
				if (!(d = lexers[uri])) {
					if (!(t = openFile(path)) || (d = new Lexer(t)).d || (d.parseScript(), d.maybev1))
						continue;
					workspace && parseinclude(lexers[uri] = d, d.scriptdir);
				}
				if (d.d) continue;
				libfuncs[uri] = Object.values(d.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function);
				Object.defineProperties(libfuncs[uri], {
					islib: { value: inlibdirs(path), enumerable: false },
					fsPath: { value: path, enumerable: false }
				});
				await sleep(50);
			}
		}
	}, 500);
}

async function getAHKversion(params: string[]) {
	return Promise.all(params.map(async path => {
		let pe: PEFile | undefined;
		try {
			pe = new PEFile(path);
			let props = (await pe.getResource(RESOURCE_TYPE.VERSION))[0].StringTable[0];
			if (props.ProductName?.toLowerCase().startsWith('autohotkey')) {
				let is_bit64 = await pe.is_bit64;
				let m = (await pe.getResource(RESOURCE_TYPE.MANIFEST))[0]?.replace(/<!--[\s\S]*?-->/g, '') ?? '';
				let version = `${props.ProductName} ${props.ProductVersion ?? 'unknown version'} ${is_bit64 ? '64' : '32'} bit`;
				if (m.includes('uiAccess="true"'))
					version += ' [UIAccess]';
				return version;
			}
		} catch (e) { }
		finally { pe?.close(); }
		return 'unknown version';
	}));
}

async function getDllExport(paths: string[], onlyone = false) {
	let funcs: any = {};
	for (let path of paths) {
		let pe = await searchAndOpenPEFile(path, a_vars.is64bit === '1' ? true : a_vars.is64bit === '0' ? false : undefined);
		if (!pe) continue;
		try {
			(await pe.getExport())?.Functions.forEach((it) => funcs[it.Name] = true);
			if (onlyone) break;
		} finally { pe.close(); }
	}
	delete funcs[''];
	return Object.keys(funcs);
}

let curPERCDATA: { [key: string]: Buffer } | undefined = undefined;
function getRCDATA(name: string | undefined) {
	let exe = resolvePath(ahkpath_cur, true), path = `${exe}:${name}`;
	if (!exe) return;
	let uri = URI.from({ scheme: 'ahkres', path }).toString().toLowerCase();
	if (lexers[uri])
		return { uri, path };
	exe = exe.toLowerCase();
	if (!name || !curPERCDATA)
		return;
	let data = curPERCDATA[name];
	if (!data)
		return;
	try {
		let doc = lexers[uri] = new Lexer(TextDocument.create(uri, 'ahk2', -10, new TextDecoder('utf8', { fatal: true }).decode(data)));
		doc.parseScript();
		return { uri, path };
	} catch { delete curPERCDATA[name]; }
}