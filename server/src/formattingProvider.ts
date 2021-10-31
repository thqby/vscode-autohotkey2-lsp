import { DocumentFormattingParams, DocumentOnTypeFormattingParams, DocumentRangeFormattingParams, Range, TextEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Lexer } from './Lexer';
import { lexers } from './common';

const default_format_options = {
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
	let opts = Object.assign({}, default_format_options);
	if (params.options.insertSpaces)
		opts.indent_char = " ", opts.indent_size = params.options.tabSize.toString();
	else opts.indent_char = "\t";
	let newText = doc.beautify(opts);
	return [{ range, newText }];
}

export async function rangeFormatting(params: DocumentRangeFormattingParams): Promise<TextEdit[] | undefined> {
	let opts = Object.assign({}, default_format_options);
	if (params.options.insertSpaces)
		opts.indent_char = " ", opts.indent_size = params.options.tabSize.toString();
	else opts.indent_char = "\t";
	let range = params.range, doc = lexers[params.textDocument.uri.toLowerCase()], document = doc.document, newText = document.getText(range);
	if (doc.instrorcomm(range.start) || doc.instrorcomm(range.end))
		return;
	let t = '';
	if (range.start.character > 0 && (t = document.getText(Range.create(range.start.line, 0, range.start.line, range.start.character))).trim() === '')
		newText = t + newText, range.start.character = 0;
	newText = new Lexer(TextDocument.create('', 'ahk2', -10, newText)).beautify(opts);
	return [{ range, newText }];
}

export async function typeFormatting(params: DocumentOnTypeFormattingParams): Promise<TextEdit[] | undefined> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], pos = params.position, s = '', t = params.options.insertSpaces ? ' '.repeat(params.options.tabSize) : '\t';
	if (params.ch === '{') {
		if (new RegExp('^(' + t + ')+\\{').test(s = doc.document.getText(Range.create(pos.line, 0, pos.line, pos.character)))) {
			if (doc.instrorcomm(pos))
				return;
			let line = pos.line, l = s.slice(0, -1), l1 = l.replace(t, ''), s1 = '', r = new RegExp('^' + l + '(?!' + t + ')');
			while (line > 0 && r.test(s1 = doc.document.getText({ start: { line: line - 1, character: 0 }, end: { line, character: 0 } })) && !s1.match(/^\s*(\{|\}|(if|else|for|loop|while|try|catch|finally)\b|.*\{\s*(;.*)?$)/i))
				line--;
			if (new RegExp('^' + l1 + '(\\}\\s*)?(if|else|for|loop|while|try|catch|finally)\\b', 'i').test(s1) && !s1.match(/\{\s*(;.*)?$/))
				return [{ newText: l1 + '{', range: Range.create(pos.line, 0, pos.line, pos.character) }];
		}
	} else if (params.ch === '}') {
		if (doc.document.getText(Range.create(pos.line, 0, pos.line, pos.character - 1)).trim() !== '')
			return;
		let n = doc.searchScopedNode(pos);
		if (n && n.range.end.line === pos.line && n.range.start.line < pos.line)
			return rangeFormatting({
				range: { start: { line: n.range.start.line, character: 0 }, end: pos },
				textDocument: params.textDocument,
				options: params.options
			});
	}
}