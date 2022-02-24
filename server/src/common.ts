import { TextDocument } from 'vscode-languageserver-textdocument';
import { Command, CompletionItem, CompletionItemKind, DocumentSymbol, Hover, InsertTextFormat, MarkupKind, Range, SymbolInformation, SymbolKind } from 'vscode-languageserver-types';
import { URI } from 'vscode-uri';
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { FuncNode, Lexer } from './Lexer';
import { completionitem } from './localize';
import { Connection } from 'vscode-languageserver';
export * from './Lexer';
export * from './codeActionProvider';
export * from './colorProvider';
export * from './commandProvider';
export * from './completionProvider';
export * from './definitionProvider';
export * from './formattingProvider';
export * from './hoverProvider';
export * from './localize';
export * from './referencesProvider';
export * from './renameProvider';
export * from './scriptrunner';
export * from './semanticTokensProvider';
export * from './signatureProvider';
export * from './symbolProvider';
import { diagnostic } from './localize';

export let connection: Connection, ahkpath_cur = '', workspaceFolders: string[] = [], dirname = '', isahk2_h = false, inBrowser = false;
export let ahkvars: { [key: string]: DocumentSymbol } = {};
export let libfuncs: { [uri: string]: DocumentSymbol[] } = {};
export let symbolcache: { [uri: string]: SymbolInformation[] } = {};
export let hoverCache: { [key: string]: Hover[] }[] = [{}, {}], libdirs: string[] = [];
export let lexers: { [key: string]: Lexer } = {}, pathenv: { [key: string]: string } = {};
export let completionItemCache: { [key: string]: CompletionItem[] } = { sharp: [], method: [], other: [], constant: [], snippet: [] };
export let dllcalltpe: string[] = [], extsettings: AHKLSSettings = {
	InterpreterPath: 'C:\\Program Files\\AutoHotkey\\AutoHotkey32.exe',
	AutoLibInclude: 0,
	CompleteFunctionParens: false,
	Diagnostics: {
		ParamsCheck: true
	}
};
export let winapis: string[] = [];
export let getDllExport = (paths: string[], onlyone: boolean = false) => [] as string[];

export let locale = 'en-us';
export type Maybe<T> = T | undefined;

export enum LibIncludeType {
	'Disabled',
	'Local',
	'User and Standard',
	'All'
}

export interface AHKLSSettings {
	InterpreterPath: string
	AutoLibInclude: LibIncludeType
	CompleteFunctionParens: boolean
	Diagnostics: {
		ParamsCheck: boolean
	}
}

export function set_Connection(conn: any, browser: boolean, getDll?:  (paths: string[]) => string[]) {
	connection = conn;
	inBrowser = browser;
	if (getDll) getDllExport = getDll;
}

export function openFile(path: string): TextDocument {
	if (inBrowser) {
		let data = getwebfile(path);
		if (data)
			return TextDocument.create(data.url, 'ahk2', -10, data.text);
		return undefined as unknown as TextDocument;
	} else {
		let buf: Buffer | string;
		buf = readFileSync(path);
		if (buf[0] === 0xff && buf[1] === 0xfe)
			buf = buf.toString('utf16le');
		else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
			buf = buf.toString('utf8').substring(1);
		else {
			let len = Math.min(buf.byteLength, 256), i = 0, c = 0, l = 0;
			while (i < len) {
				c = buf[i];
				if (c < 0x80) { i++; continue; }
				else if (c >= 0xc0 && c < 0xff) {
					l = c < 0xe0 ? 1 : c < 0xf0 ? 2 : c < 0xf8 ? 3 : c < 0xfc ? 4 : c < 0xfe ? 5 : 6;
					if (i + l >= len) break;
					for (++i; l; --l)
						if ((buf[i++] & 0xc0) !== 0x80) {
							connection.window.showErrorMessage(diagnostic.invalidencoding(path));
							return undefined as unknown as TextDocument;
						}
				} else {
					connection.window.showErrorMessage(diagnostic.invalidencoding(path));
					return undefined as unknown as TextDocument;
				}
			}
			buf = buf.toString('utf8');
		}
		return TextDocument.create(URI.file(path).toString(), 'ahk2', -10, buf);
	}
}

export function restorePath(path: string): string {
	if (!existsSync(path))
		return path;
	let dirs = path.toUpperCase().split('\\'), i = 1, s = dirs[0];
	while (i < dirs.length) {
		for (const d of readdirSync(s + '\\')) {
			if (d.toUpperCase() === dirs[i]) {
				s += '\\' + d;
				break;
			}
		}
		i++;
	}
	return s.toLowerCase() === path ? s : path;
}

export function getlocalefilepath(filepath: string): string | undefined {
	let t = filepath.match(/<>./), s: string;
	if (t) {
		if (existsSync(s = filepath.replace('<>', locale)))
			return s;
		else if (locale.toLowerCase() === 'zh-tw' && existsSync(s = filepath.replace('<>', 'zh-cn')))
			return s;
		else if (existsSync(s = filepath.replace(t[0], '')))
			return s;
	} else if (existsSync(filepath))
		return filepath;
	return undefined;
}

export function getlocalefile(filepath: string, encoding?: string) {
	let path = getlocalefilepath(filepath);
	if (path)
		return readFileSync(path, encoding ? { encoding: encoding } : undefined);
	return undefined;
}

export function getwebfile(filepath: string) {
	let t = filepath.match(/<>./), s: string | undefined;
	let ff: string[] = [];
	let req = new XMLHttpRequest();
	if (t) {
		ff.push(filepath.replace('<>', locale));
		if (locale.toLowerCase() === 'zh-tw')
			ff.unshift(filepath.replace('<>', 'zh-cn'));
		ff.unshift(filepath.replace(t[0], ''));
	} else ff.push(filepath);
	if (s = ff.pop())
		return get(s);

	function get(url: string): { url: string, text: string } | undefined {
		req.open('GET', url, false);
		req.send();
		if (req.status === 200) {
			return { url, text: req.responseText };
		} else if (s = ff.pop())
			return get(s);
		return undefined;
	}
}

export function sendDiagnostics() {
	let doc: Lexer;
	for (const uri in lexers) {
		doc = lexers[uri];
		connection.sendDiagnostics({
			uri: doc.document.uri,
			diagnostics: (!doc.actived && (!doc.relevance || !Object.keys(doc.relevance).length) ? [] : doc.diagnostics)
		});
	}
}

export function initahk2cache() {
	ahkvars = {};
	dllcalltpe = ['str', 'astr', 'wstr', 'int64', 'int', 'uint', 'short', 'ushort', 'char', 'uchar', 'float', 'double', 'ptr', 'uptr', 'HRESULT'];
	completionItemCache = {
		sharp: [],
		method: [],
		other: [],
		constant: [],
		snippet: !inBrowser && process.env.AHK2_LS_CONFIG ? [] : [{
			label: 'zs-Comment',
			detail: completionitem.comment(),
			kind: CompletionItemKind.Snippet,
			command: { title: 'ahk2.generate.comment', command: 'ahk2.generate.comment', arguments: [] }
		},
		{
			label: 'zs-Author',
			detail: completionitem.author(),
			kind: CompletionItemKind.Snippet,
			command: { title: 'ahk2.generate.author', command: 'ahk2.generate.author' }
		}]
	};
}

export async function loadahk2(filename = 'ahk2') {
	let path: string | undefined;
	const cmd: Command = { title: 'Trigger Parameter Hints', command: 'editor.action.triggerParameterHints' };
	let type: CompletionItemKind, t = '', snip: { prefix: string, body: string, description?: string }, rg = Range.create(0, 0, 0, 0);
	if (inBrowser) {
		const file = dirname + `/syntaxes/<>/${filename}`;
		let td = openFile(file + '.d.ahk');
		if (td) {
			let doc = new Lexer(td);
			doc.parseScript(true), lexers[doc.uri] = doc;
		}
		let data = getwebfile(file + '.json');
		if (data)
			build(JSON.parse(data.text));
	} else {
		const file = resolve(__dirname, `../../syntaxes/<>/${filename}`);
		if (path = getlocalefilepath(file + '.d.ahk')) {
			let doc = new Lexer(openFile(path));
			doc.parseScript(true), lexers[doc.uri] = doc;
		}
		if (!(path = getlocalefilepath(file + '.json')))
			return;
		build(JSON.parse(readFileSync(path, { encoding: 'utf8' })));
	}
	function build(ahk2: any) {
		for (const key in ahk2) {
			if (key === 'snippet') {
				for (snip of ahk2['snippet']) {
					const completionItem = CompletionItem.create(snip.prefix);
					completionItem.kind = CompletionItemKind.Snippet;
					completionItem.insertText = bodytostring(snip.body);
					completionItem.detail = snip.description;
					completionItem.insertTextFormat = InsertTextFormat.Snippet;
					completionItemCache.snippet.push(completionItem);
				}
			} else {
				let arr: any[] = ahk2[key];
				switch (key) {
					case 'keywords': type = CompletionItemKind.Keyword; break;
					case 'functions': type = CompletionItemKind.Function; break;
					case 'variables': type = CompletionItemKind.Variable; break;
					case 'constants': type = CompletionItemKind.Constant; break;
					default: type = CompletionItemKind.Text; break;
				}
				for (snip of arr) additem();
			}
		}
	}
	function additem() {
		const completionItem = CompletionItem.create(snip.prefix.replace('.', '')), hover: Hover = { contents: [] }, _low = snip.prefix.toLowerCase();
		completionItem.kind = type;
		if (type === CompletionItemKind.Keyword && snip.prefix.charAt(0) === '#')
			t = 'sharp', snip.body = bodytostring(snip.body).replace(/^#/, '');
		else if (type === CompletionItemKind.Constant)
			t = 'constant'; else t = 'other';
		if (type === CompletionItemKind.Function && snip.body.indexOf('|}') === -1 && snip.body.indexOf('(') !== -1)
			completionItem.insertText = snip.prefix + '($0)', completionItem.command = cmd, completionItem.detail = snip.description;
		else if (type === CompletionItemKind.Constant)
			completionItem.insertText = '${1:' + snip.prefix + ' := }' + snip.body + '$0', completionItem.detail = snip.body;
		else completionItem.insertText = snip.body.replace(/\$\{\d:\s*\[,[^\]\}]+\]\}/, () => {
			completionItem.command = cmd;
			return '';
		}), completionItem.detail = snip.description;
		completionItem.insertTextFormat = InsertTextFormat.Snippet;
		snip.body = snip.body.replace(/\$\{\d+((\|)|:)([^}]*)\2\}|\$\d/g, (...m) => {
			return m[2] ? m[3].replace(/,/g, '|') : m[3] || '';
		});
		completionItem.documentation = { kind: MarkupKind.Markdown, value: '```ahk2\n' + snip.body + '\n```' };
		if (type !== CompletionItemKind.Function)
			completionItemCache[t].push(completionItem);
		if (type === CompletionItemKind.Constant || type === CompletionItemKind.Text)
			return;
		hover.contents = { kind: MarkupKind.Markdown, value: '```ahk2\n' + snip.body + '\n```\n\n' + snip.description };
		let n = type === CompletionItemKind.Function ? 0 : 1;
		if (!hoverCache[n][_low]) hoverCache[n][_low] = [];
		if (!n) {
			let it = FuncNode.create(snip.prefix, SymbolKind.Function, rg, rg,
				snip.body.replace(/^\w+[(\s]?|\)/g, '').split(',').map(param => {
					return DocumentSymbol.create(param.replace(/[\[\]\s]/g, ''), undefined, SymbolKind.Variable, rg, rg);
				}));
			it.full = it.full.replace(/(['\w]*\|['\w]*)(\|['\w]*)+/, (...m) => {
				snip.body = snip.body.replace(m[0], m[1] + '|...');
				return m[1] + '|...';
			});
			it.detail = snip.description, ahkvars[_low] = it;
		}
		if (snip.description)
			hoverCache[n][_low].push(hover);
	}
	function bodytostring(body: any) { return (typeof body === 'object' ? body.join('\n') : body) };
}

export function updateFileInfo(info: string, revised: boolean = true): string {
	let d: Date = new Date;
	info = info.replace(/(?<=@?(date|日期)[:\s]\s*)(\d+\/\d+\/\d+)/i, d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2));
	info = info.replace(/(?<=@?(version|版本号)[:\s]\s*)(\d+(\.\d+)*)/i, (m) => {
		let ver: string[] = m.split('.');
		while (ver.length < 3)
			ver.push('0');
		if (revised)
			ver[ver.length - 1] = (parseInt(ver[ver.length - 1]) + 1).toString();
		else ver[ver.length - 2] = (parseInt(ver[ver.length - 2]) + 1).toString(), ver[ver.length - 1] = '0';
		return ver.join('.');
	});
	return info;
}

export function getallahkfiles(dirpath: string, maxdeep = 3): string[] {
	let files: string[] = [];
	if (existsSync(dirpath) && statSync(dirpath).isDirectory())
		enumfile(dirpath, 0);
	return files;

	function enumfile(dirpath: string, deep: number) {
		readdirSync(dirpath).map(file => {
			let path = resolve(dirpath, file);
			if (statSync(path).isDirectory()) {
				if (deep < maxdeep)
					enumfile(path, deep + 1);
			} else if (file.match(/\.(ahk2?|ah2)$/i))
				files.push(path.toLowerCase());
		});
	}
}

export function inWorkspaceFolders(uri: string) {
	uri = uri.toLowerCase();
	for (let f of workspaceFolders)
		if (uri.startsWith(f))
			return f;
	return '';
}

export async function parseWorkspaceFolders() {
	let l: string;
	if (inBrowser) {
		let uris = (await connection.sendRequest('ahk2.getWorkspaceFiles', []) || []) as string[];
		for (let uri of uris)
			if (!lexers[l = uri.toLowerCase()]) {
				let v = await connection.sendRequest('ahk2.getWorkspaceFileContent', [uri]) as string;
				if (v) {
					let d = new Lexer(TextDocument.create(uri, 'ahk2', -10, v));
					d.parseScript(), lexers[l] = d;
					await sleep(100);
				}
			}
	} else {
		for (let uri of workspaceFolders) {
			let dir = URI.parse(uri).fsPath, t;
			for (let file of getallahkfiles(dir)) {
				l = URI.file(file).toString().toLowerCase();
				if (!lexers[l] && (t = openFile(file))) {
					let d = new Lexer(t);
					d.parseScript(), lexers[l] = d;
					await sleep(100);
				}
			}
		}
	}
}

export function clearLibfuns() { libfuncs = {}; }
export function set_ahk_h(v: boolean) { isahk2_h = v; }
export function set_ahkpath(path: string) { ahkpath_cur = path; }
export function set_dirname(dir: string) { dirname = dir.replace(/[/\\]$/, ''); }
export function set_locale(str?: string) { if (str) locale = str; }
export function set_Workfolder(folders?: string[]) { workspaceFolders = folders || []; }

export async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
