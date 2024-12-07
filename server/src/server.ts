import { resolve } from 'path';
import { createServer } from 'net';
import { spawn } from 'child_process';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	createConnection, DidChangeConfigurationNotification, InitializeResult,
	ProposedFeatures, SymbolKind, TextDocuments, TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { get_ahkProvider } from './ahkProvider';
import {
	a_vars, AHKLSSettings, ahkpath_cur, ahkpath_resolved, builtin_variable, builtin_variable_h, chinese_punctuations, clearLibfuns, codeActionProvider,
	colorPresentation, colorProvider, completionProvider, defintionProvider, documentFormatting,
	enum_ahkfiles, executeCommandProvider, exportSymbols, extsettings, getServerCommands, getVersionInfo, hoverProvider,
	initahk2cache, isahk2_h, Lexer, lexers, libdirs, libfuncs, loadahk2, loadlocalize, openFile,
	parse_include, prepareRename, rangeFormatting, read_ahk_file, referenceProvider, renameProvider, resolvePath, SemanticTokenModifiers,
	semanticTokensOnFull, semanticTokensOnRange, SemanticTokenTypes, set_ahk_h, set_ahkpath, setConnection,
	setRootDir, setLocale, setVersion, setWorkspaceFolders, setting, signatureProvider, sleep, symbolProvider,
	traverse_include, typeFormatting, updateConfigs, utils, winapis, workspaceSymbolProvider,
	ahk_version, ahkvars
} from './common';
import { PEFile, RESOURCE_TYPE, searchAndOpenPEFile } from './PEFile';

const languageServer = 'ahk2-language-server';
const documents = new TextDocuments(TextDocument);
const connection = setConnection(createConnection(ProposedFeatures.all));
const workspaceFolders = new Set<string>();
let hasConfigurationCapability = false, hasWorkspaceFolderCapability = false;
let isInitialized = false;
let uri_switch_to_ahk2 = '';

utils.get_RCDATA = getRCDATA;
utils.get_DllExport = getDllExport;
utils.get_ahkProvider = get_ahkProvider;

connection.onInitialize(async params => {
	const capabilities = params.capabilities;
	const configs: AHKLSSettings | undefined = params.initializationOptions;
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
			executeCommandProvider: { commands: getServerCommands(configs?.commands) },
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

	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

	if (hasWorkspaceFolderCapability) {
		params.workspaceFolders?.forEach(it => workspaceFolders.add(it.uri.toLowerCase() + '/'));
		result.capabilities.workspace = { workspaceFolders: { supported: true } };
	}

	setRootDir(resolve(__dirname, '../..'));
	setLocale(configs?.locale ?? params.locale);
	loadlocalize();
	initahk2cache();
	const prev = ahkvars;
	if (configs)
		updateConfigs(configs);
	setWorkspaceFolders(workspaceFolders);
	await setInterpreter(resolvePath(extsettings.InterpreterPath ??= ''));
	prev === ahkvars && loadahk2();
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability)
		connection.client.register(DidChangeConfigurationNotification.type);
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(event => {
			event.removed.forEach(it => workspaceFolders.delete(it.uri.toLowerCase() + '/'));
			event.added.forEach(it => workspaceFolders.add(it.uri.toLowerCase() + '/'));
			setWorkspaceFolders(workspaceFolders);
		});
	}
	isInitialized = true;
	updateStatusBar();
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
	const { AutoLibInclude, InterpreterPath, Syntaxes } = extsettings, prev = ahkvars;
	updateConfigs(newset);
	setWorkspaceFolders(workspaceFolders);
	if (InterpreterPath !== extsettings.InterpreterPath)
		await setInterpreter(resolvePath(extsettings.InterpreterPath ??= ''));
	if (AutoLibInclude !== extsettings.AutoLibInclude) {
		if ((extsettings.AutoLibInclude > 1) && (AutoLibInclude <= 1))
			parseuserlibs();
		if ((extsettings.AutoLibInclude & 1) && !(AutoLibInclude & 1))
			documents.all().forEach(e => parseproject(e.uri.toLowerCase()));
	}
	if (prev === ahkvars && Syntaxes !== extsettings.Syntaxes) {
		initahk2cache(), loadahk2();
		if (isahk2_h)
			loadahk2('ahk_h'), loadahk2('winapi', 4);
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
	let doc = lexers[uri];
	if (doc) doc.document = e.document;
	else lexers[uri] = doc = new Lexer(e.document);
	Object.defineProperty(doc.include, '', { value: '', enumerable: false });
	doc.actived = true;
	if (to_ahk2)
		doc.actionwhenv1 = 'Continue';
	if (extsettings.AutoLibInclude & 1)
		parseproject(uri).then(() => doc.last_diags &&
			Object.keys(doc.included).length && doc.update());
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
connection.onRequest('exportSymbols', (uri: string) => exportSymbols(uri));
connection.onRequest('getAHKversion', getAHKversion);
connection.onRequest('getContent', (uri: string) => lexers[uri.toLowerCase()]?.document.getText());
connection.onRequest('getVersionInfo', getVersionInfo);
connection.onNotification('resetInterpreterPath', path => setInterpreter(extsettings.InterpreterPath = path));
connection.onNotification('onDidCloseTextDocument', (params: { uri: string, id: string }) => {
	if (params.id === 'ahk2')
		lexers[params.uri.toLowerCase()]?.close(true);
	else uri_switch_to_ahk2 = params.uri;
});
documents.listen(connection);
connection.listen();

async function showPathError(msg: string) {
	clear_rcdata();
	if (!extsettings.commands?.includes('executeCommand'))
		return connection.window.showErrorMessage(msg);
	if (await connection.window.showErrorMessage(msg, { title: 'Select Interpreter' }))
		connection.sendRequest('executeCommand', ['ahk2.set.interpreter']);
}

async function initpathenv(samefolder: boolean): Promise<boolean> {
	if (!ahkpath_resolved)
		return showPathError(setting.ahkpatherr()), false;
	let vars;
	const ver = ahk_version;
	for (let i = 0; i < 3 && !vars; i++)
		vars = await getScriptVars();
	if (!vars)
		return showPathError(setting.getenverr()), false;
	Object.assign(a_vars, vars).ahkpath ??= ahkpath_cur;
	setVersion(a_vars.ahkversion ??= '2.0.0');
	if (a_vars.ahkversion.startsWith('1.'))
		showPathError(setting.versionerr());
	if (!samefolder || !libdirs.length) {
		libdirs.length = 0;
		libdirs.push(a_vars.mydocuments + '\\AutoHotkey\\Lib\\',
			a_vars.ahkpath.replace(/[^\\/]+$/, 'Lib\\'));
		let lb;
		for (lb of Object.values(libfuncs))
			lb.islib = inlibdirs(lb.fsPath);
	}
	if (ahk_version !== ver) {
		const h = !!a_vars.threadid;
		initahk2cache();
		set_ahk_h(h);
		loadahk2();
		if (h) loadahk2('ahk2_h'), loadahk2('winapi', 4);
		samefolder = false;
	} else if (a_vars.threadid) {
		if (!isahk2_h)
			set_ahk_h(true), samefolder = false, loadahk2('ahk2_h'), loadahk2('winapi', 4);
	} else {
		if (isahk2_h)
			set_ahk_h(false), samefolder = false, initahk2cache(), loadahk2();
	}
	Object.assign(a_vars, { index: '0', clipboard: '', threadid: '' });
	await update_rcdata();
	if (samefolder)
		return true;
	for (const uri in lexers) {
		const lex = lexers[uri];
		if (!lex.d) {
			lex.initLibDirs();
			if (Object.keys(lex.include).length || lex.diagnostics.length)
				lex.update();
		}
	}
	clearLibfuns();
	if (extsettings.AutoLibInclude > 1)
		parseuserlibs();
	return true;
	async function update_rcdata() {
		let pe;
		try {
			clear_rcdata();
			pe = new PEFile(resolvePath(ahkpath_cur, true));
			curPERCDATA = await pe.getResource(RESOURCE_TYPE.RCDATA);
		} catch { }
		finally { pe?.close(); }
	}
}

function clear_rcdata() {
	loaded_rcdata.forEach(lex => lex.close(true));
	loaded_rcdata.length = 0;
	curPERCDATA = undefined;
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
		if (extsettings.AutoLibInclude & 1)
			parseproject(doc.uri);
	});
	return true;
}

async function setInterpreter(path: string) {
	const prev_path = ahkpath_cur;
	if (path) {
		if (path.toLowerCase() === prev_path.toLowerCase())
			return;
		set_ahkpath(path);
		updateStatusBar();
		await changeInterpreter(prev_path, path);
	}
	if (!ahkpath_cur)
		showPathError(setting.ahkpatherr());
}

async function updateStatusBar() {
	const cmd = 'updateStatusBar';
	if (!isInitialized || !extsettings.commands?.includes(cmd)) return;
	connection.sendRequest(cmd, ahkpath_resolved ?
		[ahkpath_cur].concat(await getAHKversion([ahkpath_resolved])) : ['']);
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
		return '';
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
const loaded_rcdata: Lexer[] = [];
function getRCDATA(name?: string) {
	if (!curPERCDATA)
		return;
	if (!name) return { uri: '', path: '', paths: Object.keys(curPERCDATA ?? {}) };
	const path = `${ahkpath_cur}:${name}`;
	const uri = URI.from({ scheme: 'ahkres', path }).toString().toLowerCase();
	if (lexers[uri])
		return { uri, path };
	const data = curPERCDATA[name];
	if (!data)
		return;
	try {
		const lex = lexers[uri] = new Lexer(TextDocument.create(uri, 'ahk2', -10, new TextDecoder('utf8', { fatal: true }).decode(data)));
		lex.parseScript();
		loaded_rcdata.push(lex);
		return { uri, path };
	} catch { delete curPERCDATA[name]; }
}

function getScriptVars(): Promise<Record<string, string> | undefined> {
	const path = `\\\\.\\pipe\\ahk-script-${Buffer.from(Uint16Array.from(
		[process.pid, Date.now()]).buffer).toString('hex')}`;
	let has_written = false, output: string | undefined;
	const server = createServer().listen(path);
	const script = `
#NoTrayIcon
s := ""
for _, k in ${JSON.stringify([...builtin_variable, ...builtin_variable_h])}
	try if SubStr(k, 1, 2) = "a_" && !IsObject(v := %k%)
		s .= SubStr(k, 3) "|" v "\`n"
FileOpen(A_ScriptFullPath, "w", "utf-8").Write(s)`;
	return new Promise<void>(r => {
		server.on('connection', socket => {
			const destroy = () => socket.destroy();
			socket.on('error', destroy);
			if (has_written) {
				output = '';
				socket.setEncoding('utf8')
					.on('data', data => output! += data)
					.on('end', () => (r(), destroy()));
				return;
			}
			has_written = socket.write(script);
			socket.destroySoon();
		});
		const cp = spawn(`"${ahkpath_cur}" /CP65001 /ErrorStdOut ${path}`, [], { cwd: resolve(ahkpath_cur, '..'), shell: true });
		cp.on('exit', code => code !== 0 ? r() : output === undefined && setTimeout(r, 1000));
		cp.on('error', r);
		setTimeout(() => cp.kill(), 2000);
	}).then(() => {
		const data = output?.trim();
		if (data)
			return Object.fromEntries(data.split('\n').map(l => l.split('|')));
	}).finally(() => server.close());
}