import {
	DidChangeConfigurationNotification, FileChangeType, InitializeResult, MessageActionItem,
	ProposedFeatures, ShowMessageRequest, TextDocuments, TextDocumentSyncKind
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	a_Vars, ahkPath, ahkPath_resolved, ahkVars, chinesePunctuations, codeActionProvider, colorPresentation,
	colorProvider, completionProvider, configCache, defintionProvider, documentFormatting, enumNames,
	fullySemanticToken, getRequestHandlers, hoverProvider, initCaches, initLocalize, isahk2_h, Lexer, lexers,
	loadSyntax, LSConfig, MessageType, parseProject, parseUserLib, prepareRename, rangeFormatting,
	readTextFile, referenceProvider, renameProvider, resolvePath, SemanticTokenModifiers, semanticTokensOnFull,
	semanticTokensOnRange, SemanticTokenTypes, setIsAhkH, setLocale, setRootDir, setWorkspaceFolders,
	signatureProvider, symbolProvider, typeFormatting, updateConfig, utils, winapis, workspaceSymbolProvider
} from './common';

export let connection: ProposedFeatures.Connection;
export const documents = new TextDocuments(TextDocument);
const workspaceFolders = new Set<string>();
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let isInitialized = false;
let uri_switch_to_ahk2 = '';

export function setConnection(conn: ProposedFeatures.Connection, extensionUri = '.') {
	connection = conn;
	connection.onInitialize(async params => {
		const capabilities = params.capabilities;
		const configs: LSConfig = params.initializationOptions ?? {};
		const result: InitializeResult = {
			serverInfo: { name: 'ahk2-language-server', },
			capabilities: {
				codeActionProvider: true,
				colorProvider: true,
				completionProvider: { resolveProvider: false, triggerCharacters: ['.', '#', '*', '@'] },
				definitionProvider: true,
				documentFormattingProvider: true,
				documentOnTypeFormattingProvider: { firstTriggerCharacter: '}', moreTriggerCharacter: ['\n', ...Object.keys(chinesePunctuations)] },
				documentRangeFormattingProvider: true,
				documentSymbolProvider: true,
				foldingRangeProvider: true,
				hoverProvider: true,
				referencesProvider: true,
				renameProvider: { prepareProvider: true },
				semanticTokensProvider: {
					legend: { tokenTypes: enumNames(SemanticTokenTypes), tokenModifiers: enumNames(SemanticTokenModifiers), },
					full: true, range: true
				},
				signatureHelpProvider: { triggerCharacters: ['(', ',', ' '] },
				textDocumentSync: { change: TextDocumentSyncKind.Incremental, openClose: true },
				workspaceSymbolProvider: true,
			}
		};
		for (const [k, v] of Object.entries(getRequestHandlers(configs.commands)))
			connection.onRequest(k, v);
		hasConfigurationCapability = !!capabilities.workspace?.configuration;
		hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;
		if (hasWorkspaceFolderCapability) {
			params.workspaceFolders?.forEach(it => workspaceFolders.add(it.uri.toLowerCase() + '/'));
			result.capabilities.workspace = { workspaceFolders: { supported: true } };
		}

		if (process.env.BROWSER)
			setIsAhkH(true);
		else configs.fullySemanticToken && fullySemanticToken();
		setRootDir(configs.extensionUri ?? extensionUri);
		setLocale(configs.locale ?? params.locale);
		await initLocalize();
		initCaches();
		const prev = ahkVars;
		updateConfig(configs);
		setWorkspaceFolders(workspaceFolders);
		if (process.env.BROWSER) {
			loadSyntax();
			loadSyntax('ahk2_h');
			loadSyntax('winapi', 4);
		} else {
			await utils.setInterpreter?.(resolvePath(configCache.InterpreterPath ??= ''));
			prev === ahkVars && loadSyntax();
		}
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
		if (process.env.BROWSER) return;
		utils.updateStatusBar?.(a_Vars.ahkpath ? ahkPath_resolved : '');
		utils.getDllExport?.(['user32', 'kernel32', 'comctl32', 'gdi32'].map(name => `C:\\Windows\\System32\\${name}.dll`))
			.then(val => winapis.push(...val));
	});
	connection.onDidChangeConfiguration(async change => {
		let newset: LSConfig | undefined = change?.settings;
		if (hasConfigurationCapability && !newset)
			newset = await connection.workspace.getConfiguration('AutoHotkey2');
		if (!newset) {
			connection.window.showWarningMessage('Failed to obtain the configuration');
			return;
		}
		const { AutoLibInclude, InterpreterPath, Syntaxes } = configCache, prev = ahkVars;
		updateConfig(newset);
		setWorkspaceFolders(workspaceFolders);
		if (process.env.BROWSER) return;
		if (InterpreterPath !== configCache.InterpreterPath)
			await utils.setInterpreter?.(resolvePath(configCache.InterpreterPath ??= ''));
		if (AutoLibInclude !== configCache.AutoLibInclude) {
			if ((configCache.AutoLibInclude > 1) && (AutoLibInclude <= 1))
				parseUserLib();
			if ((configCache.AutoLibInclude & 1) && !(AutoLibInclude & 1))
				documents.keys().forEach(uri => parseProject(uri.toLowerCase()));
		}
		if (prev === ahkVars && Syntaxes !== configCache.Syntaxes) {
			initCaches(), loadSyntax();
			if (isahk2_h)
				loadSyntax('ahk_h'), loadSyntax('winapi', 4);
		}
	});
	!process.env.BROWSER && connection.onDidChangeWatchedFiles((change) => {
		let lex;
		for (const c of change.changes)
			switch (c.type) {
				case FileChangeType.Changed:
					if ((lex = lexers[c.uri.toLowerCase()])?.actived === false)
						TextDocument.update(lex.document, [{ text: readTextFile(lex.fsPath) ?? '' }], 0), lex.update();
					break;
				case FileChangeType.Deleted:
					lexers[c.uri.toLowerCase()]?.close(true);
					break;
			}
	});

	documents.listen(connection);
	documents.onDidChangeContent(e => lexers[e.document.uri.toLowerCase()]?.update());
	documents.onDidClose(e => lexers[e.document.uri.toLowerCase()]?.close());
	documents.onDidOpen(e => {
		const uri = e.document.uri.toLowerCase();
		let lex = lexers[uri];
		if (lex) lex.document = e.document;
		else lexers[uri] = lex = new Lexer(e.document);
		lex.actived = true;
		if (uri_switch_to_ahk2 === e.document.uri)
			lex.actionwhenv1 = 'Continue';
		if (process.env.BROWSER) return;
		Object.defineProperty(lex.include, '', { value: '', enumerable: false });
		if (configCache.AutoLibInclude & 1)
			parseProject(uri).then(() => lex.last_diags &&
				Object.keys(lex.included).length && lex.update());
	});

	connection.languages.semanticTokens.on(semanticTokensOnFull);
	connection.languages.semanticTokens.onRange(semanticTokensOnRange);
	connection.onCodeAction(codeActionProvider);
	connection.onCompletion(completionProvider);
	connection.onColorPresentation(colorPresentation);
	connection.onDocumentColor(colorProvider);
	connection.onDefinition(defintionProvider);
	connection.onDocumentFormatting(documentFormatting);
	connection.onDocumentRangeFormatting(rangeFormatting);
	connection.onDocumentOnTypeFormatting(typeFormatting);
	connection.onDocumentSymbol(symbolProvider);
	connection.onFoldingRanges(params => lexers[params.textDocument.uri.toLowerCase()]?.folding_ranges);
	connection.onHover(hoverProvider);
	connection.onPrepareRename(prepareRename);
	connection.onReferences(referenceProvider);
	connection.onRenameRequest(renameProvider);
	connection.onSignatureHelp(signatureProvider);
	connection.onWorkspaceSymbol(workspaceSymbolProvider);
	connection.onNotification('resetInterpreter', path => utils.setInterpreter?.(configCache.InterpreterPath = path));
	connection.onNotification('closeTextDocument', (params: { uri: string, id: string }) => {
		if (params.id === 'ahk2')
			lexers[params.uri.toLowerCase()]?.close(true);
		else uri_switch_to_ahk2 = params.uri;
	});
	Object.assign(utils, {
		sendDiagnostics,
		sendNotification,
		sendRequest,
		showMessage,
		updateStatusBar,
	});
	connection.listen();
}

function sendDiagnostics(uri: string, diagnostics = []) {
	return connection.sendDiagnostics({ uri, diagnostics });
}

function sendNotification(method: string, params?: unknown) {
	connection.sendNotification(method, params);
}

function sendRequest<T>(method: string, params?: unknown) {
	return connection.sendRequest<T>(method, params);
}

function showMessage(type: MessageType, message: string, ...actions: MessageActionItem[]) {
	return connection.sendRequest<MessageActionItem | null>(ShowMessageRequest.method, { type, message, actions });
}

async function updateStatusBar(path = ahkPath_resolved) {
	isInitialized && sendNotification('updateStatusBar', path ? {
		path: ahkPath,
		version: (await utils.getAhkVersion!([ahkPath_resolved])).pop()
	} : null);
}