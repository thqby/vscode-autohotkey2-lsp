import { readdirSync } from 'fs';
import { CancellationToken, CodeAction, CodeActionKind, CodeActionParams, TextEdit } from 'vscode-languageserver';
import { codeaction, diagnostic } from './localize';
import { Maybe, lexers, restorePath } from './common';

export async function codeActionProvider(params: CodeActionParams, token: CancellationToken): Promise<Maybe<CodeAction[]>> {
	let uri = params.textDocument.uri, doc = lexers[uri.toLowerCase()];
	if (!doc || token.isCancellationRequested) return;
	let rg = new RegExp('^' + diagnostic.filenotexist().replace('{0}', '(.+?)\\*(\\.\\w+)')), t: RegExpExecArray | null, r = '';
	let matchexpr = new RegExp(diagnostic.didyoumean('(:=)').replace('?', '\\?').toLowerCase() + '$|^' + diagnostic.deprecated('([^\'"]+)', '([^\'"]+)'));
	let acts: CodeAction[] = [], replaces: { [k: string]: TextEdit[] } = {};
	for (const it of doc.diagnostics) {
		if (t = matchexpr.exec(it.message)) {
			(replaces[t[3] ? t[3] + ' ' + (r = t[2]) : '= ' + (r = ':=')] ??= []).push({ range: it.range, newText: r });
		} else if (t = rg.exec(it.message)) {
			r = doc.document.getText(it.range);
			let path = restorePath(t[1]), reg = new RegExp(t[2] + '$', 'i'), includes = [];
			let rg = Object.assign({}, it.range);
			rg.start = Object.assign({}, rg.start), rg.start.character = 0;
			for (const it of readdirSync(path)) {
				try {
					if (reg.test(it)) includes.push(`#Include '${path}${it}'`);
				} catch { };
			}
			let textEdit: TextEdit = { range: rg, newText: includes.join('\n') };
			let act: CodeAction = { title: codeaction.include(path + '*' + t[2]), kind: CodeActionKind.QuickFix };
			act.edit = { changes: { [uri]: [textEdit] } };
			acts.push(act);
		}
	}
	for (let [k, v] of Object.entries(replaces))
		acts.push({ title: k.replace(/(\S+) (\S+)/, "Replace '$1' with '$2'"), edit: { changes: { [uri]: v } }, kind: CodeActionKind.QuickFix });
	return acts.length ? acts : undefined;
}