import * as assert from 'assert';
import * as vscode from 'vscode';
import { resolve } from 'path';
import { LanguageClient } from 'vscode-languageclient/node';
import * as lsp from 'vscode-languageserver-protocol';

let client: LanguageClient | undefined;

suite('Start ahk language server', () => {
	let isRunning = false;
	setup(async () => {
		client = await vscode.extensions.getExtension('thqby.vscode-autohotkey2-lsp')?.activate();
		isRunning = client?.isRunning() ?? false;
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	test('language server is running?', () => assert.equal(isRunning, true));

	test('test language server', async () => {
		if (!isRunning)
			throw Error();
		const te = await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(
			resolve(__dirname, '../../../server/dist/ahkProvider.ahk')
		));
		let request: string;
		const uri = te.document.uri.toString();
		await client!.sendNotification(lsp.DidChangeTextDocumentNotification.method,
			{ textDocument: { uri } } as lsp.DidChangeTextDocumentParams);
		const content = await client!.sendRequest(request = 'ahk2.getContent', uri) as string;
		assert.equal(te.document.getText() === content, true, request);

	}).timeout(20000);

});
