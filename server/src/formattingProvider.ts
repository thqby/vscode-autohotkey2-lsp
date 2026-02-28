import { DocumentFormattingParams, DocumentOnTypeFormattingParams, DocumentRangeFormattingParams, FormattingOptions, Position, Range, TextEdit } from 'vscode-languageserver';
import { chinesePunctuations, configCache, lexers, Token, TokenType } from './common';

export async function documentFormatting(params: DocumentFormattingParams): Promise<TextEdit[]> {
	const lex = lexers[params.textDocument.uri.toLowerCase()], range = Range.create(0, 0, lex.document.lineCount, 0);
	const newText = lex.beautify({ indent_string: lex.indent = get_indent(params.options), ...configCache.FormatOptions });
	return [{ range, newText }];
}

export async function rangeFormatting(params: DocumentRangeFormattingParams): Promise<TextEdit[] | undefined> {
	const lex = lexers[params.textDocument.uri.toLowerCase()], { options, range } = params;
	const newText = lex.beautify({ ...configCache.FormatOptions, indent_string: lex.indent = get_indent(options) }, range).trim();
	if (newText)
		return [{ range, newText }];
}

export async function typeFormatting(params: DocumentOnTypeFormattingParams): Promise<TextEdit[] | undefined> {
	const lex = lexers[params.textDocument.uri.toLowerCase()], { ch, options, position } = params;
	const opts = { ...configCache.FormatOptions, indent_string: lex.indent = get_indent(options) };
	let tk: Token, s: string, pp: number | undefined, result: TextEdit[] | undefined;
	if (ch === '\n') {
		// eslint-disable-next-line prefer-const
		let { line, character } = position;
		const linetexts = lex.document.getText({
			start: { line: line - 1, character: 0 },
			end: { line: line + 2, character: 0 }
		}).split(/\r?\n/);
		const prev = opts.indent_string;
		let s = linetexts[0].trimEnd(), indent_string = '', cc = '';

		if (!linetexts[1].trim())
			character = linetexts[1].length;

		if (s.endsWith('{')) {
			if ((result = format_end_with_brace({ line: line - 1, character: s.length }))) {
				indent_string = opts.indent_string, cc = '}';
				if (linetexts[1].substring(0, character) !== indent_string)
					result.push({
						newText: indent_string,
						range: { start: { line, character: 0 }, end: { line, character } }
					});
			}
		} else if (s && !/^(;|\/\*)|[ \t];/.test(s.trimStart())) {
			const start = { line, character: 0 }, offset = lex.document.offsetAt(start);
			const rgs = lex.line_ranges, ll = line - 1;
			let l = 0, r = rgs.length - 1, i;
			while (l <= r) {
				const [a, b] = rgs[i = (l + r) >> 1];
				if (ll > a)
					l = i + 1;
				else if (ll < a && offset <= b)
					r = i - 1;
				else if (lex.findStrOrComment(offset))
					break;
				else {
					const range = { start: lex.document.positionAt(b), end: { line: ll, character: s.length } };
					const newText = lex.beautify(opts, range).trim();
					cc = { '(': ')', '[': ']' }[s.slice(-1)] ?? '';
					result = [{ range, newText }];
					if (linetexts[1].substring(0, character) !== (indent_string = opts.indent_string))
						result.push({ newText: indent_string, range: { start, end: position } });
					break;
				}
			}
		}
		if (cc && (s = (linetexts[2] ??= '').trimStart()).startsWith(cc) &&
			!linetexts[2].startsWith((indent_string = indent_string.replace(prev, '')) + cc))
			result!.push({
				newText: indent_string,
				range: {
					start: { line: line + 1, character: 0 },
					end: { line: line + 1, character: linetexts[2].length - s.length }
				}
			});
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
		tk = lex.tokens[lex.document.offsetAt(pos) - 1];
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