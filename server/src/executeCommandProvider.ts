import { basename, extname, relative, resolve } from 'path';
import { ExecuteCommandParams, Position, Range, SymbolKind, TextEdit } from 'vscode-languageserver';
import { detectExp, FuncNode } from './Lexer';
import { connection, lexers, pathenv, restorePath, setInterpreter } from './server';

export var noparammoveright: boolean = false;

export async function executeCommands(cmds: { command: string, args?: any[], wait?: boolean }[]) {
	return connection.sendRequest('ahk2.executeCommands', [cmds]);
}

export function insertSnippet(value: string, range?: Range) {
	connection.sendRequest('ahk2.insertSnippet', [value, range]);
}

export async function executeCommandProvider(params: ExecuteCommandParams) {
	let args = params.arguments || [];
	switch (params.command) {
		case 'ahk2.fix.include':
			fixinclude(args[0], args[1]);
			break;
		case 'ahk2.generate.comment':
			generateComment(args);
			break;
		case 'ahk2.generate.author':
			generateAuthor();
			break;
		case 'ahk2.resetinterpreterpath':
			setInterpreter(args[0]);
			break;
	}
}

async function fixinclude(libpath: string, docuri: string) {
	let doc = lexers[docuri], text = '', line = -1, curdir = '';
	for (const p of doc.libdirs.slice(1)) {
		if (libpath.startsWith(p + '\\')) {
			let ext = extname(libpath);
			if (ext === '.ahk')
				text = `#Include <${relative(p, restorePath(libpath)).slice(0, -4)}>`;
			else if (pathenv.mydocuments && libpath.startsWith(pathenv.mydocuments + '\\autohotkey\\lib'))
				text = `#Include '%A_MyDocuments%\\AutoHotkey\\Lib\\${basename(restorePath(libpath))}'`;
			else
				text = `#Include '${restorePath(libpath)}'`;
			for (const l of doc.includedir)
				line = l[0] + 1;
		}
	}
	if (text === '') {
		for (const l of doc.includedir) {
			if (libpath.startsWith(l[1] + '\\')) {
				if (l[1].length > curdir.length)
					line = l[0] + 1, curdir = l[1];
			} else if (!curdir && libpath.startsWith(resolve(l[1], '..') + '\\'))
				line = l[0] + 1, curdir = l[1];
		}
		curdir = curdir || doc.scriptdir;
		if (curdir.charAt(0) !== libpath.charAt(0))
			text = `#Include '${restorePath(libpath)}'`;
		else
			text = `#Include '${relative(curdir, restorePath(libpath))}'`;
	}
	if (line === -1)
		line = doc.document.lineCount, text = '\n\n' + text;
	else {
		let space = doc.document.getText({ start: { line: line - 1, character: 0 }, end: { line, character: 0 } }).match(/^\s+/);
		text = (space ? space[0] : '') + text;
		if (line < doc.document.lineCount)
			text += '\n';
	}
	let { pos } = await connection.sendRequest('ahk2.getpos'), char = doc.document.getText(Range.create(pos.line, pos.character - 1, pos.line, pos.character));
	await connection.workspace.applyEdit({ changes: { [docuri]: [TextEdit.insert({ line, character: 0 }, text)] } });
	if (char === '(')
		executeCommands([{ command: 'editor.action.triggerParameterHints' }]);
	else {
		if (line <= pos.line)
			pos.line++;
		insertSnippet('$0', Range.create(pos, pos));
		if (char === '.')
			executeCommands([{ command: 'editor.action.triggerSuggest' }]);
	}
	return;
}

async function generateComment(args: string[]) {
	if (args.length === 0)
		await executeCommands([{ command: 'undo', wait: true }, { command: 'undo', wait: true }]);
	let { uri, pos } = await connection.sendRequest('ahk2.getpos');
	let doc = lexers[uri = uri.toLowerCase()], scope = doc.searchScopedNode(pos), ts = scope?.children || doc.children;
	for (const it of ts) {
		if ((it.kind === SymbolKind.Function || it.kind === SymbolKind.Method) && it.selectionRange.start.line === pos.line && it.selectionRange.start.character <= pos.character && pos.character <= it.selectionRange.end.character) {
			scope = it;
			break;
		}
	}
	if (scope && (scope.kind === SymbolKind.Function || scope.kind === SymbolKind.Method)) {
		let t: any, line = scope.range.start.line, linetext = doc.document.getText({ start: { line, character: 0 }, end: { line: line + 1, character: 0 } });
		if (t = linetext.match(/^(\s*)((static|macro)\s*)?\S+\(/i)) {
			let n = scope as FuncNode, ss: string[] = ['/**'], i = 0, character = t[1].length, comments = scope.detail?.split('\n'), range: Range | undefined;
			let params: { [name: string]: string[] } = {}, lastarr: string[] | undefined, returns: string[] = [], details: string[] = [], m: RegExpMatchArray | null;
			if (comments) {
				let block = false, start = { line: -1, character: 0 }, end = { line: -1, character: 0 };
				for (let i = line - 1; i >= 0; i--) {
					let t = doc.document.getText({ start: { line: i, character: 0 }, end: { line: i + 1, character: 0 } });
					if (block) {
						if (m = t.match(/^\s*\/\*/)) {
							start.line = i, start.character = m[0].length - 2;
							break;
						}
					} else {
						if (m = t.match(/^\s*;/)) {
							start.line = end.line = i;
							start.character = m[0].length - 1, end.character = t.length;
							break;
						} else if (m = t.match(/\*\/((\s+.*)?)$/))
							end.line = i, end.character = t.length - m[1].length, block = true;
						else
							break;
					}
				}
				if (end.line >= start.line && start.line > -1)
					range = { start, end };
				comments.map(line => {
					if (m = line.match(/^@(param|参数)\s+(\S+)([\s|:]\s*(.*))?$/i))
						lastarr = params[m[2].toLowerCase()] = [m[4]];
					else if (m = line.match(/^@(returns|返回值)([\s|:]\s*(.*))?$/i))
						lastarr = returns, returns.push(m[3]);
					else if (lastarr && line.charAt(0) !== '@')
						lastarr.push(line);
					else
						lastarr = undefined, details.push(line);
				});
			}
			if (details.length)
				details.map(s => ss.push(' * ' + s));
			else
				ss.push(' * $1'), i++;
			n.params.map(it => {
				if (lastarr = params[it.name.toLowerCase()]) {
					ss.push(` * @param ${it.name} ${lastarr.shift()}`);
					lastarr.map(s => ss.push(' * ' + s));
				} else
					ss.push(` * @param ${it.name} $${(++i).toString()}`);
			});
			if (Object.keys(n.returntypes || {}).length) {
				if (returns.length) {
					ss.push(` * @returns ${returns.shift()}`);
					returns.map(s => ss.push(' * ' + s));
				} else {
					let rets: string[] = [], o: any = {}, p: Position;
					for (const ret in n.returntypes)
						detectExp(doc, ret, Position.is(p = n.returntypes[ret]) ? p : pos).map(tp => o[tp.replace(/^\s*[@#]/, '')] = true);
					rets = Object.keys(o);
					ss.push(` * @returns $\{${(++i).toString() + ':' + (rets.length ? rets.join(', ') : '')}\}`);
				}
			}
			if (i === 0)
				return;
			ss.push(' */');
			if (!range)
				range = Range.create(line, character, line, character), ss.push('');
			insertSnippet(ss.join('\n'), range);
		}
	}
}

async function generateAuthor() {
	let info: string[] = [
		"/************************************************************************",
		" * @description ${1:}",
		" * @file $TM_FILENAME",
		" * @author ${2:}",
		" * @date ${3:$CURRENT_YEAR/$CURRENT_MONTH/$CURRENT_DATE}",
		" * @version ${4:0.0.0}",
		" ***********************************************************************/",
		"$0"
	];
	await executeCommands([{ command: 'undo', wait: true }, { command: 'undo', wait: true }]);
	let { uri, pos } = await connection.sendRequest('ahk2.getpos'), doc = lexers[uri = uri.toLowerCase()];
	let tk: { type: string, content: string, offset: number } = doc.get_tokon(0), range = Range.create(0, 0, 0, 0);
	if (tk.type.endsWith('COMMENT')) {
		if (tk.type === 'TK_BLOCK_COMMENT' && tk.content.match(/@(version|版本)\b/i))
			return;
	}
	if (doc.document.positionAt(tk.offset).line === 0)
		info.push('');
	insertSnippet(info.join('\n'), range);
}