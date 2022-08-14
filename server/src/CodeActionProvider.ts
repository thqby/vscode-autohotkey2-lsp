import { readdirSync } from 'fs';
import { CodeAction, CodeActionKind, CodeActionParams, TextEdit } from 'vscode-languageserver';
import { codeaction, diagnostic } from './localize';
import { Maybe, lexers, restorePath } from './common';

export async function codeActionProvider(params: CodeActionParams): Promise<Maybe<CodeAction[]>> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], diagnostics = doc.diagnostics;
	let rg = new RegExp(diagnostic.filenotexist().replace('{0}', '(.+?)\\*(\\.\\w+)')), t: RegExpExecArray | null, r = '';
	for (const it of diagnostics) {
		if (t = rg.exec(it.message)) {
			r = doc.document.getText(it.range);
			let path = restorePath(t[1]), reg = new RegExp(t[2] + '$', 'i'), includes = [];
			let rg = Object.assign({}, it.range);
			rg.start = Object.assign({}, rg.start), rg.start.character = 0;
			for (const it of readdirSync(path)) {
				try {
					if (reg.test(it)) includes.push(`#Include '${path}${it}'`);
				} catch (err) { };
			}
			let textEdit: TextEdit = { range: rg, newText: includes.join('\n') };
			let act: any = { title: codeaction.include(path + '*' + t[2]), edit: { changes: {} }, kind: CodeActionKind.QuickFix };
			act.edit.changes[params.textDocument.uri] = [textEdit];
			return [act];
		}
	}
	return undefined;
}