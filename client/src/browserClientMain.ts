import { env, ExtensionContext, Uri, workspace } from 'vscode';
import { LanguageClient, ProtocolConnection } from 'vscode-languageclient/browser';
import { registerCommonFeatures, updateConfig } from './common';

let client: LanguageClient;
const fs = workspace.fs;
const loadedCollection = {
	'ahk2.enterversion': 'Enter version',
};

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {
	const serverMain = Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	const request_handlers: Record<string, (...params: never[]) => unknown> = {
		getWorkspaceFiles() {
			return workspace.findFiles('**/*.{ahk,ah2,ahk2}').then(r => r.map(it => it.toString()));
		},
		getWorkspaceFileContent(uri: string) { return readFile(Uri.parse(uri)) },
	};
	client = new LanguageClient('AutoHotkey2', 'AutoHotkey2', {
		documentSelector: [{ language: 'ahk2' }],
		markdown: { isTrusted: true, supportHtml: true },
		initializationOptions: () => {
			const connection = (client as unknown as { _connection: ProtocolConnection })._connection;
			// add request handlers before initialize
			Object.entries(request_handlers).forEach(([method, handler]) => connection.onRequest(method, handler));
			return {
				extensionUri: context.extensionUri.toString(),
				...JSON.parse(JSON.stringify(updateConfig(workspace.getConfiguration('AutoHotkey2'))))
			};
		}
	}, new Worker(serverMain.toString()));
	client.start();
	initLocalize(Uri.joinPath(context.extensionUri, 'package.nls.<>.json'));

	context.subscriptions.push(
		...registerCommonFeatures(client, loadedCollection),
	);
}

export function deactivate() {
	return client?.stop();
}

function readFile(uri: Uri) {
	const m = uri.path.match(/<>./), uris: Uri[] = [];
	if (m) {
		const lang = env.language;
		uris.push(uri.with({ path: uri.path.replace('<>', lang) }));
		lang === 'zh-tw' && uris.push(uri.with({ path: uri.path.replace('<>', 'zh-cn') }));
		uris.push(uri.with({ path: uri.path.replace(m[0], '') }));
	} else uris.push(uri);
	let p = Promise.reject<Uint8Array>();
	for (const u of uris)
		p = p.catch(() => fs.readFile(uri = u));
	return p.then(buffer => ({ buffer, uri: uri.toString() }), () => null);
}

async function initLocalize(nls: Uri) {
	try {
		const obj = JSON.parse(new TextDecoder().decode((await readFile(nls))?.buffer));
		for (const key of Object.keys(loadedCollection) as Array<keyof typeof loadedCollection>)
			loadedCollection[key] = obj[key] || loadedCollection[key];
	} catch { }
}