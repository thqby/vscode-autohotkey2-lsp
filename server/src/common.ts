import { resolve, sep } from 'path';
import { URI } from 'vscode-uri';
import { readdirSync, readFileSync, existsSync, statSync, promises as fs } from 'fs';
import { Connection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind, Hover, InsertTextFormat, Range, SymbolKind } from 'vscode-languageserver-types';
import { AhkSymbol, ActionType, FormatOptions, Lexer, update_comment_tags, ClassNode } from './Lexer';
import { diagnostic } from './localize';
import { isBrowser, jsDocTagNames } from './constants';
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
		ClassStaticMemberCheck: boolean
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

export const winapis: string[] = [];
export const lexers: { [uri: string]: Lexer } = {};
export const alpha_3 = encode_version('2.1-alpha.3');
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
		ClassStaticMemberCheck: true,
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
	get_DllExport: (paths: string[] | Set<string>, onlyone: boolean = false) => Promise.resolve([] as string[]),
	get_RCDATA: (path?: string) => (0 ? { uri: '', path: '' } : undefined),
	get_ahkProvider: async () => null as any
};

export type Maybe<T> = T | undefined;
export let connection: Connection;
export let ahkpath_cur = '', locale = 'en-us', rootdir = '', isahk2_h = false;
export let ahk_version = encode_version('3.0.0.0');
export let ahkuris: { [name: string]: string } = {};
export let ahkvars: { [key: string]: AhkSymbol } = {};
export let libfuncs: { [uri: string]: LibSymbol } = {};
export let hoverCache: { [key: string]: [string, Hover | undefined] } = {};
export let libdirs: string[] = [], workspaceFolders: string[] = [];
export let completionItemCache: {
	constant: CompletionItem[];
	directive: { [c: string]: CompletionItem[] };
	key: CompletionItem[];
	keyword: CompletionItem[];
	option: { [k: string]: CompletionItem[] };
	snippet: CompletionItem[];
	static: CompletionItem
	text: CompletionItem[];
};

interface LibSymbol extends Array<AhkSymbol> {
	fsPath: string
	islib: boolean
}

export function openFile(path: string, showError = true): TextDocument | undefined {
	if (isBrowser) {
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
	if (isBrowser || !existsSync(path))
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

export function initahk2cache() {
	let kind = CompletionItemKind.Keyword, data = '*';
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

export function loadahk2(filename = 'ahk2', d = 3) {
	let path: string | undefined;
	const file = `${rootdir}/syntaxes/<>/${filename}`;
	if (isBrowser) {
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
		const syntaxes = extsettings.Syntaxes && existsSync(extsettings.Syntaxes) ? extsettings.Syntaxes : '';
		const file2 = syntaxes ? `${syntaxes}/<>/${filename}` : file;
		let td: TextDocument | undefined;
		if ((path = getfilepath('.d.ahk')) && (td = openFile(restorePath(path)))) {
			let doc = new Lexer(td, undefined, d);
			doc.parseScript(), lexers[doc.uri] = doc, ahkuris[filename] = doc.uri;
		}
		if (path = getfilepath('.json'))
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
	function build_item_cache(ahk2: any) {
		let insertTextFormat: InsertTextFormat, kind: CompletionItemKind;
		let snip: { prefix?: string, body: string, description?: string, syntax?: string };
		let rg = Range.create(0, 0, 0, 0);
		for (const key in ahk2) {
			let arr: any[] = ahk2[key];
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
					let c = '';
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
							documentation: snip.description && { kind: 'markdown', value: snip.description },
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
							documentation: snip.description
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
							documentation: snip.description,
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
							documentation: snip.description,
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
					for (let k in arr) {
						let t = completionItemCache.option[k] ??= [];
						for (snip of arr[k])
							t.push({
								label: snip.body, kind,
								documentation: snip.description && { kind: 'markdown', value: snip.description }
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
	let maxdepth = extsettings.Files.MaxDepth;
	let { file: file_exclude, folder: folder_exclude } = scanExclude;
	return enumfile(restorePath(dirpath), 0);
	async function* enumfile(dirpath: string, depth: number): AsyncGenerator<string> {
		try {
			let dir = await fs.opendir(dirpath);
			for await (let t of dir) {
				if (t.isDirectory() && depth < maxdepth) {
					let path = resolve(dirpath, t.name);
					if (!folder_exclude?.some(re => re.test(path)))
						yield* enumfile(path, depth + 1);
				} else if (t.isFile() && /\.(ahk2?|ah2)$/i.test(t.name)) {
					let path = resolve(dirpath, t.name);
					if (!file_exclude?.some(re => re.test(path)))
						yield path;
				}
			}
		} catch (e) { }
	}
}

export function update_settings(configs: AHKLSSettings) {
	if (typeof configs.AutoLibInclude === 'string')
		configs.AutoLibInclude = LibIncludeType[configs.AutoLibInclude] as any;
	else if (typeof configs.AutoLibInclude === 'boolean')
		configs.AutoLibInclude = configs.AutoLibInclude ? 3 : 0;
	if (typeof configs.Warn?.CallWithoutParentheses === 'string')
		configs.Warn.CallWithoutParentheses = { On: true, Off: false, Parentheses: 1 }[configs.Warn.CallWithoutParentheses];
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
	for (let k of ['array_style', 'object_style'] as Array<keyof FormatOptions>)
		if (typeof configs.FormatOptions?.[k] === 'string')
			configs.FormatOptions[k] = { collapse: 2, expand: 1, none: 0 }[configs.FormatOptions[k] as string] as any;
	try {
		update_comment_tags(configs.CommentTags!);
	} catch (e: any) {
		delete e.stack;
		delete configs.CommentTags;
		console.log(e);
	}
	if (configs.WorkingDirs instanceof Array)
		configs.WorkingDirs = configs.WorkingDirs.map(dir =>
			(dir = URI.file(dir.includes(':') ? dir : resolve(dir)).toString().toLowerCase())
				.endsWith('/') ? dir : dir + '/');
	else configs.WorkingDirs = [];
	scanExclude = {};
	if (configs.Files) {
		let file: RegExp[] = [], folder: RegExp[] = [];
		for (let s of configs.Files.Exclude ?? [])
			try {
				(/[\\/]$/.test(s) ? folder : file).push(glob2regexp(s));
			} catch (e) {
				console.log(`[Error] Invalid glob pattern: ${s}`);
			}
		if (file.length)
			scanExclude.file = file;
		if (folder.length)
			scanExclude.folder = folder;
		if ((configs.Files.MaxDepth ??= 2) < 0)
			configs.Files.MaxDepth = Infinity;
	}
	if (configs.Syntaxes)
		configs.Syntaxes = resolve(configs.Syntaxes).toLowerCase();
	Object.assign(extsettings, configs);
}

function encode_version(version: string) {
	const STAGE: { [t: string]: number } = { ALPHA: -3, BETA: -2, RC: -1 };
	let v = (version.replace(/-\w+/, s => `.${STAGE[s.substring(1).toUpperCase()]}`) + '.0').split('.');
	let n = 0;
	for (let i = 0; i < 4; i++)
		n += parseInt(v[i]) * 2 ** ((3 - i) * 10);
	return n;
}

export async function sendAhkRequest(method: string, params: any[]) {
	if (isBrowser)
		return undefined;
	return utils.get_ahkProvider().then((server: any) => server?.sendRequest(method, ...params));
}

export function make_search_re(search: string) {
	let t = undefined;
	search = search.replace(/([*.?+^$|\\/\[\](){}])|([^\x00-\x7f])|(.)/g,
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
export function set_ahkpath(path: string) { ahkpath_cur = path; }
export function set_Connection(conn: Connection) { return connection = conn; }
export function set_dirname(dir: string) { rootdir = dir.replace(/[/\\]$/, ''); }
export function set_locale(str?: string) { if (str) locale = str.toLowerCase(); }
export function set_version(version: string) { ahk_version = encode_version(version); }
export function set_WorkspaceFolders(folders: Set<string>) {
	let old = workspaceFolders;
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

function glob2regexp(glob: string) {
	let reStr = '', inGroup = false, isNot: boolean, c: string;
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