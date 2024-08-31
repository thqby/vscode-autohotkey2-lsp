/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, ExtensionContext, languages, Range, RelativePattern, SnippetString, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/browser';

let client: LanguageClient;

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {
	const serverMain = Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	/* eslint-disable-next-line */
	const request_handlers: Record<string, (...params: any[]) => any> = {
		'ahk2.getActiveTextEditorUriAndPosition': () => {
			const editor = window.activeTextEditor;
			if (!editor) return;
			const uri = editor.document.uri.toString(), position = editor.selection.end;
			return { uri, position };
		},
		'ahk2.insertSnippet': async (params: [string, Range?]) => {
			const editor = window.activeTextEditor;
			if (!editor) return;
			if (params[1]) {
				const { start, end } = params[1];
				await editor.insertSnippet(new SnippetString(params[0]), new Range(start.line, start.character, end.line, end.character));
			} else
				editor.insertSnippet(new SnippetString(params[0]));
		},
		'ahk2.setTextDocumentLanguage': async (params: [string, string?]) => {
			const lang = params[1] || 'ahk';
			if (!(await languages.getLanguages()).includes(lang)) {
				window.showErrorMessage(`Unknown language id: ${lang}`);
				return;
			}
			const uri = params[0], it = workspace.textDocuments.find(it => it.uri.toString() === uri);
			it && languages.setTextDocumentLanguage(it, lang);
		},
		'ahk2.getWorkspaceFiles': async (params: string[]) => {
			const all = !params.length;
			if (workspace.workspaceFolders) {
				if (all)
					return (await workspace.findFiles('**/*.{ahk,ah2,ahk2}')).forEach(it => it.toString());
				else {
					const files: string[] = [];
					for (const folder of workspace.workspaceFolders)
						if (params.includes(folder.uri.toString().toLowerCase()))
							files.push(...(await workspace.findFiles(new RelativePattern(folder, '*.{ahk,ah2,ahk2}'))).map(it => it.toString()));
					return files;
				}
			}
		},
		'ahk2.getWorkspaceFileContent': async (params: string[]) => (await workspace.openTextDocument(Uri.parse(params[0]))).getText()
	};

	client = new LanguageClient('AutoHotkey2', 'AutoHotkey2', {
		documentSelector: [{ language: 'ahk2' }],
		markdown: { isTrusted: true, supportHtml: true },
		initializationOptions: {
			extensionUri: context.extensionUri.toString(),
			commands: Object.keys(request_handlers),
			...JSON.parse(JSON.stringify(workspace.getConfiguration('AutoHotkey2')))
		}
	}, new Worker(serverMain.toString()));

	context.subscriptions.push(
		commands.registerTextEditorCommand('ahk2.update.versioninfo', async textEditor => {
			const infos: { content: string, uri: string, range: Range, single: boolean }[] | null = await client.sendRequest('ahk2.getVersionInfo', textEditor.document.uri.toString());
			if (!infos?.length) {
				await textEditor.insertSnippet(new SnippetString([
					"/************************************************************************",
					" * @description ${1:}",
					" * @author ${2:}",
					" * @date ${3:$CURRENT_YEAR/$CURRENT_MONTH/$CURRENT_DATE}",
					" * @version ${4:0.0.0}",
					" ***********************************************************************/",
					"", ""
				].join('\n')), new Range(0, 0, 0, 0));
			} else {
				const d = new Date;
				let contents: string[] = [], value: string | undefined;
				for (const info of infos) {
					if (info.single)
						contents.push(info.content.replace(
							/(?<=^;\s*@ahk2exe-setversion\s+)(\S+|(?=[\r\n]))/i,
							s => (value ||= s, '\0')));
					else contents.push(info.content.replace(
						/(?<=^\s*[;*]?\s*@date[:\s]\s*)(\S+|(?=[\r\n]))/im,
						date => [d.getFullYear(), d.getMonth() + 1, d.getDate()].map(
							n => n.toString().padStart(2, '0')).join(date.includes('.') ? '.' : '/')
					).replace(/(?<=^\s*[;*]?\s*@version[:\s]\s*)(\S+|(?=[\r\n]))/im, s => (value ||= s, '\0')));
				}
				if (value !== undefined) {
					value = await window.showInputBox({
						value, prompt: 'Enter version info'
					});
					if (!value)
						return;
					contents = contents.map(s => s.replace('\0', value!));
				}
				const ed = new WorkspaceEdit(), uri = textEditor.document.uri;
				infos.forEach(it => it.content !== (value = contents.shift()) &&
					ed.replace(uri, it.range, value!));
				ed.size && workspace.applyEdit(ed);
			}
		}),
		commands.registerTextEditorCommand('ahk2.switch', textEditor => {
			const doc = textEditor.document;
			languages.setTextDocumentLanguage(doc, doc.languageId === 'ahk2' ? 'ahk' : 'ahk2');
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