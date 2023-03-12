/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, env, ExtensionContext, languages, Range, RelativePattern, SnippetString, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/browser';

let client: LanguageClient;

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {
	const serverMain = Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	const request_handlers: { [cmd: string]: any } = {
		'ahk2.executeCommands': async (params: { command: string, args?: string[], wait?: boolean }[]) => {
			let result: any[] = [];
			for (const cmd of params)
				result.push(cmd.wait ? await commands.executeCommand(cmd.command, cmd.args) : commands.executeCommand(cmd.command, cmd.args));
			return result;
		},
		'ahk2.getActiveTextEditorUriAndPosition': (params: any) => {
			const editor = window.activeTextEditor;
			if (!editor) return;
			const uri = editor.document.uri.toString(), position = editor.selection.end;
			return { uri, position };
		},
		'ahk2.insertSnippet': async (params: [string, Range?]) => {
			let editor = window.activeTextEditor;
			if (!editor) return;
			if (params[1]) {
				let { start, end } = params[1];
				await editor.insertSnippet(new SnippetString(params[0]), new Range(start.line, start.character, end.line, end.character));
			} else
				editor.insertSnippet(new SnippetString(params[0]));
		},
		'ahk2.setTextDocumentLanguage': async (params: [string, string?]) => {
			let lang = params[1] || 'ahk';
			if (!(await languages.getLanguages()).includes(lang)) {
				window.showErrorMessage(`Unknown language id: ${lang}`);
				return;
			}
			let uri = params[0], it = workspace.textDocuments.find(it => it.uri.toString() === uri);
			it && languages.setTextDocumentLanguage(it, lang);
		},
		'ahk2.getWorkspaceFiles': async (params: string[]) => {
			let all = !params.length;
			if (workspace.workspaceFolders) {
				if (all)
					return (await workspace.findFiles('**/*.{ahk,ah2,ahk2}')).forEach(it => it.toString());
				else {
					let files: string[] = [];
					for (let folder of workspace.workspaceFolders)
						if (params.includes(folder.uri.toString().toLowerCase()))
							files.push(...(await workspace.findFiles(new RelativePattern(folder, '*.{ahk,ah2,ahk2}'))).map(it => it.toString()));
					return files;
				}
			}
		},
		'ahk2.getWorkspaceFileContent': async (params: string[]) => (await workspace.openTextDocument(Uri.parse(params[0]))).getText()
	};

	client = new LanguageClient('ahk2', 'AutoHotkey2', {
		documentSelector: [{ language: 'ahk2' }],
		synchronize: {},
		initializationOptions: {
			commands: Object.keys(request_handlers),
			...workspace.getConfiguration('AutoHotkey2')
		}
	}, new Worker(serverMain.toString()));

	context.subscriptions.push(
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
		}),
		commands.registerCommand('ahk2.switch', () => {
			const doc = window.activeTextEditor?.document;
			if (doc) languages.setTextDocumentLanguage(doc, doc.languageId === 'ahk2' ? 'ahk' : 'ahk2');
		}),
		workspace.onDidCloseTextDocument(e => {
			client.sendNotification('onDidCloseTextDocument', e.isClosed ?
				{ uri: '', id: '' } : { uri: e.uri.toString(), id: e.languageId });
		})
	);

	client.start().then(() => {
		Object.entries(request_handlers).forEach(handler => client.onRequest(...handler));
	});
}

export function deactivate() {
	return client?.stop();
}