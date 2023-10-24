import { DocumentSymbol, Position, Range, SymbolKind } from 'vscode-languageserver';
import { ClassNode, reset_detect_cache, detectExp, FuncNode, Token, Variable, find_class, Lexer } from './Lexer';
import { connection, extsettings, lexers, restorePath, semanticTokensOnFull, update_includecache } from './common';

function checkCommand(cmd: string) {
	if (extsettings.commands?.includes(cmd))
		return true;
	connection.console.warn(`Command '${cmd}' is not implemented!`);
	return false;
}

export function insertSnippet(value: string, range?: Range) {
	if (!checkCommand('ahk2.insertSnippet'))
		return;
	connection.sendRequest('ahk2.insertSnippet', [value, range]);
}

export function setTextDocumentLanguage(uri: string, lang?: string) {
	if (!checkCommand('ahk2.setTextDocumentLanguage'))
		return;
	return connection.sendRequest('ahk2.setTextDocumentLanguage', [uri, lang]);
}

export function generate_fn_comment(doc: Lexer, fn: FuncNode) {
	let comments = fn.detail?.replace(/\$/g, '\\$').split('\n');
	let returns: string[] = [], details: string[] = [], result = ['/**'];
	let lastarr: string[] | undefined, m: RegExpMatchArray | null;
	let params: { [name: string]: string[] } = {}, i = 0, z = true;
	let p: Position, pp = Object.assign({}, fn.range.end);
	pp.character--;
	comments?.forEach(line => {
		if (m = line.match(/^@(param|arg)\s+(({[^}]*}\s)?\s*(\[.*?\]|\S+).*)$/i))
			(lastarr = params[m[4].replace(/^\[?((\w|[^\x00-\x7f])+).*$/, '$1').toUpperCase()] ??= []).push('@param ' + m[2].trim());
		else if (m = line.match(/^@(returns?)([\s:]\s*(.*))?$/i))
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
		if (lastarr = params[it.name.toUpperCase()]) {
			lastarr.forEach(s => result.push(' * ' + s));
		} else if (it.name) {
			let rets: string[] = [], o: any = {};
			for (const ret in it.returntypes)
				reset_detect_cache(), detectExp(doc, ret, Position.is(p = it.returntypes[ret]) ? p : pp).forEach(tp => o[trim(tp)] = true);
			rets = o['#any'] ? [] : Object.keys(o);
			if (rets.length)
				result.push(` * @param $\{${++i}:{${rets.join('|')}\\}} ${it.name} $${++i}`);
			else result.push(` * @param ${it.name} $${++i}`);
		}
	});
	if (returns.length) {
		returns.forEach(s => result.push(' * ' + s));
	} else {
		let rets: string[] = [], o: any = {};
		for (const ret in fn.returntypes)
			reset_detect_cache(), detectExp(doc, ret, Position.is(p = fn.returntypes[ret]) ? p : pp).forEach(tp => o[trim(tp)] = true);
		rets = o['#any'] ? ['any'] : Object.keys(o);
		if (rets.length)
			result.push(` * @returns $\{${++i}:{${rets.join('|')}\\}} $${++i}`);
	}
	result.push(' */');
	let text = result.join('\n');
	if (z)
		text = text.replace(new RegExp(`\\$${i}\\b`), '$0');
	return text;
	function trim(tp: string) {
		tp = tp.trim().replace(/([^.]+)$/, '\\$$$1').replace(/\\\$[@#]/, '');
		return tp;
	}
}

export async function generateComment() {
	if (!checkCommand('ahk2.getActiveTextEditorUriAndPosition') || !checkCommand('ahk2.insertSnippet'))
		return;
	let { uri, position } = await connection.sendRequest('ahk2.getActiveTextEditorUriAndPosition') as { uri: string, position: Position };
	let doc = lexers[uri = uri.toLowerCase()], scope = doc.searchScopedNode(position), ts = scope?.children || doc.children;
	for (const it of ts) {
		if ((it.kind === SymbolKind.Function || it.kind === SymbolKind.Method) &&
			it.selectionRange.start.line === position.line &&
			it.selectionRange.start.character <= position.character &&
			position.character <= it.selectionRange.end.character) {
			scope = it;
			break;
		}
	}
	if (scope && (scope as FuncNode).params) {
		let text = generate_fn_comment(doc, scope as FuncNode), pos = scope.selectionRange.start;
		let tk: Token, range: Range;
		if (scope.detail === undefined) {
			text += '\n', tk = doc.tokens[doc.document.offsetAt(pos)];
			if (tk.topofline === 2)
				tk = tk.previous_token!;
			pos = doc.document.positionAt(tk.offset);
			range = { start: pos, end: pos };
		} else {
			tk = doc.find_token(doc.document.offsetAt({ line: pos.line - 1, character: 0 }));
			if (!tk.type.endsWith('COMMENT'))
				return;
			range = {
				start: doc.document.positionAt(tk.offset),
				end: doc.document.positionAt(tk.offset + tk.length)
			};
		}
		insertSnippet(text, range);
	}
}

export function exportSymbols(uri: string) {
	let doc = lexers[uri.toLowerCase()], cache: any = {}, result: any = {};
	if (!doc)
		return;
	update_includecache();
	for (let uri of [doc.uri, ...Object.keys(doc.relevance)]) {
		if (!(doc = lexers[uri]))
			continue;
		let includes;
		includes = Object.entries(doc.include).map(p => lexers[p[0]]?.fsPath ?? restorePath(p[1]));
		!includes.length && (includes = undefined);
		dump(Object.values(doc.declaration), result[doc.fsPath || doc.document.uri] = { includes });
	}
	return result;
	function dump(nodes: DocumentSymbol[], result: any) {
		let kind: SymbolKind, fn: FuncNode, cl: ClassNode, t: any;
		for (let it of nodes) {
			if (!it.selectionRange.end.character)
				continue;
			switch (kind = it.kind) {
				case SymbolKind.Class:
					cl = it as ClassNode;
					(result.classes ??= []).push(t = {
						name: it.name, label: cl.full,
						extends: _extends(cl),
						comment: it.detail
					});
					dump(Object.values(cl.staticdeclaration ?? {}), t);
					dump(Object.values(cl.declaration ?? {}), t);
					break;
				case SymbolKind.Property:
					fn = it as FuncNode;
					(result.properties ??= []).push({
						name: it.name, label: fn.full,
						static: fn.static || undefined,
						variadic: fn.variadic || undefined,
						params: fn.params?.map(p => ({
							name: p.name, byref: p.ref || undefined,
							defval: _def(p)
						})),
						readonly: fn.params && !(it as any).set || undefined,
						comment: it.detail
					});
					if (!(it = (it as any).call))
						break;
				case SymbolKind.Function:
				case SymbolKind.Method:
					fn = it as FuncNode;
					(result[kind === SymbolKind.Function ? 'functions' : 'methods'] ??= []).push({
						name: it.name, label: fn.full,
						static: fn.static || undefined,
						variadic: fn.variadic || undefined,
						params: fn.params.map(p => ({
							name: p.name, byref: p.ref || undefined,
							defval: _def(p)
						})),
						comment: it.detail
					});
					break;
			}
		}
		function _def(v: Variable) {
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
	}
}

export async function diagnosticFull() {
	if (!checkCommand('ahk2.getActiveTextEditorUriAndPosition') || !checkCommand('ahk2.insertSnippet'))
		return;
	let { uri } = await connection.sendRequest('ahk2.getActiveTextEditorUriAndPosition') as { uri: string };
	const doc = lexers[uri.toLowerCase()];
	if (!doc) return;
	update_includecache();
	for (let u in doc.relevance)
		(u = lexers[u]?.document.uri) && semanticTokensOnFull({ textDocument: { uri: u } });
	semanticTokensOnFull({ textDocument: { uri } });
}