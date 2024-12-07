import { CompletionItem, CompletionItemKind, Hover, InsertTextFormat, Range, SymbolKind } from 'vscode-languageserver-types';
import { Connection, MessageConnection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { readFileSync, realpathSync, existsSync, lstatSync, readlinkSync, opendirSync } from 'fs';
import { opendir, readFile } from 'fs/promises';
import { execSync } from 'child_process';
import { resolve, sep } from 'path';
import { AhkSymbol, ActionType, FormatOptions, Lexer, check_formatopts, update_comment_tags } from './Lexer';
import { diagnostic, setting } from './localize';
import { jsDocTagNames } from './constants';
export * from './codeActionProvider';
export * from './colorProvider';
export * from './commandProvider';
export * from './completionProvider';
export * from './constants';
export * from './definitionProvider';
export * from './formattingProvider';
export * from './hoverProvider';
export * from './Lexer';
export * from './localize';
export * from './referencesProvider';
export * from './renameProvider';
export * from './semanticTokensProvider';
export * from './signatureProvider';
export * from './symbolProvider';

enum LibIncludeType {
	'Disabled',
	'Local',
	'User and Standard',
	'All'
}

export interface AHKLSSettings {
	locale?: string
	commands?: string[]
	extensionUri?: string
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

const realpath = realpathSync.native;
const STAGE: Record<string, number | string> = { ALPHA: 3, BETA: 2, RC: 1, 3: 'alpha', 2: 'beta', 1: 'rc' };
export const winapis: string[] = [];
export const lexers: Record<string, Lexer> = {};
export const alpha_3 = version_encode('2.1-alpha.3');
export const alpha_11 = alpha_3 + 8;
export const extsettings: AHKLSSettings = {
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
export const utils = {
	get_DllExport: (_paths: string[] | Set<string>, _onlyone = false) => Promise.resolve([] as string[]),
	get_RCDATA: (_path?: string) => undefined as { uri: string, path: string, paths?: string[] } | undefined,
	get_ahkProvider: async () => null as unknown as Promise<MessageConnection | null>
};

export type Maybe<T> = T | undefined;
export let connection: Connection | undefined;
export let locale = 'en-us', rootdir = '', isahk2_h = false;
export let ahkpath_cur = '', ahkpath_resolved = '';
export let ahk_version = Infinity;
export let ahkuris: Record<string, string> = {};
export let ahkvars: Record<string, AhkSymbol> = {};
export let inactivevars: Record<string, string> = {};
export let libfuncs: Record<string, LibSymbol> = {};
export const hoverCache: Record<string, [string, Hover | undefined]> = {};
export const libdirs: string[] = [];
export let workspaceFolders: string[] = [];
export let completionItemCache: {
	constant: CompletionItem[];
	directive: Record<string, CompletionItem[]>;
	key: CompletionItem[];
	keyword: CompletionItem[];
	option: Record<string, CompletionItem[]>;
	snippet: CompletionItem[];
	static: CompletionItem
	text: CompletionItem[];
};

interface LibSymbol extends Array<AhkSymbol> {
	fsPath: string
	islib: boolean
}

export function read_ahk_file(path: string, showError = true) {
	let buf: Buffer;
	try {
		buf = readFileSync(path);
		if (buf[0] === 0xff && buf[1] === 0xfe)
			return buf.toString('utf16le');
		if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
			return buf.toString('utf8').substring(1);
		try {
			return new TextDecoder('utf8', { fatal: true }).decode(buf);
		} catch {
			showError && connection?.window.showErrorMessage(diagnostic.invalidencoding(path));
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	catch (e: any) {
		if (showError) {
			delete e.stack;
			e.path = path;
			connection?.console.log(e);
		}
	}
}

export function openFile(path: string, showError = true): TextDocument | undefined {
	if (process.env.BROWSER) {
		const data = getwebfile(path);
		if (data)
			return TextDocument.create(data.url, 'ahk2', -10, data.text);
	} else {
		const text = read_ahk_file(path, showError);
		if (text !== undefined)
			return TextDocument.create(URI.file(path).toString(), 'ahk2', -10, text);
	}
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
	let path2;
	try {
		path2 = realpath(path);
	} catch { return path; }
	const s1 = path.toUpperCase(), s2 = path2.toUpperCase();
	if (s1 === s2)
		return path2;
	const [p2, a2, a1] = [path2, s2, s1].map(s => s.split(/[/\\]/));
	const l = a1.length;
	let i = 1;
	path2 = a1[0];
	if (a1[0] === a2[0])
		for (; i < l && a1[i] === a2[i]; path2 += `${sep}${p2[i++]}`);
	let dir, ent;
	try {
		for (; i < l; i++) {
			dir = opendirSync(path2);
			while ((ent = dir.readSync())) {
				if (ent.name.toUpperCase() === a1[i]) {
					path2 += `${sep}${ent.name}`;
					break;
				}
			}
			dir.close(), dir = undefined;
			if (!ent) break;
		}
		return path2;
	} catch { dir?.close(); }
	return path2 + path.substring(path2.length);
}

export function getlocalefilepath(filepath: string): string | undefined {
	const t = filepath.match(/<>./);
	let s: string;
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

export function getlocalefile(filepath: string, encoding?: BufferEncoding) {
	const path = getlocalefilepath(filepath);
	if (path)
		return readFileSync(path, encoding && { encoding });
	return undefined;
}

export function getwebfile(filepath: string) {
	let s: string | undefined;
	const t = filepath.match(/<>./), ff: string[] = [];
	const req = new XMLHttpRequest();
	if (t) {
		ff.push(filepath.replace('<>', locale));
		if (locale.toLowerCase() === 'zh-tw')
			ff.unshift(filepath.replace('<>', 'zh-cn'));
		ff.unshift(filepath.replace(t[0], ''));
	} else ff.push(filepath);
	if ((s = ff.pop()))
		return get(s);

	function get(url: string): { url: string, text: string } | undefined {
		req.open('GET', url, false);
		req.send();
		if (req.status === 200) {
			return { url, text: req.responseText };
		} else if ((s = ff.pop()))
			return get(s);
		return undefined;
	}
}

export function initahk2cache() {
	const kind = CompletionItemKind.Keyword, data = '*';
	ahkvars = {}, ahkuris = {}, inactivevars = {};
	completionItemCache = {
		constant: [],
		directive: {
			'#': [],
			'@': jsDocTagNames.map(label => ({ label, kind, data }))
		},
		key: [],
		keyword: [],
		snippet: [],
		text: [],
		option: { ahk_criteria: [], hotstring: [] },
		static: { label: 'static', insertText: 'static', kind: CompletionItemKind.Keyword }
	};
}

export function loadahk2(filename = 'ahk2', d = 3) {
	let path: string | undefined;
	const file = `${rootdir}/syntaxes/<>/${filename}`;
	if (process.env.BROWSER) {
		const td = openFile(file + '.d.ahk');
		if (td) {
			const doc = new Lexer(td, undefined, d);
			doc.parseScript(), lexers[doc.uri] = doc, ahkuris[filename] = doc.uri;
		}
		let data;
		if (filename === 'ahk2')
			if ((data = getwebfile(`${rootdir}/syntaxes/ahk2_common.json`)))
				build_item_cache(JSON.parse(data.text));
		if ((data = getwebfile(file + '.json')))
			build_item_cache(JSON.parse(data.text));
	} else {
		const syntaxes = extsettings.Syntaxes;
		const file2 = syntaxes ? `${syntaxes}/<>/${filename}` : file;
		let td: TextDocument | undefined;
		if ((path = getfilepath('.d.ahk')) && (td = openFile(restorePath(path)))) {
			const doc = new Lexer(td, undefined, d);
			doc.parseScript(), lexers[doc.uri] = doc, ahkuris[filename] = doc.uri;
		}
		if ((path = getfilepath('.json')))
			build_item_cache(JSON.parse(readFileSync(path, { encoding: 'utf8' })));
		if (filename === 'ahk2') {
			completionItemCache.static = completionItemCache.keyword.find(it => it.label === 'static') ?? completionItemCache.static;
			build_item_cache(JSON.parse(readFileSync(`${rootdir}/syntaxes/ahk2_common.json`, { encoding: 'utf8' })));
			if (syntaxes)
				opendir(syntaxes).then(async (dir) => {
					for await (const file of dir)
						if (!file.isDirectory() && file.name.toLowerCase().endsWith('.snippet.json'))
							build_item_cache(JSON.parse(await readFile(`${syntaxes}/${file}`, { encoding: 'utf8' })));
				});
		}
		function getfilepath(ext: string) {
			return getlocalefilepath(file2 + ext) || (file2 !== file ? getlocalefilepath(file + ext) : undefined);
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function build_item_cache(ahk2: any) {
		let insertTextFormat: InsertTextFormat, kind: CompletionItemKind, c;
		let snip: { prefix?: string, body: string, description?: string, syntax?: string };
		const rg = Range.create(0, 0, 0, 0);
		for (const key in ahk2) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const arr: any[] = ahk2[key];
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
						completionItemCache.keyword.push({
							label: snip.prefix, kind, insertTextFormat,
							insertText: snip.body,
							detail: snip.description,
							preselect: true
						});
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
						ahkvars[snip.body.toUpperCase()] = {
							name: snip.body,
							kind: SymbolKind.Variable,
							range: rg, selectionRange: rg,
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
export function enum_ahkfiles(dirpath: string) {
	const maxdepth = extsettings.Files.MaxDepth;
	const { file: file_exclude, folder: folder_exclude } = scanExclude;
	return enumfile(restorePath(dirpath), 0);
	async function* enumfile(dirpath: string, depth: number): AsyncGenerator<string> {
		try {
			for await (const t of await opendir(dirpath)) {
				if (t.isDirectory() && depth < maxdepth) {
					const path = resolve(dirpath, t.name);
					if (!folder_exclude?.some(re => re.test(path)))
						yield* enumfile(path, depth + 1);
				} else if (t.isFile() && /\.(ahk2?|ah2)$/i.test(t.name)) {
					const path = resolve(dirpath, t.name);
					if (!file_exclude?.some(re => re.test(path)))
						yield path;
				}
			}
		} catch { }
	}
}

export function updateConfigs(configs: AHKLSSettings) {
	if (typeof configs.AutoLibInclude === 'string')
		configs.AutoLibInclude = LibIncludeType[configs.AutoLibInclude] as unknown as LibIncludeType;
	else if (typeof configs.AutoLibInclude === 'boolean')
		configs.AutoLibInclude = configs.AutoLibInclude ? 3 : 0;
	if (typeof configs.Warn?.CallWithoutParentheses === 'string')
		configs.Warn.CallWithoutParentheses = { On: true, Off: false, Parentheses: 1 }[configs.Warn.CallWithoutParentheses];
	check_formatopts(configs.FormatOptions ?? {});
	try {
		update_comment_tags(configs.CommentTags!);
	} catch (e) {
		delete configs.CommentTags;
		connection?.window.showWarningMessage(setting.valueerr('CommentTags', 'RegExp',
			(e as { message: string }).message));
	}
	if (configs.WorkingDirs instanceof Array)
		configs.WorkingDirs = configs.WorkingDirs.map(dir =>
			(dir = URI.file(dir.includes(':') ? dir : resolve(dir)).toString().toLowerCase())
				.endsWith('/') ? dir : dir + '/');
	else configs.WorkingDirs = [];
	scanExclude = {};
	if (configs.Files) {
		const file: RegExp[] = [], folder: RegExp[] = [];
		for (const s of configs.Files.Exclude ?? [])
			try {
				(/[\\/]$/.test(s) ? folder : file).push(glob2regexp(s));
			} catch {
				connection?.window.showWarningMessage(
					setting.valueerr('Files.Exclude', 'glob pattern', s));
			}
		if (file.length)
			scanExclude.file = file;
		if (folder.length)
			scanExclude.folder = folder;
		if ((configs.Files.MaxDepth ??= 2) < 0)
			configs.Files.MaxDepth = Infinity;
	}
	if (configs.Syntaxes && !process.env.BROWSER) {
		const path = resolvePath(configs.Syntaxes, true);
		if (path && lstatSync(path).isDirectory())
			configs.Syntaxes = restorePath(path);
		else {
			connection?.window.showWarningMessage(
				setting.valueerr('Syntaxes', 'folder path', configs.Syntaxes));
			delete configs.Syntaxes;
		}
	}
	Object.assign(extsettings, configs);
}

function version_encode(version: string) {
	const v = version.replace(/-\w+/, s => `.-${STAGE[s.substring(1).toUpperCase()]}`).split('.');
	let n = 0;
	for (let i = 0; i < 4; i++)
		n += parseInt(v[i] ?? '0') * 1000 ** (3 - i);
	return n;
}

export function version_decode(n: number) {
	const v: number[] = [];
	n += 3000;
	for (let i = 0; i < 4; i++)
		v[3 - i] = n % 1000, n = Math.floor(n / 1000);
	(v[2] -= 3) >= 0 && (n = v.pop()!) && v.push(n);
	return v.join('.').replace(/\.-\d+/, s => `-${STAGE[s.substring(2)]}`);
}

export function version_match(requires: string) {
	next:
	for (const req of requires.split('||')) {
		for (const m of req.matchAll(/(ahk_h\s*)?([<>]=?|=)?([^<>=]+)/g)) {
			if (m[1] && !isahk2_h) continue next;
			const v = version_encode(m[3]);
			let result = false;
			switch (m[2] ?? '>=') {
				case '>=': result = ahk_version >= v; break;
				case '<=': result = ahk_version <= v; break;
				case '=': result = ahk_version === v; break;
				case '>': result = ahk_version > v; break;
				case '<': result = ahk_version < v; break;
			}
			if (!result) continue next;
		}
		return true;
	}
	return false;
}

export async function sendAhkRequest(method: string, params: unknown[]) {
	if (process.env.BROWSER)
		return undefined;
	return utils.get_ahkProvider().then((server) => server?.sendRequest(method, ...params));
}

export function make_search_re(search: string) {
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

export function clearLibfuns() { libfuncs = {}; }
export function set_ahk_h(v: boolean) { isahk2_h = v; }
export function set_ahkpath(path: string) {
	const resolved = resolvePath(path, true);
	if (resolved)
		ahkpath_cur = path, ahkpath_resolved = resolved;
}
export function setConnection(conn: Connection) { return connection = conn; }
export function setRootDir(dir: string) { rootdir = dir.replace(/[/\\]$/, ''); }
export function setLocale(str?: string) { if (str) locale = str.toLowerCase(); }
export function setVersion(version: string) { ahk_version = version_encode(version); }
export function setWorkspaceFolders(folders: Set<string>) {
	const old = workspaceFolders;
	workspaceFolders = [...folders];
	extsettings.WorkingDirs.forEach(it => !folders.has(it) && workspaceFolders.push(it));
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

function glob2regexp(glob: string) {
	let reStr = '', inGroup = false, isNot: boolean, c: string;
	if ((isNot = glob.startsWith('!')))
		glob = glob.slice(1);
	for (let i = 0, j, len = glob.length; i < len; i++) {
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
				j = i;
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