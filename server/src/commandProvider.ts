import { Position, Range } from 'vscode-languageserver';
import {
	AhkSymbol, ClassNode, FuncNode, Lexer, Property, SymbolKind, Token, Variable, ZERO_RANGE,
	findClass, generateTypeAnnotation, joinTypes, lexers, parseInclude, restorePath,
	semanticTokensOnFull, traverseInclude, updateIncludeCache, utils
} from './common';

const request_handlers: Record<string, (params: never) => unknown> = {
	extractSymbols,
	generateComment,
	getContent,
	getVersionInfo,
};

function trimJsDoc(detail?: string) {
	return detail?.replace(/^[ \t]*(\*?[ \t]*(?=@)|\* ?)/gm, '')
		.replace(/^\/\*+\s*|\s*\**\/$/g, '') ?? '';
}

export function generateFuncComment(lex: Lexer, fn: FuncNode, detail?: string) {
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
	else result.push(' * $0'), z = false;
	fn.params.forEach(it => {
		if ((lastarr = params[it.name.toUpperCase()])) {
			lastarr.forEach(s => result.push(' * ' + s));
		} else if (it.name) {
			const rets = generateTypeAnnotation(it, lex);
			if (rets)
				result.push(` * @param $\{${++i}:{${rets}\\}} ${it.name} $${++i}`);
			else result.push(` * @param ${it.name} $${++i}`);
		}
	});
	if (returns.length) {
		returns.forEach(s => result.push(' * ' + s));
	} else {
		const rets = generateTypeAnnotation(fn, lex);
		if (rets)
			result.push(` * @returns $\{${++i}:{${rets}\\}} $${++i}`);
	}
	result.push(' */');
	let text = result.join('\n');
	if (z)
		text = text.replace(new RegExp(`\\$${i}\\b`), '$0');
	return text;
}

function generateComment(params: { uri: string, position: Position }) {
	const { position, uri } = params;
	const lex = lexers[uri.toLowerCase()];
	if (!lex) return;
	let scope = lex.searchScopedNode(position);
	const ts = scope?.children || lex.children;
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
		text = `${generateFuncComment(lex, scope as FuncNode)}\n`;
		tk = lex.tokens[lex.document.offsetAt(pos)];
		if (tk.topofline === 2)
			tk = tk.previous_token!;
		pos = lex.document.positionAt(tk.offset);
		range = { start: pos, end: pos };
	} else {
		tk = lex.findToken(lex.document.offsetAt({ line: pos.line - 1, character: 0 }));
		if (tk.type !== 'TK_BLOCK_COMMENT')
			return;
		text = generateFuncComment(lex, scope as FuncNode, trimJsDoc(scope.detail));
		range = {
			start: lex.document.positionAt(tk.offset),
			end: lex.document.positionAt(tk.offset + tk.length)
		};
	}
	return { range, text };
}

function extractSymbols(uri: string) {
	let lex = lexers[uri.toLowerCase()];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const cache: Record<string, string> = {}, result: any = {};
	if (!lex)
		return;
	updateIncludeCache();
	for (const uri of [lex.uri, ...Object.keys(lex.relevance)]) {
		if (!(lex = lexers[uri]))
			continue;
		let includes;
		includes = Object.entries(lex.include).map(p => lexers[p[0]]?.fsPath ?? restorePath(p[1]));
		!includes.length && (includes = undefined);
		dump(Object.values(lex.declaration), result[lex.fsPath || lex.document.uri] = { includes }, lex);
	}
	return result;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function dump(nodes: AhkSymbol[], result: any, lex: Lexer, _this?: ClassNode) {
		let kind: SymbolKind, fn: FuncNode, cl: ClassNode, t;
		for (let it of nodes) {
			if (it.selectionRange === ZERO_RANGE)
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
						type: generateTypeAnnotation(fn, lex, _this),
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
						returns: generateTypeAnnotation(fn, lex, _this),
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
			return cache[`${cl.extendsuri},${s}`] ??= findClass(lex, s, cl.extendsuri)?.full || s;
		}
		function get_detail(sym: AhkSymbol) {
			if (sym.markdown_detail)
				return trimJsDoc(sym.detail);
			return sym.detail ?? '';
		}
		function dump_params(params?: Variable[]) {
			return params?.map(param => ({
				name: param.name,
				defval: get_defval(param),
				byref: param.pass_by_ref ?? false,
				variadic: param.arr ?? false,
				type: joinTypes(param.type_annotations)
			}));
		}
	}
}

function diagnoseAll(uri: string) {
	const lex = lexers[uri.toLowerCase()];
	if (!lex) return;
	updateIncludeCache();
	for (let uri in lex.relevance)
		(uri = lexers[uri]?.document.uri) && semanticTokensOnFull({ textDocument: { uri } });
	semanticTokensOnFull({ textDocument: { uri } });
}

function setScriptDir(uri: string) {
	const lex = lexers[uri.toLowerCase()];
	if (!lex) return;
	if (lex.scriptdir !== lex.scriptpath && (lex.initLibDirs(lex.scriptpath), lex.need_scriptdir) || lex.last_diags)
		lex.parseScript();
	parseInclude(lex, lex.scriptpath);
	for (let uri in traverseInclude(lex))
		(uri = lexers[uri]?.document.uri) && semanticTokensOnFull({ textDocument: { uri } });
	lex.sendDiagnostics(false, true);
}

function getVersionInfo(uri: string) {
	const lex = lexers[uri.toLowerCase()];
	if (!lex) return;
	const { document, tokens } = lex, pos = { line: 0, character: 0 };
	let tk = lex.getToken(0);
	while (tk.type === 'TK_SHARP' || tk.ignore && tk.type === 'TK_COMMENT') {
		pos.line = document.positionAt(tk.offset).line + 1;
		tk = lex.getToken(document.offsetAt(pos));
	}
	const info = [];
	if ((!tk.type || tk.type.endsWith('COMMENT')) && /^\s*[;*]?\s*@(date|version)\b/im.test(tk.content)) {
		info.push({
			content: tk.content, single: false,
			range: {
				start: document.positionAt(tk.offset),
				end: document.positionAt(tk.offset + tk.length)
			}
		});
	}
	for (const it of lex.token_ranges) {
		if (it.type === 1 && (tk = tokens[it.start])?.topofline &&
			/^;\s*@ahk2exe-set(file|product)?version\b/i.test(tk.content))
			info.push({
				content: tk.content, single: true,
				range: {
					start: document.positionAt(it.start),
					end: document.positionAt(it.end)
				}
			});
	}
	return info;
}

function getContent(uri: string) {
	return lexers[uri.toLowerCase()]?.document.getText()
}

export function getRequestHandlers(commands?: string[]) {
	if (!process.env.BROWSER)
		Object.assign(request_handlers, {
			diagnoseAll,
			getAhkVersion: utils.getAhkVersion,
			setScriptDir,
		});
	return request_handlers;
}