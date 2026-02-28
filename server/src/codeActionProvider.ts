import { opendir } from 'fs/promises';
import { CancellationToken, CodeAction, CodeActionParams, TextEdit } from 'vscode-languageserver';
import { CodeActionKind, DiagnosticCode, DiagnosticTag, Maybe, TokenType, codeaction, configCache, lexers, restorePath } from './common';

const words = ['catch', 'else', 'finally', 'until'];

export async function codeActionProvider(params: CodeActionParams & { indent?: string }, token: CancellationToken): Promise<Maybe<CodeAction[]>> {
	const uri = params.textDocument.uri, lex = lexers[uri.toLowerCase()];
	if (!lex || token.isCancellationRequested || lex.diag_pending !== undefined) return;
	const { document, line_ranges, tokens } = lex,
		{ context: { diagnostics, only }, indent, range } = params;
	const acts: CodeAction[] = [], replaces: Record<string, TextEdit[]> = {},
		parens: TextEdit[] = [], unuseds: TextEdit[] = [];
	const has_refactor = only?.toString().includes(CodeActionKind.Refactor) !== false;
	let m, text: string | undefined;

	for (const it of diagnostics) {
		switch (it.code) {
			case DiagnosticCode.call:
				if (has_refactor) {
					const tk = tokens[document.offsetAt(it.range.start)], cs = tk.callsite!;
					let end = cs.range.end, start = tk.next_token_offset === -1 ?
						end = it.range.end : document.positionAt(tk.next_token_offset);
					if (start.line > end.line || start.line === end.line && start.character > end.character)
						start = end;
					parens.push(
						{ newText: '(', range: { start: it.range.end, end: start } },
						{ newText: ')', range: { start: end, end } }
					);
				}
				break;
			case DiagnosticCode.expect:
				(replaces[`${document.getText(it.range)} ${it.data}`] ??= []).push({ range: it.range, newText: it.data });
				break;
			case DiagnosticCode.include:
				if (!process.env.BROWSER && (m = it.data?.match(/(.+?)\*\.(\w+)$/))) {
					const path = restorePath(m[1]).replace(/\\?$/, '\\'), reg = new RegExp(`\\.${m[2]}$`, 'i');
					const range = it.range, includes = [];
					range.start.character = 0;
					try {
						for await (const ent of await opendir(path))
							reg.test(ent.name) && includes.push(`#Include ${path}${ent.name}`);
					} catch { continue; }
					acts.push({
						kind: CodeActionKind.QuickFix,
						title: codeaction.include(`${path}*.${m[2]}`),
						edit: { changes: { [uri]: [{ range, newText: includes.join('\n') }] } }
					});
				}
				break;
			default:
				it.tags?.includes(DiagnosticTag.Unnecessary) && remove_unused(document.offsetAt(it.range.start));
				break;
		}
	}
	for (const [k, v] of Object.entries(replaces))
		acts.push({
			kind: CodeActionKind.QuickFix,
			edit: { changes: { [uri]: v } },
			title: k.replace(/(\S+) (\S+)/, (s, a, b) => codeaction.replace(a, b))
		});
	unuseds.length && acts.push({
		kind: CodeActionKind.QuickFix,
		edit: { changes: { [uri]: unuseds } },
		title: codeaction.removeunused()
	});
	parens.length && acts.push({
		kind: CodeActionKind.RefactorRewrite,
		edit: { changes: { [uri]: parens.splice(0) } },
		title: codeaction.parenthesized()
	});
	has_refactor && brace_refactor();
	return acts.length ? acts : undefined;
	function brace_refactor() {
		let { end, start } = range;
		const sl = start.line;
		const eo = document.offsetAt(end);
		const so = document.offsetAt(start);
		const tab = indent || configCache.FormatOptions?.indent_string || '\t';
		const space = configCache.FormatOptions?.space_in_other === false ? '' : ' ';
		let l = 0, r = line_ranges.length - 1, rl = l, rr = r, i;
		while (l <= r) {
			const [a, b] = line_ranges[i = (l + r) >> 1];
			if (a < sl)
				l = rl = i + 1;
			else if (r = i - 1, b > eo)
				rr = r;
		}
		for (i = rl; i <= rr; i++) {
			// eslint-disable-next-line prefer-const
			let [line, bo] = line_ranges[i];
			if (bo > eo) break;
			let tk, bk = tokens[bo];
			if (!bk?.body_start) continue;
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
				end = { line: line + 1, character: 0 };
				const o = document.offsetAt(end);
				tk = lex.findToken(o, true);
				if (tk.type === TokenType.Reserved && words.includes(tk.content.toLowerCase()))
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
			kind: CodeActionKind.RefactorRewrite,
			edit: { changes: { [uri]: parens } },
			title: codeaction.brace()
		});
		function get_indent(bo: number) {
			const end = document.positionAt(bo);
			return document.getText({ start: { line: end.line, character: 0 }, end }).replace(/[^ \t].*/, '');
		}
	}
	function remove_unused(s: number) {
		let tk = tokens[s], end;
		const sym = tk?.symbol;
		if (!sym?.children) return;
		let e = document.offsetAt(sym.range.end);
		while (tk && tk.topofline !== 1)
			tk = tk.previous_token!;
		if (!tk) return;
		if (sym.detail !== undefined) {
			const t = lex.findToken(document.offsetAt({
				line: sym.range.start.line - 1,
				character: 0
			}));
			if (t.symbol === sym)
				tk = t;
		}
		s = tk.offset;
		text ??= document.getText();
		while (' \t'.includes(m = text[e]))
			e++;
		end = document.positionAt(e);
		if (';\r\n'.includes(m))
			end.line++, end.character = 0;
		unuseds.push({ newText: '', range: { start: document.positionAt(s), end } });
	}
}