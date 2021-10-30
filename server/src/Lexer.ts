import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { argv0 } from 'process';
import {
	Position,
	Range,
	SymbolKind,
	DocumentSymbol,
	Diagnostic,
	DiagnosticSeverity,
	FoldingRange,
	ColorInformation,
	SemanticTokensBuilder
} from 'vscode-languageserver';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { builtin_variable, builtin_variable_h } from './constants';
import { completionitem, diagnostic } from './localize';
import { ahkvars, inBrowser, isahk2_h, lexers, libdirs, openFile, pathenv } from './global';

export interface AhkDoc {
	include: string[]
	children: DocumentSymbol[]
	funccall: DocumentSymbol[]
}

export enum FuncScope {
	DEFAULT = 0, GLOBAL = 1
}

export enum SemanticTokenTypes {
	class,
	function,
	method,
	parameter,
	variable,
	property,
	keyword,
	string,
	number,
	event,
	modifier
}

export enum SemanticTokenModifiers {
	definition,
	readonly,
	static,
	deprecated,
	modification,
	documentation,
	defaultLibrary
}

export interface FuncNode extends DocumentSymbol {
	assume: FuncScope
	closure?: boolean
	static?: boolean
	params: Variable[]
	global: { [key: string]: Variable }
	local: { [key: string]: Variable }
	full: string
	parent?: DocumentSymbol
	funccall?: DocumentSymbol[]
	labels: { [key: string]: DocumentSymbol[] }
	declaration: { [name: string]: FuncNode | ClassNode | Variable };
	returntypes?: { [exp: string]: any }
}

export interface ClassNode extends DocumentSymbol {
	full: string
	extends: string
	parent?: DocumentSymbol
	funccall: DocumentSymbol[]
	declaration: { [name: string]: FuncNode | Variable };
	staticdeclaration: { [name: string]: FuncNode | ClassNode | Variable };
	cache: DocumentSymbol[]
	returntypes?: { [exp: string]: any }
}

export interface Word {
	name: string
	range: Range
}

export interface Variable extends DocumentSymbol {
	ref?: boolean
	static?: boolean
	def?: boolean
	arr?: boolean
	defaultVal?: string
	full?: string
	returntypes?: { [exp: string]: any }
}

export interface ReferenceInfomation {
	name: string
	line: number
}

export interface SemanticToken {
	type: SemanticTokenTypes
	modifier?: number
}

export interface Token {
	type: string
	content: string
	offset: number
	length: number
	topofline?: boolean
	ignore?: boolean
	semantic?: SemanticToken
	pos?: Position
}

export namespace SymbolNode {
	export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range, children?: DocumentSymbol[]): DocumentSymbol {
		return { name, kind, range, selectionRange, children };
	}
}

export namespace FuncNode {
	export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range, params: Variable[], children?: DocumentSymbol[], isstatic?: boolean): FuncNode {
		let full = '';
		params = params || [];
		params.map(param => {
			full += ', ' + (param.ref ? '&' : '') + param.name + (param.defaultVal ? ' := ' + param.defaultVal : param.arr ? '*' : '');
		});
		full = (isstatic ? 'static ' : '') + name + '(' + full.substring(2) + ')';
		if (params.length && params[params.length - 1].name === '*')
			params.pop();
		return { assume: FuncScope.DEFAULT, name, kind, range, selectionRange, params, full, children, funccall: [], declaration: {}, global: {}, local: {}, labels: {} };
	}
}

export namespace Word {
	export function create(name: string, range: Range): Word {
		return { name, range };
	}
}

namespace Variable {
	export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range): Variable {
		return { name, kind, range, selectionRange };
	}
}

export namespace ReferenceInfomation {
	export function create(name: string, line: number): ReferenceInfomation {
		return { name, line };
	}
}

export function isIdentifierChar(code: number) {
	if (code < 48) return code === 36;
	if (code < 58) return true;
	if (code < 65) return false;
	if (code < 91) return true;
	if (code < 97) return code === 95;
	if (code < 123) return true;
	return code > 127;
}
export let allIdentifierChar = new RegExp('^[^\x00-\x2f\x3a-\x40\x5b\x5c\x5d\x5e\x60\x7b-\x7f]+$');

const colorregexp = new RegExp(/(?<=['"\s])(c|background|#)?((0x)?[\da-f]{6}([\da-f]{2})?|(black|silver|gray|white|maroon|red|purple|fuchsia|green|lime|olive|yellow|navy|blue|teal|aqua))\b/i);
const colortable = JSON.parse('{ "black": "000000", "silver": "c0c0c0", "gray": "808080", "white": "ffffff", "maroon": "800000", "red": "ff0000", "purple": "800080", "fuchsia": "ff00ff", "green": "008000", "lime": "00ff00", "olive": "808000", "yellow": "ffff00", "navy": "000080", "blue": "0000ff", "teal": "008080", "aqua": "00ffff" }');
let searchcache: { [name: string]: any } = {};
let hasdetectcache: { [exp: string]: any } = {};

export class Lexer {
	public actived: boolean = false;
	public beautify: Function;
	public blocks: DocumentSymbol[] | undefined;
	public children: DocumentSymbol[] = [];
	public d = 0;
	public declaration: { [name: string]: FuncNode | ClassNode | Variable } = {};
	public diagnostics: Diagnostic[] = [];
	public diags = 0;
	public document: TextDocument;
	public foldingranges: FoldingRange[] = [];
	public funccall: DocumentSymbol[] = [];
	public get_tokon: Function;
	public hotkey: FuncNode[] = [];
	public include: { [uri: string]: { url: string, path: string, raw: string } } = {};
	public includedir: Map<number, string> = new Map();
	public label: DocumentSymbol[] = [];
	public labels: { [key: string]: DocumentSymbol[] } = {};
	public libdirs: string[] = [];
	public object: { method: { [key: string]: FuncNode[] }, property: { [key: string]: any }, userdef: { [key: string]: FuncNode } } = { method: {}, property: {}, userdef: {} };
	public parseScript: Function;
	public reflat: boolean = false;
	public relevance: { [uri: string]: { url: string, path: string, raw: string } } | undefined;
	public scriptdir: string = '';
	public scriptpath: string;
	public tokens: { [pos: number]: Token } = {};
	public STB: SemanticTokensBuilder = new SemanticTokensBuilder;
	public strcommpos: { [begin: number]: { end: number, type: 1 | 2 | 3 } } = {};
	public texts: { [key: string]: string } = {};
	public uri: string;
	public version: number = 0;
	constructor(document: TextDocument) {
		let input: string, output_lines: { text: any[]; }[], flags: any, opt: any, previous_flags: any, prefix: string, flag_store: any[], includetable: { [uri: string]: { path: string, raw: string } };
		let token_text: string, token_text_low: string, token_type: string, last_type: string, last_text: string, last_last_text: string, indent_string: string, includedir: string, _this: Lexer = this, h = isahk2_h;
		let whitespace: string[], wordchar: string[], punct: string[], parser_pos: number, line_starters: any[], reserved_words: any[], digits: string[], filepath: string, customblocks: { region: number[], bracket: number[] };
		let input_wanted_newline: boolean, output_space_before_token: boolean, following_bracket: boolean, keep_Object_line: boolean, begin_line: boolean, end_of_object: boolean, closed_cycle: number, tks: Token[] = [], ck: Token;
		let input_length: number, n_newlines: number, last_LF: number, bracketnum: number, whitespace_before_token: any[], beginpos: number, preindent_string: string, keep_comma_space = false, last_top = false, lst: Token;
		let handlers: any, MODE: { BlockStatement: any; Statement: any; ArrayLiteral: any; Expression: any; ForInitializer: any; Conditional: any; ObjectLiteral: any; };

		this.document = document, this.scriptpath = (filepath = URI.parse(this.uri = document.uri.toLowerCase()).fsPath).replace(/\\[^\\]+$/, ''), this.initlibdirs();
		whitespace = "\n\r\t ".split(''), digits = '0123456789'.split(''), wordchar = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$'.split('');
		punct = '+ - * / % & ++ -- ** // = += -= *= /= //= .= == := != !== ~= > < >= <= >>> >> << >>>= >>= <<= && &= | || ! ~ , : ? ^ ^= |= :: =>'.split(' ');
		line_starters = 'try,throw,return,global,local,static,if,switch,case,for,while,loop,continue,break,goto'.split(',');
		reserved_words = line_starters.concat(['class', 'in', 'is', 'isset', 'contains', 'else', 'until', 'catch', 'finally', 'and', 'or', 'not', 'as', 'unset', 'super']);
		MODE = { BlockStatement: 'BlockStatement', Statement: 'Statement', ObjectLiteral: 'ObjectLiteral', ArrayLiteral: 'ArrayLiteral', ForInitializer: 'ForInitializer', Conditional: 'Conditional', Expression: 'Expression' };
		handlers = {
			'TK_START_EXPR': handle_start_expr,
			'TK_END_EXPR': handle_end_expr,
			'TK_START_BLOCK': handle_start_block,
			'TK_END_BLOCK': handle_end_block,
			'TK_WORD': handle_word,
			'TK_RESERVED': handle_word,
			'TK_STRING': handle_string,
			'TK_EQUALS': handle_equals,
			'TK_OPERATOR': handle_operator,
			'TK_COMMA': handle_comma,
			'TK_BLOCK_COMMENT': handle_block_comment,
			'TK_INLINE_COMMENT': handle_inline_comment,
			'TK_COMMENT': handle_comment,
			'TK_DOT': handle_dot,
			'TK_HOT': handle_word2,
			'TK_SHARP': handle_word2,
			'TK_NUMBER': handle_word2,
			'TK_LABEL': handle_label,
			'TK_HOTLINE': handle_unknown,
			'TK_UNKNOWN': handle_unknown
		};

		this.get_tokon = function (offset?: number): Token {
			let p = parser_pos, t: Token;
			if (offset !== undefined) {
				parser_pos = offset, t = get_next_token(), parser_pos = p;
			} else t = get_next_token();
			return t;
		}

		this.beautify = function (options: any) {
			/*jshint onevar:true */
			let i: number, keep_whitespace: boolean, sweet_code: string, top: boolean = false;
			options = options ? options : {}, opt = {}, this.tokens = {}, lst = { type: '', content: '', offset: 0, length: 0 };
			if (options.braces_on_own_line !== undefined) { //graceful handling of deprecated option
				opt.brace_style = options.braces_on_own_line ? "expand" : "collapse";
			}
			opt.brace_style = options.brace_style ? options.brace_style : (opt.brace_style ? opt.brace_style : "collapse");
			if (opt.brace_style === "expand-strict") {
				opt.brace_style = "expand";
			}
			opt.indent_size = options.indent_size ? parseInt(options.indent_size, 10) : 4;
			opt.indent_char = options.indent_char ? options.indent_char : ' ';
			opt.preserve_newlines = (options.preserve_newlines === undefined) ? true : options.preserve_newlines;
			opt.break_chained_methods = (options.break_chained_methods === undefined) ? false : options.break_chained_methods;
			opt.max_preserve_newlines = (options.max_preserve_newlines === undefined) ? 0 : parseInt(options.max_preserve_newlines, 10);
			opt.space_in_paren = (options.space_in_paren === undefined) ? false : options.space_in_paren;
			opt.space_in_empty_paren = (options.space_in_empty_paren === undefined) ? false : options.space_in_empty_paren;
			opt.keep_array_indentation = (options.keep_array_indentation === undefined) ? false : options.keep_array_indentation;
			opt.space_before_conditional = (options.space_before_conditional === undefined) ? true : options.space_before_conditional;
			opt.wrap_line_length = (options.wrap_line_length === undefined) ? 0 : parseInt(options.wrap_line_length, 10);
			if (options.indent_with_tabs) {
				opt.indent_char = '\t', opt.indent_size = 1;
			}
			indent_string = '';
			while (opt.indent_size > 0) {
				indent_string += opt.indent_char, opt.indent_size -= 1;
			}
			last_type = 'TK_START_BLOCK', last_last_text = '', output_lines = [create_output_line()];
			output_space_before_token = false, flag_store = [], flags = null, set_mode(MODE.BlockStatement), preindent_string = '';
			let source_text = this.document.getText();
			while (source_text && (source_text.charAt(0) === ' ' || source_text.charAt(0) === '\t')) {
				preindent_string += source_text.charAt(0), source_text = source_text.substring(1);
			}
			input = source_text, input_length = input.length, whitespace_before_token = [];
			following_bracket = false, begin_line = true, bracketnum = 0, parser_pos = 0, last_LF = -1;
			while (true) {
				ck = get_next_token();
				token_text = ck.content, token_text_low = token_text.toLowerCase();
				token_type = ck.type;

				if (token_type === 'TK_EOF') {
					// Unwind any open statements
					while (flags.mode === MODE.Statement) {
						restore_mode();
					}
					break;
				}

				keep_whitespace = opt.keep_array_indentation && is_array(flags.mode);
				input_wanted_newline = n_newlines > 0;

				if (keep_whitespace) {
					for (i = 0; i < n_newlines; i += 1) {
						print_newline(i > 0);
					}
				} else {
					if (opt.max_preserve_newlines && n_newlines > opt.max_preserve_newlines) {
						n_newlines = opt.max_preserve_newlines;
					}

					if (opt.preserve_newlines) {
						if (n_newlines > 1) {
							// if (n_newlines && token_text !== ',') {
							print_newline();
							for (i = 1; i < n_newlines; i += 1) {
								print_newline(true);
							}
						}
					}
				}
				last_top = top;
				if (top) {
					top = false;
					if (in_array(flags.mode, [MODE.BlockStatement, MODE.Statement])) {
						if (token_type === 'TK_DOT' && last_type === 'TK_WORD')
							top = true;
						else if (token_type === 'TK_WORD') {
							if (ck.topofline)
								top = true;
							else {
								switch (last_type) {
									case 'TK_START_BLOCK':
										top = true;
										break;
									case 'TK_WORD':
										if (flags.last_text.slice(-2) === '::')
											top = true;
										break;
									case 'TK_RESERVED':
										if (flags.last_text.match(/^(try|else|finally)$/i))
											top = true;
										break;
								}
							}
						} else if (token_type === 'TK_COMMA')
							keep_comma_space = true;
					}
				} else if ((ck.topofline && in_array(flags.mode, [MODE.Statement, MODE.BlockStatement]) &&
					in_array(token_type, ['TK_WORD', 'TK_START_BLOCK', 'TK_HOT', 'TK_SHARP'])) ||
					(token_type === 'TK_RESERVED' && token_text.match(/^(try|else|finally)$/i)))
					top = true;
				handlers[token_type]();

				// The cleanest handling of inline comments is to treat them as though they aren't there.
				// Just continue formatting and the behavior should be logical.
				// Also ignore unknown tokens.  Again, this should result in better behavior.
				if (token_type !== 'TK_INLINE_COMMENT' && token_type !== 'TK_COMMENT' &&
					token_type !== 'TK_BLOCK_COMMENT') {
					if (!following_bracket && token_type === 'TK_RESERVED' && in_array(token_text_low, ['if', 'for', 'while', 'loop', 'catch', 'switch'])) {
						output_space_before_token = true;
						following_bracket = true;
						bracketnum = 0;
						last_last_text = token_text;
						flags.last_text = '(';
						last_type = 'TK_START_EXPR';
						if (token_text_low === 'switch') {
							set_mode(MODE.Conditional), flags.had_comment = false;
							continue;
						} else if (in_array(token_text_low, ['if', 'while'])) {
							set_mode(MODE.Conditional);
						} else {
							set_mode(MODE.ForInitializer);
						}
						indent();
					}
					else {
						last_last_text = flags.last_text;
						last_type = token_type;
						flags.last_text = token_text;
					}
					flags.had_comment = false;
					last_text = token_text_low;
				} else flags.had_comment = token_type === 'TK_INLINE_COMMENT';
			}

			sweet_code = output_lines[0].text.join('');
			for (let line_index = 1; line_index < output_lines.length; line_index++) {
				sweet_code += '\n' + output_lines[line_index].text.join('');
			}
			sweet_code = sweet_code.replace(/[\r\n ]+$/, '');
			return sweet_code;
		};

		if (document.uri.match(/\.d\.(ahk2?|ah2)$/i)) {
			this.d = 1;
			this.parseScript = function (islib = false): void {
				input = this.document.getText(), input_length = input.length, includedir = this.scriptpath, tks.length = 0;
				whitespace_before_token = [], beginpos = 0, lst = { type: '', content: '', offset: 0, length: 0 };
				following_bracket = false, begin_line = true, bracketnum = 0, parser_pos = 0, last_LF = -1;
				let _low = '', i = 0, j = 0, l = 0, isstatic = false, tk: Token, lk: Token;
				this.tokens = {}, this.children.length = this.foldingranges.length = this.diagnostics.length = 0;
				this.declaration = {}, this.blocks = [], this.strcommpos = {}, customblocks = { region: [], bracket: [] };
				let blocks = 0, rg: Range, tokens: Token[] = [], cls: string[] = [];
				let p: DocumentSymbol[] = [DocumentSymbol.create('', undefined, SymbolKind.Namespace, rg = makerange(0, 0), rg, this.children)];
				(<FuncNode>p[0]).declaration = this.declaration;
				while ((tk = get_next_token()).type !== 'TK_EOF')
					tokens.push(tk);
				l = tokens.length;
				next:
				while (i < l) {
					switch ((tk = tokens[i]).type) {
						case 'TK_COMMENT':
						case 'TK_BLOCK_COMMENT':
							i++;
							continue next;
						case 'TK_WORD':
							j = i + 1;
							if (j < l) {
								if (blocks && ((lk = tokens[j]).topofline || lk.content === '=>')) {
									let tn = Variable.create(tk.content, SymbolKind.Property, rg = makerange(tk.offset, tk.length), rg);
									tk.semantic = { type: SemanticTokenTypes.property, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly | (isstatic ? 1 << SemanticTokenModifiers.static : 0) };
									p[blocks].children?.push(tn), tn.static = isstatic, tn.full = `(${cls.join('.')}) ` + tn.name;
									if (isstatic && blocks)
										(<ClassNode>p[blocks]).staticdeclaration[tn.name.toLowerCase()] = tn;
									else
										(<ClassNode>p[blocks]).declaration[tn.name.toLowerCase()] = tn;
									if (tokens[i - (isstatic ? 2 : 1)].type.endsWith('COMMENT'))
										tn.detail = trimcomment(tokens[i - (isstatic ? 2 : 1)].content);
									let rets: string[] = [];
									if (lk.content === '=>') {
										lk = tokens[++j], rets = ['#' + lk.content.toLowerCase()];
										while (tokens[j + 1]?.content === '|')
											rets.push('#' + (lk = tokens[j = j + 2]).content);
									}
									tn.returntypes = { [rets.length ? `[${rets.join(',')}]` : (rets.pop() || '#any')]: true };
									tn.full = `(${cls.join('.')}) ` + tn.name;
								} else if (tokens[j].content === '(') {
									let params: Variable[] = [], byref = false;
									while ((lk = tokens[++j]).content !== ')') {
										switch (lk.type) {
											case 'TK_WORD':
												let tn = Variable.create(lk.content, SymbolKind.Variable, rg = makerange(lk.offset, lk.length), rg);
												tn.ref = byref, byref = false, params.push(tn), lk.semantic = { type: SemanticTokenTypes.parameter, modifier: 1 << SemanticTokenModifiers.definition };
												if ((lk = tokens[j + 1]).content === ':=') {
													j = j + 2;
													if ((lk = tokens[j]).content === '+' || lk.content === '-')
														tn.defaultVal = lk.content + tokens[++j].content;
													else
														tn.defaultVal = lk.content;
												} else if (lk.content === '*')
													tn.arr = true, j++;
												break;
											case 'TK_STRING':
												params.push(Variable.create(lk.content, SymbolKind.String, rg = makerange(lk.offset, lk.length), rg));
												break;
											default:
												byref = false;
												if (lk.content === '&')
													byref = true;
												else if (lk.content === '*')
													params.push(Variable.create(lk.content, SymbolKind.Variable, rg = makerange(lk.offset, lk.length), rg)), lk.semantic = { type: SemanticTokenTypes.parameter, modifier: 1 << SemanticTokenModifiers.definition };
												break;
										}
									}
									let rets: string[] | undefined, r = '', lt = '';
									lk = tokens[j];
									if (j < l - 2 && tokens[j + 1].content === '=>') {
										rets = [];
										do {
											j = j + 1, r = '', lt = '';
											while (((lk = tokens[j + 1]).type === 'TK_WORD' || lk.type === 'TK_DOT') && (!lk.topofline && lt !== lk.type))
												r += lk.content, j++, lt = lk.type;
											rets.push(r.replace(/([^\x00-\x2f\x3a-\x40\x5b\x5c\x5d\x5e\x60\x7b-\x7f]+)$/, '@$1'));
										} while (tokens[j + 1].content === '|');
										lk = tokens[j];
									}
									let tn = FuncNode.create(tk.content, blocks ? SymbolKind.Method : SymbolKind.Function, makerange(tk.offset, lk.offset + lk.length - tk.offset), makerange(tk.offset, tk.length), params, [], isstatic);
									tn.full = this.document.getText(tn.range), tn.static = isstatic, tn.declaration = {}, tk.semantic = { type: blocks ? SemanticTokenTypes.method : SemanticTokenTypes.function, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly | (isstatic ? 1 << SemanticTokenModifiers.static : 0) };
									if (blocks)
										tn.full = `(${cls.join('.')}) ` + tn.full;
									if (rets) {
										let o: any = {};
										rets.map((tp: string) => o[tp.toLowerCase()] = true);
										tn.returntypes = o;
									}
									if (tokens[i - (isstatic ? 2 : 1)].type.endsWith('COMMENT'))
										tn.detail = trimcomment(tokens[i - (isstatic ? 2 : 1)].content);
									p[blocks].children?.push(tn);
									if (isstatic && blocks)
										(<ClassNode>p[blocks]).staticdeclaration[tn.name.toLowerCase()] = tn;
									else
										(<ClassNode>p[blocks]).declaration[tn.name.toLowerCase()] = tn;
								}
							}
							i = j + 1, isstatic = false;
							break;
						case 'TK_RESERVED':
							isstatic = false;
							if ((_low = tk.content.toLowerCase()) === 'static') {
								isstatic = true, i++;
							} else if (i < l - 1 && _low === 'class') {
								let extends_ = '', tn = DocumentSymbol.create((tk = tokens[++i]).content.replace('_', '#'), tokens[i - 2].type.endsWith('COMMENT') ? trimcomment(tokens[i - 2].content) : undefined, SymbolKind.Class, makerange(tokens[i - 1].offset, 0), makerange(tk.offset, tk.length), []);
								let cl = tn as ClassNode;
								cl.declaration = {}, cl.staticdeclaration = {}, j = i + 1, cls.push(tn.name), cl.full = cls.join('.'), cl.returntypes = { [(cl.full.replace(/([^.]+)$/, '@$1')).toLowerCase()]: true };
								tk.semantic = { type: SemanticTokenTypes.class, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly };
								cl.funccall = [], cl.extends = '', cl.declaration = {}, cl.staticdeclaration = {}, p[blocks].children?.push(tn);
								if (blocks === 0)
									(<FuncNode>p[0]).declaration[tn.name.toLowerCase()] = tn;
								else
									(<ClassNode>p[blocks]).staticdeclaration[tn.name.toLowerCase()] = tn;
								if ((lk = tokens[j])?.content.toLowerCase() === 'extends') {
									while ((++j) < l && (lk = tokens[j]).content !== '{')
										extends_ += lk.content;
									cl.extends = extends_;
								}
								blocks++, p.push(tn);
								i = j + 1;
							} else if (_low === 'isset')
								tk.type = 'TK_WORD';
							else
								i++;
							break;
						case 'TK_END_BLOCK':
							if (blocks) {
								blocks--, cls.pop();
								let cl = p.pop() as DocumentSymbol;
								cl.range.end = this.document.positionAt(tk.offset + tk.length);
								this.addFoldingRangePos(cl.range.start, cl.range.end);
							}
						default:
							i++, isstatic = false;
							break;
					}
				}
				if (islib || (this.d & 2)) {
					this.d = 3;
					this.children.map(it => {
						switch (it.kind) {
							case SymbolKind.Function:
							case SymbolKind.Class:
								(<any>it).uri = this.uri;
								ahkvars[it.name.toLowerCase()] = it as ClassNode;
								break;
						}
					});
				}
				checksamenameerr({}, this.children, this.diagnostics);
				this.children.push(...this.blocks);
				this.diags = this.diagnostics.length, this.blocks = undefined;
				customblocks.region.map(o => this.addFoldingRange(o, parser_pos - 1, 'line'));
			}
		} else {
			this.parseScript = function (islib?: boolean): void {
				input = this.document.getText(), input_length = input.length, includedir = this.scriptpath;
				tks.length = 0, whitespace_before_token = [], beginpos = 0, following_bracket = false, begin_line = true;
				bracketnum = 0, parser_pos = 0, last_LF = -1, customblocks = { region: [], bracket: [] }, closed_cycle = 0, h = isahk2_h;
				this.label.length = this.funccall.length = this.diagnostics.length = this.hotkey.length = 0;
				this.foldingranges.length = this.children.length = 0, this.labels = {};
				this.object = { method: {}, property: {}, userdef: {} }, this.includedir = new Map();
				this.blocks = [], this.texts = {}, this.reflat = true, this.declaration = {}, this.strcommpos = {};
				this.include = includetable = {}, this.tokens = {}, lst = { type: '', content: '', offset: 0, length: 0 };
				this.children.push(...parseblock()), this.children.push(...this.blocks), this.blocks = undefined;
				checksamenameerr(this.declaration, this.children, this.diagnostics);
				this.diags = this.diagnostics.length;
				customblocks.region.map(o => this.addFoldingRange(o, parser_pos - 1, 'line'));
			}
		}

		function parseblock(mode = 0, scopevar = new Map<string, any>(), classfullname: string = ''): DocumentSymbol[] {
			const result: DocumentSymbol[] = [], document = _this.document;
			let _parent = scopevar.get('#parent') || _this, tk: Token = { content: '', type: '', offset: 0, length: 0 };
			let lk: Token = tk, next: boolean = true, LF: number = 0, topcontinue = false, _low = '', m: any;
			let blocks = 0, inswitch = -1, blockpos: number[] = [], tn: DocumentSymbol | FuncNode | Variable | undefined;
			let raw = '', o: any = '', last_comm = '', tds: Diagnostic[] = [], cmm: Token = { content: '', offset: 0, type: '', length: 0 };
			if (mode !== 0)
				blockpos.push(parser_pos - 1);
			while (nexttoken()) {
				switch (tk.type) {
					case 'TK_SHARP':
						if (m = tk.content.match(/^\s*#include((again)?)\s+((\*i\s+)?<.+>|(['"]?)(\s*\*i\s+)?.+?\4)?\s*(\s;.*)?$/i)) {
							raw = (m[3] || '').trim(), o = m[4] || m[6], m = raw.replace(/%(a_scriptdir|a_workingdir)%/i, _this.scriptdir).replace(/%a_linefile%/i, filepath).replace(/\s*\*i\s+/i, '').replace(/['"]/g, '');
							_this.includedir.set(document.positionAt(tk.offset).line, includedir);
							if (m === '') {
								_this.addDiagnostic(diagnostic.pathinvalid(), tk.offset, tk.length);
							} else if (!inBrowser) {
								if (m.startsWith('*')) {
									_this.addDiagnostic(diagnostic.unsupportresinclude(), tk.offset, tk.length, DiagnosticSeverity.Warning);
								} else if (!(m = pathanalyze(m.toLowerCase(), _this.libdirs, includedir)) || !existsSync(m.path)) {
									if (!o)
										_this.addDiagnostic(m ? diagnostic.filenotexist(m.path) : diagnostic.pathinvalid(), tk.offset, tk.length);
								} else if (statSync(m.path).isDirectory())
									includedir = m.path;
								else if (m.path.match(/\.(ahk2?|ah2)$/i))
									includetable[m.uri] = { path: m.path, raw };
								else _this.addDiagnostic(diagnostic.unknowninclude(m.path), tk.offset, tk.length);
								if (mode !== 0) _this.addDiagnostic(diagnostic.unsupportinclude(), tk.offset, tk.length, DiagnosticSeverity.Warning);
							}
						} else if (m = tk.content.match(/^(\s*#dllimport\s+)((\w|[^\x00-\x7f])+)/i)) {
							let rg = makerange(tk.offset + m[1].length, m[2].length), rg2 = Range.create(0, 0, 0, 0);
							let tps: { [t: string]: string } = { t: 'ptr', i: 'int', s: 'str', a: 'astr', w: 'wstr', h: 'short', c: 'char', f: 'float', d: 'double', i6: 'int64' };
							let n = m[2], args: Variable[] = [], u = '', i = 0;
							h = true, m = tk.content.substring(m[0].length).match(/^\s*,[^,]+,([^,]*)/);
							if (m) {
								m = m[1].replace(/\s/g, '').replace(/^\w*=+/, '').toLowerCase();
								(<string>m).split('').map(c => {
									if (c === 'u')
										u = 'u';
									else {
										if (tps[c])
											args.push(Variable.create((++i).toString() + '_' + u + tps[c], SymbolKind.Variable, rg2, rg2));
										u = '';
									}
								});
							}
							result.push(FuncNode.create(n, SymbolKind.Function, rg, rg, args));
						} else {
							let t = input.indexOf('\n', parser_pos);
							parser_pos = t === -1 ? input_length : t;
						}
						break;
					case 'TK_LABEL':
						if (inswitch > -1 && tk.content.toLowerCase() === 'default:') break;
						if (mode === 2) {
							_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset, tk.length);
							break;
						}
						tn = SymbolNode.create(tk.content, SymbolKind.Field, makerange(tk.offset, tk.length), makerange(tk.offset, tk.length - 1)), result.push(tn);
						if (_parent.labels) {
							_low = tk.content.toLowerCase().slice(0, -1), (<any>tn).def = true;
							if (!_parent.labels[_low])
								_parent.labels[_low] = [tn];
							else if (_parent.labels[_low][0].def)
								_this.addDiagnostic(diagnostic.duplabel(), tk.offset, tk.length - 1), _parent.labels[_low].push(tn);
							else
								_parent.labels[_low].unshift(tn);
						}
						if (n_newlines === 1 && (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')) tn.detail = trimcomment(lk.content); break;
					case 'TK_HOT':
						topcontinue = true;
						if (mode !== 0) _this.addDiagnostic(diagnostic.hotdeferr(), tk.offset, tk.length);
						else if (tk.content.match(/\s::$/) || ((m = tk.content.match(/\S(\s*)&(\s*)\S+::/)) && (m[1] === '' || m[2] === '')))
							_this.addDiagnostic(diagnostic.invalidhotdef(), tk.offset, tk.length);
						tn = SymbolNode.create(tk.content, SymbolKind.Event, makerange(tk.offset, tk.length), makerange(tk.offset, tk.length - 2)) as FuncNode;
						if (n_newlines === 1 && (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')) tn.detail = trimcomment(lk.content);
						lk = tk, tk = get_token_ingore_comment(cmm);
						let ht = lk, v: Variable, vars = new Map<string, any>([['#parent', tn]]);
						(<FuncNode>tn).params = [v = Variable.create('ThisHotkey', SymbolKind.Variable, makerange(0, 0), makerange(0, 0))];
						v.detail = completionitem.thishotkey(), (<FuncNode>tn).funccall = [], (<FuncNode>tn).declaration = {}, result.push(tn);
						(<FuncNode>tn).global = {}, (<FuncNode>tn).local = {}, _this.hotkey.push(tn as FuncNode);
						if (tk.content === '{') {
							tn.children = [], tn.children.push(...parseblock(1, vars)), tn.range = makerange(ht.offset, parser_pos - ht.offset);
							_this.addFoldingRangePos(tn.range.start, tn.range.end);
							adddeclaration(tn as FuncNode);
						} else if (tk.content.toLowerCase() === 'return') {
							if (tk.topofline) {
								tn.children = [], tn.range = makerange(ht.offset, tk.offset + tk.length - ht.offset);
								_this.addDiagnostic(diagnostic.invalidhotdef(), ht.offset, ht.length);
								break;
							}
							let hh = tn as FuncNode, t = _parent, tm = mode;
							_parent = tn, mode = 1;
							tn.children = parseline();
							adddeclaration(hh), _parent = t, mode = tm;
							hh.range = makerange(ht.offset, lk.offset + lk.length - ht.offset);
						} else {
							let hh = tn as FuncNode, t = _parent, tm = mode;
							_parent = tn, mode = 1;
							if (tk.content.toLowerCase().match(/^(global|local|static)$/)) {
								hh.children = [], parse_reserved();
							} else
								next = false, hh.children = parseline();
							adddeclaration(hh), _parent = t, mode = tm;
							hh.range = makerange(ht.offset, lk.offset + lk.length - ht.offset);
						}
						break;
					case 'TK_HOTLINE':
						if (mode !== 0) _this.addDiagnostic(diagnostic.hotdeferr(), tk.offset, tk.length);
						tn = SymbolNode.create(tk.content, SymbolKind.Event, makerange(tk.offset, tk.length), makerange(tk.offset, tk.length - 2));
						if (n_newlines === 1 && (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')) tn.detail = trimcomment(lk.content);
						LF = input.indexOf('\n', parser_pos), parser_pos = LF > -1 ? LF + 1 : input_length, tn.range.end = document.positionAt(parser_pos - 2), result.push(tn);
						break;
					case 'TK_START_BLOCK': blocks++, blockpos.push(parser_pos - 1); break;
					case 'TK_END_BLOCK':
						if (inswitch === blocks - 1) inswitch = -1;
						if ((--blocks) < 0) {
							if (mode === 0) _this.addDiagnostic(diagnostic.unexpected('}'), tk.offset, 1), blocks = 0, blockpos.length = 0;
							else return result;
						} else if (blockpos.length)
							_this.addFoldingRange(blockpos.pop() || 0, parser_pos - 1);
						// if (mode === 0) _this.addFoldingRange(blockpos[blocks], parser_pos - 1);
						// else _this.addFoldingRange(blockpos[blocks + 1], parser_pos - 1);
						break;
					case 'TK_END_EXPR': _this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, 1); break;
					case 'TK_START_EXPR':
						if (tk.content === '[') parsepair('[', ']');
						else parsepair('(', ')');
						break;
					case 'TK_UNKNOWN':
						_this.addDiagnostic(diagnostic.unknowntoken(tk.content), tk.offset, tk.length);
						break;
					case 'TK_EQUALS':
						result.push(...parseexp());
						break;
					case 'TK_DOT':
						if (topcontinue && lk.type !== 'TK_WORD')
							topcontinue = false;
						break;
					default: break;
					case 'TK_OPERATOR':
						if (tk.content === '%')
							parsepair('%', '%');
						else if (mode === 2 && tk.content.match(/^\w+$/))
							tk.type = 'TK_WORD', next = false, tk.semantic = { type: SemanticTokenTypes.variable };
						break;
					case 'TK_NUMBER':
						if (input.charAt(parser_pos).match(/\(|\[/))
							tk.type = 'TK_WORD';
						else break;
					case 'TK_WORD':
						if (input.charAt(parser_pos) === '%')
							break;
						let comm = '', pr: Variable | undefined, vr: Variable | undefined, predot = (input.charAt(tk.offset - 1) === '.'), isstatic = (tk.topofline && lk.content.toLowerCase() === 'static');
						if (tk.topofline) {
							if (inswitch > -1 && input.charAt(parser_pos) === ':' && tk.content.toLowerCase() === 'default') {
								tk.content += ':', tk.length++, tk.type = 'TK_LABEL', parser_pos++;
								break;
							}
							if (h && tk.content.toLowerCase() === 'macro') {
								let t = input.indexOf('\n', parser_pos);
								t = t === -1 ? input_length : t;
								if (input.substring(parser_pos, t).match(/^\s*(\w|[^\x00-\x7f])+\(/))
									t = n_newlines, tk.semantic = { type: SemanticTokenTypes.keyword, modifier: 1 << SemanticTokenModifiers.static }, tk = get_next_token(), n_newlines = t, tk.topofline = true;
							}
						}
						topcontinue = predot ? topcontinue : tk.topofline || false;
						if (!predot && input.charAt(parser_pos) === '(') {
							let se: SemanticToken = tk.semantic = { type: SemanticTokenTypes.function };
							if (isstatic) { if (cmm.type !== '') comm = trimcomment(cmm.content); }
							else if (n_newlines === 1) {
								if (cmm.type)
									comm = trimcomment(cmm.content);
								else {
									if (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')
										comm = trimcomment(lk.content);
								}
							}
							o = {}, lk = tk, tk = get_next_token();
							let fc = lk, rof = result.length, par = parsequt(o), quoteend = parser_pos, nk = get_token_ingore_comment(cmm), tn: FuncNode | undefined;
							if (nk.content === '=>') {
								if (!par) { par = [], result.splice(rof), _this.addDiagnostic(diagnostic.invalidparam(), fc.offset, tk.offset - fc.offset + 1); }
								_this.diagnostics.push(...tds);
								let storemode = mode, fcs = _parent.funccall?.length;
								mode |= 1;
								tn = FuncNode.create(fc.content, storemode === 2 ? (se.type = SemanticTokenTypes.method, SymbolKind.Method) : SymbolKind.Function, Range.create(fc.pos = document.positionAt(fc.offset), { line: 0, character: 0 }), makerange(fc.offset, fc.length), <Variable[]>par, undefined, isstatic);
								tn.detail = comm || tn.detail, lk = tk, tk = nk;
								let o: any = {}, sub = parseline(o), pars: { [key: string]: any } = {}, _low = fc.content.toLowerCase();
								result.push(tn), mode = storemode, se.modifier = 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly | (isstatic ? 1 << SemanticTokenModifiers.static : 0);
								if (mode !== 0)
									tn.parent = _parent;
								if (fc.content.charAt(0).match(/[\d$]/))
									_this.addDiagnostic(diagnostic.invalidsymbolname(fc.content), fc.offset, fc.length);
								if (lk.content === '=>')
									_this.addDiagnostic(diagnostic.invaliddefinition('function'), fc.offset, fc.length);
								tn.range.end = document.positionAt(lk.offset + lk.length), tn.closure = !!(mode & 1), _this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
								tn.funccall?.push(..._parent.funccall.splice(fcs));
								tn.returntypes = o, tn.static = isstatic, tn.children = [...sub], adddeclaration(tn);
								for (const t in o)
									o[t] = tn.range.end;
								if (mode === 2) {
									tn.full = `(${classfullname.slice(0, -1)}) ` + tn.full;
									if (!isstatic && tn.name.toLowerCase() === '__new')
										tn.returntypes = { [classfullname.replace(/([^.]+)\.?$/, '@$1')]: tn.range.end };
									if (!_this.object.method[_low])
										_this.object.method[_low] = [];
									_this.object.method[_low].push(tn);
								}
							} else if (nk.content === '{' && fc.topofline) {
								if (!par) { par = [], result.splice(rof), _this.addDiagnostic(diagnostic.invalidparam(), fc.offset, tk.offset - fc.offset + 1); }
								_this.diagnostics.push(...tds);
								let vars = new Map<string, any>(), _low = fc.content.toLowerCase();
								tn = FuncNode.create(fc.content, mode === 2 ? (se.type = SemanticTokenTypes.method, SymbolKind.Method) : SymbolKind.Function, Range.create(fc.pos = document.positionAt(fc.offset), { line: 0, character: 0 }), makerange(fc.offset, fc.length), par, undefined, isstatic);
								if (mode !== 0)
									tn.parent = _parent;
								vars.set('#parent', tn), tn.funccall = [], tn.detail = comm || tn.detail, result.push(tn), tn.children = [], tn.children.push(...parseblock(mode | 1, vars, classfullname));
								tn.closure = !!(mode & 1), adddeclaration(tn), se.modifier = 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly | (isstatic ? 1 << SemanticTokenModifiers.static : 0);
								if (fc.content.charAt(0).match(/[\d$]/))
									_this.addDiagnostic(diagnostic.invalidsymbolname(fc.content), fc.offset, fc.length);
								tn.range.end = document.positionAt(parser_pos), tn.static = isstatic, _this.addFoldingRangePos(tn.range.start, tn.range.end);
								if (mode !== 0) {
									if (mode === 2) {
										tn.full = `(${classfullname.slice(0, -1)}) ` + tn.full;
										if (!isstatic && tn.name.toLowerCase() === '__new')
											tn.returntypes = { [classfullname.replace(/([^.]+)\.?$/, '@$1')]: tn.range.end };
										if (!_this.object.method[_low])
											_this.object.method[_low] = [];
										_this.object.method[_low].push(tn);
									}
								}
							} else {
								next = false, lk = tk, tk = nk;
								if (par) for (const it of par) if (!is_builtinvar(it.name.toLowerCase())) {
									result.push(it);
									if ((<Variable>it).ref || (<Variable>it).returntypes)
										(<Variable>it).def = true;
								}
							}
							if (!tn && input.charAt(fc.offset - 1) !== '%')
								addvariable(fc), _parent.funccall.push(DocumentSymbol.create(fc.content, undefined, SymbolKind.Function, makerange(fc.offset, quoteend - fc.offset), makerange(fc.offset, fc.length)));
						} else {
							if (isstatic) { if (cmm.type !== '') comm = trimcomment(cmm.content); }
							else if (n_newlines === 1) {
								if (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT') comm = trimcomment(lk.content);
								else if (cmm.type !== '') comm = trimcomment(cmm.content);
							}
							let bak = lk, restore = false, nn = 0, byref = false, rg: Range, par: DocumentSymbol[] = [];
							lk = tk, tk = get_token_ingore_comment(cmm), next = false;
							if (mode === 2 && lk.topofline && tk.content.match(/^(\[|=>|\{)$/)) {
								let fc = lk;
								next = true, lk.semantic = { type: SemanticTokenTypes.property, modifier: 1 << SemanticTokenModifiers.definition | (isstatic ? 1 << SemanticTokenModifiers.static : 0) };
								if (tk.content === '[') {
									if (tk.topofline)
										_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset);
									let err = false, lasthasval = false, b: number;
									loop:
									while (nexttoken()) {
										switch (tk.type) {
											case 'TK_WORD':
												let nk = get_next_token();
												if (nk.type === 'TK_WORD' && tk.content.toLowerCase() === 'byref') {
													_this.addDiagnostic(diagnostic.deprecated('&', 'ByRef'), tk.offset, 5, DiagnosticSeverity.Warning);
													byref = true, tk = nk, next = false;
													continue loop;
												} else if ((lk.content === ',' || lk.content === '[') && (nk.content.match(/^(:=|,|\]|\*)$/))) {
													if (tk.content.charAt(0).match(/[\d$]/)) _this.addDiagnostic(diagnostic.invalidsymbolname(tk.content), tk.offset, tk.length);
													tn = Variable.create(tk.content, SymbolKind.Variable, rg = makerange(b = tk.offset, tk.length), rg);
													tk.semantic = { type: SemanticTokenTypes.parameter, modifier: 1 << SemanticTokenModifiers.definition };
													if (byref) (<Variable>tn).ref = true, (<Variable>tn).def = true, byref = false;
													par.push(tn);
													if (nk.content === ':=') {
														tk = get_token_ingore_comment();
														if (tk.content === '-' || tk.content === '+') {
															nk = get_next_token();
															if (nk.type === 'TK_NUMBER')
																tk.content = tk.content + nk.content, tk.length = tk.content.length, tk.type = 'TK_NUMBER';
															else tk.type = 'TK_UNKNOWN';
														}
														if (tk.type === 'TK_STRING' || tk.type === 'TK_NUMBER' || ['unset', 'true', 'false'].includes(tk.content.toLowerCase())) {
															(<Variable>tn).defaultVal = tk.content;
															if (tk.content.toLowerCase() === 'unset')
																tk.semantic = { type: SemanticTokenTypes.variable, modifier: 1 << SemanticTokenModifiers.readonly };
															lasthasval = true, tk = nk, nk = get_token_ingore_comment();
															if (nk.content === ']')
																next = false;
															else if (nk.type !== 'TK_COMMA')
																err = true;
														} else if (tk.content === ']') {
															if (!(<Variable>tn).arr)
																_this.addDiagnostic(diagnostic.defaultvalmissing(tn.name), b, tn.name.length);
															next = byref = false;
															continue;
														} else err = true;
													} else {
														if (nk.content === '*') {
															if (is_next(']'))
																(<Variable>tn).arr = true;
															else _this.addDiagnostic(diagnostic.unexpected('*'), nk.offset);
														}
														if (lasthasval && !(<Variable>tn).arr)
															_this.addDiagnostic(diagnostic.defaultvalmissing(tn.name), b, tn.name.length);
														next = nk.content !== ']';
													}
												} else
													err = true;
												lk = tk, tk = nk, byref = false;
												break;
											case 'TK_END_EXPR':
												if (tk.content === ']' && (--nn) < 0) { nexttoken(); break loop; }
												break;
											case 'TK_START_EXPR':
												if (tk.content === '[') nn++;
											default:
												if (tk.content === '*' && (lk.content === ',' || lk.content === '[') && is_next(']')) {
													tk.type = 'TK_WORD', next = false;
													break;
												}
												if (tk.content === '&' && (lk.content === ',' || lk.content === '[')) {
													nk = get_next_token(), next = false;
													if (nk.type === 'TK_WORD') {
														byref = true, tk = nk;
														break;
													} else
														lk = tk, tk = nk;
												}
												err = true;
												break;
										}
									}
									if (err)
										_this.addDiagnostic(diagnostic.invalidparam(), fc.offset, lk.offset - fc.offset + 1);
									if (par.length === 0)
										_this.addDiagnostic(diagnostic.propemptyparams(), fc.offset, lk.offset - fc.offset + 1);
								}
								let prop = DocumentSymbol.create(fc.content, comm, SymbolKind.Property, rg = makerange(fc.offset, fc.length), Object.assign({}, rg));
								(<FuncNode>prop).parent = _parent, (<FuncNode>prop).params = par;
								(<Variable>prop).full = `(${classfullname.slice(0, -1)}) ${isstatic ? 'static ' : ''}${fc.content}` + (par.length ? `[${par.map((it: Variable) => {
									return (it.ref ? '&' : '') + it.name + (it.defaultVal ? ' := ' + it.defaultVal : '');
								}).join(', ')}]` : '');
								(<Variable>prop).static = isstatic, result.push(prop), prop.children = [], addprop(fc);
								(<FuncNode>prop).funccall = [];
								if (tk.content === '{') {
									let nk: Token, sk: Token, tn: FuncNode | undefined, mmm = mode;
									tk = get_token_ingore_comment(), next = false, mode = 1;
									while (nexttoken() && tk.type !== 'TK_END_BLOCK') {
										if (tk.topofline && (tk.content = tk.content.toLowerCase()).match(/^[gs]et$/)) {
											let v: Variable;
											tk.semantic = { type: SemanticTokenTypes.function, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly };
											nk = tk, sk = get_token_ingore_comment();
											if (sk.content === '=>') {
												tk = sk, mode = 3;
												let off = parser_pos, o: any = {}, sub: DocumentSymbol[], pars: { [key: string]: any } = {}, fcs = _parent.funccall.length;
												tn = FuncNode.create(nk.content.toLowerCase(), SymbolKind.Function, makerange(nk.offset, parser_pos - nk.offset), makerange(nk.offset, nk.length), [...par]);
												if (nk.content.charAt(0).match(/[\d$]/)) _this.addDiagnostic(diagnostic.invalidsymbolname(nk.content), nk.offset, nk.length);
												lk = tk, tk = sk;
												(<FuncNode>tn).parent = prop, sub = parseline(o), mode = 2, tn.funccall?.push(..._parent.funccall.splice(fcs));
												tn.range.end = document.positionAt(lk.offset + lk.length), prop.range.end = tn.range.end, _this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
												(<FuncNode>tn).returntypes = o, tn.children = [];
												if (lk.content === '=>')
													_this.addDiagnostic(diagnostic.invaliddefinition('function'), nk.offset, nk.length);
												for (const t in o)
													o[t] = tn.range.end;
												if (nk.content.toLowerCase() === 'set') (<FuncNode>tn).params.unshift(v = Variable.create('Value', SymbolKind.Variable, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0))), v.detail = completionitem.value();
												tn.children.push(...sub), adddeclaration(tn as FuncNode);
											} else if (sk.content === '{') {
												tn = FuncNode.create(nk.content, SymbolKind.Function, makerange(nk.offset, parser_pos - nk.offset), makerange(nk.offset, 3), [...par]), _this.addFoldingRangePos(tn.range.start, tn.range.end);
												let vars = new Map<string, any>([['#parent', tn]]);
												(<FuncNode>tn).parent = prop, tn.children = parseblock(3, vars, classfullname), tn.range.end = document.positionAt(parser_pos);
												if (nk.content.toLowerCase() === 'set') (<FuncNode>tn).params.unshift(v = Variable.create('Value', SymbolKind.Variable, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0))), v.detail = completionitem.value();
												adddeclaration(tn as FuncNode);
												_this.addFoldingRangePos(tn.range.start, tn.range.end);
												if (nk.content.charAt(0).match(/[\d$]/)) _this.addDiagnostic(diagnostic.invalidsymbolname(nk.content), nk.offset, nk.length);
											} else {
												_this.addDiagnostic(diagnostic.invalidprop(), sk.offset);
												if (sk.content === '}') { next = false; break; } else {
													tn = undefined;
													let b = 0;
													while (tk.type !== 'TK_EOF') {
														if (tk.content === '{')
															b++;
														else if (tk.content === '}')
															if ((--b) < 0)
																break;
														nexttoken();
													}
													next = false;
												}
											}
											if (tn)
												prop.children.push(tn);
										} else {
											_this.addDiagnostic(diagnostic.invalidprop(), tk.offset);
											let b = 0;
											while (tk.type !== 'TK_EOF') {
												if (tk.content === '{')
													b++;
												else if (tk.content === '}')
													if ((--b) < 0)
														break;
												nexttoken();
											}
											next = false;
										}
									}
									prop.range.end = document.positionAt(parser_pos - 1), mode = mmm;
									_this.addFoldingRangePos(prop.range.start, prop.range.end, 'block');
								} else if (tk.content === '=>') {
									let off = parser_pos, o: any = {}, tn: FuncNode, sub: DocumentSymbol[], pars: { [key: string]: any } = {}, fcs = _parent.funccall.length;
									mode = 3, tn = FuncNode.create('get', SymbolKind.Function, makerange(off, parser_pos - off), Object.assign({}, rg), <Variable[]>par), (<FuncNode>tn).returntypes = o;
									(<FuncNode>tn).parent = prop, tn.children = parseline(o), (<FuncNode>tn).funccall?.push(..._parent.funccall.splice(fcs)), mode = 2;
									if (lk.content === '=>')
										_this.diagnostics.push({ message: diagnostic.invaliddefinition('function'), range: tn.selectionRange, severity: DiagnosticSeverity.Error });
									for (const t in o)
										o[t] = tn.range.end;
									tn.range.end = document.positionAt(lk.offset + lk.length), prop.range.end = tn.range.end, _this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
									adddeclaration(tn as FuncNode), prop.children.push(tn);
								}
								if (prop.children.length === 1 && prop.children[0].name === 'get')
									(fc.semantic as SemanticToken).modifier = ((fc.semantic as SemanticToken).modifier || 0) | 1 << SemanticTokenModifiers.readonly;
							} else {
								if (!lk.topofline && (bak.type === 'TK_HOT' || (bak.topofline && bak.content === '{') || (bak.type === 'TK_RESERVED' && bak.content.match(/^(try|else|finally)$/i))))
									lk.topofline = restore = topcontinue = true;
								if (!predot && (!lk.topofline || tk.type === 'TK_EQUALS' || ['=', '?'].includes(tk.content) || input.charAt(lk.offset + lk.length).match(/[^\s,]/))) {
									if (addvariable(lk, mode)) {
										vr = result[result.length - 1];
										if (comm) vr.detail = last_comm = comm;
										else if (last_comm && bak.content === ',' && !cmm.type)
											vr.detail = last_comm;
										else last_comm = '';
										if (bak.content === '&') {
											if (input.substring(last_LF + 1, bak.offset - 1).trim().match(/(:=|,|\()$/))
												vr.def = true;
										}
									}
									if (mode === 2 && tk.type !== 'TK_EQUALS' && input.charAt(lk.offset + lk.length) !== '.')
										_this.addDiagnostic(diagnostic.propnotinit(), lk.offset);
								} else if (mode === 2) {
									if (input.charAt(lk.offset + lk.length) !== '.')
										_this.addDiagnostic(diagnostic.propnotinit(), lk.offset);
								} else if ((m = input.charAt(lk.offset + lk.length)).match(/^(\(|\s|,|)$/)) {
									if (lk.topofline) {
										if (m === ',') _this.addDiagnostic(diagnostic.funccallerr(), tk.offset, 1);
										let fc = lk, sub = parseline();
										if (restore) lk.topofline = false;
										result.push(...sub);
										if (input.charAt(fc.offset - 1) !== '%') {
											fc.semantic = { type: SemanticTokenTypes.function };
											if (addvariable(fc)) {
												_parent.funccall.push(tn = DocumentSymbol.create(fc.content, undefined, SymbolKind.Function, makerange(fc.offset, lk.offset + lk.length - fc.offset), makerange(fc.offset, fc.length)));
												if (tk.content === ')')
													tn.range.end = document.positionAt(tk.offset + tk.length);
											}
										}
										break;
									} else if (predot && !(tk.type === 'TK_EQUALS' || tk.content === '=')) {
										if (tk.content === '(' || topcontinue) {
											if (m === ',') _this.addDiagnostic(diagnostic.funccallerr(), tk.offset, 1);
											let sub: DocumentSymbol[], fc = lk;
											if (tk.content === '(') {
												next = true, parsepair('(', ')');
											} else sub = parseline(), result.push(...sub);
											if (input.charAt(fc.offset - 1) !== '%') {
												fc.semantic = { type: SemanticTokenTypes.method };
												_parent.funccall.push(tn = DocumentSymbol.create(fc.content, undefined, SymbolKind.Method, makerange(fc.offset, lk.offset + lk.length - fc.offset), makerange(fc.offset, fc.length)));
												if (tk.content === ')')
													tn.range.end = document.positionAt(tk.offset + tk.length);
											}
											break;
										}
									} else if (predot)
										addprop(lk), pr = vr = maybeclassprop(lk);
								} else if (predot)
									addprop(lk), pr = vr = maybeclassprop(lk);
								if (tk.type === 'TK_EQUALS') {
									next = true;
									let o: any = {}, equ = tk.content, ep = parseexp(undefined, o);
									result.push(...ep);
									if (vr) {
										vr.returntypes = { [equ === ':=' ? Object.keys(o).pop()?.toLowerCase() || '#any' : equ === '.=' ? '#string' : '#number']: true };
										vr.range = { start: vr.range.start, end: document.positionAt(lk.offset + lk.length) };
										if (equ === ':=' && typeof o[' #object'] === 'object')
											(<any>vr).property = Object.values(o[' #object']);
										if (!pr)
											vr.def = true;
										let tt = vr.returntypes;
										for (const t in tt)
											tt[t] = vr.range.end;
									}
								} else if (tk.type === 'TK_OPERATOR') {
									if (vr && !(tk.topofline && ['!', '~', 'not'].includes(tk.content.toLowerCase()))) {
										vr.returntypes = { [tk.content === '.' ? '#string' : tk.content.match(/^[a-zA-Z]+$/) ? '#any' : '#number']: true };
										vr.range = { start: vr.range.start, end: document.positionAt(lk.offset + lk.length) };
										let tt = vr.returntypes;
										for (const t in tt)
											tt[t] = vr.range.end;
										if (tk.content.match(/^(\+\+|--)$/))
											vr.def = true, tk.content = '';
									}
								} else {
									if (tk.type === 'TK_UNKNOWN')
										_this.addDiagnostic(diagnostic.unknowntoken(tk.content), tk.offset, tk.length);
								}
							}
							break;
						}
						break;
					case 'TK_RESERVED':
						parse_reserved(); break;
				}
			}
			if (tk.type === 'TK_EOF' && blocks > (mode === 0 ? 0 : -1)) _this.addDiagnostic(diagnostic.missing('}'), blockpos[blocks - (mode === 0 ? 1 : 0)], 1);
			return result;

			function parse_reserved() {
				let _low = tk.content.toLowerCase(), bak = lk, t = parser_pos, newlines = n_newlines, p: Token | undefined, nk: Token | undefined;
				if (mode === 2) {
					nk = get_next_token();
					next = false, parser_pos = tk.offset + tk.length, tk.type = 'TK_WORD';
					if (nk.content.match(/^(:=|=>|\{)$/) || input.charAt(tk.offset + tk.length).match(/(\[|\()/)) {
						return;
					} else if (nk.content !== ':=' && (_low === 'class' || _low === 'static')) {
						nk = undefined, next = true, tk.type = 'TK_RESERVED';
					} else {
						_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset);
						return;
					}
				}
				switch (_low) {
					case 'class':
						if (!tk.topofline || (mode & 1)) {
							next = false, tk.type = 'TK_WORD'; break;
						}
						let cl: Token, ex: string = '', sv = new Map(), rg: Range, beginpos = tk.offset, comm = '';
						if (newlines === 1 && (cmm.type === 'TK_COMMENT' || cmm.type === 'TK_BLOCK_COMMENT'))
							comm = trimcomment(cmm.content), beginpos = cmm.offset;
						else cmm.type = '';
						nexttoken();
						if (tk.type === 'TK_WORD') {
							if (mode & 1) _this.addDiagnostic(diagnostic.classinfuncerr(), tk.offset);
							cl = tk, lk = tk, tk = get_token_ingore_comment();
							if (tk.content.toLowerCase() === 'extends') {
								tk = get_next_token();
								if (tk.type === 'TK_WORD') {
									ex = tk.content;
									result.push(Variable.create(tk.content, SymbolKind.Variable, rg = makerange(tk.offset, tk.length), rg));
									while (parser_pos < input_length && input.charAt(parser_pos) === '.') {
										parser_pos++;
										tk = get_next_token();
										if (tk.type === 'TK_WORD')
											ex += '.' + tk.content;
										else
											break;
									}
									if (tk.type === 'TK_WORD')
										tk = get_token_ingore_comment();
								} else
									_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
							} else if (is_next('{')) {
								_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
								lk = tk, tk = get_next_token();
							}
							if (tk.type !== 'TK_START_BLOCK') { next = false; break; }
							if (cl.content.charAt(0).match(/[\d$]/)) _this.addDiagnostic(diagnostic.invalidsymbolname(cl.content), cl.offset, cl.length);
							tn = DocumentSymbol.create(cl.content, undefined, SymbolKind.Class, makerange(0, 0), makerange(cl.offset, cl.length));
							sv.set('#parent', tn), (<ClassNode>tn).funccall = [], (<ClassNode>tn).full = classfullname + cl.content, tn.children = [];
							(<ClassNode>tn).staticdeclaration = {}, (<ClassNode>tn).declaration = {}, (<ClassNode>tn).cache = [];
							(<ClassNode>tn).returntypes = { [(classfullname + '@' + cl.content).toLowerCase()]: true };
							if (comm) tn.detail = comm; if (ex) (<ClassNode>tn).extends = ex;
							tn.children.push(...parseblock(2, sv, classfullname + cl.content + '.')), tn.range = makerange(beginpos, parser_pos - beginpos);
							adddeclaration(tn as ClassNode), cl.semantic = { type: SemanticTokenTypes.class, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly };
							_this.addFoldingRangePos(tn.selectionRange.start, tn.range.end, 'block');
							for (const item of tn.children) if (item.children && item.kind != SymbolKind.Property) (<FuncNode>item).parent = tn;
							result.push(tn);
						} else {
							next = false, lk.type = 'TK_WORD', parser_pos = lk.offset + lk.length, tk = lk, lk = bak;
						}
						break;
					case 'global':
					case 'static':
					case 'local':
						if (n_newlines === 1 && cmm.type) nk = cmm;
						lk = tk, tk = get_token_ingore_comment();
						if (mode === 2 && tk.type === 'TK_OPERATOR' && tk.content.match(/^\w+$/))
							tk.type = 'TK_WORD';
						if (tk.topofline) {
							if (mode === 2 && _low !== 'static')
								_this.addDiagnostic(diagnostic.propdeclaraerr(), lk.offset);
							else if (_low === 'global' && _parent.assume !== undefined)
								_parent.assume = FuncScope.GLOBAL;
							else if (_low === 'local')
								_this.addDiagnostic(diagnostic.declarationerr(), lk.offset, lk.length);
						} else if (tk.type === 'TK_WORD' || tk.type === 'TK_RESERVED') {
							if (mode === 0) {
								next = false;
								if (_low !== 'global')
									_this.addDiagnostic(diagnostic.declarationerr(), lk.offset);
								break;
							} else if (mode === 2 && _low !== 'static') {
								_this.addDiagnostic(diagnostic.propdeclaraerr(), lk.offset);
								next = false;
								break;
							}
							// while (parser_pos < input_length && input.charAt(parser_pos).match(/( |\t)/)) parser_pos++;
							if (nk) cmm = nk;
							nk = get_token_ingore_comment(), parser_pos = tk.offset + tk.length;
							if (nk.content.match(/^(\(|\[|\{|=>)/)) {
								tk.topofline = true;
							} else {
								let sta: any[];
								next = false;
								sta = parsestatement(_low === 'global' ? '' : _low);
								if (_low === 'global') {
									sta.map(it => {
										_parent.global[it.name.toLowerCase()] = it;
									});
								} else {
									if (mode === 2) {
										for (const it of sta)
											if (it.kind === SymbolKind.Property)
												it.static = true;
									} else {
										sta.map(it => {
											_parent.local[it.name.toLowerCase()] = it;
										});
									}
								}
								result.push(...sta);
							}
						} else if (tk.type === 'TK_EQUALS') {
							parser_pos = lk.offset + lk.length, lk.type = 'TK_WORD', tk = lk, lk = bak;
							if (mode !== 2) _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
						}
						next = false;
						break;
					case 'loop':
						if (mode === 2) {
							nk = get_token_ingore_comment();
							next = false, parser_pos = tk.offset + tk.length, tk.type = 'TK_WORD';
							if (nk.content !== ':=')
								_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset);
							break;
						}
						lk = tk, tk = get_next_token();
						if (tk.type === 'TK_EQUALS') {
							parser_pos = lk.offset + lk.length, lk.type = 'TK_WORD', tk = lk, lk = bak, next = false;
							if (mode !== 2) _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
						} else if (mode === 2)
							_this.addDiagnostic(diagnostic.propdeclaraerr(), lk.offset);
						else if (next = (tk.type === 'TK_WORD' && ['parse', 'files', 'read', 'reg'].includes(tk.content.toLowerCase())))
							tk.type = 'TK_RESERVED';
						break;
					case 'for':
						let nq = is_next('(');
						if (nq) nk = get_next_token();
						while (nexttoken()) {
							switch (tk.type) {
								case 'TK_COMMA':
									break;
								case 'TK_RESERVED':
									if (tk.content.toLowerCase() !== 'class' || !(mode & 1)) {
										_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
										break;
									} else
										tk.type = 'TK_WORD';
								case 'TK_WORD':
									if (addvariable(tk, 0))
										(<Variable>result[result.length - 1]).def = true;
									break;
								case 'TK_OPERATOR':
									if (tk.content.toLowerCase() === 'in') {
										result.push(...parseexp(undefined, undefined));
										if (nk) {
											if (tk.content !== ')') {
												_this.addDiagnostic(diagnostic.missing(')'), nk.offset, nk.length);
											} else nexttoken();
										}
										return;
									}
									_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, tk.length);
									next = false;
									return;
								default:
									next = false;
								case 'TK_END_EXPR':
									_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
									return;
								case 'TK_EQUALS':
									_this.addDiagnostic(diagnostic.reservedworderr(lk.content), lk.offset, lk.length);
									return;
							}
						}
						break;
					case 'continue':
					case 'break':
					case 'goto':
						if (mode === 2) {
							nk = get_token_ingore_comment();
							next = false, parser_pos = tk.offset + tk.length, tk.type = 'TK_WORD';
							if (nk.content !== ':=')
								_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset);
							break;
						}
						lk = tk, tk = get_next_token(), next = false;
						if (!tk.topofline) {
							if (tk.type === 'TK_WORD' || tk.type === 'TK_RESERVED' || tk.type === 'TK_NUMBER') {
								tk.ignore = true, addlabel(tk);
							} else if (tk.type.endsWith('COMMENT')) {
							} else if (tk.content !== '(' || input.charAt(lk.offset + lk.length) !== '(') {
								parser_pos = lk.offset + lk.length, lk.type = 'TK_WORD', tk = lk, lk = bak, next = false;
								_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
							} else {
								let s: Token[] = [];
								next = true, parsepair('(', ')', undefined, {}, s);
								s.map(i => {
									if (i.content.indexOf('\n') === -1)
										addlabel({ content: i.content.slice(1, -1), offset: i.offset + 1, length: i.length - 2, type: '' });
								});
							}
						}
						break;
					case 'as':
						_this.addDiagnostic(diagnostic.unexpected('as'), tk.offset, tk.length);
						break;
					case 'catch':
						if (is_next('('))
							p = get_token_ingore_comment();
						lk = nk = tk, tk = get_token_ingore_comment();
						if (tk.topofline || (tk.type !== 'TK_WORD' && !allIdentifierChar.test(tk.content))) {
							if (p) {
								parser_pos = p.offset - 1;
								_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
							} else
								next = false;
						} else {
							next = true;
							if (tk.content.toLowerCase() !== 'as') {
								while (true) {
									if (tk.type !== 'TK_WORD')
										_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
									else addvariable(tk);
									lk = tk, tk = get_token_ingore_comment();
									if (tk.content === ',') {
										lk = tk, tk = get_token_ingore_comment();
										if (!allIdentifierChar.test(tk.content))
											break;
									} else
										break;
								}
								if (p) {
									if (tk.content === '{') {
										_this.addDiagnostic(diagnostic.missing('('), p.offset, 1), next = false;
										break;
									} else if (tk.content === ')')
										break;
								} else if (tk.content === '{' || tk.topofline) {
									next = false;
									break;
								}
							}
							if (tk.content.toLowerCase() === 'as') {
								lk = tk, tk = get_token_ingore_comment();
								next = false;
								if (tk.type !== 'TK_WORD' && !allIdentifierChar.test(tk.content)) {
									_this.addDiagnostic(diagnostic.unexpected(nk.content), nk.offset, nk.length);
								} else if (tk.type !== 'TK_WORD')
									_this.addDiagnostic(diagnostic.reservedworderr(nk.content), nk.offset), tk.type = 'TK_WORD';
								else {
									let t = get_token_ingore_comment();
									parser_pos = tk.offset + tk.length;
									if (!t.topofline && t.content !== '{' && !(p && t.content === ')'))
										_this.addDiagnostic(diagnostic.unexpected(nk.content), nk.offset, nk.length), next = false;
									else {
										if (p) {
											if (t.content === ')')
												parser_pos = t.offset + 1, next = true;
											else
												_this.addDiagnostic(diagnostic.missing('('), p.offset, 1);
										}
										if (addvariable(tk))
											next = true, (<Variable>result[result.length - 1]).def = true;
									}
								}
							} else {
								if (p && tk.content === ')')
									lk = tk, tk = get_token_ingore_comment();
								if (!tk.topofline)
									_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset);
							}
						}
						break;
					case 'super':
						if (!(mode & 3))
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
						else tk.ignore = true;
						tk.type = 'TK_WORD', next = false
						break;
					default:
						nk = get_token_ingore_comment();
						if (nk.type === 'TK_EQUALS' || nk.content.match(/^([<>]=?|~=|&&|\|\||[.&|?:^]|\*\*?|\/\/?|<<|>>|!?==?)$/))
							tk.type = 'TK_WORD', parser_pos = t, _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
						else {
							lk = tk, tk = nk, next = false;
							if (_low === 'switch') inswitch = blocks;
							else if (_low === 'return') {
								let tps: any = {};
								result.push(...parseline(tps));
								if (mode & 1) {
									let rg = document.positionAt(lk.offset + lk.length);
									if (!_parent.returntypes)
										_parent.returntypes = {};
									for (const tp in tps)
										_parent.returntypes[tp] = rg;
								}
							}
						}
						break;
				}

				function addlabel(tk: Token) {
					if (_parent.labels) {
						_low = tk.content.toLowerCase();
						if (!_parent.labels[_low])
							_parent.labels[_low] = [];
						let rg = makerange(tk.offset, tk.length);
						_parent.labels[_low].push(DocumentSymbol.create(tk.content, undefined, SymbolKind.Field, rg, rg));
					}
				}
			}

			function parseline(types?: any): DocumentSymbol[] {
				let res: DocumentSymbol[] = [], hascomma = false, b = next ? parser_pos : tk.offset;
				while (true) {
					let o: any = {};
					res.push(...parseexp(undefined, o));
					if (tk.type === 'TK_COMMA')
						hascomma = next = true;
					else {
						next = false;
						if (types) {
							if (o = Object.keys(o).pop()?.toLowerCase())
								types[o] = true;
							if (hascomma)
								_this.addDiagnostic(diagnostic.returnmultival(), b, lk.offset > 0 ? lk.offset + lk.length - b : 0);
						}
						break;
					}
				}
				return res;
			}

			function parsestatement(local: string) {
				let sta: DocumentSymbol[] | Variable[] = [], bak: Token, last_comm = '', trg: Range;
				loop:
				while (nexttoken()) {
					if (tk.topofline && !linecontinue(lk, tk)) { next = false; break; }
					switch (tk.type) {
						case 'TK_WORD':
							bak = lk, lk = tk, tk = get_token_ingore_comment();
							if (tk.type === 'TK_EQUALS') {
								let vr: Variable | undefined, o: any = {}, equ = tk.content;
								if (bak.type === 'TK_DOT') {
									addprop(lk);
								} else if (addvariable(lk, mode, sta)) {
									vr = sta[sta.length - 1];
									if (cmm.type) vr.detail = last_comm = trimcomment(cmm.content), cmm.type = '';
									else if (last_comm && bak.content === ',' && !cmm.type)
										vr.detail = last_comm;
									else last_comm = '';
								} else if (local)
									_this.addDiagnostic(diagnostic.conflictserr(local, 'built-in variable', lk.content), lk.offset, lk.length);
								result.push(...parseexp(undefined, o));
								if (vr) {
									vr.returntypes = { [equ === ':=' ? Object.keys(o).pop()?.toLowerCase() || '#any' : equ === '.=' ? '#string' : '#number']: true };
									vr.range = { start: vr.range.start, end: document.positionAt(lk.offset + lk.length) }, vr.def = true;
									if (equ === ':=' && typeof o[' #object'] === 'object')
										(<any>vr).property = Object.values(o[' #object']);
									let tt = vr.returntypes;
									for (const t in tt)
										tt[t] = vr.range.end;
								}
							} else {
								if (mode === 2 && input.charAt(lk.offset + lk.length) !== '.') {
									if (bak.type === 'TK_COMMA') {
										lk.ignore = true, _this.addDiagnostic(diagnostic.propnotinit(), lk.offset, lk.length, DiagnosticSeverity.Warning);
										if (tk.topofline && !(['TK_COMMA', 'TK_OPERATOR', 'TK_EQUALS'].includes(tk.type) && !tk.content.match(/^(!|~|not)$/i)))
											break loop;
										continue;
									} else _this.addDiagnostic(diagnostic.propnotinit(), lk.offset, lk.length);
								}
								if (tk.type === 'TK_COMMA' || (tk.topofline && !(['TK_COMMA', 'TK_OPERATOR', 'TK_EQUALS'].includes(tk.type) && !tk.content.match(/^(!|~|not)$/i)))) {
									if (addvariable(lk, mode, sta)) {
										let vr = sta[sta.length - 1];
										if (cmm.type) vr.detail = last_comm = trimcomment(cmm.content), cmm.type = '';
										else if (last_comm && bak.content === ',' && !cmm.type)
											vr.detail = last_comm;
										else last_comm = '';
									} else if (local)
										_this.addDiagnostic(diagnostic.conflictserr(local, 'built-in variable', lk.content), lk.offset, lk.length);
									if (tk.type !== 'TK_COMMA')
										break loop;
								}
							}
							break;
						case 'TK_COMMENT':
						case 'TK_BLOCK_COMMENT':
						case 'TK_INLINE_COMMENT':
						case 'TK_COMMA':
							continue;
						case 'TK_UNKNOWN': _this.addDiagnostic(diagnostic.unknowntoken(tk.content), tk.offset, tk.length); break;
						case 'TK_RESERVED':
							if (mode !== 2) {
								if (tk.content.match(/\b(and|or|not)\b/i)) {
									let t = parser_pos, nk = get_token_ingore_comment();
									if (nk.type !== 'TK_EQUALS' && !nk.content.match(/^([<>]=?|~=|&&|\|\||[,.&|?:^]|\*\*?|\/\/?|<<|>>|!?==?)$/)) { lk = tk, tk = nk, next = false; break; }
									parser_pos = t;
								}
								_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
							}
							next = false, tk.type = 'TK_WORD'; break;
						case 'TK_END_BLOCK':
						case 'TK_END_EXPR': _this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, 1); break;
						default: break loop;
					}
				}
				return sta;
			}

			function parseexp(inpair?: string, types: any = {}, mustexp = false): DocumentSymbol[] {
				let pres = result.length, tpexp = '', byref = false, t: any, objk: any;
				while (nexttoken()) {
					if (tk.topofline && !inpair && !linecontinue(lk, tk)) {
						if (lk.type === 'TK_WORD' && input.charAt(lk.offset - 1) === '.')
							addprop(lk), maybeclassprop(lk);
						next = false; break;
					}
					switch (tk.type) {
						case 'TK_WORD':
							let predot = (input.charAt(tk.offset - 1) === '.');
							if (input.charAt(parser_pos) === '(')
								break;
							lk = tk, tk = get_token_ingore_comment(cmm);
							if (tk.type === 'TK_COMMA') {
								if (predot)
									addprop(lk), maybeclassprop(lk), tpexp += '.' + lk.content;
								else if (input.charAt(lk.offset - 1) !== '%') {
									if (addvariable(lk) && byref) {
										let vr = (<Variable>result[result.length - 1]);
										vr.ref = vr.def = true;
									}
									tpexp += ' ' + lk.content;
								}
								types[tpexp] = true;
								return result.splice(pres);
							} else if (tk.topofline) {
								next = false;
								if (['TK_OPERATOR', 'TK_EQUALS', 'TK_DOT'].includes(tk.type) && !tk.content.match(/^(!|~|not)$/i)) {
									tpexp += ' ' + lk.content;
									continue;
								}
								if (!predot) {
									if (input.charAt(lk.offset - 1) !== '%') {
										if (addvariable(lk) && byref) {
											let vr = (<Variable>result[result.length - 1]);
											vr.ref = vr.def = true;
										}
										tpexp += ' ' + lk.content;
									}
									types[tpexp] = true;
								} else {
									addprop(lk), maybeclassprop(lk);
									types[tpexp + '.' + lk.content] = true;
								}
								return result.splice(pres);
							} else if (tk.type === 'TK_OPERATOR') {
								if (predot) {
									tpexp += '.' + lk.content;
									addprop(lk), maybeclassprop(lk);
								} else if (input.charAt(lk.offset - 1) !== '%' && input.charAt(lk.offset + lk.length) !== '%') {
									if (addvariable(lk))
										(<Variable>result[result.length - 1]).returntypes = { '#number': true };
									tpexp += ' ' + lk.content;
								}
								next = false;
								continue;
							}
							if (!predot) {
								if (input.charAt(lk.offset - 1) !== '%' && addvariable(lk)) {
									let vr = result[result.length - 1] as Variable;
									if (byref)
										vr.ref = vr.def = true, byref = false;
									if (tk.type === 'TK_EQUALS') {
										let o: any = {}, equ = tk.content;
										next = true;
										result.push(...parseexp(inpair, o));
										vr.range = { start: vr.range.start, end: document.positionAt(lk.offset + lk.length) };
										vr.returntypes = { [o = equ === ':=' ? Object.keys(o).pop()?.toLowerCase() || '#any' : equ === '.=' ? '#string' : '#number']: vr.range.end };
										tpexp += o, vr.def = true;
										if (equ === ':=' && typeof o[' #object'] === 'object')
											(<any>vr).property = Object.values(o[' #object']);
									} else
										tpexp += ' ' + lk.content, next = false;
								} else
									tpexp += ' ' + lk.content, next = false;
							} else if (tk.type === 'TK_EQUALS') {
								tpexp = tpexp.replace(/\s*\S+$/, ''), addprop(lk), next = true;
							} else
								tpexp += (predot ? '.' : ' ') + lk.content, addprop(lk), next = false;
							break;
						case 'TK_START_EXPR':
							if (tk.content === '[') {
								let pre = !!input.charAt(tk.offset - 1).match(/^(\w|\)|%|[^\x00-\x7f])$/);
								parsepair('[', ']');
								if (pre) {
									tpexp = tpexp.replace(/\S+$/, '') + '#any';
								} else
									tpexp += ' #array';
							} else {
								let fc: Token | undefined, par: any, nk: Token, quoteend: number, tpe: any = {};
								let nospace = input.charAt(lk.offset + lk.length) === '(';
								if (lk.type === 'TK_WORD' && nospace)
									if (input.charAt(lk.offset - 1) === '.') {
										let ptk = lk;
										parsepair('(', ')');
										if (input.charAt(ptk.offset - 1) !== '%') {
											ptk.semantic = { type: SemanticTokenTypes.method };
											_parent.funccall.push(DocumentSymbol.create(ptk.content, undefined, SymbolKind.Method, makerange(ptk.offset, parser_pos - ptk.offset), makerange(ptk.offset, ptk.length)));
											tpexp += '.' + ptk.content + '()';
										}
										continue;
									} else fc = lk;
								cmm.type = '', par = parsequt(tpe), quoteend = parser_pos;
								if (next)
									nk = get_token_ingore_comment(cmm);
								else nk = tk;
								if (nk.content === '=>' && par) {
									_this.diagnostics.push(...tds);
									let o: any = {}, sub = parseexp(inpair, o), pars: { [key: string]: boolean } = {}, cds: DocumentSymbol[] = [];
									for (const it of par) pars[it.name.toLowerCase()] = true;
									for (let i = sub.length - 1; i >= 0; i--) {
										if (pars[sub[i].name.toLowerCase()])
											cds.push(sub[i]), sub.splice(i, 1);
										else
											(<Variable>sub[i]).def = false;
									}
									if (fc) {
										if (fc.content.charAt(0).match(/[\d$]/)) _this.addDiagnostic(diagnostic.invalidsymbolname(fc.content), fc.offset, fc.length);
										fc.semantic = { type: SemanticTokenTypes.function, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly };
										result.push(tn = FuncNode.create(fc.content, SymbolKind.Function, makerange(fc.offset, parser_pos - fc.offset), makerange(fc.offset, fc.length), par, cds));
										(<FuncNode>tn).returntypes = o, _this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
										(<FuncNode>tn).closure = !!(mode & 1), adddeclaration(tn as FuncNode);
										for (const t in o)
											o[t] = tn.range.end;
										if (mode !== 0)
											(<FuncNode>tn).parent = _parent;
									}
									_parent.children.push(...sub);
									tpexp += ' #func', types[tpexp] = true;
									return sub;
								} else {
									if (n_newlines > 1) cmm.type = '';
									next = false, lk = tk, tk = nk;
									if (fc) {
										if (input.charAt(fc.offset - 1) !== '%')
											tpexp += ' ' + fc.content + '()', addvariable(fc), fc.semantic = { type: SemanticTokenTypes.function }, _parent.funccall.push(DocumentSymbol.create(fc.content, undefined, SymbolKind.Function, makerange(fc.offset, quoteend - fc.offset), makerange(fc.offset, fc.length)));
									} else {
										let s = Object.keys(tpe).pop() || '';
										if (input.charAt(quoteend) === '(') {
											let t = s.trim().match(/^\(\s*(([\w.]|[^\x00-\x7f])+)\s*\)$/);
											if (t)
												s = t[1];
										}
										if (nospace) {
											tpexp += tpexp === '' || tpexp.substr(-1).match(/\s/) ? s : '()';
										} else
											tpexp += ' ' + s;
									}
									if (par) for (const it of par) if (!is_builtinvar(it.name.toLowerCase())) {
										result.push(it);
										if ((<Variable>it).ref || (<Variable>it).returntypes)
											(<Variable>it).def = true;
									}
								}
							}
							break;
						case 'TK_START_BLOCK':
							if (lk.type === 'TK_EQUALS') {
								parseobj(true, t = {}, objk = {});
								tpexp += ' ' + (Object.keys(t).pop() || '#object'); break;
							} else {
								let l = _this.diagnostics.length;
								if (['TK_WORD', 'TK_STRING', 'TK_NUMBER'].includes(lk.type)) {
									if (mustexp)
										_this.addDiagnostic(diagnostic.unexpected('{'), tk.offset, tk.length);
									else {
										types[tpexp] = true, _this.diagnostics.splice(l);
										next = false; return result.splice(pres);
									}
								}
								if (parseobj(mustexp, t = {})) {
									tpexp += ' ' + (Object.keys(t).pop() || '#object'); break;
								} else {
									types[tpexp] = true, _this.diagnostics.splice(l);
									if (tpexp === ' #object' && objk)
										types[tpexp] = objk;
									next = false; return result.splice(pres);
								}
							}
						case 'TK_NUMBER': tpexp += ' #number'; break;
						case 'TK_STRING': tpexp += ' #string'; break;
						case 'TK_END_BLOCK':
						case 'TK_END_EXPR':
						case 'TK_COMMA':
							next = false, types[tpexp] = true;
							if (tpexp === ' #object' && objk)
								types[tpexp] = objk;
							return result.splice(pres);
						case 'TK_UNKNOWN': _this.addDiagnostic(diagnostic.unknowntoken(tk.content), tk.offset, tk.length); break;
						case 'TK_RESERVED':
							if (tk.content.match(/\b(and|or|not)\b/i)) {
								let t = parser_pos, nk = get_token_ingore_comment();
								if (nk.type !== 'TK_EQUALS' && !nk.content.match(/^([<>]=?|~=|&&|\|\||[,.&|?:^]|\*\*?|\/\/?|<<|>>|!?==?)$/)) { lk = tk, tk = nk, next = false; break; }
								parser_pos = t;
							} else if (tk.content.match(/^(class|super|isset)$/i)) {
								if (tk.content.toLowerCase() === 'isset') {
									tk.ignore = true;
									if (input.charAt(tk.offset + tk.length) !== '(')
										_this.addDiagnostic(diagnostic.missing('('), tk.offset, tk.length);
								}
								next = false, tk.type = 'TK_WORD';
								continue;
							}
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset); break;
						case 'TK_OPERATOR':
							if (tk.content === '%') {
								if (input.charAt(tk.offset - 1).match(/\w|[^\x00-\x7f]/))
									tpexp = tpexp.replace(/\S+$/, '#any');
								else
									tpexp += (lk.type === 'TK_DOT' ? '.' : ' ') + '#any';
								if (inpair === '%') {
									next = false, types[tpexp] = true;
									if (tpexp === ' #object' && objk)
										types[tpexp] = objk;
									return result.splice(pres);
								}
								parsepair('%', '%');
							} else if (tk.content === '=>' && lk.type === 'TK_WORD') {
								let p = lk.content.toLowerCase();
								if (result.length && result[result.length - 1].name === lk.content)
									result.pop();
								let o = {}, sub = parseexp(inpair, o);
								for (let i = sub.length - 1; i >= 0; i--) {
									if (sub[i].name.toLowerCase() === p)
										sub.splice(i, 1);
									else
										(<Variable>sub[i]).def = false;
								}
								result.push(...sub);
								tpexp = tpexp.replace(/\S+$/, '#func');
							} else {
								tpexp += ' ' + tk.content;
								if (lk.type === 'TK_OPERATOR' && !lk.content.match(/^[:?%]$/) && !tk.content.match(/[+\-%!]/))
									_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset);
								if (tk.content === '&' && (['TK_EQUALS', 'TK_COMMA', 'TK_START_EXPR'].includes(lk.type))) {
									byref = true;
									continue;
								}
							}
							break;
						case 'TK_EQUALS': tpexp += ' :='; break;
					}
					byref = false;
				}
				types[tpexp] = true;
				if (tpexp === ' #object' && objk)
					types[tpexp] = objk;
				return result.splice(pres);
			}

			function parsequt(types: any = {}) {
				let paramsdef = true, beg = parser_pos - 1, cache = [], rg, ds = _this.diagnostics.length, byref = false, bak = tk, tpexp = '';
				if (!tk.topofline && ((lk.type === 'TK_OPERATOR' && !lk.content.match(/(:=|\?|:)/)) || !in_array(lk.type, ['TK_START_EXPR', 'TK_WORD', 'TK_EQUALS', 'TK_OPERATOR', 'TK_COMMA'])
					|| (lk.type === 'TK_WORD' && in_array(input.charAt(tk.offset - 1), whitespace))))
					paramsdef = false;
				if (paramsdef) {
					tds.length = 0;
					while (nexttoken()) {
						if (tk.content === ')') break;
						else if (tk.type === 'TK_WORD') {
							if (in_array(lk.content, [',', '('])) {
								if (tk.content.toLowerCase() === 'byref') {
									nexttoken();
									if (tk.type !== 'TK_WORD') {
										addvariable(lk), next = false; break;
									} else
										byref = true, _this.addDiagnostic(diagnostic.deprecated('&', 'ByRef'), lk.offset, 5, DiagnosticSeverity.Warning, tds);
								}
								lk = tk, tk = get_token_ingore_comment(cmm);
								if (tk.content === ',' || tk.content === ')') {
									if (lk.content.charAt(0).match(/[\d$]/)) _this.addDiagnostic(diagnostic.invalidsymbolname(lk.content), lk.offset, lk.length);
									tn = Variable.create(lk.content, SymbolKind.Variable, rg = makerange(lk.offset, lk.length), rg);
									if (byref)
										byref = false, (<Variable>tn).ref = (<Variable>tn).def = true;
									cache.push(tn), tpexp = tn.name;
									if (tk.content === ')') { paramsdef = !is_builtinvar(tn.name.toLowerCase()); break; }
								} else if (tk.content === ':=') {
									tk = get_token_ingore_comment(cmm);
									if (tk.content === '-' || tk.content === '+') {
										let nk = get_next_token();
										tpexp = '#number';
										if (nk.type === 'TK_NUMBER')
											tk.content = tk.content + nk.content, tk.length = tk.content.length, tk.type = 'TK_NUMBER';
										else { paramsdef = false; break; }
									}
									if (tk.type === 'TK_STRING' || tk.type === 'TK_NUMBER' || ['unset', 'true', 'false'].includes(tk.content.toLowerCase())) {
										if (lk.content.charAt(0).match(/[\d$]/)) _this.addDiagnostic(diagnostic.invalidsymbolname(lk.content), lk.offset, lk.length);
										tn = Variable.create(lk.content, SymbolKind.Variable, rg = makerange(lk.offset, lk.length), rg);
										if (byref) byref = false, (<Variable>tn).ref = true;
										(<Variable>tn).def = true;
										(<Variable>tn).defaultVal = tk.content, cache.push(tn);
										if (tk.type === 'TK_STRING')
											(<Variable>tn).returntypes = { '#string': true }, tpexp = '#string';
										else if (tk.content.toLowerCase() !== 'unset')
											(<Variable>tn).returntypes = { '#number': true }, tpexp = '#number';
										else tk.semantic = { type: SemanticTokenTypes.variable, modifier: 1 << SemanticTokenModifiers.readonly };
										lk = tk, tk = get_token_ingore_comment(cmm);
										if (tk.type === 'TK_COMMA') continue; else if (tk.content === ')') break; else { paramsdef = false; break; }
									} else { paramsdef = false; break; }
								} else if (tk.type === 'TK_OPERATOR') {
									if (tk.content === '*') {
										let nk = get_next_token();
										if (nk.content !== ')') { paramsdef = false, lk = tk, tk = nk; break; }
										else {
											tn = Variable.create(lk.content, SymbolKind.Variable, rg = makerange(lk.offset, lk.length), rg);
											cache.push(tn), lk = tk, tk = nk, next = false, (<any>tn).arr = true;
										}
									} else { paramsdef = false; break; }
									continue;
								} else if (tk.content === '(') {
									paramsdef = false, parser_pos = lk.offset + lk.length, tk = lk; break;
								} else { paramsdef = false; break; }
							} else { paramsdef = false; break; }
							if (is_builtinvar(tn.name.toLowerCase())) { paramsdef = false; break; }
						} else if ([',', '('].includes(lk.content)) {
							if (tk.content === '*') {
								lk = tk, tk = get_next_token();
								if (tk.content === ')') {
									cache.push(Variable.create('*', SymbolKind.Null, rg = makerange(0, 0), rg));
									break;
								}
							} else if (tk.content === '&') {
								tk = get_next_token();
								if (tk.type === 'TK_WORD') {
									byref = true, next = false; continue;
								}
							}
							paramsdef = false; break;
						} else {
							paramsdef = false; break;
						}
					}
				}
				if (!paramsdef) {
					parser_pos = beg + 1, tk = bak, next = true, tds.length = 0;
					_this.diagnostics.splice(ds);
					parsepair('(', ')', beg, types);
					return;
				}
				types['( ' + tpexp.toLowerCase() + ')'] = true;
				return cache;
			}

			function parseobj(must: boolean = false, tp: any = {}, ks: any = {}): boolean {
				let l = lk, b = tk, rl = result.length, isobj = true, ts: any = {}, k: Token | undefined, nk: Token;
				if (!next && tk.type === 'TK_START_BLOCK')
					next = true;
				while (objkey())
					if (objval())
						break;
				if (!isobj) {
					let e = tk;
					lk = l, tk = b, result.splice(rl), parser_pos = tk.offset + tk.length;
					if (must) {
						parseerrobj();
						_this.addDiagnostic(diagnostic.objectliteralerr(), e.offset, parser_pos - e.offset);
						return true;
					}
					return next = false;
				} else if (lk.content === ':')
					_this.addDiagnostic(diagnostic.objectliteralerr(), lk.offset, parser_pos - lk.offset);
				if (tk.type === 'TK_END_BLOCK')
					_this.addFoldingRange(b.offset, tk.offset);
				else
					_this.addDiagnostic(diagnostic.missing('}'), b.offset, 1);
				return true;

				function objkey(): boolean {
					while (nexttoken()) {
						k = undefined;
						switch (tk.type) {
							case 'TK_RESERVED':
							case 'TK_WORD':
								if (input.charAt(parser_pos) === '%')
									break;
								nk = get_token_ingore_comment();
								if (nk.content === ':') {
									tk.semantic = { type: SemanticTokenTypes.property }, ks[tk.content.toLowerCase()] = tk.content;
									lk = tk, tk = nk, k = lk;
									return true;
								}
								return isobj = false;
							case 'TK_STRING':
								nk = get_token_ingore_comment();
								if (nk.content === ':') {
									lk = tk, tk = nk;
									_this.addDiagnostic(diagnostic.invalidpropname(), lk.offset, lk.length);
									return true;
								}
								return isobj = false;
							case 'TK_START_EXPR':
								return isobj = false;
							case 'TK_OPERATOR':
								if (tk.content === '%') {
									parsepair('%', '%');
									if (isIdentifierChar(input.charCodeAt(parser_pos)))
										break;
									else {
										nk = get_token_ingore_comment();
										if (nk.content === ':') {
											lk = tk, tk = nk;
											return true;
										}
									}
								} else if (allIdentifierChar.test(tk.content)) {
									nk = get_token_ingore_comment();
									if (nk.content === ':') {
										tk.semantic = { type: SemanticTokenTypes.property };
										lk = tk, tk = nk, k = lk;
										return true;
									}
								}
								return isobj = false;
							case 'TK_LABEL':
								if (tk.content.match(/^(\w|[^\x00-\x7f])+:$/)) {
									let t: string;
									addtext({ content: t = tk.content.replace(':', ''), type: '', offset: 0, length: 0 });
									ks[t.toLowerCase()] = t;
									return true;
								}
								return isobj = false;
							case 'TK_COMMENT':
							case 'TK_BLOCK_COMMENT':
							case 'TK_INLINE_COMMENT':
								tk = lk;
								break;
							case 'TK_END_BLOCK':
								if (lk.type === 'TK_START_BLOCK' || lk.type === 'TK_COMMA')
									return false;
							case 'TK_NUMBER':
								if (tk.content.match(/^\d+$|^0[xX]/)) {
									nk = get_token_ingore_comment();
									if (nk.content === ':') {
										tk.semantic = { type: SemanticTokenTypes.property }, ks[tk.content.toLowerCase()] = tk.content;
										lk = tk, tk = nk;
										return true;
									}
								}
							default:
								return isobj = false;
						}
					}
					return false;
				}

				function objval(): boolean {
					let exp = parseexp(',', ts = {}, true);
					result.push(...exp);
					if (k) {
						if (k.content.toLowerCase() === 'base') {
							let t = Object.keys(ts).pop();
							if (t && t.match(/\.prototype$/i))
								tp[t.slice(0, -10).trim().toLowerCase().replace(/([^.]+)$/, '@$1')] = true;
						} else
							addprop(k);
					}
					if (tk.type === 'TK_COMMA')
						return !(next = true);
					else if (tk.type === 'TK_END_BLOCK')
						return next = true;
					else if (tk.type === 'TK_EOF')
						return true;
					else
						return !(isobj = false);
				}
			}

			function parseerrobj() {
				let num = 0;
				if (!next && tk.type === 'TK_START_BLOCK')
					next = true;
				while (nexttoken()) {
					switch (tk.type) {
						case 'TK_START_BLOCK':
							num++;
							break;
						case 'TK_END_BLOCK':
							if ((--num) < 0)
								return;
							break;
					}
				}
			}

			function parsepair(b: string, e: string, pairbeg?: number, types: any = {}, strs?: Token[]) {
				let pairnum = 0, apos = result.length, tp = parser_pos, llk = lk, pairpos: number[], rpair = 0, tpexp = '', byref = false;
				pairpos = pairbeg === undefined ? [parser_pos - 1] : [pairbeg];
				while (nexttoken()) {
					if (b === '%' && tk.topofline && !(['TK_COMMA', 'TK_OPERATOR', 'TK_EQUALS'].includes(tk.type) && !tk.content.match(/^(!|~|not)$/i))) {
						_this.addDiagnostic(diagnostic.missing('%'), pairpos[0], 1);
						next = false, tpexp = '#any'; break;
					}
					if (b !== '(' && tk.content === '(') {
						apos = result.length, tp = parser_pos, rpair = 1, llk = lk;
						parsepair('(', ')');
					} else if (tk.content === e) {
						if ((--pairnum) < 0)
							break;
						if (e === ')')
							tpexp += ')', rpair++;
					}
					else if (tk.content === b) {
						pairnum++, pairpos.push(parser_pos - 1), llk = lk;
						if (b === '(')
							apos = result.length, tp = parser_pos, rpair = 0, tpexp += '(';
					} else if (tk.content === '=>') {
						let d = result.splice(apos), bb = tk, par: DocumentSymbol[] | undefined, nk: Token;
						if (lk.content === ')') {
							if (rpair !== 1) {
								_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, 2), next = true;
								continue;
							}
							lk = llk, parser_pos = tp - 1, tk = get_next_token();
							par = parsequt(), nk = get_token_ingore_comment();
						} else if (lk.type === 'TK_WORD' && input.charAt(lk.offset - 1) !== '.') {
							let rg: Range;
							nk = tk, par = [Variable.create(lk.content, SymbolKind.Variable, rg = makerange(lk.offset, lk.length), rg)]
						} else {
							_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, 2), next = true;
							continue;
						}
						if (!par || nk.content !== '=>') {
							tk = bb, parser_pos = bb.offset + bb.length, next = true, tpexp = '', result.push(...d);
							_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, 2);
							continue;
						}
						let sub = parseexp(e, undefined, true), pars: { [key: string]: boolean } = {}, lasthasval = false;
						for (const it of par) {
							pars[it.name.toLowerCase()] = true;
							if ((<Variable>it).defaultVal || (<Variable>it).arr)
								lasthasval = true;
							else if (lasthasval)
								_this.addDiagnostic(diagnostic.defaultvalmissing(it.name), document.offsetAt(it.range.start), it.name.length);
						}
						for (let i = sub.length - 1; i >= 0; i--) {
							if (pars[sub[i].name.toLowerCase()])
								sub.splice(i, 1);
							else
								(<Variable>sub[i]).def = false;
						}
						tpexp = tpexp.replace(/\([^()]*\)$/, '') + ' #func';
					} else if (tk.type === 'TK_WORD') {
						if (input.charAt(tk.offset - 1) !== '.') {
							if (input.charAt(parser_pos) !== '(') {
								if (b === '%' || (input.charAt(tk.offset - 1) !== '%' && input.charAt(tk.offset + tk.length) !== '%')) {
									if (addvariable(tk)) {
										let vr = result[result.length - 1] as Variable;
										next = false, lk = tk, tk = get_token_ingore_comment();
										if (byref)
											vr.ref = vr.def = true, byref = false;
										if (tk.type === 'TK_EQUALS') {
											let o: any = {}, equ = tk.content;
											next = true;
											result.push(...parseexp(e, o, true));
											vr.range = { start: vr.range.start, end: document.positionAt(lk.offset + lk.length) };
											vr.returntypes = { [o = equ === ':=' ? Object.keys(o).pop()?.toLowerCase() || '#any' : equ === '.=' ? '#string' : '#number']: vr.range.end };
											tpexp += o, vr.def = true;
											if (equ === ':=' && typeof o[' #object'] === 'object')
												(<any>vr).property = Object.values(o[' #object']);
										} else
											tpexp += ' ' + lk.content;
									} else
										tpexp += ' ' + tk.content;
								}
							} else {
								lk = tk, tk = get_next_token(), lk.semantic = { type: SemanticTokenTypes.function };
								let fc = lk, par = parsequt(), quoteend = parser_pos, nk = get_token_ingore_comment();
								if (nk.content === '=>') {
									_this.diagnostics.push(...tds);
									let o: any = {}, sub = parseexp(e, o, true), pars: any = {};
									if (fc.content.charAt(0).match(/[\d$]/)) _this.addDiagnostic(diagnostic.invalidsymbolname(fc.content), fc.offset, fc.length);
									tn = FuncNode.create(fc.content, SymbolKind.Function, makerange(fc.offset, parser_pos - fc.offset), makerange(fc.offset, fc.length), <Variable[]>par, sub);
									tn.range.end = document.positionAt(lk.offset + lk.length), (<FuncNode>tn).closure = !!(mode & 1);
									(<FuncNode>tn).returntypes = o, adddeclaration(tn as FuncNode), (fc.semantic as SemanticToken).modifier = 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly;
									if (par) for (const it of par) pars[it.name.toLowerCase()] = true;
									for (const t in o)
										o[t] = tn.range.end;
									if (mode !== 0)
										(<FuncNode>tn).parent = _parent;
									result.push(tn), _this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
									for (let i = sub.length - 1; i >= 0; i--) {
										if (pars[sub[i].name.toLowerCase()])
											sub.splice(i, 1);
										else
											(<Variable>sub[i]).def = false;
									}
									tpexp += ' #func';
								} else {
									if (input.charAt(fc.offset - 1) !== '%') {
										addvariable(fc), _parent.funccall.push(DocumentSymbol.create(fc.content, undefined, SymbolKind.Function, makerange(fc.offset, quoteend - fc.offset), makerange(fc.offset, fc.length)));
										tpexp += ' ' + fc.content + '()';
									}
									next = false, lk = tk, tk = nk;
									if (par) for (const it of par) if (!is_builtinvar(it.name.toLowerCase())) {
										result.push(it);
										if ((<Variable>it).ref || (<Variable>it).returntypes)
											(<Variable>it).def = true;
									}
								}
							}
						} else if (input.charAt(parser_pos) === '(') {
							let ptk = tk;
							tk = get_next_token(), ptk.semantic = { type: SemanticTokenTypes.method };
							parsepair('(', ')');
							if (input.charAt(ptk.offset - 1) !== '%') {
								tpexp += '.' + ptk.content + '()', ptk.semantic = { type: SemanticTokenTypes.method };
								_parent.funccall.push(DocumentSymbol.create(ptk.content, undefined, SymbolKind.Method, makerange(ptk.offset, parser_pos - ptk.offset), makerange(ptk.offset, ptk.length)));
							}
						} else
							addprop(tk), maybeclassprop(tk);
					} else if (tk.type === 'TK_START_BLOCK') {
						let t: any = {};
						if (['TK_WORD', 'TK_STRING', 'TK_NUMBER'].includes(lk.type))
							_this.addDiagnostic(diagnostic.unexpected('{'), tk.offset, tk.length);
						parseobj(true, t);
						tpexp += ' ' + (Object.keys(t).pop() || '#object');
					} else if (tk.type === 'TK_STRING') {
						tpexp += ' #string';
						strs?.push(tk);
						if (b === '[' && is_next(']') && !tk.content.match(/\n|`n/))
							addtext({ type: '', content: tk.content.substring(1, tk.content.length - 1), offset: 0, length: 0 });
					} else if (tk.content === '[') {
						let pre = !!input.charAt(tk.offset - 1).match(/^(\w|\)|%|[^\x00-\x7f])$/);
						parsepair('[', ']');
						if (pre)
							tpexp = tpexp.replace(/\S+$/, '') + '#any';
						else
							tpexp += ' #array';
					} else if (tk.content === '%') {
						if (input.charAt(tk.offset - 1).match(/\w|[^\x00-\x7f]/))
							tpexp = tpexp.replace(/\S+$/, '#any');
						else
							tpexp += ' #any';
						parsepair('%', '%');
					} else if (tk.content.match(/^[)}]$/)) {
						_this.addDiagnostic(diagnostic.missing(e), pairpos[pairnum], 1), next = false;
						types[tpexp.indexOf('#any') === -1 ? '(' + tpexp + ')' : '#any'] = true;
						return;
					} else if (tk.type === 'TK_RESERVED') {
						if (tk.content.match(/\b(and|or|not)\b/i)) {
							let t = parser_pos, nk = get_token_ingore_comment();
							if (nk.type !== 'TK_EQUALS' && !nk.content.match(/^([<>]=?|~=|&&|\|\||[,.&|?:^]|\*\*?|\/\/?|<<|>>|!?==?)$/)) {
								lk = tk, tk = nk, next = false, tpexp += ' ' + (<any>{ 'and': '&&', 'or': '||', 'not': '!' })[tk.content.toLowerCase()];
								continue;
							}
							parser_pos = t, tpexp += ' ' + tk.content;
						} else if (tk.content.match(/^(class|super|isset)$/i)) {
							if (tk.content.toLowerCase() === 'isset') {
								tk.ignore = true;
								if (input.charAt(tk.offset + tk.length) !== '(')
									_this.addDiagnostic(diagnostic.missing('('), tk.offset, tk.length);
							}
							next = false, tk.type = 'TK_WORD';
							continue;
						}
						_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
					} else if (tk.type === 'TK_END_BLOCK' || tk.type === 'TK_END_EXPR')
						_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, 1);
					else if (tk.type === 'TK_COMMA')
						tpexp = '';
					else if (tk.type === 'TK_NUMBER')
						tpexp += ' #number';
					else if (tk.type === 'TK_OPERATOR') {
						tpexp += ' ' + tk.content;
						if (tk.content === '&') {
							byref = true;
							continue;
						}
					}
					byref = false;
				}
				types['(' + tpexp + ')'] = true;
				if (tk.type === 'TK_EOF' && pairnum > -1)
					_this.addDiagnostic(diagnostic.missing(e), pairpos[pairnum], 1);
			}

			function maybeclassprop(tk: Token) {
				if (classfullname === '')
					return;
				let i = tk.offset - 1, rg: Range;
				while (in_array(input.charAt(i - 1), whitespace))
					i--;
				let t = input.substring(i - 5, i);
				if (t.match(/[^.]this/i)) {
					let p = _parent, s = false;
					if (p.kind === SymbolKind.Method || p.kind === SymbolKind.Function || p.kind === SymbolKind.Class) {
						while (p && p.kind !== SymbolKind.Class) {
							if (p.kind === SymbolKind.Method && p.staic)
								s = true;
							p = p.parent;
						}
						if (p && p.kind === SymbolKind.Class) {
							let t = Variable.create(tk.content, SymbolKind.Property, rg = makerange(tk.offset, tk.length), rg);
							t.static = s, p.cache.push(t);
							return t;
						}
					}
				}
				return undefined;
			}

			function is_builtinvar(name: string): boolean {
				if (mode === 2)
					return false;
				if (builtin_variable.includes(name) || (h && builtin_variable_h.includes(name)))
					return true;
				return false;
			}

			function addvariable(token: Token, md: number = 0, p?: DocumentSymbol[]): boolean {
				let _low = token.content.toLowerCase();
				if (token.ignore || is_builtinvar(_low)) {
					if (_low === 'true' || _low === 'false')
						token.semantic = { type: SemanticTokenTypes.variable, modifier: 1 << SemanticTokenModifiers.readonly };
					else if (token.semantic)
						delete token.semantic;
					return false;
				}
				if (_low.charAt(0).match(/[\d$]/)) _this.addDiagnostic(diagnostic.invalidsymbolname(token.content), token.offset, token.length);
				let rg = makerange(token.offset, token.length), tn = Variable.create(token.content, SymbolKind.Variable, rg, rg);
				if (md === 2) {
					tn.kind = SymbolKind.Property;
					addprop(token);
					if (classfullname) tn.full = `(${classfullname.slice(0, -1)}) ${tn.name}`;
					tn.def = true;
				}
				if (p) p.push(tn); else result.push(tn);
				return true;
			}

			function addprop(tk: Token) {
				let l = tk.content.toLowerCase(), rg: Range;
				tk.semantic = { type: SemanticTokenTypes.property };
				if (!_this.object.property[l])
					_this.object.property[l] = Variable.create(tk.content, SymbolKind.Property, rg = makerange(tk.offset, tk.length), rg);
			}

			function addtext(tk: Token) {
				_this.texts[tk.content.toLowerCase()] = tk.content;
			}

			function adddeclaration(node: FuncNode | ClassNode) {
				let dec = node.declaration, _diags = _this.diagnostics, lpv = false, pars: { [name: string]: Variable } = {}, funcs: { [name: string]: DocumentSymbol } = {};
				if (!dec)
					return;
				if (node.kind === SymbolKind.Class) {
					let sdec = (<ClassNode>node).staticdeclaration;
					node.children?.map(it => {
						if ((<SymbolKind[]>[SymbolKind.Property, SymbolKind.Method, SymbolKind.Class]).includes(it.kind)) {
							dec = (<any>it).static || it.kind === SymbolKind.Class ? sdec : node.declaration;
							if (!dec)
								return;
							if (!dec[_low = it.name.toLowerCase()]) {
								if (it.kind !== SymbolKind.Variable || (<Variable>it).def)
									dec[_low] = it;
							} else
								_diags.push({ message: samenameerr(dec[_low], it), range: it.selectionRange, severity: DiagnosticSeverity.Error });
						}
					});
					(<ClassNode>node).cache?.map(it => {
						dec = (<Variable>it).static ? sdec : node.declaration;
						if (!dec[_low = it.name.toLowerCase()])
							dec[_low] = it, node.children?.push(it);
					});
					(<ClassNode>node).cache?.splice(0);
				} else {
					if ((<FuncNode>node).assume === FuncScope.GLOBAL) {
						node.children?.map(it => {
							if (it.kind === SymbolKind.Function) {
								if (!dec[_low = it.name.toLowerCase()]) {
									dec[_low] = it;
								} else
									_diags.push({ message: samenameerr(dec[_low], it), range: it.selectionRange, severity: DiagnosticSeverity.Error });
								funcs[_low] = it;
							}
						});
						(<FuncNode>node).params?.map(it => {
							node.children?.unshift(it), it.def = true, it.kind = SymbolKind.TypeParameter;
							if (!dec[_low = it.name.toLowerCase()] || dec[_low].kind !== SymbolKind.Function)
								dec[_low] = it;
							else
								_diags.push({ message: samenameerr(it, dec[_low]), range: it.selectionRange, severity: DiagnosticSeverity.Error });
							if (it.defaultVal || it.arr)
								lpv = true;
							else if (lpv)
								_diags.push({ message: diagnostic.defaultvalmissing(it.name), range: it.selectionRange, severity: DiagnosticSeverity.Error });
							if (pars[_low])
								_diags.push({ message: diagnostic.conflictserr('parameter', 'parameter', it.name), range: it.selectionRange, severity: DiagnosticSeverity.Error });
							else pars[_low] = it;
						});
						for (const n in (<FuncNode>node).local) {
							if (!dec[n])
								dec[n] = (<FuncNode>node).local[n];
							else if (pars[n])
								_diags.push({ message: diagnostic.conflictserr('local', 'parameter', pars[n].name), range: (<FuncNode>node).local[n].selectionRange, severity: DiagnosticSeverity.Error });
						}
						for (const n in (<FuncNode>node).global) {
							if (pars[n])
								_diags.push({ message: diagnostic.conflictserr('global', 'parameter', pars[n].name), range: (<FuncNode>node).local[n].selectionRange, severity: DiagnosticSeverity.Error });
							else {
								if (dec[n]) {
									_this.declaration[n] = dec[n];
									delete dec[n];
								} else
									_this.declaration[n] = (<FuncNode>node).global[n];
								(<any>_this.declaration[n]).infunc = true;
							}
						}
						let gdec = _this.declaration;
						node.children?.map(it => {
							if (it.kind === SymbolKind.Variable) {
								if (!dec[_low = it.name.toLowerCase()]) {
									if (!gdec[_low]) {
										gdec[_low] = it;
										(<any>it).infunc = true;
									} else if (gdec[_low].kind !== SymbolKind.Variable)
										_diags.push({ message: samenameerr(gdec[_low], it), range: it.selectionRange, severity: DiagnosticSeverity.Error });
								}
							}
						});
					} else {
						node.children?.map(it => {
							if (it.kind === SymbolKind.Function || (<Variable>it).def) {
								if (!dec[_low = it.name.toLowerCase()]) {
									dec[_low] = it;
								} else if (!(it.kind === SymbolKind.Variable && dec[_low].kind === SymbolKind.Variable)) {
									if (dec[_low].kind === SymbolKind.Variable) {
										_diags.push({ message: samenameerr(it, dec[_low]), range: dec[_low].selectionRange, severity: DiagnosticSeverity.Error });
										dec[_low] = it;
									} else
										_diags.push({ message: samenameerr(dec[_low], it), range: it.selectionRange, severity: DiagnosticSeverity.Error });
								}
								if (it.kind === SymbolKind.Function)
									funcs[_low] = it;
							}
						});
						(<FuncNode>node).params?.map(it => {
							node.children?.unshift(it), it.def = true, it.kind = SymbolKind.TypeParameter;
							if (!dec[_low = it.name.toLowerCase()] || dec[_low].kind !== SymbolKind.Function)
								dec[_low] = it;
							else
								_diags.push({ message: samenameerr(it, dec[_low]), range: it.selectionRange, severity: DiagnosticSeverity.Error });
							if (it.defaultVal || it.arr)
								lpv = true;
							else if (lpv)
								_diags.push({ message: diagnostic.defaultvalmissing(it.name), range: it.selectionRange, severity: DiagnosticSeverity.Error });
							if (pars[_low])
								_diags.push({ message: diagnostic.conflictserr('parameter', 'parameter', it.name), range: it.selectionRange, severity: DiagnosticSeverity.Error });
							else pars[_low] = it;
						});
						for (const n in (<FuncNode>node).local) {
							if (!dec[n])
								dec[n] = (<FuncNode>node).local[n];
							else if (pars[n])
								_diags.push({ message: diagnostic.conflictserr('local', 'parameter', pars[n].name), range: (<FuncNode>node).local[n].selectionRange, severity: DiagnosticSeverity.Error });
						}
						for (const n in (<FuncNode>node).global) {
							if (pars[n])
								_diags.push({ message: diagnostic.conflictserr('global', 'parameter', pars[n].name), range: (<FuncNode>node).local[n].selectionRange, severity: DiagnosticSeverity.Error });
							else {
								if (dec[n]) {
									_this.declaration[n] = dec[n];
									if (dec[n].kind !== SymbolKind.Variable)
										(<FuncNode>node).global[n] = dec[n];
									delete dec[n];
								} else
									_this.declaration[n] = (<FuncNode>node).global[n];
								(<any>_this.declaration[n]).infunc = true;
							}
						}
					}
					for (const n in pars)
						(<FuncNode>node).local[n] = pars[n];
					for (const n in funcs)
						(<FuncNode>node).local[n] = funcs[n];
					if (node.kind === SymbolKind.Method && pars['this'])
						_diags.push({ message: diagnostic.conflictserr('parameter', 'parameter', 'this'), range: pars['this'].selectionRange, severity: DiagnosticSeverity.Error });
				}
			}

			function nexttoken() {
				if (next) lk = tk, tk = get_next_token(), cmm.type = ''; else return next = true;
				do {
					switch (tk.type) {
						case 'TK_BLOCK_COMMENT':
							_this.addFoldingRange(tk.offset, tk.offset + tk.length, 'comment');
						case 'TK_COMMENT':
							cmm = tk;
						case 'TK_INLINE_COMMENT':
							tk = get_next_token();
							break;
						case 'TK_STRING':
							if (tk.content.indexOf('\n') !== -1)
								_this.addFoldingRange(tk.offset, tk.offset + tk.length, 'line');
							return true;
						case 'TK_EOF':
							return false;
						default:
							return true;
					}
				} while (tk.type !== 'TK_EOF');
				return false;
			}
		}

		function trimcomment(comment: string): string {
			if (comment.charAt(0) === ';') comment = '\n' + comment.replace(/(?<=^[ \t]*);\s*/gm, '') + '\n';
			let c = comment.split(/\r?\n/), cc = '';
			c.slice(1, c.length - 1).map(l => {
				cc += '\n' + l.replace(/^\s*\*/, '').trim();
			});
			return cc.substring(1);
		}

		function makerange(offset: number, length: number): Range {
			return Range.create(_this.document.positionAt(offset), _this.document.positionAt(offset + length));
		}

		function get_token_ingore_comment(comment?: Token): Token {
			let tk: Token;
			if (comment) comment.type = '';
			while (true) {
				tk = get_next_token();
				switch (tk.type) {
					case 'TK_BLOCK_COMMENT':
						_this.addFoldingRange(tk.offset, tk.offset + tk.length, 'comment');
					case 'TK_COMMENT':
						if (comment)
							Object.assign(comment, tk);
					case 'TK_INLINE_COMMENT':
						continue;
					case 'TK_STRING':
						if (tk.content.indexOf('\n') !== -1)
							_this.addFoldingRange(tk.offset, tk.offset + tk.length, 'line');
						break;
				}
				break;
			}
			return tk;
		}

		function linecontinue(lk: Token, tk: Token): boolean {
			switch (tk.type) {
				case 'TK_DOT':
				case 'TK_COMMA':
				case 'TK_EQUALS':
					return true;
				case 'TK_OPERATOR':
					return !tk.content.match(/^(!|~|not|in|is|contains|%|\+\+|--)$/i);
				case 'TK_END_BLOCK':
				case 'TK_END_EXPR':
					return false;
				default:
					switch (lk.type) {
						case 'TK_COMMA':
						case 'TK_EQUALS':
							return true;
						case 'TK_OPERATOR':
							return !lk.content.match(/^(\+\+|--|%)$/);
						default:
							return false;
					}
			}
		}

		function createToken(content: string, type: string, offset: number, length: number, topofline?: boolean): Token {
			let tk = { content, type, offset, length, topofline };
			_this.tokens[offset] = tk;
			return tk;
		}

		function create_flags(flags_base: any, mode: any) {
			let next_indent_level = 0;
			if (flags_base) {
				next_indent_level = flags_base.indentation_level;
				if (!just_added_newline() &&
					flags_base.line_indent_level > next_indent_level) {
					next_indent_level = flags_base.line_indent_level;
				}
			}

			let next_flags = {
				mode: mode,
				parent: flags_base,
				last_text: flags_base ? flags_base.last_text : '',
				last_word: flags_base ? flags_base.last_word : '',
				declaration_statement: false,
				in_html_comment: false,
				multiline_frame: false,
				if_block: false,
				else_block: false,
				do_block: false,
				do_while: false,
				in_case_statement: false,
				in_case: false,
				case_body: false,
				indentation_level: next_indent_level,
				line_indent_level: flags_base ? flags_base.line_indent_level : next_indent_level,
				start_line_index: output_lines.length,
				had_comment: false,
				ternary_depth: 0
			};
			return next_flags;
		}

		// Using object instead of string to allow for later expansion of info about each line
		function create_output_line() {
			return {
				text: []
			};
		}

		function trim_output(eat_newlines = false): void {
			if (output_lines.length) {
				trim_output_line(output_lines[output_lines.length - 1], eat_newlines);

				while (eat_newlines && output_lines.length > 1 &&
					output_lines[output_lines.length - 1].text.length === 0) {
					output_lines.pop();
					trim_output_line(output_lines[output_lines.length - 1], eat_newlines);
				}
			}
		}

		function trim_output_line(line: any, lines: any): void {
			while (line.text.length &&
				(line.text[line.text.length - 1] === ' ' ||
					line.text[line.text.length - 1] === indent_string ||
					line.text[line.text.length - 1] === preindent_string)) {
				line.text.pop();
			}
		}

		function trim(s: string): string {
			return s.replace(/^\s+|\s+$/g, '');
		}

		// we could use just string.split, but
		// IE doesn't like returning empty strings
		function split_newlines(s: string): string[] {
			//return s.split(/\x0d\x0a|\x0a/);
			s = s.replace(/\x0d/g, '');
			let out = [],
				idx = s.indexOf("\n");
			while (idx !== -1) {
				out.push(s.substring(0, idx));
				s = s.substring(idx + 1);
				idx = s.indexOf("\n");
			}
			if (s.length) {
				out.push(s);
			}
			return out;
		}

		function just_added_newline(): boolean {
			let line = output_lines[output_lines.length - 1];
			return line.text.length === 0;
		}

		function just_added_blankline(): boolean {
			if (just_added_newline()) {
				if (output_lines.length === 1) {
					return true; // start of the file and newline = blank
				}

				let line = output_lines[output_lines.length - 2];
				return line.text.length === 0;
			}
			return false;
		}

		function allow_wrap_or_preserved_newline(force_linewrap = false): void {
			if (opt.wrap_line_length && !force_linewrap) {
				let line = output_lines[output_lines.length - 1];
				let proposed_line_length = 0;
				// never wrap the first token of a line.
				if (line.text.length > 0) {
					proposed_line_length = line.text.join('').length + token_text.length +
						(output_space_before_token ? 1 : 0);
					if (proposed_line_length >= opt.wrap_line_length) {
						force_linewrap = true;
					}
				}
			}
			if (((opt.preserve_newlines && input_wanted_newline) || force_linewrap) && !just_added_newline()) {
				print_newline(false, true);
			}
		}

		function print_newline(force_newline = false, preserve_statement_flags = false): void {
			output_space_before_token = false;

			if (!preserve_statement_flags) {
				if (flags.last_text !== ',' && flags.last_text !== '=' && (last_type !== 'TK_OPERATOR' || in_array(flags.last_text, ['++', '--', '%']))) {
					while (flags.mode === MODE.Statement && !flags.if_block && !flags.do_block) {
						restore_mode();
					}
				}
			}

			if (output_lines.length === 1 && just_added_newline()) {
				return; // no newline on start of file
			}

			if (force_newline || !just_added_newline()) {
				flags.multiline_frame = true;
				output_lines.push(create_output_line());
			}
		}

		function print_token_line_indentation(): void {
			if (just_added_newline()) {
				let line = output_lines[output_lines.length - 1];
				if (opt.keep_array_indentation && is_array(flags.mode) && input_wanted_newline) {
					// prevent removing of this whitespace as redundundant
					// line.text.push('');
					// for (let i = 0; i < whitespace_before_token.length; i += 1) {
					// 	line.text.push(whitespace_before_token[i]);
					// }
					if (preindent_string) {
						line.text.push(preindent_string);
					}
					if (is_expression(flags.parent.mode)) print_indent_string(flags.parent.indentation_level);
					else print_indent_string(flags.indentation_level);
				} else {
					if (preindent_string) {
						line.text.push(preindent_string);
					}

					print_indent_string(flags.indentation_level);
				}
			}
		}

		function print_indent_string(level: number): void {
			// Never indent your first output indent at the start of the file
			if (output_lines.length > 1) {
				let line = output_lines[output_lines.length - 1];

				flags.line_indent_level = level;
				for (let i = 0; i < level; i += 1) {
					line.text.push(indent_string);
				}
			}
		}

		function print_token_space_before(): void {
			let line = output_lines[output_lines.length - 1];
			if (output_space_before_token && line.text.length) {
				let last_output = line.text[line.text.length - 1];
				if (last_output !== ' ' && last_output !== indent_string) { // prevent occassional duplicate space
					line.text.push(' ');
				}
			}
		}

		function print_token(printable_token = ""): void {
			printable_token = printable_token || token_text;
			print_token_line_indentation();
			print_token_space_before();
			output_space_before_token = false;
			output_lines[output_lines.length - 1].text.push(printable_token);
		}

		function indent(): void {
			flags.indentation_level += 1;
		}

		function deindent(): void {
			if (flags.indentation_level > 0 &&
				((!flags.parent) || flags.indentation_level > flags.parent.indentation_level))
				flags.indentation_level -= 1;
		}

		function remove_redundant_indentation(frame: { multiline_frame: any; start_line_index: any; }): void {
			// This implementation is effective but has some issues:
			//     - less than great performance due to array splicing
			//     - can cause line wrap to happen too soon due to indent removal
			//           after wrap points are calculated
			// These issues are minor compared to ugly indentation.
			if (frame.multiline_frame)
				return;

			// remove one indent from each line inside this section
			let index = frame.start_line_index;
			let splice_index = 0;
			let line: { text: any; };

			while (index < output_lines.length) {
				line = output_lines[index];
				index++;

				// skip empty lines
				if (line.text.length === 0) {
					continue;
				}

				// skip the preindent string if present
				if (preindent_string && line.text[0] === preindent_string) {
					splice_index = 1;
				} else {
					splice_index = 0;
				}

				// remove one indent, if present
				if (line.text[splice_index] === indent_string) {
					line.text.splice(splice_index, 1);
				}
			}
		}

		function set_mode(mode: any): void {
			if (flags) {
				flag_store.push(flags);
				previous_flags = flags;
			} else {
				previous_flags = create_flags(null, mode);
			}

			flags = create_flags(previous_flags, mode);
		}

		function is_array(mode: any): boolean {
			return mode === MODE.ArrayLiteral;
		}

		function is_expression(mode: any): boolean {
			return in_array(mode, [MODE.Expression, MODE.ForInitializer, MODE.Conditional]);
		}

		function restore_mode(): void {
			if (flag_store.length > 0) {
				previous_flags = flags;
				flags = flag_store.pop();
				if (previous_flags.mode === MODE.Statement) {
					remove_redundant_indentation(previous_flags);
				}
			}
		}

		function start_of_object_property(): boolean {
			return flags.parent.mode === MODE.ObjectLiteral && flags.mode === MODE.Statement && flags.last_text === ':' &&
				flags.ternary_depth === 0;
		}

		function start_of_statement(): boolean {
			if ((last_type === 'TK_RESERVED' && !input_wanted_newline && in_array(flags.last_text.toLowerCase(), ['local', 'static', 'global']) && token_type === 'TK_WORD') ||
				(last_type === 'TK_RESERVED' && flags.last_text.match(/^loop|try|catch|finally$/i)) ||
				(last_type === 'TK_RESERVED' && flags.last_text.match(/^return$/i) && !input_wanted_newline) ||
				(last_type === 'TK_RESERVED' && flags.last_text.match(/^else$/i) && !(token_type === 'TK_RESERVED' && token_text_low === 'if')) ||
				(last_type === 'TK_END_EXPR' && (previous_flags.mode === MODE.ForInitializer || previous_flags.mode === MODE.Conditional)) ||
				(last_type === 'TK_WORD' && flags.mode === MODE.BlockStatement
					&& !flags.in_case && !in_array(token_type, ['TK_WORD', 'TK_RESERVED', 'TK_START_EXPR'])
					&& !in_array(token_text, ['--', '++', '%', '::'])) ||
				(flags.mode === MODE.ObjectLiteral && flags.last_text === ':' && flags.ternary_depth === 0)) {

				set_mode(MODE.Statement);
				indent();

				if (last_type === 'TK_RESERVED' && in_array(flags.last_text.toLowerCase(), ['local', 'static', 'global']) && token_type === 'TK_WORD') {
					flags.declaration_statement = true;
				}
				// Issue #276:
				// If starting a new statement with [if, for, while, do], push to a new line.
				// if (a) if (b) if(c) d(); else e(); else f();
				if (!start_of_object_property()) {
					allow_wrap_or_preserved_newline(token_type === 'TK_RESERVED' && flags.last_text.toLowerCase() !== 'try' && in_array(token_text_low, ['loop', 'for', 'if', 'while']));
				}

				return true;
			} else if (token_text === '=>')
				set_mode(MODE.Statement), indent(), flags.declaration_statement = true;
			return false;
		}

		function all_lines_start_with(lines: string[], c: string): boolean {
			for (let i = 0; i < lines.length; i++) {
				let line = trim(lines[i]);
				if (line.charAt(0) !== c) {
					return false;
				}
			}
			return true;
		}

		function is_special_word(word: string): boolean {
			return in_array(word.toLowerCase(), ['return', 'loop', 'if', 'throw', 'else']);
		}

		function in_array(what: string, arr: string | any[]): boolean {
			for (let i = 0; i < arr.length; i += 1) {
				if (arr[i] === what) {
					return true;
				}
			}
			return false;
		}

		function unescape_string(s: string): string {
			let esc = false, out = '', pos = 0, s_hex = '', escaped = 0, c = '';

			while (esc || pos < s.length) {
				c = s.charAt(pos), pos++;
				if (esc) {
					esc = false;
					if (c === 'x') {
						// simple hex-escape \x24
						s_hex = s.substr(pos, 2);
						pos += 2;
					} else if (c === 'u') {
						// unicode-escape, \u2134
						s_hex = s.substr(pos, 4);
						pos += 4;
					} else {
						// some common escape, e.g \n
						out += '\\' + c;
						continue;
					}
					if (!s_hex.match(/^[0123456789abcdefABCDEF]+$/)) {
						// some weird escaping, bail out,
						// leaving whole string intact
						return s;
					}

					escaped = parseInt(s_hex, 16);

					if (escaped >= 0x00 && escaped < 0x20) {
						// leave 0x00...0x1f escaped
						if (c === 'x') {
							out += '\\x' + s_hex;
						} else {
							out += '\\u' + s_hex;
						}
						continue;
					} else if (escaped === 0x22 || escaped === 0x27 || escaped === 0x5c) {
						// single-quote, apostrophe, backslash - escape these
						out += '\\' + String.fromCharCode(escaped);
					} else if (c === 'x' && escaped > 0x7e && escaped <= 0xff) {
						// we bail out on \x7f..\xff,
						// leaving whole string escaped,
						// as it's probably completely binary
						return s;
					} else {
						out += String.fromCharCode(escaped);
					}
				} else if (c === '\\') {
					esc = true;
				} else {
					out += c;
				}
			}
			return out;
		}

		function is_next(find: string): boolean {
			let local_pos = parser_pos, l = find.length;
			let s = input.substr(local_pos, l), c = s.charAt(0);
			while (in_array(c, whitespace) && s !== find) {
				local_pos++;
				if (local_pos >= input_length) {
					return false;
				}
				s = input.substr(local_pos, l), c = s.charAt(0);
			}
			return s === find;
		}

		function end_bracket_of_expression(pos: number): void {
			let pLF = input.indexOf('\n', pos);
			if (pLF === -1) {
				pLF = input_length;
			}
			let LF = input.substring(parser_pos, pLF).trim();
			if (!is_array(flags.mode) && !(LF.length === 0 || bracketnum > 0 || LF.match(/^([;#]|\/\*|(and|or|is|in)\b)/i) || (!LF.match(/^(\+\+|--|!|~|%)/) && in_array(LF.charAt(0), punct)))) {
				following_bracket = false;
				restore_mode();
				remove_redundant_indentation(previous_flags);
				last_type = 'TK_END_EXPR';
				flags.last_text = ')';
			}
		}

		function get_next_token(): Token {
			let resulting_string: string, bg: boolean = parser_pos === 0;
			n_newlines = 0;
			if (parser_pos >= input_length) {
				return lst = createToken('', 'TK_EOF', input_length - 1, 0, true);
			}
			let c = input.charAt(parser_pos);
			input_wanted_newline = false, whitespace_before_token = [], parser_pos += 1;

			while (in_array(c, whitespace)) {

				if (c === '\n') {
					last_LF = parser_pos - 1;
					if (following_bracket) {
						end_bracket_of_expression(parser_pos);
					}
					n_newlines += 1, begin_line = true;
					whitespace_before_token = [];
				} else if (n_newlines) {
					if (c === indent_string) {
						whitespace_before_token.push(indent_string);
					} else if (c !== '\r') {
						whitespace_before_token.push(' ');
					}
				}

				if (parser_pos >= input_length) {
					return lst = createToken('', 'TK_EOF', input_length - 1, 0, true);
				}

				c = input.charAt(parser_pos);
				parser_pos += 1;
			}

			let offset = parser_pos - 1, len = 1, _tk = _this.tokens[offset];
			let m: RegExpMatchArray | null;
			if (_tk) {
				parser_pos = offset + _tk.length;
				begin_line = false;
				return _tk;
			}
			beginpos = offset;
			if (begin_line) {
				begin_line = false, bg = true;
				let next_LF = input.indexOf('\n', parser_pos);
				if (next_LF === -1) {
					next_LF = input_length;
				}
				let line = input.substring(last_LF + 1, next_LF).trim();
				if (line.indexOf('::') === -1) {
					if ((m = line.match(/^(([^\x00-\x7f]|\w)+):\s*(\s;.*)?$/)) && (!lst.type.match(/(TK_OPERATOR|TK_COMMA|TK_START_EXPR)/) || lst.content.match(/^(\+\+|--)$/))) {
						parser_pos += m[1].length + 1;
						return lst = createToken(m[1] + ':', 'TK_LABEL', offset, m[1].length + 1, true);
					}
				} else if (m = line.match(/^(:(\s|\*|\?0?|c[01]?|[pk]\d+|s[ipe]|[brto]0?|x|z)*:[\x09\x20-\x7E]+?::)(.*)$/i)) {
					if ((m[2] && m[2].match(/[xX]/)) || (m[3] && m[3].trim().match(/^\{\s*(\s;.*)?$/))) {
						parser_pos += m[1].length - 1;
						return lst = createToken(m[1], 'TK_HOT', offset, m[1].length, true);
					} else {
						last_LF = next_LF, parser_pos += m[1].length - 1, begin_line = true;
						return lst = createToken(m[1], 'TK_HOTLINE', offset, m[1].length, true);
					}
				} else if (m = line.match(/^(((([<>$~*!+#^]*?)(`;|[\x21-\x3A\x3C-\x7E]|[a-z]\w+|[^\x00-\x7f]))|(`;|[\x21-\x3A\x3C-\x7E]|[a-z]\w+|[^\x00-\x7f])\s*&\s*~?(`;|[\x21-\x3A\x3C-\x7E]|[a-z]\w+|[^\x00-\x7f]))(\s+up)?\s*::)(.*)$/i)) {
					if (m[9].trim().match(/^([<>~*!+#^])(`{|[\x21-\x7A\x7C-\x7E]|[a-z]\w+|[^\x00-\x7f])\s*(\s;.*)?$/i)) {
						last_LF = next_LF, begin_line = true;
						parser_pos = input.indexOf('::', parser_pos) + m[9].length - m[9].trimLeft().length + 2;
						return lst = createToken(m[1].replace(/\s+/g, ' '), 'TK_HOTLINE', offset, m[1].length, true);
					} else {
						parser_pos = input.indexOf('::', parser_pos) + 2;
						return lst = createToken(m[1].replace(/\s+/g, ' '), 'TK_HOT', offset, m[1].length, true);
					}
				} else if (m = line.match(/^(\S+):\s*(\s;.*)$/)) {
					parser_pos += m[1].length + 1;
					return lst = createToken(m[1] + ':', 'TK_LABEL', offset, m[1].length + 1, true);
				}
			}

			// NOTE: because beautifier doesn't fully parse, it doesn't use isIdentifierStart.
			// It just treats all identifiers and numbers and such the same.
			if (isIdentifierChar(input.charCodeAt(parser_pos - 1))) {
				while (parser_pos < input_length && isIdentifierChar(input.charCodeAt(parser_pos)))
					c += input.charAt(parser_pos), parser_pos += 1;

				// small and surprisingly unugly hack for 1E-10 representation
				if (input.charAt(offset - 1) !== '.') {
					if (m = c.match(/^(\d+[Ee](\d+)?|(0[Xx][\da-fA-F]+)|(\d+))$/)) {
						if (m[2] || m[3])
							return lst = createToken(c, 'TK_NUMBER', offset, c.length, bg), lst.semantic = { type: SemanticTokenTypes.number }, lst;
						if (m[4]) {
							if (parser_pos < input_length && input.charAt(parser_pos) === '.') {
								let cc = '', t = '', p = parser_pos + 1;
								while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
									cc += input.charAt(p), p += 1;
								if (cc.match(/^\d*([Ee]\d+)?$/)) {
									c += '.' + cc, parser_pos = p;
									return lst = createToken(c, 'TK_NUMBER', offset, c.length, bg), lst.semantic = { type: SemanticTokenTypes.number }, lst;
								} else if (cc.match(/^\d*[Ee]$/) && p < input_length && input.charAt(p).match(/[+\-]/)) {
									cc += input.charAt(p), p += 1;
									while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
										t += input.charAt(p), p += 1;
									if (t.match(/^\d+$/))
										c += '.' + cc + t, parser_pos = p;
								}
							}
							return lst = createToken(c, 'TK_NUMBER', offset, c.length, bg), lst.semantic = { type: SemanticTokenTypes.number }, lst;
						} else if (parser_pos < input_length && input.charAt(parser_pos).match(/[+\-]/)) {
							let sign = input.charAt(parser_pos), p = parser_pos, t: Token;
							parser_pos += 1, t = get_next_token();
							if (t.type === 'TK_NUMBER' && t.content.match(/^\d+$/)) {
								c += sign + t.content;
								return lst = createToken(c, 'TK_NUMBER', offset, c.length, bg), lst.semantic = { type: SemanticTokenTypes.number }, lst;
							} else
								parser_pos = p;
						}
					}
					if (in_array(c.toLowerCase(), reserved_words)) {
						if (c.match(/^(and|or|not|in|is|contains)$/i)) // hack for 'in' operator
							return lst = createToken(c, 'TK_OPERATOR', offset, c.length, bg);
						if (bg || c.toLowerCase() !== 'class')
							return lst = createToken(c, 'TK_RESERVED', offset, c.length, bg);
					}
				}
				return lst = createToken(c, 'TK_WORD', offset, c.length, bg);
			}

			if (c === '(' || c === '[') {
				if (c === '(') {
					if (following_bracket)
						bracketnum++;
					if (closed_cycle)
						closed_cycle++;
					else if (bg) {
						let i = parser_pos, t = '';
						while (i < input_length) {
							t = input.charAt(i), i++;
							if (t === '\n') {
								bg = false, parser_pos = i - 1;
								closed_cycle = 1;
								break;
							} else if (t === ')')
								break;
						}
					}
				}
				return lst = createToken(c, 'TK_START_EXPR', offset, 1, bg);
			}

			if (c === ')' || c === ']') {
				if (c === ')') {
					if (following_bracket)
						bracketnum--;
					if (closed_cycle > 0)
						closed_cycle--;
				}
				return lst = createToken(c, 'TK_END_EXPR', offset, 1, bg);
			}

			if (c === '{')
				return lst = createToken(c, 'TK_START_BLOCK', offset, 1, bg);

			if (c === '}')
				return lst = createToken(c, 'TK_END_BLOCK', offset, 1, bg);

			if (c === ';') {
				if (following_bracket)
					end_bracket_of_expression(input.indexOf('\n', parser_pos));
				let comment = '', comment_type = bg ? 'TK_COMMENT' : 'TK_INLINE_COMMENT', t: any;
				while (parser_pos <= input_length && (c != '\n' || (bg && is_next(';') && !is_next('\n')))) {
					comment += c;
					c = input.charAt(parser_pos);
					parser_pos += 1;
				}
				if (c === '\n') {
					parser_pos--;
					last_LF = parser_pos;
				}
				comment = comment.trimRight();
				if (_this.blocks) {
					let rg: Range;
					if (bg && (t = comment.match(/^;(;|\s*#)((end)?region\b)?/i))) {
						if (t[3]) {
							if ((t = customblocks.region.pop()) !== undefined)
								_this.addFoldingRange(t, offset, 'line');
						} else {
							if (t[2])
								customblocks.region.push(offset);
							_this.blocks.push(DocumentSymbol.create(comment.replace(/^;(;|\s*#)((end)?region\b)?\s*/i, '') || comment, undefined, SymbolKind.Module, rg = makerange(offset, comment.length), rg));
						}
						comment_type = '';
					} else if (t = comment.match(/^;+\s*([{}])/)) {
						if (t[1] === '}') {
							if ((t = customblocks.bracket.pop()) !== undefined)
								_this.addFoldingRange(t, offset, 'line');
						} else
							customblocks.bracket.push(offset);
						comment_type = '';
					} else if (t = comment.match(/^;(\s*~?\s*)todo(:?\s*)(.*)/i))
						_this.blocks.push(DocumentSymbol.create('TODO: ' + t[3].trim(), undefined, SymbolKind.Module, rg = makerange(offset, comment.length), rg));
				}
				_this.strcommpos[offset] = { end: parser_pos, type: 1 };
				return createToken(comment, comment_type, offset, comment.length, bg);
			}

			if (c === "'" || c === '"') { // string
				let sep = c, esc = false, end = 0, pos = 0, LF = '', tr = '', lc = '';
				resulting_string = c;
				if (parser_pos < input_length) {
					// handle string
					while ((lc = c, c = input.charAt(parser_pos)) !== sep || esc) {
						resulting_string += c;
						if (closed_cycle) {
						} else if (c === '\n') {
							last_LF = input.indexOf('\n', pos = parser_pos + 1);
							LF = input.substring(pos, last_LF === -1 ? parser_pos = input_length : (parser_pos = last_LF) + 1);
							end = parser_pos;
							while ((tr = LF.trim()) === '' || tr.startsWith(';') || tr.startsWith('/*')) {
								if (tr) {
									if (tr.startsWith(';')) {
										resulting_string += LF;
									} else {
										parser_pos = pos, begin_line = true;
										resulting_string += LF.substring(0, LF.indexOf('/*'));
										resulting_string += get_next_token().content + (LF.slice(-2) === '\r\n' ? '\r\n' : '\n');
									}
								}
								pos = parser_pos + 1, parser_pos = input.indexOf('\n', pos);
								if (parser_pos === -1) {
									resulting_string += input.substring(pos, parser_pos = input_length);
									_this.strcommpos[offset] = { end: end, type: 2 };
									len = resulting_string.trimRight().length;
									if (_this.blocks)
										_this.addDiagnostic(diagnostic.missing(sep), offset, len);
									return lst = createToken(resulting_string, 'TK_STRING', offset, len, bg);
								}
								last_LF = parser_pos, LF = input.substring(pos, parser_pos + 1);
							}
							let whitespace: any = LF.match(/^(\s*)\(/), t: RegExpExecArray | null;
							if (!whitespace) {
								parser_pos = - 1, len = resulting_string.trimRight().length;
								if (_this.blocks)
									_this.addDiagnostic(diagnostic.missing(sep), offset, len);
								_this.strcommpos[offset] = { end: end === -1 ? input_length : end - 1, type: 2 };
								parser_pos = offset + len;
								return lst = createToken(resulting_string = resulting_string.trimRight(), 'TK_STRING', offset, len, bg);
							}
							whitespace = whitespace[1];
							while (LF.trim().indexOf(')') !== 0) {
								resulting_string += LF, pos = parser_pos + 1, parser_pos = input.indexOf('\n', pos);
								if (parser_pos === -1) {
									LF = input.substring(pos, input_length);
									t = new RegExp('^\\s*\\)([^`' + sep + ']|`.)*' + sep).exec(LF);
									if (t)
										parser_pos = pos + t[0].length, resulting_string += t[0];
									else {
										resulting_string += input.substring(pos, parser_pos = input_length);
										if (_this.blocks)
											_this.addDiagnostic(diagnostic.missing(sep), offset, 1);
									}
									_this.strcommpos[offset] = { end: parser_pos - 1, type: 3 };
									return lst = createToken(resulting_string, 'TK_STRING', offset, parser_pos - offset, bg);
								}
								last_LF = parser_pos, LF = input.substring(pos, parser_pos + 1);
							}
							t = new RegExp('^\\s*\\)([^`' + sep + ']|`.)*' + sep).exec(LF);
							if (t) {
								parser_pos = pos + t[0].length;
							} else {
								parser_pos = input_length + 1;
								if (_this.blocks)
									_this.addDiagnostic(diagnostic.missing(sep), offset, 1);
							}
							resulting_string += whitespace + input.substring(pos, parser_pos).trim();
							_this.strcommpos[offset] = { end: parser_pos - 1, type: 3 };
							return lst = createToken(resulting_string, 'TK_STRING', offset, parser_pos - offset, bg);
						} else if (c === ';' && (lc === ' ' || lc === '\t')) {
							parser_pos += 1;
							while (parser_pos < input_length && (c = input.charAt(parser_pos)) !== '\n')
								resulting_string += c, parser_pos++;
							parser_pos -= 1;
						}
						esc = esc ? false : c === '`';
						parser_pos += 1;
						if (parser_pos >= input_length) {
							if (_this.blocks)
								_this.addDiagnostic(diagnostic.missing(sep), offset, 1);
							_this.strcommpos[offset] = { end: input_length, type: 2 };
							return lst = createToken(resulting_string, 'TK_STRING', offset, parser_pos - offset, bg);
						}
					}
				} else if (_this.blocks)
					_this.addDiagnostic(diagnostic.missing(sep), offset, 1);

				parser_pos += 1;
				resulting_string += sep;
				_this.strcommpos[offset] = { end: parser_pos - 1, type: 2 };
				if (closed_cycle && _this.blocks) {
					let i = 0, j = 0;
					while ((j = resulting_string.substring(i).search(/(?<=^[ \t]*)\)/m)) !== -1)
						_this.addDiagnostic(diagnostic.unexpected(')'), offset + i + j, 1), i = i + j + 1;
				}
				return lst = createToken(resulting_string, 'TK_STRING', offset, parser_pos - offset, bg);
			}

			if (c === '#') {
				// Spidermonkey-specific sharp variables for circular references
				// https://developer.mozilla.org/En/Sharp_variables_in_JavaScript
				// http://mxr.mozilla.org/mozilla-central/source/js/src/jsscan.cpp around line 1935
				let sharp = '#';
				c = input.charAt(parser_pos);
				if (parser_pos < input_length && !in_array(c, whitespace)) {
					while (parser_pos < input_length && !in_array(c = input.charAt(parser_pos), whitespace)) {
						sharp += c;
						parser_pos += 1;
					}
					if ((c === ' ' || c === '\t') && sharp.match(/#(dllload|dllimport|definedefault|hotstring|include|requires|errorstdout|WarnContinuableException|WindowClass)/i)) {
						let LF = input.indexOf('\n', parser_pos);
						if (LF === -1) {
							LF = input_length;
						}
						sharp += ' ' + input.substring(parser_pos, LF).trim();
						last_LF = parser_pos = LF;
					}
					if (bg)
						return lst = createToken(sharp, 'TK_SHARP', offset, parser_pos - offset, true);
					return lst = createToken(sharp, 'TK_UNKNOWN', offset, parser_pos - offset, false);
				}
			}

			if (c === '.') {
				let nextc = input.charAt(parser_pos);
				if (nextc === '=') {
					parser_pos++
					return lst = createToken('.=', 'TK_EQUALS', offset, 2, bg);
				} else if (in_array(input.charAt(parser_pos - 2), whitespace) && in_array(nextc, whitespace)) {
					return lst = createToken(c, 'TK_OPERATOR', offset, 1, bg);
				} else if (nextc.match(/\d/) && (lst.type === 'TK_EQUALS' || lst.type === 'TK_OPERATOR')) {
					let p = parser_pos + 1, t = '';
					while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
						nextc += input.charAt(p), p += 1;
					if (nextc.match(/^\d+([Ee]\d+)?$/)) {
						parser_pos = p, c += nextc;
						return lst = createToken('0' + c, 'TK_NUMBER', offset, c.length, bg), lst.semantic = { type: SemanticTokenTypes.number }, lst;
					} else if (p < input_length && nextc.match(/^\d+[Ee]$/) && input.charAt(p).match(/[+\-]/)) {
						nextc += input.charAt(p), p += 1;
						while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
							t += input.charAt(p), p += 1;
						if (t.match(/^\d+$/)) {
							parser_pos = p, c += nextc + t;
							return lst = createToken('0' + c, 'TK_NUMBER', offset, c.length, bg), lst.semantic = { type: SemanticTokenTypes.number }, lst;
						}
					}
				}
				return lst = createToken(c, 'TK_DOT', offset, 1, bg);
			}

			if (c === '/' && bg) {
				// peek for comment /* ... */
				if (input.charAt(parser_pos) === '*') {
					parser_pos += 1;
					let LF = input.indexOf('\n', parser_pos), b = parser_pos, ln = 0, tp = 'TK_COMMENT', t: RegExpMatchArray | null = null;
					while (LF !== -1 && !(t = input.substring(parser_pos, LF).match(/(^\s*\*\/)|(\*\/\s*$)/)))
						last_LF = LF, LF = input.indexOf('\n', parser_pos = LF + 1), ln++;
					if (ln) {
						tp = 'TK_BLOCK_COMMENT';
						if (t && t[1]) {
							parser_pos = input.indexOf('*/', last_LF) + 2;
							return createToken(input.substring(offset, parser_pos), tp, offset, parser_pos - offset, bg);
						}
					}
					if (LF === -1) {
						parser_pos = input_length;
						_this.strcommpos[offset] = { end: input_length, type: 1 };
						return createToken(input.substring(offset, input_length), tp, offset, input_length - offset, bg);
					} else {
						parser_pos = LF;
						_this.strcommpos[offset] = { end: LF - 1, type: 1 };
						return createToken(input.substring(offset, LF).trimRight(), tp, offset, LF - offset, bg);
					}
				}
			}

			if (in_array(c, punct)) {
				let f = parser_pos;
				while (parser_pos < input_length && in_array(c + input.charAt(parser_pos), punct)) {
					c += input.charAt(parser_pos);
					parser_pos += 1;
					if (parser_pos >= input_length)
						break;
				}

				if (c === ',')
					return lst = createToken(c, 'TK_COMMA', offset, 1, bg);
				return lst = createToken(c, c.match(/([:.+\-*/|&^]|\/\/|>>|<<)=/) ? 'TK_EQUALS' : 'TK_OPERATOR', offset, c.length, bg);
			}
			if (c === '`') {
				if (parser_pos < input_length)
					c += input.charAt(parser_pos), parser_pos++;
				return lst = createToken(c, 'TK_WORD', offset, 2, bg);
			}
			return lst = createToken(c, 'TK_UNKNOWN', offset, c.length, bg);
		}

		function handle_start_expr(): void {
			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
				switch (flags.last_word.toLowerCase()) {
					case 'try':
						if (!input_wanted_newline && in_array(token_text_low, ['if', 'while', 'loop', 'for']))
							restore_mode();
					case 'if':
					case 'catch':
					case 'finally':
					case 'else':
					case 'while':
					case 'loop':
					case 'for':
						flags.declaration_statement = true;
						break;
				}
			}

			let next_mode = MODE.Expression;
			if (token_text === '[') {

				if (last_type === 'TK_WORD' || flags.last_text === ')') {
					// this is array index specifier, break immediately
					// a[x], fn()[x]
					if (last_type === 'TK_RESERVED' && in_array(flags.last_text.toLowerCase(), line_starters)) {
						output_space_before_token = true;
					}
					set_mode(next_mode);
					print_token();
					indent();
					if (opt.space_in_paren) {
						output_space_before_token = true;
					}
					return;
				}

				next_mode = MODE.ArrayLiteral;
				if (is_array(flags.mode)) {
					if (flags.last_text === '[' ||
						(flags.last_text === ',' && (last_last_text === ']' || last_last_text === '}'))) {
						// ], [ goes to new line
						// }, [ goes to new line
						if (!opt.keep_array_indentation) {
							print_newline();
						}
					}
				}

			} else {
				if (last_type === 'TK_RESERVED' && in_array(flags.last_text.toLowerCase(), ['for', 'loop'])) {
					next_mode = MODE.ForInitializer;
				} else if (last_type === 'TK_RESERVED' && in_array(flags.last_text.toLowerCase(), ['if', 'while'])) {
					next_mode = MODE.Conditional;
				} else {
					// next_mode = MODE.Expression;
				}
			}

			if (last_type === 'TK_START_BLOCK') {
				print_newline();
			} else if (last_type === 'TK_END_EXPR' || last_type === 'TK_START_EXPR' || last_type === 'TK_END_BLOCK' || flags.last_text === '.') {
				// TODO: Consider whether forcing this is required.  Review failing tests when removed.
				allow_wrap_or_preserved_newline(input_wanted_newline);
				// do nothing on (( and )( and ][ and ]( and .(
			} else if (!(last_type === 'TK_RESERVED' && token_text === '(') && (last_type !== 'TK_WORD' || flags.last_text.match(/^#[a-z]+/i)) && last_type !== 'TK_OPERATOR') {
				output_space_before_token = true;
			} else if (last_type === 'TK_RESERVED' && (in_array(flags.last_text.toLowerCase(), line_starters) || flags.last_text.match(/^catch$/i))) {
				if (opt.space_before_conditional) {
					output_space_before_token = true;
				}
			}

			// Support of this kind of newline preservation.
			// a = (b &&
			//     (c || d));
			if (token_text === '(') {
				if (last_type === 'TK_EQUALS' || last_type === 'TK_OPERATOR') {
					if (!start_of_object_property()) {
						allow_wrap_or_preserved_newline();
					}
				}
				else if (last_type === 'TK_END_EXPR') {
					output_space_before_token = in_array(input.charAt(parser_pos - 2), [' ', '\t']);
				}
				else if (last_type === 'TK_WORD') {
					if (parser_pos > 1 && in_array(input.charAt(parser_pos - 2), [' ', '\t'])) {
						output_space_before_token = true;
					}
				}
				else if (flags.last_text.toLowerCase() === 'until') {
					output_space_before_token = true;
				}
				else if (last_type === 'TK_RESERVED' && flags.last_text.match(/^(break|continue)$/i))
					output_space_before_token = false;
				if (parser_pos !== ck.offset + 1)
					token_text += input.substring(ck.offset + 1, parser_pos).trimRight();
			}

			if (input_wanted_newline) {
				// print_newline(false, flags.declaration_statement);
				print_newline();
			}
			set_mode(next_mode);
			print_token();
			if (opt.space_in_paren) {
				output_space_before_token = true;
			}

			// In all cases, if we newline while inside an expression it should be indented.
			indent();
		}

		function handle_end_expr() {
			// statements inside expressions are not valid syntax, but...
			// statements must all be closed when their container closes
			while (flags.mode === MODE.Statement) {
				restore_mode();
			}

			if (flags.multiline_frame) {
				allow_wrap_or_preserved_newline(token_text === ']' && is_array(flags.mode) && !opt.keep_array_indentation);
			}

			if (opt.space_in_paren) {
				if (last_type === 'TK_START_EXPR' && !opt.space_in_empty_paren) {
					// () [] no inner space in empty parens like these, ever, ref #320
					trim_output();
					output_space_before_token = false;
				} else {
					output_space_before_token = true;
				}
			}
			restore_mode();
			print_token();
			remove_redundant_indentation(previous_flags);

			// do {} while () // no statement required after
			if (flags.do_while && previous_flags.mode === MODE.Conditional) {
				previous_flags.mode = MODE.Expression;
				flags.do_block = false;
				flags.do_while = false;

			}
		}

		function handle_start_block() {
			if (following_bracket) {
				following_bracket = false;
				restore_mode();
				remove_redundant_indentation(previous_flags);
				last_type = 'TK_END_EXPR';
				flags.last_text = ')';
			}
			set_mode(MODE.BlockStatement);

			let empty_braces = is_next('}');
			let empty_anonymous_function = empty_braces && flags.last_word === 'function' &&
				last_type === 'TK_END_EXPR';

			if (opt.brace_style === "expand") {
				if (last_type !== 'TK_OPERATOR' &&
					(empty_anonymous_function ||
						last_type === 'TK_EQUALS' ||
						(last_type === 'TK_RESERVED' && is_special_word(flags.last_text) && flags.last_text.toLowerCase() !== 'else'))) {
					output_space_before_token = true;
				} else {
					print_newline(false, true);
				}
			} else { // collapse
				if (last_type === 'TK_UNKNOWN' || last_type === 'TK_HOTLINE') {

				} else if (last_type !== 'TK_OPERATOR' && last_type !== 'TK_START_EXPR') {
					if (input_wanted_newline || last_type === 'TK_START_BLOCK') {
						print_newline();
					} else {
						output_space_before_token = true;
					}
				} else {
					// if TK_OPERATOR or TK_START_EXPR
					if (is_array(previous_flags.mode) && flags.last_text === ',') {
						if (last_last_text === '}') {
							// }, { in array context
							output_space_before_token = true;
						} else {
							print_newline(); // [a, b, c, {
						}
					}
				}
			}
			print_token();
			indent();
		}

		function handle_end_block() {
			// statements must all be closed when their container closes
			while (flags.mode === MODE.Statement) {
				restore_mode();
			}
			let empty_braces = false;;
			if (last_type === 'TK_START_BLOCK') {
				let t = output_lines[output_lines.length - 1].text, i = t.length - 2;
				end_of_object = false;
				while (i > 0) {
					if (t[i] === ' ' || t[i] === '\t') {
						i--;
						continue;
					} else if ([':=', ',', ':', '[', '('].includes(t[i]))
						empty_braces = true, end_of_object = true;
					break;
				}
			} else
				end_of_object = flags.mode === MODE.ObjectLiteral;
			if (opt.brace_style === "expand") {
				if (!empty_braces) {
					print_newline();
				}
			} else {
				// skip {}
				if (!empty_braces) {
					if (is_array(flags.mode) && opt.keep_array_indentation) {
						// we REALLY need a newline here, but newliner would skip that
						opt.keep_array_indentation = false;
						print_newline();
						opt.keep_array_indentation = true;
					} else if (input_wanted_newline || !(flags.mode === MODE.ObjectLiteral && keep_Object_line)) {
						print_newline();
					} else
						print_token(' ');
				}
			}
			restore_mode();
			print_token();
		}

		function handle_word() {
			let not_add_line = true;
			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
				switch (flags.last_word.toLowerCase()) {
					case 'try':
						if (!input_wanted_newline && in_array(token_text_low, ['if', 'while', 'loop', 'for']))
							restore_mode();
					case 'if':
					case 'catch':
					case 'finally':
					case 'else':
					case 'while':
					case 'loop':
					case 'for':
						flags.declaration_statement = true;
						break;
				}
			} else if (input_wanted_newline && !is_expression(flags.mode) &&
				(last_type !== 'TK_OPERATOR' || in_array(flags.last_text, ['--', '++', '%'])) && last_type !== 'TK_EQUALS' &&
				(opt.preserve_newlines || !(last_type === 'TK_RESERVED' && in_array(flags.last_text.toLowerCase(), ['local', 'static', 'global', 'set', 'get'])))) {
				print_newline();
				not_add_line = false;
			}

			if (flags.do_block && !flags.do_while) {
				if (last_type === 'TK_RESERVED' && flags.last_text.match(/^until$/i)) {
					// do {} ## while ()
					output_space_before_token = true;
					print_token();
					output_space_before_token = true;
					flags.do_while = true;
					return;
				} else {
					// loop .. \n .. \n throw ..
					// print_newline();
					flags.do_block = false;
				}
			}

			// if may be followed by else, or not
			// Bare/inline ifs are tricky
			// Need to unwind the modes correctly: if (a) if (b) c(); else d(); else e();
			if (flags.if_block) {
				if (!flags.else_block && (token_type === 'TK_RESERVED' && token_text_low === 'else')) {
					flags.else_block = true;
				} else {
					if (token_text_low !== 'if' || last_text !== 'else') {
						while (flags.mode === MODE.Statement)
							restore_mode();
					}
					flags.if_block = false;
					flags.else_block = false;
				}
			}
			if (flags.in_case_statement || (flags.mode === 'BlockStatement' && flags.last_word.toLowerCase() === 'switch')) {
				if ((token_text_low === 'case' && token_type === 'TK_RESERVED') || token_text_low === 'default') {
					print_newline();
					if (flags.case_body) {
						// switch cases following one another
						deindent();
						flags.case_body = false;
					}
					print_token();
					flags.in_case = true;
					flags.in_case_statement = true;
					return;
				}
			}
			if (last_type === 'TK_COMMA' || last_type === 'TK_START_EXPR' || flags.last_text === '::') {
				if (!start_of_object_property()) {
					allow_wrap_or_preserved_newline();
				}
			}

			prefix = 'NONE';

			if (last_type === 'TK_END_BLOCK') {
				if (end_of_object || !(token_type === 'TK_RESERVED' && in_array(token_text_low, ['else', 'until', 'catch', 'finally']))) {
					prefix = 'NEWLINE';
				} else {
					if (opt.brace_style === "expand" || opt.brace_style === "end-expand") {
						prefix = 'NEWLINE';
					} else {
						prefix = 'SPACE';
						output_space_before_token = true;
					}
				}
			} else if (last_type === 'TK_STRING') {
				prefix = 'SPACE';
			} else if (last_type === 'TK_RESERVED' || last_type === 'TK_WORD') {
				if (!last_text.match(/^:[^:xX]*[xX]/))
					prefix = 'SPACE';
			} else if (last_type === 'TK_START_BLOCK') {
				prefix = 'NEWLINE';
			} else if (last_type === 'TK_END_EXPR') {
				output_space_before_token = true;
				prefix = 'NEWLINE';
			} else if (n_newlines)
				prefix = 'NEWLINE';

			if (token_type === 'TK_RESERVED' && in_array(token_text_low, line_starters) && flags.last_text !== ')') {
				if (flags.last_text.match(/^else$/i)) {
					prefix = 'SPACE';
				} else if (flags.last_text.toLowerCase() === 'try' && in_array(token_text_low, ['if', 'while', 'loop', 'for', 'return'])) {
					prefix = 'SPACE';
				} else if (n_newlines && flags.last_text !== '::') {
					prefix = 'NEWLINE';
				}
			}

			if (token_type === 'TK_RESERVED' && in_array(token_text_low, ['else', 'until', 'catch', 'finally'])) {
				if (end_of_object || last_type !== 'TK_END_BLOCK' || opt.brace_style === "expand" || opt.brace_style === "end-expand") {
					if (not_add_line)
						print_newline();
				} else if ((token_text_low === 'else' && flags.last_word.toLowerCase() === 'if')
					|| (token_text_low === 'until' && flags.last_word.toLowerCase() === 'loop')
					|| (token_text_low === 'catch' && flags.last_word.toLowerCase() === 'try')
					|| (token_text_low === 'finally' && flags.last_word.match(/^(catch|try)$/i))) {
					trim_output(true);
					let line = output_lines[output_lines.length - 1];
					// If we trimmed and there's something other than a close block before us
					// put a newline back in.  Handles '} // comment' scenario.
					if (line.text[line.text.length - 1] !== '}') {
						print_newline();
					}
					output_space_before_token = true;
				} else
					restore_mode();
			} else if (prefix === 'NEWLINE') {
				if (flags.had_comment) {
					print_newline();
				} else if (last_type === 'TK_RESERVED' && is_special_word(flags.last_text)) {
					// no newline between 'return nnn'
					output_space_before_token = true;
				} else if (last_type !== 'TK_END_EXPR') {
					if ((last_type !== 'TK_START_EXPR' || !(token_type === 'TK_RESERVED' && in_array(token_text_low, ['local', 'static', 'global']))) && flags.last_text !== ':') {
						// no need to force newline on 'let': for (let x = 0...)
						if (token_type === 'TK_RESERVED' && token_text_low === 'if' && flags.last_word.match(/^else$/i) && flags.last_text !== '{') {
							// no newline for } else if {
							output_space_before_token = true;
						} else {
							print_newline();
						}
					}
				} else if (token_type === 'TK_RESERVED' && in_array(token_text_low, line_starters) && flags.last_text !== ')') {
					print_newline();
				}
				// } else if (is_array(flags.mode) && flags.last_text === ',' && last_last_text === '}') {
				//     print_newline(); // }, in lists get a newline treatment
			} else if (prefix === 'SPACE') {
				output_space_before_token = true;
			} else if (is_array(flags.mode) && just_added_newline())
				print_token_line_indentation();

			if (prefix === 'NONE' && !just_added_newline() && (flags.had_comment)) {
				print_newline();
			}
			print_token();
			flags.last_word = token_text;

			if (token_type === 'TK_RESERVED') {
				switch (token_text_low) {
					case 'loop':
						flags.do_block = true;
						break;
					case 'if':
						flags.if_block = true;
						break;
					case 'else':
						output_space_before_token = true;
						break;
					case 'until':
						indent();
						break;
				}
			}
		}

		function handle_string() {
			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
				// One difference - strings want at least a space before
				output_space_before_token = true;
			} else if (last_type === 'TK_RESERVED' || last_type === 'TK_WORD') {
				if (input_wanted_newline) {
					print_newline();
				}
				output_space_before_token = true;
			} else if (last_type === 'TK_COMMA' || last_type === 'TK_START_EXPR' || last_type === 'TK_EQUALS' || last_type === 'TK_OPERATOR') {
				if (!start_of_object_property()) {
					allow_wrap_or_preserved_newline();
				}
			} else {
				// print_newline();
				if (input_wanted_newline || flags.last_text === '{') {
					print_newline();
				}
				output_space_before_token = true;
			}
			print_token();
		}

		function handle_equals() {
			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
			}

			output_space_before_token = true;
			print_token();
			output_space_before_token = true;
		}

		function handle_comma() {
			if (flags.declaration_statement) {
				if (input_wanted_newline) {
					print_newline(false, true);
				}
				if (keep_comma_space)
					output_space_before_token = true;
				print_token();
				output_space_before_token = true;
				keep_comma_space = false;
				return;
			}

			if (last_type === 'TK_END_BLOCK' && flags.mode !== MODE.Expression) {
				print_token();
				if (flags.mode === MODE.ObjectLiteral && flags.last_text === '}') {
					print_newline();
				} else {
					output_space_before_token = true;
				}
			} else {
				if (flags.mode === MODE.ObjectLiteral ||
					(flags.mode === MODE.Statement && flags.parent.mode === MODE.ObjectLiteral)) {
					let had_comment = flags.had_comment;
					if (flags.mode === MODE.Statement) {
						restore_mode();
					}
					if (had_comment) {
						let line = output_lines[output_lines.length - 1].text, comment = [];
						if (line[line.length - 1].charAt(0) === ';') {
							comment.push(line.pop());
							while (line.length > 0 && in_array(line[line.length - 1], ['\t', ' ']))
								comment.unshift(line.pop());
							output_space_before_token = false;
						}
						print_token(), line.push(...comment);
						if (comment.length) print_newline(); else output_space_before_token = true;
					} else {
						print_token();
						if (is_next(';')) {
							print_token('\t'), print_token(get_next_token().content);
							print_newline();
						} else if (keep_Object_line) {
							output_space_before_token = true;
						} else {
							print_newline();
						}
					}
				} else {
					// EXPR or DO_BLOCK
					if (input_wanted_newline) {
						print_newline();
					}
					// if (last_type === 'TK_WORD' && in_array(flags.mode, ['BlockStatement', 'Statement']) && in_array(input.charAt(parser_pos - 2), [' ', '\t']))
					if (keep_comma_space)
						output_space_before_token = true;
					print_token();
					output_space_before_token = true;
				}
			}
			keep_comma_space = false;
		}

		function handle_operator() {
			if (token_text === ':' && flags.ternary_depth === 0 && !flags.in_case) {
				// Check if this is a BlockStatement that should be treated as a ObjectLiteral
				// if (flags.mode === MODE.BlockStatement && last_last_text === '{' && (last_type === 'TK_WORD' || last_type === 'TK_RESERVED')) {
				if (flags.mode === MODE.BlockStatement && last_last_text === '{') {
					flags.mode = MODE.ObjectLiteral, keep_Object_line = true;
					let pos = parser_pos - 1, c = '';
					while (pos >= 0 && (c = input.charAt(pos)) !== '{') {
						if (c === '\n') {
							keep_Object_line = false;
							break;
						}
						pos--;
					}
					if (keep_Object_line && output_lines.length > 1) {
						let t = output_lines.pop();
						output_lines[output_lines.length - 1].text.push(' ', t?.text.join('').trim());
					}
				}
			}

			if (start_of_statement() && token_text === '%') {
				// The conditional starts the statement if appropriate.
				switch (flags.last_word.toLowerCase()) {
					case 'try':
						if (!input_wanted_newline && in_array(token_text_low, ['if', 'while', 'loop', 'for']))
							restore_mode();
					case 'if':
					case 'catch':
					case 'finally':
					case 'else':
					case 'while':
					case 'loop':
					case 'for':
						flags.declaration_statement = true;
						break;
				}
			}

			let space_before = true;
			let space_after = true;
			if (last_type === 'TK_RESERVED' && is_special_word(flags.last_text)) {
				// "return" had a special handling in TK_WORD. Now we need to return the favor
				output_space_before_token = true;
				print_token();
				return;
			}

			if (token_text === ':' && flags.in_case) {
				flags.case_body = true;
				indent(); print_token();
				let local_pos = parser_pos, c = '';
				while (local_pos < input_length && in_array(c = input.charAt(local_pos), [' ', '\t']))
					local_pos++;
				parser_pos = local_pos;
				if (c == '\r' || c == '\n') {
					print_newline();
				} else if (c == ';') {
					// let t = get_next_token();
					// token_text = t.content; output_space_before_token = true;
					// print_token(); print_newline();
				} else output_space_before_token = true;
				flags.in_case = false;
				return;
			}

			if (token_text === '::') {
				// no spaces around exotic namespacing syntax operator
				print_token();
				return;
			}

			// http://www.ecma-international.org/ecma-262/5.1/#sec-7.9.1
			// if there is a newline between -- or ++ and anything else we should preserve it.
			if (input_wanted_newline && (token_text === '--' || token_text === '++')) {
				print_newline(false, true);
			}

			// Allow line wrapping between operators
			if (last_type === 'TK_OPERATOR') {
				allow_wrap_or_preserved_newline();
			}

			if (in_array(token_text, ['--', '++', '!', '%']) || (in_array(token_text, ['-', '+']) && (in_array(last_type, ['TK_START_BLOCK', 'TK_START_EXPR', 'TK_EQUALS', 'TK_OPERATOR']) || in_array(flags.last_text.toLowerCase(), line_starters) || flags.last_text === ','))) {
				// unary operators (and binary +/- pretending to be unary) special cases
				space_before = token_text === '!' && in_array(last_type, ['TK_WORD', 'TK_RESERVED']);
				space_after = false;

				if (last_type === 'TK_RESERVED') {
					space_before = true;
				}

				if (token_text === '%') {
					if (in_array(input.charAt(parser_pos - 2), [' ', '\t'])) {
						space_before = true;
					}
					if (in_array(input.charAt(parser_pos), [' ', '\t'])) {
						space_after = true;
					}
					if (input_wanted_newline) {
						output_space_before_token = false;
						print_newline(false, flags.declaration_statement);
					}
					else {
						output_space_before_token = output_space_before_token || space_before;
					}
					print_token();
					output_space_before_token = space_after;
					return;
				}
				if ((flags.mode === MODE.BlockStatement || flags.mode === MODE.Statement) && flags.last_text === '{') {
					// { foo; --i }
					// foo(); --bar;
					print_newline();
				}
			} else if (token_text === ':') {
				if (flags.ternary_depth === 0) {
					if (flags.mode === MODE.BlockStatement) {
						flags.mode = MODE.ObjectLiteral;
					}
					space_before = false;
				} else {
					flags.ternary_depth -= 1;
					indent();
				}
			} else if (token_text === '?') {
				flags.ternary_depth += 1;
				if (!flags.indentation_level)
					indent();
				else if (output_lines.length) {
					let line = output_lines[output_lines.length - 1].text;
					if (line[flags.indentation_level - (line[0] === preindent_string ? 0 : 1)] === indent_string)
						indent();
				}
			} else if (token_text === '&') {
				if (last_type !== 'TK_WORD' && last_type !== 'TK_END_EXPR')
					space_after = false;
				if (last_type === 'TK_COMMA' || last_type === 'TK_START_EXPR')
					space_before = false;
			} else if (token_text === '*') {
				if (flags.last_text === '(' || (last_type === 'TK_WORD' && (is_next(')') || is_next(']'))))
					space_before = space_after = false;
			} else if (flags.last_text === '{' && allIdentifierChar.test(token_text))
				space_before = false;
			else if (last_top && flags.mode === MODE.Statement && last_type === 'TK_WORD' && (token_text === '-' || token_text === '+'))
				space_after = false;
			if (input_wanted_newline) {
				output_space_before_token = false;
				print_newline(false, true);
			}
			else {
				output_space_before_token = output_space_before_token || space_before;
			}
			print_token();
			output_space_before_token = space_after;
		}

		function handle_block_comment() {
			let lines = split_newlines(token_text);
			let javadoc = lines[0].match(/^\/\*(@ahk2exe-keep|[^*]|$)/i) ? false : true;
			let remove: RegExp | string = '', t: RegExpMatchArray | null, j: number;
			if (!javadoc && (t = lines[lines.length - 1].match(/^(\s)\1*/)) && t[0] !== ' ')
				remove = new RegExp(`^${t[1]}{1,${t[0].length}}`);

			// block comment starts with a new line
			print_newline();

			// first line always indented
			print_token(lines[0]);
			for (j = 1; j < lines.length - 1; j++) {
				print_newline(false, true);
				if (javadoc) {
					print_token(' * ' + lines[j].replace(/^[\s\*]+|\s+$/g, ''));
				} else {
					print_token(lines[j].trimRight().replace(remove, ''));
				}
			}
			if (lines.length > 1) {
				print_newline(false, true);
				print_token(' ' + trim(lines[lines.length - 1]));
			}
			// for comments of more than one line, make sure there's a new line after
			print_newline(false, true);
		}

		function handle_inline_comment() {
			// print_newline(false, true);
			output_space_before_token = false, output_lines[output_lines.length - 1].text.push('\t');
			print_token();
			output_space_before_token = true;
		}

		function handle_comment() {
			if (input_wanted_newline) {
				print_newline();
			}
			if (token_type === 'TK_COMMENT' && token_text.includes('\n')) {
				let c = token_text.split('\n');
				print_token(c.shift()?.trim() || '');
				c.map(s => {
					print_newline(false, true);
					print_token(s.trim());
				});
			} else
				print_token();
		}

		function handle_dot() {
			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
			}

			if (last_type === 'TK_RESERVED' && is_special_word(flags.last_text)) {
				output_space_before_token = true;
			} else {
				// allow preserved newlines before dots in general
				// force newlines on dots after close paren when break_chained - for bar().baz()
				allow_wrap_or_preserved_newline(flags.last_text === ')' && opt.break_chained_methods);
			}
			print_token();
		}

		function handle_word2() {
			token_type = 'TK_WORD';
			handle_word();
		}

		function handle_label() {
			if (token_text_low === 'default:' && (flags.in_case_statement || (flags.mode === 'BlockStatement' && flags.last_word.toLowerCase() === 'switch'))) {
				if (flags.case_body) {
					deindent();
					flags.case_body = false;
				}
				token_text_low = 'default', token_text = token_text.substr(0, token_text.length - 1), token_type = 'TK_WORD', parser_pos = ck.offset + 7;
				print_newline();
				print_token();
				flags.in_case = true;
				flags.in_case_statement = true;
				return;
			}
			print_newline();
			print_token();
			let t = output_lines[output_lines.length - 1].text;
			if (t[0].trim() === '')
				output_lines[output_lines.length - 1].text = t.slice(1);
			else
				indent();
			token_text = '::';
		}

		function handle_unknown() {
			if (input_wanted_newline && (last_type === 'TK_HOTLINE' || !just_added_newline()))
				print_newline(n_newlines === 1);
			print_token();
			if (token_type === 'TK_HOTLINE')
				output_lines[output_lines.length - 1].text.push(input.substring(parser_pos, last_LF).trimRight()), parser_pos = last_LF + 1;
			print_newline();
		}
	}

	public getWordAtPosition(position: Position, full: boolean = false): { text: string, range: Range } {
		let start = position.character, l = position.line;
		let line = this.document.getText(Range.create(Position.create(l, 0), Position.create(l + 1, 0)));
		let len = line.length, end = start, c: number, dot = false;
		while (end < len && isIdentifierChar(line.charCodeAt(end)))
			end++;
		for (start = position.character - 1; start >= 0; start--) {
			c = line.charCodeAt(start);
			if (c === 46) {
				if (full) {
					dot = true
				} else
					break;
			} else {
				if (dot) {
					if (c === 9 || c === 32)
						continue;
					else
						dot = false;
				}
				if (!isIdentifierChar(c))
					break;
			}
		}
		if (start + 1 < end)
			return { text: line.substring(start + 1, end).replace(/\s/g, ''), range: Range.create(Position.create(l, start + 1), Position.create(l, end)) };
		return { text: '', range: Range.create(position, position) };
	}

	public searchNode(name: string, position?: Position, kind?: SymbolKind, root?: DocumentSymbol[])
		: { node: DocumentSymbol, uri: string, ref?: boolean, scope?: DocumentSymbol } | undefined | false | null {
		let node: DocumentSymbol | undefined, uri = this.uri;
		if (kind === SymbolKind.Variable || kind === SymbolKind.Class || kind === SymbolKind.Function) {
			let scope: DocumentSymbol | undefined, bak: DocumentSymbol | undefined, ref = true;
			if (position) {
				let tk = this.tokens[this.document.offsetAt(position) - name.length];
				if (tk && tk.semantic && tk.semantic.type === SemanticTokenTypes.property)
					return false;
			}
			name = name.toLowerCase();
			if (position) {
				scope = this.searchScopedNode(position);
				if (scope) {
					if (scope.kind === SymbolKind.Class && (<ClassNode>scope).extends) {
						let o = this.document.offsetAt(scope.selectionRange.end) + 1;
						let tk = this.get_tokon(o);
						while (tk.content.toLowerCase() !== 'extends') {
							o = tk.offset + tk.length;
							tk = this.get_tokon(o);
						}
						if ((tk.pos || (tk.pos = this.document.positionAt(tk.offset))).line === position.line)
							scope = undefined;
					}
					bak = scope;
				}
			}
			if (scope) {
				while (scope) {
					let dec = (<FuncNode>scope).declaration, loc = (<FuncNode>scope).local, glo = (<FuncNode>scope).global;
					if (loc && loc[name]) {
						if (loc[name].selectionRange.start.character === loc[name].selectionRange.end.character)
							return false;
						return { node: loc[name], uri };
					} else if (glo && glo[name])
						return { node: this.declaration[name] || glo[name], uri };
					else if ((<FuncNode>scope).assume === FuncScope.GLOBAL) {
						if (node = this.declaration[name])
							return { node, uri };
						return undefined;
					} else if (dec && scope.kind !== SymbolKind.Class && dec[name]) {
						if (scope.kind === SymbolKind.Method || !(<FuncNode>scope).parent)
							return { node: dec[name], uri };
						node = dec[name];
					}
					scope = (<any>scope).parent;
				}
				if (node)
					return { node, uri };
				else if (name.match(/^(this|super)$/i)) {
					scope = bak;
					while (scope && scope.kind !== SymbolKind.Class) {
						if (scope.kind === SymbolKind.Method && (<FuncNode>scope).static)
							ref = false;
						scope = (<FuncNode>scope).parent;
					}
					if (scope) {
						if (name === 'this') {
							return { node: scope, uri, ref };
						} else {
							if ((<ClassNode>scope).extends) {
								let ex = searchNode(this, (<ClassNode>scope).extends.toLowerCase(), Position.create(0, 0), SymbolKind.Class)
								if (ex)
									return { node: ex[0].node, uri: ex[0].uri, ref };
							}
						}
						return undefined;
					}
				}
				if (!scope && this.declaration[name])
					return { node: this.declaration[name], uri };
			} else if (node = this.declaration[name])
				return { node, uri };
		} else if (kind === SymbolKind.Field) {
			let scope = position ? this.searchScopedNode(position) : undefined, lbs = (<any>(scope || this)).labels;
			if (lbs) {
				if (name.substr(-1) === ':')
					name = name.slice(0, -1);
				let a = lbs[name.toLowerCase()];
				if (a && a[0].def)
					return { node: a[0], uri };
			}
			if (scope)
				return null;
		}
		return undefined;
	}

	public buildContext(position: Position, full: boolean = true) {
		let word = this.getWordAtPosition(position, full), linetext = '', t = '', pre = '', suf = '', dot = false;
		let kind: SymbolKind = SymbolKind.Variable, i = 0, j = 0, c = 0, l = 0, text = '', document = this.document;
		linetext = this.document.getText(Range.create(word.range.start.line, 0, word.range.end.line + 1, 0)).replace(/\r?\n/, '');
		if (full && (linetext.match(/^\./) || word.text.match(/^\./))) {
			i = word.range.start.character;
			l = word.range.start.line, text = word.text;
			while (l >= 0) {
				if (i > 0) {
					j = i, i--, t = linetext, c = t.charCodeAt(i);
				} else {
					l--, t = this.document.getText(Range.create(l, 0, l + 1, 0));
					let m = t.replace(/('|").*?(?<!`)\1/, '').match(/(^|\s+)(;.*|\/\*.*\*\/\s*)?[\r\n]*$/);
					j = t.length - (m ? m[0].length : 0), i = j - 1, c = t.charCodeAt(i);
				}
				while (i > 0) {
					if (c === 46) {
						dot = true;
					} else {
						if (dot) {
							if (c === 9 || c === 32) {
								i--, c = t.charCodeAt(i);
							} else
								dot = false;
						}
						if (c === 39 || c === 34)
							parsestr();
						else if (c === 37)
							parsepair(37);
						else if (c === 41)
							parsepair(40);
						else if (c === 93)
							parsepair(91);
						else if (c === 125)
							parsepair(123);
						else if (!isIdentifierChar(c)) {
							i++;
							break;
						}
					}
					i--, c = t.charCodeAt(i);
				}
				text = t.substring(i, j).replace(/\s+(?=\.\S)/g, '') + text;
				if (c !== 46) {
					word.range.start = { line: l, character: i }, word.text = text;
					linetext = this.document.getText(Range.create(word.range.start.line, 0, word.range.end.line + 1, 0));
					break;
				}
				l--;
			}
		}
		if (word.range.start.character > 0)
			pre = this.document.getText(Range.create(word.range.start.line, 0, word.range.start.line, word.range.start.character)).trim();
		suf = this.document.getText(Range.create(word.range.end.line, word.range.end.character, word.range.end.line + 1, 0));
		if (word.text.indexOf('.') === -1) {
			if (suf.match(/^\(/) || (pre.match(/^(try|else|finally|)$/i) && suf.match(/^\s*(([\w,]|[^\x00-\x7f])|$)/)))
				kind = SymbolKind.Function;
		} else if (suf.match(/^\(/) || (pre.match(/^(try|else|finally|)$/i) && suf.match(/^\s*(([\w,]|[^\x00-\x7f])|$)/)))
			kind = SymbolKind.Method;
		else
			kind = SymbolKind.Property;
		suf = suf.trimRight();
		if (word.text) {
			if (kind === SymbolKind.Function && pre.match(/^(static|)$/i)) {
				let scope = this.searchScopedNode(position);
				if (scope && scope.kind === SymbolKind.Class) {
					let fc: FuncNode | Variable, nm = word.text.toLowerCase();
					if (((fc = (<ClassNode>scope).declaration[nm]) && fc.selectionRange.start.line === position.line && fc.selectionRange.end.character >= position.character)
						|| ((fc = (<ClassNode>scope).staticdeclaration[nm]) && fc.selectionRange.start.line === position.line && fc.selectionRange.end.character >= position.character)) {
						kind = SymbolKind.Method;
						let cc = fc.full?.match(/^\(([^)]+)\)/);
						if (cc && word.text === fc.name)
							word.text = (fc.static ? cc[1] : cc[1].replace(/([^.]+)$/, '@$1')) + '.' + word.text;
					}
				}
			} else if (kind === SymbolKind.Variable) {
				if ((pre.trim() === '' && suf.match(/^:($|\s)/)) || pre.match(/(?<!\.)\b(goto|break|continue)(\(\s*['"]|\s*)$/i))
					kind = SymbolKind.Field;
				else if (pre.trim() === '' && suf.match(/^:\s*(\s;.+)?$/)) {
					let scope = this.searchScopedNode(position), nn = word + ':';
					for (const it of scope ? scope.children || [] : this.children)
						if (it.kind === SymbolKind.Field && it.name.toLowerCase() === nn) {
							kind = SymbolKind.Field;
							break;
						}
				} else {
					let scope = this.searchScopedNode(position);
					if (scope && scope.kind === SymbolKind.Class) {
						let fc: FuncNode | Variable, nm = word.text.toLowerCase();
						if (((fc = (<ClassNode>scope).declaration[nm]) && fc.selectionRange.start.line === position.line && fc.selectionRange.end.character >= position.character && fc.selectionRange.start.character <= position.character)
							|| ((fc = (<ClassNode>scope).staticdeclaration[nm]) && fc.selectionRange.start.line === position.line && fc.selectionRange.end.character >= position.character && fc.selectionRange.start.character <= position.character)) {
							kind = SymbolKind.Property;
							let cc = fc.full?.match(/^\(([^)]+)\)/);
							if (cc && word.text === fc.name)
								word.text = (fc.static ? cc[1] : cc[1].replace(/([^.]+)$/, '@$1')) + '.' + word.text;
						}
					}
				}
			}
		}
		return { text: word.text, range: word.range, kind, pre, suf, linetext };

		function parsestr() {
			if (t.substring(0, i).match(/^\s*\)['"]$/)) {

			} else {
				let q = c;
				while (i > 0) {
					i--, c = t.charCodeAt(i);
					if (c === q && (i === 0 || t.charCodeAt(i - 1) !== 96))
						break;
				}
			}
		}
		function parsepair(end: number) {
			let beg = end === 40 ? 41 : end === 123 ? 125 : end === 91 ? 93 : 37, num = 0;
			while (l >= 0) {
				while (i > 0) {
					if (c === end) {
						if ((--num) <= 0)
							return;
					} else if (c === beg)
						num++;
					else {
						switch (c) {
							case 34:
							case 39:
								parsestr();
								break;
							case 37:
								parsepair(37);
								break;
							case 41:
								parsepair(40);
								break;
							case 93:
								parsepair(91);
								break;
							case 125:
								parsepair(123);
								break;
						}
					}
					i--, c = t.charCodeAt(i);
				}
				if (c === end && (--num) <= 0)
					return;
				text = ' ' + t.substring(i, j).replace(/\s+(?=\.\S)/g, '') + text;
				l--, t = document.getText(Range.create(l, 0, l + 1, 0));
				let m = t.replace(/('|").*?(?<!`)\1/, '').match(/(^|\s+)(;.*)?[\r\n]*$/);
				j = t.length - (m ? m[0].length : 0), i = j - 1, c = t.charCodeAt(i);
			}
		}
	}

	public getNodeAtPosition(position: Position): DocumentSymbol | undefined {
		let node: DocumentSymbol | undefined, context = this.buildContext(position);
		if (context) {
			let t = this.searchNode(context.text.toLowerCase(), context.range.end, context.kind);
			if (t)
				node = t.node;
		}
		return node;
	}

	public searchScopedNode(position: Position, root?: DocumentSymbol[]): DocumentSymbol | undefined {
		let { line, character } = position, its: DocumentSymbol[] | undefined = undefined, it: DocumentSymbol | undefined;
		if (!root)
			root = this.children;
		for (const item of root) {
			if (line < item.range.start.line)
				continue;
			else if (line === item.range.start.line) {
				if (line === item.range.end.line) {
					if (character <= item.selectionRange.end.character || character > item.range.end.character)
						continue;
				} else if (character <= item.selectionRange.end.character)
					continue;
			} else if (line > item.range.end.line)
				continue;
			if (item.kind !== SymbolKind.Variable && (its = item.children))
				if (!(it = this.searchScopedNode(position, its))) return item;
		}
		return it;
	}

	public getScopeChildren(scopenode?: DocumentSymbol) {
		let p: FuncNode | undefined, nodes: DocumentSymbol[] = [], it: DocumentSymbol, vars: { [key: string]: any } = {}, _l = '';
		if (scopenode) {
			let ff = scopenode as FuncNode;
			for (const n in ff.local)
				vars[n] = ff.local[n];
			for (const n in ff.global)
				vars[n] = null;
			for (const n in ff.declaration)
				if (vars[n] === undefined)
					vars[n] = ff.declaration[n];
			p = ff.parent as FuncNode;
			if (p && p.kind === SymbolKind.Class && ff.kind === SymbolKind.Function) {
				scopenode = p;
			} else {
				while (p && p.children && (p.kind === SymbolKind.Function || p.kind === SymbolKind.Method || p.kind === SymbolKind.Property)) {
					for (const n in p.local)
						if (vars[n] === undefined)
							vars[n] = p.local[n];
					for (const n in p.global)
						if (vars[n] === undefined)
							vars[n] = null;
					for (const n in p.declaration)
						if (vars[n] === undefined)
							vars[n] = p.declaration[n];
					scopenode = p, p = p.parent as FuncNode;
				}
				if (vars[_l = scopenode.name.toLowerCase()] === undefined && (scopenode.kind !== SymbolKind.Method && scopenode.kind !== SymbolKind.Property))
					vars[_l] = scopenode;
			}
			if (scopenode.kind === SymbolKind.Method || (scopenode.kind === SymbolKind.Property && scopenode.children)) {
				if ((<FuncNode>scopenode).parent)
					scopenode = (<FuncNode>scopenode).parent;
				else
					nodes.push(DocumentSymbol.create('this', completionitem._this(), SymbolKind.Variable, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0)));
			}
			if (scopenode?.kind === SymbolKind.Class) {
				nodes.push(DocumentSymbol.create('this', completionitem._this(), SymbolKind.Variable, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0)));
				if ((<ClassNode>scopenode).extends)
					nodes.push(DocumentSymbol.create('super', completionitem._super(), SymbolKind.Variable, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0)));
			}
			return nodes.concat(Object.values(vars).filter(it => !!it));
		} else {
			for (const it of this.children) {
				if (it.kind === SymbolKind.Event) continue;
				if (it.kind === SymbolKind.Variable || it.kind === SymbolKind.Class)
					if (vars[_l = it.name.toLowerCase()]) continue; else vars[_l] = true;
				nodes.push(it);
			}
			return nodes;
		}
	}

	public initlibdirs() {
		if (inBrowser)
			return;
		const workfolder = resolve().toLowerCase();
		if (workfolder !== this.scriptpath && workfolder !== argv0.toLowerCase() && this.scriptpath.startsWith(workfolder)) {
			this.scriptdir = workfolder.replace(/\\lib$/, '');
		} else this.scriptdir = this.scriptpath.replace(/\\lib$/, '');
		this.libdirs = [this.scriptdir + '\\lib'];
		for (const t of libdirs) if (this.libdirs[0] !== t) this.libdirs.push(t);
	}

	public instrorcomm(pos: Position): number | undefined {
		let offset = this.document.offsetAt(pos), t = this.strcommpos;
		for (let o in t) {
			if (parseInt(o) > offset)
				break;
			if (t[o].end >= offset)
				return t[o].type;
		}
	}

	public colors() {
		let t = this.strcommpos, document = this.document, text = document.getText(), colors: ColorInformation[] = [];
		for (let o in t) {
			if (t[o].type === 2) {
				let a = t[o], b = parseInt(o);
				let m = colorregexp.exec(text.substring(b, a.end)), range: Range, v = '';
				if (!m || (!m[1] && a.end - b + 1 !== m[2].length + 2)) continue;
				range = Range.create(document.positionAt(b += m.index + (m[1] ? m[1].length : 0)), document.positionAt(b + m[2].length));
				v = m[5] ? colortable[m[5].toLowerCase()] : m[3] === undefined ? m[2] : m[2].substring(2);
				let color: any = { red: 0, green: 0, blue: 0, alpha: 1 }, cls: string[] = ['red', 'green', 'blue'];
				if (m[4] !== undefined) cls.unshift('alpha');
				for (const i of cls) color[i] = (parseInt('0x' + v.substr(0, 2)) / 255), v = v.slice(2);
				colors.push({ range, color });
			}
		}
		return colors;
	}

	private addDiagnostic(message: string, offset: number, length?: number, severity: DiagnosticSeverity = DiagnosticSeverity.Error, arr?: Diagnostic[]) {
		let beg = this.document.positionAt(offset), end = beg;
		if (length !== undefined) end = this.document.positionAt(offset + length);
		(arr || this.diagnostics).push({ range: Range.create(beg, end), message, severity });
	}

	private addFoldingRange(start: number, end: number, kind: string = 'block') {
		let l1 = this.document.positionAt(start).line, l2 = this.document.positionAt(end).line - (kind === 'block' ? 1 : 0);
		if (l1 < l2) this.foldingranges.push(FoldingRange.create(l1, l2, undefined, undefined, kind));
	}

	private addFoldingRangePos(start: Position, end: Position, kind: string = 'block') {
		let l1 = start.line, l2 = end.line - (kind === 'block' ? 1 : 0);
		if (l1 < l2) this.foldingranges.push(FoldingRange.create(l1, l2, undefined, undefined, kind));
	}
}


export function pathanalyze(path: string, libdirs: string[], workdir: string = '') {
	let m: RegExpMatchArray | null, uri = '';

	if (path[0] === '<') {
		if (!(path = path.replace('<', '').replace('>', ''))) return;
		let search: string[] = [path + '.ahk'];
		if (m = path.match(/^((\w|[^\x00-\x7f])+)_.*/)) search.push(m[1] + '.ahk');
		for (const dir of libdirs) {
			for (const file of search)
				if (existsSync(path = dir + '\\' + file)) {
					uri = URI.file(path).toString().toLowerCase();
					return { uri, path };
				}
		}
	} else {
		while (m = path.match(/%a_(\w+)%/i)) {
			let a_ = m[1];
			if (pathenv[a_])
				path = path.replace(m[0], <string>pathenv[a_]);
			else return;
		}
		if (path.indexOf(':') === -1) path = resolve(workdir, path);
		uri = URI.file(path).toString().toLowerCase();
		return { uri, path };
	}
}

export function parseinclude(include: { [uri: string]: { path: string, raw: string } }) {
	for (const uri in include) {
		let path = include[uri].path;
		if (!(lexers[uri]) && existsSync(path)) {
			let doc = new Lexer(openFile(path));
			lexers[uri] = doc, doc.parseScript();
			parseinclude(doc.include);
			doc.relevance = getincludetable(uri).list;
		}
	}
}

export function getClassMembers(doc: Lexer, node: DocumentSymbol, staticmem: boolean = true) {
	if (node.kind !== SymbolKind.Class)
		return [];
	let v: any = {}, l = '', cl: ClassNode, tn: DocumentSymbol, mems = getmems(doc, node, staticmem);
	if (staticmem) {
		if (!v['call'] && v['__new']) {
			tn = Object.assign({}, v['__new']), tn.name = 'Call', (<any>tn).def = false;
			mems.push(v['call'] = tn);
		}
		if ((cl = ahkvars['class'] as ClassNode) && cl !== node) {
			for (l in cl.staticdeclaration)
				if (!v[l]) mems.push(v[l] = cl.staticdeclaration[l]), v[l].uri = (<any>cl).uri;
		}
	}
	if (cl = ahkvars['object'] as ClassNode) {
		for (l in cl.declaration)
			if (!v[l]) mems.push(v[l] = cl.declaration[l]), v[l].uri = (<any>cl).uri;
	}
	return mems;

	function getmems(doc: Lexer, node: DocumentSymbol, staticmem: boolean) {
		let members: DocumentSymbol[] = [], u = (<any>node).uri, l2 = '';
		if (staticmem) {
			node.children?.map(it => {
				switch (it.kind) {
					case SymbolKind.Method:
						if (!v[l = it.name.toLowerCase()]) {
							if (l === '__new') {
								if (!(<FuncNode>it).static)
									v[l] = it, (<any>it).uri = u, members.push(it);
							} else if ((<FuncNode>it).static)
								v[l] = it, (<any>it).uri = u, members.push(it);
						} else if (l === 'call' && v['call'].def === false)
							v['call'] = it;
						break;
					case SymbolKind.Property:
						if ((<Variable>it).static && !v[l = it.name.toLowerCase()])
							v[l] = it, (<any>it).uri = u, members.push(it);
						break;
					case SymbolKind.Class:
						v[it.name.toLowerCase()] = it, (<any>it).uri = u, members.push(it);
						break;
				}
			});
		} else {
			node.children?.map(it => {
				switch (it.kind) {
					case SymbolKind.Method:
						if (!(<FuncNode>it).static && !v[l = it.name.toLowerCase()])
							v[l] = it, (<any>it).uri = u, members.push(it);
						break;
					case SymbolKind.Property:
						if (!(<Variable>it).static && !v[l = it.name.toLowerCase()])
							v[l] = it, (<any>it).uri = u, members.push(it);
						break;
				}
			});
		}
		if ((l = (<ClassNode>node).extends?.toLowerCase()) && l !== (l2 = (<ClassNode>node).full.toLowerCase())) {
			let cl: any, mems: DocumentSymbol[], nd: DocumentSymbol | undefined, dc: Lexer;
			let p = l.split('.'), p2 = l2.split('.'), i = -1;
			while (p[i + 1] === p2[i + 1])
				i++;
			if (p.length > p2.length && i === p2.length - 1) {
				if (i + 1 < p.length && v[p[++i]]) {
					cl = [{ node: v[p[i]], uri: v[p[i]].uri }];
					p.splice(0, i);
				}
			} else
				cl = searchNode(doc, p[0], Position.create(0, 0), SymbolKind.Class);
			if (cl && cl.length && (nd = cl[0].node).kind === SymbolKind.Class) {
				dc = lexers[cl[0].uri] || doc;
				if (cl[0].uri && (<any>nd).uri === undefined)
					(<any>nd).uri = cl[0].uri;
				while (nd) {
					if (p.length === 1) {
						mems = getmems(dc, nd, staticmem);
						members.push(...mems);
						break;
					} else {
						mems = getmems(dc, nd, true);
						p.splice(0, 1), nd = undefined;
						for (const it of mems)
							if (it.kind === SymbolKind.Class && it.name.toLowerCase() === p[0]) {
								nd = it; break;
							}
					}
				}
			}
		}
		return members;
	}
}

export function cleardetectcache() {
	hasdetectcache = {};
}

export function detectExpType(doc: Lexer, exp: string, pos: Position, types: { [type: string]: DocumentSymbol | boolean }) {
	let nd = new Lexer(TextDocument.create('', 'ahk2', -10, '$ := ' + exp));
	searchcache = {}, nd.parseScript();
	for (const it of nd.children)
		if (it.kind === SymbolKind.Variable && it.name === '$') {
			let s = Object.keys((<Variable>it).returntypes || {}).pop();
			if (s)
				detectExp(doc, s, pos,
					nd.document.getText(Range.create(it.selectionRange.end, it.range.end))).map(tp => types[tp] = searchcache[tp] || false);
			return nd.document.getText(it.range).substring(5);
		}
}

export function detectVariableType(doc: Lexer, name: string, pos?: Position) {
	if (name.match(/^[@#]([\w.]|[^\x00-\x7f])+$/))
		return [name];
	else if (name === 'a_args')
		return ['#array'];
	else if (name.substr(0, 2) === 'a_')
		return ['#string'];
	let scope = pos ? doc.searchScopedNode(pos) : undefined, types: any = {}, ite: Variable | undefined;
	let uri = doc.uri, dec: any, tt: DocumentSymbol | undefined, list = doc.relevance, ts: string[] | undefined;
	while (scope) {
		if (scope.kind === SymbolKind.Class) {
			scope = (<ClassNode>scope).parent;
		} else {
			dec = (<FuncNode>scope).declaration;
			if (!dec || !dec[name])
				scope = (<FuncNode>scope).parent;
			else {
				if (dec[name].kind !== SymbolKind.Variable) {
					searchcache[name] = dec[name];
					return [name];
				}
				break;
			}
		}
	}
	if (!scope) {
		let ss = doc.uri;
		dec = doc.declaration;
		if (dec[name])
			tt = dec[name];
		for (const uri in list) {
			dec = lexers[uri].declaration;
			if (dec[name]) {
				if (!tt)
					tt = dec[name], ss = uri;
				else if (tt.kind === SymbolKind.Variable && dec[name].kind !== SymbolKind.Variable)
					tt = dec[name], ss = uri;
			}
		}
		if (tt) {
			if (tt.kind === SymbolKind.Variable) {
				if ((ts = tt.detail?.match(/^\s*@types?:?\s*(.*)/mi)?.[1].split(/[,|]/).map(s => s.trim().toLowerCase().replace(/([^.]+)$/, '@$1')))?.length)
					return ts;
				if (ss !== doc.uri)
					return ['#any'];
				else {
					scope = doc as unknown as DocumentSymbol;
					if ((<Variable>tt).returntypes || (<Variable>tt).ref)
						ite = tt, uri = ss;
				}
			} else {
				searchcache[tt.name.toLowerCase()] = tt;
				return [tt.name.toLowerCase()];
			}
		} else if (ahkvars[name])
			return [name];
		else
			return [];
	}
	if (scope?.children)
		for (const it of scope.children)
			if (name === it.name.toLowerCase()) {
				if (it.kind === SymbolKind.Variable || it.kind === SymbolKind.Property) {
					if (pos && (it.selectionRange.end.line > pos.line || (it.selectionRange.end.line === pos.line && it.selectionRange.start.character > pos.character)))
						break;
					if ((ts = it.detail?.match(/^\s*@types?:?\s*(.*)/mi)?.[1].split(/[,|]/).map(s => s.trim().toLowerCase().replace(/([^.]+)$/, '@$1')))?.length)
						return ts;
					if ((<Variable>it).ref || (<Variable>it).returntypes)
						ite = it;
				} else
					return [name];
			}
	if (ite) {
		if (ite.ref) {
			let res = getFuncCallInfo(doc, ite.selectionRange.start);
			if (res) {
				let n = searchNode(doc, res.name, ite.selectionRange.end, SymbolKind.Variable);
				if (n) {
					let nn = n[0].node;
					if (nn === ahkvars['regexmatch']) {
						if (res.index = 2)
							return ['#regexmatchinfo'];
					} else if (ahkvars[res.name] === nn)
						return ['#number'];
				}
			}
			return [];
		} else {
			let fullexp = doc.document.getText(Range.create(ite.selectionRange.end, ite.range.end));
			let s = Object.keys((<Variable>ite).returntypes || {}).pop() || '';
			detectExp(doc, s.toLowerCase(), ite.range.end, fullexp).map(tp => types[tp] = true);
			if (types['#func'])
				searchcache['#return'] = { exp: fullexp, pos: ite.range.end, doc };
		}
	}
	if (types['#any'])
		return [];
	else return Object.keys(types);
}

export function detectExp(doc: Lexer, exp: string, pos: Position, fullexp?: string): string[] {
	if (hasdetectcache[exp] !== undefined)
		return hasdetectcache[exp] || [];
	hasdetectcache[exp] = false;
	return hasdetectcache[exp] = detect(exp, pos, 0, fullexp);
	function detect(exp: string, pos: Position, deep: number = 0, fullexp?: string): string[] {
		let t: string | RegExpMatchArray | null, tps: string[] = [];
		exp = exp.replace(/#any(\(\)|\.(\w|[^\x00-\x7f])+)+/g, '#any').replace(/\b(true|false)\b/gi, '#number');
		while ((t = exp.replace(/\(((\(\)|[^\(\)])+)\)/g, (...m) => {
			let ts = detect(m[1], pos, deep + 1);
			return ts.length > 1 ? `[${ts.join(',')}]` : (ts.pop() || '#any');
		})) !== exp)
			exp = t;
		while ((t = exp.replace(/\s(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*([+\-*/&|^]|\/\/|<<|>>|\*\*)\s*(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*/g, ' #number ')) !== exp)
			exp = t;
		while ((t = exp.replace(/\s[+-]?(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s+(\.\s+)?[+-]?(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*/g, ' #string ')) !== exp)
			exp = t;
		while ((t = exp.replace(/\s(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*(~=|<|>|[<>]=|!?=?=|\b(is|in|contains)\b)\s*(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*/g, ' #number ')) !== exp)
			exp = t;
		while ((t = exp.replace(/(not|!|~|\+|-)\s*(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])/g, ' #number ')) !== exp)
			exp = t;
		while ((t = exp.replace(/(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*(\band\b|&&)\s*(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])/g, ' #number ')) !== exp)
			exp = t;
		while ((t = exp.replace(/(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*(\bor\b|\|\|)\s*(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])/g, (...m) => {
			let ts: any = {}, mt: RegExpMatchArray | null;
			for (let i = 1; i < 5; i += 3) {
				if (mt = m[i].match(/^\[([^\[\]]+)\]$/)) {
					mt[1].split(',').map(tp => ts[tp] = true);
				} else
					ts[m[i]] = true;
			}
			ts = Object.keys(ts);
			return ts.length > 1 ? `[${ts.join(',')}]` : (ts.pop() || '#void');
		})) !== exp)
			exp = t;
		while ((t = exp.replace(/(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*\?\s*(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*:\s*(([@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])/, (...m) => {
			let ts: any = {}, mt: RegExpMatchArray | null;
			for (let i = 3; i < 6; i += 2) {
				if (mt = m[i].match(/^\[([^\[\]]+)\]$/)) {
					mt[1].split(',').map(tp => ts[tp] = true);
				} else
					ts[m[i]] = true;
			}
			ts = Object.keys(ts);
			return ts.length > 1 ? `[${ts.join(',')}]` : (ts.pop() || '#void');
		})) !== exp)
			exp = t;
		if (deep === 0) {
			while (exp !== (t = exp.replace(/((\w|[@#.]|[^\x00-\x7f])+)\(\)/, (...m) => {
				let ns = searchNode(doc, m[1], exp.trim() === m[0] ? { line: pos.line, character: pos.character - exp.length } : pos, SymbolKind.Variable), s = '', ts: any = {}, c: RegExpMatchArray | null | undefined;
				if (ns) {
					ns.map(it => {
						let n = it.node as FuncNode, uri = it.uri;
						swlb:
						switch (n.kind) {
							case SymbolKind.Method:
								c = n.full.toLowerCase().match(/\(([^()]+)\)\s*([^()]+)/);
								if (c && c[1] === 'gui') {
									if (c[2] === 'add') {
										let ctls: { [key: string]: string } = { dropdownlist: 'ddl', tab2: 'tab', tab3: 'tab', picture: 'pic' };
										if (c = fullexp?.toLowerCase().match(/\.add\(\s*(('|")(\w+)\2)?/)) {
											if (c[3])
												ts['gui.@' + (ctls[c[3]] || c[3])] = true;
											else
												ts['gui.@tab'] = ts['gui.@listview'] = ts['gui.@treeview'] = ts['gui.@statusbar'] = true;
										}
									} else {
										for (const t in n.returntypes)
											ts[t] = true;
									}
									break;
								}
							case SymbolKind.Function:
								if (n === ahkvars['objbindmethod'] && (c = fullexp?.toLowerCase().match(/objbindmethod\(\s*(([\w.]|[^\x00-\x7f])+)\s*,\s*('|")([^'"]+)\3\s*[,)]/))) {
									ts[c[1] + '.' + c[4]] = true;
								} else if ((uri = (<any>n).uri || uri) && lexers[uri])
									for (const e in n.returntypes)
										detectExp(lexers[uri], e.toLowerCase(), Position.is(n.returntypes[e]) ? n.returntypes[e] : pos).map(tp => { ts[tp] = true });
								break;
							case SymbolKind.Variable:
								if (uri && lexers[uri])
									detectVariableType(lexers[uri], n.name.toLowerCase(), uri === doc.uri ? pos : undefined).map(tp => {
										if (searchcache[tp]) {
											n = searchcache[tp].node;
											if (n.kind === SymbolKind.Class || n.kind === SymbolKind.Function || n.kind === SymbolKind.Method)
												for (const e in n.returntypes)
													detect(e.toLowerCase(), Position.is(n.returntypes[e]) ? n.returntypes[e] : pos).map(tp => { ts[tp] = true });
										}
									});
								break;
							case SymbolKind.Property:
								if (uri && lexers[uri] && (s = Object.keys(n.returntypes || {}).pop() || '')) {
									let tps: any = {};
									detectExpType(lexers[uri], s, n.range.end, tps);
									if (tps['#any'])
										return '#any';
									for (const tp in tps)
										if (searchcache[tp]) {
											n = searchcache[tp].node;
											if (n.kind === SymbolKind.Class || n.kind === SymbolKind.Function || n.kind === SymbolKind.Method)
												for (const e in n.returntypes)
													detect(e.toLowerCase(), Position.is(n.returntypes[e]) ? n.returntypes[e] : pos).map(tp => { ts[tp] = true });
										} else
											return '#any';
								}
								break;
							case SymbolKind.Class:
								if ((uri = (<any>n).uri || uri) && lexers[uri])
									for (const i of getClassMembers(lexers[uri], n, true))
										if ((<any>i).def !== false && i.name.toLowerCase() === 'call') {
											let n = i as FuncNode;
											for (const e in n.returntypes)
												detect(e.toLowerCase(), Position.is(n.returntypes[e]) ? n.returntypes[e] : pos).map(tp => { ts[tp] = true });
											if (n.returntypes)
												break swlb;
											break;
										}
								if (s = Object.keys(n.returntypes || {}).pop() || '')
									ts[s] = true;
								break;
						}
					});
					if (ts['gui.@control'])
						return '[gui.@tab,gui.@listview,gui.@treeview,gui.@statusbar]';
					ts = Object.keys(ts);
					return ts.length > 1 ? `[${ts.join(',')}]` : (ts.pop() || '#void');
				}
				return '#void';
			})))
				exp = t;
		}
		let tpexp = exp.trim(), exps: string[] = [], ts: any = {};
		if (t = tpexp.match(/^\[([^\[\]]+)\]$/)) {
			let ts: any = {};
			t[1].split(',').map(tp => ts[tp] = true), tps.map(tp => ts[tp] = true);
			exps = Object.keys(ts);
		} else
			exps = [tpexp];
		if (deep)
			return exps;
		exp = exp.trim();
		for (let ex of exps) {
			if (t = ex.match(/^([@#]?)(\w|[^\x00-\x7f])+(\.[@#]?(\w|[^\x00-\x7f])+)*$/)) {
				let ll = '', ttt: any;
				if ((t[1] && !t[3]) || searchcache[ex])
					ts[ex] = true;
				else for (const n of searchNode(doc, ex, ex === exp ? { line: pos.line, character: pos.character - ex.length } : pos, SymbolKind.Variable) || []) {
					switch (n.node.kind) {
						case SymbolKind.Variable:
							detectVariableType(doc, n.node.name.toLowerCase(), n.uri === doc.uri ? pos : n.node.selectionRange.end).map(tp => ts[tp] = true);
							break;
						case SymbolKind.Property:
							if ((<Variable>n.node).returntypes) {
								let s = Object.keys((<Variable>n.node).returntypes || {}).pop();
								if (s)
									detect(s, n.node.range.end).map(tp => ts[tp] = true);
							} else if (n.node.children) {
								for (const it of n.node.children) {
									let rets = (<FuncNode>it).returntypes;
									if (it.name.toLowerCase() === 'get' && it.kind === SymbolKind.Function) {
										for (const ret in rets)
											detect(ret.toLowerCase(), Position.is(rets[ret]) ? rets[ret] : pos).map(tp => ts[tp] = true);
										break;
									}
								}
							}
							break;
						case SymbolKind.Object:
							if (ex.endsWith('.prototype'))
								ts['@' + ex.slice(0, -10)] = true;
							else
								ts['#object'] = true, searchcache[ex] = n;
							break;
						case SymbolKind.Function:
							ts[ll = n.node.name.toLowerCase()] = true, searchcache[ll] = n;
							break;
						case SymbolKind.Method:
							ttt = (<FuncNode>n.node).full.match(/^\(([^()]+)\)/);
							ll = ((ttt ? ttt[1] + '.' : '') + n.node.name).toLowerCase();
							ts[ll] = true, searchcache[ll] = n;
							break;
						case SymbolKind.Class:
							ts[ex = (n.ref ? '@' : '') + ex] = true, searchcache[ex] = n;
							break;
					}
				}
			}
		}
		ts = Object.keys(ts);
		return ts.length ? ts : ['#any'];
	}
}

export function searchNode(doc: Lexer, name: string, pos: Position | undefined, kind: SymbolKind, isstatic = true): [{ node: DocumentSymbol, uri: string, ref?: boolean }] | undefined | null {
	let node: DocumentSymbol | undefined, res: { node: DocumentSymbol, uri: string } | undefined | false | null, t: any, uri = doc.uri;
	if (kind === SymbolKind.Method || kind === SymbolKind.Property || name.indexOf('.') !== -1) {
		let p = name.split('.'), nodes = searchNode(doc, p[0], pos, SymbolKind.Class), i = 0, ps = 0;
		if (!nodes)
			return undefined;
		let { node: n, uri: u } = nodes[0];
		if (nodes[0].ref && p[0].match(/^[^@#]/))
			p[0] = '@' + p[0];
		if (n.kind === SymbolKind.Variable) {
			let tps = detectVariableType(lexers[uri], p[0].replace(/^[@#]/, ''), nodes[0].node.selectionRange.end || pos), rs: any = [], qc: DocumentSymbol[] = [];
			if (tps.length === 0) {

			} else for (const tp of tps) {
				searchNode(lexers[uri], name.replace(new RegExp('^' + p[0]), tp), pos, kind)?.map(it => {
					if (!rs.map((i: any) => i.node).includes(it.node))
						rs.push(it);
				});
			}
			if (rs.length)
				return rs;
			else return undefined;
		} else if (ps = p.length - 1) {
			let cc: DocumentSymbol | undefined, fc: FuncNode | undefined;
			while (i < ps) {
				node = undefined, i++;
				if (n.kind === SymbolKind.Function || n.kind === SymbolKind.Method) {
					fc = n as FuncNode;
					if (i <= p.length && p[i] === 'call') {
						node = n;
						continue;
					} else if (ahkvars['func'])
						n = ahkvars['func'], p[i - 1] = '@' + p[i - 1].replace(/^[@#]/, '');
				} else if (n.kind === SymbolKind.Property || n.kind === SymbolKind.Variable) {
					if (t = (<Variable>n).returntypes) {
						let tps: any = {}, r = Object.keys(t).pop(), rs: any = [];
						if (r) {
							detectExpType(lexers[(<any>n).uri || uri], r, Position.is(t[r]) ? t[r] : n.selectionRange.end, tps);
							let nm = p.slice(i).join('.');
							for (const tp in tps) {
								searchNode(lexers[uri], tp + '.' + nm, undefined, kind)?.map(it => {
									if (!rs.map((i: any) => i.node).includes(it.node))
										rs.push(it);
								});
							}
							if (rs.length)
								return rs;
							else return undefined;
						}
					}
				} else if (n.kind === SymbolKind.Object && (<Variable>n).static && n.name.toLowerCase() === 'prototype') {
					p[i - 1] = '@prototype';
					if (cc)
						n = cc;
				}
				if (n.kind === SymbolKind.Class) {
					cc = n;
					if (u && !(<any>n).uri) (<any>n).uri = u;
					let ss = isstatic && i > 0 && !p[i - 1].match(/^[@#]/), _ = p[i].replace(/[@#]/, '');
					let mem = getClassMembers(doc, n, ss);
					if (i === ps) {
						for (const it of mem) {
							if (it.kind !== SymbolKind.Variable && it.name.toLowerCase() === _) {
								node = it, uri = (<any>it).uri || '';
								break;
							}
						}
						if (!node && _ !== 'clone') {
							mem.map(it => {
								if (it.kind !== SymbolKind.Variable && it.name.toLowerCase() === '__call')
									node = it, uri = (<any>it).uri || '';
							});
						}
					} else {
						for (const it of mem) {
							if (it.kind !== SymbolKind.Variable && it.name.toLowerCase() === _) {
								node = it, uri = (<any>it).uri || '';
								break;
							}
						}
					}
					if (_ === 'clone') {
						let t = (<FuncNode>node)?.full.toLowerCase().match(/^\(([^()]+)\)\s+/), _ = (<ClassNode>n).full.toLowerCase();
						if (!t || (t[1] !== _ && ahkvars[t[1]])) {
							let rg = Range.create(0, 0, 0, 0);
							uri = '', node = FuncNode.create('Clone', SymbolKind.Method, rg, rg, [], [], true);
							(<FuncNode>node).returntypes = { [ss ? _ : _.replace(/([^.]+)$/, '@$1')]: true };
						}
					} else if (node && _ === 'bind' && fc && (<FuncNode>node).full.match(/\(func\)\s+bind\(/i)) {
						let c = Object.assign({}, node) as FuncNode, cl = fc.full.match(/^\s*\(([^()]+)\)/);
						c.returntypes = { [((cl ? cl[1] + '.' : '') + fc.name).toLowerCase()]: true };
						node = c;
					}
					fc = undefined;
				}
				if (!node) break; else n = node;
			}
		}
		if (node)
			return [{ node, uri }];
		else return undefined;
	} else if (!(res = doc.searchNode(name = name.replace(/^@/, ''), pos, kind))) {
		if (res === null)
			return undefined;
		else if (res === false)
			return null;
		res = searchIncludeNode(doc.uri, name);
	}
	if (res && res.node.kind === SymbolKind.Variable && res.node === doc.declaration[name]) {
		for (const u in doc.relevance)
			if ((t = lexers[u].declaration[name]) && t.kind !== SymbolKind.Variable)
				return [{ node: t, uri: u }];
	}
	if (kind !== SymbolKind.Field && (!res || (res.node.kind === SymbolKind.Variable && !(<Variable>res.node).def)) && ((t = ahkvars[name]) || (t = ahkvars[name.replace(/^[@#]/, '')])))
		return [{ uri: t.uri, node: t }];
	if (res)
		return [res];
	else return undefined;
	function searchIncludeNode(fileuri: string, name: string): { node: DocumentSymbol, uri: string } | undefined {
		let node: DocumentSymbol, list = lexers[fileuri].relevance;
		for (const uri in list) {
			let d = lexers[uri];
			if (!d) {
				let path = URI.parse(uri).fsPath;
				if (existsSync(path)) {
					d = lexers[uri] = new Lexer(openFile(path));
					d.parseScript();
				} else
					continue;
			}
			if (node = d.declaration[name])
				return { node, uri };
		}
		return undefined;
	}
}

export function getFuncCallInfo(doc: Lexer, position: Position) {
	let func: DocumentSymbol | undefined, offset = doc.document.offsetAt(position), off = { start: 0, end: 0 }, pos: Position = { line: 0, character: 0 };
	let scope = doc.searchScopedNode(position), funccall: DocumentSymbol[], full = '', tt: any;
	let text = '', name = '', index = -1, len = 0, o = offset;
	if (scope) {
		while (scope && !(<FuncNode>scope).funccall)
			scope = (<FuncNode>scope).parent;
		funccall = (<FuncNode>scope)?.funccall || doc.funccall;
	} else
		funccall = doc.funccall;
	for (const item of funccall) {
		const start = doc.document.offsetAt(item.range.start), end = doc.document.offsetAt(item.range.end);
		if (start + item.name.length < offset) {
			if (offset > end || offset === end && doc.document.getText(Range.create({ line: position.line, character: position.character - 1 }, position)) === ')')
				continue;
			if (!func || (off.start <= start && end <= off.end))
				func = item, off = { start, end }, pos = item.range.start;
		}
	}
	if (!func || doc.document.getText(func.range).indexOf(')(') !== -1) {
		let line = doc.document.getText(Range.create(position.line, 0, position.line + 1, 0));
		while (tt = line.match(/('|").*?(?<!`)\1/))
			line = line.replace(tt[0], '\x01'.repeat(tt[0].length));
		let t = line.match(/^(.*\(\s*(([\w.]|[^\x00-\x7f])+)\s*\))\((.*)\)/);
		if (t && (offset = position.character - t[1].length) > 0) {
			let q = 0, w = 0, e = 0, i = 0;
			loop:
			for (const c of t[4].split('')) {
				i++;
				switch (c) {
					case '(': q++; break;
					case ')': if ((--q) < 0) break loop; break;
					case '[': w++; break;
					case ']': w--; break;
					case '{': e++; break;
					case '}': e--; break;
				}
			}
			if (w === 0 && e === 0 && q <= 0 && position.character < t[1].length + i + (q === 0 ? 2 : 1)) {
				pos.line = position.line, pos.character = offset;
				text = t[2] + '(' + t[4].substr(0, i) + (q === 0 ? ')' : ''), name = full = t[2].toLowerCase();
				len = text.length - name.length, offset += name.length, name = name.split('.').pop() || '';
				if (name === full)
					full = '';
			}
		}
	}
	if (name) {
	} else if (func) {
		text = doc.document.getText(func.range), name = func.name.toLowerCase(), full = '';
		offset = o - off.start, index = -1, len = off.end - off.start - name.length;
	} else
		return undefined;
	while (tt = text.match(/('|").*?(?<!`)\1/))
		text = text.replace(tt[0], '_'.repeat(tt[0].length));
	for (const pair of [['\\{', '\\}'], ['\\[', '\\]'], ['\\(', '\\)']]) {
		const rg = new RegExp(pair[0] + '[^' + pair[0] + ']*?' + pair[1]);
		while (tt = rg.exec(text)) {
			if (tt[0].length >= len)
				break;
			text = text.replace(tt[0], '_'.repeat(tt[0].length));
		}
	}
	if (offset > name.length)
		index += 1;
	for (let i = name.length + 1; i < offset; i++)
		if (text.charAt(i) === ',')
			index++;
		else if (text.charAt(i) === ')' && i >= text.length - 1) {
			index = -1; break;
		}
	return { name, pos, index, full };
}

export function getincludetable(fileuri: string): { count: number, list: { [uri: string]: any }, main: string } {
	let list: { [uri: string]: any } = {}, count = 0, has = false, doc: Lexer, res: any = { list, count, main: '' };
	for (const uri in lexers) {
		list = {}, count = 0, has = (uri === fileuri);
		traverseinclude(lexers[uri].include, uri);
		if (has && count > res.count)
			res = { list, count, main: uri };
	}
	if (res.count) {
		delete res.list[fileuri];
		if (res.main && res.main !== fileuri)
			res.list[res.main] = res.list[res.main] || { raw: res.main.replace(/^.*\/([^/]+)$/, '$1'), path: URI.parse(res.main).fsPath };
	}
	return res;
	function traverseinclude(include: any, cururi: string) {
		for (const uri in include) {
			if (fileuri === uri) {
				has = true;
				if (!list[cururi])
					list[cururi] = include[cururi] || { path: URI.parse(cururi).fsPath, raw: '' }, count++;
			}
			if (!list[uri] && (doc = lexers[uri])) {
				list[uri] = include[uri], count++;
				if (cururi !== uri)
					traverseinclude(doc.include, uri);
			}
		}
	}
}

export function formatMarkdowndetail(detail: string, name?: string): string {
	let params: { [name: string]: string[] } = {}, details: string[] = [], lastparam = '', m: RegExpMatchArray | null;
	if (name === undefined) {
		return detail.replace(/^@((param|参数)\s+(\S+)|\S+):?/gm, (...m) => {
			if (m[3])
				return `\n*@param* \`${m[3]}\` — `;
			else
				return `\n*@${m[1]}* — `;
		});
	} else {
		detail.split('\n').map(line => {
			if (m = line.match(/^@(param|参数)\s+(\S+)([\s|:]\s*(.*))?$/i))
				params[lastparam = m[2].toLowerCase()] = [m[4]];
			else if (lastparam && line.charAt(0) !== '@')
				params[lastparam].push(line);
			else
				lastparam = '', details.push(line.replace(/^(@\S+):?/, '\n*$1* — '));
		});
		return (params[name = name.toLowerCase()] ? params[name].join('\n') + '\n\n' : '') + details.join('\n');
	}
}

export function samenameerr(a: DocumentSymbol, b: DocumentSymbol): string {
	if (a.kind === b.kind) {
		if (a.kind === SymbolKind.Class)
			return diagnostic.conflictserr('class', 'Class', a.name);
		else if (a.kind === SymbolKind.Function)
			return diagnostic.conflictserr('function', 'Func', a.name);
		return diagnostic.dupdeclaration();
	} else {
		switch (b.kind) {
			case SymbolKind.Variable:
				return diagnostic.assignerr(a.kind === SymbolKind.Function ? 'Func' : 'Class', a.name);
			case SymbolKind.Function:
				if (a.kind === SymbolKind.Variable)
					return diagnostic.funcassignerr();
				return diagnostic.conflictserr('function', 'Class', a.name);
			case SymbolKind.Class:
				if (a.kind === SymbolKind.Function)
					return diagnostic.conflictserr('class', 'Func', a.name);
				else if (a.kind === SymbolKind.Property || a.kind === SymbolKind.Method)
					return diagnostic.dupdeclaration();
			case SymbolKind.Property:
			case SymbolKind.Method:
				return diagnostic.dupdeclaration();
		}
		return '';
	}
}

export function checksamenameerr(decs: { [name: string]: DocumentSymbol }, arr: DocumentSymbol[], diags: any) {
	let _low = '';
	for (const it of arr) {
		switch (it.kind) {
			case SymbolKind.Class:
			case SymbolKind.Function:
			case SymbolKind.Variable:
				if (!decs[_low = it.name.toLowerCase()]) {
					decs[_low] = it;
				} else if ((<any>decs[_low]).infunc) {
					if (it.kind === SymbolKind.Variable) {
						if ((<Variable>it).def && decs[_low].kind !== SymbolKind.Variable) {
							diags.push({ message: diagnostic.assignerr(decs[_low].kind === SymbolKind.Function ? 'Func' : 'Class', it.name), range: it.selectionRange, severity: DiagnosticSeverity.Error });
							continue;
						}
					} else if ((<Variable>decs[_low]).def)
						diags.push({ message: diagnostic.assignerr(it.kind === SymbolKind.Function ? 'Func' : 'Class', it.name), range: decs[_low].selectionRange, severity: DiagnosticSeverity.Error });
					else if (decs[_low].kind === SymbolKind.Function) {
						diags.push({ message: samenameerr(decs[_low], it), range: it.selectionRange, severity: DiagnosticSeverity.Error });
						continue;
					}
					decs[_low] = it;
				} else if (it.kind === SymbolKind.Variable) {
					if (decs[_low].kind === SymbolKind.Variable) {
						if ((<Variable>it).def && !(<Variable>decs[_low]).def)
							decs[_low] = it;
					} else if ((<Variable>it).def)
						diags.push({ message: samenameerr(decs[_low], it), range: it.selectionRange, severity: DiagnosticSeverity.Error });
				} else {
					if (decs[_low].kind === SymbolKind.Variable) {
						if ((<Variable>decs[_low]).def)
							diags.push({ message: samenameerr(it, decs[_low]), range: decs[_low].selectionRange, severity: DiagnosticSeverity.Error });
						decs[_low] = it;
					} else if ((<Variable>decs[_low]).def !== false)
						diags.push({ message: samenameerr(decs[_low], it), range: it.selectionRange, severity: DiagnosticSeverity.Error });
				}
				break;
		}
	}
}