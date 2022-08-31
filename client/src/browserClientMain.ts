/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, ExtensionContext, Range, RelativePattern, SnippetString, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/browser';

const ahkconfig = workspace.getConfiguration('AutoHotkey2');

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {
	const serverMain = Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	const worker = new Worker(serverMain.toString());
	const client = new LanguageClient('ahk2', 'Autohotkey2 Server', {
		documentSelector: [{ language: 'ahk2' }],
		synchronize: {},
		initializationOptions: {
			AutoLibInclude: getConfig('AutoLibInclude'),
			CommentTags: getConfig('CommentTags'),
			InterpreterPath: getConfig('InterpreterPath')
		}
	}, worker);

	const disposable = client.start();
	context.subscriptions.push(disposable,
		commands.registerCommand('ahk2.updateversioninfo', async () => {
			const editor = window.activeTextEditor;
			if(editor) {
				let info: { content: string, uri: string, range: Range } | null = await client.sendRequest('ahk2.getVersionInfo', editor.document.uri.toString());
				if (!info) {
					await editor.insertSnippet(new SnippetString([
						"/************************************************************************",
						" * @description ${1:}",
						" * @file $TM_FILENAME",
						" * @author ${2:}",
						" * @date ${3:$CURRENT_YEAR/$CURRENT_MONTH/$CURRENT_DATE}",
						" * @version ${4:0.0.0}",
						" ***********************************************************************/",
						"", ""
					].join('\n')), new Range(0, 0, 0, 0));
				} else {
					let d = new Date;
					let content = info.content, ver;
					content = content.replace(/(?<=^\s*[;*]?\s*@date[:\s]\s*)(\d+\/\d+\/\d+)/im, d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2));
					if (content.match(/(?<=^\s*[;*]?\s*@version[:\s]\s*)(\S*)/im) &&
						(ver = await window.showInputBox({ prompt: 'Enter version info', value: content.match(/(?<=^[\s*]*@version[:\s]\s*)(\S*)/im)?.[1] })))
						content = content.replace(/(?<=^\s*[;*]?\s*@version[:\s]\s*)(\S*)/im, ver);
					if (content !== info.content) {
						let ed = new WorkspaceEdit();
						ed.replace(Uri.parse(info.uri), info.range, content);
						workspace.applyEdit(ed);
					}
				}
			}
		})
	);

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
		client.onRequest('ahk2.getWorkspaceFiles', async (params: string[]) => {
			let all = !params.length;
			if (workspace.workspaceFolders) {
				if (all)
					return (await workspace.findFiles('**/*.{ahk,ah2,ahk2}')).map(it => it.toString());
				else {
					let files: string[] = [];
					for (let folder of workspace.workspaceFolders)
						if (params.includes(folder.uri.toString().toLowerCase()))
							files.push(...(await workspace.findFiles(new RelativePattern(folder, '*.{ahk,ah2,ahk2}'))).map(it => it.toString()));
					return files;
				}
			}
		});
		client.onRequest('ahk2.getWorkspaceFileContent', async (params: string[]) => (await workspace.openTextDocument(Uri.parse(params[0]))).getText());
		commands.executeCommand('ahk2.set.extensionUri', context.extensionUri.toString());
	});
}

function getConfig(key: string, defaultVal = '') {
	let t = ahkconfig.inspect(key);
	if (t)
		return (t.workspaceFolderValue || t.workspaceValue || t.globalValue || t.defaultValue || defaultVal) as string;
	return '';
}