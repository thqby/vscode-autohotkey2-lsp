/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, ExtensionContext, Range, SnippetString, Uri, window } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/browser';

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {
	const serverMain = Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	const worker = new Worker(serverMain.toString());
	const client = new LanguageClient('ahk2', 'Autohotkey2 Server', {
		documentSelector: [{ language: 'ahk2' }],
		synchronize: {},
		initializationOptions: {}
	}, worker);

	const disposable = client.start();
	context.subscriptions.push(disposable);

	client.onReady().then(() => {
		client.onRequest('ahk2.executeCommands', async (params: any[]) => {
			let result: any[] = [], cmds: { command: string, args?: string[], wait?: boolean }[] = params[0];
			for (const cmd of cmds)
				result.push(cmd.wait ? await commands.executeCommand(cmd.command, cmd.args) : commands.executeCommand(cmd.command, cmd.args));
			return result;
		});
		client.onRequest('ahk2.getpos', () => {
			const editor = window.activeTextEditor;
			if (!editor) return;
			const uri = editor.document.uri.toString(), pos = editor.selection.end;
			return { uri, pos };
		});
		client.onRequest('ahk2.insertSnippet', async (params: any[]) => {
			let editor = window.activeTextEditor;
			if (!editor) return;
			if (params[1]) {
				let { start, end } = params[1];
				await editor.insertSnippet(new SnippetString(params[0]), new Range(start.line, start.character, end.line, end.character));
			} else
				editor.insertSnippet(new SnippetString(params[0]));
		});
		commands.executeCommand('ahk2.set.extensionUri', context.extensionUri.toString());
	});
}