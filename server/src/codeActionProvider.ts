import { opendir } from 'fs/promises';
import { CancellationToken, CodeAction, CodeActionKind, CodeActionParams, TextEdit } from 'vscode-languageserver';
import { codeaction } from './localize';
import { DiagnosticCode, Maybe, extsettings, lexers, restorePath } from './common';

const words = ['catch', 'else', 'finally', 'until'];

export async function codeActionProvider(params: CodeActionParams, token: CancellationToken): Promise<Maybe<CodeAction[]>> {
	const uri = params.textDocument.uri, lex = lexers[uri.toLowerCase()];
	if (!lex || token.isCancellationRequested || lex.diag_pending !== undefined) return;
	const acts: CodeAction[] = [], replaces: Record<string, TextEdit[]> = {}, parens: TextEdit[] = [];
	const { document, linepos, tokens } = lex;
	let m;

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
				if (!process.env.BROWSER && (m = it.data?.match(/(.+?)\*\.(\w+)$/))) {
					const path = restorePath(m[1]).replace(/\\?$/, '\\'), reg = new RegExp(`\\.${m[2]}$`, 'i'), includes = [];
					const rg = Object.assign({}, it.range);
					rg.start = Object.assign({}, rg.start), rg.start.character = 0;
					try {
						for await (const ent of await opendir(path))
							reg.test(ent.name) && includes.push(`#Include ${path}${ent.name}`);
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
			title: k.replace(/(\S+) (\S+)/, (s, a, b) => codeaction.replace(a, b))
		});
	parens.length && acts.push({
		kind: CodeActionKind.Refactor,
		edit: { changes: { [uri]: parens.splice(0) } },
		title: codeaction.parenthesized()
	});
	brace_refactor();
	return acts.length ? acts : undefined;
	function brace_refactor() {
		let { end, start } = params.range;
		const sl = start.line;
		const eo = document.offsetAt(end);
		const so = document.offsetAt(start);
		const space = extsettings.FormatOptions?.space_in_other === false ? '' : ' ';
		const tab = extsettings.FormatOptions?.indent_string || '\t';
		for (const line in linepos) {
			if (line as unknown as number < sl) continue;
			let bo = linepos[line], tk, bk;
			if (bo > eo) break;
			bk = tokens[bo];
			if (!bk.body_start) continue;
			while ((bk = tokens[bk.body_start!]).body_start && bk.offset <= so)
				bo = bk.offset;
			const rb = [];
			do {
				tk = bk.previous_token!;
				start = document.positionAt(tk.offset + tk.length);
				if (bk.topofline)
					parens.push({ newText: space + '{', range: { start, end: start } }), m = undefined;
				else {
					m = get_indent(bo);
					parens.push({
						newText: `${space}{\n${m}${tab}`, range: {
							start, end: {
								line: start.line,
								character: start.character + bk.offset - tk.offset - tk.length
							}
						}
					});
				}
				end = { line: parseInt(line) + 1, character: 0 };
				const o = document.offsetAt(end);
				tk = lex.find_token(o, true);
				if (tk.type === 'TK_RESERVED' && words.includes(tk.content.toLowerCase()))
					rb.push({ newText: '}' + space, range: { start: end = document.positionAt(tk.offset), end } });
				else {
					m ??= get_indent(bo);
					if (end.line < document.lineCount)
						m += '}\n';
					else m = `\n${m}}`, end = document.positionAt(o);
					rb.push({ newText: m, range: { start: end, end } });
				}
			} while ((bo = bk.offset) <= eo && (bk = tokens[bk.body_start!]));
			parens.push(...rb.reverse());
		}
		parens.length && acts.push({
			kind: CodeActionKind.Refactor,
			edit: { changes: { [uri]: parens } },
			title: codeaction.brace()
		});
		function get_indent(bo: number) {
			const end = document.positionAt(bo);
			return document.getText({ start: { line: end.line, character: 0 }, end }).replace(/[^ \t].*/, '');
		}
	}
}