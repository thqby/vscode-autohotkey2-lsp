import { readdirSync } from 'fs';
import { CodeAction, CodeActionKind, CodeActionParams, TextEdit } from 'vscode-languageserver';
import { codeaction, diagnostic } from './localize';
import { Maybe, lexers } from './common';

export async function codeActionProvider(params: CodeActionParams): Promise<Maybe<CodeAction[]>> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], diagnostics = doc.diagnostics;
	let rg = new RegExp(diagnostic.filenotexist().replace('{0}', '(.+?)\\*(\\.\\w+)')), t: RegExpExecArray | null, r = '';
	for (const it of diagnostics) {
		if (t = rg.exec(it.message)) {
			r = doc.document.getText(it.range);
			let path = t[1], reg = new RegExp(t[2] + '$', 'i'), includes = [];
			for (const it of readdirSync(path)) {
				try {
					if (reg.test(it)) includes.push(r.replace('*' + t[2], it));
				} catch (err) { };
			}
			let textEdit: TextEdit = { range: it.range, newText: includes.join('\n') };
			let act: any = { title: codeaction.include(path + '*' + t[2]), edit: { changes: {} }, kind: CodeActionKind.QuickFix };
			act.edit.changes[params.textDocument.uri] = [textEdit];
			return [act];
		}
	}
	return undefined;
}