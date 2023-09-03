import { resolve, sep } from 'path';
import { URI } from 'vscode-uri';
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { Connection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind, DocumentSymbol, Hover, InsertTextFormat, Range, SymbolInformation, SymbolKind } from 'vscode-languageserver-types';
import { FormatOptions, Lexer, parseinclude, update_commentTags } from './Lexer';
import { diagnostic } from './localize';
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

export const inBrowser = typeof process === 'undefined';
export let connection: Connection, ahkpath_cur = '', workspaceFolders: string[] = [], rootdir = '', isahk2_h = false;
export let ahkvars: { [key: string]: DocumentSymbol } = {}, ahkuris: { [name: string]: string } = {};
export let libfuncs: { [uri: string]: DocumentSymbol[] } = {};
export let symbolcache: { [uri: string]: SymbolInformation[] } = {};
export let hoverCache: { [key: string]: [string, Hover | undefined] } = {}, libdirs: string[] = [];
export let lexers: { [key: string]: Lexer } = {}, pathenv: { [key: string]: string } = { space: ' ', tab: '\t' };
export let ahk_version = encode_version('3.0.0.0');
export let completionItemCache = {
	constant: [] as CompletionItem[],
	directive: [] as CompletionItem[],
	key: [] as CompletionItem[],
	keyword: [] as CompletionItem[],
	snippet: [] as CompletionItem[],
	text: [] as CompletionItem[]
};
export let dllcalltpe: string[] = [], extsettings: AHKLSSettings = {
	InterpreterPath: 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe',
	ActionWhenV1IsDetected: 'Warn',
	AutoLibInclude: 0,
	CommentTags: '^;;\\s*(.*)',
	CompleteFunctionParens: false,
	CompletionCommitCharacters: {
		Class: '.(',
		Function: '('
	},
	SymbolFoldingFromOpenBrace: false,
	Diagnostics: {
		ClassStaticMemberCheck: true,
		ParamsCheck: true,
		VarUnset: true
	},
	Files: {
		Exclude: []
	},
	FormatOptions: {},
	WorkingDirs: []
};
export const chinese_punctuations: { [c: string]: string } = {
	'，': ',',
	'。': '.',
	'；': ';',
	'‘': "'",
	'’': "'",
	'【': '[',
	'】': ']',
	'《': '<',
	'》': '>',
	'？': '?',
	'：': ':',
	'“': '"',
	'”': '"',
	'（': '(',
	'）': ')',
	'！': '!'
};
export let winapis: string[] = [];
export let utils = {
	get_DllExport: (paths: string[], onlyone: boolean = false) => [] as string[],
	get_RCDATA: (path?: string) => (0 ? { uri: '', path: '' } : undefined),
	get_ahkProvider: async () => null as any
};

export const alpha_3 = encode_version('2.1.0.3');

export let locale = 'en-us';
export type Maybe<T> = T | undefined;

enum LibIncludeType {
	'Disabled',
	'Local',
	'User and Standard',
	'All'
}

export type ActionType = 'Continue' | 'Warn' | 'SkipLine' | 'SwitchToV1' | 'Stop';
export interface AHKLSSettings {
	locale?: string
	commands?: string[]
	ActionWhenV1IsDetected: ActionType
	AutoLibInclude: LibIncludeType
	CommentTags: string
	CompleteFunctionParens: boolean
	CompletionCommitCharacters?: {
		Class: string
		Function: string
	}
	SymbolFoldingFromOpenBrace: boolean
	Diagnostics: {
		ClassStaticMemberCheck: boolean
		ParamsCheck: boolean
		VarUnset: boolean
	}
	Files: {
		Exclude: string[] | RegExp[]
	}
	FormatOptions: FormatOptions
	InterpreterPath: string
	WorkingDirs: string[]
	GlobalStorage?: string
}

export function openFile(path: string, showError = true): TextDocument | undefined {
	if (inBrowser) {
		let data = getwebfile(path);
		if (data)
			return TextDocument.create(data.url, 'ahk2', -10, data.text);
		return undefined;
	} else {
		let buf: Buffer | string;
		try { buf = readFileSync(path); }
		catch (e: any) {
			if (showError) {
				delete e.stack;
				e.path = path;
				console.log(e);
			}
			return undefined;
		}
		if (buf[0] === 0xff && buf[1] === 0xfe)
			buf = buf.toString('utf16le');
		else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
			buf = buf.toString('utf8').substring(1);
		else {
			try {
				buf = new TextDecoder('utf8', { fatal: true }).decode(buf);
			} catch {
				showError && connection.window.showErrorMessage(diagnostic.invalidencoding(path));
				return undefined;
			}
		}
		return TextDocument.create(URI.file(path).toString(), 'ahk2', -10, buf);
	}
}

export function openAndParse(path: string, showError = true, cache = true) {
	let td = openFile(path, showError);
	if (td) {
		let lex = new Lexer(td);
		lex.parseScript();
		cache && (lexers[lex.uri] = lex);
		return lex;
	}
}

export function restorePath(path: string): string {
	if (inBrowser || !existsSync(path))
		return path;
	if (path.includes('..'))
		path = resolve(path);
	let dirs = path.toLowerCase().split(/[/\\]/), i = 1, s = dirs[0];
	let _dirs = path.split(/[/\\]/);
	while (i < dirs.length) {
		try {
			for (const d of readdirSync(s + sep)) {
				if (d.toLowerCase() === dirs[i]) {
					s += sep + d;
					break;
				}
			}
		} catch { s += sep + _dirs[i]; }
		i++;
	}
	return s;
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
	for (const uri in lexers) {
		let doc = lexers[uri];
		connection.sendDiagnostics({
			uri: doc.document.uri,
			diagnostics: (!doc.actived && (!doc.relevance || !Object.keys(doc.relevance).length) ? [] : doc.diagnostics)
		});
	}
}

export function initahk2cache() {
	ahkvars = {}, ahkuris = {};
	dllcalltpe = ['str', 'astr', 'wstr', 'int64', 'int', 'uint', 'short', 'ushort', 'char', 'uchar', 'float', 'double', 'ptr', 'uptr', 'hresult'];
	completionItemCache = {
		constant: [],
		directive: [],
		key: [],
		keyword: [],
		snippet: [],
		text: []
		// snippet: !inBrowser && process.env.AHK2_LS_CONFIG ? [] : [{
		// 	label: 'zs-Comment',
		// 	detail: completionitem.comment(),
		// 	kind: CompletionItemKind.Snippet,
		// 	command: { title: 'ahk2.generate.comment', command: 'ahk2.generate.comment', arguments: [] }
		// }]
	};
}

export async function loadahk2(filename = 'ahk2', d = 3) {
	let path: string | undefined;
	const file = `${rootdir}/syntaxes/<>/${filename}`;
	if (inBrowser) {
		let td = openFile(file + '.d.ahk');
		if (td) {
			let doc = new Lexer(td, undefined, d);
			doc.parseScript(), lexers[doc.uri] = doc, ahkuris[filename] = doc.uri;
		}
		let data;
		if (filename === 'ahk2')
			if (data = getwebfile(`${rootdir}/syntaxes/ahk2_common.json`))
				build_item_cache(JSON.parse(data.text));
		if (data = getwebfile(file + '.json'))
			build_item_cache(JSON.parse(data.text));
	} else {
		let td: TextDocument | undefined;
		if ((path = getlocalefilepath(file + '.d.ahk')) && (td = openFile(restorePath(path)))) {
			let doc = new Lexer(td, undefined, d);
			doc.parseScript(), lexers[doc.uri] = doc, ahkuris[filename] = doc.uri;
		}
		if (path = getlocalefilepath(file + '.json'))
			build_item_cache(JSON.parse(readFileSync(path, { encoding: 'utf8' })));
		if (filename === 'ahk2') {
			build_item_cache(JSON.parse(readFileSync(`${rootdir}/syntaxes/ahk2_common.json`, { encoding: 'utf8' })));
			if ((path = extsettings.GlobalStorage) && existsSync(path))
				for (let file of readdirSync(path)) {
					if (file.toLowerCase().endsWith('.snippet.json') && !statSync(file = `${path}/${file}`).isDirectory())
						build_item_cache(JSON.parse(readFileSync(file, { encoding: 'utf8' })));
				}
		}
	}
	function build_item_cache(ahk2: any) {
		let insertTextFormat: InsertTextFormat, kind: CompletionItemKind;
		let snip: { prefix: string, body: string, description?: string };
		let rg = Range.create(0, 0, 0, 0);
		for (const key in ahk2) {
			let arr: any[] = ahk2[key];
			switch (key) {
				case 'constants':
					kind = CompletionItemKind.Constant;
					insertTextFormat = InsertTextFormat.Snippet;
					for (snip of arr) {
						completionItemCache.constant.push({
							label: snip.prefix, kind, insertTextFormat,
							insertText: `\${1:${snip.prefix} := }${snip.body}$0`,
							detail: snip.description ?? snip.body
						});
					}
					break;
				case 'directives':
					let re = /^#/;
					kind = CompletionItemKind.Keyword;
					insertTextFormat = InsertTextFormat.Snippet;
					for (snip of arr) {
						completionItemCache.directive.push({
							label: snip.prefix,
							insertText: snip.body.replace(re, ''),
							kind, insertTextFormat,
							detail: snip.description
						});
						hoverCache[snip.prefix.toLowerCase()] = [snip.prefix, { contents: { kind: 'markdown', value: '```ahk2\n' + trim(snip.body) + '\n```\n\n' + (snip.description ?? '') } }];
					}
					break;
				case 'keys':
					kind = CompletionItemKind.Keyword;
					for (snip of arr) {
						completionItemCache.key.push({
							label: snip.prefix, kind,
							detail: snip.description
						});
					}
					break;
				case 'keywords':
					kind = CompletionItemKind.Keyword;
					insertTextFormat = InsertTextFormat.Snippet;
					for (snip of arr) {
						completionItemCache.keyword.push({
							label: snip.prefix, kind, insertTextFormat,
							insertText: snip.body,
							detail: snip.description,
							preselect: true
						});
						hoverCache[snip.prefix.toLowerCase()] = [snip.prefix, { contents: { kind: 'markdown', value: '```ahk2\n' + trim(snip.body) + '\n```\n\n' + (snip.description ?? '') } }];
					}
					break;
				case 'snippet':
					kind = CompletionItemKind.Snippet;
					insertTextFormat = InsertTextFormat.Snippet;
					for (snip of arr) {
						completionItemCache.snippet.push({
							label: snip.prefix,
							insertText: bodytostring(snip.body),
							detail: snip.description,
							kind, insertTextFormat
						});
					}
					break;
				case 'variables':
					for (snip of arr) {
						ahkvars[snip.prefix.toUpperCase()] = {
							name: snip.prefix,
							kind: SymbolKind.Variable,
							range: rg, selectionRange: rg,
							detail: snip.description
						};
					}
					break;
				case 'texts':
					kind = CompletionItemKind.Text;
					for (snip of arr)
						completionItemCache.text.push({ label: snip.prefix, kind });
					break;
				default: break;
			}
		}
		function bodytostring(body: string[] | string) { return (typeof body === 'object' ? body.join('\n') : body) };
		function trim(str: string) {
			return str.replace(/\$\{\d+((\|)|:)([^}]*)\2\}|\$\d/g, (...m) => m[2] ? m[3].replace(/,/g, '|') : m[3] || '');
		}
	}
}

export function getallahkfiles(dirpath: string, maxdeep = 3): string[] {
	let files: string[] = [];
	if (existsSync(dirpath) && statSync(dirpath = restorePath(dirpath)).isDirectory())
		enumfile(dirpath, 0);
	let exclude = extsettings.Files?.Exclude;
	if (exclude?.length)
		return files.filter(u => !exclude.some(re => (re as RegExp).test(u)));
	return files;

	function enumfile(dirpath: string, deep: number) {
		for (let file of readdirSync(dirpath)) {
			let path = resolve(dirpath, file);
			if (statSync(path).isDirectory()) {
				if (deep < maxdeep)
					enumfile(path, deep + 1);
			} else if (/\.(ahk2?|ah2)$/i.test(file))
				files.push(path);
		}
	}
}

export function inWorkspaceFolders(uri: string) {
	let u = '';
	for (let f of extsettings.WorkingDirs.concat(workspaceFolders))
		if (uri.startsWith(f) && f.length > u.length)
			u = f;
	return u;
}

export async function parseWorkspaceFolders() {
	let l: string;
	if (inBrowser) {
		let uris = (await connection.sendRequest('ahk2.getWorkspaceFiles', []) || []) as string[];
		let exclude = extsettings.Files?.Exclude;
		if (exclude?.length)
			uris = uris.filter(u => exclude.some(re => (re as RegExp).test(u)));
		for (let uri of uris)
			if (!lexers[l = uri.toLowerCase()]) {
				let v = await connection.sendRequest('ahk2.getWorkspaceFileContent', [uri]) as string;
				if (v) {
					let d = new Lexer(TextDocument.create(uri, 'ahk2', -10, v));
					d.parseScript();
					if (d.maybev1) {
						d.close();
						continue;
					}
					lexers[l] = d, parseinclude(d, d.scriptdir);
					await sleep(100);
				}
			}
	} else {
		for (let uri of workspaceFolders) {
			let dir = URI.parse(uri).fsPath, t;
			for (let file of getallahkfiles(dir)) {
				l = URI.file(file).toString().toLowerCase();
				if (!lexers[l] && (t = openFile(file, false))) {
					let d = new Lexer(t);
					d.parseScript();
					if (d.maybev1) {
						d.close();
						continue;
					}
					lexers[l] = d, parseinclude(d, d.scriptdir);
					await sleep(100);
				}
			}
		}
	}
}

export function update_settings(configs: AHKLSSettings) {
	if (typeof configs.AutoLibInclude === 'string')
		configs.AutoLibInclude = LibIncludeType[configs.AutoLibInclude] as any;
	else if (typeof configs.AutoLibInclude === 'boolean')
		configs.AutoLibInclude = configs.AutoLibInclude ? 3 : 0;
	if (typeof configs.FormatOptions?.brace_style === 'string')
		switch (configs.FormatOptions.brace_style) {
			case '0':
			case 'Allman': configs.FormatOptions.brace_style = 0; break;
			case '1':
			case 'One True Brace': configs.FormatOptions.brace_style = 1; break;
			case '-1':
			case 'One True Brace Variant': configs.FormatOptions.brace_style = -1; break;
			default: delete configs.FormatOptions.brace_style; break;
		}
	try {
		update_commentTags(configs.CommentTags);
	} catch (e: any) {
		delete e.stack;
		console.log(e);
		configs.CommentTags = extsettings.CommentTags;
	}
	if (configs.WorkingDirs instanceof Array)
		configs.WorkingDirs = configs.WorkingDirs.map(dir => (dir = URI.file(dir).toString().toLowerCase()).endsWith('/') ? dir : dir + '/');
	else delete (configs as any).WorkingDirs;
	if (configs.Files?.Exclude) {
		let t = [];
		for (let s of configs.Files.Exclude)
			try {
				t.push(glob2regexp(s as string));
			} catch (e) {
				console.log(`[Error] Invalid glob pattern: ${s}`);
			}
		configs.Files.Exclude = t;
	}
	Object.assign(extsettings, configs);
}

function encode_version(version: string) {
	let v = (version.replace(/-\w+/, '.0') + '.0').split('.');
	let n = 0;
	for (let i = 0; i < 4; i++)
		n += parseInt(v[i]) * 2 ** ((3 - i) * 10);
	return n;
}

export function update_version(version: string) {
	ahk_version = encode_version(version);
}

export async function sendAhkRequest(method: string, params: any[]) {
	if (inBrowser)
		return undefined;
	return utils.get_ahkProvider().then((server: any) => server?.sendRequest(method, ...params));
}

export function make_search_re(search: string) {
	let t = undefined;
	search = search.replace(/([*.?+^$|\\/\[\](){}])|([^\x00-\x7f])|(.)/g,
		(_, m1, m2, m3) => `${m3 || (t ??= m2) || `\\${m1}`}.*`);
	return new RegExp(t ? search : `([^\x00-\x7f]|${search})`, 'i');
}

export function clearLibfuns() { libfuncs = {}; }
export function set_ahk_h(v: boolean) { isahk2_h = v; }
export function set_ahkpath(path: string) { ahkpath_cur = path; }
export function set_Connection(conn: Connection) { connection = conn; }
export function set_dirname(dir: string) { rootdir = dir.replace(/[/\\]$/, ''); }
export function set_locale(str?: string) { if (str) locale = str.toLowerCase(); }
export function set_Workspacefolder(folders?: string[]) { workspaceFolders = folders || []; }

export async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function glob2regexp(glob: string) {
	let reStr = '^', inGroup = false, isNot: boolean, c: string;
	if (isNot = glob.startsWith('!'))
		glob = glob.slice(1);
	for (let i = 0, len = glob.length; i < len; i++) {
		switch (c = glob[i]) {
			case '/':
			case '\\':
				reStr += '[\\x5c/]';
				break;
			case '$':
			case '^':
			case '+':
			case '.':
			case '(':
			case ')':
			case '=':
			case '|':
				reStr += '\\' + c;
				break;
			case '?':
				reStr += '.';
				break;
			case '!':
				if (!i)
					isNot = true;
				else if (reStr.endsWith('['))
					reStr += '^';
				else reStr += '\\' + c;
				break;
			case '{':
				inGroup = true;
				reStr += '(';
				break;
			case '}':
				inGroup = false;
				reStr += ')';
				break;
			case ',':
				reStr += inGroup ? '|' : ',';
				break;
			case '*':
				let j = i;
				while (glob[i + 1] === '*')
					i++;
				if (i > j && /^[\x5c/]?\*+[\x5c/]?$/.test(glob.substring(j - 1, i + 2))) {
					reStr += '((?:[^\\x5c/]*(?:[\\x5c/]|$))*)';
					i++;
				} else {
					reStr += '([^\\x5c/]*)';
				}
				break;
			default:
				reStr += c;
		}
	}
	return new RegExp(isNot ? `^(?!${reStr}$)` : reStr + '$', 'i');
}