/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	createConnection, BrowserMessageReader, BrowserMessageWriter, DidChangeConfigurationNotification,
	FoldingRange, FoldingRangeParams, InitializeParams, InitializeResult, ExecuteCommandParams,
	TextDocumentChangeEvent, TextDocuments, TextDocumentSyncKind, WorkspaceFoldersChangeEvent
} from 'vscode-languageserver/browser';
import {
	AHKLSSettings, chinese_punctuations, colorPresentation, colorProvider, completionProvider, defintionProvider, documentFormatting,
	exportSymbols, generateComment, hoverProvider, initahk2cache, Lexer, lexers,
	loadahk2, loadlocalize, prepareRename, rangeFormatting, referenceProvider, renameProvider,
	semanticTokensOnFull, semanticTokensOnRange, set_ahk_h, set_Connection,
	set_dirname, set_locale, set_Workspacefolder, signatureProvider, symbolProvider, typeFormatting,
	workspaceFolders, workspaceSymbolProvider, update_settings
} from './common';

export const languageServer = 'ahk2-language-server';
const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);
set_Connection(connection);
set_ahk_h(true);

let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
let hasConfigurationCapability: boolean = false, hasWorkspaceFolderCapability: boolean = false, hasDiagnosticRelatedInformationCapability: boolean = false;
let uri_switch_to_ahk2 = '';

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
					'ahk2.generate.comment'
				]
			},
			hoverProvider: true,
			foldingRangeProvider: true,
			colorProvider: true,
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
						'operator'
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
				full: true,
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

	let configs: AHKLSSettings = params.initializationOptions;
	set_locale(params.locale);
	set_dirname((configs as any).extensionUri);
	loadlocalize();
	update_settings(configs);
	initahk2cache();
	loadahk2();
	loadahk2('ahk2_h');
	loadahk2('winapi', 4);
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
			event.added.forEach(it => workspaceFolders.push(it.uri.toLowerCase() + '/'));
		});
	}
});

connection.onDidChangeConfiguration(async change => {
	let newset: AHKLSSettings | undefined = change?.settings;
	if (hasConfigurationCapability && !newset)
		newset = await connection.workspace.getConfiguration('AutoHotkey2');
	if (!newset) {
		connection.window.showWarningMessage('Failed to obtain the configuration');
		return;
	}
	update_settings(newset);
});

documents.onDidOpen(async e => {
	let to_ahk2 = uri_switch_to_ahk2 === e.document.uri;
	let uri = e.document.uri.toLowerCase(), doc = lexers[uri];
	if (doc) doc.document = e.document;
	else lexers[uri] = doc = new Lexer(e.document);
	doc.actived = true;
	if (to_ahk2)
		doc.actionwhenv1 = 'Continue';
});

// Only keep settings for open documents
documents.onDidClose(e => lexers[e.document.uri.toLowerCase()]?.close());

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => lexers[change.document.uri.toLowerCase()].update());

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	// console.log('We received an file change event');
});

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
connection.languages.semanticTokens.onRange(semanticTokensOnRange);
connection.onRequest('ahk2.exportSymbols', (uri: string) => exportSymbols(uri));
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
connection.onNotification('onDidCloseTextDocument',
	(params: { uri: string, id: string }) => {
		if (params.id === 'ahk2')
			lexers[params.uri.toLowerCase()]?.close(true);
		else uri_switch_to_ahk2 = params.uri;
	});
documents.listen(connection);
connection.listen();

async function executeCommandProvider(params: ExecuteCommandParams) {
	let args = params.arguments || [];
	switch (params.command) {
		case 'ahk2.generate.comment':
			generateComment(args);
			break;
	}
}
