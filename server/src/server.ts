import { resolve } from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	createConnection, DidChangeConfigurationNotification, InitializeResult,
	ProposedFeatures, SymbolKind, TextDocuments, TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { get_ahkProvider } from './ahkProvider';
import {
	a_vars, interpreterPath, builtin_variable, builtin_variable_h, chinese_punctuations, clearLibfuns, codeActionProvider,
	colorPresentation, colorProvider, commands, completionProvider, defintionProvider,
	documentFormatting, enum_ahkfiles, executeCommandProvider, exportSymbols, getVersionInfo, hoverProvider,
	initahk2cache, isahk2_h, Lexer, lexers, libdirs, libfuncs, loadAHK2, loadlocalize, openFile,
	parse_include, prepareRename, rangeFormatting, read_ahk_file, referenceProvider, renameProvider, SemanticTokenModifiers,
	semanticTokensOnFull, semanticTokensOnRange, SemanticTokenTypes, set_ahk_h, setInterpreterPath, set_Connection,
	set_dirname, set_locale, set_version, set_WorkspaceFolders, setting, signatureProvider, sleep, symbolProvider,
	traverse_include, typeFormatting, updateConfig, utils, winapis, workspaceSymbolProvider
} from './common';
import { PEFile, RESOURCE_TYPE, searchAndOpenPEFile } from './PEFile';
import { resolvePath, runscript } from './scriptrunner';
import { AHKLSConfig, CfgKey, configPrefix, getCfg, shouldIncludeUserStdLib, shouldIncludeLocalLib, setCfg } from '../../util/src/config';
import { klona } from 'klona/json';
import { clientExecuteCommand, clientUpdateStatusBar, extSetInterpreter, serverExportSymbols, serverGetAHKVersion, serverGetContent, serverGetVersionInfo, serverResetInterpreterPath } from '../../util/src/env';

const languageServer = 'ahk2-language-server';
const documents = new TextDocuments(TextDocument);
const connection = set_Connection(createConnection(ProposedFeatures.all));
const workspaceFolders = new Set<string>();
let hasConfigurationCapability = false, hasWorkspaceFolderCapability = false;
let uri_switch_to_ahk2 = '';

// Cannot be done on browser, so added here
commands[serverResetInterpreterPath] = (args: string[]) =>
	setInterpreter((args[0]).replace(/^[A-Z]:/, m => m.toLowerCase()));

connection.onInitialize(async params => {
	const capabilities = params.capabilities;
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
				triggerCharacters: ['.', '#', '*', '@']
			},
			signatureHelpProvider: {
				triggerCharacters: ['(', ',', ' ']
			},
			documentSymbolProvider: true,
			definitionProvider: true,
			documentFormattingProvider: true,
			documentRangeFormattingProvider: true,
			documentOnTypeFormattingProvider: { firstTriggerCharacter: '}', moreTriggerCharacter: ['\n', ...Object.keys(chinese_punctuations)] },
			executeCommandProvider: { commands: Object.keys(commands) },
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
		result.capabilities.workspace = { workspaceFolders: { supported: true } };
	}

	let initialConfig: AHKLSConfig | undefined;
	const env = process.env;
	if (env.AHK2_LS_CONFIG)
		try { initialConfig = JSON.parse(env.AHK2_LS_CONFIG); } catch { }
	if (params.initializationOptions)
		initialConfig = Object.assign(initialConfig ?? {}, params.initializationOptions);
	set_dirname(resolve(__dirname, '../..'));
	set_locale((initialConfig ? getCfg(CfgKey.Locale, initialConfig) : undefined) ?? params.locale);
	utils.get_RCDATA = getRCDATA;
	utils.get_DllExport = getDllExport;
	utils.get_ahkProvider = get_ahkProvider;
	loadlocalize();
	initahk2cache();
	if (initialConfig)
		updateConfig(initialConfig);
	if (!getCfg(CfgKey.InterpreterPath)) setCfg(CfgKey.InterpreterPath, '');
	if (!(await setInterpreter(resolvePath(getCfg(CfgKey.InterpreterPath)))))
		patherr(setting.ahkpatherr());
	set_WorkspaceFolders(workspaceFolders);
	loadAHK2();
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
	let newConfig: AHKLSConfig | undefined = change?.settings;
	if (hasConfigurationCapability && !newConfig)
		newConfig = await connection.workspace.getConfiguration(configPrefix);
	if (!newConfig) {
		connection.window.showWarningMessage('Failed to obtain the configuration');
		return;
	}
	// clone the old config to compare
	const oldConfig = klona(getCfg<AHKLSConfig>());
	updateConfig(newConfig); // this updates the object in-place, hence the clone above
	set_WorkspaceFolders(workspaceFolders);
	const newInterpreterPath = getCfg(CfgKey.InterpreterPath);
	if (newInterpreterPath !== getCfg(CfgKey.InterpreterPath, oldConfig)) {
		if (await setInterpreter(resolvePath(newInterpreterPath)))
			connection.sendRequest(clientUpdateStatusBar, [newInterpreterPath]);
	}
	if (getCfg(CfgKey.LibrarySuggestions) !== getCfg(CfgKey.LibrarySuggestions, oldConfig)) {
		if (shouldIncludeUserStdLib() && !shouldIncludeUserStdLib(oldConfig))
			parseuserlibs();
		if (shouldIncludeLocalLib() && !shouldIncludeLocalLib(oldConfig))
			documents.all().forEach(e => parseproject(e.uri.toLowerCase()));
	}
	if (getCfg(CfgKey.Syntaxes) !== getCfg(CfgKey.Syntaxes, oldConfig)) {
		initahk2cache(), loadAHK2();
		if (isahk2_h)
			loadAHK2('ahk_h'), loadAHK2('winapi', 4);
	}
});

connection.onDidChangeWatchedFiles((change) => {
	let uri, lex;
	for (const c of change.changes)
		switch (c.type) {
			case 2:
				if ((lex = lexers[c.uri.toLowerCase()])?.actived === false)
					TextDocument.update(lex.document, [{ text: read_ahk_file(lex.fsPath) ?? '' }], 0), lex.update();
				break;
			case 3:
				if ((lex = lexers[uri = c.uri.toLowerCase()]))
					lex.close(true), delete lexers[uri];
				break;
		}
});

documents.onDidOpen(e => {
	const to_ahk2 = uri_switch_to_ahk2 === e.document.uri;
	const uri = e.document.uri.toLowerCase();
	let lexer = lexers[uri];
	if (lexer) lexer.document = e.document;
	else lexers[uri] = lexer = new Lexer(e.document);
	Object.defineProperty(lexer.include, '', { value: '', enumerable: false });
	lexer.actived = true;
	if (to_ahk2)
		lexer.actionWhenV1Detected = 'Continue';
	if (shouldIncludeLocalLib())
		parseproject(uri).then(() => lexer.last_diags &&
			Object.keys(lexer.included).length && lexer.update());
});

documents.onDidClose(e => lexers[e.document.uri.toLowerCase()]?.close());
documents.onDidChangeContent(e => lexers[e.document.uri.toLowerCase()]?.update());

connection.onCodeAction(codeActionProvider);
connection.onCompletion(completionProvider);
connection.onColorPresentation(colorPresentation);
connection.onDocumentColor(colorProvider);
connection.onDefinition(defintionProvider);
connection.onDocumentFormatting(documentFormatting);
connection.onDocumentRangeFormatting(rangeFormatting);
connection.onDocumentOnTypeFormatting(typeFormatting);
connection.onDocumentSymbol(symbolProvider);
connection.onFoldingRanges(params => lexers[params.textDocument.uri.toLowerCase()]?.foldingranges);
connection.onHover(hoverProvider);
connection.onPrepareRename(prepareRename);
connection.onReferences(referenceProvider);
connection.onRenameRequest(renameProvider);
connection.onSignatureHelp(signatureProvider);
connection.onExecuteCommand(executeCommandProvider);
connection.onWorkspaceSymbol(workspaceSymbolProvider);
connection.languages.semanticTokens.on(semanticTokensOnFull);
connection.languages.semanticTokens.onRange(semanticTokensOnRange);
connection.onRequest(serverExportSymbols, (uri: string) => exportSymbols(uri));
connection.onRequest(serverGetAHKVersion, getAHKversion);
connection.onRequest(serverGetContent, (uri: string) => lexers[uri.toLowerCase()]?.document.getText());
connection.onRequest(serverGetVersionInfo, getVersionInfo);
connection.onNotification('onDidCloseTextDocument', (params: { uri: string, id: string }) => {
	if (params.id === 'ahk2')
		lexers[params.uri.toLowerCase()]?.close(true);
	else uri_switch_to_ahk2 = params.uri;
});
documents.listen(connection);
connection.listen();

/**
 * Shows error message indicating the path could not be resolved.
 * If possible, prompts the user to set their AHK v2 interpreter.
 */
async function patherr(msg: string) {
	if (!getCfg(CfgKey.Commands)?.includes(clientExecuteCommand))
		return connection.window.showErrorMessage(msg);
	if (await connection.window.showErrorMessage(msg, { title: 'Select AHK v2 interpreter' }))
		connection.sendRequest(clientExecuteCommand, [extSetInterpreter]);
}

async function initpathenv(samefolder = false, retry = true): Promise<boolean> {
	const script = `
	#NoTrayIcon
	#Warn All, Off
	s := "", Append := SubStr(A_AhkVersion, 1, 1) = "1" ? "FileAppend2" : "FileAppend"
	for _, k in ${JSON.stringify([...builtin_variable, ...builtin_variable_h])}
		try if SubStr(k, 1, 2) = "a_" && !IsObject(v := %k%)
			s .= SubStr(k, 3) "|" v "\`n"
	%Append%(s, "*", "utf-8")
	FileAppend2(text, file, encode) {
		FileAppend %text%, %file%, %encode%
	}`;
	let fail = 0, data = runscript(script);
	if (data === undefined) {
		if (retry)
			return initpathenv(samefolder, false);
		patherr(setting.ahkpatherr());
		return false;
	}
	if (!(data = data.trim())) {
		const path = interpreterPath;
		if ((await getAHKversion([path]))[0].endsWith('[UIAccess]')) {
			let ret = false, n = path.replace(/_uia\.exe$/i, '.exe');
			fail = 2;
			if (
				path !== n &&
				(n = resolvePath(n, true)) &&
				!(await getAHKversion([n]))[0].endsWith('[UIAccess]')
			) {
				setInterpreterPath(n);
				if ((ret = await initpathenv(samefolder)))
					fail = 0;
				setInterpreterPath(path);
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
	Object.assign(a_vars, Object.fromEntries(data.replace(/|[A-Z]:\\/g, m => m.toLowerCase()).split('\n').map(l => l.split('|'))));
	a_vars.ahkpath ??= interpreterPath;
	set_version(a_vars.ahkversion ??= '2.0.0');
	if (a_vars.ahkversion.startsWith('1.'))
		patherr(setting.versionerr());
	if (!samefolder || !libdirs.length) {
		libdirs.length = 0;
		libdirs.push(a_vars.mydocuments + '\\AutoHotkey\\Lib\\',
			a_vars.ahkpath.replace(/[^\\/]+$/, 'Lib\\'));
		let lb;
		for (lb of Object.values(libfuncs))
			lb.islib = inlibdirs(lb.fsPath);
	}
	if (a_vars.threadid) {
		if (!isahk2_h) {
			set_ahk_h(true);
			samefolder = false;
			loadAHK2('ahk2_h');
			loadAHK2('winapi', 4);
		}
	} else {
		if (isahk2_h)
		{
			set_ahk_h(false);
			samefolder = false;
			initahk2cache();
			loadAHK2();
		}
	}
	Object.assign(a_vars, { index: '0', clipboard: '', threadid: '' });
	await update_rcdata();
	if (samefolder)
		return true;
	for (const uri in lexers) {
		const doc = lexers[uri];
		if (!doc.d) {
			doc.initLibDirs();
			if (Object.keys(doc.include).length || doc.diagnostics.length)
				doc.update();
		}
	}
	clearLibfuns();
	if (shouldIncludeUserStdLib())
		parseuserlibs();
	return true;
	async function update_rcdata() {
		const pe = new PEFile(interpreterPath);
		try {
			const rc = await pe.getResource(RESOURCE_TYPE.RCDATA);
			curPERCDATA = rc;
		} catch (e) { }
		finally { pe.close(); }
	}
}

function get_lib_symbols(lex: Lexer) {
	return Object.assign(
		Object.values(lex.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function),
		{ fsPath: lex.fsPath, islib: inlibdirs(lex.fsPath) }
	);
}

async function parseuserlibs() {
	let dir: string, path: string, uri: string, d: Lexer, t: TextDocument | undefined;
	for (dir of libdirs)
		for await (path of enum_ahkfiles(dir)) {
			if (!libfuncs[uri = URI.file(path).toString().toLowerCase()]) {
				if (!(d = lexers[uri]))
					if (!(t = openFile(path)) || (d = new Lexer(t)).d || (d.parseScript(), d.maybev1))
						continue;
				libfuncs[uri] = get_lib_symbols(d);
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
	const samefolder = !!oldpath && resolve(oldpath, '..').toLowerCase() === resolve(newpath, '..').toLowerCase();
	if (!(await initpathenv(samefolder)))
		return false;
	if (samefolder)
		return true;
	documents.all().forEach(td => {
		const doc = lexers[td.uri.toLowerCase()];
		if (!doc) return;
		doc.initLibDirs(doc.scriptdir);
		if (shouldIncludeLocalLib())
			parseproject(doc.uri);
	});
	return true;
}

async function setInterpreter(path: string) {
	const old = interpreterPath;
	if (!path || path.toLowerCase() === old.toLowerCase())
		return false;
	setInterpreterPath(path);
	if (!(await changeInterpreter(old, path)))
		setInterpreterPath(old);
	return true;
}

async function parseproject(uri: string) {
	let lex = lexers[uri];
	if (!lex || !uri.startsWith('file:'))
		return;
	!lex.d && (libfuncs[uri] ??= get_lib_symbols(lex));
	let searchdir = lex.workspaceFolder, workspace = false, path: string, t: TextDocument | undefined;
	if (searchdir)
		searchdir = URI.parse(searchdir).fsPath, workspace = true;
	else
		searchdir = lex.scriptdir + '\\lib';
	for await (path of enum_ahkfiles(searchdir)) {
		if (!libfuncs[uri = URI.file(path).toString().toLowerCase()]) {
			if (!(lex = lexers[uri])) {
				if (!(t = openFile(path)) || (lex = new Lexer(t)).d || (lex.parseScript(), lex.maybev1))
					continue;
				if (workspace) {
					parse_include(lexers[uri] = lex, lex.scriptdir);
					traverse_include(lex);
				}
			}
			libfuncs[uri] = get_lib_symbols(lex);
			await sleep(50);
		}
	}
}

async function getAHKversion(params: string[]) {
	return Promise.all(params.map(async path => {
		let pe: PEFile | undefined;
		try {
			pe = new PEFile(path);
			const props = (await pe.getResource(RESOURCE_TYPE.VERSION))[0].StringTable[0];
			if (props.ProductName?.toLowerCase().startsWith('autohotkey')) {
				const is_bit64 = await pe.is_bit64;
				const m = (await pe.getResource(RESOURCE_TYPE.MANIFEST))[0]?.replace(/<!--[\s\S]*?-->/g, '') ?? '';
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

async function getDllExport(paths: string[] | Set<string>, onlyone = false) {
	const funcs: Record<string, true> = {};
	for (const path of paths) {
		const pe = await searchAndOpenPEFile(path, a_vars.ptrsize === '8' ? true : a_vars.ptrsize === '4' ? false : undefined);
		if (!pe) continue;
		try {
			(await pe.getExport())?.Functions.forEach((it) => funcs[it.Name] = true);
			if (onlyone) break;
		} finally { pe.close(); }
	}
	delete funcs[''];
	return Object.keys(funcs);
}

let curPERCDATA: Record<string, Buffer> | undefined = undefined;
function getRCDATA(name?: string) {
	const exe = resolvePath(interpreterPath, true);
	if (!exe) return;
	if (!name) return { uri: '', path: '', paths: Object.keys(curPERCDATA ?? {}) };
	const path = `${exe.toLowerCase()}:${name}`;
	const uri = URI.from({ scheme: 'ahkres', path }).toString().toLowerCase();
	if (lexers[uri])
		return { uri, path };
	if (!name || !curPERCDATA)
		return;
	const data = curPERCDATA[name];
	if (!data)
		return;
	try {
		const doc = lexers[uri] = new Lexer(TextDocument.create(uri, 'ahk2', -10, new TextDecoder('utf8', { fatal: true }).decode(data)));
		doc.parseScript();
		return { uri, path };
	} catch { delete curPERCDATA[name]; }
}