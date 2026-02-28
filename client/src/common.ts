import { commands, ConfigurationTarget, languages, Range, SnippetString, TextEditor, TextEditorEdit, window, workspace, WorkspaceConfiguration, WorkspaceEdit } from 'vscode';
import * as LSP from 'vscode-languageclient';
import type { LocalizeKey } from './extension';

function registerTextEditorCommands(client: LSP.BaseLanguageClient) {
	const cmds: Record<string, (this: <T>(...args: unknown[]) => Promise<T>,
		editor: TextEditor, edit: TextEditorEdit, ...args: unknown[]) => void> = {
		extractSymbols(editor) {
			this(editorUri(editor)).then(result => workspace.openTextDocument({
				language: 'json', content: JSON.stringify(result, undefined, 2)
			}).then(d => window.showTextDocument(d, 2)));
		},
		generateComment(editor) {
			this<{ range: LSP.Range, text: string } | undefined>({
				uri: editorUri(editor),
				position: client.code2ProtocolConverter.asPosition(editor.selection.active)
			}).then(r => {
				r && editor.insertSnippet(new SnippetString(r.text),
					client.protocol2CodeConverter.asRange(r.range));
			});
		},
	};
	if (!process.env.BROWSER)
		cmds.diagnoseAll = cmds.setScriptDir = function (editor) { this(editorUri(editor)); };
	return Object.entries(cmds).map(([method, callback]) =>
		commands.registerTextEditorCommand(`ahk2.${method.replace(/([A-Z])/, '.$1').toLowerCase()}`,
			callback, (arg: unknown) => client.sendRequest(method, arg)));
}

export function registerCommonFeatures(client: LSP.BaseLanguageClient, localize: { [k in LocalizeKey]?: string }) {
	const cmds: Record<string, (editor: TextEditor, edit: TextEditorEdit, ...args: unknown[]) => void> = {
		switch(editor) {
			const { document } = editor;
			languages.setTextDocumentLanguage(document, document.languageId === 'ahk2' ? 'ahk' : 'ahk2');
		},
		async 'update.versioninfo'(editor) {
			const infos: { content: string, range: LSP.Range, single: boolean }[] | null = await client.sendRequest('getVersionInfo', editorUri(editor));
			if (!infos?.length) {
				await editor.insertSnippet(new SnippetString([
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
							/(?<=^;\s*@ahk2exe-set\w+\s+)(\S+|(?=[\r\n]))/i,
							s => (value ||= s, '\0')));
					else contents.push(info.content.replace(
						/(?<=^\s*[;*]?\s*@date[:\s]\s*)(\S+|(?=[\r\n]))/im,
						date => [d.getFullYear(), d.getMonth() + 1, d.getDate()].map(
							n => n.toString().padStart(2, '0')).join(date.includes('.') ? '.' : '/')
					).replace(/(?<=^\s*[;*]?\s*@version[:\s]\s*)(\S+|(?=[\r\n]))/im, s => (value ||= s, '\0')));
				}
				if (value !== undefined) {
					value = await window.showInputBox({
						value, prompt: localize['ahk2.enterversion']
					});
					if (!value)
						return;
					contents = contents.map(s => s.replace('\0', value!));
				}
				const ed = new WorkspaceEdit(), { uri } = editor.document;
				infos.forEach(it => it.content !== (value = contents.shift()) &&
					ed.replace(uri, client.protocol2CodeConverter.asRange(it.range), value!));
				ed.size && workspace.applyEdit(ed);
			}
		}
	};
	const chars = workspace.getConfiguration('AutoHotkey2')
		.get<string>('CompletionTriggerCharacters') ?? '';
	const disposables = Object.entries(cmds).map(([cmd, callback]) =>
		commands.registerTextEditorCommand(`ahk2.${cmd}`, callback));
	disposables.push(...registerTextEditorCommands(client),
		window.onDidChangeTextEditorOptions(e =>
			e.textEditor.document.languageId === 'ahk2' &&
			client.sendNotification('changeIndent', {
				uri: e.textEditor.document.uri.toString(),
				value: e.options.insertSpaces ? ' '.repeat(e.options.tabSize as number) : '\t'
			})),
		workspace.onDidCloseTextDocument(e => client.sendNotification('closeTextDocument',
			e.isClosed ? { uri: '', id: '' } : { uri: e.uri.toString(), id: e.languageId })),
	);
	chars && disposables.push(languages.registerCompletionItemProvider({ language: 'ahk2' },
		{ provideCompletionItems: () => null }, ...chars.split('')));
	client.onNotification('switchToV1', (uri: string) => {
		const it = workspace.textDocuments.find(it => it.uri.toString() === uri);
		it && languages.setTextDocumentLanguage(it, 'ahk')
			.then(null, e => window.showErrorMessage(e.message));
	});
	return disposables;
}

function editorUri(editor: TextEditor) {
	return editor.document.uri.toString();
}

export function updateConfig(config: WorkspaceConfiguration) {
	const ms = ['ParamsCheck', 'InvokeCheck'].map(s => 'Diagnostics.' + s);
	const ks = ['workspaceValue', 'globalValue'] as const;
	const ts = [ConfigurationTarget.Workspace, ConfigurationTarget.Global];
	const o = ms.map(s => config.inspect(s));
	let i = 0;
	for (const k of ks) {
		const v = o[0]?.[k];
		config.update(ms[0], undefined, ts[i]);
		if (o[1]?.[k] !== undefined)
			break;
		if (v !== undefined) {
			config.update(ms[1], !v ? [] : undefined, ts[i]);
			break;
		}
		i++;
	}
	return config;
}