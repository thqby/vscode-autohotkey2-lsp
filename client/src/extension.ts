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
import { createServer, Socket } from 'net';
import { lstatSync, readlinkSync } from 'fs';
import { opendir, readFile } from 'fs/promises';
import { ChildProcess, execSync, spawn, SpawnOptionsWithoutStdio } from 'child_process';

const ahkconfig = workspace.getConfiguration('AutoHotkey2');
const ahkprocesses = new Map<number, ChildProcess & { path?: string }>();
const id_has_register: string[] = [], isWindows = process.platform === 'win32';
const textdecoders = [new TextDecoder('utf8', { fatal: true }), new TextDecoder('utf-16le', { fatal: true })];
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

let ahkpath_cur: string = ahkconfig.InterpreterPath;
let client: LanguageClient, outputchannel: OutputChannel, ahkStatusBarItem: StatusBarItem;
let extlist: string[] = [], debugexts: Record<string, string> = {}, langs: string[] = [];

export async function activate(context: ExtensionContext) {
	/** Absolute path to `server.js` */
	const serverModule = context.asAbsolutePath(`server/${process.env.DEBUG ? 'out' : 'dist'}/server.js`);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: { execArgv: ['--nolazy', '--inspect=6009'] }
		}
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const request_handlers: Record<string, any> = {
		'executeCommand': (params: string[]) => commands.executeCommand(params.shift() as string, ...params),
		'getEditorLocation': () => {
			const editor = window.activeTextEditor;
			if (!editor) return;
			const uri = editor.document.uri.toString(), position = editor.selection.end;
			return { uri, position };
		},
		'insertSnippet': async (params: [string, Range?]) => {
			const editor = window.activeTextEditor;
			if (!editor) return;
			if (params[1]) {
				const { start, end } = params[1];
				await editor.insertSnippet(new SnippetString(params[0]), new Range(start.line, start.character, end.line, end.character));
			} else
				editor.insertSnippet(new SnippetString(params[0]));
		},
		'setTextDocumentLanguage': async (params: [string, string?]) => {
			const lang = params[1] || 'ahk';
			if (!langs.includes(lang)) {
				window.showErrorMessage(`Unknown language id: ${lang}`);
				return;
			}
			const uri = params[0], it = workspace.textDocuments.find(it => it.uri.toString() === uri);
			it && languages.setTextDocumentLanguage(it, lang);
		},
		'updateStatusBar': async (params: [string, string]) => {
			const uri = window.activeTextEditor?.document.uri;
			const ws = uri ? workspace.getWorkspaceFolder(uri)?.uri.fsPath : undefined;
			if ((ahkpath_cur = params[0]).toLowerCase().endsWith('.exe')) {
				ahkStatusBarItem.tooltip = resolvePath(ahkpath_cur, ws, false);
				ahkStatusBarItem.text = params[1] || localize('ahk2.unknownversion');
			} else {
				ahkStatusBarItem.text = localize('ahk2.set.interpreter');
				ahkStatusBarItem.tooltip = undefined, ahkpath_cur = '';
			}
		}
	};

	// Options to control the language client
	const fsw = workspace.createFileSystemWatcher('**/*.{ahk}');
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ language: 'ahk2' }],
		markdown: { isTrusted: true, supportHtml: true },
		outputChannel: outputchannel = window.createOutputChannel('AutoHotkey2', '~ahk2-output'),
		outputChannelName: 'AutoHotkey2',
		synchronize: { fileEvents: fsw },
		initializationOptions: {
			commands: Object.keys(request_handlers),
			GlobalStorage: context.globalStorageUri.fsPath,
			...ahkconfig
		},
	};

	loadlocalize(context.extensionPath + '/package.nls');
	client = new LanguageClient('AutoHotkey2', 'AutoHotkey2', serverOptions, clientOptions);
	Object.entries(request_handlers).forEach(handler => client.onRequest(...handler));
	await client.start();

	updateExtensionsInfo();
	textdecoders.push(new TextDecoder(env.language.startsWith('zh-') ? 'gbk' : 'windows-1252'));
	commands.executeCommand('setContext', 'ahk2:isRunning', false);
	ahkStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 75);
	ahkStatusBarItem.command = 'ahk2.set.interpreter';
	ahkStatusBarItem.text = localize('ahk2.set.interpreter');
	for (const it of [
		{ text: '$(folder)syntaxes', command: { title: localize('ahk2.select'), command: 'ahk2.select.syntaxes' } },
	])
		context.subscriptions.push(Object.assign(languages.createLanguageStatusItem(it.command.command, { language: 'ahk2' }), it));
	context.subscriptions.push(
		ahkStatusBarItem, outputchannel, fsw,
		extensions.onDidChange(updateExtensionsInfo),
		commands.registerTextEditorCommand('ahk2.help', quickHelp),
		commands.registerTextEditorCommand('ahk2.compile', compileScript),
		commands.registerTextEditorCommand('ahk2.run', textEditor => runScript(textEditor)),
		commands.registerTextEditorCommand('ahk2.run.selection', textEditor => runScript(textEditor, true)),
		commands.registerCommand('ahk2.stop', stopRunningScript),
		commands.registerCommand('ahk2.debug.file', () => beginDebug('f')),
		commands.registerCommand('ahk2.debug.configs', () => beginDebug('c')),
		commands.registerCommand('ahk2.debug.params', () => beginDebug('p')),
		commands.registerCommand('ahk2.debug.attach', () => beginDebug('a')),
		commands.registerTextEditorCommand('ahk2.switch', textEditor => {
			const doc = textEditor.document;
			languages.setTextDocumentLanguage(doc, doc.languageId === 'ahk2' ? 'ahk' : 'ahk2');
		}),
		window.onDidChangeActiveTextEditor(e => e?.document.languageId === 'ahk2'
			? ahkStatusBarItem.show() : ahkStatusBarItem.hide()),
		commands.registerCommand('ahk2.select.syntaxes', selectSyntaxes),
		commands.registerCommand('ahk2.set.interpreter', setInterpreter),
		commands.registerTextEditorCommand('ahk2.update.versioninfo', async textEditor => {
			const infos: { content: string, uri: string, range: Range, single: boolean }[] | null = await client.sendRequest('getVersionInfo', textEditor.document.uri.toString());
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
		commands.registerTextEditorCommand('ahk2.extract.symbols', textEditor => {
			const doc = textEditor.document;
			if (doc.languageId !== 'ahk2')
				return;
			client.sendRequest('exportSymbols', doc.uri.toString())
				.then(result => workspace.openTextDocument({
					language: 'json', content: JSON.stringify(result, undefined, 2)
				}).then(d => window.showTextDocument(d, 2)));
		}),
		workspace.registerTextDocumentContentProvider('ahkres', {
			provideTextDocumentContent(uri, token) {
				if (token.isCancellationRequested)
					return;
				return client.sendRequest('getContent', uri.toString()).then(content => {
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
	);
	if (window.activeTextEditor?.document.languageId === 'ahk2')
		ahkStatusBarItem.show();
	return client;

	function updateExtensionsInfo() {
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
							const match_config = getDebugConfigs()?.filter(it =>
								Object.entries(it).every(([k, v]) => equal(v, config[k]))
							)?.sort((a, b) => Object.keys(a).length - Object.keys(b).length).pop();
							const def = { ...getConfig('DebugConfiguration') as Partial<DebugConfiguration> };
							delete def.request, delete def.type;
							Object.assign(config, def, match_config);
							if (match_config?.type === 'autohotkey')
								runtime = match_config.runtime_v2;
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
							config.runtime = resolvePath(ahkpath_cur, folder?.uri.fsPath);
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
}

export function deactivate() {
	return client?.stop();
}

function output_append(buf: Buffer) {
	outputchannel.append(decode(buf));
	function decode(buf: Buffer) {
		for (const td of textdecoders) {
			try {
				return td.decode(buf);
			} catch { }
		}
		return buf.toString();
	}
}

async function runScript(textEditor: TextEditor, selection = false) {
	const executePath = resolvePath(ahkpath_cur, workspace.getWorkspaceFolder(textEditor.document.uri)?.uri.fsPath);
	if (!executePath) {
		const s = ahkpath_cur || 'AutoHotkey.exe';
		window.showErrorMessage(localize('ahk2.filenotexist', s), localize('ahk2.set.interpreter'))
			.then(r => r ? setInterpreter() : undefined);
		return;
	}
	let selecttext = '', path = '*', command = `"${executePath}" /ErrorStdOut=utf-8 `;
	if (getConfig('AutomaticallyOpenOutputView'))
		outputchannel.show(true);
	if (!ahkprocesses.size)
		outputchannel.clear();
	if (selection)
		selecttext = textEditor.selections.map(textEditor.document.getText).join('\n');
	else if (textEditor.document.isUntitled || textEditor.document.uri.scheme !== 'file')
		selecttext = textEditor.document.getText();
	executePath.replace(/^(.+[\\/])AutoHotkeyUX\.exe$/i, (...m) => {
		const lc = m[1] + 'launcher.ahk';
		if (existsSync(lc))
			command = `"${executePath}" "${lc}" `;
		return '';
	});
	const opt: SpawnOptionsWithoutStdio = {
		cwd: resolve(textEditor.document.fileName, '..'),
		shell: true
	};
	const uiAccess = ahkStatusBarItem.text.endsWith('[UIAccess]');
	if (uiAccess) {
		const pipe = randomPipeName('ahk-ipc');
		const redirect = `(()=>(std:=FileOpen('${pipe}','w'),DllCall('SetStdHandle','uint',-11,'ptr',std.Handle),DllCall('SetStdHandle','uint',-12,'ptr',std.Handle),OnExit((*)=>!std)))()`;
		createPipeReadStream(pipe).then(out => out.on('data', output_append));
		command += `/include ${createTempFile(redirect, 'ahk-stdout-redirect')} `;
		if (selecttext)
			path = createTempFile(selecttext);
	} else opt.env = Object.fromEntries(Object.entries(process.env)
		.filter(it => !/^(CHROME|ELECTRON_RUN|FPS_BROWSER|VSCODE)_/.test(it[0])));
	if (selecttext)
		command += path;
	else {
		if (textEditor.document.isUntitled)
			return;
		await commands.executeCommand('workbench.action.files.save');
		path = textEditor.document.fileName;
		command += `"${path}"`;
	}
	const startTime = Date.now();
	const cp: ChildProcess & { path?: string } = spawn(command, opt);
	if (cp.pid) {
		if (path === '*')
			cp.stdin?.write(selecttext), cp.stdin?.end();
		outputchannel.appendLine(`[Running] [pid:${cp.pid}] ${command}`);
		ahkprocesses.set(cp.pid, cp);
		cp.path = path;
		commands.executeCommand('setContext', 'ahk2:isRunning', true);
		if (!uiAccess)
			cp.stderr?.on('data', output_append), cp.stdout?.on('data', output_append);
		cp.on('error', (error) => {
			outputchannel.appendLine(JSON.stringify(error));
			ahkprocesses.delete(cp.pid!);
		});
		cp.on('exit', (code) => {
			outputchannel.appendLine(`[Done] [pid:${cp.pid}] exited with code=${code} in ${(Date.now() - startTime) / 1000} seconds`);
			ahkprocesses.delete(cp.pid!);
			if (!ahkprocesses.size)
				commands.executeCommand('setContext', 'ahk2:isRunning', false);
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
		execSync(`taskkill /pid ${pid} /T /F`);
		ahkprocesses.delete(pid);
	}
}

function getFileMtime(path: string) {
	try {
		return lstatSync(path).mtimeMs;
	} catch { }
}

async function compileScript(textEditor: TextEditor) {
	let cmd = '', cmdop = workspace.getConfiguration('AutoHotkey2').CompilerCMD as string;
	const ws = workspace.getWorkspaceFolder(textEditor.document.uri)?.uri.fsPath ?? '';
	const compilePath = findFile(['Compiler\\Ahk2Exe.exe', '..\\Compiler\\Ahk2Exe.exe'], ws);
	const executePath = resolvePath(ahkpath_cur, ws);
	if (!compilePath) {
		window.showErrorMessage(localize('ahk2.filenotexist', 'Ahk2Exe.exe'));
		return;
	}
	if (!executePath) {
		const s = ahkpath_cur || 'AutoHotkey.exe';
		window.showErrorMessage(localize('ahk2.filenotexist', s));
		return;
	}
	if (textEditor.document.isUntitled || !textEditor.document.uri.toString().startsWith('file:///')) {
		window.showErrorMessage(localize('ahk2.savebeforecompilation'));
		return;
	}
	await commands.executeCommand('workbench.action.files.save');
	const currentPath = textEditor.document.uri.fsPath;
	const exePath = currentPath.replace(/\.\w+$/, '.exe');
	const prev_mtime = getFileMtime(exePath);
	cmdop = cmdop.replace(/(['"]?)\$\{execPath\}\1/gi, `"${executePath}"`);
	if (cmdop.match(/\bahk2exe\w*\.exe/i)) {
		cmd = cmdop + ' /in ' + currentPath;
		if (!cmd.toLowerCase().includes(' /out '))
			cmd += '/out "' + exePath + '"';
	} else {
		cmd = `"${compilePath}" ${cmdop} /in "${currentPath}" `;
		if (!cmdop.toLowerCase().includes(' /out '))
			cmd += '/out "' + exePath + '"';
	}
	const cp = spawn(cmd, { cwd: resolve(currentPath, '..'), shell: true });
	if (cp.pid) {
		if ((cmd.toLowerCase() + ' ').includes(' /gui '))
			return;
		if (getConfig('AutomaticallyOpenOutputView'))
			outputchannel.show(true);
		outputchannel.clear();
		cp.on('exit', () => {
			if (prev_mtime !== (getFileMtime(exePath) ?? prev_mtime))
				window.showInformationMessage(localize('ahk2.compiledsuccessfully'));
			else
				window.showErrorMessage(localize('ahk2.compiledfailed'));
		});
		cp.stderr?.on('data', output_append);
		cp.stdout?.on('data', output_append);
	} else
		window.showErrorMessage(localize('ahk2.compiledfailed'));
}

async function quickHelp(textEditor: TextEditor) {
	const document = textEditor.document, position = textEditor.selection.active;
	const range = document.getWordRangeAtPosition(position), line = position.line;
	const helpPath = findFile(['AutoHotkey.chm', '../v2/AutoHotkey.chm'], workspace.getWorkspaceFolder(textEditor.document.uri)?.uri.fsPath ?? '');
	let word = '';
	if (range && (word = document.getText(range)).match(/^[a-z_]+$/i)) {
		if (range.start.character > 0 && document.getText(new Range(line, range.start.character - 1, line, range.start.character)) === '#')
			word = '#' + word;
	}
	if (!helpPath) {
		window.showErrorMessage(localize('ahk2.filenotexist', 'AutoHotkey.chm'));
		return;
	}
	const executePath = resolvePath(ahkpath_cur, workspace.getWorkspaceFolder(textEditor.document.uri)?.uri.fsPath);
	if (!executePath) {
		const s = ahkpath_cur || 'AutoHotkey.exe';
		window.showErrorMessage(localize('ahk2.filenotexist', s));
		return;
	}
	const script = `
#NoTrayIcon
#DllLoad oleacc.dll
chm_hwnd := 0, chm_path := '${helpPath}', DetectHiddenWindows(true), !(WinGetExStyle(top := WinExist('A')) & 8) && (top := 0)
for hwnd in WinGetList('AutoHotkey ahk_class HH Parent')
	for item in ComObjGet('winmgmts:').ExecQuery('SELECT CommandLine FROM Win32_Process WHERE ProcessID=' WinGetPID(hwnd))
		if InStr(item.CommandLine, chm_path) {
			chm_hwnd := WinExist(hwnd)
			break 2
		}
if top && top != chm_hwnd
	WinSetAlwaysOnTop(0, top)
if !chm_hwnd
	Run(chm_path, , , &pid), chm_hwnd := WinWait('AutoHotkey ahk_class HH Parent ahk_pid' pid)
WinShow(), WinActivate(), WinWaitActive(), ctl := 0, endt := A_TickCount + 3000
while (!ctl && A_TickCount < endt)
	try ctl := ControlGetHwnd('Internet Explorer_Server1')
NumPut('int64', 0x11CF3C3D618736E0, 'int64', 0x719B3800AA000C81, IID_IAccessible := Buffer(16))
if ${!!word} && !DllCall('oleacc\\AccessibleObjectFromWindow', 'ptr', ctl, 'uint', 0, 'ptr', IID_IAccessible, 'ptr*', IAccessible := ComValue(13, 0)) {
	IServiceProvider := ComObjQuery(IAccessible, IID_IServiceProvider := '{6D5140C1-7436-11CE-8034-00AA006009FA}')
	NumPut('int64', 0x11D026CB332C4427, 'int64', 0x1901D94FC00083B4, IID_IHTMLWindow2 := Buffer(16))
	ComCall(3, IServiceProvider, 'ptr', IID_IHTMLWindow2, 'ptr', IID_IHTMLWindow2, 'ptr*', IHTMLWindow2 := ComValue(9, 0))
	IHTMLWindow2.execScript('
	(
		document.querySelector('#head > div > div.h-tabs > ul > li:nth-child(3) > button').click()
		searchinput = document.querySelector('#left > div.search > div.input > input[type=search]')
		keyevent = document.createEvent('KeyboardEvent')
		keyevent.initKeyboardEvent('keyup', false, true, document.defaultView, 13, null, false, false, false, false)
		searchinput.value = '${word}'
		searchinput.dispatchEvent(keyevent)
		Object.defineProperties(keyevent, { type: { get: function() { return 'keydown' } }, which: { get: function() { return 13 } } })
		searchinput.dispatchEvent(keyevent)
	)')
}`;
	const isUIAccess = ahkStatusBarItem.text.endsWith('[UIAccess]');
	const cmd = `"${executePath}" /ErrorStdOut=utf-8 ${isUIAccess ? createTempFile(script) : '*'}`;
	const cp = spawn(cmd, { shell: true });
	if (!isUIAccess)
		cp.stdin.write(script), cp.stdin.end();
}

function getConfig<T>(section: string) {
	return workspace.getConfiguration('AutoHotkey2').get(section) as T;
}

function getDebugConfigs() {
	const allconfigs = workspace.getConfiguration('launch').inspect<DebugConfiguration[]>('configurations');
	return allconfigs && [
		...allconfigs.workspaceFolderValue ?? [],
		...allconfigs.workspaceValue ?? [],
		...allconfigs.globalValue ?? []].filter(it => it.type in debugexts);
}

async function beginDebug(type: string) {
	let extname: string | undefined;
	const editor = window.activeTextEditor;
	let config = { ...getConfig('DebugConfiguration'), request: 'launch', __ahk2debug: true } as DebugConfiguration;
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
		config.type = Object.entries(debugexts).find(([, v]) => v === extname)![0];
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
				config.args = args;
			}
		} else config.request = 'attach';
	} else if (type === 'c') {
		const configs = getDebugConfigs();
		if (configs?.length) {
			const pick = window.createQuickPick();
			pick.items = configs.map(it => ({ label: it.name, data: it }));
			pick.show();
			const it = await new Promise(resolve => {
				pick.onDidAccept(() => resolve(
					(pick.selectedItems[0] as unknown as { data: DebugConfiguration })?.data));
				pick.onDidHide(() => resolve(undefined));
			});
			pick.dispose();
			if (!it)
				return;
			config = it as DebugConfiguration;
		}
	} else config.program = '${file}';
	config.type ||= Object.keys(debugexts).sort().pop()!;
	config.name ||= `AutoHotkey ${config.request === 'attach' ? 'Attach' : 'Debug'}`;
	debug.startDebugging(editor && workspace.getWorkspaceFolder(editor.document.uri), config);
}

async function setInterpreter() {
	// eslint-disable-next-line prefer-const
	let index = -1, { path: ahkpath, from } = getInterpreterPath();
	const list: QuickPickItem[] = [], _ = (ahkpath = resolvePath(ahkpath_cur || ahkpath, undefined, false)).toLowerCase();
	const pick = window.createQuickPick();
	const root = 'C:\\Program Files\\AutoHotkey\\';
	let it: QuickPickItem, active: QuickPickItem | undefined, sel: QuickPickItem = { label: '' };
	list.push({ alwaysShow: true, label: localize('ahk2.enterahkpath') + '...', detail: localize('ahk2.enterorfind') });
	it = { label: localize('ahk2.find'), detail: localize('ahk2.browse') };
	if (ahkpath)
		await addpath(resolve(ahkpath, '..'), _.includes('autohotkey') ? 20 : 5);
	if (!_.includes(root.toLowerCase()))
		await addpath(root, 20);
	index = list.map(it => it.detail?.toLowerCase()).indexOf((ahkpath_cur || ahkpath).toLowerCase());
	if (index !== -1)
		active = list[index];

	pick.matchOnDetail = true, pick.items = list;
	pick.title = localize('ahk2.set.interpreter');
	if (active)
		pick.activeItems = [active];
	pick.placeholder = localize('ahk2.current', ahkpath_cur);
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
		if (!sel.detail)
			return;
		ahkconfig.update('InterpreterPath', sel.detail, from);
		client.sendNotification('resetInterpreterPath', sel.detail);
	});
	pick.onDidHide(() => pick.dispose());

	async function addpath(dirpath: string, max: number) {
		const paths: string[] = [];
		try {
			const dirs = [await opendir(dirpath)];
			for (const dir of dirs) {
				dirpath = dir.path;
				for await (const ent of dir) {
					const path = resolve(dirpath, ent.name);
					if (ent.isDirectory()) {
						if (dir === dirs[0])
							try { dirs.push(await opendir(path)); } catch { }
					} else if (path.toLowerCase().endsWith('.exe') &&
						(/(ahk|autohotkey)/i.test(path) || paths.length < max))
						paths.push(path);
				}
			}
		} catch { }
		if (!paths.length) return;
		(await getAHKversion(paths)).forEach((label, i) =>
			/\bautohotkey.*?2\./i.test(label) && list.push({ label, detail: paths[i] }));
	}
}

async function selectSyntaxes() {
	const path = (await window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true }))?.[0].fsPath;
	const t = ahkconfig.inspect('Syntaxes') ?? { key: '' };
	let f = ConfigurationTarget.WorkspaceFolder;
	const v = (t.workspaceFolderValue ??
		(f = ConfigurationTarget.Workspace, t.workspaceValue) ??
		(f = ConfigurationTarget.Global, t.globalValue) ?? '') as string;
	if (path === undefined || v.toLowerCase() === path.toLowerCase())
		return;
	ahkconfig.update('Syntaxes', path || undefined, f);
}

function getAHKversion(paths: string[]): Thenable<string[]> {
	return client.sendRequest('getAHKversion', paths.map(p => resolvePath(p, undefined, true) || p));
}

function getInterpreterPath() {
	const t = ahkconfig.inspect<string>('InterpreterPath') ?? { key: '' };
	let from = ConfigurationTarget.WorkspaceFolder;
	const path = t.workspaceFolderValue ??
		(from = ConfigurationTarget.Workspace, t.workspaceValue) ??
		(from = ConfigurationTarget.Global, t.globalValue ?? t.defaultValue ?? '');
	return { from, path };
}

function findFile(files: string[], workspace: string) {
	let s: string;
	const paths: string[] = [];
	const t = ahkconfig.inspect<string>('InterpreterPath');
	if (add(ahkpath_cur), t) {
		add(t.workspaceFolderValue);
		add(t.workspaceValue);
		add(t.globalValue);
		add(t.defaultValue);
	}
	for (const path of paths)
		for (const file of files)
			if (existsSync(s = resolve(path, '..', file)))
				return s;
	return '';

	function add(path?: string) {
		path = resolvePath(path, workspace);
		if (!path) return;
		path = path.toLowerCase();
		if (!paths.includes(path))
			paths.push(path);
	}
}

/**
 * Resolves a given path to an absolute path.
 * Returns empty string if the file does not exist or has no access rights.
 */
function resolvePath(path?: string, workspace?: string, resolveSymbolicLink = true): string {
	if (!path)
		return '';
	const paths: string[] = [];
	path = path.replace(/%(\w+)%/g, (s0, s1) => process.env[s1] ?? s0);
	if (!path.includes(':'))
		paths.push(resolve(workspace ?? '', path));
	if (!/[\\/]/.test(path) && isWindows)
		try { paths.push(execSync(`chcp 65001 > nul && where ${path}`, { encoding: 'utf-8' }).trim()); } catch { }
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

async function loadlocalize(nls: string) {
	let s = `${nls}.${env.language}.json`;
	if (!existsSync(s)) {
		if (!env.language.startsWith('zh-') || !existsSync(s = `${nls}.zh-cn.json`))
			return;
	}
	try {
		const obj = JSON.parse(await readFile(s, { encoding: 'utf8' }));
		for (const key of Object.keys(loadedCollection) as Array<keyof typeof loadedCollection>)
			if ((s = obj[key]))
				loadedCollection[key] = s;
	} catch { }
}

function localize(key: keyof typeof loadedCollection, ...args: unknown[]) {
	const val = loadedCollection[key];
	if (args.length)
		return format(val, ...args as string[]);
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

function randomPipeName(prefix: string) {
	return `\\\\.\\pipe\\${prefix}-${Buffer.from(Uint16Array.from([process.pid, Date.now()]).buffer).toString('hex')}`;;
}

function createTempFile(str: string, prefix = 'ahk-script') {
	const path = randomPipeName(prefix);
	const server = createServer((socket) => {
		if (socket.write(str))
			server.close();
		else socket.on('error', () => { });
		socket.destroySoon();
	}).listen(path);
	setTimeout(() => server.close(), 2000);
	return path;
}

function createPipeReadStream(path: string): Promise<Socket> {
	return new Promise((resolve) => {
		const server = createServer((socket) => {
			server.close();
			socket.setEncoding('utf-8');
			socket.on('error', () => socket.destroy());
			resolve(socket);
		}).listen(path);
		setTimeout(() => server.close(), 2000);
	});
}