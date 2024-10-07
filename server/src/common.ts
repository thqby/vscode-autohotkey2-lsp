import { resolve, sep } from 'path';
import { URI } from 'vscode-uri';
import { readdirSync, readFileSync, existsSync, statSync, promises as fs } from 'fs';
import { Connection, MessageConnection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind, Hover, InsertTextFormat, Range, SymbolKind } from 'vscode-languageserver-types';
import { AhkSymbol, Lexer, fixupFormatConfig, updateCommentTagRegex } from './lexer';
import { diagnostic } from './localize';
import { jsDocTagNames } from './constants';
import { AHKLSConfig, CfgKey, getCfg, LibIncludeType, setCfg, setConfigRoot } from '../../util/src/config';
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
export * from './referencesProvider';
export * from './renameProvider';
export * from './semanticTokensProvider';
export * from './signatureProvider';
export * from './symbolProvider';

export const winapis: string[] = [];
export const lexers: Record<string, Lexer> = {};
export const alpha_3 = encode_version('2.1-alpha.3');
export const utils = {
	get_DllExport: (_paths: string[] | Set<string>, _onlyone = false) => Promise.resolve([] as string[]),
	get_RCDATA: (_path?: string) => undefined as { uri: string, path: string, paths?: string[] } | undefined,
	get_ahkProvider: async () => null as unknown as Promise<MessageConnection | null>
};

export type Maybe<T> = T | undefined;
export let connection: Connection | undefined;
export let interpreterPath = '', locale = 'en-us', rootdir = '', isahk2_h = false;
export let ahk_version = encode_version('3.0.0.0');
export let ahkuris: Record<string, string> = {};
export let ahkvars: Record<string, AhkSymbol> = {};
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
			console.log(e);
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
	if (process.env.BROWSER || !existsSync(path))
		return path;
	if (path.includes('..'))
		path = resolve(path);
	const dirs = path.split(/[/\\]/);
	let s = dirs.shift()!.toLowerCase(), l;
	for (let dir of dirs) {
		if ((l = dir.toLowerCase()))
			try {
				for (const d of readdirSync(s))
					if (d === l) { dir = d; break; }
			} catch { }
		s += sep + dir;
	}
	return s;
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
	ahkvars = {}, ahkuris = {};
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

/** Loads IntelliSense hover text */
export function loadAHK2(filename = 'ahk2', d = 3) {
	let path: string | undefined;
	const syntaxesPath = process.env.SYNTAXES_PATH || 'syntaxes';
	const file = `${rootdir}/${syntaxesPath}/<>/${filename}`;
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
		const syntaxConfig = getCfg(CfgKey.Syntaxes);
		const syntaxes = syntaxConfig && existsSync(syntaxConfig) ? syntaxConfig : '';
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
				for (let file of readdirSync(syntaxes)) {
					if (file.toLowerCase().endsWith('.snippet.json') && !statSync(file = `${path}/${file}`).isDirectory())
						build_item_cache(JSON.parse(readFileSync(file, { encoding: 'utf8' })));
				}
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
			return str.replace(/\$\{\d+((\|)|:)([^}]*)\2\}|\$\d/g, (...m) => m[2] ? m[3].replace(/,/g, '|') : m[3] || '');
		}
	}
}


let scanExclude: { file?: RegExp[], folder?: RegExp[] } = {};
export function enum_ahkfiles(dirpath: string) {
	const maxScanDepth = getCfg<number>(CfgKey.MaxScanDepth);
	const { file: fileExclude, folder: folderExclude } = scanExclude;
	return enumfile(restorePath(dirpath), 0);
	async function* enumfile(dirpath: string, depth: number): AsyncGenerator<string> {
		try {
			const dir = await fs.opendir(dirpath);
			for await (const t of dir) {
				if (t.isDirectory() && depth < maxScanDepth) {
					const path = resolve(dirpath, t.name);
					if (!folderExclude?.some(re => re.test(path)))
						yield* enumfile(path, depth + 1);
				} else if (t.isFile() && /\.(ahk2?|ah2)$/i.test(t.name)) {
					const path = resolve(dirpath, t.name);
					if (!fileExclude?.some(re => re.test(path)))
						yield path;
				}
			}
		} catch (e) { }
	}
}

/**
 * Update the extension config (`ahklsConfig`) in-memory.
 * Does not update user settings.
 */
export function updateConfig(newConfig: AHKLSConfig): void {
	const newConfigLibSuggestions = getCfg(CfgKey.LibrarySuggestions, newConfig);
	if (typeof newConfigLibSuggestions === 'boolean')
		setCfg(CfgKey.LibrarySuggestions, newConfigLibSuggestions ? LibIncludeType.All : LibIncludeType.Disabled, newConfig);
	fixupFormatConfig(getCfg(CfgKey.Formatter, newConfig) ?? {});
	try {
		updateCommentTagRegex(getCfg(CfgKey.CommentTagRegex, newConfig));
	} catch (e) {
		delete (e as { stack?: string }).stack;
		// reset value of `newConfig` to avoid corrupting `ahklsConfig`
		setCfg(CfgKey.CommentTagRegex, getCfg(CfgKey.CommentTagRegex), newConfig);
		console.log(e);
	}
	const newConfigWorkingDirs = getCfg<string[]>(CfgKey.WorkingDirectories, newConfig);
	if (newConfigWorkingDirs instanceof Array)
		setCfg(CfgKey.WorkingDirectories, newConfigWorkingDirs.map(dir =>
			(dir = URI.file(dir.includes(':') ? dir : resolve(dir)).toString().toLowerCase())
				.endsWith('/') ? dir : dir + '/'), newConfig);
	else setCfg(CfgKey.WorkingDirectories, [], newConfig);
	scanExclude = {};
	if (getCfg(CfgKey.Exclude, newConfig)) {
		const file: RegExp[] = [], folder: RegExp[] = [];
		for (const s of getCfg(CfgKey.Exclude, newConfig))
			try {
				(/[\\/]$/.test(s) ? folder : file).push(glob2regexp(s));
			} catch (e) {
				console.log(`[Error] Invalid glob pattern: ${s}`);
			}
		if (file.length)
			scanExclude.file = file;
		if (folder.length)
			scanExclude.folder = folder;
		let maxScanDepth = getCfg<number | undefined>(CfgKey.MaxScanDepth, newConfig);
		if (maxScanDepth === undefined) {
			maxScanDepth = 2;
		}
		if (maxScanDepth < 0)
			maxScanDepth = Infinity;
		setCfg(CfgKey.MaxScanDepth, maxScanDepth, newConfig);
	}
	const newSyntaxes = getCfg<string>(CfgKey.Syntaxes, newConfig);
	if (newSyntaxes)
		setCfg(CfgKey.Syntaxes, resolve(newSyntaxes).toLowerCase(), newConfig);
	setConfigRoot(newConfig);
}

function encode_version(version: string) {
	const STAGE: Record<string, number> = { ALPHA: -3, BETA: -2, RC: -1 };
	const v = (version.replace(/-\w+/, s => `.${STAGE[s.substring(1).toUpperCase()]}`) + '.0').split('.');
	let n = 0;
	for (let i = 0; i < 4; i++)
		n += parseInt(v[i]) * 2 ** ((3 - i) * 10);
	return n;
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
export function setInterpreterPath(path: string) { interpreterPath = path.replace(/^.:/, s => s.toLowerCase()); }
export function set_Connection(conn: Connection) { return connection = conn; }
export function set_dirname(dir: string) { rootdir = dir.replace(/[/\\]$/, ''); }
export function set_locale(str?: string) { if (str) locale = str.toLowerCase(); }
export function set_version(version: string) { ahk_version = encode_version(version); }
export function set_WorkspaceFolders(folders: Set<string>) {
	const old = workspaceFolders;
	workspaceFolders = [...folders];
	getCfg<string[]>(CfgKey.WorkingDirectories).forEach(it => !folders.has(it) && workspaceFolders.push(it));
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
