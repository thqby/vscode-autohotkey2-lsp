/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	commands,
	debug,
	extensions,
	ExtensionContext,
	workspace,
	window,
	QuickPickItem,
	Range,
	SnippetString,
	StatusBarAlignment,
	TextEditor
} from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import * as child_process from 'child_process';
import { resolve } from 'path';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { getFileProperties } from 'cfv';

let client: LanguageClient;
let outputchannel = window.createOutputChannel('AutoHotkey2');
let ahkprocess: child_process.ChildProcess | undefined;
let ahkhelp: child_process.ChildProcessWithoutNullStreams | undefined;
let ahkStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 75);
let ahkpath_cur = '', server_is_ready = false, zhcn = false;
const ahkconfig = workspace.getConfiguration('AutoHotkey2');

export async function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule: string, serverPath = process.env.VSCODE_AHK_SERVER_PATH;
	if (serverPath) serverModule = context.asAbsolutePath(`server/${serverPath}/server.js`);
	else serverModule = context.asAbsolutePath('server/' + __dirname.replace(/^.*[\\/]/, '') + '/server.js');
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: { kind: TransportKind.socket, port: 1219 },
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ language: 'ahk2' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		},
		outputChannel: outputchannel,
		outputChannelName: 'AutoHotkey2'
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'ahk2',
		'Autohotkey2 Server',
		serverOptions,
		clientOptions
	);
	zhcn = client.getLocale().startsWith('zh-');

	// Start the client. This will also launch the server
	client.onReady().then(ready => {
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
		ahkStatusBarItem.show();
		server_is_ready = true;
	});
	const disposable = client.start();

	let extlist: string[] = [], debugexts: { [type: string]: string } = {};
	for (const ext of extensions.all) {
		if (ext.id.match(/ahk|autohotkey/i) && ext.packageJSON?.contributes?.debuggers) {
			for (const debuger of ext.packageJSON.contributes.debuggers)
				if (debuger.type)
					debugexts[debuger.type] = ext.id;
		}
	}
	extlist = Object.values(debugexts);

	commands.executeCommand('setContext', 'ahk2:isRunning', false);
	ahkStatusBarItem.command = 'ahk2.setinterpreter';
	context.subscriptions.push(
		disposable,
		commands.registerCommand('ahk2.run', () => runCurrentScriptFile()),
		commands.registerCommand('ahk2.selection.run', () => runCurrentScriptFile(true)),
		commands.registerCommand('ahk2.stop', () => stopRunningScript()),
		commands.registerCommand('ahk2.compile', () => compileScript()),
		commands.registerCommand('ahk2.help', () => quickHelp()),
		commands.registerCommand('ahk2.debug', async () => begindebug(extlist, debugexts)),
		commands.registerCommand('ahk2.debug.params', async () => begindebug(extlist, debugexts, true)),
		commands.registerCommand('ahk2.setinterpreter', () => setInterpreter()),
		ahkStatusBarItem
	);
	window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor);
	onDidChangeActiveTextEditor(window.activeTextEditor);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

async function runCurrentScriptFile(selection = false): Promise<void> {
	const editor = window.activeTextEditor, executePath = ahkpath_cur || getConfig('InterpreterPath');
	if (!editor || !executePath) return;
	let selecttext = '', path = '*', command = `"${executePath}" /ErrorStdOut `;
	let startTime: Date;
	await stopRunningScript(true);
	outputchannel.show(true), outputchannel.clear();
	if (selection || editor.document.isUntitled) selecttext = editor.document.getText(editor.selection);
	if (selecttext !== '') {
		command += path, outputchannel.appendLine('[Running] ' + command), startTime = new Date();
		ahkprocess = child_process.spawn(command, { cwd: `${resolve(editor.document.fileName, '..')}`, shell: true });
		ahkprocess.stdin?.write(selecttext), ahkprocess.stdin?.end();
	} else {
		commands.executeCommand('workbench.action.files.save');
		path = editor.document.fileName, command += `"${path}"`;
		outputchannel.appendLine('[Running] ' + command), startTime = new Date();
		ahkprocess = child_process.spawn(command, { cwd: resolve(path, '..'), shell: true });
	}
	if (ahkprocess) {
		commands.executeCommand('setContext', 'ahk2:isRunning', true);
		ahkprocess.stderr?.on('data', (data) => {
			outputchannel.appendLine(`[Error] ${data.toString().trim()}`);
		});
		ahkprocess.on('error', (error) => {
			console.error(error.message);
		});
		ahkprocess.stdout?.on('data', (data) => {
			outputchannel.append(data.toString());
		});
		ahkprocess.on('exit', (code) => {
			ahkprocess = undefined;
			commands.executeCommand('setContext', 'ahk2:isRunning', false);
			outputchannel.appendLine('');
			outputchannel.appendLine('[Done] exited with code=' + code + ' in ' + ((new Date()).getTime() - startTime.getTime()) / 1000 + ' seconds');
		});
	} else
		commands.executeCommand('setContext', 'ahk2:isRunning', false);
}

async function stopRunningScript(wait = false) {
	if (ahkprocess) {
		child_process.execSync('taskkill /pid ' + ahkprocess.pid + ' /T /F');
		if (wait) {
			while (ahkprocess)
				await sleep(200);
		}
	}
}

async function compileScript() {
	let editor = window.activeTextEditor, cmdop = getConfig('CompilerCMD');
	let executePath = ahkpath_cur || getConfig('InterpreterPath'), cmd = '', compilePath = executePath;
	if (!editor) return;
	compilePath = resolve(compilePath, '..\\Compiler\\Ahk2Exe.exe')
	if (!existsSync(compilePath)) {
		window.showErrorMessage(zhcn ? `"${compilePath}"不存在!` : `"${compilePath}" not find!`);
		return;
	}
	if (editor.document.isUntitled) {
		window.showErrorMessage(zhcn ? '编译前请先保存脚本' : 'Please save the script before compiling');
		return;
	}
	commands.executeCommand('workbench.action.files.save');
	const currentPath = editor.document.uri.fsPath;
	const exePath = currentPath.replace(/\.\w+$/, '.exe');
	try {
		if (existsSync(exePath))
			unlinkSync(exePath);
	} catch (e: any) {
		window.showErrorMessage(e.message);
		return;
	}
	if (!cmdop.match(/\/bin /i))
		cmdop += ' /bin "' + executePath + '"';
	if (cmdop.match(/\bahk2exe\w*\.exe/i)) {
		cmd = cmdop + ' /in ' + currentPath;
		if (!cmd.toLowerCase().includes(' /out '))
			cmd += '/out "' + exePath + '"';
	} else {
		cmd = `"${compilePath}" /in "${currentPath}" `;
		if (!cmdop.toLowerCase().includes(' /out '))
			cmd += '/out "' + exePath + '"';
		cmd += ' ' + cmdop;
	}
	if (child_process.exec(cmd, { cwd: resolve(currentPath, '..') })) {
		let start = new Date().getTime();
		let timer = setInterval(() => {
			let end = new Date().getTime();
			if (!checkcompilesuccess()) {
				if (end - start > 5000) {
					clearInterval(timer);
					window.showErrorMessage(zhcn ? '编译失败!' : 'Compilation failed!');
				}
			} else
				clearInterval(timer);
			function checkcompilesuccess() {
				if (existsSync(exePath)) {
					window.showInformationMessage(zhcn ? '编译成功!' : 'Compiled successfully!');
					return true;
				}
				return false;
			}
		}, 1000);
	} else
		window.showErrorMessage(zhcn ? '编译失败!' : 'Compilation failed!');
}

async function quickHelp() {
	const editor = window.activeTextEditor;
	if (!editor) return;
	const document = editor.document, path = document.fileName, position = editor.selection.active;
	const range = document.getWordRangeAtPosition(position), line = position.line;
	let word = '';
	if (range && (word = document.getText(range)).match(/^[a-z_]+$/i)) {
		if (range.start.character > 0 && document.getText(new Range(line, range.start.character - 1, line, range.start.character)) === '#')
			word = '#' + word;
	}
	const executePath: string = getConfig('InterpreterPath');
	if (!ahkhelp) {
		let helpPath = resolve(executePath, '..\\AutoHotkey.chm');
		if (!existsSync(helpPath)) {
			window.showErrorMessage(zhcn ? `"${helpPath}"未找到!` : `"${helpPath}" not find!`);
			return;
		}
		ahkhelp = child_process.spawn('C:/Windows/hh.exe', [helpPath]);
		if (!ahkhelp.pid) {
			window.showWarningMessage(zhcn ? '打开帮助文件失败!' : 'Failed to open the help file!'), ahkhelp = undefined;
			return;
		}
		ahkhelp.on('close', () => { ahkhelp = undefined; })
	}
	if (word !== '' && executePath !== '' && existsSync(executePath)) {
		let ahkpro = child_process.exec(`\"${executePath}\" /ErrorStdOut *`, { cwd: `${resolve(editor.document.fileName, '..')}` });
		ahkpro.stdin?.write(`
		DllCall("LoadLibrary", "Str", "oleacc", "Ptr")
		DetectHiddenWindows(true)
		if !(WinGetExStyle(top := WinExist("A")) && 8)
			top := 0
		if !WinExist("AutoHotkey ahk_class HH Parent ahk_pid ${ahkhelp.pid}")
			ExitApp
		if top
			WinSetAlwaysOnTop(0, top)
		WinShow(), WinActivate(), WinWaitActive()
		ctl := ControlGetHwnd("Internet Explorer_Server1")
		NumPut("int64", 0x11CF3C3D618736E0, "int64", 0x719B3800AA000C81, IID_IAccessible := Buffer(16))	; {618736E0-3C3D-11CF-810C-00AA00389B71}
		if !DllCall("oleacc\\AccessibleObjectFromWindow", "ptr", ctl, "uint", 0, "ptr", IID_IAccessible, "ptr*", IAccessible := ComValue(9, 0)) {
			try {
				IServiceProvider := ComObjQuery(IAccessible, IID_IServiceProvider := "{6D5140C1-7436-11CE-8034-00AA006009FA}")
				NumPut("int64", 0x11D026CB332C4427, "int64", 0x1901D94FC00083B4, IID_IHTMLWindow2 := Buffer(16))	; {332C4427-26CB-11D0-B483-00C04FD90119}
				ComCall(3, IServiceProvider, "ptr", IID_IHTMLWindow2, "ptr", IID_IHTMLWindow2, "ptr*", IHTMLWindow2 := ComValue(9, 0))	; IServiceProvider.QueryService
				IHTMLWindow2.execScript("
				(
					document.querySelector('#head > div > div.h-tabs > ul > li:nth-child(3) > button').click()
					searchinput = document.querySelector('#left > div.search > div.input > input[type=search]')
					keyevent = document.createEvent('KeyboardEvent')
					keyevent.initKeyboardEvent('keyup', false, true, document.defaultView, 13, null, false, false, false, false)
					searchinput.value = '${word}'
					searchinput.dispatchEvent(keyevent)
					Object.defineProperties(keyevent, { type: { get: function() { return 'keydown' } }, which: { get: function() { return 13 } } })
					searchinput.dispatchEvent(keyevent)
				)")
			}
		}
		`);
		ahkpro.stdin?.end();
	}
}

async function begindebug(extlist: string[], debugexts: any, params = false) {
	const editor = window.activeTextEditor, executePath = ahkpath_cur || getConfig('InterpreterPath');
	if (!editor) return;
	let extname: string | undefined;
	if (params) {
		if (!extlist.includes(extname = 'zero-plusplus.vscode-autohotkey-debug')) {
			window.showErrorMessage('zero-plusplus.vscode-autohotkey-debug was not found!');
			return;
		}
	} else if (extlist.length === 0) {
		window.showErrorMessage(zhcn ? '未找到debug扩展, 请先安装debug扩展!' : 'The debug extension was not found, please install the debug extension first!');
		extname = await window.showQuickPick(['zero-plusplus.vscode-autohotkey-debug', 'helsmy.autohotkey-debug', 'cweijan.vscode-autohotkey-plus']);
		if (extname)
			commands.executeCommand('workbench.extensions.installExtension', extname);
		return;
	} else if (extlist.length === 1)
		extname = extlist[0];
	else {
		let def = getConfig('DefaultDebugger');
		extname = extlist.includes(def) ? def : await window.showQuickPick(extlist);
	}
	if (extname) {
		let config: any = {
			type: '',
			request: 'launch',
			name: 'AutoHotkey Debug',
			runtime: executePath,
			AhkExecutable: executePath,
			program: editor.document.uri.fsPath
		};
		for (const t in debugexts)
			if (debugexts[t] === extname) {
				config.type = t;
				if (extname === 'zero-plusplus.vscode-autohotkey-debug' && params) {
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
				}
				break;
			}
		debug.startDebugging(workspace.getWorkspaceFolder(editor.document.uri), config);
	}
}

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function setInterpreter() {
	let index = -1, ahkpath: string = getConfig('InterpreterPath');
	let list: QuickPickItem[] = [], it: QuickPickItem, _ = ahkpath.toLowerCase();
	let pick = window.createQuickPick(), active: QuickPickItem | undefined, sel: QuickPickItem = { label: '' };
	if (zhcn) {
		list.push({ alwaysShow: true, label: '输入解释器路径...', detail: '输入路径或选择一个现有的解释器' });
		it = { label: '浏览...', detail: '浏览文件系统来选择一个 AutoHotkey2 解释器。' };
	} else {
		list.push({ alwaysShow: true, label: 'Enter interpreter path...', detail: 'Enter path or find an existing interpreter' });
		it = { label: 'Find...', detail: 'Browse your file system to find a AutoHotkey2 interpreter.' };
	}
	if (ahkpath)
		await addpath(resolve(ahkpath, '..'));
	if (!_.includes('c:\\program files\\autohotkey\\'))
		await addpath('C:\\Program Files\\AutoHotkey\\');
	if (ahkpath_cur.toLowerCase() !== ahkpath.toLowerCase() && !ahkpath_cur.toLowerCase().includes('c:\\program files\\autohotkey\\'))
		await addpath(resolve(ahkpath_cur, '..'));
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
			let path = await window.showOpenDialog({ filters: { Executables: ['exe'] }, openLabel: zhcn ? '选择解释器' : 'Select Interpreter' });
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
			if (!sel.label)
				sel.label = await getAHKversion(sel.detail);
			ahkStatusBarItem.text = sel.label;
			ahkStatusBarItem.tooltip = sel.detail;
			ahkpath_cur = sel.detail;
			if (server_is_ready)
				commands.executeCommand('ahk2.resetinterpreterpath', ahkpath_cur);
			ahkconfig.update('InterpreterPath', ahkpath_cur);
		}
	});
	pick.onDidHide(e => pick.dispose());

	async function addpath(dirpath: string) {
		for (let file of readdirSync(dirpath)) {
			let path = resolve(dirpath, file);
			if (statSync(path).isDirectory()) {
				for (file of readdirSync(path)) {
					let path2 = resolve(path, file);
					if (file.toLowerCase().endsWith('.exe') && !statSync(path2).isDirectory()) {
						let info = await getAHKversion(path2);
						if (info.match(/\bautohotkey.*?2\./i))
							list.push({ label: info, detail: path2 });
					}
				}
			} else if (file.toLowerCase().endsWith('.exe')) {
				let info = await getAHKversion(path);
				if (info.match(/\bautohotkey.*?2\./i))
					list.push({ label: info, detail: path });
			}
		}
	}
}

async function getAHKversion(path: string) {
	try {
		let props = await getFileProperties(path);
		if (props.ProductName?.toLowerCase().startsWith('autohotkey'))
			return (props.ProductName + ' ') + (props.ProductVersion || '') + (props.FileDescription?.replace(/^.*?(\d+-bit).*$/i, ' $1') || '');
	} catch (e) {}
	return '';
}

function getConfig(key: string, defaultVal = '') {
	let t = ahkconfig.inspect(key);
	if (t)
		return (t.workspaceFolderValue || t.workspaceValue || t.globalValue || t.defaultValue || defaultVal) as string;
	return '';
}

async function onDidChangeActiveTextEditor(e?: TextEditor) {
	if (!e || e.document.languageId !== 'ahk2' || e.document.uri.path !== window.activeTextEditor?.document.uri.path)
		return;
	let path = ahkpath_cur;
	if (!path.match(/\.exe$/i) || !existsSync(path))
		path = getConfig('InterpreterPath');
	if (path.match(/\.exe$/i) && existsSync(path)) {
		if (path !== ahkStatusBarItem.tooltip) {
			ahkStatusBarItem.tooltip = path;
			ahkStatusBarItem.text = await getAHKversion(path) || (zhcn ? '未知版本' : 'Unknown version');
		}
	} else {
		ahkStatusBarItem.text = (zhcn ? '选择AutoHotkey2解释器' : 'Select AutoHotkey2 Interpreter');
		ahkStatusBarItem.tooltip = undefined, path = '';
	}
	if (path !== ahkpath_cur)
		if (server_is_ready)
			commands.executeCommand('ahk2.resetinterpreterpath', ahkpath_cur = path);
		else
			ahkpath_cur = path;
}