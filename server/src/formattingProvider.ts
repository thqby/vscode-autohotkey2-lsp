import { DocumentFormattingParams, DocumentOnTypeFormattingParams, DocumentRangeFormattingParams, FormattingOptions, Position, Range, TextEdit } from 'vscode-languageserver';
import { chinesePunctuations, configCache, lexers, Token, TokenType } from './common';

export async function documentFormatting(params: DocumentFormattingParams): Promise<TextEdit[]> {
	const lex = lexers[params.textDocument.uri.toLowerCase()], range = Range.create(0, 0, lex.document.lineCount, 0);
	const newText = lex.beautify({ indent_string: get_indent(params.options), ...configCache.FormatOptions });
	return [{ range, newText }];
}

export async function rangeFormatting(params: DocumentRangeFormattingParams): Promise<TextEdit[] | undefined> {
	const lex = lexers[params.textDocument.uri.toLowerCase()], { options, range } = params;
	const newText = lex.beautify({ ...configCache.FormatOptions, indent_string: get_indent(options) }, range).trim();
	return [{ range, newText }];
}

export async function typeFormatting(params: DocumentOnTypeFormattingParams): Promise<TextEdit[] | undefined> {
	const lex = lexers[params.textDocument.uri.toLowerCase()], { ch, options, position } = params;
	const opts = { ...configCache.FormatOptions, indent_string: get_indent(options) };
	let tk: Token, s: string, pp: number | undefined, result: TextEdit[] | undefined;
	if (ch === '\n') {
		// eslint-disable-next-line prefer-const
		let { line, character } = position;
		const linetexts = lex.document.getText({
			start: { line: line - 1, character: 0 },
			end: { line: line + 2, character: 0 }
		}).split(/\r?\n/);
		let s = linetexts[0].trimEnd(), indent_string: string;

		if (!linetexts[1].trim())
			character = linetexts[1].length;

		if (s.endsWith('{')) {
			const prev = opts.indent_string;
			if ((result = format_end_with_brace({ line: line - 1, character: s.length }))) {
				indent_string = opts.indent_string;
				if (linetexts[1].substring(0, character) !== indent_string)
					result.push({
						newText: indent_string,
						range: { start: { line, character: 0 }, end: { line, character } }
					});

				if ((s = (linetexts[2] ??= '').trimStart()).startsWith('}') &&
					!linetexts[2].startsWith((indent_string = indent_string.replace(prev, '')) + '}'))
					result.push({
						newText: indent_string,
						range: {
							start: { line: line + 1, character: 0 },
							end: { line: line + 1, character: linetexts[2].length - s.length }
						}
					});
			}
		} else if ((pp = lex.linepos[line - 1]) !== undefined) {
			const range = { start: lex.document.positionAt(pp), end: { line: line - 1, character: s.length } };
			const newText = lex.beautify(opts, range).trim();
			result = [{ range, newText }];
			indent_string = opts.indent_string;
			if (linetexts[1].substring(0, character) !== indent_string)
				result.push({
					newText: indent_string,
					range: { start: { line, character: 0 }, end: { line, character } }
				});
		} else if (!s) {
			if (linetexts[0] !== (linetexts[1] = linetexts[1].substring(0, character))) {
				if (!linetexts[0]) {
					tk = lex.findToken(lex.document.offsetAt(position));
					if (tk.type === TokenType.String || (tk.type & TokenType.Comment))
						return;
					const b = [TokenType.EOF, TokenType.BracketStart, TokenType.BlockStart];
					while ((tk = tk.previous_token!)) {
						if (b.includes(tk.type))
							break;
					}
					if (b.includes(tk?.type, 1))
						return;
				}
				result = [{ newText: linetexts[0], range: { start: { line, character: 0 }, end: { line, character } } }];
			}
		}
		return result;
	} else if (ch === '}')
		return format_end_with_brace(position);
	else if ((s = chinesePunctuations[ch])) {
		let p = { line: position.line, character: position.character - 1 };
		tk = lex.findToken(lex.document.offsetAt(p));
		if (tk.type === TokenType.Identifier) {
			if (tk.length > 1) {
				s = tk.content.replace(/./g, (c) => chinesePunctuations[c] ?? c);
				p = lex.document.positionAt(tk.offset);
				position.character = p.character + tk.length;
			}
			return [TextEdit.replace({ start: p, end: position }, s)];
		}
	}

	function format_end_with_brace(pos: Position): TextEdit[] | undefined {
		tk = lex.tokens[lex.document.offsetAt({ line: pos.line, character: pos.character - 1 })];
		pp = tk?.previous_pair_pos;
		if (pp !== undefined) {
			while ((tk = lex.tokens[pp])?.previous_pair_pos !== undefined)
				pp = tk.previous_pair_pos;
			const range = { start: lex.document.positionAt(pp), end: pos };
			const newText = lex.beautify(opts, range).trim();
			return [{ range, newText }];
		}
	}
}

function get_indent(options: FormattingOptions) {
	return options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
}