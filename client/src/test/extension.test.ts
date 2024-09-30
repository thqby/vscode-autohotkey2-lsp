import * as assert from 'assert';
import * as vscode from 'vscode';
import { resolve } from 'path';
import {
	LanguageClient,
	CompletionRequest, CompletionParams, CompletionItem,
	DocumentSymbolRequest, DocumentSymbolParams, SymbolInformation,
	DefinitionRequest, DefinitionParams, LocationLink,
	DocumentFormattingRequest, DocumentFormattingParams, TextEdit,
	FoldingRangeRequest, FoldingRangeParams, FoldingRange,
	HoverRequest, HoverParams, Hover,
	PrepareRenameRequest, PrepareRenameParams,
	ReferencesRequest, ReferenceParams, Location,
	RenameRequest, RenameParams, WorkspaceEdit,
	SignatureHelpRequest, SignatureHelpParams, SignatureHelp,
	SemanticTokensRequest, SemanticTokensParams, SemanticTokens,
	WorkspaceSymbolRequest, WorkspaceSymbolParams,
	ExecuteCommandRequest, ExecuteCommandParams,
	DidChangeConfigurationNotification,
} from 'vscode-languageclient/node';
import { readdirSync } from 'fs';

suite('Start ahk language server', () => {
	test('should be running', async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		const client: LanguageClient = await vscode.extensions.getExtension('thqby.vscode-autohotkey2-lsp')?.activate();
		assert.equal(client?.isRunning(), true);

		suite('Open ahk file', () => {
			test('should be opened', async () => {
				const path = resolve(__dirname, '../../../server/dist/ahkProvider.ahk');
				let document = await vscode.workspace.openTextDocument(path);
				const uri = document.uri.toString();
				await vscode.window.showTextDocument(document);
				if (document.languageId !== 'ahk2')
					document = await vscode.languages.setTextDocumentLanguage(document, 'ahk2');
				const content = await client.sendRequest('ahk2.getContent', uri) as string;
				assert.equal(document.getText() === content, true);

				suite('Test language server features', () => {
					const textDocument = { uri };
					const position = { line: 10, character: 5 };

					test(CompletionRequest.method, async function () {
						const params: CompletionParams = { textDocument, position };
						const result: CompletionItem[] | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.length);
					});

					test(DefinitionRequest.method, async function () {
						const params: DefinitionParams = { textDocument, position };
						const result: LocationLink[] | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.length);
					});

					test(DocumentFormattingRequest.method, async function () {
						const params: DocumentFormattingParams = { textDocument, options: { insertSpaces: false, tabSize: 4 } };
						const result: TextEdit[] | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.length);
					});

					test(DocumentSymbolRequest.method, async function () {
						const params: DocumentSymbolParams = { textDocument };
						const result: SymbolInformation[] | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.length);
					});

					test(FoldingRangeRequest.method, async function () {
						const params: FoldingRangeParams = { textDocument };
						const result: FoldingRange[] | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.length);
					});

					test(HoverRequest.method, async function () {
						const params: HoverParams = { textDocument, position };
						const result: Hover | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.contents);
					});

					test(PrepareRenameRequest.method, async function () {
						const params: PrepareRenameParams = { textDocument, position };
						const result: unknown | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result);
					});

					test(ReferencesRequest.method, async function () {
						const params: ReferenceParams = { textDocument, position, context: { includeDeclaration: true } };
						const result: Location[] | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.length);
					});

					test(RenameRequest.method, async function () {
						const params: RenameParams = { textDocument, position, newName: '' };
						const result: WorkspaceEdit | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.changes);
					});

					test(SignatureHelpRequest.method, async function () {
						const params: SignatureHelpParams = { textDocument, position: { line: 8, character: 36 } };
						const result: SignatureHelp | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.signatures);
					});

					test(ExecuteCommandRequest.method, async function () {
						const params: ExecuteCommandParams = { command: 'ahk2.diagnose.all' };
						await client.sendRequest(this.runnable().title, params);
					});

					test(WorkspaceSymbolRequest.method, async function () {
						const params: WorkspaceSymbolParams = { query: 'msg' };
						const result: SymbolInformation[] | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.length);
					});

					test(SemanticTokensRequest.method, async function () {
						const params: SemanticTokensParams = { textDocument };
						const result: SemanticTokens | undefined = await client.sendRequest(this.runnable().title, params);
						assert.ok(result?.data);
					});
				});

				await client.sendNotification(
					DidChangeConfigurationNotification.method,
					{ settings: { FormatOptions: {} } });
				test_fotmatting(client);
			});
		});
	});
});

function test_fotmatting(client: LanguageClient) {
	suite('Test formatting', () => {
		const dir = resolve(__dirname, '../../src/test/formatting');
		const files = readdirSync(dir);
		for (const file of files) {
			if (!file.endsWith('.ahk'))
				continue;
			test(file.slice(0, -4), async function () {
				let document = await vscode.workspace.openTextDocument(resolve(dir, file));
				if (document.languageId !== 'ahk2')
					document = await vscode.languages.setTextDocumentLanguage(document, 'ahk2');
				const uri = document.uri.toString();
				const params: DocumentFormattingParams = {
					textDocument: { uri },
					options: { insertSpaces: false, tabSize: 4 }
				};
				const content = document.getText().replaceAll('\r\n', '\n');
				const result: TextEdit[] | undefined = await client.sendRequest(DocumentFormattingRequest.method, params);
				assert.ok(result?.[0].newText === content);
			});
		}
	});
}