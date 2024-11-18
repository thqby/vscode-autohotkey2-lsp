import { opendir } from 'fs/promises';
import { CancellationToken, CodeAction, CodeActionKind, CodeActionParams, TextEdit } from 'vscode-languageserver';
import { codeaction } from './localize';
import { DiagnosticCode, Maybe, lexers, restorePath } from './common';

export async function codeActionProvider(params: CodeActionParams, token: CancellationToken): Promise<Maybe<CodeAction[]>> {
	const uri = params.textDocument.uri, lex = lexers[uri.toLowerCase()], document = lex?.document;
	if (!lex || token.isCancellationRequested) return;
	const acts: CodeAction[] = [], replaces: Record<string, TextEdit[]> = {}, parens: TextEdit[] = [];
	let m: RegExpExecArray | null;

	for (const it of params.context.diagnostics) {
		switch (it.code) {
			case DiagnosticCode.call: {
				const tk = lex.tokens[document.offsetAt(it.range.start)], cs = tk.callsite!;
				let end = cs.range.end, start = tk.next_token_offset === -1 ?
					end = it.range.end : document.positionAt(tk.next_token_offset);
				if (start.line > end.line || start.line === end.line && start.character > end.character)
					start = end;
				parens.push(
					{ newText: '(', range: { start: it.range.end, end: start } },
					{ newText: ')', range: { start: end, end } }
				);
				break;
			}
			case DiagnosticCode.expect:
				(replaces[`${document.getText(it.range)} ${it.data}`] ??= []).push({ range: it.range, newText: it.data });
				break;
			case DiagnosticCode.include:
				if ((m = it.data?.match(/(.+?)\*\.(\w+)$/))) {
					const path = restorePath(m[1]).replace(/\\?$/, '\\'), reg = new RegExp(`\\.${m[2]}$`, 'i'), includes = [];
					const rg = Object.assign({}, it.range);
					rg.start = Object.assign({}, rg.start), rg.start.character = 0;
					try {
						for await (const ent of await opendir(path))
							if (reg.test(ent.name)) includes.push(`#Include ${path}${ent.name}`);
					} catch { continue; }
					const textEdit: TextEdit = { range: rg, newText: includes.join('\n') };
					const act: CodeAction = { title: codeaction.include(`${path}*.${m[2]}`), kind: CodeActionKind.QuickFix };
					act.edit = { changes: { [uri]: [textEdit] } };
					acts.push(act);
				}
				break;
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