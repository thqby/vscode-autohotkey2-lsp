import { resolve } from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	createConnection,
	DidChangeConfigurationNotification,
	InitializeResult,
	ProposedFeatures,
	SymbolKind,
	TextDocuments,
	TextDocumentSyncKind,
} from 'vscode-languageserver/node.js';
import { URI } from 'vscode-uri';
import { get_ahkProvider } from './ahkProvider.js';
import {
	a_vars,
	interpreterPathV2,
	chinese_punctuations,
	clearLibfuns,
	codeActionProvider,
	colorPresentation,
	colorProvider,
	commands,
	completionProvider,
	defintionProvider,
	documentFormatting,
	enum_ahkfiles,
	executeCommandProvider,
	exportSymbols,
	ahkppConfig,
	hoverProvider,
	initahk2cache,
	isahk2_h,
	Lexer,
	lexers,
	libdirs,
	libfuncs,
	loadahk2,
	loadlocalize,
	openFile,
	parse_include,
	prepareRename,
	rangeFormatting,
	referenceProvider,
	renameProvider,
	SemanticTokenModifiers,
	semanticTokensOnFull,
	semanticTokensOnRange,
	SemanticTokenTypes,
	set_ahk_h,
	setInterpreterPathV2,
	set_Connection,
	set_dirname,
	set_locale,
	set_version,
	set_WorkspaceFolders,
	setting,
	signatureProvider,
	sleep,
	symbolProvider,
	traverse_include,
	typeFormatting,
	updateAhkppConfig,
	utils,
	winapis,
	workspaceSymbolProvider,
	read_ahk_file,
	getVersionInfo,
	builtin_variable,
	builtin_variable_h,
} from './common.js';
import { PEFile, RESOURCE_TYPE, searchAndOpenPEFile } from './PEFile.js';
import { resolvePath, runscript } from './scriptrunner.js';
import { TextDecoder } from 'util';
import { includeLocalLibrary, includeUserAndStandardLibrary } from './utils.js';
import { AhkppConfig, CfgKey, getCfg, LibrarySuggestions } from './config.js';

const languageServer = 'ahk2-language-server';
const documents = new TextDocuments(TextDocument);
const connection = set_Connection(createConnection(ProposedFeatures.all));
const workspaceFolders = new Set<string>();
let hasConfigurationCapability = false,
	hasWorkspaceFolderCapability = false;
let uri_switch_to_ahk2 = '';

commands['ahk++.v2.setIntepreterPath'] = (args: string[]) =>
	setInterpreter(args[0].replace(/^[A-Z]:/, (m) => m.toLowerCase()));

connection.onInitialize(async (params) => {
	// Shows up in extension development host
	// Output > AHK++
	connection.console.log(`Initializing language server`);
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
				openClose: true,
			},
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: ['.', '#', '*', '@'],
			},
			signatureHelpProvider: {
				triggerCharacters: ['(', ',', ' '],
			},
			documentSymbolProvider: true,
			definitionProvider: true,
			documentFormattingProvider: true,
			documentRangeFormattingProvider: true,
			documentOnTypeFormattingProvider: {
				firstTriggerCharacter: '}',
				moreTriggerCharacter: [
					'\n',
					...Object.keys(chinese_punctuations),
				],
			},
			executeCommandProvider: { commands: Object.keys(commands) },
			hoverProvider: true,
			foldingRangeProvider: true,
			colorProvider: true,
			codeActionProvider: true,
			renameProvider: { prepareProvider: true },
			referencesProvider: { workDoneProgress: true },
			semanticTokensProvider: {
				legend: {
					tokenTypes: Object.values(SemanticTokenTypes).filter(
						(t) => typeof t === 'string',
					) as string[],
					tokenModifiers: Object.values(
						SemanticTokenModifiers,
					).filter((t) => typeof t === 'string') as string[],
				},
				full: true,
				range: true,
			},
			workspaceSymbolProvider: true,
		},
	};
	if (hasWorkspaceFolderCapability) {
		params.workspaceFolders?.forEach((it) =>
			workspaceFolders.add(it.uri.toLowerCase() + '/'),
		);
		result.capabilities.workspace = {
			workspaceFolders: { supported: true },
		};
	}

	let envAhkppConfig: AhkppConfig | undefined;
	const env = process.env;
	if (env.AHK2_LS_CONFIG)
		try {
			envAhkppConfig = JSON.parse(env.AHK2_LS_CONFIG);
		} catch {
			/* do nothing */
		}
	if (params.initializationOptions)
		envAhkppConfig = Object.assign(envAhkppConfig ?? {}, params.initializationOptions);
	set_dirname(resolve(__dirname, '../..'));
	set_locale(envAhkppConfig?.locale ?? params.locale);
	utils.get_RCDATA = getRCDATA;
	utils.get_DllExport = getDllExport;
	utils.get_ahkProvider = get_ahkProvider;
	loadlocalize();
	initahk2cache();
	if (envAhkppConfig) updateAhkppConfig(envAhkppConfig);
	if (
		!(await setInterpreter(
			resolvePath((ahkppConfig.v2.file.interpreterPath ??= '')),
		))
	)
		patherr(setting.ahkpatherr());
	set_WorkspaceFolders(workspaceFolders);
	loadahk2();
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders((event) => {
			event.removed.forEach((it) =>
				workspaceFolders.delete(it.uri.toLowerCase() + '/'),
			);
			event.added.forEach((it) =>
				workspaceFolders.add(it.uri.toLowerCase() + '/'),
			);
			set_WorkspaceFolders(workspaceFolders);
		});
	}
	getDllExport(
		['user32', 'kernel32', 'comctl32', 'gdi32'].map(
			(name) => `C:\\Windows\\System32\\${name}.dll`,
		),
	).then((val) => winapis.push(...val));
});

connection.onDidChangeConfiguration(async (change) => {
	let newAhkppConfig: AhkppConfig | undefined = change?.settings;
	if (hasConfigurationCapability && !newAhkppConfig)
		newAhkppConfig = await connection.workspace.getConfiguration('AHK++');
	if (!newAhkppConfig) {
		connection.window.showWarningMessage('Failed to obtain the AHK++ configuration');
		return;
	}
	const oldCfg = ahkppConfig;
	updateAhkppConfig(newAhkppConfig);
	const newCfg = ahkppConfig;
	set_WorkspaceFolders(workspaceFolders);

	const newInterpreterPath: string = getCfg(newCfg, CfgKey.InterpreterPath);
	if (getCfg(oldCfg, CfgKey.InterpreterPath) !== newInterpreterPath) {
		if (await setInterpreter(resolvePath(newInterpreterPath)))
			connection.sendRequest('ahk2.updateStatusBar', [newInterpreterPath]);
	}

	const oldLibSuggestions: LibrarySuggestions = getCfg(oldCfg, CfgKey.LibrarySuggestions);
	const newLibSuggestions: LibrarySuggestions = getCfg(newCfg, CfgKey.LibrarySuggestions);
	if (oldLibSuggestions !== newLibSuggestions) {
		if (includeUserAndStandardLibrary(newLibSuggestions) && !includeUserAndStandardLibrary(oldLibSuggestions))
			parseuserlibs();
		if (includeLocalLibrary(newLibSuggestions) && !includeLocalLibrary(oldLibSuggestions))
			documents.all().forEach((e) => parseproject(e.uri.toLowerCase()));
	}
	if (getCfg(oldCfg, CfgKey.Syntaxes) !== getCfg(newCfg, CfgKey.Syntaxes)) {
		initahk2cache();
		loadahk2();
		if (isahk2_h) {
			loadahk2('ahk_h');
			loadahk2('winapi', 4);
		}
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
	else {
		lexers[uri] = doc = new Lexer(e.document);
	}
	Object.defineProperty((doc.include = {}), '', {
		value: '',
		enumerable: false,
	});
	doc.actived = true;
	if (to_ahk2) doc.actionWhenV1Detected = 'Continue';
	if (includeLocalLibrary(ahkppConfig.v2.general.librarySuggestions))
		parseproject(uri).then(
			() =>
				doc.last_diags &&
				Object.keys(doc.included).length &&
				doc.update(),
		);
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
connection.onRequest('ahk2.exportSymbols', (uri: string) => exportSymbols(uri));
connection.onRequest('ahk2.getAHKversion', getAHKversion);
connection.onRequest('ahk2.getContent', (uri: string) => lexers[uri.toLowerCase()]?.document.getText());
connection.onRequest('ahk2.getVersionInfo', getVersionInfo);
connection.onNotification('onDidCloseTextDocument', (params: { uri: string, id: string }) => {
	if (params.id === 'ahk2')
		lexers[params.uri.toLowerCase()]?.close(true);
	else uri_switch_to_ahk2 = params.uri;
});
documents.listen(connection);
connection.listen();

async function patherr(msg: string) {
	if (!ahkppConfig.commands?.includes('ahk2.executeCommand'))
		return connection.window.showErrorMessage(msg);
	if (await connection.window.showErrorMessage(msg, { title: 'Select Interpreter' }))
		connection.sendRequest('ahk2.executeCommand', ['ahk++.setV2Interpreter']);
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
	let fail = 0,
		data = runscript(script);
	if (data === undefined) {
		if (retry) return initpathenv(samefolder, false);
		patherr(setting.ahkpatherr());
		return false;
	}
	if (!(data = data.trim())) {
		const path = interpreterPathV2;
		if ((await getAHKversion([path]))[0].endsWith('[UIAccess]')) {
			let ret = false,
				n = path.replace(/_uia\.exe$/i, '.exe');
			fail = 2;
			if (
				path !== n &&
				(n = resolvePath(n, true)) &&
				!(await getAHKversion([n]))[0].endsWith('[UIAccess]')
			) {
				setInterpreterPathV2(n);
				if ((ret = await initpathenv(samefolder))) fail = 0;
				setInterpreterPathV2(path);
			}
			if (fail) connection.window.showWarningMessage(setting.uialimit());
			await update_rcdata();
			if (ret) return true;
		} else fail = 1;
		if (fail !== 2 && retry) return initpathenv(samefolder, false);
		if (!a_vars.mydocuments)
			connection.window.showErrorMessage(setting.getenverr());
		return false;
	}
	Object.assign(a_vars, Object.fromEntries(data.replace(/|[A-Z]:\\/g, m => m.toLowerCase()).split('\n').map(l => l.split('|'))));
	a_vars.ahkpath ??= interpreterPathV2;
	set_version(a_vars.ahkversion ??= '2.0.0');
	if (a_vars.ahkversion.startsWith('1.'))
		patherr(setting.versionerr());
	if (!samefolder || !libdirs.length) {
		libdirs.length = 0;
		libdirs.push(
			a_vars.mydocuments + '\\AutoHotkey\\Lib\\',
			a_vars.ahkpath.replace(/[^\\/]+$/, 'Lib\\'),
		);
		let lb;
		for (lb of Object.values(libfuncs)) lb.islib = inlibdirs(lb.fsPath);
	}
	if (a_vars.threadid) {
		if (!isahk2_h)
			set_ahk_h(true), samefolder = false, loadahk2('ahk2_h'), loadahk2('winapi', 4);
	} else {
		if (isahk2_h) {
			set_ahk_h(false);
			samefolder = false;
			initahk2cache();
			loadahk2();
		}
	}
	Object.assign(a_vars, { index: '0', clipboard: '', threadid: '' });
	await update_rcdata();
	if (samefolder) return true;
	for (const uri in lexers) {
		const doc = lexers[uri];
		if (!doc.d) {
			doc.initLibDirs();
			if (Object.keys(doc.include).length || doc.diagnostics.length)
				doc.update();
		}
	}
	clearLibfuns();
	if (includeUserAndStandardLibrary(ahkppConfig.v2.general.librarySuggestions)) parseuserlibs();
	return true;
	async function update_rcdata() {
		const pe = new PEFile(interpreterPathV2);
		try {
			const rc = await pe.getResource(RESOURCE_TYPE.RCDATA);
			curPERCDATA = rc;
		} catch (e) {
			console.error(e);
		} finally {
			pe.close();
		}
	}
}

function get_lib_symbols(lex: Lexer) {
	return Object.assign(
		Object.values(lex.declaration).filter(
			(it) =>
				it.kind === SymbolKind.Class || it.kind === SymbolKind.Function,
		),
		{ fsPath: lex.fsPath, islib: inlibdirs(lex.fsPath) },
	);
}

async function parseuserlibs() {
	let dir: string,
		path: string,
		uri: string,
		d: Lexer,
		t: TextDocument | undefined;
	for (dir of libdirs)
		for await (path of enum_ahkfiles(dir)) {
			if (!libfuncs[(uri = URI.file(path).toString().toLowerCase())]) {
				if (!(d = lexers[uri]))
					if (
						!(t = openFile(path)) ||
						(d = new Lexer(t)).d ||
						(d.parseScript(), d.maybev1)
					)
						continue;
				libfuncs[uri] = get_lib_symbols(d);
				await sleep(50);
			}
		}
}

function inlibdirs(path: string) {
	path = path.toLowerCase();
	for (const p of libdirs) {
		if (path.startsWith(p.toLowerCase())) return true;
	}
	return false;
}

async function changeInterpreter(oldpath: string, newpath: string) {
	const samefolder =
		!!oldpath &&
		resolve(oldpath, '..').toLowerCase() ===
			resolve(newpath, '..').toLowerCase();
	if (!(await initpathenv(samefolder))) return false;
	if (samefolder) return true;
	documents.all().forEach((td) => {
		const doc = lexers[td.uri.toLowerCase()];
		if (!doc) return;
		doc.initLibDirs(doc.scriptdir);
		if (includeLocalLibrary(ahkppConfig.v2.general.librarySuggestions)) parseproject(doc.uri);
	});
	return true;
}

async function setInterpreter(path: string) {
	const old = interpreterPathV2;
	if (!path || path.toLowerCase() === old.toLowerCase()) return false;
	setInterpreterPathV2(path);
	if (!(await changeInterpreter(old, path))) setInterpreterPathV2(old);
	return true;
}

async function parseproject(uri: string) {
	let lex = lexers[uri];
	if (!lex || !uri.startsWith('file:')) return;
	if (!lex.d) {
		libfuncs[uri] ??= get_lib_symbols(lex);
	}
	let searchdir = lex.workspaceFolder,
		workspace = false,
		path: string,
		t: TextDocument | undefined;
	if (searchdir) {
		searchdir = URI.parse(searchdir).fsPath;
		workspace = true;
	} else searchdir = lex.scriptdir + '\\lib';
	for await (path of enum_ahkfiles(searchdir)) {
		if (!libfuncs[(uri = URI.file(path).toString().toLowerCase())]) {
			if (!(lex = lexers[uri])) {
				if (
					!(t = openFile(path)) ||
					(lex = new Lexer(t)).d ||
					(lex.parseScript(), lex.maybev1)
				)
					continue;
				if (workspace) {
					parse_include((lexers[uri] = lex), lex.scriptdir);
					traverse_include(lex);
				}
			}
			libfuncs[uri] = get_lib_symbols(lex);
			await sleep(50);
		}
	}
}

async function getAHKversion(params: string[]) {
	return Promise.all(
		params.map(async (path) => {
			let pe: PEFile | undefined;
			try {
				pe = new PEFile(path);
				const props = (await pe.getResource(RESOURCE_TYPE.VERSION))[0]
					.StringTable[0];
				if (props.ProductName?.toLowerCase().startsWith('autohotkey')) {
					const is_bit64 = await pe.is_bit64;
					const m =
						(
							await pe.getResource(RESOURCE_TYPE.MANIFEST)
						)[0]?.replace(/<!--[\s\S]*?-->/g, '') ?? '';
					let version = `${props.ProductName} ${
						props.ProductVersion ?? 'unknown version'
					} ${is_bit64 ? '64' : '32'} bit`;
					if (m.includes('uiAccess="true"')) version += ' [UIAccess]';
					return version;
				}
			} catch (e) {
				console.error(e);
			} finally {
				pe?.close();
			}
			return 'unknown version';
		}),
	);
}

async function getDllExport(paths: string[] | Set<string>, onlyone = false) {
	const funcs: Record<string, true> = {};
	for (const path of paths) {
		const pe = await searchAndOpenPEFile(path, a_vars.ptrsize === '8' ? true : a_vars.ptrsize === '4' ? false : undefined);
		if (!pe) continue;
		try {
			(await pe.getExport())?.Functions.forEach(
				(it) => (funcs[it.Name] = true),
			);
			if (onlyone) break;
		} finally {
			pe.close();
		}
	}
	delete funcs[''];
	return Object.keys(funcs);
}

let curPERCDATA: Record<string, Buffer> | undefined = undefined;
function getRCDATA(name?: string) {
	const exe = resolvePath(interpreterPathV2, true);
	if (!exe) return;
	if (!name)
		return { uri: '', path: '', paths: Object.keys(curPERCDATA ?? {}) };
	const path = `${exe.toLowerCase()}:${name}`;
	const uri = URI.from({ scheme: 'ahkres', path }).toString().toLowerCase();
	if (lexers[uri]) return { uri, path };
	if (!name || !curPERCDATA) return;
	const data = curPERCDATA[name];
	if (!data) return;
	try {
		const doc = (lexers[uri] = new Lexer(
			TextDocument.create(
				uri,
				'ahk2',
				-10,
				new TextDecoder('utf8', { fatal: true }).decode(data),
			),
		));
		doc.parseScript();
		return { uri, path };
	} catch {
		delete curPERCDATA[name];
	}
}
