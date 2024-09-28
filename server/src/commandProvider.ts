import { CancellationToken, ExecuteCommandParams, Position, Range, SymbolKind } from 'vscode-languageserver';
import {
	AhkSymbol, ClassNode, FuncNode, Lexer, Property, Token, Variable,
	connection, ahkppConfig, find_class, generate_type_annotation,
	join_types, lexers, parse_include, restorePath, semanticTokensOnFull,
	traverse_include, update_include_cache
} from './common.js';

function checkCommand(cmd: string) {
	if (ahkppConfig.commands?.includes(cmd))
		return true;
	connection?.console.warn(`Command '${cmd}' is not implemented!`);
	return false;
}

function trim_jsdoc(detail?: string) {
	return detail?.replace(/^[ \t]*(\*?[ \t]*(?=@)|\* ?)/gm, '')
		.replace(/^\/\*+\s*|\s*\**\/$/g, '') ?? '';
}

function insertSnippet(value: string, range?: Range) {
	if (!checkCommand('ahk2.insertSnippet'))
		return;
	connection?.sendRequest('ahk2.insertSnippet', [value, range]);
}

export function setTextDocumentLanguage(uri: string, lang?: string) {
	if (!checkCommand('ahk2.setTextDocumentLanguage'))
		return;
	return connection?.sendRequest('ahk2.setTextDocumentLanguage', [uri, lang]);
}

export function generate_fn_comment(doc: Lexer, fn: FuncNode, detail?: string) {
	const comments = detail?.replace(/\$/g, '\\$').split('\n');
	const params: Record<string, string[]> = {}, returns: string[] = [];
	const details: string[] = [], result = ['/**'];
	let lastarr: string[] | undefined, m: RegExpMatchArray | null;
	let i = 0, z = true;
	comments?.forEach(line => {
		if ((m = line.match(/^@(param|arg)\s+(({[^}]*}\s)?\s*(\[.*?\]|\S+).*)$/i)))
			(lastarr = params[m[4].replace(/^\[?((\w|[^\x00-\x7f])+).*$/, '$1').toUpperCase()] ??= []).push('@param ' + m[2].trim());
		else if ((m = line.match(/^@(returns?)([\s:]\s*(.*))?$/i)))
			lastarr = returns, returns.push(`@${m[1].toLowerCase()} ${m[3]}`);
		else if (lastarr && !line.startsWith('@'))
			lastarr.push(line);
		else
			lastarr = undefined, details.push(line);
	});
	if (details.join('').trim())
		details.forEach(s => result.push(' * ' + s));
	else
		result.push(' * $0'), z = false;
	fn.params.forEach(it => {
		if ((lastarr = params[it.name.toUpperCase()])) {
			lastarr.forEach(s => result.push(' * ' + s));
		} else if (it.name) {
			const rets = generate_type_annotation(it, doc);
			if (rets)
				result.push(` * @param $\{${++i}:{${rets}\\}} ${it.name} $${++i}`);
			else result.push(` * @param ${it.name} $${++i}`);
		}
	});
	if (returns.length) {
		returns.forEach(s => result.push(' * ' + s));
	} else {
		const rets = generate_type_annotation(fn, doc);
		if (rets)
			result.push(` * @returns $\{${++i}:{${rets}\\}} $${++i}`);
	}
	result.push(' */');
	let text = result.join('\n');
	if (z)
		text = text.replace(new RegExp(`\\$${i}\\b`), '$0');
	return text;
}

/** Add a function header comment for the currently active function */
async function generateComment() {
	if (!checkCommand('ahk2.getActiveTextEditorUriAndPosition') || !checkCommand('ahk2.insertSnippet'))
		return;
	const { uri, position } = await connection?.sendRequest('ahk2.getActiveTextEditorUriAndPosition') as { uri: string, position: Position };
	const doc = lexers[uri.toLowerCase()];
	let scope = doc.searchScopedNode(position);
	const ts = scope?.children || doc.children;
	for (const it of ts) {
		if ((it.kind === SymbolKind.Function || it.kind === SymbolKind.Method) &&
			it.selectionRange.start.line === position.line &&
			it.selectionRange.start.character <= position.character &&
			position.character <= it.selectionRange.end.character) {
			scope = it;
			break;
		}
	}
	if (!scope || !(scope as FuncNode).params)
		return;
	let text: string, pos = scope.selectionRange.start;
	let tk: Token, range: Range;
	if (scope.markdown_detail === undefined) {
		text = `${generate_fn_comment(doc, scope as FuncNode)}\n`;
		tk = doc.tokens[doc.document.offsetAt(pos)];
		if (tk.topofline === 2)
			tk = tk.previous_token!;
		pos = doc.document.positionAt(tk.offset);
		range = { start: pos, end: pos };
	} else {
		tk = doc.find_token(doc.document.offsetAt({ line: pos.line - 1, character: 0 }));
		if (tk.type !== 'TK_BLOCK_COMMENT')
			return;
		text = generate_fn_comment(doc, scope as FuncNode, trim_jsdoc(scope.detail));
		range = {
			start: doc.document.positionAt(tk.offset),
			end: doc.document.positionAt(tk.offset + tk.length)
		};
	}
	insertSnippet(text, range);
}

export function exportSymbols(uri: string) {
	let doc = lexers[uri.toLowerCase()];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const cache: Record<string, string> = {}, result: any = {};
	if (!doc)
		return;
	update_include_cache();
	for (const uri of [doc.uri, ...Object.keys(doc.relevance)]) {
		if (!(doc = lexers[uri]))
			continue;
		let includes;
		includes = Object.entries(doc.include).map(p => lexers[p[0]]?.fsPath ?? restorePath(p[1]));
		!includes.length && (includes = undefined);
		dump(Object.values(doc.declaration), result[doc.fsPath || doc.document.uri] = { includes }, doc);
	}
	return result;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function dump(nodes: AhkSymbol[], result: any, lex: Lexer, _this?: ClassNode) {
		let kind: SymbolKind, fn: FuncNode, cl: ClassNode, t;
		for (let it of nodes) {
			if (!it.selectionRange.end.character)
				continue;
			switch (kind = it.kind) {
				case SymbolKind.Class:
					cl = it as ClassNode;
					(result.classes ??= []).push(t = {
						name: it.name, label: cl.full,
						extends: _extends(cl),
						detail: get_detail(it)
					});
					dump(Object.values(cl.property ?? {}), t, lex, cl);
					dump(Object.values(cl.$property ?? {}), t, lex, cl.prototype);
					break;
				case SymbolKind.Property:
					fn = it as FuncNode;
					(result.properties ??= []).push({
						name: it.name, label: fn.full,
						static: fn.static ?? false,
						variadic: fn.variadic ?? false,
						params: dump_params(fn.params),
						readonly: fn.params && !(it as Property).set || false,
						type: generate_type_annotation(fn, lex, _this),
						detail: get_detail(it),
					});
					if (!(it = (it as Property).call!))
						break;
				// fall through
				case SymbolKind.Function:
				case SymbolKind.Method:
					fn = it as FuncNode;
					(result[kind === SymbolKind.Function ? 'functions' : 'methods'] ??= []).push({
						name: it.name, label: fn.full,
						static: fn.static ?? false,
						variadic: fn.variadic ?? false,
						params: dump_params(fn.params),
						returns: generate_type_annotation(fn, lex, _this),
						detail: get_detail(it),
					});
					break;
			}
		}
		function get_defval(v: Variable) {
			switch (v.defaultVal) {
				case false: return null;
				case null: return 'unset';
				default: return v.defaultVal;
			}
		}
		function _extends(cl: ClassNode) {
			let s;
			if (!(s = cl.extends))
				return;
			return cache[`${cl.extendsuri},${s}`] ??= find_class(doc, s, cl.extendsuri)?.full || s;
		}
		function get_detail(sym: AhkSymbol) {
			if (sym.markdown_detail)
				return trim_jsdoc(sym.detail);
			return sym.detail ?? '';
		}
		function dump_params(params?: Variable[]) {
			return params?.map(param => ({
				name: param.name,
				defval: get_defval(param),
				byref: param.pass_by_ref ?? false,
				variadic: param.arr ?? false,
				type: join_types(param.type_annotations)
			}));
		}
	}
}

async function diagnoseAll() {
	if (!checkCommand('ahk2.getActiveTextEditorUriAndPosition'))
		return;
	const { uri } = await connection?.sendRequest('ahk2.getActiveTextEditorUriAndPosition') as { uri: string };
	const doc = lexers[uri.toLowerCase()];
	if (!doc) return;
	update_include_cache();
	for (let u in doc.relevance)
		(u = lexers[u]?.document.uri) && semanticTokensOnFull({ textDocument: { uri: u } });
	semanticTokensOnFull({ textDocument: { uri } });
}

async function setscriptdir() {
	if (!checkCommand('ahk2.getActiveTextEditorUriAndPosition'))
		return;
	const { uri } = await connection?.sendRequest('ahk2.getActiveTextEditorUriAndPosition') as { uri: string };
	const lex = lexers[uri.toLowerCase()];
	if (!lex) return;
	if (lex.scriptdir !== lex.scriptpath)
		lex.initLibDirs(lex.scriptpath), lex.need_scriptdir && lex.parseScript();
	parse_include(lex, lex.scriptpath);
	traverse_include(lex);
	lex.sendDiagnostics(false, true);
}

export function getVersionInfo(uri: string) {
	const lex = lexers[uri.toLowerCase()];
	if (!lex) return;
	const doc = lex.document, tks = lex.tokens, pos = { line: 0, character: 0 };
	let tk = lex.get_token(0);
	while (tk.type === 'TK_SHARP') {
		pos.line = doc.positionAt(tk.offset).line + 1;
		tk = lex.get_token(doc.offsetAt(pos));
	}
	const info = [];
	if ((!tk.type || tk.type.endsWith('COMMENT')) && /^\s*[;*]?\s*@(date|version)\b/im.test(tk.content)) {
		info.push({
			uri, content: tk.content, single: false,
			range: {
				start: doc.positionAt(tk.offset),
				end: doc.positionAt(tk.offset + tk.length)
			}
		});
	}
	for (const it of lex.tokenranges) {
		if (it.type === 1 && (tk = tks[it.start])?.topofline &&
			/^;\s*@ahk2exe-setversion\b/i.test(tk.content))
			return info.concat({
				uri, content: tk.content, single: true,
				range: {
					start: doc.positionAt(it.start),
					end: doc.positionAt(it.end)
				}
			});
	}
	return info;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const commands: { [command: string]: (args: any[]) => any } = {
	'ahk++.diagnostic.full': () => diagnoseAll(),
	'ahk++.addDocComment': () => generateComment(),
	'ahk++.setAScriptDir': setscriptdir
};

export function executeCommandProvider(params: ExecuteCommandParams, token?: CancellationToken) {
	if (!token?.isCancellationRequested)
		return commands[params.command](params.arguments ?? []);
}