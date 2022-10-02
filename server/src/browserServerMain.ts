/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	createConnection, BrowserMessageReader, BrowserMessageWriter, DidChangeConfigurationNotification,
	FoldingRange, FoldingRangeParams, InitializeParams, InitializeResult, ExecuteCommandParams,
	SymbolKind, TextDocumentChangeEvent, TextDocuments, TextDocumentSyncKind, WorkspaceFoldersChangeEvent
} from 'vscode-languageserver/browser';
import {
	AHKLSSettings, colorPresentation, colorProvider, completionProvider, defintionProvider, documentFormatting,
	extsettings, generateAuthor, generateComment, getincludetable, hoverProvider, initahk2cache, Lexer, lexers, LibIncludeType,
	libfuncs, loadahk2, loadlocalize, parseinclude, prepareRename, rangeFormatting, referenceProvider, renameProvider,
	semanticTokensOnDelta, semanticTokensOnFull, semanticTokensOnRange, sendDiagnostics, set_ahk_h, set_Connection, update_commentTags,
	set_dirname, set_locale, set_Workfolder, signatureProvider, symbolProvider, typeFormatting, workspaceFolders, workspaceSymbolProvider, chinese_punctuations
} from './common';

export const languageServer = 'ahk2-language-server';
const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);
set_Connection(connection, true);
set_ahk_h(true);

let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument), hasahk2_hcache = false;
let hasConfigurationCapability: boolean = false, hasWorkspaceFolderCapability: boolean = false, hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
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
					'ahk2.generate.comment',
					'ahk2.generate.author',
					'ahk2.set.extensionUri'
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

	let locale = params.locale;
	let configs: AHKLSSettings = params.initializationOptions;
	if (configs) {
		locale ??= (configs as any).locale;
		if (typeof configs.AutoLibInclude === 'string')
			configs.AutoLibInclude = LibIncludeType[configs.AutoLibInclude] as unknown as LibIncludeType;
		else if (typeof configs.AutoLibInclude === 'boolean')
			configs.AutoLibInclude = configs.AutoLibInclude ? 3 : 0;
		Object.assign(extsettings, configs);
		try {
			update_commentTags(extsettings.CommentTags);
		} catch (e: any) {
			setTimeout(() => {
				connection.console.error(e.message);
			}, 1000);
		}
	}
	if (locale) set_locale(locale);
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
		});
	}
});

connection.onDidChangeConfiguration(async change => {
	if (hasConfigurationCapability) {
		let newset: AHKLSSettings = await connection.workspace.getConfiguration('AutoHotkey2');
		if (newset.CommentTags !== extsettings.CommentTags)
			try {
				update_commentTags(newset.CommentTags);
			} catch (e: any) {
				connection.console.error(e.message);
			}
		Object.assign(extsettings, newset);
	}
});

documents.onDidOpen(async e => {
	let uri = e.document.uri.toLowerCase(), doc = lexers[uri];
	if (doc) doc.document = e.document;
	else lexers[uri] = doc = new Lexer(e.document);
	doc.actived = true;
});

// Only keep settings for open documents
documents.onDidClose(async e => {
	let uri = e.document.uri.toLowerCase();
	if (!lexers[uri] || lexers[uri].d)
		return;
	lexers[uri].actived = false;
	for (let u in lexers)
		if (lexers[u].actived)
			for (let f in lexers[u].relevance)
				if (f === uri) return;
	delete lexers[uri];
	connection.sendDiagnostics({ uri, diagnostics: [] });
	let deldocs: string[] = [];
	for (let u in lexers)
		if (!lexers[u].actived && !lexers[u].d) {
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
	let initial = doc.include, il = Object.keys(initial).length;
	doc.isparsed = false, doc.parseScript();
	if (libfuncs[uri]) {
		libfuncs[uri].length = 0;
		libfuncs[uri].push(...Object.values(doc.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function));
	}
	if (Object.keys(doc.include).length === il && Object.keys(Object.assign(initial, doc.include)).length === il) {
		if (!doc.relevance)
			doc.update_relevance();
		sendDiagnostics();
		return;
	}
	parseinclude(doc.include, doc.scriptdir);
	for (const t in initial)
		if (!doc.include[t] && lexers[t]?.diagnostics.length)
			lexers[t].parseScript();
	resetrelevance();
	doc.update_relevance();
	sendDiagnostics();

	function resetrelevance() {
		for (const u in initial)
			if (lexers[u])
				lexers[u].relevance = getincludetable(u).list;
	}
});

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
connection.languages.semanticTokens.onDelta(semanticTokensOnDelta);
connection.languages.semanticTokens.onRange(semanticTokensOnRange);
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
documents.listen(connection);
connection.listen();

async function executeCommandProvider(params: ExecuteCommandParams) {
	let args = params.arguments || [];
	switch (params.command) {
		case 'ahk2.generate.comment':
			generateComment(args);
			break;
		case 'ahk2.generate.author':
			generateAuthor();
			break;
		case 'ahk2.set.extensionUri':
			set_dirname(args[0]);
			loadres();
			break;
	}
}

async function loadres() {
	loadlocalize();
	initahk2cache();
	loadahk2();
	loadahk2('ahk2_h');
}