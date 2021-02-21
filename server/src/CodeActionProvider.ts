import { readdirSync } from 'fs';
import { CodeAction, CodeActionKind, CodeActionParams, TextEdit } from 'vscode-languageserver';
import { Maybe, lexers } from './server';

export async function codeActionProvider(params: CodeActionParams): Promise<Maybe<CodeAction[]>> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], diagnostics = doc.diagnostics;
	for (const it of diagnostics) {
		if (it.message.indexOf(' 文件不存在') !== -1) {
			let t: any = it.message.replace(/^'(.+)' 文件不存在$/, '$1'), r = doc.document.getText(it.range);
			if (t = t.match(/^(.+)\*(\.\w+)$/)) {
				let path = t[1], reg = new RegExp(t[2] + '$', 'i'), includes = [];
				for (const it of readdirSync(path)) {
					try {
						if (reg.test(it)) includes.push(r.replace('*' + t[2], it));
					} catch (err) { };
				}
				let textEdit: TextEdit = { range: it.range, newText: includes.join('\n') };
				let act: any = { title: `导入'${path + '*' + t[2]}'`, edit: { changes: {} }, kind: CodeActionKind.QuickFix };
				act.edit.changes[params.textDocument.uri] = [textEdit];
				return [act];
			}
		}
	}
	return undefined;
}