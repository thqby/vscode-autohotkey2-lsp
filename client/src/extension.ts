/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

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
import { ChildProcess, exec, execSync, spawn } from 'child_process';
import { readdirSync, lstatSync, readlinkSync, unlinkSync, writeFileSync } from 'fs';

let client: LanguageClient, outputchannel: OutputChannel, ahkStatusBarItem: StatusBarItem;
let ahkprocesses = new Map<number, ChildProcess>();
let ahkconfig = workspace.getConfiguration('AutoHotkey2');
let ahkpath_cur: string = ahkconfig.InterpreterPath, server_is_ready = false, zhcn = false;
const textdecoders: TextDecoder[] = [new TextDecoder('utf8', { fatal: true }), new TextDecoder('utf-16le', { fatal: true })];
const isWindows = process.platform === 'win32';

export async function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule: string, serverPath = process.env.VSCODE_AHK_SERVER_PATH;
	if (serverPath) serverModule = context.asAbsolutePath(`server/${serverPath}/server.js`);
	else serverModule = context.asAbsolutePath('server/' + __dirname.replace(/^.*[\\/]/, '') + '/server.js');

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: { kind: TransportKind.socket, port: 1219 },
			options: { execArgv: ['--nolazy', '--inspect=6009'] }
		}
	};

	const request_handlers: { [cmd: string]: any } = {
		'ahk2.executeCommand': (params: any[]) => commands.executeCommand(params.shift(), ...params),
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
			if (!langs.includes(lang)) {
				window.showErrorMessage(`Unknown language id: ${lang}`);
				return;
			}
			let uri = params[0], it = workspace.textDocuments.find(it => it.uri.toString() === uri);
			it && languages.setTextDocumentLanguage(it, lang);
		},
		'ahk2.updateStatusBar': async (params: [string]) => {
			ahkpath_cur = params[0];
			onDidChangegetInterpreter();
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		documentSelector: [{ language: 'ahk2' }],
		markdown: { isTrusted: true, supportHtml: true },
		outputChannel: outputchannel = window.createOutputChannel('AutoHotkey2', '~ahk2-output'),
		outputChannelName: 'AutoHotkey2',
		initializationOptions: {
			commands: Object.keys(request_handlers),
			GlobalStorage: context.globalStorageUri.fsPath,
			...ahkconfig
		}
	};
	if (ahkconfig.FormatOptions?.one_true_brace !== undefined)
		window.showWarningMessage('configuration "AutoHotkey2.FormatOptions.one_true_brace" is deprecated!\nplease use "AutoHotkey2.FormatOptions.brace_style"');

	// Create the language client and start the client.
	client = new LanguageClient('AutoHotkey2', 'AutoHotkey2', serverOptions, clientOptions);
	zhcn = env.language.startsWith('zh-');
	textdecoders.push(new TextDecoder(zhcn ? 'gbk' : 'windows-1252'));

	// Start the client. This will also launch the server
	client.start().then(() => {
		Object.entries(request_handlers).forEach(handler => client.onRequest(...handler));
		onDidChangegetInterpreter();
		if (window.activeTextEditor?.document.languageId === 'ahk2')
			ahkStatusBarItem.show();
		server_is_ready = true;
	});

	let extlist: string[], debugexts: { [type: string]: string }, langs: string[] = [];
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
	}
	update_extensions_info();

	commands.executeCommand('setContext', 'ahk2:isRunning', false);
	ahkStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 75);
	ahkStatusBarItem.command = 'ahk2.setinterpreter';
	const ahkLanguageStatusItem = languages.createLanguageStatusItem('AutoHotkey2', { language: 'ahk2' });
	ahkLanguageStatusItem.text = '$(folder)syntaxes';
	ahkLanguageStatusItem.command = { title: 'Select Syntaxes', command: 'ahk2.selectsyntaxes' };
	context.subscriptions.push(
		ahkStatusBarItem, ahkLanguageStatusItem, outputchannel,
		extensions.onDidChange(update_extensions_info),
		commands.registerTextEditorCommand('ahk2.help', quickHelp),
		commands.registerTextEditorCommand('ahk2.compile', compileScript),
		commands.registerTextEditorCommand('ahk2.run', textEditor => runScript(textEditor)),
		commands.registerTextEditorCommand('ahk2.selection.run', textEditor => runScript(textEditor, true)),
		commands.registerCommand('ahk2.stop', stopRunningScript),
		commands.registerCommand('ahk2.setinterpreter', setInterpreter),
		commands.registerCommand('ahk2.debug', () => beginDebug(extlist, debugexts)),
		commands.registerCommand('ahk2.debug.params', () => beginDebug(extlist, debugexts, true)),
		commands.registerCommand('ahk2.debug.attach', () => beginDebug(extlist, debugexts, false, true)),
		commands.registerCommand('ahk2.selectsyntaxes', selectSyntaxes),
		commands.registerTextEditorCommand('ahk2.updateversioninfo', async textEditor => {
			if (!server_is_ready)
				return;
			let info: { content: string, uri: string, range: Range } | null = await client.sendRequest('ahk2.getVersionInfo', textEditor.document.uri.toString());
			if (!info) {
				await textEditor.insertSnippet(new SnippetString([
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
					(ver = await window.showInputBox({ prompt: zhcn ? '输入版本信息' : 'Enter version info', value: content.match(/(?<=^[\s*]*@version[:\s]\s*)(\S*)/im)?.[1] })))
					content = content.replace(/(?<=^\s*[;*]?\s*@version[:\s]\s*)(\S*)/im, ver);
				if (content !== info.content) {
					let ed = new WorkspaceEdit();
					ed.replace(Uri.parse(info.uri), info.range, content);
					workspace.applyEdit(ed);
				}
			}
		}),
		commands.registerTextEditorCommand('ahk2.switch', textEditor => {
			const doc = textEditor.document;
			languages.setTextDocumentLanguage(doc, doc.languageId === 'ahk2' ? 'ahk' : 'ahk2');
		}),
		commands.registerTextEditorCommand('ahk2.export.symbols', textEditor => {
			const doc = textEditor.document;
			if (doc.languageId !== 'ahk2')
				return;
			client.sendRequest('ahk2.exportSymbols', doc.uri.toString())
				.then(result => workspace.openTextDocument({
					language: 'json', content: JSON.stringify(result, undefined, 2)
				}).then(d => window.showTextDocument(d, 2)));
		}),
		workspace.registerTextDocumentContentProvider('ahkres', {
			provideTextDocumentContent(uri, token) {
				if (token.isCancellationRequested)
					return;
				return client.sendRequest('ahk2.getContent', uri.toString()).then(content => {
					setTimeout(() => {
						let it = workspace.textDocuments.find(it => it.uri.scheme === 'ahkres' && it.uri.path === uri.path);
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
}

export function deactivate() {
	return client?.stop();
}

function decode(buf: Buffer) {
	for (let td of textdecoders) {
		try {
			return td.decode(buf);
		} catch { };
	}
	return buf.toString();
}

function runScript(textEditor: TextEditor, selection = false) {
	let executePath = resolvePath(ahkpath_cur, workspace.getWorkspaceFolder(textEditor.document.uri)?.uri.fsPath);
	if (!executePath) {
		let s = ahkpath_cur || 'AutoHotkey.exe';
		window.showErrorMessage(zhcn ? `"${s}"未找到!` : `"${s}" not find!`, 'Select Interpreter')
			.then(r => r && setInterpreter());
		return;
	}
	let selecttext = '', path = '*', command = `"${executePath}" /ErrorStdOut=utf-8 `;
	let startTime: Date;
	outputchannel.show(true);
	if (!ahkprocesses.size)
		outputchannel.clear();
	if (selection)
		selecttext = textEditor.document.getText(textEditor.selection);
	else if (textEditor.document.isUntitled || !textEditor.document.uri.toString().startsWith('file:///'))
		selecttext = textEditor.document.getText();
	executePath.replace(/^(.+[\\/])AutoHotkeyUX\.exe$/i, (...m) => {
		let lc = m[1] + 'launcher.ahk';
		if (existsSync(lc))
			command = `"${executePath}" "${lc}" `;
		return '';
	})
	let process: ChildProcess;
	if (selecttext !== '') {
		if (ahkStatusBarItem.text.endsWith('[UIAccess]')) {
			path = resolve(__dirname, 'temp.ahk');
			writeFileSync(path, selecttext);
			command += `"${path}"`, startTime = new Date();
			process = spawn(command, { cwd: `${resolve(textEditor.document.fileName, '..')}`, shell: true });
			unlinkSync(path);
		} else {
			command += path, startTime = new Date();
			process = spawn(command, { cwd: `${resolve(textEditor.document.fileName, '..')}`, shell: true });
			process.stdin?.write(selecttext), process.stdin?.end();
		}
	} else {
		if (textEditor.document.isUntitled)
			return;
		commands.executeCommand('workbench.action.files.save');
		path = textEditor.document.fileName, command += `"${path}"`, startTime = new Date();
		process = spawn(command, { cwd: resolve(path, '..'), shell: true });
	}
	if (process.pid) {
		outputchannel.appendLine(`[Running] [pid:${process.pid}] ${command}`);
		ahkprocesses.set(process.pid, process);
		(process as any).path = path;
		commands.executeCommand('setContext', 'ahk2:isRunning', true);
		process.stderr?.on('data', (data) => {
			outputchannel.appendLine(decode(data));
		});
		process.on('error', (error) => {
			outputchannel.appendLine(JSON.stringify(error));
			ahkprocesses.delete(process.pid);
		});
		process.stdout?.on('data', (data) => {
			outputchannel.appendLine(decode(data));
		});
		process.on('exit', (code) => {
			outputchannel.appendLine(`[Done] [pid:${process.pid}] exited with code=${code} in ${((new Date()).getTime() - startTime.getTime()) / 1000} seconds`);
			ahkprocesses.delete(process.pid);
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
		ahkprocesses.forEach(t => kill(t.pid));
	else {
		let pick = window.createQuickPick(), items: QuickPickItem[] = [];
		pick.title = 'Running Scripts';
		ahkprocesses.forEach(t => items.push({ label: `pid: ${t.pid}`, detail: (t as any).path }));
		pick.items = items, pick.canSelectMany = true;
		pick.onDidAccept(e => {
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

async function compileScript(textEditor: TextEditor) {
	let cmd = '', cmdop = workspace.getConfiguration('AutoHotkey2').CompilerCMD as string;
	let ws = workspace.getWorkspaceFolder(textEditor.document.uri)?.uri.fsPath ?? '';
	let compilePath = findfile(['Compiler\\Ahk2Exe.exe', '..\\Compiler\\Ahk2Exe.exe'], ws);
	let executePath = resolvePath(ahkpath_cur, ws);
	if (!compilePath) {
		window.showErrorMessage(zhcn ? `"Ahk2Exe.exe"未找到!` : `"Ahk2Exe.exe" was not found!`);
		return;
	}
	if (!executePath) {
		let s = ahkpath_cur || 'AutoHotkey.exe';
		window.showErrorMessage(zhcn ? `"${s}"未找到!` : `"${s}" was not found!`);
		return;
	}
	if (textEditor.document.isUntitled) {
		window.showErrorMessage(zhcn ? '编译前请先保存脚本' : 'Please save the script before compiling');
		return;
	}
	commands.executeCommand('workbench.action.files.save');
	const currentPath = textEditor.document.uri.fsPath;
	const exePath = currentPath.replace(/\.\w+$/, '.exe');
	try {
		if (existsSync(exePath))
			unlinkSync(exePath);
	} catch (e: any) {
		window.showErrorMessage(e.message);
		return;
	}
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
	let process = exec(cmd, { cwd: resolve(currentPath, '..') });
	if (process.pid) {
		if ((cmd += ' ').toLowerCase().includes(' /gui '))
			return;
		outputchannel.show(true);
		outputchannel.clear();
		process.on('exit', () => {
			if (existsSync(exePath))
				window.showInformationMessage(zhcn ? '编译成功!' : 'Compiled successfully!');
			else
				window.showErrorMessage(zhcn ? '编译失败!' : 'Compiled failed!');
		});
		process.stderr?.on('data', (error) => outputchannel.appendLine(error));
		process.stdout?.on('data', (msg) => outputchannel.appendLine(msg));
	} else
		window.showErrorMessage(zhcn ? '编译失败!' : 'Compilation failed!');
}

async function quickHelp(textEditor: TextEditor) {
	const document = textEditor.document, position = textEditor.selection.active;
	const range = document.getWordRangeAtPosition(position), line = position.line;
	let helpPath = findfile(['AutoHotkey.chm'], workspace.getWorkspaceFolder(textEditor.document.uri)?.uri.fsPath ?? '');
	let word = '';
	if (range && (word = document.getText(range)).match(/^[a-z_]+$/i)) {
		if (range.start.character > 0 && document.getText(new Range(line, range.start.character - 1, line, range.start.character)) === '#')
			word = '#' + word;
	}
	if (!helpPath) {
		window.showErrorMessage(zhcn ? `"AutoHotkey.chm"未找到!` : `"AutoHotkey.chm" was not found!`);
		return;
	}
	let executePath = resolvePath(ahkpath_cur, workspace.getWorkspaceFolder(textEditor.document.uri)?.uri.fsPath);
	if (!executePath) {
		let s = ahkpath_cur || 'AutoHotkey.exe';
		window.showErrorMessage(zhcn ? `"${s}"未找到!` : `"${s}" was not found!`);
		return;
	}
	let script = `
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
	if (ahkStatusBarItem.text.endsWith('[UIAccess]')) {
		let file = resolve(__dirname, 'temp.ahk');
		writeFileSync(file, script, { encoding: 'utf-8' });
		execSync(`"${executePath}" /ErrorStdOut ${file}`);
		unlinkSync(file);
	} else
		execSync(`"${executePath}" /ErrorStdOut *`, { input: script });
}

async function beginDebug(extlist: string[], debugexts: any, params = false, attach = false) {
	let editor = window.activeTextEditor;
	if (!editor && !attach) return;
	let workspaceFolder = editor && workspace.getWorkspaceFolder(editor.document.uri);
	let executePath = resolvePath(ahkpath_cur, workspaceFolder?.uri.fsPath);
	let extname: string | undefined;
	if (!executePath) {
		let s = ahkpath_cur || 'AutoHotkey.exe';
		window.showErrorMessage(zhcn ? `"${s}"未找到!` : `"${s}" was not found!`);
		return;
	}
	if (params || attach) {
		if (!extlist.includes(extname = 'zero-plusplus.vscode-autohotkey-debug')) {
			window.showErrorMessage('zero-plusplus.vscode-autohotkey-debug was not found!');
			return;
		}
	} else if (extlist.length === 0) {
		window.showErrorMessage(zhcn ? '未找到debug扩展, 请先安装debug扩展!' : 'The debug extension was not found, please install the debug extension first!');
		extname = await window.showQuickPick(['zero-plusplus.vscode-autohotkey-debug', 'helsmy.autohotkey-debug', 'mark-wiemer.vscode-autohotkey-plus-plus', 'cweijan.vscode-autohotkey-plus']);
		if (extname)
			commands.executeCommand('workbench.extensions.installExtension', extname);
		return;
	} else if (extlist.length === 1)
		extname = extlist[0];
	else {
		let def = workspace.getConfiguration('AutoHotkey2').DefaultDebugger as string;
		extname = extlist.includes(def) ? def : await window.showQuickPick(extlist);
	}
	if (extname) {
		let config: DebugConfiguration = {
			type: '',
			request: 'launch',
			name: 'AutoHotkey2 Debug',
			runtime: executePath,
			AhkExecutable: executePath,
			program: editor?.document.uri.fsPath,
			port: '9002-9100',
			useAnnounce: 'detail',
			useAutoJumpToError: true,
			useDebugDirective: true,
			usePerfTips: true
		};
		for (const t in debugexts)
			if (debugexts[t] === extname) {
				config.type = t;
				if (extname === 'zero-plusplus.vscode-autohotkey-debug')
					if (ahkStatusBarItem.text.endsWith('[UIAccess]'))
						config.useUIAVersion = true;
				if (params) {
					let input = await window.showInputBox({ prompt: zhcn ? '输入需要传递的命令行参数' : 'Enter the command line parameters that need to be passed' });
					if (input === undefined)
						return;
					if (input = input.trim()) {
						let args: string[] = [];
						input.replace(/('|")(.*?(?<!\\))\1(?=(\s|$))|(\S+)/g, (...m) => {
							args.push(m[4] || m[2]);
							return '';
						});
						config.args = args;
					}
				} else if (attach) {
					config.request = 'attach';
					config.name = 'AutoHotkey2 Attach';
					delete config.program;
				}
				break;
			}
		debug.startDebugging(workspaceFolder, config);
	}
}

async function setInterpreter() {
	let index = -1, { path: ahkpath, from } = getInterpreterPath();
	let list: QuickPickItem[] = [], it: QuickPickItem, _ = (ahkpath = resolvePath(ahkpath_cur || ahkpath, undefined, false)).toLowerCase();
	let pick = window.createQuickPick(), active: QuickPickItem | undefined, sel: QuickPickItem = { label: '' };
	if (zhcn) {
		list.push({ alwaysShow: true, label: '输入解释器路径...', detail: '输入路径或选择一个现有的解释器' });
		it = { label: '浏览...', detail: '浏览文件系统来选择一个 AutoHotkey2 解释器。' };
	} else {
		list.push({ alwaysShow: true, label: 'Enter interpreter path...', detail: 'Enter path or find an existing interpreter' });
		it = { label: 'Find...', detail: 'Browse your file system to find a AutoHotkey2 interpreter.' };
	}
	if (ahkpath)
		await addpath(resolve(ahkpath, '..'), _.includes('autohotkey') ? 20 : 5);
	if (!_.includes('c:\\program files\\autohotkey\\'))
		await addpath('C:\\Program Files\\AutoHotkey\\', 20);
	index = list.map(it => it.detail?.toLowerCase()).indexOf((ahkpath_cur || ahkpath).toLowerCase());
	if (index !== -1)
		active = list[index];

	pick.matchOnDetail = true, pick.items = list;
	pick.title = zhcn ? '选择解释器' : 'Select Interpreter';
	if (active)
		pick.activeItems = [active];
	pick.placeholder = (zhcn ? '当前: ' : 'Current: ') + ahkpath_cur;
	pick.show();
	pick.onDidAccept(async e => {
		if (pick.selectedItems[0] === list[0]) {
			pick.title = undefined, pick.activeItems = [], pick.value = '', pick.items = [it];
			pick.placeholder = zhcn ? '请输入 AutoHotkey2 解释器的路径。' : 'Enter path to a AutoHotkey2 interpreter.';
			return;
		} else if (pick.selectedItems[0] === it) {
			pick.ignoreFocusOut = true;
			let path = await window.showOpenDialog({
				defaultUri: ahkpath ? Uri.file(ahkpath) : undefined,
				filters: { Executables: ['exe'] },
				openLabel: zhcn ? '选择解释器' : 'Select Interpreter'
			});
			if (path)
				sel.detail = path[0].fsPath;
		} else {
			if (it = pick.selectedItems[0]) {
				if ((!active || it !== active) && it.detail)
					sel = it;
			} else if (pick.value.match(/\.exe/i) && existsSync(pick.value))
				sel.detail = pick.value;
		}
		pick.dispose();
		if (sel.detail) {
			ahkStatusBarItem.tooltip = ahkpath_cur = sel.detail;
			ahkconfig.update('InterpreterPath', ahkpath_cur, from);
			ahkStatusBarItem.text = sel.label ||= (await getAHKversion([ahkpath_cur]))[0];
			if (server_is_ready)
				commands.executeCommand('ahk2.resetinterpreterpath', ahkpath_cur);
		}
	});
	pick.onDidHide(e => pick.dispose());

	async function addpath(dirpath: string, max: number) {
		let paths: string[] = [];
		if (!existsSync(dirpath))
			return;
		for (let file of readdirSync(dirpath)) {
			let path = resolve(dirpath, file);
			try {
				if (statSync(path).isDirectory()) {
					for (file of readdirSync(path)) {
						let path2 = resolve(path, file);
						if (file.toLowerCase().endsWith('.exe') && !statSync(path2).isDirectory())
							paths.push(path2);
					}
				} else if (file.toLowerCase().endsWith('.exe'))
					paths.push(path);
				if (paths.length >= max)
					break;
			} catch { }
		}
		(await getAHKversion(paths)).forEach((label, i) => {
			if (label.match(/\bautohotkey.*?2\./i) && !label.endsWith('[UIAccess]'))
				list.push({ label, detail: paths[i] });
		});
	}
}

async function selectSyntaxes() {
	let path = (await window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true }))?.[0].fsPath;
	let t = ahkconfig.inspect('Syntaxes'), v = '', f = ConfigurationTarget.Global;
	if (t) {
		v = ((f = ConfigurationTarget.WorkspaceFolder, t.workspaceFolderValue) ??
			(f = ConfigurationTarget.Workspace, t.workspaceValue) ??
			(f = ConfigurationTarget.Global, t.globalValue) ?? '') as string;
	}
	if (path === undefined || v.toLowerCase() === path.toLowerCase())
		return;
	ahkconfig.update('Syntaxes', path || undefined, f);
}

function getAHKversion(paths: string[]): Thenable<string[]> {
	return client.sendRequest('ahk2.getAHKversion', paths.map(p => resolvePath(p, undefined, true) || p));
}

function getInterpreterPath() {
	let t = ahkconfig.inspect('InterpreterPath');
	let path = '';
	if (t)
		if (path = t.workspaceFolderValue as string)
			return { path, from: ConfigurationTarget.WorkspaceFolder };
		else if (path = t.workspaceValue as string)
			return { path, from: ConfigurationTarget.Workspace };
		else if (path = t.globalValue as string)
			return { path, from: ConfigurationTarget.Global };
		else path = t.defaultValue as string ?? '';
	return { path };
}

function findfile(files: string[], workspace: string) {
	let paths: string[] = [], s: string;
	let t = ahkconfig.inspect('InterpreterPath');
	if (add(ahkpath_cur), t) {
		add(t.workspaceFolderValue as string);
		add(t.workspaceValue as string);
		add(t.globalValue as string);
		add(t.defaultValue as string);
	}
	for (const path of paths)
		for (const file of files)
			if (existsSync(s = resolve(path, '..', file)))
				return s;
	return '';

	function add(path: string) {
		path = resolvePath(path, workspace);
		if (!path) return;
		path = path.toLowerCase();
		if (!paths.includes(path))
			paths.push(path);
	}
}

async function onDidChangegetInterpreter() {
	let path = ahkpath_cur;
	let uri = window.activeTextEditor?.document.uri;
	let ws = uri ? workspace.getWorkspaceFolder(uri)?.uri.fsPath : undefined;
	path = resolvePath(path, ws, false);
	if (path.toLowerCase().endsWith('.exe') && existsSync(path)) {
		if (path !== ahkStatusBarItem.tooltip) {
			ahkStatusBarItem.tooltip = path;
			ahkStatusBarItem.text = (await getAHKversion([path]))[0] || (zhcn ? '未知版本' : 'Unknown version');
		}
	} else {
		ahkStatusBarItem.text = (zhcn ? '选择AutoHotkey2解释器' : 'Select AutoHotkey2 Interpreter');
		ahkStatusBarItem.tooltip = undefined, path = '';
	}
}

function resolvePath(path: string, workspace?: string, resolveSymbolicLink = true): string {
	if (!path)
		return '';
	let paths: string[] = [];
	if (!path.includes(':'))
		paths.push(resolve(workspace ?? '', path));
	if (!/[\\/]/.test(path) && isWindows)
		paths.push(execSync(`where ${path}`, { encoding: 'utf-8' }).trim());
	paths.push(path);
	for (let path of paths) {
		if (!path) continue;
		try {
			if (lstatSync(path).isSymbolicLink() && resolveSymbolicLink)
				path = resolve(path, '..', readlinkSync(path));
			return path;
		} catch {
			continue;
		}
	}
	return '';
}

function existsSync(path: string): boolean {
	try {
		lstatSync(path);
	} catch (err) {
		if ((err as any)?.code === 'ENOENT')
			return false;
	}
	return true;
}

function statSync(path: string) {
	let st = lstatSync(path);
	if (st.isSymbolicLink())
		return lstatSync(resolve(path, '..', readlinkSync(path)));
	return st;
}