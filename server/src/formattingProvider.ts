import { DocumentFormattingParams, DocumentOnTypeFormattingParams, DocumentRangeFormattingParams, Position, Range, TextEdit } from 'vscode-languageserver';
import { chinese_punctuations, extsettings, lexers, Token } from './common';

export async function documentFormatting(params: DocumentFormattingParams): Promise<TextEdit[]> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], range = Range.create(0, 0, doc.document.lineCount, 0);
	let opts = Object.assign({}, extsettings.FormatOptions);
	opts.indent_string ??= params.options.insertSpaces ? ' '.repeat(params.options.tabSize) : '\t';
	let newText = doc.beautify(opts);
	return [{ range, newText }];
}

export async function rangeFormatting(params: DocumentRangeFormattingParams): Promise<TextEdit[] | undefined> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], range = params.range;
	let opts = Object.assign({}, extsettings.FormatOptions);
	opts.indent_string = params.options.insertSpaces ? ' '.repeat(params.options.tabSize) : '\t';
	let newText = doc.beautify(opts, range).trim();
	return [{ range, newText }];
}

export async function typeFormatting(params: DocumentOnTypeFormattingParams): Promise<TextEdit[] | undefined> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], { ch, position } = params, result: TextEdit[] | undefined;
	let opts = Object.assign({}, extsettings.FormatOptions), tk: Token, s: string, pp: number | undefined;

	if (ch === '\n') {
		let { line, character } = position, linetexts = doc.document.getText({
			start: { line: line - 1, character: 0 },
			end: { line: line + 2, character: 0 }
		}).split(/\r?\n/), s = linetexts[0].trimRight(), indent_string: string;

		opts.indent_string = params.options.insertSpaces ? ' '.repeat(params.options.tabSize) : '\t';
		if (!linetexts[1].trim())
			character = linetexts[1].length;

		if (s.endsWith('{')) {
			if (result = format_end_with_brace({ line: line - 1, character: s.length })) {
				indent_string = (result[0].range as any).indent_string ?? '';
				if (linetexts[1].substring(0, character) !== indent_string)
					result.push({
						newText: indent_string,
						range: { start: { line, character: 0 }, end: { line, character } }
					});

				if ((s = (linetexts[2] ??= '').trimLeft()).startsWith('}') &&
					!linetexts[2].startsWith((indent_string = indent_string.replace(opts.indent_string, '')) + '}'))
					result.push({
						newText: indent_string,
						range: {
							start: { line: line + 1, character: 0 },
							end: { line: line + 1, character: linetexts[2].length - s.length }
						}
					});
			}
		} else if ((pp = doc.linepos[line - 1]) !== undefined) {
			let range = { start: doc.document.positionAt(pp), end: { line: line - 1, character: s.length } };
			let newText = doc.beautify(opts, range).trim();
			result = [{ range, newText }];
			indent_string = (range as any).indent_string ?? '';
			if (linetexts[1].substring(0, character) !== indent_string)
				result.push({
					newText: indent_string,
					range: { start: { line, character: 0 }, end: { line, character } }
				});
		} else if (!s) {
			if (linetexts[0] !== linetexts[1].substring(0, character))
				result = [{ newText: linetexts[0], range: { start: { line, character: 0 }, end: { line, character } } }];
		}
		return result;
	} else if (ch === '}')
		return format_end_with_brace(position);
	else if ((s = chinese_punctuations[ch])) {
		let p = { line: position.line, character: position.character - 1 };
		tk = doc.find_token(doc.document.offsetAt(p), true);
		if (tk.type === 'TK_WORD') {
			if (tk.length > 1) {
				s = tk.content.replace(/./g, (c) => chinese_punctuations[c] ?? c);
				p.character -= (tk.length - 1);
			}
			return [TextEdit.replace({ start: p, end: position }, s)];
		}
	}

	function format_end_with_brace(pos: Position): TextEdit[] | undefined {
		tk = doc.tokens[doc.document.offsetAt({ line: pos.line, character: pos.character - 1 })];
		pp = tk?.previous_pair_pos;
		if (pp !== undefined) {
			while ((tk = doc.tokens[pp])?.previous_pair_pos !== undefined)
				pp = tk.previous_pair_pos;
			let range = { start: doc.document.positionAt(pp), end: pos };
			let newText = doc.beautify(opts, range).trim();
			return [{ range, newText }];
		}
	}
}