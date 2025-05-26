import { execSync } from 'child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from 'fs';
import { opendir, readFile } from 'fs/promises';
import { resolve, sep } from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, Diagnostic, Hover, InsertTextFormat } from 'vscode-languageserver-types';
import { URI } from 'vscode-uri';
import { jsDocTagNames } from './constants';
import { ActionType, AhkSymbol, FormatOptions, Lexer, ZERO_RANGE, fixupFormatOptions, traverseInclude } from './lexer';
import { diagnostic, setting } from './localize';
import { CompletionItemKind, MessageType, SymbolKind } from './lsp-enums';
import { MessageActionItem } from 'vscode-languageclient';
export * from './codeActionProvider';
export * from './colorProvider';
export * from './commandProvider';
export * from './completionProvider';
export * from './constants';
export * from './definitionProvider';
export * from './formattingProvider';
export * from './hoverProvider';
export * from './lexer';
export * from './localize';
export * from './lsp-enums';
export * from './referencesProvider';
export * from './renameProvider';
export * from './semanticTokensProvider';
export * from './signatureProvider';
export * from './symbolProvider';
export { URI };

enum LibIncludeType {
	'Disabled',
	'Local',
	'User and Standard',
	'All'
}

export interface LSConfig {
	// only in initialization options
	locale?: string
	commands?: string[]
	extensionUri?: string
	fullySemanticToken?: boolean
	// settings
	ActionWhenV1IsDetected: ActionType
	AutoLibInclude: LibIncludeType
	CommentTags?: string
	CompleteFunctionParens: boolean
	CompletionCommitCharacters?: {
		Class: string
		Function: string
	}
	Diagnostics: {
		ClassNonDynamicMemberCheck: boolean
		ParamsCheck: boolean
	}
	Files: {
		Exclude: string[]
		MaxDepth: number
	}
	FormatOptions: FormatOptions
	InterpreterPath: string
	GlobalStorage?: string
	Syntaxes?: string
	SymbolFoldingFromOpenBrace: boolean
	Warn: {
		VarUnset: boolean
		LocalSameAsGlobal: boolean
		CallWithoutParentheses: boolean | /* Parentheses */ 1
	}
	WorkingDirs: string[]
}

interface Utils {
	getAhkVersion?(paths: string[]): Promise<string[]>
	getDllExport?(paths: string[] | Set<string>, onlyone?: boolean): Promise<string[]>
	getRCData?(path?: string): { uri: string, path: string, paths?: string[] } | undefined
	sendAhkRequest?<T>(method: string, params: unknown[]): Promise<T | undefined>
	sendDiagnostics?(uri: string, diagnostics: Diagnostic[]): Promise<void>
	sendNotification?(method: string, params?: unknown): void
	sendRequest?<T>(method: string, params?: unknown): Promise<T>
	setInterpreter?(path: string): Promise<void>
	showMessage(type: MessageType, message: string, ...actions: MessageActionItem[]): Promise<MessageActionItem | null>
	updateStatusBar?(path?: string): void
}

const VERSION_STAGE: Record<string, number | string> = { ALPHA: 3, BETA: 2, RC: 1, 3: 'alpha', 2: 'beta', 1: 'rc' };
export const winapis: string[] = [];
export const lexers: Record<string, Lexer> = {};
export const alpha_3 = versionEncode('2.1-alpha.3');
export const alpha_11 = alpha_3 + 8;
export const configCache: LSConfig = {
	ActionWhenV1IsDetected: 'Warn',
	AutoLibInclude: 0,
	CommentTags: '^;;\\s*(.*)',
	CompleteFunctionParens: false,
	CompletionCommitCharacters: {
		Class: '.(',
		Function: '('
	},
	Diagnostics: {
		ClassNonDynamicMemberCheck: true,
		ParamsCheck: true
	},
	Files: {
		Exclude: [],
		MaxDepth: 2
	},
	FormatOptions: {},
	InterpreterPath: 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe',
	SymbolFoldingFromOpenBrace: false,
	Warn: {
		VarUnset: true,
		LocalSameAsGlobal: false,
		CallWithoutParentheses: false
	},
	WorkingDirs: []
};
export const hoverCache: Record<string, [string, Hover | undefined]> = {};
export const libDirs: string[] = [];
export const utils: Utils = {
	showMessage: async (_, message) => (console.log(message), null)
};

export type Maybe<T> = T | undefined;
export let locale = 'en-us', rootDir = '', isahk2_h = false;
export let ahkPath = '', ahkPath_resolved = '';
export let ahkVersion = Infinity, reservedIndex = 0;
export let ahkUris: Record<string, string> = {};
export let ahkVars: Record<string, AhkSymbol> = {};
export let inactiveVars: Record<string, string> = {};
export let libSymbols: Record<string, LibSymbol> = {};
export let commentTags: RegExp | undefined;
export let workspaceFolders: string[] = [];
export let completionItemCache: {
	constant: CompletionItem[];
	directive: Record<string, CompletionItem[]>;
	key: CompletionItem[];
	keyword: Record<string, CompletionItem>;
	option: Record<string, CompletionItem[]>;
	snippet: CompletionItem[];
	text: CompletionItem[];
};

interface LibSymbol extends Array<AhkSymbol> {
	fsPath: string
	islib: boolean
}

function bufferDecode(buf: Buffer | Uint8Array) {
	let encoding = 'utf-8', fatal;
	if (buf[0] === 0xff && buf[1] === 0xfe)
		encoding = 'utf-16le';
	else if (!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf))
		fatal = true;
	try { return new TextDecoder(encoding, { fatal }).decode(buf); } catch { }
}

export function readTextFile(path: string, showError = true) {
	try {
		const s = bufferDecode(readFileSync(path));
		showError && s === undefined && utils.showMessage(MessageType.Error, diagnostic.invalidencoding(path));
		return s;
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	catch (e: any) {
		if (showError) {
			delete e.stack;
			e.path = path;
			console.error(e);
		}
	}
}

export function openFile(path: string, showError = true): TextDocument | undefined {
	if (process.env.BROWSER)
		return;
	const text = readTextFile(path, showError);
	if (text !== undefined)
		return TextDocument.create(URI.file(path).toString(), 'ahk2', -10, text);
}

export function openAndParse(path: string, showError = true, cache = true) {
	const td = openFile(path, showError);
	if (td) {
		const lex = new Lexer(td);
		lex.parseScript();
		cache && (lexers[lex.uri] = lex);
		return lex;
	}
}

export function restorePath(path: string): string {
	if (process.env.BROWSER)
		return path;
	else {
		let path2;
		try {
			path2 = realpathSync.native(path);
		} catch { return path; }
		const s1 = path.toUpperCase(), s2 = path2.toUpperCase();
		if (s1 === s2)
			return path2;
		const [p2, a2, a1] = [path2, s2, s1].map(s => s.split(/[/\\]/));
		const l = a1.length;
		try {
			let i, s;
			for (i = 0; i < l && a1[i] === a2[i]; i++);
			next: for (path2 = p2.slice(0, i ||= (p2[0] = a1[0], 1)).join(sep); i < l;) {
				s = a1[i++];
				for (const ent of readdirSync(path2 += sep)) {
					if (ent.toUpperCase() === s) {
						path2 += ent;
						continue next;
					}
				}
				break;
			}
		} catch { }
		return path2 + path.substring(path2.length);
	}
}

function getLocalePath(filepath: string) {
	const t = filepath.match(/<>./);
	if (t) {
		let s = filepath.replace('<>', locale);
		if (existsSync(s))
			return s;
		if (locale === 'zh-tw' && existsSync(s = filepath.replace('<>', 'zh-cn')))
			return s;
		if (existsSync(s = filepath.replace(t[0], '')))
			return s;
	} else if (existsSync(filepath))
		return filepath;
}

export function readLocaleFile(filepath: string) {
	const path = getLocalePath(filepath);
	return path && bufferDecode(readFileSync(path));
}

export function getWorkspaceFile(uri: string) {
	return utils.sendRequest!<{ buffer: Uint8Array, uri: string } | null>('getWorkspaceFileContent', uri)
		.then(r => {
			const text = r && bufferDecode(r.buffer);
			if (text)
				return { uri: r.uri, text };
		});
}

export function initCaches() {
	const kind = CompletionItemKind.Keyword, data = '*';
	ahkVars = {}, ahkUris = {}, inactiveVars = {};
	completionItemCache = {
		constant: [],
		directive: {
			'#': [],
			'@': jsDocTagNames.map(label => ({ label, kind, data }))
		},
		key: [],
		keyword: {},
		snippet: [],
		text: [],
		option: { ahk_criteria: [], hotstring: [] }
	};
}

export function loadSyntax(filename = 'ahk2', d = 3) {
	let path: string | undefined;
	const file = `${rootDir}/syntaxes/<>/${filename}`, files: string[] = [];
	if (process.env.BROWSER) {
		getWorkspaceFile(`${file}.d.ahk`).then(v => v && load_td(TextDocument.create(v.uri, 'ahk2', -10, v.text)));
		filename === 'ahk2' && files.push(`${rootDir}/syntaxes/ahk2_common.json`);
		files.push(`${file}.json`);
		files.forEach(file => getWorkspaceFile(file).then(r => build_item_cache(r?.text)));
	} else {
		const syntaxes = configCache.Syntaxes;
		const file2 = syntaxes ? `${syntaxes}/<>/${filename}` : file;
		const td = (path = getfilepath('.d.ahk')) && openFile(restorePath(path));
		td && load_td(td);
		if (filename === 'ahk2') {
			existsSync(path = `${rootDir}/syntaxes/ahk2_common.json`) && files.push(path);
			syntaxes && opendir(syntaxes).then(async dir => {
				for await (const file of dir)
					!file.isDirectory() && file.name.toLowerCase().endsWith('.snippet.json') &&
						readFile(`${syntaxes}/${file}`).then(buf => build_item_cache(bufferDecode(buf)));
			});
		}
		(path = getfilepath('.json')) && files.push(path);
		files.forEach(file => readFile(file).then(buf => build_item_cache(bufferDecode(buf))));
		function getfilepath(ext: string) {
			return getLocalePath(file2 + ext) || (file2 !== file ? getLocalePath(file + ext) : undefined);
		}
	}
	function load_td(td: TextDocument) {
		const lex = new Lexer(td, undefined, d);
		lex.parseScript(), lexers[lex.uri] = lex, ahkUris[filename] = lex.uri;
	}
	function build_item_cache(str?: string) {
		const obj = JSON.parse(str || '{}');
		let insertTextFormat: InsertTextFormat, kind: CompletionItemKind, c;
		let snip: { prefix?: string, body: string, description?: string, syntax?: string };
		for (const key in obj) {
			const arr = obj[key];
			switch (key) {
				case 'constants':
					kind = CompletionItemKind.Constant;
					insertTextFormat = InsertTextFormat.Snippet;
					for (snip of arr) {
						completionItemCache.constant.push({
							label: snip.prefix!, kind, insertTextFormat,
							insertText: `\${1:${snip.prefix} := }${snip.body}$0`,
							detail: snip.description ?? snip.body
						});
					}
					break;
				case 'directives':
					c = '';
					kind = CompletionItemKind.Keyword;
					insertTextFormat = InsertTextFormat.Snippet;
					for (snip of arr) {
						snip.prefix ??= snip.body.trim();
						if (!'@#'.includes(c = snip.prefix.charAt(0)))
							continue;
						completionItemCache.directive[c].push({
							label: snip.prefix.replace(/^[^#\w]/, ''),
							insertText: snip.body.replace(/^\W+/, ''),
							kind, insertTextFormat,
							detail: snip.description,
							data: snip.body.charAt(0)
						});
						if (c === '#')
							hoverCache[snip.prefix.toLowerCase()] = [snip.prefix, {
								contents: { kind: 'markdown', value: '```ahk2\n' + (snip.syntax ?? trim(snip.body)) + '\n```\n\n' + (snip.description ?? '') }
							}];
					}
					break;
				case 'keys':
					kind = CompletionItemKind.Keyword;
					for (snip of arr) {
						completionItemCache.key.push({
							label: snip.body, kind,
							detail: snip.description
						});
					}
					break;
				case 'keywords':
					kind = CompletionItemKind.Keyword;
					insertTextFormat = InsertTextFormat.Snippet;
					for (snip of arr) {
						snip.prefix ??= snip.body.trim();
						completionItemCache.keyword[snip.prefix] = {
							label: snip.prefix, kind, insertTextFormat,
							insertText: snip.body,
							detail: snip.description,
							preselect: true
						};
						hoverCache[snip.prefix.toLowerCase()] = [snip.prefix, { contents: { kind: 'markdown', value: '```ahk2\n' + (snip.syntax ?? trim(snip.body)) + '\n```\n\n' + (snip.description ?? '') } }];
					}
					break;
				case 'snippet':
					kind = CompletionItemKind.Snippet;
					insertTextFormat = InsertTextFormat.Snippet;
					for (snip of arr) {
						completionItemCache.snippet.push({
							label: snip.prefix!,
							insertText: bodytostring(snip.body),
							detail: snip.description,
							kind, insertTextFormat
						});
					}
					break;
				case 'variables':
					for (snip of arr) {
						ahkVars[snip.body.toUpperCase()] = {
							name: snip.body,
							kind: SymbolKind.Variable,
							range: ZERO_RANGE, selectionRange: ZERO_RANGE,
							detail: snip.description
						};
					}
					break;
				case 'texts':
					kind = CompletionItemKind.Text;
					for (snip of arr)
						completionItemCache.text.push({ label: snip.body, kind });
					break;
				case 'options':
					kind = CompletionItemKind.Text;
					for (const k in arr) {
						const t = completionItemCache.option[k] ??= [];
						for (snip of arr[k])
							t.push({
								label: snip.body, kind,
								detail: snip.description
							});
					}
					break;
				default: break;
			}
		}
		function bodytostring(body: string[] | string) { return (typeof body === 'object' ? body.join('\n') : body) };
		function trim(str: string) {
			return str.replace(/\$\{\d+((\|)|:)([^}]*)\2\}|\$\d/g, (...m) => m[2] ? m[3].replaceAll(',', '|') : m[3] || '');
		}
	}
}

let scanExclude: { file?: RegExp[], folder?: RegExp[] } = {};
export function enumFiles(dirpath: string, filter = /\.(ahk2?|ah2)$/i) {
	const maxdepth = configCache.Files.MaxDepth;
	const { file: file_exclude, folder: folder_exclude } = scanExclude;
	return enumfile(restorePath(dirpath), 0);
	async function* enumfile(dirpath: string, depth: number): AsyncGenerator<string> {
		try {
			for await (const t of await opendir(dirpath)) {
				if (t.isDirectory() && depth < maxdepth) {
					const path = resolve(dirpath, t.name);
					if (!folder_exclude?.some(re => re.test(path)))
						yield* enumfile(path, depth + 1);
				} else if (t.isFile() && filter.test(t.name)) {
					const path = resolve(dirpath, t.name);
					if (!file_exclude?.some(re => re.test(path)))
						yield path;
				}
			}
		} catch { }
	}
}

export function updateConfig(config: LSConfig) {
	if (typeof config.AutoLibInclude === 'string')
		config.AutoLibInclude = LibIncludeType[config.AutoLibInclude] as unknown as LibIncludeType;
	else if (typeof config.AutoLibInclude === 'boolean')
		config.AutoLibInclude = config.AutoLibInclude ? 3 : 0;
	if (typeof config.Warn?.CallWithoutParentheses === 'string')
		config.Warn.CallWithoutParentheses = { On: true, Off: false, Parentheses: 1 }[config.Warn.CallWithoutParentheses];
	fixupFormatOptions(config.FormatOptions ?? {});
	try {
		commentTags = config.CommentTags ? new RegExp(config.CommentTags, 'i') : undefined;
	} catch (e) {
		delete config.CommentTags;
		utils.showMessage(MessageType.Warning, setting.valueerr('CommentTags', 'RegExp',
			(e as { message: string }).message));
	}
	if (config.WorkingDirs instanceof Array)
		config.WorkingDirs = config.WorkingDirs.map(dir =>
			(dir = URI.file(dir.includes(':') ? dir : resolve(dir)).toString().toLowerCase())
				.endsWith('/') ? dir : dir + '/');
	else config.WorkingDirs = [];
	scanExclude = {};
	if (config.Files) {
		const file: RegExp[] = [], folder: RegExp[] = [];
		for (const s of config.Files.Exclude ?? [])
			try {
				(/[\\/]$/.test(s) ? folder : file).push(glob2RegExp(s));
			} catch {
				utils.showMessage(MessageType.Warning,
					setting.valueerr('Files.Exclude', 'glob pattern', s));
			}
		if (file.length)
			scanExclude.file = file;
		if (folder.length)
			scanExclude.folder = folder;
		if ((config.Files.MaxDepth ??= 2) < 0)
			config.Files.MaxDepth = Infinity;
	}
	if (config.Syntaxes && !process.env.BROWSER) {
		const path = resolvePath(config.Syntaxes, true);
		if (path && lstatSync(path).isDirectory())
			config.Syntaxes = restorePath(path);
		else {
			utils.showMessage(MessageType.Error,
				setting.valueerr('Syntaxes', 'folder path', config.Syntaxes));
			delete config.Syntaxes;
		}
	}
	Object.assign(configCache, config);
}

function versionEncode(version: string) {
	const v = version.replace(/-\w+/, s => `.-${VERSION_STAGE[s.substring(1).toUpperCase()]}`).split('.');
	let n = 0;
	for (let i = 0; i < 4; i++)
		n += parseInt(v[i] ?? '0') * 1000 ** (3 - i);
	return n;
}

export function versionDecode(n: number) {
	const v: number[] = [];
	n += 3000;
	for (let i = 0; i < 4; i++)
		v[3 - i] = n % 1000, n = Math.floor(n / 1000);
	(v[2] -= 3) >= 0 && (n = v.pop()!) && v.push(n);
	return v.join('.').replace(/\.-\d+/, s => `-${VERSION_STAGE[s.substring(2)]}`);
}

export function versionMatch(requires: string) {
	next:
	for (const req of requires.split('||')) {
		for (const m of req.matchAll(/(ahk_h\s*)?([<>]=?|=)?([^<>=]+)/g)) {
			if (m[1] && !isahk2_h) continue next;
			const v = versionEncode(m[3]);
			let result = false;
			switch (m[2] ?? '>=') {
				case '>=': result = ahkVersion >= v; break;
				case '<=': result = ahkVersion <= v; break;
				case '=': result = ahkVersion === v; break;
				case '>': result = ahkVersion > v; break;
				case '<': result = ahkVersion < v; break;
			}
			if (!result) continue next;
		}
		return true;
	}
	return false;
}

export function makeSearchRegExp(search: string) {
	let t = undefined;
	search = search.replace(/([*.?+^$|\\/[\](){}])|([^\x00-\x7f])|(.)/g,
		(_, m1, m2, m3) => `${m3 || (t ??= m2) || `\\${m1}`}.*`);
	return new RegExp(t ? search : `([^\\x00-\\x7f]|${search})`, 'i');
}

export function enumNames(enumType: object): string[] {
	return Object.values(enumType).filter(v => typeof v === 'string');
}

export function arrayEqual(a: string[], b: string[]) {
	if (a.length !== b.length)
		return false;
	a.sort(), b.sort();
	return !a.some((v, i) => v !== b[i]);
}

export function clearLibSymbols() { libSymbols = {}; }
export function setIsAhkH(v: boolean) { isahk2_h = v; }
export function setAhkPath(path: string) {
	const resolved = resolvePath(path, true);
	if (resolved)
		ahkPath = path, ahkPath_resolved = resolved;
}
export function setRootDir(dir: string) { rootDir = dir.replace(/[/\\]$/, ''); }
export function setLocale(str?: string) { if (str) locale = str.toLowerCase(); }
export function setVersion(version: string) {
	ahkVersion = versionEncode(version);
	reservedIndex = ahkVersion < alpha_11 ? 1 : 0;
}
export function setWorkspaceFolders(folders: Set<string>) {
	const old = workspaceFolders;
	workspaceFolders = [...folders];
	configCache.WorkingDirs.forEach(it => !folders.has(it) && workspaceFolders.push(it));
	workspaceFolders.sort().reverse();
	if (old.length === workspaceFolders.length &&
		!old.some((v, i) => workspaceFolders[i] !== v))
		return;
	for (const d of Object.values(lexers))
		lexers[d.uri] && !d.setWorkspaceFolder() && !d.actived && d.close();
}

export async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function resolvePath(path: string, resolveSymbolicLink = false): string {
	if (process.env.BROWSER || !path)
		return path;
	const paths: string[] = [];
	path = path.replace(/%(\w+)%/g, (s0, s1) => process.env[s1] ?? s0);
	if (!path.includes(':'))
		paths.push(resolve(path));
	if (process.platform === 'win32' && !/[\\/]/.test(path))
		try { paths.push(execSync(`chcp 65001 > nul && where ${path}`, { encoding: 'utf-8' }).trim()); } catch { }
	paths.push(path);
	for (let path of paths) {
		if (!path) continue;
		try {
			if (lstatSync(path).isSymbolicLink() && resolveSymbolicLink)
				lstatSync(path = resolve(path, '..', readlinkSync(path)));
			return path;
		} catch { }
	}
	return '';
}

function glob2RegExp(glob: string) {
	let reStr = '', inGroup = false, isNot: boolean, c: string;
	if ((isNot = glob.startsWith('!')))
		glob = glob.slice(1);
	for (let i = 0, j, len = glob.length; i < len; i++) {
		switch (c = glob[i]) {
			case '/': case '\\': reStr += '[\\x5c/]'; break;
			case '$': case '^': case '+': case '.':
			case '(': case ')': case '=': case '|': reStr += '\\' + c; break;
			case '?': reStr += '.'; break;
			case '!': reStr += reStr.endsWith('[') ? '^' : '\\' + c; break;
			case '{': inGroup = true, reStr += '('; break;
			case '}': inGroup = false, reStr += ')'; break;
			case ',': reStr += inGroup ? '|' : ','; break;
			case '*':
				j = i;
				while (glob[i + 1] === '*')
					i++;
				if (i > j && /^[\x5c/]?\*+[\x5c/]?$/.test(glob.substring(j - 1, i + 2)))
					reStr += '((?:[^\\x5c/]*(?:[\\x5c/]|$))*)', i++;
				else reStr += '([^\\x5c/]*)';
				break;
			default: reStr += c; break;
		}
	}
	if (/^([a-zA-Z]:|\*\*)/.test(glob))
		reStr = '^' + reStr;
	else if (!/[\\/]/.test(glob[0]))
		reStr = '[\\x5c/]' + reStr;
	if (!/[\\/]$/.test(glob))
		reStr += '$';
	if (isNot)
		reStr = reStr.startsWith('^') ? `^(?!${reStr})` : `(?!${reStr})`;
	return new RegExp(reStr, 'i');
}

export function parseInclude(lex: Lexer, dir: string, _set = new Set()) {
	const include = lex.include, l = dir.toLowerCase();
	_set.add(lex);
	for (const uri in include) {
		const path = include[uri];
		let lex, t;
		if (!(lex = lexers[uri])) {
			if (!existsSync(path) || !(t = openFile(restorePath(path))))
				continue;
			(lexers[uri] = lex = new Lexer(t, dir)).parseScript();
		} else if (lex.scriptdir.toLowerCase() !== l && (lex.initLibDirs(dir), lex.need_scriptdir) || lex.last_diags)
			lex.parseScript();
		_set.has(lex) || parseInclude(lex, dir, _set);
	}
}

export async function parseProject(uri: string) {
	let lex = lexers[uri];
	if (!lex || !uri.startsWith('file:'))
		return;
	!lex.d && (libSymbols[uri] ??= getLibSymbols(lex));
	let searchdir = lex.workspaceFolder, workspace = false, path: string, t: TextDocument | undefined;
	if (searchdir)
		searchdir = URI.parse(searchdir).fsPath, workspace = true;
	else searchdir = lex.scriptdir + '\\lib';
	for await (path of enumFiles(searchdir)) {
		if (!libSymbols[uri = URI.file(path).toString().toLowerCase()]) {
			if (!(lex = lexers[uri])) {
				if (!(t = openFile(path)) || (lex = new Lexer(t)).d || (lex.parseScript(), lex.maybev1))
					continue;
				if (workspace) {
					parseInclude(lexers[uri] = lex, lex.scriptdir);
					traverseInclude(lex);
				}
			}
			libSymbols[uri] = getLibSymbols(lex);
			await sleep(50);
		}
	}
}

export async function parseUserLib() {
	let dir: string, path: string, uri: string, d: Lexer, t: TextDocument | undefined;
	for (dir of libDirs)
		for await (path of enumFiles(dir)) {
			if (!libSymbols[uri = URI.file(path).toString().toLowerCase()]) {
				if (!(d = lexers[uri]))
					if (!(t = openFile(path)) || (d = new Lexer(t)).d || (d.parseScript(), d.maybev1))
						continue;
				libSymbols[uri] = getLibSymbols(d);
				await sleep(50);
			}
		}
}

function getLibSymbols(lex: Lexer) {
	return Object.assign(
		Object.values(lex.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function),
		{ fsPath: lex.fsPath, islib: inLibDirs(lex.fsPath) }
	);
}

export function inLibDirs(path: string) {
	path = path.toLowerCase();
	return libDirs.some(p => path.startsWith(p.toLowerCase()));
}
