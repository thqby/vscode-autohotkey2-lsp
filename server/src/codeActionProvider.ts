import { readdirSync } from 'fs';
import { CancellationToken, CodeAction, CodeActionKind, CodeActionParams, TextEdit } from 'vscode-languageserver';
import { codeaction, diagnostic } from './localize';
import { Maybe, lexers, restorePath, warn } from './common';

export async function codeActionProvider(params: CodeActionParams, token: CancellationToken): Promise<Maybe<CodeAction[]>> {
	const uri = params.textDocument.uri, lex = lexers[uri.toLowerCase()], document = lex?.document;
	if (!lex || token.isCancellationRequested) return;
	const acts: CodeAction[] = [], replaces: Record<string, TextEdit[]> = {}, parens: TextEdit[] = [];
	let r: string, t: RegExpExecArray | null;
	const cwp = warn.callwithoutparentheses();
	const include_re = new RegExp('^' + diagnostic.filenotexist('(.+?)\\*\\.(\\w+)'));
	const repl_re = new RegExp(diagnostic.didyoumean('(.+?)')
		.replace(/\?$/, '\\?').replace(/^\w/, s => `[${s.toUpperCase() + s.toLowerCase()}]`) +
		'$|^' + diagnostic.deprecated('.+?', '(.+?)'));

	for (const it of params.context.diagnostics) {
		if (cwp === it.message) {
			const tk = lex.tokens[document.offsetAt(it.range.start)], cs = tk.callsite!;
			let end = cs.range.end, start = tk.next_token_offset === -1 ?
				end = it.range.end : document.positionAt(tk.next_token_offset);
			if (start.line > end.line || start.line === end.line && start.character > end.character)
				start = end;
			parens.push(
				{ newText: '(', range: { start: it.range.end, end: start } },
				{ newText: ')', range: { start: end, end } }
			);
		} else if ((t = repl_re.exec(it.message))) {
			(replaces[`${document.getText(it.range)} ${r = t[1] || t[2]}`] ??= []).push({ range: it.range, newText: r });
		} else if ((t = include_re.exec(it.message))) {
			r = document.getText(it.range).replace(/\//g, '\\').replace(/[^\\]+$/, '');
			const path = restorePath(t[1]), reg = new RegExp(`\\.${t[2]}$`, 'i'), includes = [];
			const rg = Object.assign({}, it.range);
			rg.start = Object.assign({}, rg.start), rg.start.character = 0;
			for (const it of readdirSync(path)) {
				try {
					if (reg.test(it)) includes.push(`#Include '${r}${it}'`);
				} catch { };
			}
			const textEdit: TextEdit = { range: rg, newText: includes.join('\n') };
			const act: CodeAction = { title: codeaction.include(path + '*.' + t[2]), kind: CodeActionKind.QuickFix };
			act.edit = { changes: { [uri]: [textEdit] } };
			acts.push(act);
		}
	}
	for (const [k, v] of Object.entries(replaces))
		acts.push({
			kind: CodeActionKind.QuickFix,
			edit: { changes: { [uri]: v } },
			title: k.replace(/(\S+) (\S+)/, "Replace '$1' with '$2'")
		});
	if (parens.length)
		acts.push({
			kind: CodeActionKind.Refactor,
			edit: { changes: { [uri]: parens } },
			title: 'Use parenthesized function call styles'
		});
	return acts.length ? acts : undefined;
}