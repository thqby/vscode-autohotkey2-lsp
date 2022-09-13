import { DocumentFormattingParams, DocumentOnTypeFormattingParams, DocumentRangeFormattingParams, Range, TextEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FormatOptions, Lexer } from './Lexer';
import { chinese_punctuations, extsettings, lexers } from './common';

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
	if (doc.instrorcomm(range.start) || doc.instrorcomm(range.end))
		return;
	let newText = doc.beautify(opts, range).trimRight();
	return [{ range, newText }];
}

export async function typeFormatting(params: DocumentOnTypeFormattingParams): Promise<TextEdit[] | undefined> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], pos = params.position, s = '';
	let opts = Object.assign({}, extsettings.FormatOptions);
	if ('}{'.includes(params.ch)) {
		let tk = doc.tokens[doc.document.offsetAt({ line: pos.line, character: pos.character - 1 })];
		let pp = tk?.previous_pair_pos;
		if (pp !== undefined) {
			while ((tk = doc.tokens[pp])?.previous_pair_pos !== undefined)
				pp = tk.previous_pair_pos;
			opts.indent_string = params.options.insertSpaces ? ' '.repeat(params.options.tabSize) : '\t';
			let range = { start: doc.document.positionAt(pp), end: pos };
			let newText = doc.beautify(opts, range).trimRight();
			return [{ range, newText }];
		}
	} else if (s = chinese_punctuations[params.ch]) {
		let { line, character } = params.position;
		if (doc.instrorcomm(params.position))
			return;
		return [TextEdit.replace(Range.create({ line, character: character - 1 }, params.position), s)];
	}
}