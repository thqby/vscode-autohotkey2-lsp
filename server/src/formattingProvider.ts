import { DocumentFormattingParams, DocumentRangeFormattingParams, Range, TextEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Lexer } from './Lexer';
import { lexers } from './server';

const opts = {
	indent_size: "1",
	indent_char: "\t",
	max_preserve_newlines: "2",
	preserve_newlines: true,
	keep_array_indentation: true,
	break_chained_methods: false,
	indent_scripts: "keep",
	brace_style: "collapse",
	space_before_conditional: true,
	wrap_line_length: "0",
	space_after_anon_function: true
};

export async function documentFormatting(params: DocumentFormattingParams): Promise<TextEdit[]> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], range = Range.create(0, 0, doc.document.lineCount, 0);
	if (params.options.insertSpaces)
		opts.indent_char = " ", opts.indent_size = params.options.tabSize.toString();
	let newText = doc.beautify(opts);
	return [{ range, newText }];
}

export async function rangeFormatting(params: DocumentRangeFormattingParams): Promise<TextEdit[]> {
	if (params.options.insertSpaces)
		opts.indent_char = " ", opts.indent_size = params.options.tabSize.toString();
	let range = params.range, document = lexers[params.textDocument.uri.toLowerCase()].document, newText = document.getText(range);
	let t = '';
	if (range.start.character > 0 && (t = document.getText(Range.create(range.start.line, 0, range.start.line, range.start.character))).trim() === '')
		newText = t + newText, range.start.character = 0;
	newText = new Lexer(TextDocument.create('', 'ahk2', -10, newText)).beautify(opts);
	return [{ range, newText }];
}