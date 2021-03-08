import { opendirSync, readFileSync, statSync } from 'fs';
import { basename, dirname, extname, normalize, relative, resolve } from 'path';
import { ExecuteCommandParams, TextEdit } from 'vscode-languageserver';
import { connection, lexers, libdirs, pathenv, restorePath } from './server';

export async function executeCommandProvider(params: ExecuteCommandParams) {
	let args = params.arguments || [];
	switch (params.command) {
		case 'ahk2.fix.include':
			fixinclude(args[0], args[1]);
			break;
	}
}

function fixinclude(libpath: string, docuri: string) {
	let doc = lexers[docuri], text = '', line = -1, curdir = '';
	for (const p of doc.libdirs.slice(1)) {
		if (libpath.startsWith(p + '\\')) {
			let ext = extname(libpath);
			if (ext === '.ahk')
				text = `#Include <${basename(restorePath(libpath), ext)}>`;
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
		text = '\n' + (space ? space[0] : '') + text;
		if (line < doc.document.lineCount)
			text += '\n';
	}
	connection.workspace.applyEdit({ changes: { [docuri]: [TextEdit.insert({ line, character: 0 }, text)] } });
	return;
}