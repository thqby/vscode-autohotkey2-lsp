import {
	commands,
	ConfigurationTarget,
	debug,
	DebugConfiguration,
	env,
	ExtensionContext,
	extensions,
	languages,
	OutputChannel,
	QuickPickItem,
	Range,
	SnippetString,
	StatusBarAlignment,
	StatusBarItem,
	TextEditor,
	Uri,
	window,
	workspace,
	WorkspaceEdit
} from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { resolve } from 'path';
import { ChildProcess, execSync, spawn } from 'child_process';
import { readdirSync, readFileSync, lstatSync, readlinkSync, unlinkSync, writeFileSync } from 'fs';
import { CfgKey, configPrefix, ShowOutput } from '../../util/src/config';
import {
	ClientCommand,
	languageClientId,
	languageClientName,
	outputChannelName,
	clientExecuteCommand,
	clientGetActiveEditorInfo,
	clientInsertSnippet,
	clientSetTextDocumentLanguage,
	clientUpdateStatusBar,
	extRun,
	extSetInterpreter,
	extRunSelection,
	extStop,
	extDebugAttach,
	extDebugConfig,
	extDebugParams,
	extSelectSyntaxes,
	extUpdateVersionInfo,
	serverExportSymbols,
	serverGetAHKVersion,
	serverGetContent,
	serverGetVersionInfo,
	extExtractSymbols,
	extSwitchAHKVersion,
	serverResetInterpreterPath,
	ahkIsRunningContext,
} from '../../util/src/env';
import { getConfigIDE, getConfigRoot } from './config';

let client: LanguageClient, outputchannel: OutputChannel, ahkStatusBarItem: StatusBarItem;
const ahkprocesses = new Map<number, ChildProcess & { path?: string }>();
let interpreterPath: string = getConfigIDE<string>(CfgKey.InterpreterPath, ''), server_is_ready = false;
const textdecoders = [new TextDecoder('utf8', { fatal: true }), new TextDecoder('utf-16le', { fatal: true })];
const isWindows = process.platform === 'win32';
let extlist: string[] = [], debugexts: Record<string, string> = {}, langs: string[] = [];
const loadedCollection = {
	'ahk2.browse': 'Browse your file system to find AutoHotkey2 interpreter',
	'ahk2.compiledfailed': 'Compiled failed!',
	'ahk2.compiledsuccessfully': 'Compiled successfully!',
	'ahk2.current': 'Current: {0}',
	'ahk2.debugextnotexist': 'The debug extension was not found, please install the debug extension first!',
	'ahk2.diagnose.all': 'Diagnostic All',
	'ahk2.enterahkpath': 'Enter path to AutoHotkey2 interpreter',
	'ahk2.entercmd': 'Enter the command line parameters that need to be passed',
	'ahk2.enterorfind': 'Enter path or find an existing interpreter',
	'ahk2.enterversion': 'Enter version',
	'ahk2.filenotexist': '\'{0}\' does not exist',
	'ahk2.find': 'Find...',
	'ahk2.savebeforecompilation': 'Please save the script before compilation',
	'ahk2.select': 'Select',
	'ahk2.set.interpreter': 'Select AutoHotkey2 Interpreter',
	'ahk2.unknownversion': 'Unknown version',
};

export function activate(context: ExtensionContext): Promise<LanguageClient> {
	/** Absolute path to `server.js` */
	const extId = context.extension.id;
	const serverModule = context.asAbsolutePath(`${extId.startsWith('mark-wiemer') ? 'ahk2/' : ''}server/${process.env.DEBUG ? 'out' : 'dist'}/server.js`);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: { kind: TransportKind.socket, port: 1219 },
			options: { execArgv: ['--nolazy', '--inspect=6009'] }
		}
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const requestHandlers: Record<ClientCommand, any> = {
		[clientExecuteCommand]: (params: string[]) => commands.executeCommand(params.shift() as string, ...params),
		[clientGetActiveEditorInfo]: () => {
			const editor = window.activeTextEditor;
			if (!editor) return;
			const uri = editor.document.uri.toString(), position = editor.selection.end;
			return { uri, position };
		},
		[clientInsertSnippet]: async (params: [string, Range?]) => {
			const editor = window.activeTextEditor;
			if (!editor) return;
			if (params[1]) {
				const { start, end } = params[1];
				await editor.insertSnippet(new SnippetString(params[0]), new Range(start.line, start.character, end.line, end.character));
			} else
				editor.insertSnippet(new SnippetString(params[0]));
		},
		[clientSetTextDocumentLanguage]: async (params: [string, string?]) => {
			const lang = params[1] || 'ahk';
			if (!langs.includes(lang)) {
				window.showErrorMessage(`Unknown language id: ${lang}`);
				return;
			}
			const uri = params[0], it = workspace.textDocuments.find(it => it.uri.toString() === uri);
			it && languages.setTextDocumentLanguage(it, lang);
		},
		[clientUpdateStatusBar]: async (params: [string]) => {
			interpreterPath = params[0];
			onDidChangeInterpreter();
		}
	};

	// Options to control the language client
	const fsw = workspace.createFileSystemWatcher('**/*.{ahk}');
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ language: 'ahk2' }],
		markdown: { isTrusted: true, supportHtml: true },
		outputChannel: outputchannel = window.createOutputChannel(outputChannelName, '~ahk2-output'),
		outputChannelName: outputChannelName,
		synchronize: { fileEvents: fsw },
		initializationOptions: {
			commands: Object.keys(requestHandlers),
			GlobalStorage: context.globalStorageUri.fsPath,
			...getConfigRoot()
		},
	};

	if (getConfigIDE<unknown>(CfgKey.OneTrueBrace, undefined) !== undefined)
		window.showWarningMessage(`Configuration "${configPrefix}.FormatOptions.one_true_brace" is no longer supported.\nPlease use "${configPrefix}.${CfgKey.BraceStyle}"`);

	// Create the language client and start the client.
	client = new LanguageClient(languageClientId, languageClientName, serverOptions, clientOptions);
	loadLocalize(context.extensionPath + '/package.nls');
	textdecoders.push(new TextDecoder(env.language.startsWith('zh-') ? 'gbk' : 'windows-1252'));

	// Start the client. This will also launch the server
	let onInitialized: undefined | ((value: LanguageClient) => void);
	client.start().then(() => {
		Object.entries(requestHandlers).forEach(handler => client.onRequest(...handler));
		onDidChangeInterpreter();
		if (window.activeTextEditor?.document.languageId === 'ahk2')
			ahkStatusBarItem.show();
		server_is_ready = true;
		onInitialized!(client);
		onInitialized = undefined;
	});

	const id_has_register: string[] = [];
	function update_extensions_info() {
		debugexts = {};
		for (const ext of extensions.all) {
			let type;
			if (ext.extensionKind === 1 && /ahk|autohotkey/i.test(ext.id) &&
				(type = ext.packageJSON?.contributes?.debuggers?.[0]?.type))
				debugexts[type] = ext.id;
		}
		extlist = Object.values(debugexts);
		languages.getLanguages().then(all => langs = all);
		for (const id in debugexts) {
			if (id_has_register.includes(id))
				continue;
			id_has_register.push(id);
			context.subscriptions.push(debug.registerDebugConfigurationProvider(id, {
				async resolveDebugConfiguration(folder, config) {
					if (config.__ahk2debug || window.activeTextEditor?.document.languageId !== 'ahk') {
						let runtime: string | undefined;
						if (!config.__ahk2debug) {
							config.request ||= 'launch';
							/** The most-populated debug config saved to the IDE */
							const bestSavedConfig = getDebugConfigs()?.filter(it =>
								Object.entries(it).every(([k, v]) => equal(v, config[k]))
							)?.sort((a, b) => Object.keys(a).length - Object.keys(b).length).pop();
							const def = getConfigIDE<Partial<DebugConfiguration>>(CfgKey.DebugConfiguration, {});
							delete def.request, delete def.type;
							Object.assign(config, def, bestSavedConfig);
							if (bestSavedConfig?.type === 'autohotkey')
								runtime = bestSavedConfig.runtime_v2;
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							function equal(a: any, b: any): boolean {
								if (a === b)
									return true;
								if (a.__proto__ !== b.__proto__ || typeof a !== 'object')
									return false;
								if (a instanceof Array)
									return a.every((v, i) => equal(v, b[i]));
								const kv = Object.entries(a);
								return kv.length === Object.keys(b).length && kv.every(([k, v]) => equal(v, b[k]));
							}
						} else if (config.runtime === 'autohotkey')
							runtime = config.runtime_v2;
						if (!(config.runtime ||= runtime)) {
							config.runtime = resolvePath(interpreterPath, folder?.uri.fsPath);
							if (ahkStatusBarItem.text.endsWith('[UIAccess]'))
								config.useUIAVersion = true;
						}
						if (config.request === 'launch')
							config.program ||= '${file}';
						if (config.type === 'ahkdbg')
							config.AhkExecutable ||= config.runtime;
					}
					return config;
				}
			}));
		}
	}
	update_extensions_info();

	commands.executeCommand('setContext', ahkIsRunningContext, false);
	ahkStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 75);
	ahkStatusBarItem.command = extSetInterpreter;
	for (const it of [
		{ text: '$(folder)syntaxes', command: { title: localize('ahk2.select'), command: extSelectSyntaxes } },
	])
		context.subscriptions.push(Object.assign(languages.createLanguageStatusItem(it.command.command, { language: 'ahk2' }), it));
	context.subscriptions.push(
		ahkStatusBarItem, outputchannel, fsw,
		extensions.onDidChange(update_extensions_info),
		commands.registerTextEditorCommand(extRun, textEditor => runScript(textEditor)),
		commands.registerTextEditorCommand(extRunSelection, textEditor => runScript(textEditor, true)),
		commands.registerCommand(extStop, stopRunningScript),
		commands.registerCommand(extSetInterpreter, setInterpreter),
		commands.registerCommand(extDebugConfig, () => beginDebug('c')),
		commands.registerCommand(extDebugParams, () => beginDebug('p')),
		commands.registerCommand(extDebugAttach, () => beginDebug('a')),
		commands.registerCommand(extSelectSyntaxes, selectSyntaxes),
		commands.registerTextEditorCommand(extUpdateVersionInfo, async textEditor => {
			if (!server_is_ready)
				return;
			const infos: { content: string, uri: string, range: Range, single: boolean }[] | null = await client.sendRequest(serverGetVersionInfo, textEditor.document.uri.toString());
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
						value, prompt: localize('ahk2.enterversion')
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
		commands.registerTextEditorCommand(extSwitchAHKVersion, textEditor => {
			const doc = textEditor.document;
			languages.setTextDocumentLanguage(doc, doc.languageId === 'ahk2' ? 'ahk' : 'ahk2');
		}),
		commands.registerTextEditorCommand(extExtractSymbols, textEditor => {
			const doc = textEditor.document;
			if (doc.languageId !== 'ahk2')
				return;
			client.sendRequest(serverExportSymbols, doc.uri.toString())
				.then(result => workspace.openTextDocument({
					language: 'json', content: JSON.stringify(result, undefined, 2)
				}).then(d => window.showTextDocument(d, 2)));
		}),
		workspace.registerTextDocumentContentProvider('ahkres', {
			provideTextDocumentContent(uri, token) {
				if (token.isCancellationRequested)
					return;
				return client.sendRequest(serverGetContent, uri.toString()).then(content => {
					setTimeout(() => {
						const it = workspace.textDocuments.find(it => it.uri.scheme === 'ahkres' && it.uri.path === uri.path);
						it && it.languageId !== 'ahk2' && languages.setTextDocumentLanguage(it, 'ahk2');
					}, 100);
					return content as string;
				});
			}
		}),
		workspace.onDidCloseTextDocument(e => client.sendNotification('onDidCloseTextDocument',
			e.isClosed ? { uri: '', id: '' } : { uri: e.uri.toString(), id: e.languageId })),
		window.onDidChangeActiveTextEditor(e => e?.document.languageId === 'ahk2'
			? ahkStatusBarItem.show() : ahkStatusBarItem.hide()),
	);
	return new Promise(resolve => onInitialized = resolve);
}

export function deactivate() {
	return client?.stop();
}

function decode(buf: Buffer) {
	for (const td of textdecoders) {
		try {
			return td.decode(buf);
		} catch { };
	}
	return buf.toString();
}

/** Also in original src */
export enum LanguageId {
    ahk1 = 'ahk',
    ahk2 = 'ahk2',
}

const isV1 = (): boolean =>
    window.activeTextEditor?.document.languageId === LanguageId.ahk1;

/**
 * Runs the script or selection in the provided editor.
 * Works for both AHK v1 and AHK v2
 * Does not work on never-saved files (new untitled documents)
 */
async function runScript(textEditor: TextEditor, runSelection = false) {
	const interpreter: string | undefined = isV1() ? getConfigIDE(CfgKey.InterpreterPathV1, '') : getConfigIDE(CfgKey.InterpreterPath, '');
	const executePath = resolvePath(interpreter, workspace.getWorkspaceFolder(textEditor.document.uri)?.uri.fsPath);
	if (!executePath) {
		const s = interpreter || 'AutoHotkey.exe';
		window.showErrorMessage(localize('ahk2.filenotexist', s), localize('ahk2.set.interpreter'))
		.then(r => r ? setInterpreter() : undefined);
		return;
	}
	let selecttext = '', path = '*', command = `"${executePath}" /ErrorStdOut=utf-8 `;
	let startTime: Date;
	const showOutput = getConfigIDE<ShowOutput>(CfgKey.ShowOutput, 'always');
	if (showOutput === 'always')
		outputchannel.show(true);
	if (!ahkprocesses.size)
		outputchannel.clear();

	// Build the command
	if (runSelection)
		selecttext = textEditor.selections.map(textEditor.document.getText).join('\n');
	else if (textEditor.document.isUntitled || !textEditor.document.uri.toString().startsWith('file:///'))
		selecttext = textEditor.document.getText();
	executePath.replace(/^(.+[\\/])AutoHotkeyUX\.exe$/i, (...m) => {
		const lc = m[1] + 'launcher.ahk';
		if (existsSync(lc))
			command = `"${executePath}" "${lc}" `;
		return '';
	});
	const opt = {
		env: Object.fromEntries(Object.entries(process.env)
			.filter(it => !/^(CHROME|ELECTRON_RUN|FPS_BROWSER|VSCODE)_/.test(it[0]))),
		shell: true
	};
	let cp: ChildProcess & { path?: string };
	if (selecttext !== '') {
		if (ahkStatusBarItem.text.endsWith('[UIAccess]')) {
			path = resolve(__dirname, 'temp.ahk');
			writeFileSync(path, selecttext);
			command += `"${path}"`, startTime = new Date();
			cp = spawn(command, { cwd: `${resolve(textEditor.document.fileName, '..')}`, ...opt });
			unlinkSync(path);
		} else {
			command += path, startTime = new Date();
			cp = spawn(command, { cwd: `${resolve(textEditor.document.fileName, '..')}`, ...opt });
			cp.stdin?.write(selecttext), cp.stdin?.end();
		}
	} else {
		if (textEditor.document.isUntitled)
			return;
		await commands.executeCommand('workbench.action.files.save');
		path = textEditor.document.fileName, command += `"${path}"`, startTime = new Date();
		cp = spawn(command, { cwd: resolve(path, '..'), ...opt });
	}
	if (cp.pid) {
		outputchannel.appendLine(`[Running] [pid:${cp.pid}] ${command}`);
		ahkprocesses.set(cp.pid, cp);
		cp.path = path;
		commands.executeCommand('setContext', ahkIsRunningContext, true);
		cp.stderr?.on('data', (data) => {
			outputchannel.appendLine(decode(data));
		});
		cp.on('error', (error) => {
			outputchannel.appendLine(JSON.stringify(error));
			ahkprocesses.delete(cp.pid!);
		});
		cp.stdout?.on('data', (data) => {
			outputchannel.appendLine(decode(data));
		});
		cp.on('exit', (code) => {
			outputchannel.appendLine(`[Done] [pid:${cp.pid}] exited with code=${code} in ${((new Date()).getTime() - startTime.getTime()) / 1000} seconds`);
			ahkprocesses.delete(cp.pid!);
			if (!ahkprocesses.size)
				commands.executeCommand('setContext', ahkIsRunningContext, false);
		});
	} else
		outputchannel.appendLine(`[Fail] ${command}`);
}

async function stopRunningScript() {
	if (!ahkprocesses.size)
		return;
	if (ahkprocesses.size === 1)
		ahkprocesses.forEach(t => kill(t.pid!));
	else {
		const pick = window.createQuickPick(), items: QuickPickItem[] = [];
		pick.title = 'Running Scripts';
		ahkprocesses.forEach(t => items.push({ label: `pid: ${t.pid}`, detail: t.path }));
		pick.items = items, pick.canSelectMany = true;
		pick.onDidAccept(() => {
			pick.selectedItems.forEach(item => kill(parseInt(item.label.slice(5))));
			pick.dispose();
		});
		pick.show();
	}
	function kill(pid: number) {
		execSync('taskkill /pid ' + pid + ' /T /F');
		ahkprocesses.delete(pid);
	}
}

/** Return the debug configs for the installed AHK debug extensions */
function getDebugConfigs() {
	const allconfigs = workspace.getConfiguration('launch').inspect<DebugConfiguration[]>('configurations');
	return allconfigs && [
		...allconfigs.workspaceFolderValue ?? [],
		...allconfigs.workspaceValue ?? [],
		...allconfigs.globalValue ?? []].filter(it => it.type in debugexts);
}

/**
 * Begins debugging with the provided debug type.
 * @param type 'f' for file, 'c' for configs, 'p' for params, 'a' for attach
 * - f: Debug the current file.
 * - c: Debug with the selected configuration.
 * - p: Debug with the specified parameters. Only available for `zero-plusplus.vscode-autohotkey-debug`.
 * - a: Attach to the process. Only available for `zero-plusplus.vscode-autohotkey-debug`.
 */
async function beginDebug(type: 'f' | 'c' | 'p' | 'a') {
	let extname: string | undefined;
	const editor = window.activeTextEditor;
	let debugConfig = {
		...getConfigIDE<Partial<DebugConfiguration>>(CfgKey.DebugConfiguration, {}),
		request: 'launch',
		__ahk2debug: true,
	} as DebugConfiguration;
	if (!extlist.length) {
		window.showErrorMessage(localize('ahk2.debugextnotexist'));
		extname = await window.showQuickPick(['zero-plusplus.vscode-autohotkey-debug', 'helsmy.autohotkey-debug', 'mark-wiemer.vscode-autohotkey-plus-plus', 'cweijan.vscode-autohotkey-plus']);
		if (extname)
			commands.executeCommand('workbench.extensions.installExtension', extname);
		return;
	}
	if ('ap'.includes(type)) {
		if (!extlist.includes(extname = 'zero-plusplus.vscode-autohotkey-debug')) {
			window.showErrorMessage('zero-plusplus.vscode-autohotkey-debug was not found!');
			return;
		}
		debugConfig.type = Object.entries(debugexts).find(([, v]) => v === extname)![0];
		if (type === 'p') {
			let input = await window.showInputBox({ prompt: localize('ahk2.entercmd') });
			if (input === undefined)
				return;
			if ((input = input.trim())) {
				const args: string[] = [];
				input.replace(/('|")(.*?(?<!\\))\1(?=(\s|$))|(\S+)/g, (...m) => {
					args.push(m[4] || m[2]);
					return '';
				});
				debugConfig.args = args;
			}
		} else debugConfig.request = 'attach';
	} else if (type === 'c') {
		const configs = getDebugConfigs();
		if (configs?.length) {
			const pick = window.createQuickPick<{ label: string, data: DebugConfiguration }>();
			pick.items = configs.map(it => ({ label: it.name, data: it }));
			pick.show();
			const pickedDebugConfig = await new Promise<DebugConfiguration | undefined>(resolve => {
				pick.onDidAccept(() => resolve(pick.selectedItems[0]?.data));
				pick.onDidHide(() => resolve(undefined));
			});
			pick.dispose();
			if (!pickedDebugConfig)
				return;
			debugConfig = pickedDebugConfig;
		}
	} else debugConfig.program = '${file}';
	debugConfig.type ||= Object.keys(debugexts).sort().pop()!;
	debugConfig.name ||= `AutoHotkey ${debugConfig.request === 'attach' ? 'Attach' : 'Debug'}`;
	debug.startDebugging(editor && workspace.getWorkspaceFolder(editor.document.uri), debugConfig);
}

/**
 * Sets the v2 interpreter path via quick pick.
 * Updates the most local configuration target that has a custom interpreter path.
 * If no target has a custom path, updates workspace folder config.
 */
async function setInterpreter() {
	// eslint-disable-next-line prefer-const
	let index = -1, { path: ahkpath, from } = getInterpreterPath();
	const list: QuickPickItem[] = [], _ = (ahkpath = resolvePath(interpreterPath || ahkpath, undefined, false)).toLowerCase();
	const pick = window.createQuickPick();
	let it: QuickPickItem, active: QuickPickItem | undefined, sel: QuickPickItem = { label: '' };
	list.push({ alwaysShow: true, label: localize('ahk2.enterahkpath') + '...', detail: localize('ahk2.enterorfind') });
	it = { label: localize('ahk2.find'), detail: localize('ahk2.browse') };
	if (ahkpath)
		await addpath(resolve(ahkpath, '..'), _.includes('autohotkey') ? 20 : 5);
	if (!_.includes('c:\\program files\\autohotkey\\'))
		await addpath('C:\\Program Files\\AutoHotkey\\', 20);
	index = list.map(it => it.detail?.toLowerCase()).indexOf((interpreterPath || ahkpath).toLowerCase());
	if (index !== -1)
		active = list[index];

	pick.matchOnDetail = true, pick.items = list;
	pick.title = localize('ahk2.set.interpreter');
	if (active)
		pick.activeItems = [active];
	pick.placeholder = localize('ahk2.current', interpreterPath);
	pick.show();
	pick.onDidAccept(async () => {
		if (pick.selectedItems[0] === list[0]) {
			pick.title = undefined, pick.activeItems = [], pick.value = '', pick.items = [it];
			pick.placeholder = localize('ahk2.enterahkpath');
			return;
		} else if (pick.selectedItems[0] === it) {
			pick.ignoreFocusOut = true;
			const path = await window.showOpenDialog({
				defaultUri: ahkpath ? Uri.file(ahkpath) : undefined,
				filters: { Executables: ['exe'] },
				openLabel: localize('ahk2.select')
			});
			if (path)
				sel.detail = path[0].fsPath;
		} else {
			if ((it = pick.selectedItems[0])) {
				if ((!active || it !== active) && it.detail)
					sel = it;
			} else if (pick.value.match(/\.exe/i) && existsSync(pick.value))
				sel.detail = pick.value;
		}
		pick.dispose();
		if (sel.detail) {
			ahkStatusBarItem.tooltip = interpreterPath = sel.detail;
			getConfigRoot().update(CfgKey.InterpreterPath, interpreterPath, from);
			ahkStatusBarItem.text = sel.label ||= (await getAHKVersion([interpreterPath]))[0];
			if (server_is_ready)
				commands.executeCommand(serverResetInterpreterPath, interpreterPath);
		}
	});
	pick.onDidHide(() => pick.dispose());

	async function addpath(dirpath: string, max: number) {
		const paths: string[] = [];
		if (!existsSync(dirpath))
			return;
		for (let file of readdirSync(dirpath)) {
			const path = resolve(dirpath, file);
			try {
				if (statSync(path).isDirectory()) {
					for (file of readdirSync(path)) {
						const path2 = resolve(path, file);
						if (file.toLowerCase().endsWith('.exe') && !statSync(path2).isDirectory())
							paths.push(path2);
					}
				} else if (file.toLowerCase().endsWith('.exe'))
					paths.push(path);
				if (paths.length >= max)
					break;
			} catch { }
		}
		(await getAHKVersion(paths)).forEach((label, i) => {
			if (label.match(/\bautohotkey.*?2\./i) && !label.endsWith('[UIAccess]'))
				list.push({ label, detail: paths[i] });
		});
	}
}

async function selectSyntaxes() {
	const path = (await window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true }))?.[0].fsPath;
	const t = getConfigRoot().inspect(CfgKey.Syntaxes);
	let v = '', f = ConfigurationTarget.Global;
	if (t) {
		v = ((f = ConfigurationTarget.WorkspaceFolder, t.workspaceFolderValue) ??
			(f = ConfigurationTarget.Workspace, t.workspaceValue) ??
			(f = ConfigurationTarget.Global, t.globalValue) ?? '') as string;
	}
	if (path === undefined || v.toLowerCase() === path.toLowerCase())
		return;
	getConfigRoot().update(CfgKey.Syntaxes, path || undefined, f);
}

function getAHKVersion(paths: string[]): Thenable<string[]> {
	return client.sendRequest(serverGetAHKVersion, paths.map(p => resolvePath(p, undefined, true) || p));
}

function getInterpreterPath() {
	const t = getConfigRoot().inspect(CfgKey.InterpreterPath);
	let path = '';
	if (t)
		if ((path = t.workspaceFolderValue as string))
			return { path, from: ConfigurationTarget.WorkspaceFolder };
		else if ((path = t.workspaceValue as string))
			return { path, from: ConfigurationTarget.Workspace };
		else if ((path = t.globalValue as string))
			return { path, from: ConfigurationTarget.Global };
		else path = t.defaultValue as string ?? '';
	return { path };
}

async function onDidChangeInterpreter() {
	const uri = window.activeTextEditor?.document.uri;
	const ws = uri ? workspace.getWorkspaceFolder(uri)?.uri.fsPath : undefined;
	let ahkPath = resolvePath(interpreterPath, ws, false);
	if (ahkPath.toLowerCase().endsWith('.exe') && existsSync(ahkPath)) {
		// ahkStatusBarItem.tooltip is the current saved interpreter path
		if (ahkPath !== ahkStatusBarItem.tooltip) {
			ahkStatusBarItem.tooltip = ahkPath;
			ahkStatusBarItem.text = (await getAHKVersion([ahkPath]))[0] || localize('ahk2.unknownversion');
		}
	} else {
		ahkStatusBarItem.text = localize('ahk2.set.interpreter')
		ahkStatusBarItem.tooltip = undefined, ahkPath = '';
	}
}

/**
 * Resolves a given path to an absolute path.
 * Returns empty string if the file does not exist or has no access rights.
 */
function resolvePath(path: string | undefined, workspace?: string, resolveSymbolicLink = true): string {
	if (!path)
		return '';
	const paths: string[] = [];
	// If the path does not contain a colon, resolve it relative to the workspace
	if (!path.includes(':'))
		paths.push(resolve(workspace ?? '', path));
	// If there are no slashes or backslashes in the path and the platform is Windows
	if (!/[\\/]/.test(path) && isWindows)
		paths.push(execSync(`where ${path}`, { encoding: 'utf-8' }).trim());
	paths.push(path);
	for (let path of paths) {
		if (!path) continue;
		try {
			if (lstatSync(path).isSymbolicLink() && resolveSymbolicLink)
				path = resolve(path, '..', readlinkSync(path));
			return path;
		} catch { }
	}
	return '';
}

/**
 * Returns whether the given path exists.
 * Only returns false if lstatSync give an ENOENT error.
 */
function existsSync(path: string): boolean {
	try {
		lstatSync(path);
	} catch (err) {
		if ((err as { code: string })?.code === 'ENOENT')
			return false;
	}
	return true;
}

/** Returns lstatSync on the file, resolving the symbolic link if it exists. */
function statSync(path: string) {
	const st = lstatSync(path);
	if (st.isSymbolicLink())
		return lstatSync(resolve(path, '..', readlinkSync(path)));
	return st;
}

function loadLocalize(nls: string) {
	let s = `${nls}.${env.language}.json`;
	if (!existsSync(s)) {
		if (!env.language.startsWith('zh-') || !existsSync(s = `${nls}.zh-cn.json`))
			return;
	}
	try {
		const obj = JSON.parse(readFileSync(s, { encoding: 'utf8' }));
		for (const key of Object.keys(loadedCollection) as Array<keyof typeof loadedCollection>)
			if ((s = obj[key]))
				loadedCollection[key] = s;
	} catch { }
}

function localize(key: keyof typeof loadedCollection, ...args: string[]) {
	const val = loadedCollection[key];
	if (args.length)
		return format(val, ...args);
	return val;
}

function format(message: string, ...args: string[]): string {
	return message.replace(/\{(\d+)\}/g, (...m) => {
		const i = parseInt(m[1]);
		if (i < args.length)
			return args[i];
		return ' ';
	});
}
