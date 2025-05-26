import { spawn } from 'child_process';
import { createServer } from 'net';
import { resolve } from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { sendAhkRequest } from './ahkProvider';
import {
	a_Vars, ahkPath, ahkPath_resolved, ahkVersion, builtinVars, builtinVars_h, clearLibSymbols, configCache,
	initCaches, inLibDirs, isahk2_h, Lexer, lexers, libDirs, libSymbols, loadSyntax, localize, MessageType,
	parseProject, parseUserLib, resolvePath, setAhkPath, setIsAhkH, setting, setVersion, URI, utils
} from './common';
import { documents, setConnection } from './connection';
import { PEFile, RESOURCE_TYPE, searchAndOpenPEFile } from './PEFile';

Object.assign(utils, {
	getAhkVersion,
	getDllExport,
	getRCData,
	setInterpreter,
});
if (process.platform === 'win32')
	utils.sendAhkRequest = sendAhkRequest;
setConnection(createConnection(ProposedFeatures.all), resolve(__dirname, '../..'));

function showPathError(msg: string) {
	clearRCData();
	utils.showMessage(MessageType.Error, msg, { title: localize('ahk2.select', 'Select Interpreter')() })
		.then(r => r && utils.updateStatusBar?.(''));
}

async function initEnv(samefolder: boolean): Promise<boolean> {
	if (!ahkPath_resolved)
		return showPathError(setting.ahkpatherr()), false;
	let vars;
	const ver = ahkVersion;
	for (let i = 0; i < 3 && !vars; i++)
		vars = await getScriptVars();
	if (!vars)
		return showPathError(setting.getenverr()), false;
	Object.assign(a_Vars, vars).ahkpath ??= ahkPath;
	setVersion(a_Vars.ahkversion ??= '2.0.0');
	if (a_Vars.ahkversion.startsWith('1.'))
		showPathError(setting.versionerr());
	if (!samefolder || !libDirs.length) {
		libDirs.length = 0;
		libDirs.push(a_Vars.mydocuments + '\\AutoHotkey\\Lib\\',
			a_Vars.ahkpath.replace(/[^\\/]+$/, 'Lib\\'));
		let lb;
		for (lb of Object.values(libSymbols))
			lb.islib = inLibDirs(lb.fsPath);
	}
	if (ahkVersion !== ver) {
		const h = !!a_Vars.threadid;
		initCaches();
		setIsAhkH(h);
		loadSyntax();
		if (h) loadSyntax('ahk2_h'), loadSyntax('winapi', 4);
		samefolder = false;
	} else if (a_Vars.threadid) {
		if (!isahk2_h)
			setIsAhkH(true), samefolder = false, loadSyntax('ahk2_h'), loadSyntax('winapi', 4);
	} else {
		if (isahk2_h)
			setIsAhkH(false), samefolder = false, initCaches(), loadSyntax();
	}
	Object.assign(a_Vars, { index: '0', clipboard: '', threadid: '' });
	await updateRCData();
	if (samefolder)
		return true;
	for (const uri in lexers) {
		const lex = lexers[uri];
		if (!lex.d) {
			lex.initLibDirs();
			if (Object.keys(lex.include).length || lex.diagnostics.length)
				lex.update();
		}
	}
	clearLibSymbols();
	if (configCache.AutoLibInclude > 1)
		parseUserLib();
	return true;
}

async function updateRCData() {
	let pe;
	try {
		clearRCData();
		pe = new PEFile(resolvePath(ahkPath, true));
		rcData = await pe.getResource(RESOURCE_TYPE.RCDATA);
	} catch { }
	finally { pe?.close(); }
}

function clearRCData() {
	loadedRCData.forEach(lex => lex.close(true));
	loadedRCData.length = 0;
	rcData = undefined;
}

async function changeInterpreter(oldpath: string, newpath: string) {
	const samefolder = !!oldpath && resolve(oldpath, '..').toLowerCase() === resolve(newpath, '..').toLowerCase();
	if (!(await initEnv(samefolder)))
		return false;
	if (samefolder)
		return true;
	documents.keys().forEach(uri => {
		const lex = lexers[uri.toLowerCase()];
		if (!lex) return;
		lex.initLibDirs(lex.scriptdir);
		if (configCache.AutoLibInclude & 1)
			parseProject(lex.uri);
	});
	return true;
}

async function setInterpreter(path: string) {
	const prev_path = ahkPath;
	if (path) {
		if (path.toLowerCase() === prev_path.toLowerCase())
			return;
		setAhkPath(path);
		utils.updateStatusBar?.();
		await changeInterpreter(prev_path, path);
	}
	if (!ahkPath)
		showPathError(setting.ahkpatherr());
}

async function getAhkVersion(params: string[]) {
	return Promise.all(params.map(async path => {
		let pe: PEFile | undefined;
		try {
			pe = new PEFile(path);
			const props = (await pe.getResource(RESOURCE_TYPE.VERSION))[0].StringTable[0];
			if (props.ProductName?.toLowerCase().startsWith('autohotkey')) {
				const is_bit64 = await pe.is_bit64;
				const m = (await pe.getResource(RESOURCE_TYPE.MANIFEST))[0]?.replace(/<!--[\s\S]*?-->/g, '') ?? '';
				let version = `${props.ProductName} ${props.ProductVersion ?? 'unknown version'} ${is_bit64 ? '64' : '32'} bit`;
				if (m.includes('uiAccess="true"'))
					version += ' [UIAccess]';
				return version;
			}
		} catch (e) { }
		finally { pe?.close(), pe = undefined; }
		return '';
	}));
}

async function getDllExport(paths: string[] | Set<string>, onlyone = false) {
	const funcs: Record<string, true> = {};
	for (const path of paths) {
		const pe = await searchAndOpenPEFile(path, a_Vars.ptrsize === '8' ? true : a_Vars.ptrsize === '4' ? false : undefined);
		if (!pe) continue;
		try {
			(await pe.getExport())?.Functions.forEach((it) => funcs[it.Name] = true);
			if (onlyone) break;
		} finally { pe.close(); }
	}
	delete funcs[''];
	return Object.keys(funcs);
}

let rcData: Record<string, Buffer> | undefined = undefined;
const loadedRCData: Lexer[] = [];
function getRCData(name?: string) {
	if (!rcData)
		return;
	if (!name) return { uri: '', path: '', paths: Object.keys(rcData ?? {}) };
	const path = `${ahkPath}:${name}`;
	const uri = URI.from({ scheme: 'ahkres', path }).toString().toLowerCase();
	if (lexers[uri])
		return { uri, path };
	const data = rcData[name];
	if (!data)
		return;
	try {
		const lex = lexers[uri] = new Lexer(TextDocument.create(uri, 'ahk2', -10, new TextDecoder('utf8', { fatal: true }).decode(data)));
		lex.parseScript();
		loadedRCData.push(lex);
		return { uri, path };
	} catch { delete rcData[name]; }
}

function getScriptVars(): Promise<Record<string, string> | undefined> {
	const path = `\\\\.\\pipe\\ahk-script-${Buffer.from(Uint16Array.from(
		[process.pid, Date.now()]).buffer).toString('hex')}`;
	let has_written = false, output: string | undefined;
	const server = createServer().listen(path);
	const script = `
#NoTrayIcon
s := ""
for _, k in ${JSON.stringify([...builtinVars, ...builtinVars_h])}
	try if SubStr(k, 1, 2) = "a_" && !IsObject(v := %k%)
		s .= SubStr(k, 3) "|" v "\`n"
FileOpen(A_ScriptFullPath, "w", "utf-8").Write(s)`;
	return new Promise<void>(r => {
		server.on('connection', socket => {
			const destroy = () => socket.destroy();
			socket.on('error', destroy);
			if (has_written) {
				output = '';
				socket.setEncoding('utf8')
					.on('data', data => output! += data)
					.on('end', () => (r(), destroy()));
				return;
			}
			has_written = socket.write(script);
			socket.destroySoon();
		});
		const cp = spawn(`"${ahkPath}" /CP65001 /ErrorStdOut ${path}`, [], { cwd: resolve(ahkPath, '..'), shell: true });
		cp.on('exit', code => code !== 0 ? r() : output === undefined && setTimeout(r, 1000));
		cp.on('error', r);
		setTimeout(() => cp.kill(), 2000);
	}).then(() => {
		const data = output?.trim();
		if (data)
			return Object.fromEntries(data.split('\n').map(l => l.split('|')));
	}).finally(() => server.close());
}