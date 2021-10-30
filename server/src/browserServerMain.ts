/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
	AHKLSSettings, extsettings, initahk2cache, lexers, libfuncs, loadahk2, sendDiagnostics,
	set_ahk_h, set_Connection, set_dirname, set_locale, set_Workfolder, updateFileInfo
} from './global';
import { URI } from 'vscode-uri';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	createConnection, BrowserMessageReader, BrowserMessageWriter, DidChangeConfigurationNotification,
	FoldingRange, FoldingRangeParams, InitializeParams, InitializeResult, ExecuteCommandParams,
	Range, SymbolKind, TextDocumentChangeEvent, TextDocuments, TextDocumentSyncKind, TextEdit
} from 'vscode-languageserver/browser';
import { colorPresentation, colorProvider } from './colorProvider';
import { completionProvider } from './completionProvider';
import { defintionProvider } from './definitionProvider';
import { documentFormatting, rangeFormatting, typeFormatting } from './formattingProvider';
import { hoverProvider } from './hoverProvider';
import { getincludetable, Lexer, parseinclude } from './Lexer';
import { loadlocalize } from './localize';
import { referenceProvider } from './referencesProvider';
import { prepareRename, renameProvider } from './renameProvider';
import { signatureProvider } from './signatureProvider';
import { symbolProvider } from './symbolProvider';
import { semanticTokensOnDelta, semanticTokensOnFull, semanticTokensOnRange } from './semanticTokensProvider';
import { generateAuthor, generateComment } from './commandProvider';

export const languageServer = 'ahk2-language-server';
const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);
set_Connection(connection, true);
set_ahk_h(true);

let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument), hasahk2_hcache = false;
let hasConfigurationCapability: boolean = false, hasWorkspaceFolderCapability: boolean = false, hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	if (params.locale)
		set_locale(params.locale);
	let capabilities = params.capabilities;
	set_Workfolder(URI.parse(params.workspaceFolders?.pop()?.uri || '').fsPath.toLowerCase());
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
			}
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
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			// console.log('Workspace folder change event received.');
		});
	}
});

connection.onDidChangeConfiguration(async change => {
	if (hasConfigurationCapability) {
		let newset: AHKLSSettings = await connection.workspace.getConfiguration('AutoHotkey2');
		let changes: any = { InterpreterPath: false, AutoLibInclude: false }, oldpath = extsettings.InterpreterPath;
		for (let k in extsettings)
			if ((<any>extsettings)[k] !== (<any>newset)[k])
				changes[k] = true;
		Object.assign(extsettings, newset);
	}
});

documents.onDidOpen(async e => {
	let uri = e.document.uri.toLowerCase(), doc = new Lexer(e.document);
	lexers[uri] = doc, doc.actived = true, doc.d = lexers[uri]?.d || doc.d;
});

// Only keep settings for open documents
documents.onDidClose(async e => {
	let uri = e.document.uri.toLowerCase();
	if (lexers[uri].d)
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
		if (!lexers[u].actived) {
			let del = true;
			for (let f in lexers[u].relevance)
				if (lexers[f] && lexers[f].actived) {
					del = false; break;
				}
			if (del)
				deldocs.push(u);
		}
	for (let u of deldocs) {
		delete lexers[u];
		connection.sendDiagnostics({ uri: u, diagnostics: [] });
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
connection.languages.semanticTokens.on(semanticTokensOnFull);
connection.languages.semanticTokens.onDelta(semanticTokensOnDelta);
connection.languages.semanticTokens.onRange(semanticTokensOnRange);
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