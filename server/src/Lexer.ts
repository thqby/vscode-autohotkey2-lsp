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
import { builtin_ahkv1_commands, builtin_variable, builtin_variable_h } from './constants';
import { completionitem, diagnostic } from './localize';
import { ahkvars, extsettings, inBrowser, isahk2_h, lexers, libdirs, openFile, pathenv } from './common';

export interface ParamInfo {
	count: number
	comma: number[]
	miss: number[]
	unknown: boolean
}

export interface CallInfo extends DocumentSymbol {
	offset?: number
	paraminfo?: ParamInfo
}

export interface AhkDoc {
	include: string[]
	children: DocumentSymbol[]
	funccall: CallInfo[]
}

export enum FuncScope {
	DEFAULT = 0, STATIC = 1, GLOBAL = 2
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
	number
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
	hasref: boolean
	parent?: DocumentSymbol
	funccall?: CallInfo[]
	labels: { [key: string]: DocumentSymbol[] }
	declaration: { [name: string]: FuncNode | ClassNode | Variable };
	returntypes?: { [exp: string]: any }
}

export interface ClassNode extends DocumentSymbol {
	full: string
	extends: string
	parent?: DocumentSymbol
	funccall: CallInfo[]
	declaration: { [name: string]: FuncNode | Variable };
	staticdeclaration: { [name: string]: FuncNode | ClassNode | Variable };
	cache: DocumentSymbol[]
	returntypes?: { [exp: string]: any }
}

export interface Variable extends DocumentSymbol {
	ref?: boolean
	static?: boolean | null
	def?: boolean
	arr?: boolean
	defaultVal?: string | false | null
	full?: string
	returntypes?: { [exp: string]: any }
	range_offset?: [number, number]
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
	topofline: number
	next_token_offset: number	// Next non-comment token offset
	previous_token?: Token		// Previous non-comment token
	previous_pair_pos?: number
	next_pair_pos?: number
	prefix_is_whitespace?: string
	ignore?: boolean
	semantic?: SemanticToken
	pos?: Position
	callinfo?: CallInfo
	data?: any
	symbol?: DocumentSymbol
	skip_pos?: number
	previous_extra_tokens?: { i: number, len: number, parser_pos: number, tokens: Token[], suffix_is_whitespace: boolean }
}

export interface FormatOptions {
	break_chained_methods?: boolean
	ignore_comment?: boolean
	indent_string?: string
	keep_array_indentation?: boolean
	max_preserve_newlines?: number
	one_true_brace?: number
	preserve_newlines?: boolean
	space_before_conditional?: boolean
	space_in_empty_paren?: boolean
	space_in_other?: boolean
	space_in_paren?: boolean
	wrap_line_length?: number
}

export namespace SymbolNode {
	export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range, children?: DocumentSymbol[]): DocumentSymbol {
		return { name, kind, range, selectionRange, children };
	}
}

export namespace FuncNode {
	export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range, params: Variable[], children?: DocumentSymbol[], isstatic?: boolean): FuncNode {
		let full = '', ps: Variable[] = [], hasref = false;
		(<any>params).format?.(params);
		params.map(param => {
			if (param.name !== '*') ps.push(param);
			full += ', ' + (param.ref ? (hasref = true, '&') : '') + param.name + (param.defaultVal ? ' := ' + param.defaultVal : param.arr ? '*' : param.defaultVal === null ? '?' : '');
		});
		full = (isstatic ? 'static ' : '') + name + '(' + full.substring(2) + ')', params = ps;
		return { assume: FuncScope.DEFAULT, static: isstatic, hasref, name, kind, range, selectionRange, params, full, children, funccall: [], declaration: {}, global: {}, local: {}, labels: {} };
	}
}

namespace Variable {
	export function create(name: string, kind: SymbolKind, range: Range): Variable {
		return { name, kind, range, selectionRange: range };
	}
}

export function isIdentifierChar(code: number) {
	if (code < 48) return false;
	if (code < 58) return true;
	if (code < 65) return false;
	if (code < 91) return true;
	if (code < 97) return code === 95;
	if (code < 123) return true;
	return code > 127;
}
export let allIdentifierChar = new RegExp('^[^\x00-\x2f\x3a-\x40\x5b\x5c\x5d\x5e\x60\x7b-\x7f]+$');
let commentTags = new RegExp('^;;\\s*(?<tag>.+)');

const colorregexp = new RegExp(/(?<=['"\s])(c|background|#)?((0x)?[\da-f]{6}([\da-f]{2})?|(black|silver|gray|white|maroon|red|purple|fuchsia|green|lime|olive|yellow|navy|blue|teal|aqua))\b/i);
const colortable = JSON.parse('{ "black": "000000", "silver": "c0c0c0", "gray": "808080", "white": "ffffff", "maroon": "800000", "red": "ff0000", "purple": "800080", "fuchsia": "ff00ff", "green": "008000", "lime": "00ff00", "olive": "808000", "yellow": "ffff00", "navy": "000080", "blue": "0000ff", "teal": "008080", "aqua": "00ffff" }');
const whitespace = " \t\r\n", punct = '+ - * / % & ++ -- ** // = += -= *= /= //= .= == := != !== ~= > < >= <= >>> >> << >>>= >>= <<= && &= | || ! ~ , ?? : ? ^ ^= |= =>'.split(' ');
const line_starters = 'try,throw,return,global,local,static,if,switch,case,for,while,loop,continue,break,goto'.split(',');
const reserved_words = line_starters.concat(['class', 'in', 'is', 'isset', 'contains', 'else', 'until', 'catch', 'finally', 'and', 'or', 'not', 'as', 'super']);
const MODE = { BlockStatement: 'BlockStatement', Statement: 'Statement', ObjectLiteral: 'ObjectLiteral', ArrayLiteral: 'ArrayLiteral', Conditional: 'Conditional', Expression: 'Expression' };
const KEYS_RE = /^(alttab|alttabandmenu|alttabmenu|alttabmenudismiss|shiftalttab|shift|lshift|rshift|alt|lalt|ralt|control|lcontrol|rcontrol|ctrl|lctrl|rctrl|lwin|rwin|appskey|lbutton|rbutton|mbutton|wheeldown|wheelup|wheelleft|wheelright|xbutton1|xbutton2|joy1|joy2|joy3|joy4|joy5|joy6|joy7|joy8|joy9|joy10|joy11|joy12|joy13|joy14|joy15|joy16|joy17|joy18|joy19|joy20|joy21|joy22|joy23|joy24|joy25|joy26|joy27|joy28|joy29|joy30|joy31|joy32|joyx|joyy|joyz|joyr|joyu|joyv|joypov|joyname|joybuttons|joyaxes|joyinfo|space|tab|enter|escape|esc|backspace|bs|delete|del|insert|ins|pgdn|pgup|home|end|up|down|left|right|printscreen|ctrlbreak|pause|scrolllock|capslock|numlock|numpad0|numpad1|numpad2|numpad3|numpad4|numpad5|numpad6|numpad7|numpad8|numpad9|numpadmult|numpadadd|numpadsub|numpaddiv|numpaddot|numpaddel|numpadins|numpadclear|numpadleft|numpadright|numpaddown|numpadup|numpadhome|numpadend|numpadpgdn|numpadpgup|numpadenter|f1|f2|f3|f4|f5|f6|f7|f8|f9|f10|f11|f12|f13|f14|f15|f16|f17|f18|f19|f20|f21|f22|f23|f24|browser_back|browser_forward|browser_refresh|browser_stop|browser_search|browser_favorites|browser_home|volume_mute|volume_down|volume_up|media_next|media_prev|media_stop|media_play_pause|launch_mail|launch_media|launch_app1|launch_app2|vk[a-f\d]{1,2}(sc[a-f\d]+)?|sc[a-f\d]+|`[;{]|[\x21-\x3A\x3C-\x7E])$/i;
const EMPTY_TOKEN: Token = { type: '', content: '', offset: 0, length: 0, topofline: 0, next_token_offset: -1 };

let searchcache: { [name: string]: any } = {};
let hasdetectcache: { [exp: string]: any } = {};

class ParseStopError {
	public message: string;
	public token: Token;
	constructor(message: string, token: Token) {
		this.message = message;
		this.token = token;
	}
}

export class Lexer {
	public actived = false;
	public beautify: (options?: FormatOptions, range?: Range) => string;
	public children: DocumentSymbol[] = [];
	public d = 0;
	public declaration: { [name: string]: FuncNode | ClassNode | Variable } = {};
	public diagnostics: Diagnostic[] = [];
	public diags = 0;
	public document: TextDocument;
	public foldingranges: FoldingRange[] = [];
	public funccall: CallInfo[] = [];
	public get_token: (offset?: number, ignorecomment?: boolean) => Token;
	public find_token: (offset: number, ignore?: boolean) => Token;
	public include: { [uri: string]: string } = {};
	public includedir: Map<number, string> = new Map();
	public dlldir: Map<number, string> = new Map();
	public dllpaths: string[] = [];
	public labels: { [key: string]: DocumentSymbol[] } = {};
	public libdirs: string[] = [];
	public object: { method: { [key: string]: FuncNode[] }, property: { [key: string]: any }, userdef: { [key: string]: FuncNode } } = { method: {}, property: {}, userdef: {} };
	public parseScript: () => void;
	public reflat = false;
	public isparsed = false;
	public relevance: { [uri: string]: string } | undefined;
	public scriptdir = '';
	public scriptpath = '';
	public tokens: { [offset: number]: Token } = {};
	public STB: SemanticTokensBuilder = new SemanticTokensBuilder;
	public linepos: { [line: number]: number } = {};
	public strcommpos: { start: number, end: number, type: 1 | 2 | 3 }[] = [];
	public texts: { [key: string]: string } = {};
	public uri = '';
	private anonymous: FuncNode[] = [];
	constructor(document: TextDocument, scriptdir?: string, d = 0) {
		let input: string, output_lines: { text: string[], indent: number }[], flags: any, opt: FormatOptions, previous_flags: any, prefix: string, flag_store: any[], includetable: { [uri: string]: string };
		let token_text: string, token_text_low: string, token_type: string, last_type: string, last_text: string, last_last_text: string, indent_string: string, includedir: string, dlldir: string;
		let parser_pos: number, customblocks: { region: number[], bracket: number[] }, _this = this, h = isahk2_h, filepath = '', sharp_offsets: number[] = [];
		let input_wanted_newline: boolean, output_space_before_token: boolean, is_conditional: boolean, keep_object_line: boolean, begin_line: boolean;
		let continuation_sections_mode: boolean, space_in_other: boolean;
		let input_length: number, n_newlines: number, last_LF: number, preindent_string: string, lst: Token, ck: Token;
		let comments: { [line: number]: Token } = {}, block_mode = true, format_mode = false, string_mode = false;
		let handlers: { [index: string]: () => void } = {
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
			'TK_HOT': handle_sharp,
			'TK_SHARP': handle_sharp,
			'TK_NUMBER': handle_number,
			'TK_LABEL': handle_label,
			'TK_HOTLINE': handle_sharp,
			'TK_UNKNOWN': handle_unknown
		};

		this.document = document;
		if (document.uri) {
			this.scriptpath = (filepath = URI.parse(this.uri = document.uri.toLowerCase()).fsPath).replace(/\\[^\\]+$/, '');
			this.initlibdirs(scriptdir);
		}

		this.get_token = function (offset?: number, ignorecomment = false): Token {
			let p = parser_pos, t: Token, b: Token;
			if (offset !== undefined) {
				parser_pos = offset, b = lst;
				do {
					t = get_next_token();
				} while (ignorecomment && t.type.endsWith('COMMENT'));
				parser_pos = p, lst = b;
			} else do {
				t = get_next_token();
			} while (ignorecomment && t.type.endsWith('COMMENT'));
			return t;
		}

		this.find_token = function (offset: number, ignore = false): Token {
			let i = offset, c = input.charAt(offset), tks = _this.tokens, tk: Token;
			let eof = { type: 'TK_EOF', content: '', offset: input_length, length: 0, next_token_offset: -1, topofline: 1 };
			if (!c)
				return eof;
			if (whitespace.includes(c)) {
				while (whitespace.includes(c = input.charAt(++i) || '\0'))
					continue;
				if (tk = tks[i])
					return tk;
				if (c === '\0') {
					if (tk = tks[_this.strcommpos[_this.strcommpos.length - 1].start])
						if (i === tk.offset + tk.length)
							return tk;
					return eof;
				}
			} else {
				if (tk = tks[i])
					return tk;
				if (isIdentifierChar(c.charCodeAt(0))) {
					while (isIdentifierChar(input.charCodeAt(--i)))
						continue;
				} else {
					while (!whitespace.includes(c = input.charAt(--i)))
						if (isIdentifierChar(c.charCodeAt(0)))
							break;
				}
				if (tk = tks[++i]) {
					if (offset >= tk.offset && offset < tk.offset + tk.length)
						return tk;
					while (tk = tks[tk.next_token_offset]) {
						if (tk.offset > offset)
							break;
						if (offset < tk.offset + tk.length)
							return tk;
					}
				}
			}
			if (ignore)
				return eof;
			return tks[_this.strcommpos.find(it => offset >= it.start && it.end >= offset)?.start as number] ?? eof;
		}

		this.beautify = function (options?: FormatOptions, range?: Range) {
			let sweet_code: string, end_pos: number;
			if (!_this.isparsed)
				_this.parseScript();

			opt = Object.assign({
				break_chained_methods: false,
				ignore_comment: false,
				indent_string: '\t',
				keep_array_indentation: true,
				max_preserve_newlines: 3,
				preserve_newlines: true,
				space_before_conditional: true,
				space_in_empty_paren: false,
				space_in_other: true,
				space_in_paren: false,
				wrap_line_length: 0
			} as FormatOptions, options);
			if (isNaN(opt.one_true_brace = Number(opt.one_true_brace)))
				delete opt.one_true_brace;

			last_type = last_last_text = last_text = '', begin_line = true, lst = EMPTY_TOKEN;
			last_LF = -1, end_pos = input_length, ck = _this.get_token(0);
			preindent_string = input.substring(input.lastIndexOf('\n', parser_pos = ck.offset) + 1, parser_pos);
			is_conditional = output_space_before_token = false, format_mode = true;
			indent_string = opt.indent_string ?? '\t', space_in_other = opt.space_in_other ?? true;
			output_lines = [create_output_line()], flag_store = [], flags = null, set_mode(MODE.BlockStatement);

			if (range) {
				end_pos = _this.document.offsetAt(range.end);
				ck = _this.find_token(_this.document.offsetAt(range.start));
				range.start = _this.document.positionAt(parser_pos = ck.offset);
				preindent_string = input.substring(input.lastIndexOf('\n', parser_pos) + 1, parser_pos).replace(/\S.*$/, '');
			}

			while (true) {
				token_type = (ck = get_next_token()).type;
				token_text_low = (token_text = ck.content).toLowerCase();

				if (ck.offset >= end_pos) {
					if (range) {
						let pt = ck.previous_token, end = parser_pos;
						if (last_type === 'TK_RESERVED' && ['try', 'else', 'finally'].includes(last_text))
							indent();
						if (!flags.declaration_statement || !just_added_newline())
							print_newline();
						if (pt) {
							if (flags.had_comment)
								while ((ck = _this.find_token(pt.offset + pt.length)).offset < end_pos)
									pt = ck;
							for (end = pt.offset + pt.length; ' \t'.includes(input.charAt(end) || '\0'); end++);
							if (!whitespace.includes(input.charAt(end)))
								end = pt.offset + pt.length;
							while (just_added_newline())
								output_lines.pop();
						}
						range.end = _this.document.positionAt(end);
						(range as any).indent_string = preindent_string + indent_string.repeat(flags.indentation_level);
					}
					while (flags.mode === MODE.Statement)
						restore_mode();
					break;
				} else if (is_conditional &&
					!(is_conditional = n_newlines ? !conditional_is_end(ck) :
						token_type !== 'TK_START_BLOCK' || ck.data)) {
					restore_mode();
					last_type = 'TK_END_EXPR';
					flags.last_text = ')';
					input_wanted_newline = n_newlines > 0;
				} else if (input_wanted_newline = n_newlines > 0) {
					if (continuation_sections_mode) {
						print_newline();
						for (let i = 1; i < n_newlines; i++)
							output_lines.push(create_output_line());
					} else if (!is_conditional && !flags.in_expression) {
						if ((ck.type.endsWith('COMMENT') || !is_line_continue(flags.mode === MODE.Statement ? ck.previous_token ?? EMPTY_TOKEN : {} as Token, ck)) &&
							!(last_type === 'TK_RESERVED' && ['catch', 'else', 'finally', 'until'].includes(last_text))) {
							if (opt.max_preserve_newlines && n_newlines > opt.max_preserve_newlines)
								n_newlines = opt.max_preserve_newlines;

							if (!just_added_newline())
								output_lines.push(create_output_line());
							for (let i = 1; i < n_newlines; i++)
								output_lines.push(create_output_line());
						}
					}
				}

				handlers[token_type]();

				if (!token_type.endsWith('COMMENT')) {
					if (!is_conditional && token_type === 'TK_RESERVED' && ['if', 'for', 'while', 'loop', 'catch', 'switch'].includes(token_text_low)) {
						is_conditional = true;
						set_mode(MODE.Conditional);
						if (token_text_low !== 'switch')
							indent();
					}
					last_last_text = flags.last_text;
					flags.last_text = token_text_low;
					flags.had_comment = 0;
					last_type = token_type;
					last_text = token_text_low;
				}
			}

			sweet_code = output_lines.map(line => line.text.join('')).join('\n');
			output_lines = [], format_mode = false;
			return sweet_code;

			function conditional_is_end(tk: Token) {
				if (![MODE.Conditional, MODE.Statement].includes(flags.mode) || flags.parent.mode === MODE.ObjectLiteral)
					return false;
				switch (tk.type) {
					case 'TK_DOT':
					case 'TK_COMMA':
					case 'TK_EQUALS':
					case 'TK_COMMENT':
					case 'TK_INLINE_COMMENT':
					case 'TK_BLOCK_COMMENT':
						return false;
					case 'TK_OPERATOR':
						return Boolean(tk.content.match(/^(!|~|not|%|\+\+|--)$/i));
					case 'TK_STRING':
						return !tk.ignore;
					default:
						let lk = tk.previous_token as Token;
						switch (lk.type) {
							case 'TK_COMMA':
							case 'TK_EQUALS':
								return false;
							case 'TK_OPERATOR':
								return Boolean(lk.content.match(/^(\+\+|--|%)$/));
						}
				}
				return true;
			}
		};

		function format_params_default_val(tokens: { [offset: number]: Token }, params: Variable[]) {
			opt = { keep_array_indentation: true, max_preserve_newlines: 1 };
			space_in_other = true, indent_string = '\t';
			delete (<any>params).format;
			format_mode = true, preindent_string = '';
			for (let param of params) {
				if (!param.range_offset)
					continue;
				let [start, end] = param.range_offset;
				delete param.range_offset;
				last_type = last_last_text = last_text = '', output_lines = [create_output_line()];
				output_space_before_token = false, flag_store = [], flags = null, set_mode(MODE.Expression);
				for (ck = tokens[tokens[start].next_token_offset]; ck && ck.offset < end; ck = tokens[ck.next_token_offset]) {
					token_type = ck.type, token_text = ck.content, token_text_low = token_text.toLowerCase();
					handlers[token_type]();
					last_last_text = flags.last_text;
					last_type = token_type;
					flags.last_text = last_text = token_text_low;
				}
				param.defaultVal = output_lines.map(line => line.text.join('')).join('\n').trim();
			}
			format_mode = false, output_lines = [];
		}

		if (d || document.uri.match(/\.d\.(ahk2?|ah2)(?=(\?|$))/i)) {
			this.d = d || 1;
			this.parseScript = function (): void {
				input = this.document.getText(), input_length = input.length, includedir = this.scriptpath;
				lst = EMPTY_TOKEN, begin_line = true, parser_pos = 0, last_LF = -1;
				let _low = '', i = 0, j = 0, l = 0, isstatic = false, tk: Token, lk: Token;
				this.clear(), this.reflat = true, customblocks = { region: [], bracket: [] };
				let blocks = 0, rg: Range, tokens: Token[] = [], cls: string[] = [];
				let p: DocumentSymbol[] = [DocumentSymbol.create('', undefined, SymbolKind.Namespace, rg = make_range(0, 0), rg, this.children)];
				includetable = this.include, (<FuncNode>p[0]).declaration = this.declaration, comments = {};
				while (get_next_token().length)
					continue;
				tokens = Object.values(this.tokens), l = tokens.length;
				while (i < l) {
					switch ((tk = tokens[i]).type) {
						case 'TK_WORD':
							j = i + 1;
							if (j < l) {
								if (blocks && ((lk = tokens[j]).topofline || lk.content === '=>' || lk.content === '[')) {
									let tn = Variable.create(tk.content, SymbolKind.Property, rg = make_range(tk.offset, tk.length));
									tk.symbol = tn, tk.semantic = { type: SemanticTokenTypes.property, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly | (isstatic ? 1 << SemanticTokenModifiers.static : 0) };
									p[blocks].children?.push(tn), tn.static = isstatic, tn.full = `(${cls.join('.')}) ` + tn.name;
									if (isstatic && blocks)
										(<ClassNode>p[blocks]).staticdeclaration[tn.name.toLowerCase()] = tn;
									else
										(<ClassNode>p[blocks]).declaration[tn.name.toLowerCase()] = tn;
									if (tokens[i - (isstatic ? 2 : 1)].type.endsWith('COMMENT'))
										tn.detail = trim_comment(tokens[i - (isstatic ? 2 : 1)].content);
									let pars: Variable[] = [];
									if (lk.content === '[') {
										while ((lk = tokens[++j]).content !== ']')
											if (lk.type === 'TK_WORD') {
												let vr = Variable.create(lk.content, SymbolKind.Variable, rg = make_range(lk.offset, lk.length));
												pars.push(vr);
												lk.semantic = { type: SemanticTokenTypes.parameter, modifier: 1 << SemanticTokenModifiers.definition };
												let t = tokens[j + 1];
												if (t.content === '?')
													vr.defaultVal = null, j++;
												else if (t.content === ':=')
													vr.defaultVal = tokens[j += 2].content;
												else if (t.content === '*')
													vr.arr = true, j++;
											}
										lk = tokens[++j];
									}
									tn.full = `(${cls.join('.')}) ` + tn.name;
									if (lk.content === '{') {
										tn.children = [];
										while ((tk = tokens[++j]).content !== '}') {
											if (tk.content === '=>') {
												let rets: string[];
												let tt = FuncNode.create(lk.content, SymbolKind.Function, rg = make_range(lk.offset, lk.length), rg, pars, undefined, isstatic);
												lk.symbol = tt, lk = tokens[++j], lk.type === 'TK_START_EXPR' && (lk = tokens[++j]), rets = [];
												if (lk.type === 'TK_WORD')
													rets.push('#' + lk.content.toLowerCase());
												else if (lk.type === 'TK_NUMBER')
													rets.push(lk.content);
												while (tokens[j + 1].content === '|')
													if ((lk = tokens[j += 2]).type === 'TK_WORD')
														rets.push('#' + lk.content), lk.semantic = { type: SemanticTokenTypes.class };
													else if (lk.type === 'TK_NUMBER')
														rets.push(lk.content);
													else j--;
												tokens[j + 1].type === 'TK_END_EXPR' && (lk = tokens[++j]);
												tt.range.end = this.document.positionAt(lk.offset + lk.length);
												tt.returntypes = { [rets.length > 1 ? `[${rets.join(',')}]` : (rets.pop() ?? '#any')]: true };
												tn.children?.push(tt);
											} else lk = tk;
										}
									} else {
										let rets: string[] = [];
										if (lk.content === '=>') {
											lk = tokens[++j], lk.type === 'TK_START_EXPR' && (lk = tokens[++j]), rets = [];
											lk.type === 'TK_WORD' && rets.push('#' + lk.content.toLowerCase());
											while (tokens[j + 1].content === '|')
												if ((lk = tokens[j += 2]).type === 'TK_WORD')
													rets.push('#' + lk.content), lk.semantic = { type: SemanticTokenTypes.class };
												else j--;
											tokens[j + 1].type === 'TK_END_EXPR' && (lk = tokens[++j]);
										}
										tn.returntypes = { [rets.length > 1 ? `[${rets.join(',')}]` : (rets.pop() ?? '#any')]: true };
									}
								} else if (tokens[j].content === '(') {
									let params: Variable[] = [], byref = false, defVal = 0;
									while ((lk = tokens[++j]).content !== ')') {
										let tn: Variable;
										switch (lk.type) {
											case 'TK_WORD':
												tn = Variable.create(lk.content, SymbolKind.Variable, rg = make_range(lk.offset, lk.length));
												tn.ref = byref, byref = false, params.push(tn), lk.semantic = { type: SemanticTokenTypes.parameter, modifier: 1 << SemanticTokenModifiers.definition };
												if ((lk = tokens[j + 1]).content === ':=') {
													j = j + 2;
													if ((lk = tokens[j]).content === '+' || lk.content === '-')
														tn.defaultVal = lk.content + tokens[++j].content;
													else
														tn.defaultVal = lk.content;
												} else if (lk.content === '?')
													tn.defaultVal = null, j++;
												else {
													if (defVal)
														tn.defaultVal = false;
													if (lk.content === '*')
														tn.arr = true, j++;
													else if (lk.content === '[')
														defVal++, j++;
													else if (lk.content === ']')
														defVal--, j++;
												}
												break;
											case 'TK_STRING':
												params.push(tn = Variable.create(lk.content, SymbolKind.String, rg = make_range(lk.offset, lk.length)));
												if (defVal) tn.defaultVal = false;
												break;
											default:
												byref = false;
												if (lk.content === '&')
													byref = true;
												else if (lk.content === '*')
													params.push(Variable.create(lk.content, SymbolKind.Variable, rg = make_range(lk.offset, lk.length))), lk.semantic = { type: SemanticTokenTypes.parameter, modifier: 1 << SemanticTokenModifiers.definition };
												else if (lk.content === '[')
													defVal++;
												else if (lk.content === ']')
													defVal--;
												break;
										}
									}
									let rets: string[] | undefined, r = '', lt = '';
									lk = tokens[j];
									if (j < l - 2 && tokens[j + 1].content === '=>') {
										rets = [], tokens[j + 2].type === 'TK_START_EXPR' && (j++);
										do {
											j = j + 1, r = '', lt = '';
											while ((lk = tokens[j + 1]) && (lk.type === 'TK_WORD' || lk.type === 'TK_DOT') && (!lk.topofline && lt !== lk.type))
												r += lk.content, j++, lt = lk.type, lk.semantic = { type: SemanticTokenTypes.class };
											r && rets.push(r.replace(/(?<=(^|\.))([^.$@#]+)$/, '@$2').replace('$', ''));
										} while (tokens[j + 1]?.content === '|');
										lk?.type !== 'TK_END_EXPR' && (lk = tokens[j]);
									}
									let tn = FuncNode.create(tk.content, blocks ? SymbolKind.Method : SymbolKind.Function, make_range(tk.offset, lk.offset + lk.length - tk.offset), make_range(tk.offset, tk.length), params, [], isstatic);
									tk.symbol = tn, tn.full = this.document.getText(tn.range), tn.static = isstatic, tn.declaration = {};
									tk.semantic = { type: blocks ? SemanticTokenTypes.method : SemanticTokenTypes.function, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly | (isstatic ? 1 << SemanticTokenModifiers.static : 0) };
									if (blocks)
										tn.full = `(${cls.join('.')}) ` + tn.full;
									if (rets) {
										let o: any = {};
										rets.map((tp: string) => o[tp.toLowerCase()] = true);
										tn.returntypes = o;
									}
									if ((i -= (isstatic ? 2 : 1)) >= 0 && tokens[i].type.endsWith('COMMENT'))
										tn.detail = trim_comment(tokens[i].content);
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
								let extends_ = '', tn = DocumentSymbol.create((tk = tokens[++i]).content.replace('_', '#'), tokens[i - 2].type.endsWith('COMMENT') ? trim_comment(tokens[i - 2].content) : undefined, SymbolKind.Class, make_range(tokens[i - 1].offset, 0), make_range(tk.offset, tk.length), []);
								let cl = tn as ClassNode;
								cl.declaration = {}, cl.staticdeclaration = {}, j = i + 1, cls.push(tn.name), cl.full = cls.join('.'), cl.returntypes = { [(cl.full.replace(/([^.]+)$/, '@$1')).toLowerCase()]: true };
								tk.semantic = { type: SemanticTokenTypes.class, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly };
								tk.symbol = tn, cl.funccall = [], cl.extends = '', cl.declaration = {}, cl.staticdeclaration = {}, p[blocks].children?.push(tn);
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
							} else
								tk.type = 'TK_WORD';
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

				if (this.d < 0)
					return;
				if (this.d & 2) {
					this.children.map(it => {
						switch (it.kind) {
							case SymbolKind.Function:
							case SymbolKind.Class:
								(<any>it).uri = this.uri;
								ahkvars[it.name.toLowerCase()] = it as ClassNode;
								break;
						}
					});
					let s = this.declaration['struct'] as any;
					if (s && s.kind === SymbolKind.Class) s.def = false;
					s = (ahkvars['class'] as ClassNode)?.staticdeclaration['call'];
					if (s) s.def = false;
				}
				checksamenameerr({}, this.children, this.diagnostics);
				this.diags = this.diagnostics.length, this.isparsed = true;
				customblocks.region.map(o => this.addFoldingRange(o, parser_pos - 1, 'region'));
			}
		} else {
			this.parseScript = function (): void {
				input = this.document.getText(), input_length = input.length, includedir = this.scriptpath, dlldir = '';
				begin_line = true, lst = EMPTY_TOKEN;
				parser_pos = 0, last_LF = -1, customblocks = { region: [], bracket: [] }, continuation_sections_mode = false, h = isahk2_h;
				this.clear(), this.reflat = true, includetable = this.include, comments = {};
				try {
					this.children.push(...parse_block());
				} catch (e: any) {
					if (e instanceof ParseStopError) {
						this.addDiagnostic(e.message, e.token.offset, e.token.length, DiagnosticSeverity.Warning);
					} else
						throw e;
				}
				checksamenameerr(this.declaration, this.children, this.diagnostics);
				this.diags = this.diagnostics.length, this.isparsed = true;
				customblocks.region.map(o => this.addFoldingRange(o, parser_pos - 1, 'region'));
			}
		}

		function parse_block(mode = 0, scopevar = new Map<string, any>(), classfullname: string = ''): DocumentSymbol[] {
			const result: DocumentSymbol[] = [], document = _this.document, tokens = _this.tokens;
			let _parent = scopevar.get('#parent') || _this, tk = _this.tokens[parser_pos - 1] ?? EMPTY_TOKEN, lk = tk.previous_token ?? EMPTY_TOKEN;
			let blocks = 0, inswitch = 0, next = true, _low = '', _cm: Token | undefined, line_begin_pos: number | undefined;
			let blockpos: number[] = [], tn: DocumentSymbol | undefined, m: RegExpMatchArray | string | null, o: any;
			if (block_mode = true, mode !== 0)
				blockpos.push(parser_pos - 1), delete tk.data;
			parse_brace();
			if (tk.type === 'TK_EOF' && blocks > (mode === 0 ? 0 : -1))
				_this.addDiagnostic(diagnostic.missing('}'), blockpos[blocks - (mode === 0 ? 1 : 0)], 1);
			return result;

			function is_func_def(fat = undefined) {
				if (input.charAt(tk.offset + tk.length) !== '(')
					return false;
				let _lk = lk, _tk = tk, _lst = lst, _ppos = parser_pos, c = '';
				let n = 0, tp = tk.topofline > 0, e = '';
				block_mode = false;
				while (nexttoken()) {
					if ((c = tk.content) === '(')
						n++;
					else if (c === ')' && !--n) {
						nexttoken();
						e = tk.content;
						break;
					}
				}
				lk = _lk, tk = _tk, lst = _lst, parser_pos = _ppos, next = true;
				return e === '=>' || (tp && e === '{');
			}

			function parse_brace(level = 0, _inswitch = 0) {
				let last_switch = inswitch;
				inswitch = _inswitch;
				if (tk.type === 'TK_START_BLOCK') {
					delete tk.data;
					nexttoken(), next = false;
					if (!tk.topofline && !lk.topofline)
						_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
				}
				while (block_mode = true, nexttoken()) {
					let _nk: Token | undefined;
					if (tk.topofline === 1) {
						line_begin_pos = tk.offset;
						if (mode === 2) {
							if (tk.type !== 'TK_RESERVED' && allIdentifierChar.test(tk.content))
								tk.type = 'TK_WORD', delete tk.semantic;
						} else if (input.charAt(parser_pos) === ':') {
							if ((whitespace.includes(input.charAt(parser_pos + 1)) && allIdentifierChar.test(tk.content)) ||
								(inswitch && tk.content.toLowerCase() === 'default')) {
								if (_nk = tokens[parser_pos]) {
									if ((tk.next_token_offset = _nk.next_token_offset) > 0)
										tokens[_nk.next_token_offset].previous_token = tk;
									delete tokens[parser_pos];
								}
								tk.content += ':', tk.length++, tk.type = 'TK_LABEL', parser_pos++;
								line_begin_pos = undefined;
							}
						}
					}

					switch (tk.type) {
						case 'TK_EOF': return;

						case 'TK_WORD':
							if (tk.topofline > 0) {
								let isfuncdef = is_func_def();
								nexttoken();
								if (!isfuncdef && h && mode !== 2 && lk.topofline === 1 && !tk.topofline && tk.type === 'TK_WORD' && lk.content.toLowerCase() === 'macro') {
									tk.topofline = 1;
									if (isfuncdef = is_func_def())
										nexttoken();
									else tk.topofline = 0;
								}

								if (isfuncdef) {
									let tn: FuncNode | undefined, cm: Token | undefined, fc = lk, rl = result.length, quoteend = parser_pos;
									let se: SemanticToken = lk.semantic = { type: mode === 2 ? SemanticTokenTypes.method : SemanticTokenTypes.function };
									let par = parse_params(), isstatic = fc.topofline === 2;
									let oo = isstatic ? fc.previous_token?.offset as number : fc.offset;
									line_begin_pos = undefined;
									if ((_low = fc.content.toLowerCase()).match(/^\d/))
										_this.addDiagnostic(diagnostic.invalidsymbolname(fc.content), fc.offset, fc.length);
									if (!par)
										par = [], _this.addDiagnostic(diagnostic.invalidparam(), fc.offset, tk.offset + 1 - fc.offset);
									fc.symbol = tn = FuncNode.create(fc.content, mode === 2 ? SymbolKind.Method : SymbolKind.Function,
										Range.create(fc.pos = document.positionAt(fc.offset), { line: 0, character: 0 }),
										make_range(fc.offset, fc.length), par, undefined, isstatic);
									if (mode !== 0)
										tn.parent = _parent;
									if (nexttoken() && tk.content === '=>') {
										let rs = result.splice(rl), storemode = mode, pp = _parent;
										mode |= 1, _parent = tn;
										let sub = parse_line(o, undefined, 'return', 1);
										result.push(tn), _parent = pp, mode = storemode;
										tn.range.end = document.positionAt(lk.offset + lk.length);
										_this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
										tn.returntypes = o, tn.children = rs.concat(sub);
										for (const t in o)
											o[t] = tn.range.end;
										_this.linepos[tn.range.end.line] = oo;
									} else if (tk.content === '{') {
										let rs = result.splice(rl), vars = new Map<string, any>(), ofs = tk.offset;
										tk.previous_pair_pos = oo;
										vars.set('#parent', tn), tn.funccall = [], result.push(tn), tn.children = rs;
										tn.children.push(...parse_block(mode | 1, vars, classfullname));
										tn.range.end = document.positionAt(parser_pos);
										_this.addSymbolFolding(tn, ofs);
									} else {
										_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
										break;
									}
									se.modifier = 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly |
										(isstatic ? 1 << SemanticTokenModifiers.static : 0);
									if (cm = comments[tn.selectionRange.start.line])
										tn.detail = trim_comment(cm.content);
									tn.closure = !!(mode & 1) && !isstatic;
									adddeclaration(tn);
									if (mode === 2) {
										tn.full = `(${classfullname.slice(0, -1)}) ` + tn.full;
										if (!isstatic && tn.name.toLowerCase() === '__new')
											tn.returntypes = { [classfullname.replace(/([^.]+)\.?$/, '@$1')]: tn.range.end };
										if (!_this.object.method[_low])
											_this.object.method[_low] = [];
										_this.object.method[_low].push(tn);
									}
									break;
								}

								if (mode === 2) {
									if (input.charAt(lk.offset + lk.length) === '[' || tk.content.match(/^(=>|\{)$/)) {
										let fc = lk, rl = result.length, par: any = [], rg: Range;
										line_begin_pos = undefined;
										if (tk.content === '[') {
											par = parse_params(undefined, ']') ?? [];
											nexttoken();
											if (par.length === 0)
												_this.addDiagnostic(diagnostic.propemptyparams(), fc.offset, lk.offset - fc.offset + 1);
											if (!tk.content.match(/^(=>|\{)$/)) {
												_this.addDiagnostic(diagnostic.propdeclaraerr(), fc.offset, fc.length);
												next = false;
												break;
											}
										}
										let isstatic = fc.topofline === 2;
										let oo = isstatic ? fc.previous_token?.offset as number : fc.offset;
										let prop = fc.symbol = DocumentSymbol.create(fc.content, undefined, SymbolKind.Property,
											rg = make_range(fc.offset, fc.length), Object.assign({}, rg)) as FuncNode;
										if (_cm = comments[prop.selectionRange.start.line])
											prop.detail = trim_comment(_cm.content);
										par.format?.(par), prop.parent = _parent, prop.params = par;
										prop.full = `(${classfullname.slice(0, -1)}) ${isstatic ? 'static ' : ''}${fc.content}` + (par.length ? `[${par.map((it: Variable) => {
											return (it.ref ? '&' : '') + it.name + (it.defaultVal ? ' := ' + it.defaultVal : it.arr ? '*' : it.defaultVal === null ? '?' : '');
										}).join(', ')}]` : '');
										prop.static = isstatic, prop.children = result.splice(rl);
										result.push(prop), addprop(fc), prop.funccall = [];
										fc.semantic = { type: SemanticTokenTypes.property, modifier: 1 << SemanticTokenModifiers.definition | (isstatic ? 1 << SemanticTokenModifiers.static : 0) };
										if (tk.content === '{') {
											let nk: Token, sk: Token, tn: FuncNode | undefined, mmm = mode, brace = tk.offset;
											tk.previous_pair_pos = oo;
											nexttoken(), next = false, mode = 1;
											if (tk.type as string === 'TK_END_BLOCK' && !lk.topofline && !tk.topofline)
												_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
											while (nexttoken() && tk.type as string !== 'TK_END_BLOCK') {
												if (tk.topofline && (tk.content = tk.content.toLowerCase()).match(/^[gs]et$/)) {
													let v: Variable;
													tk.semantic = { type: SemanticTokenTypes.function, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly };
													// nk = tk, sk = _this.get_token(parser_pos, true), parser_pos = sk.offset + sk.length;
													nexttoken(), nk = lk;
													if (tk.content === '=>') {
														let o: any = {}, sub: DocumentSymbol[], fcs = _parent.funccall.length;
														tn = FuncNode.create(lk.content.toLowerCase(), SymbolKind.Function,
															make_range(lk.offset, parser_pos - lk.offset), make_range(lk.offset, lk.length), [...par]);
														if (lk.content.match(/^\d/))
															_this.addDiagnostic(diagnostic.invalidsymbolname(lk.content), lk.offset, lk.length);
														lk.symbol = tn, mode = 3;
														tn.parent = prop, sub = parse_line(o, undefined, 'return', 1), mode = 2;
														tn.funccall?.push(..._parent.funccall.splice(fcs));
														tn.range.end = document.positionAt(lk.offset + lk.length);
														prop.range.end = tn.range.end;
														_this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
														tn.returntypes = o, tn.children = [];
														if (lk.content === '=>')
															_this.addDiagnostic(diagnostic.invaliddefinition('function'), nk.offset, nk.length);
														for (const t in o)
															o[t] = tn.range.end;
														if (nk.content.toLowerCase() === 'set')
															tn.params.unshift(v = Variable.create('Value', SymbolKind.Variable,
																Range.create(0, 0, 0, 0))), v.detail = completionitem.value();
														tn.children.push(...sub), adddeclaration(tn);
														_this.linepos[tn.range.end.line] = nk.offset;
													} else if (tk.content === '{') {
														sk = tk;
														nk.symbol = tn = FuncNode.create(nk.content, SymbolKind.Function,
															make_range(nk.offset, parser_pos - nk.offset), make_range(nk.offset, 3), [...par]);
														let vars = new Map<string, any>([['#parent', tn]]);
														tn.parent = prop, tn.children = parse_block(3, vars, classfullname);
														tn.range.end = document.positionAt(parser_pos);
														if (nk.content.toLowerCase() === 'set')
															tn.params.unshift(v = Variable.create('Value', SymbolKind.Variable,
																Range.create(0, 0, 0, 0))), v.detail = completionitem.value();
														adddeclaration(tn);
														_this.addSymbolFolding(tn, sk.offset);
														if (nk.content.match(/^\d/))
															_this.addDiagnostic(diagnostic.invalidsymbolname(nk.content), nk.offset, nk.length);
													} else {
														_this.addDiagnostic(diagnostic.invalidprop(), tk.offset, tk.length);
														if (tk.content === '}') {
															next = false; break;
														} else {
															tn = undefined;
															let b = 0;
															while (tk.type as string !== 'TK_EOF') {
																if (tk.content === '{')
																	b++;
																else if (tk.content === '}' && (--b) < 0)
																	break;
																nexttoken();
															}
															next = false;
														}
													}
													if (tn)
														prop.children.push(tn);
												} else {
													let b = 0;
													_this.addDiagnostic(diagnostic.invalidprop(), tk.offset, tk.length);
													next = false;
													while (nexttoken()) {
														if (tk.content === '{')
															b++;
														else if (tk.content === '}')
															if ((--b) < 0)
																break;
													}
													next = false;
												}
											}
											prop.range.end = document.positionAt(parser_pos - 1), mode = mmm;
											_this.addSymbolFolding(prop, brace);
										} else if (tk.content === '=>') {
											let off = parser_pos, o: any = {}, tn: FuncNode, fcs = _parent.funccall.length;
											mode = 3, tn = FuncNode.create('get', SymbolKind.Function,
												rg = make_range(off, parser_pos - off), Object.assign({}, rg), par);
											tn.parent = prop;
											tn.children = parse_line(o, undefined, 'return', 1), tn.returntypes = o;
											tn.funccall?.push(..._parent.funccall.splice(fcs)), mode = 2;
											tn.range.end = document.positionAt(lk.offset + lk.length);
											prop.range.end = tn.range.end;
											_this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
											for (const t in o)
												o[t] = tn.range.end;
											if (mode !== 0)
												tn.parent = _parent;
											adddeclaration(tn), prop.children.push(tn);
											_this.linepos[prop.range.end.line] = oo;
										}
										if (prop.children.length === 1 && prop.children[0].name === 'get')
											(fc.semantic as SemanticToken).modifier = ((fc.semantic as SemanticToken).modifier || 0) | 1 << SemanticTokenModifiers.readonly;
										break;
									}
									if (tk.content !== ':=') {
										_this.addDiagnostic(diagnostic.propdeclaraerr(), lk.offset, lk.length);
										if (next = false, !tk.topofline) {
											tk = lk, lk = EMPTY_TOKEN;
											parser_pos = tk.offset + tk.length;
											parse_line();
										}
									} else {
										tk = lk, lk = EMPTY_TOKEN, next = false;
										parser_pos = tk.offset + tk.length;
										result.push(...parse_statement(''));
										if (line_begin_pos !== undefined)
											_this.linepos[(lk.pos ??= document.positionAt(lk.offset)).line] = line_begin_pos;
									}
								} else {
									reset_extra_index(tk), tk = lk, lk = EMPTY_TOKEN;
									parser_pos = tk.offset + tk.length;
									parse_top_word();
									if (line_begin_pos !== undefined)
										_this.linepos[(lk.pos ??= document.positionAt(lk.offset)).line] = line_begin_pos;
								}
								break;
							}

							if (mode === 2) {
								result.push(...parse_statement(''));
							} else {
								if (tk.topofline)
									parse_top_word();
								else next = false, result.push(...parse_line());
								if (line_begin_pos !== undefined)
									_this.linepos[(lk.pos ??= document.positionAt(lk.offset)).line] = line_begin_pos;
							}
							break;

						case 'TK_SHARP': parse_sharp(); break;

						case 'TK_RESERVED': parse_reserved(); break;

						case 'TK_START_BLOCK':
							if (mode === 2)
								_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
							else blocks++, blockpos.push(parser_pos - 1);
							break;

						case 'TK_END_BLOCK':
							if ((--blocks) >= 0 && blockpos.length) {
								let p = blockpos.pop() as number;
								_this.addFoldingRange(tk.previous_pair_pos = p, parser_pos - 1);
								tokens[p].next_pair_pos = tk.offset;
								if (tk.topofline === 1)
									last_LF = tk.offset, begin_line = true;
							}
							if (blocks < level) {
								if (mode === 0 && level === 0)
									_this.addDiagnostic(diagnostic.unexpected('}'), tk.offset, 1),
										blocks = 0, blockpos.length = 0;
								else {
									if (blockpos.length)
										tokens[tk.previous_pair_pos = blockpos[blockpos.length - 1]].next_pair_pos = tk.offset;
									inswitch = last_switch;
									return;
								}
							}
							break;

						// case 'TK_DOT':
						case 'TK_END_EXPR':
							_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, 1);
							line_begin_pos = undefined;
							break;

						case 'TK_LABEL':
							if (inswitch && tk.content.toLowerCase() === 'default:') {
								nexttoken(), next = false;
								tk.topofline ||= -1;
								break;
							}
							if (mode === 2) {
								_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset, tk.length);
								break;
							}
							tk.symbol = tn = SymbolNode.create(tk.content, SymbolKind.Field,
								make_range(tk.offset, tk.length), make_range(tk.offset, tk.length - 1))
							result.push(tn);
							if (_parent.labels) {
								_low = tk.content.toLowerCase().slice(0, -1), (<any>tn).def = true;
								if (!_parent.labels[_low])
									_parent.labels[_low] = [tn];
								else if (_parent.labels[_low][0].def)
									_this.addDiagnostic(diagnostic.duplabel(), tk.offset, tk.length - 1),
										_parent.labels[_low].push(tn);
								else
									_parent.labels[_low].unshift(tn);
							}
							if (_cm = comments[tn.selectionRange.start.line])
								tn.detail = trim_comment(_cm.content);
							if (!(_nk = _this.get_token(parser_pos, true)).topofline)
								_this.addDiagnostic(diagnostic.unexpected(_nk.content), _nk.offset, _nk.length);
							break;

						case 'TK_HOTLINE': {
							tk.symbol = tn = SymbolNode.create(tk.content, SymbolKind.Event,
								make_range(tk.offset, tk.length), make_range(tk.offset, tk.length - 2));
							tn.range.end = document.positionAt(parser_pos - 1), result.push(tn);
							if (_cm = comments[tn.selectionRange.start.line])
								tn.detail = trim_comment(_cm.content);
							if (mode !== 0)
								_this.addDiagnostic(diagnostic.hotdeferr(), tk.offset, tk.length);
							if (tk.ignore) {
								while (nexttoken()) {
									if (!tk.ignore || tk.type as string !== 'TK_STRING')
										break;
								}
								tn.range.end = document.positionAt(lk.offset + lk.length);
								next = false;
								break;
							}
							if (tk.content.match(/\s::$/) ||
								(m = tk.content.match(/\S(\s*)&(\s*)\S+::/)) && (m[1] === '' || m[2] === ''))
								_this.addDiagnostic(diagnostic.invalidhotdef(), tk.offset, tk.length);
							break;
						}
						case 'TK_HOT': {
							if (mode !== 0)
								_this.addDiagnostic(diagnostic.hotdeferr(), tk.offset, tk.length);
							else if (!tk.ignore && (tk.content.match(/\s::$/) ||
								(m = tk.content.match(/\S(\s*)&(\s*)\S+::/)) && (m[1] === '' || m[2] === '')))
								_this.addDiagnostic(diagnostic.invalidhotdef(), tk.offset, tk.length);
							let tn = SymbolNode.create(tk.content, SymbolKind.Event,
								make_range(tk.offset, tk.length), make_range(tk.offset, tk.length - 2)) as FuncNode;
							if (_cm = comments[tn.selectionRange.start.line])
								tn.detail = trim_comment(_cm.content);
							tk.symbol = tn, nexttoken();
							let ht = lk, v: Variable, vars = new Map<string, any>([['#parent', tn]]);
							tn.funccall = [], tn.declaration = {}, result.push(tn);
							tn.global = {}, tn.local = {};
							if (tk.content === '{') {
								tk.previous_pair_pos = ht.offset;
								tn.params = [v = Variable.create('ThisHotkey', SymbolKind.Variable,
									make_range(0, 0))];
								v.detail = completionitem.thishotkey();
								tn.children = [], tn.children.push(...parse_block(1, vars));
								tn.range = make_range(ht.offset, parser_pos - ht.offset);
								_this.addSymbolFolding(tn, tk.offset), adddeclaration(tn);
							} else if (tk.topofline) {
								adddeclaration(tn);
								while (tk.type as string === 'TK_SHARP')
									parse_sharp(), nexttoken();
								next = false;
								if (tk.type.startsWith('TK_HOT'))
									break;
								else if (tk.type as string !== 'TK_WORD' || !is_func_def())
									_this.addDiagnostic(diagnostic.hotmissbrace(), lk.offset, lk.length);
								next = false;
							} else {
								let tparent = _parent, tmode = mode, l = tk.content.toLowerCase();
								_parent = tn, mode = 1;
								if (l === 'return')
									tn.children = parse_line(undefined, undefined, 'return');
								else if (['global', 'local', 'static'].includes(l)) {
									let _p = _parent, rl = result.length;
									_parent = tn, parse_reserved();
									tn.children = result.splice(rl);
									_parent = _p;
								} else {
									let rl = result.length;
									next = false, parse_body(null, ht.offset);
									tn.children = result.splice(rl);
								}
								_parent = tparent, mode = tmode, adddeclaration(tn as FuncNode);
								let o = lk.offset + lk.length;
								while (' \t'.includes(input.charAt(o) || '\0')) o++;
								tn.range = make_range(ht.offset, o - ht.offset);
								_this.linepos[tn.range.end.line] = ht.offset;
							}
							break;
						}
						case 'TK_UNKNOWN':
							_this.addDiagnostic(diagnostic.unknowntoken(tk.content), tk.offset, tk.length);
							break;

						default:
							if (tk.topofline)
								lk = EMPTY_TOKEN;
							if (next = false, mode === 2)
								_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset, tk.length), parse_line();
							else {
								result.push(...parse_line());
								if (line_begin_pos !== undefined)
									_this.linepos[(lk.pos ??= document.positionAt(lk.offset)).line] = line_begin_pos;
							}
							break;
					}
				}
			}

			function parse_reserved() {
				let _low = tk.content.toLowerCase(), beginpos = tk.offset, bak = lk, t = parser_pos, nk: Token | undefined;
				if (block_mode = false, mode === 2) {
					nk = get_next_token();
					next = false, parser_pos = t, tk.type = 'TK_WORD';
					if ('.[('.includes(input.charAt(tk.offset + tk.length)) || nk.content.match(/^(:=|=>|\{)$/))
						return;
					if (nk.type !== 'TK_EQUALS' && (_low === 'class' || _low === 'static')) {
						nk = undefined, next = true, tk.type = 'TK_RESERVED';
					} else
						return;
				} else {
					if (input.charAt(tk.offset - 1) === '%' || input.charAt(tk.offset + tk.length) === '%') {
						tk.type = 'TK_WORD', next = false, tk.semantic = { type: SemanticTokenTypes.variable };
						return;
					}
				}
				switch (_low) {
					case 'class':
						if (!tk.topofline || (mode & 1)) {
							next = false, tk.type = 'TK_WORD'; break;
						}
						let cl: Token, ex: string = '', sv = new Map(), rg: Range;
						nexttoken();
						if (!tk.topofline && tk.type === 'TK_RESERVED') {
							tk.type = 'TK_WORD';
							if (mode !== 2)
								_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						}
						if (!tk.topofline && tk.type === 'TK_WORD') {
							if (mode & 1) _this.addDiagnostic(diagnostic.classinfuncerr(), tk.offset, tk.length);
							cl = tk, nexttoken();
							if (tk.content.toLowerCase() === 'extends') {
								tk = get_next_token();
								if (tk.type === 'TK_WORD') {
									ex = tk.content;
									result.push(Variable.create(tk.content, SymbolKind.Variable, rg = make_range(tk.offset, tk.length)));
									while (parser_pos < input_length && input.charAt(parser_pos) === '.') {
										parser_pos++;
										tk = get_next_token();
										if (tk.type === 'TK_WORD')
											ex += '.' + tk.content;
										else
											break;
									}
									if (tk.type === 'TK_WORD')
										nexttoken();
								} else
									_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
							}
							if (tk.type !== 'TK_START_BLOCK') { next = false; break; }
							tk.previous_pair_pos = beginpos;
							if (cl.content.match(/^\d/))
								_this.addDiagnostic(diagnostic.invalidsymbolname(cl.content), cl.offset, cl.length);
							let tn = DocumentSymbol.create(cl.content, undefined, SymbolKind.Class,
								make_range(0, 0), make_range(cl.offset, cl.length)) as ClassNode;
							cl.symbol = tn, sv.set('#parent', tn), tn.full = classfullname + cl.content;
							tn.funccall = [], tn.children = [], tn.cache = [];
							tn.staticdeclaration = {}, tn.declaration = {};
							tn.returntypes = { [(classfullname + '@' + cl.content).toLowerCase()]: true };
							if (_cm = comments[tn.selectionRange.start.line])
								tn.detail = trim_comment(_cm.content);
							if (ex)
								tn.extends = ex;
							tn.children.push(...parse_block(2, sv, classfullname + cl.content + '.')), tn.range = make_range(beginpos, parser_pos - beginpos);
							adddeclaration(tn as ClassNode), cl.semantic = { type: SemanticTokenTypes.class, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly };
							_this.addSymbolFolding(tn, tk.offset);
							for (const item of tn.children) if (item.children && item.kind != SymbolKind.Property) (<FuncNode>item).parent = tn;
							result.push(tn);
							return true;
						} else {
							next = false, lk.type = 'TK_WORD', parser_pos = lk.offset + lk.length, tk = lk, lk = bak;
						}
						break;
					case 'global':
					case 'static':
					case 'local':
						nexttoken();
						if (mode === 2 && !tk.topofline && allIdentifierChar.test(tk.content))
							tk.type = 'TK_WORD';
						if (tk.topofline) {
							if (mode === 2)
								_this.addDiagnostic(diagnostic.propdeclaraerr(), lk.offset, lk.length);
							else if (_low === 'local')
								_this.addDiagnostic(diagnostic.declarationerr(), lk.offset, lk.length);
							else {
								if (_parent.assume > 0)
									_this.addDiagnostic(diagnostic.declarationerr(), lk.offset, lk.length);
								if (_low === 'static')
									_parent.assume = FuncScope.STATIC;
								else _parent.assume = FuncScope.GLOBAL;
							}
						} else if (tk.type === 'TK_WORD' || tk.type === 'TK_RESERVED') {
							if (mode === 0) {
								next = false;
								if (_low !== 'global')
									_this.addDiagnostic(diagnostic.declarationerr(), lk.offset, lk.length);
								break;
							} else if (mode === 2 && _low !== 'static') {
								_this.addDiagnostic(diagnostic.propdeclaraerr(), lk.offset, lk.length);
								next = false;
								break;
							}
							if ('(['.includes(input.charAt(parser_pos)) || _this.get_token(parser_pos, true).content.match(/^(\{|=>)$/)) {
								tk.topofline = 2;
							} else {
								let sta: any[];
								next = false;
								sta = parse_statement(_low === 'global' ? '' : _low);
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
										let s = _low === 'static';
										sta.map(it => {
											_parent.local[it.name.toLowerCase()] = it;
											if (s) it.static = true;
										});
									}
								}
								result.push(...sta);
							}
						} else if (tk.type === 'TK_EQUALS') {
							parser_pos = lk.offset + lk.length, lk.type = 'TK_WORD', tk = lk, lk = bak;
							if (mode !== 2) _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						}
						next = false;
						break;
					case 'loop':
						if (mode === 2) {
							nk = _this.get_token(parser_pos);
							next = false, tk.type = 'TK_WORD';
							if (nk.content !== ':=')
								_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset, tk.length);
							break;
						}
						lk = tk, tk = get_next_token();
						if (tk.type === 'TK_EQUALS') {
							parser_pos = lk.offset + lk.length, lk.type = 'TK_WORD', tk = lk, lk = bak, next = false;
							if (mode !== 2) _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						} else if (mode === 2) {
							_this.addDiagnostic(diagnostic.propdeclaraerr(), lk.offset, lk.length);
							break;
						} else if (next = (tk.type === 'TK_WORD' && ['parse', 'files', 'read', 'reg'].includes(tk.content.toLowerCase())))
							tk.type = 'TK_RESERVED';
						if (!tk.topofline && tk.type !== 'TK_START_BLOCK')
							result.push(...parse_line(undefined, '{'));
						if (parse_body(undefined, beginpos))
							return;
						if (tk.type === 'TK_RESERVED' && tk.content.toLowerCase() === 'until')
							next = true, line_begin_pos = tk.offset, result.push(...parse_line(undefined, undefined, 'until', 1));
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
										result.push(...parse_expression());
										if (nk) {
											if (tk.content !== ')') {
												_this.addDiagnostic(diagnostic.missing(')'), nk.offset, nk.length);
											} else next = true, nexttoken();
										}
										if (!parse_body(undefined, beginpos) && (tk as Token).type === 'TK_RESERVED' && tk.content.toLowerCase() === 'until')
											next = true, line_begin_pos = tk.offset, result.push(...parse_line(undefined, undefined, 'until', 1));
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
							next = false, tk.type = 'TK_WORD';
							if (_this.get_token(parser_pos, true).content !== ':=')
								_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset, tk.length);
							break;
						}
						lk = tk, tk = get_next_token(), next = false;
						if (!tk.topofline) {
							if (allIdentifierChar.test(tk.content)) {
								tk.ignore = true, tk.type = 'TK_WORD', addlabel(tk);
							} else if (tk.type.endsWith('COMMENT')) {
								if (_low === 'goto')
									_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
							} else if (input.charAt(lk.offset + lk.length) !== '(') {
								parser_pos = lk.offset + lk.length, lk.type = 'TK_WORD', tk = lk, lk = bak, next = false;
								_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
							} else {
								let s: Token[] = [];
								next = true, parse_pair('(', ')', undefined, {}, s);
								s.map(i => {
									if (i.content.indexOf('\n') < 0)
										addlabel({ content: i.content.slice(1, -1), offset: i.offset + 1, length: i.length - 2, type: '', topofline: 0, next_token_offset: -1 });
								});
								nexttoken(), next = false;
							}
						}
						break;
					case 'as':
					case 'catch':
					case 'else':
					case 'finally':
					case 'until':
						_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
						break;
					case 'super':
						if (!(mode & 3))
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						else tk.ignore = true;
						tk.type = 'TK_WORD', next = false
						break;
					case 'case':
						if (inswitch && tk.topofline) {
							nexttoken(), next = false;
							if (tk.content !== ':' && !tk.topofline) {
								inswitch = 2, result.push(...parse_line(undefined, ':', 'case', 1, 20)), inswitch = 1;
								if (tk.content !== ':')
									_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length), next = false;
								else {
									next = true, nexttoken(), next = false;
									if (tk.type === 'TK_START_BLOCK')
										tk.previous_pair_pos = beginpos;
									else tk.topofline ||= -1;
								}
							} else
								next = tk.content === ':', _this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
						} else
							tk.type = 'TK_WORD', _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						break;
					case 'try':
						nexttoken(), next = false;
						parse_body(true, beginpos);
						if (tk.type === 'TK_RESERVED' && tk.content.toLowerCase() !== 'else') {
							while (tk.content.toLowerCase() === 'catch')
								next = true, line_begin_pos = tk.offset, parse_catch();
							for (let l of ['else', 'finally'])
								if (tk.content.toLowerCase() === l)
									next = true, line_begin_pos = tk.offset, nexttoken(), next = false, parse_body(true, lk.offset);
						}
						break;
					case 'isset':
						if (input.charAt(tk.offset + 5) === '(') {
							tk.type = 'TK_WORD', next = false;
						} else
							_this.addDiagnostic(diagnostic.missing('('), tk.offset, 5);
						break;
					default:
						nk = get_token_ignore_comment();
						if (nk.type === 'TK_EQUALS' || nk.content.match(/^([<>]=?|~=|&&|\|\||[.&|?:^]|\*\*?|\/\/?|<<|>>|!?==?)$/))
							tk.type = 'TK_WORD', parser_pos = t, _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						else {
							let tps: any = {};
							lk = tk, tk = nk, next = false;
							if (_low === 'return') {
								result.push(...parse_line(tps, undefined, _low));
								if (mode & 1) {
									let rg = document.positionAt(lk.offset + lk.length);
									if (!_parent.returntypes)
										_parent.returntypes = {};
									for (const tp in tps)
										_parent.returntypes[tp] = rg;
								}
							} else if (_low === 'switch') {
								result.push(...parse_line(undefined, '{', _low, 0, 2));
								if (tk.content === '{')
									tk.previous_pair_pos = beginpos, next = true, blockpos.push(parser_pos - 1), parse_brace(++blocks, 1), nexttoken(), next = false;
								else _this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
							} else if (_low === 'if' || _low === 'while') {
								result.push(...parse_line(undefined, '{', _low, 1));
								parse_body(undefined, beginpos);
							}
						}
						break;
				}

				function addlabel(tk: Token) {
					if (_parent.labels) {
						_low = tk.content.toLowerCase();
						if (!_parent.labels[_low])
							_parent.labels[_low] = [];
						let rg = make_range(tk.offset, tk.length);
						_parent.labels[_low].push(tk.symbol = tn = DocumentSymbol.create(tk.content, undefined, SymbolKind.Field, rg, rg));
					}
				}
			}

			function parse_catch() {
				let p: Token | undefined, nk: Token, bp = tk.offset;
				line_begin_pos = bp;
				lk = nk = tk, p = get_token_ignore_comment();
				if (p.topofline || p.content !== '(')
					tk = p, p = undefined;
				else tk = get_token_ignore_comment();
				if (tk.topofline || (tk.type !== 'TK_WORD' && !allIdentifierChar.test(tk.content))) {
					if (p) {
						parser_pos = p.offset - 1;
						_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
					} else {
						next = false;
						if (tk.topofline || tk.content === '{')
							parse_body(null, bp);
						else
							_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
					}
				} else {
					next = true;
					if (tk.content.toLowerCase() !== 'as') {
						while (true) {
							if (tk.type !== 'TK_WORD')
								_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
							else addvariable(tk);
							lk = tk, tk = get_token_ignore_comment();
							if (tk.content === ',') {
								lk = tk, tk = get_token_ignore_comment();
								if (!allIdentifierChar.test(tk.content))
									break;
							} else
								break;
						}
						if (p) {
							if (tk.content === '{') {
								_this.addDiagnostic(diagnostic.missing(')'), p.offset, 1);
								return parse_body(null, bp);
							} else if (tk.content === ')') {
								nexttoken(), next = false;
								return parse_body(null, bp);
							}
						} else if (tk.content === '{' || tk.topofline) {
							next = false;
							return parse_body(null, bp);
						}
					}
					if (tk.content.toLowerCase() === 'as') {
						lk = tk, tk = get_token_ignore_comment();
						next = false;
						if (tk.type !== 'TK_WORD' && !allIdentifierChar.test(tk.content)) {
							_this.addDiagnostic(diagnostic.unexpected(nk.content), nk.offset, nk.length);
						} else if (tk.type !== 'TK_WORD')
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length), tk.type = 'TK_WORD';
						else {
							let t = get_token_ignore_comment();
							parser_pos = tk.offset + tk.length;
							if (!t.topofline && t.content !== '{' && !(p && t.content === ')'))
								_this.addDiagnostic(diagnostic.unexpected(nk.content), nk.offset, nk.length), next = false;
							else {
								if (addvariable(tk))
									next = true, (<Variable>result[result.length - 1]).def = true;
								if (p) {
									if (t.content === ')')
										parser_pos = t.offset + 1, next = true;
									else
										_this.addDiagnostic(diagnostic.missing(')'), p.offset, 1);
								}
								if (next)
									nexttoken(), next = false, parse_body(null, bp);
							}
						}
					} else {
						if (p) {
							if (tk.content === ')')
								lk = tk, tk = get_token_ignore_comment();
							else _this.addDiagnostic(diagnostic.missing(')'), p.offset, 1);
						}
						if (!tk.topofline)
							_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
						else next = false, parse_body(null, bp);
					}
				}
			}

			function reset_extra_index(tk: Token) {
				let t = tk.previous_extra_tokens;
				if (t) t.i = 0;
			}

			function parse_top_word() {
				let c = '';
				next = true, nexttoken(), next = false;
				if (tk.type !== 'TK_EQUALS' && !'=?'.includes(tk.content || ' ') &&
					(tk.type === 'TK_DOT' || ', \t\r\n'.includes(c = input.charAt(lk.offset + lk.length)))) {
					if (tk.type === 'TK_DOT') {
						next = true, addvariable(lk);
						while (nexttoken()) {
							if (tk.type as string === 'TK_WORD') {
								addprop(tk), nexttoken();
								if (tk.content === ':=')
									maybeclassprop(lk);
								else if (tk.type === 'TK_DOT')
									continue;
								else if (tk.content === '%' && lk.offset + lk.length === tk.offset)
									maybeclassprop(lk, null);
								next = false;
								if (tk.type as string !== 'TK_EQUALS' && !'=?'.includes(tk.content || ' ') &&
									', \t\r\n'.includes(c = input.charAt(lk.offset + lk.length)))
									parse_funccall(SymbolKind.Method, c);
								else
									result.push(...parse_line());
							} else
								next = false, result.push(...parse_line());
							break;
						}
					} else
						addvariable(lk), parse_funccall(SymbolKind.Function, c);
				} else {
					// if (tk.type === 'TK_UNKNOWN')
					// 	_this.addDiagnostic(diagnostic.unknown(tk.content), tk.offset, tk.length);
					reset_extra_index(tk), tk = lk, lk = EMPTY_TOKEN, next = false;
					parser_pos = tk.skip_pos ?? tk.offset + tk.length;
					result.push(...parse_line());
				}
			}

			function parse_funccall(type: SymbolKind, nextc: string) {
				let tn: CallInfo, sub: DocumentSymbol[], fc = lk;
				if (nextc === ',') {
					if (type === SymbolKind.Function && builtin_ahkv1_commands.includes(fc.content.toLowerCase()))
						return stop_parse(fc);
					_this.addDiagnostic(diagnostic.funccallerr(), tk.offset, 1);
				}
				sub = parse_line();
				result.push(...sub);
				fc.semantic = { type: type === SymbolKind.Function ? SemanticTokenTypes.function : SemanticTokenTypes.method };
				_parent.funccall.push(tn = DocumentSymbol.create(fc.content, undefined, type,
					make_range(fc.offset, lk.offset + lk.length - fc.offset), make_range(fc.offset, fc.length)));
				tn.paraminfo = (sub as any).paraminfo, tn.offset = fc.offset, fc.callinfo = tn;
				if (lk === fc) {
					let lf = input.indexOf('\n', fc.offset);
					tn.range.end = document.positionAt(lf < 0 ? input_length : lf);
				}
				if (type === SymbolKind.Method)
					maybeclassprop(fc, true);
			}

			function parse_body(else_body: boolean | null = false, previous_pos?: number) {
				if (block_mode = false, tk.type === 'TK_START_BLOCK') {
					if (previous_pos !== undefined)
						tk.previous_pair_pos = previous_pos;
					next = true, blockpos.push(parser_pos - 1), parse_brace(++blocks);
					nexttoken();
					next = tk.type as string === 'TK_RESERVED' && tk.content.toLowerCase() === 'else';
				} else {
					if (tk.type === 'TK_RESERVED' && line_starters.includes(tk.content.toLowerCase())) {
						let t = tk;
						if (lk.content.toLowerCase() !== 'try')
							line_begin_pos = tk.offset;
						next = true;
						if (parse_reserved())
							return else_body;
						if (t === tk || (t === lk && !next && !tk.topofline))
							result.push(...parse_line());
					} else {
						if (tk.type === 'TK_WORD')
							parse_top_word();
						else if (tk.type !== 'TK_EOF')
							lk = EMPTY_TOKEN, next = false, result.push(...parse_line());
						if (line_begin_pos !== undefined)
							_this.linepos[(lk.pos ??= document.positionAt(lk.offset)).line] = line_begin_pos;
					}
					next = tk.type === 'TK_RESERVED' && tk.content.toLowerCase() === 'else';
				}
				if (typeof else_body === 'boolean') {
					if (else_body)
						next = false;
					else if (next) {
						line_begin_pos = tk.offset;
						nexttoken(), next = false;
						parse_body(true, lk.offset);
						return true;
					}
				} else next = false;
				return false;
			}

			function parse_line(types?: any, end?: string, act?: string, min = 0, max = 1): DocumentSymbol[] {
				let b: number, res: DocumentSymbol[] = [], hascomma = 0, t = 0, nk: Token | undefined;
				let info: ParamInfo = { count: 0, comma: [], miss: [], unknown: false };
				if (block_mode = false, next) {
					let t = _this.get_token(parser_pos, true);
					b = t.content ? t.offset : parser_pos + 1;
					if (t.type === 'TK_COMMA')
						info.miss.push(info.count++);
					else if (!t.topofline)
						++info.count, nk = t;
				} else {
					b = tk.content ? tk.offset : lk.offset + lk.length + 1;
					if (tk.type === 'TK_COMMA')
						info.miss.push(info.count++);
					else if (!tk.topofline)
						++info.count, nk = tk;
				}
				while (true) {
					let o: any = {};
					res.push(...parse_expression(undefined, o, 0, end));
					if (tk.type === 'TK_COMMA') {
						next = true, ++hascomma, ++info.count;
						if (lk.type === 'TK_COMMA' || lk.content === '(')
							info.miss.push(info.comma.length);
						else if (lk.type === 'TK_OPERATOR' && !lk.ignore && !lk.content.match(/(--|\+\+|%)/))
							_this.addDiagnostic(diagnostic.unexpected(','), tk.offset, 1);
						info.comma.push(tk.offset);
					} else if (tk.topofline) {
						next = false;
						if (types)
							if (o = Object.keys(o).pop()?.toLowerCase())
								types[o] = true;
						break;
					} else if (end === tk.content)
						break;
					else if (t !== parser_pos)
						_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length), next = false;
					if (t === parser_pos && (!continuation_sections_mode || tk.length))
						break;
					t = parser_pos;
				}
				if (act)
					if (hascomma >= max || (info.count - (tk === nk ? 1 : 0) < min))
						_this.addDiagnostic(diagnostic.acceptparams(act, max === min ? min : `${min}~${max}`), b, lk.offset + lk.length - b);
				if (lk.content === '*')
					info.unknown = true;
				Object.defineProperty(res, 'paraminfo', { value: info, configurable: true });
				return res;
			}

			function parse_sharp() {
				let isdll = false, data = tk.data ?? { content: '', offset: tk.offset + tk.length, length: 0 }, l: string;
				switch (l = tk.content.toLowerCase()) {
					case '#dllload':
						isdll = true;
					case '#include':
					case '#includeagain':
						add_include_dllload(data.content.replace(/`;/g, ';'), data, mode, isdll);
						break;
					case '#dllimport':
						if (m = data.content.match(/^((\w|[^\x00-\x7f])+)/i)) {
							let rg = make_range(data.offset, m[0].length), rg2 = Range.create(0, 0, 0, 0);
							let tps: { [t: string]: string } = { t: 'ptr', i: 'int', s: 'str', a: 'astr', w: 'wstr', h: 'short', c: 'char', f: 'float', d: 'double', I: 'int64' };
							let n = m[0], args: Variable[] = [], arg: Variable | undefined, u = '', i = 0;
							h = true, m = data.content.substring(m[0].length).match(/^\s*,[^,]+,([^,]*)/);
							if (m) {
								for (let c of m[1].replace(/\s/g, '').replace(/^\w*[=@]?=/, '').toLowerCase().replace(/i6/g, 'I')) {
									if (c === 'u')
										u = 'u';
									else {
										if (tps[c])
											args.push(arg = Variable.create(`p${++i}_${u + tps[c]}`, SymbolKind.Variable, rg2)), u = '';
										else if (arg && (c === '*' || c === 'p'))
											arg.name += 'p', arg = undefined;
										else {
											_this.addDiagnostic(diagnostic.invalidparam(), data.offset, data.length);
											return;
										}
									}
								}
							}
							result.push(FuncNode.create(n, SymbolKind.Function, rg, rg, args));
						}
						break;
					case '#requires':
						if (data.content.match(/^AutoHotkey\s+v1/i))
							stop_parse(data, 'This script requires AutoHotkey v1, and the lexer stops parsing.');
						break;
					default:
						if (l.match(/^#(if|hotkey|(noenv|persistent|commentflag|escapechar|menumaskkey|maxmem|maxhotkeysperinterval|keyhistory)\b)/i))
							stop_parse(tk);
						break;
				}
			}

			function parse_statement(local: string) {
				let sta: DocumentSymbol[] | Variable[] = [], bak: Token, pc: Token | undefined, last_comm = '';
				block_mode = false;
				loop:
				while (nexttoken()) {
					if (tk.topofline && !is_line_continue(lk, tk, _parent)) { next = false; break; }
					switch (tk.type) {
						case 'TK_WORD':
							bak = lk, nexttoken();
							if (tk.type as string === 'TK_EQUALS') {
								let vr: Variable | undefined, o: any = {}, equ = tk.content;
								if (bak.type === 'TK_DOT') {
									addprop(lk);
								} else if (addvariable(lk, mode, sta)) {
									vr = sta[sta.length - 1];
									if (pc = comments[vr.selectionRange.start.line])
										vr.detail = trim_comment(pc.content);
								} else if (local)
									_this.addDiagnostic(diagnostic.conflictserr(local, 'built-in variable', lk.content), lk.offset, lk.length);
								result.push(...parse_expression(undefined, o));
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
									_this.addDiagnostic(diagnostic.propnotinit(), lk.offset, lk.length);
									if (tk.topofline && allIdentifierChar.test(tk.content)) {
										lk = EMPTY_TOKEN, next = false;
										break loop;
									}
									if (!tk.topofline && tk.type as string !== 'TK_COMMA')
										parse_expression(',');
									next = false;
									break;
								}
								if (tk.type as string === 'TK_COMMA' || (tk.topofline && !(['TK_COMMA', 'TK_OPERATOR', 'TK_EQUALS'].includes(tk.type) && !tk.content.match(/^(!|~|not)$/i)))) {
									if (addvariable(lk, mode, sta)) {
										let vr = sta[sta.length - 1];
										if (pc = comments[vr.selectionRange.start.line])
											vr.detail = trim_comment(pc.content);
									} else if (local)
										_this.addDiagnostic(diagnostic.conflictserr(local, 'built-in variable', lk.content), lk.offset, lk.length);
									if (tk.type as string !== 'TK_COMMA')
										break loop;
								}
							}
							break;
						case 'TK_COMMA':
							continue;
						case 'TK_UNKNOWN': _this.addDiagnostic(diagnostic.unknowntoken(tk.content), tk.offset, tk.length); break;
						case 'TK_RESERVED':
							if (mode !== 2)
								_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
							next = false, tk.type = 'TK_WORD'; break;
						case 'TK_END_BLOCK':
						case 'TK_END_EXPR': _this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, 1);
						default: break loop;
					}
				}
				return sta;
			}

			function parse_expression(inpair?: string, types: any = {}, mustexp = 1, end?: string): DocumentSymbol[] {
				let pres = result.length, tpexp = '', byref = false, ternarys: number[] = [], t: any, objk: any;
				block_mode = false;
				while (nexttoken()) {
					if (tk.topofline === 1 && !inpair && !is_line_continue(lk, tk, _parent)) {
						if (lk.type === 'TK_WORD' && input.charAt(lk.offset - 1) === '.')
							addprop(lk);
						next = false; break;
					}
					switch (tk.type) {
						case 'TK_WORD':
							let predot = (input.charAt(tk.offset - 1) === '.');
							if (input.charAt(parser_pos) === '(')
								break;
							nexttoken();
							if (tk.type as string === 'TK_COMMA') {
								if (predot)
									addprop(lk), tpexp += '.' + lk.content;
								else if (input.charAt(lk.offset - 1) !== '%') {
									if (addvariable(lk) && byref) {
										let vr = (<Variable>result[result.length - 1]);
										vr.ref = vr.def = true;
									}
									tpexp += ' ' + lk.content;
								} else lk.ignore = true;
								types[tpexp] = true, next = false;
								return result.splice(pres);
							} else if (tk.type as string === 'TK_OPERATOR' && (!tk.topofline || !tk.content.match(/^(!|~|not|\+\+|--)$/i))) {
								if (input.charAt(lk.offset - 1) !== '%' && input.charAt(lk.offset + lk.length) !== '%') {
									if (predot) {
										tpexp += '.' + lk.content;
										addprop(lk);
									} else {
										if (addvariable(lk)) {
											let vr = result[result.length - 1] as Variable;
											vr.returntypes = { '#number': true };
										}
										tpexp += ' ' + lk.content;
									}
								} else if (predot)
									tpexp += '.#any', maybeclassprop(lk, null);
								else
									tpexp += ' #any', lk.ignore = true;
								next = false;
								continue;
							} else if (tk.topofline && (tk.type as string !== 'TK_EQUALS' && tk.type as string !== 'TK_DOT')) {
								next = false;
								if (!predot) {
									if (input.charAt(lk.offset - 1) !== '%') {
										if (addvariable(lk) && byref) {
											let vr = (<Variable>result[result.length - 1]);
											vr.ref = vr.def = true;
											tpexp = tpexp.slice(0, -1) + '#varref';
										} else
											tpexp += ' ' + lk.content;
									} else lk.ignore = true;
									types[tpexp] = true;
								} else if (input.charAt(lk.offset - 1) !== '%') {
									addprop(lk);
									types[tpexp + '.' + lk.content] = true;
								} else
									types['#any'] = true, lk.ignore = true;
								ternaryMiss();
								return result.splice(pres);
							} else if (tk.content === '=>') {
								let o: any = {}, rl = result.length, fl = _parent.funccall.length, p = lk, _mode = mode;
								mode = 1;
								let rg = make_range(p.offset, p.length);
								let sub = parse_expression(inpair, o, mustexp || 1, end ?? (ternarys.length ? ':' : undefined));
								mode = _mode;
								let tn = FuncNode.create('', SymbolKind.Function, make_range(p.offset, lk.offset + lk.length),
									make_range(p.offset, 0), [Variable.create(p.content, SymbolKind.Variable, rg)],
									result.splice(rl).concat(sub));
								tn.funccall = _parent.funccall.splice(fl);
								tn.returntypes = o;
								for (const t in o)
									o[t] = tn.range.end;
								if (mode !== 0)
									tn.parent = _parent;
								adddeclaration(tn), result.push(tn);
								tpexp += ` $${_this.anonymous.push(tn) - 1}`;
								break;
							}
							if (!predot) {
								if (input.charAt(lk.offset - 1) !== '%' && addvariable(lk)) {
									let vr = result[result.length - 1] as Variable;
									if (byref)
										vr.ref = vr.def = true, byref = false;
									if (tk.type as string === 'TK_EQUALS') {
										if (_cm = comments[vr.selectionRange.start.line])
											vr.detail = trim_comment(_cm.content);
										let o: any = {}, equ = tk.content;
										next = true;
										result.push(...parse_expression(inpair, o, mustexp || 1, end ?? (ternarys.length ? ':' : undefined)));
										vr.range = { start: vr.range.start, end: document.positionAt(lk.offset + lk.length) };
										let tp = equ === ':=' ? Object.keys(o).pop()?.toLowerCase() || '#any' : equ === '.=' ? '#string' : '#number';
										vr.returntypes = { [tp]: vr.range.end };
										if (vr.ref)
											tpexp = tpexp.slice(0, -1) + '#varref';
										else
											tpexp += tp, vr.def = true;
										if (equ === ':=' && typeof o[' #object'] === 'object')
											(<any>vr).property = Object.values(o[' #object']);
									} else {
										next = false;
										if (vr.ref)
											tpexp = tpexp.slice(0, -1) + '#varref';
										else tpexp += ' ' + lk.content;
									}
								} else
									tpexp += ' ' + lk.content, next = false, lk.ignore = true;
							} else {
								if (tk.type as string === 'TK_EQUALS') {
									tpexp = tpexp.replace(/\s*\S+$/, ''), next = true;
									if (tk.content === ':=')
										maybeclassprop(lk);
								} else
									tpexp += '.' + lk.content, next = false;
								addprop(lk);
							}
							break;
						case 'TK_START_EXPR':
							if (tk.content === '[') {
								let pre = !!input.charAt(tk.offset - 1).match(/^(\w|\)|%|[^\x00-\x7f])$/);
								parse_pair('[', ']');
								if (pre) {
									tpexp = tpexp.replace(/\S+$/, '') + '#any';
								} else
									tpexp += ' #array';
							} else {
								let fc: Token | undefined, quoteend: number, tpe: any = {}, b = tk.offset;
								let nospace = input.charAt(lk.offset + lk.length) === '(';
								if (lk.type === 'TK_WORD' && nospace)
									if (input.charAt(lk.offset - 1) === '.') {
										let ptk = lk, o: any = {};
										parse_pair('(', ')', undefined, o);
										let tn: CallInfo;
										ptk.semantic = { type: SemanticTokenTypes.method };
										_parent.funccall.push(tn = DocumentSymbol.create(ptk.content, undefined, SymbolKind.Method, make_range(ptk.offset, parser_pos - ptk.offset), make_range(ptk.offset, ptk.length)));
										tn.paraminfo = o.paraminfo, tn.offset = ptk.offset, ptk.callinfo = tn;
										tpexp += '.' + ptk.content + '()', maybeclassprop(ptk, true);
										continue;
									} else fc = lk;
								let rl = result.length, ttk = tk;
								parse_pair('(', ')', tk.offset, tpe), quoteend = parser_pos;
								if (_this.get_token(parser_pos).content === '=>') {
									result.splice(rl), lk = (tk = ttk).previous_token ?? EMPTY_TOKEN;
									parser_pos = tk.offset + 1;
									let par = parse_params(), rs = result.splice(rl);
									let pfl = _parent.funccall.length, bbb = fc ? fc.offset : b;
									quoteend = parser_pos, nexttoken();
									let sub = parse_expression(inpair, o = {}, fc?.topofline ? 2 : mustexp || 1,
										end ?? (ternarys.length ? ':' : undefined));
									if (fc) {
										if (fc.content.match(/^\d/))
											_this.addDiagnostic(diagnostic.invalidsymbolname(fc.content), fc.offset, fc.length);
										fc.semantic = { type: SemanticTokenTypes.function, modifier: 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly };
									} else
										fc = Object.assign({}, EMPTY_TOKEN, { offset: ttk.offset });
									if (!par)
										par = [], _this.addDiagnostic(diagnostic.invalidparam(), bbb, quoteend - bbb);
									let tn = FuncNode.create(fc.content, SymbolKind.Function,
										make_range(fc.offset, parser_pos - fc.offset),
										make_range(fc.offset, fc.length), par, rs.concat(sub));
									result.push(fc.symbol = tn);
									tn.returntypes = o, _this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
									tn.closure = !!(mode & 1), adddeclaration(tn);
									tn.funccall?.push(..._parent.funccall.splice(pfl));
									for (const t in o)
										o[t] = tn.range.end;
									if (mode !== 0)
										tn.parent = _parent;
									if (fc.content)
										tpexp += ' ' + fc.content.toLowerCase();
									else
										tpexp += ` $${_this.anonymous.push(tn) - 1}`;
									types[tpexp] = true;
								} else {
									if (fc) {
										if (input.charAt(fc.offset - 1) !== '%') {
											let tn: CallInfo;
											tpexp += ' ' + fc.content + '()', addvariable(fc);
											fc.semantic = { type: SemanticTokenTypes.function };
											_parent.funccall.push(tn = DocumentSymbol.create(fc.content, undefined, SymbolKind.Function,
												make_range(fc.offset, quoteend - fc.offset), make_range(fc.offset, fc.length)));
											tn.paraminfo = tpe.paraminfo, tn.offset = fc.offset, fc.callinfo = tn;
										} else fc.semantic = { type: SemanticTokenTypes.variable }, fc.ignore = true;
									} else {
										let s = Object.keys(tpe).pop() || '';
										if (input.charAt(quoteend) === '(') {
											let t = s.trim().match(/^\(\s*(([\w.]|[^\x00-\x7f])+)\s*\)$/);
											if (t)
												s = t[1];
										}
										if (nospace) {
											tpexp += tpexp === '' || tpexp.slice(-1).match(/\s/) ? s : '()';
										} else
											tpexp += ' ' + s;
									}
								}
							}
							break;
						case 'TK_START_BLOCK':
							if (tpexp && (!(lk.type === 'TK_OPERATOR' && !lk.content.match(/^(\+\+|--)$/)) && lk.type !== 'TK_EQUALS')) {
								types[tpexp] = (tpexp === ' #object' && objk) ? objk : true;
								next = false, ternaryMiss();
								return result.splice(pres);
							} else {
								let l = _this.diagnostics.length, isobj = false;
								if (lk.type === 'TK_RESERVED' && lk.content.toLowerCase() === 'switch') {
									let t: Token;
									next = false;
									if (tk.topofline || (t = _this.get_token(parser_pos)).topofline || t.type.endsWith('COMMENT')) {
										ternaryMiss();
										return result.splice(pres);
									}
									next = isobj = true;
								} else if (lk.type === 'TK_EQUALS') {
									if (lk.content !== ':=') _this.addDiagnostic(diagnostic.unknownoperatoruse(lk.content), lk.offset, lk.length);
								} else if (mustexp === 1) {
									if (lk.type === 'TK_WORD' || lk.type === 'TK_OPERATOR' || lk.type.startsWith('TK_END'))
										mustexp = 0;
								}
								if (parse_obj(mustexp > 0 || isobj, t = {}, objk = {})) {
									tpexp += ' ' + (Object.keys(t).pop() || '#object'); break;
								} else {
									types[tpexp] = true, _this.diagnostics.splice(l);
									if (tpexp === ' #object' && objk)
										types[tpexp] = objk;
									ternaryMiss(), next = false; return result.splice(pres);
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
							ternaryMiss();
							return result.splice(pres);
						case 'TK_LABEL': _this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length); break;
						case 'TK_UNKNOWN': _this.addDiagnostic(diagnostic.unknowntoken(tk.content), tk.offset, tk.length); break;
						case 'TK_RESERVED': {
							let c = input.charAt(tk.offset + tk.length);
							if (c === '%' || input.charAt(tk.offset - 1) === '%') {
								next = false, tk.type = 'TK_WORD', tk.semantic = { type: SemanticTokenTypes.variable };
								break;
							}
							if (tk.content.match(/^(class|super|isset)$/i)) {
								if (tk.content.toLowerCase() === 'isset') {
									tk.ignore = true;
									if (c !== '(')
										_this.addDiagnostic(diagnostic.missing('('), tk.offset, tk.length);
								}
								next = false, tk.type = 'TK_WORD';
								break;
							}
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
							break;
						}
						case 'TK_OPERATOR':
							if (tk.content === '%') {
								if (input.charAt(tk.offset - 1).match(/\w|[^\x00-\x7f]/))
									tpexp = tpexp.replace(/\S+$/, '#any');
								else if (lk.type === 'TK_DOT')
									tpexp += '.#any', maybeclassprop(tk, null);
								else tpexp += ' #any';
								if (inpair === '%') {
									next = false, types[tpexp] = true;
									if (tpexp === ' #object' && objk)
										types[tpexp] = objk;
									ternaryMiss();
									return result.splice(pres);
								}
								parse_pair('%', '%');
							} else if (tk.content === '=>' && lk.type === 'TK_WORD') {
								if (result.length && result[result.length - 1].name === lk.content)
									result.pop();
								let tn = FuncNode.create('', SymbolKind.Function, make_range(lk.offset, lk.length),
									make_range(lk.offset, 0), [Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length))]);
								let prec = _parent.funccall.length, o: any = {};
								tn.children = parse_expression(inpair, o, 1, end ?? (ternarys.length ? ':' : undefined));
								tn.range.end = document.positionAt(lk.offset + lk.length);
								tn.funccall = _parent.funccall.splice(prec), tn.returntypes = o;
								for (const t in o)
									o[t] = tn.range.end;
								if (mode !== 0)
									tn.parent = _parent;
								result.push(tn), adddeclaration(tn);
								tpexp = tpexp.replace(/\S+$/, `$${_this.anonymous.push(tn) - 1}`);
							} else {
								tpexp += ' ' + tk.content;
								if (allIdentifierChar.test(tk.content) && (input[tk.offset - 1] === '%' || input[tk.offset + tk.length] === '%')) {
									next = false, tk.type = 'TK_WORD', tk.semantic = { type: SemanticTokenTypes.variable };
									tpexp = tpexp.slice(0, -1 - tk.length);
									break;
								}
								if (lk.type === 'TK_OPERATOR' && !lk.content.match(/^([:?%]|\+\+|--|=>)$/) && !tk.content.match(/[+\-%!~]|^not$/i))
									_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, tk.length);
								if (tk.content === '&' && (lk.content === '=>' || ['TK_EQUALS', 'TK_COMMA', 'TK_START_EXPR'].includes(lk.type))) {
									byref = true;
									break;
								} else if (tk.content === '?') {
									if (tk.ignore)
										tpexp = tpexp.slice(0, -2);
									else
										ternarys.push(tk.offset);
								} else if (tk.content === ':')
									if (ternarys.pop() === undefined) {
										if (end === ':' || inswitch === 2) {
											next = false, tpexp = tpexp.slice(0, -2);
											types[tpexp] = true;
											if (tpexp === ' #object' && objk)
												types[tpexp] = objk;
											return result.splice(pres);
										}
										_this.addDiagnostic(diagnostic.unexpected(':'), tk.offset, 1);
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
				ternaryMiss();
				return result.splice(pres);

				function ternaryMiss() {
					let o: number | undefined;
					while ((o = ternarys.pop()) !== undefined)
						_this.addDiagnostic(diagnostic.missing(':'), o, 1);
				}
			}

			function parse_params(types: any = {}, endc = ')') {
				let paramsdef = true, beg = parser_pos - 1, cache: Variable[] = [], rg, la = [',', endc === ')' ? '(' : '['];
				let byref = false, tpexp = '', info: ParamInfo = { count: 0, comma: [], miss: [], unknown: false }, cmm;
				let bb = parser_pos, bak = tk, hasexpr = false;
				block_mode = false;
				while (nexttoken()) {
					if (tk.content === endc) {
						if (lk.type === 'TK_COMMA') {
							types['#void'] = true, tk.previous_pair_pos = beg;;
							info.miss.push(info.count++);
							Object.defineProperty(types, 'paraminfo', { value: info, configurable: true });
							result.push(...cache);
							return;
						}
						break;
					} else if (tk.type === 'TK_WORD') {
						if (is_builtinvar(tk.content.toLowerCase())) {
							paramsdef = false; break;
						}
						info.count++;
						if (la.includes(lk.content)) {
							nexttoken();
							if (tk.content === ',' || tk.content === endc) {
								if (lk.content.match(/^\d/))
									_this.addDiagnostic(diagnostic.invalidsymbolname(lk.content), lk.offset, lk.length);
								let tn = Variable.create(lk.content, SymbolKind.Variable, rg = make_range(lk.offset, lk.length));
								if (_cm = comments[tn.selectionRange.start.line])
									tn.detail = trim_comment(_cm?.content);
								if (byref)
									byref = false, (<Variable>tn).ref = (<Variable>tn).def = true, tpexp = '#varref';
								else tpexp = tn.name;
								cache.push(tn), bb = parser_pos, bak = tk;
								if (tk.content === ',')
									info.comma.push(tk.offset);
								else break;
							} else if (tk.content === ':=') {
								let ek = tk, o: any;
								if (lk.content.match(/^\d/))
									_this.addDiagnostic(diagnostic.invalidsymbolname(lk.content), lk.offset, lk.length);
								let tn = Variable.create(lk.content, SymbolKind.Variable, rg = make_range(lk.offset, lk.length));
								if (_cm = comments[tn.selectionRange.start.line])
									tn.detail = trim_comment(_cm.content);
								tn.def = true, tn.defaultVal = null, cache.push(tn);
								result.push(...parse_expression(',', o = {}, 2)), next = true;
								bb = parser_pos, bak = tk;
								let t = Object.keys(o).pop();
								if (t) {
									t = t.trim().toLowerCase();
									if (t === '#string') {
										tn.defaultVal = tokens[ek.next_token_offset].content;
									} else if (t === 'true' || t === 'false')
										tn.defaultVal = t;
									else if (t.match(/^([-+]\s)?#number$/)) {
										if (t.charAt(0) === '#')
											tn.defaultVal = tokens[ek.next_token_offset].content;
										else {
											let t = tokens[ek.next_token_offset];
											tn.defaultVal = t.content + tokens[t.next_token_offset].content;
										}
									} else if (t !== 'unset')
										tn.range_offset = [ek.offset, tk.offset], hasexpr = true;
								}
								if (byref)
									byref = false, tn.ref = true, tpexp = '#varref', tn.returntypes = { '#varref': true };
								else tpexp = Object.keys(o).pop() ?? '#void', tn.returntypes = o;
								if (tk.type as string === 'TK_COMMA') {
									info.comma.push(tk.offset);
									continue;
								} else {
									paramsdef = (tk as Token).content === endc;
									break;
								}
							} else if (tk.type as string === 'TK_OPERATOR') {
								if (tk.content === '*') {
									let t = lk;
									nexttoken();
									if (tk.content === endc) {
										tn = Variable.create(t.content, SymbolKind.Variable, rg = make_range(t.offset, t.length));
										cache.push(tn), (<any>tn).arr = true, info.unknown = true, bb = parser_pos, bak = tk;
										break;
									} else { paramsdef = false, info.count--; break; }
								} else if (tk.content === '?' && tk.ignore) {
									let t = lk;
									tn = Variable.create(lk.content, SymbolKind.Variable, rg = make_range(lk.offset, lk.length));
									(<Variable>tn).def = true, (<Variable>tn).defaultVal = null, cache.push(tn);
									if (byref) byref = false, (<Variable>tn).ref = true, tpexp = '#varref';
									else tpexp = lk.content;
									nexttoken();
									if (tk.type as string === 'TK_COMMA') {
										if (t.content.match(/^\d/)) _this.addDiagnostic(diagnostic.invalidsymbolname(t.content), t.offset, t.length);
										info.comma.push(tk.offset), bb = parser_pos, bak = tk;
										continue;
									} else {
										if (!(paramsdef = tk.content === endc))
											cache.pop(), info.count--;
										break;
									}
								} else { paramsdef = false, info.count--; break; }
							} else { paramsdef = false, info.count--; break; }
						} else { paramsdef = false, info.count--; break; }
					} else if (la.includes(lk.content)) {
						if (tk.content === '*') {
							let t = tk;
							nexttoken();
							if (tk.content === endc) {
								cache.push(Variable.create('*', SymbolKind.Null, rg = make_range(0, 0)));
								break;
							} else _this.addDiagnostic(diagnostic.unexpected('*'), t.offset, 1);
						} else if (tk.content === '&') {
							let t = tk;
							tk = get_token_ignore_comment();
							if (tk.type === 'TK_WORD') {
								byref = true, next = false; continue;
							} else _this.addDiagnostic(diagnostic.unexpected('&'), t.offset, 1);
						}
						paramsdef = false; break;
					} else {
						paramsdef = false; break;
					}
				}
				if (paramsdef) {
					if (endc === ')') {
						types[tpexp.toLowerCase()] = true;
						Object.defineProperty(types, 'paraminfo', { value: info, configurable: true });
					}
					if (hasexpr)
						Object.defineProperty(cache, 'format', { value: format_params_default_val.bind(undefined, _this.tokens), configurable: true });
					tk.previous_pair_pos = beg;
					_this.addFoldingRange(beg, parser_pos, 'block');
					return cache;
				} else {
					result.push(...cache);
					parser_pos = bb, tk = bak;
					Object.defineProperty(types, 'paraminfo', { value: info, configurable: true });
					parse_pair(endc === ')' ? '(' : '[', endc, beg, types);
					return;
				}
			}

			function parse_obj(must: boolean = false, tp: any = {}, ks: any = {}): boolean {
				let l = lk, b = tk, rl = result.length, isobj = true;
				let ts: any = {}, k: Token | undefined, nk: Token;
				block_mode = false, next = true, tk.data = ks;
				while (objkey())
					if (objval())
						break;
				if (!isobj) {
					let e = tk;
					lk = l, tk = b, result.splice(rl);
					parser_pos = tk.skip_pos ?? tk.offset + tk.length;
					if (must) {
						parse_errobj(), tk.previous_pair_pos = b.offset;
						_this.addDiagnostic(diagnostic.objectliteralerr(), e.offset, parser_pos - e.offset);
						return true;
					}
					return next = false;
				} else if (lk.content === ':' || lk.type === 'TK_LABEL')
					_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
				if (tk.type === 'TK_END_BLOCK')
					_this.addFoldingRange(tk.previous_pair_pos = b.offset, tk.offset), b.next_pair_pos = tk.offset;
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
								nexttoken();
								if (tk.content === ':') {
									lk.semantic = { type: SemanticTokenTypes.property };
									k = lk, ks[lk.content.toLowerCase()] = lk.content;
									return true;
								}
								return isobj = false;
							case 'TK_STRING':
								nexttoken();
								if (tk.content === ':') {
									_this.addDiagnostic(diagnostic.invalidpropname(), lk.offset, lk.length);
									return true;
								}
								return isobj = false;
							case 'TK_OPERATOR':
								if (tk.content === '%') {
									parse_pair('%', '%');
									if (isIdentifierChar(input.charCodeAt(parser_pos)))
										break;
									else {
										nexttoken();
										if (tk.content as string === ':')
											return true;
									}
								} else if (allIdentifierChar.test(tk.content)) {
									nexttoken();
									if (tk.content === ':') {
										lk.semantic = { type: SemanticTokenTypes.property };
										lk.type = 'TK_WORD', k = lk, ks[lk.content.toLowerCase()] = lk.content;
										return true;
									}
								}
								return isobj = false;
							case 'TK_LABEL':
								if (tk.content.match(/^(\w|[^\x00-\x7f])+:$/)) {
									let t: string;
									addtext(t = tk.content.replace(':', ''));
									ks[t.toLowerCase()] = t;
									return true;
								}
								return isobj = false;
							case 'TK_END_BLOCK':
								if (lk.type === 'TK_START_BLOCK' || lk.type === 'TK_COMMA')
									return false;
							case 'TK_NUMBER':
								if (allIdentifierChar.test(tk.content)) {
									nexttoken();
									if (tk.content === ':') {
										lk.type = 'TK_WORD', k = lk, ks[lk.content.toLowerCase()] = lk.content;
										lk.semantic = { type: SemanticTokenTypes.property };
										return true;
									}
								}
							case 'TK_START_EXPR':
								return isobj = false;
							case 'TK_COMMA':
								if (lk.type === 'TK_COMMA' || lk.type === 'TK_START_BLOCK')
									return true;
							default:
								return isobj = false;
						}
					}
					return false;
				}

				function objval(): boolean {
					let exp = parse_expression(',', ts = {});
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

			function parse_errobj() {
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

			function parse_pair(b: string, e: string, pairbeg?: number, types: any = {}, strs?: Token[]) {
				let pairnum = 0, apos = result.length, tp = parser_pos, llk = lk, pairpos = [pairbeg ?? tk.offset];
				let rpair = 0, tpexp = '', byref = false, ternarys: number[] = [];
				let info: ParamInfo = { count: 0, comma: [], miss: [], unknown: false };
				if (block_mode = false, types.paraminfo) {
					info = types.paraminfo;
					delete types.paraminfo;
				}
				while (nexttoken()) {
					if (b === '%' && tk.topofline && !(['TK_COMMA', 'TK_OPERATOR', 'TK_EQUALS'].includes(tk.type) && !tk.content.match(/^(!|~|not)$/i))) {
						_this.addDiagnostic(diagnostic.missing('%'), pairpos[0], 1);
						next = false, tpexp = '#any'; break;
					}
					if (b !== '(' && tk.content === '(') {
						apos = result.length, tp = parser_pos, rpair = 1, llk = lk;
						parse_pair('(', ')');
					} else if (tk.content === e) {
						tokens[tk.previous_pair_pos = pairpos.pop() as number].next_pair_pos = tk.offset;
						if (e !== '%')
							_this.addFoldingRange(tk.previous_pair_pos as number, tk.offset + 1, 'block');
						if ((--pairnum) < 0)
							break;
						if (e === ')')
							tpexp += ')', rpair++;
					}
					else if (tk.content === b) {
						if (b === '(') {
							if (input.charAt(tk.offset - 1) === ')') {
								parse_pair('(', ')', tk.offset, o = {});
								tpexp += '()';
								continue;
							}
							apos = result.length, tp = parser_pos, rpair = 0, tpexp += '(';
						}
						pairnum++, pairpos.push(parser_pos - 1), llk = lk;
					} else if (tk.content === '=>') {
						let rs = result.splice(apos), bb = tk, par: DocumentSymbol[] | undefined, nk: Token, b = -1;
						if (lk.content === ')') {
							if (rpair !== 1) {
								_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, 2), next = true;
								continue;
							}
							lk = llk, parser_pos = tp - 1, tk = get_next_token(), b = tk.offset;
							par = parse_params();
							if (!par) { par = [], _this.addDiagnostic(diagnostic.invalidparam(), b, tk.offset - b + 1); }
							nk = get_token_ignore_comment();
						} else if (lk.type === 'TK_WORD' && input.charAt(lk.offset - 1) !== '.') {
							let rg: Range;
							nk = tk, b = lk.offset;
							par = [Variable.create(lk.content, SymbolKind.Variable, rg = make_range(lk.offset, lk.length))];
						} else {
							_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, 2), next = true;
							continue;
						}
						if (nk.content !== '=>') {
							tk = bb, parser_pos = bb.offset + bb.length, next = true, tpexp = '', result.push(...rs);
							_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, 2);
							continue;
						}
						rs = result.splice(apos);
						let prec = _parent.funccall.length, sub = parse_expression(e, undefined, 1, ternarys.length ? ':' : undefined);
						let tn = FuncNode.create('', SymbolKind.Function, make_range(b, lk.offset + lk.length - b),
							make_range(b, 0), par, rs.concat(sub));
						result.push(tn), adddeclaration(tn), tn.funccall = _parent.funccall.splice(prec);
						for (const t in o)
							o[t] = tn.range.end;
						if (mode !== 0)
							tn.parent = _parent;
						tpexp = tpexp.replace(/\([^()]*\)$/, '') + ` $${_this.anonymous.push(tn as FuncNode) - 1}`;
					} else if (tk.type === 'TK_WORD') {
						if (input.charAt(tk.offset - 1) !== '.') {
							if (input.charAt(parser_pos) !== '(') {
								if (b === '%' || (input.charAt(tk.offset - 1) !== '%' && input.charAt(tk.offset + tk.length) !== '%')) {
									if (addvariable(tk)) {
										let vr = result[result.length - 1] as Variable;
										nexttoken(), next = false;
										if (byref)
											vr.ref = vr.def = true, byref = false;
										if (tk.type as string === 'TK_EQUALS') {
											if (_cm = comments[vr.selectionRange.start.line])
												vr.detail = trim_comment(_cm.content);
											let o: any = {}, equ = tk.content;
											next = true;
											result.push(...parse_expression(e, o, 2, ternarys.length ? ':' : undefined));
											vr.range = { start: vr.range.start, end: document.positionAt(lk.offset + lk.length) };
											let tp = equ === ':=' ? Object.keys(o).pop()?.toLowerCase() || '#any' : equ === '.=' ? '#string' : '#number'
											vr.returntypes = { [tp]: vr.range.end };
											if (vr.ref)
												tpexp = tpexp.slice(0, -1) + '#varref';
											else tpexp += tp, vr.def = true;
											if (equ === ':=' && typeof o[' #object'] === 'object')
												(<any>vr).property = Object.values(o[' #object']);
										} else if (vr.ref)
											tpexp = tpexp.slice(0, -1) + '#varref';
										else tpexp += ' ' + lk.content;
									} else
										tpexp += ' ' + tk.content;
								} else tk.ignore = true;
							} else {
								lk = tk, tk = get_next_token(), lk.semantic = { type: SemanticTokenTypes.function };
								let fc = lk, rl = result.length, o: any = {}, par = parse_params(o), quoteend = parser_pos;
								nexttoken();
								if (tk.content === '=>') {
									let o: any = {}, pp = _parent;
									if (!par) { _this.addDiagnostic(diagnostic.invalidparam(), fc.offset, tk.offset - fc.offset + 1); }
									let tn = FuncNode.create(fc.content, SymbolKind.Function, make_range(fc.offset, parser_pos - fc.offset),
										make_range(fc.offset, fc.length), <Variable[]>par || []);
									if (fc.content.match(/^\d/))
										_this.addDiagnostic(diagnostic.invalidsymbolname(fc.content), fc.offset, fc.length);
									fc.symbol = _parent = tn, tn.children = result.splice(rl).concat(parse_expression(e, o, 2, ternarys.length ? ':' : undefined));
									(fc.semantic as SemanticToken).modifier = 1 << SemanticTokenModifiers.definition | 1 << SemanticTokenModifiers.readonly;
									_parent = pp, tn.range.end = document.positionAt(lk.offset + lk.length), tn.closure = !!(mode & 1);
									tn.returntypes = o, adddeclaration(tn);
									for (const t in o)
										o[t] = tn.range.end;
									if (mode !== 0)
										tn.parent = _parent;
									result.push(tn), _this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
									if (fc.content)
										tpexp += ' ' + fc.content.toLowerCase();
									else
										tpexp += ` $${_this.anonymous.push(tn) - 1}`;
								} else {
									if (input.charAt(fc.offset - 1) !== '%') {
										let tn: CallInfo;
										addvariable(fc), _parent.funccall.push(tn = DocumentSymbol.create(fc.content, undefined, SymbolKind.Function, make_range(fc.offset, quoteend - fc.offset), make_range(fc.offset, fc.length)));
										tn.paraminfo = o.paraminfo, tn.offset = fc.offset, fc.callinfo = tn;
										tpexp += ' ' + fc.content + '()', fc.semantic = { type: SemanticTokenTypes.function };
									} else
										fc.semantic = { type: SemanticTokenTypes.variable }, fc.ignore = true;
									next = false;
									if (par) for (const it of par) if (!is_builtinvar(it.name.toLowerCase())) {
										result.push(it);
										if ((<Variable>it).ref || (<Variable>it).returntypes)
											(<Variable>it).def = true;
									}
								}
							}
						} else if (input.charAt(parser_pos) === '(') {
							let ptk = tk, o: any = {};
							tk = get_next_token(), ptk.semantic = { type: SemanticTokenTypes.method };
							parse_pair('(', ')', undefined, o);
							let tn: CallInfo;
							tpexp += '.' + ptk.content + '()', ptk.semantic = { type: SemanticTokenTypes.method };
							_parent.funccall.push(tn = DocumentSymbol.create(ptk.content, undefined, SymbolKind.Method, make_range(ptk.offset, parser_pos - ptk.offset), make_range(ptk.offset, ptk.length)));
							tn.paraminfo = o.paraminfo, tn.offset = ptk.offset, ptk.callinfo = tn;
							maybeclassprop(ptk, true);
						} else {
							addprop(tk);
							nexttoken(), next = false;
							if (tk.content === ':=')
								maybeclassprop(lk);
						}
					} else if (tk.type === 'TK_START_BLOCK') {
						let t: any = {};
						if (['TK_WORD', 'TK_STRING', 'TK_NUMBER'].includes(lk.type))
							_this.addDiagnostic(diagnostic.unexpected('{'), tk.offset, tk.length);
						parse_obj(true, t);
						tpexp += ' ' + (Object.keys(t).pop() || '#object');
					} else if (tk.type === 'TK_STRING') {
						tpexp += ' #string';
						strs?.push(tk);
						if (b === '[' && is_next(']') && !tk.content.match(/\n|`n/))
							addtext(tk.content.substring(1, tk.content.length - 1));
					} else if (tk.content === '[') {
						let pre = !!input.charAt(tk.offset - 1).match(/^(\w|\)|%|[^\x00-\x7f])$/);
						parse_pair('[', ']');
						if (pre)
							tpexp = tpexp.replace(/\S+$/, '') + '#any';
						else
							tpexp += ' #array';
					} else if (tk.content === '%') {
						if (input.charAt(tk.offset - 1).match(/\w|[^\x00-\x7f]/))
							tpexp = tpexp.replace(/\S+$/, '#any');
						else
							tpexp += ' #any';
						parse_pair('%', '%');
					} else if (tk.content.match(/^[)}]$/)) {
						pairMiss(), next = false;
						types[tpexp.indexOf('#any') < 0 ? '(' + tpexp + ')' : '#any'] = true;
						ternaryMiss();
						return;
					} else if (tk.type === 'TK_RESERVED') {
						let c = input.charAt(tk.offset + tk.length);
						if (b !== '%' && (c === '%' || input.charAt(tk.offset - 1) === '%')) {
							next = false, tk.type = 'TK_WORD', tk.semantic = { type: SemanticTokenTypes.variable };
							continue;
						}
						if (tk.content.match(/^(class|super|isset)$/i)) {
							if (tk.content.toLowerCase() === 'isset') {
								tk.ignore = true;
								if (c !== '(')
									_this.addDiagnostic(diagnostic.missing('('), tk.offset, tk.length);
							}
							next = false, tk.type = 'TK_WORD';
							continue;
						}
						_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
					} else if (tk.type === 'TK_END_BLOCK' || tk.type === 'TK_END_EXPR')
						_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, 1);
					else if (tk.type === 'TK_COMMA') {
						if (b !== '(') tpexp += ' ,';
						else if (pairnum === 0) {
							tpexp = '', ++info.count;
							if (lk.type === 'TK_COMMA' || lk.content === '(')
								info.miss.push(info.comma.length);
							else if (lk.type === 'TK_OPERATOR' && !lk.ignore && !lk.content.match(/(--|\+\+|%)/))
								_this.addDiagnostic(diagnostic.unexpected(','), tk.offset, 1);
							info.comma.push(tk.offset);
						} else {
							let p = tpexp.lastIndexOf('(');
							tpexp = p < 0 ? '' : tpexp.substring(0, p + 1);
						}
					} else if (tk.type === 'TK_NUMBER')
						tpexp += ' #number';
					else if (tk.type === 'TK_OPERATOR') {
						tpexp += ' ' + tk.content;
						if (tk.content === '&') {
							byref = true;
							continue;
						} else if (tk.content === '?') {
							if (tk.ignore)
								tpexp = tpexp.slice(0, -2);
							else
								ternarys.push(tk.offset);
						} else if (tk.content === ':' && ternarys.pop() === undefined)
							_this.addDiagnostic(diagnostic.unexpected(':'), tk.offset, 1);
						else if (b !== '%' && allIdentifierChar.test(tk.content) && (input[tk.offset - 1] === '%' || input[tk.offset + tk.length] === '%')) {
							next = false, tk.type = 'TK_WORD', tk.semantic = { type: SemanticTokenTypes.variable };
							tpexp = tpexp.slice(0, -1 - tk.length);
						}
					}
					byref = false;
				}
				types[b + tpexp + e] = true;
				if (tk.type === 'TK_EOF' && pairnum > -1)
					pairMiss();
				else if (b === '(') {
					if (lk.content === ',')
						info.miss.push(info.count++);
					else if (lk.content !== '(') {
						info.count++;
						if (lk.content === '*')
							info.unknown = true;
					}
					Object.defineProperty(types, 'paraminfo', { value: info, configurable: true });
					let t = tokens[tk.previous_pair_pos as number];
					t.next_pair_pos = tk.offset;
					if (t.ignore === undefined)
						t.data = info;
				}
				ternaryMiss();

				function ternaryMiss() {
					let o: number | undefined;
					while ((o = ternarys.pop()) !== undefined)
						_this.addDiagnostic(diagnostic.missing(':'), o, 1);
				}
				function pairMiss() {
					let o: number | undefined;
					while ((o = pairpos.pop()) !== undefined)
						_this.addDiagnostic(diagnostic.missing(e), o, 1);
				}
			}

			function maybeclassprop(tk: Token, flag: boolean | null = false) {
				if (classfullname === '')
					return;
				let rg: Range, ts = tk.previous_token?.previous_token;
				if (!ts || input.charAt(ts.offset - 1) === '.')
					return;
				_low = ts.content.toLowerCase();
				if (_low !== 'this' && _low !== 'super')
					return;
				let p = _parent, s = false;
				if (flag) {
					let pi = (tk.callinfo as CallInfo).paraminfo as ParamInfo;
					if (tk.content.toLowerCase() === 'defineprop' && pi.count > 1 && pi.miss[0] !== 0) {
						get_class();
						if (p && p.kind === SymbolKind.Class) {
							let end = pi.comma[0], nk = tokens[tk.next_token_offset];
							if (input.charAt(tk.offset + tk.length) === '(')
								nk = tokens[nk.next_token_offset];
							if (nk.type !== 'TK_STRING' || nk.next_token_offset !== end)
								(<any>p).checkmember = false;
							else {
								let o = tokens[tokens[end].next_token_offset], prop = nk.content.slice(1, -1);
								let t = Variable.create(prop, SymbolKind.Property, rg = make_range(nk.offset + 1, prop.length));
								p.cache.push(t), t.static = s;
								if (o.type === 'TK_START_BLOCK' && o.data?.call)
									t.kind = SymbolKind.Method;
								return t;
							}
						}
					}
				} else {
					get_class();
					if (p && p.kind === SymbolKind.Class) {
						if (flag === null)
							return (p as any).checkmember = false, undefined;
						let t = Variable.create(tk.content, SymbolKind.Property, rg = make_range(tk.offset, tk.length));
						t.static = s, p.cache.push(t), t.def = false;
						return t;
					}
				}
				return undefined;

				function get_class() {
					if (p.kind === SymbolKind.Method || p.kind === SymbolKind.Function) {
						while (p && p.kind !== SymbolKind.Class) {
							if (p.kind === SymbolKind.Method && p.static)
								s = true;
							p = p.parent;
						}
					}
				}
			}

			function is_builtinvar(name: string, mode = 0): boolean {
				if (mode === 2)
					return false;
				if (builtin_variable.includes(name) || (h && builtin_variable_h.includes(name)))
					return true;
				return false;
			}

			function addvariable(token: Token, md: number = 0, p?: DocumentSymbol[]): boolean {
				let _low = token.content.toLowerCase();
				if (token.ignore || is_builtinvar(_low, md)) {
					if (token.semantic)
						delete token.semantic;
					token.ignore = true;
					return false;
				}
				let rg = make_range(token.offset, token.length), tn = Variable.create(token.content, SymbolKind.Variable, rg);
				if (md === 2) {
					tn.kind = SymbolKind.Property;
					addprop(token);
					if (classfullname) tn.full = `(${classfullname.slice(0, -1)}) ${tn.name}`;
					// tn.def = true;
				} else if (_low.match(/^\d/))
					_this.addDiagnostic(diagnostic.invalidsymbolname(token.content), token.offset, token.length);
				if (p) p.push(tn); else result.push(tn);
				return true;
			}

			function addprop(tk: Token) {
				let l = tk.content.toLowerCase(), rg: Range;
				tk.semantic = { type: SemanticTokenTypes.property };
				if (!_this.object.property[l])
					_this.object.property[l] = Variable.create(tk.content, SymbolKind.Property, rg = make_range(tk.offset, tk.length));
			}

			function addtext(text: string) {
				_this.texts[text.toLowerCase()] = text;
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
							} else if (it.kind !== SymbolKind.Property || (<Variable>it).def)
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
								if (!(_low = it.name.toLowerCase()))
									return;
								if (!dec[_low]) {
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
							if (it.defaultVal !== undefined || it.arr)
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
								if (!(_low = it.name.toLowerCase()))
									return;
								if (!dec[_low]) {
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
							if (it.defaultVal !== undefined || it.arr)
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
					for (const n of ['this', 'super']) {
						if (node.declaration[n]) {
							let t: FuncNode | undefined = node as FuncNode;
							while (t && (t.kind === SymbolKind.Method || t.kind === SymbolKind.Function)) {
								if (t.local[n] || t.global[n])
									t = undefined;
								else t = t.parent as FuncNode;
							}
							if (t && t.kind === SymbolKind.Class)
								delete node.declaration[n];
						}
					}
					if ((<FuncNode>node).assume === FuncScope.STATIC) {
						let loc = (node as FuncNode).local, it: Variable;
						for (const n in dec)
							if (!loc[n] && (it = dec[n] as Variable).def && it.kind === SymbolKind.Variable)
								it.static = null;
					}
				}
			}

			function nexttoken() {
				if (next) return lk = tk, next = (tk = get_token_ignore_comment()).type !== 'TK_EOF';
				else return next = tk.type !== 'TK_EOF';
			}

			function stop_parse(tk: Token, message = 'This might be a v1 script, and the lexer stops parsing.') {
				if (!extsettings.DisableV1Script) {
					if (tk.type === 'TK_WORD') {
						nexttoken();
						while (' \t'.includes(input.charAt(parser_pos) || '\0'))
							parser_pos++;
						let next_LF = input.indexOf('\n', parser_pos);
						if (next_LF < 0)
							next_LF = input_length;
						lk = tk, tk = createToken(input.substring(parser_pos, next_LF), 'TK_STRING', parser_pos, next_LF - parser_pos, 0);
						parser_pos = next_LF;
					}
					return;
				}
				_this.clear(), parser_pos = input_length;
				throw new ParseStopError(message, tk);
			}
		}

		function add_include_dllload(text: string, tk?: Token, mode = 0, isdll = false) {
			let m: any, raw: string, ignore = false, q = text[0];
			if (`'"`.includes(q) && text.endsWith(q))
				text = text.slice(1, -1);
			if (m = text.match(/^(\*[iI]\s)?(.*)$/)) {
				raw = m[2], ignore = Boolean(m[1]);
				m = raw.replace(/%(a_scriptdir|a_workingdir)%/i, _this.scriptdir)
					.replace(/%a_linefile%/i, filepath);
				if (tk)
					_this[isdll ? 'dlldir' : 'includedir'].set(_this.document.positionAt(tk.offset).line, isdll ? dlldir : includedir);
				if (!m.trim()) {
					if (isdll)
						dlldir = '';
					else if (tk)
						_this.addDiagnostic(diagnostic.pathinvalid(), tk.offset, tk.length);
				} else if (!inBrowser) {
					if (isdll) {
						if (existsSync(m) && statSync(m).isDirectory())
							dlldir = m.endsWith('/') || m.endsWith('\\') ? m : m + '\\';
						else {
							if (!m.match(/\.\w+$/))
								m = m + '.dll';
							if (m.includes(':'))
								_this.dllpaths.push(m.replace(/\\/g, '/').toLowerCase());
							else _this.dllpaths.push((dlldir && existsSync(dlldir + m) ? dlldir + m : m).replace(/\\/g, '/').toLowerCase());
						}
					} else {
						if (tk) {
							if (m.startsWith('*'))
								_this.addDiagnostic(diagnostic.unsupportresinclude(), tk.offset, tk.length, DiagnosticSeverity.Warning);
							else if (!(m = pathanalyze(m.toLowerCase(), _this.libdirs, includedir)) || !existsSync(m.path)) {
								if (!ignore)
									_this.addDiagnostic(m ? diagnostic.filenotexist(m.path) : diagnostic.pathinvalid(), tk.offset, tk.length);
							} else if (statSync(m.path).isDirectory())
								includedir = m.path;
							else
								includetable[m.uri] = m.path, tk.data = [m.path, m.uri];
							if (mode !== 0) _this.addDiagnostic(diagnostic.unsupportinclude(), tk.offset, tk.length, DiagnosticSeverity.Warning);
						} else if ((m = pathanalyze(m.toLowerCase().replace(/(\.d)?>$/, '.d>'), _this.libdirs, _this.scriptpath)) && existsSync(m.path) && !statSync(m.path).isDirectory())
							includetable[m.uri] = m.path;
					}
				}
			} else if (text && tk)
				_this.addDiagnostic(diagnostic.pathinvalid(), tk.offset, tk.length);
		}

		function trim_comment(comment: string): string {
			if (comment.startsWith(';'))
				return comment.replace(/^\s*;\s*/gm, '');
			let c = comment.split(/\r?\n/), jsdoc = comment.startsWith('/**');
			if (!(c[0] = c[0].replace(/^\/\*+\s*/, '')))
				c.splice(0, 1);
			if (!(c[c.length - 1] = c[c.length - 1].replace(/\s*\*+\/\s*$/, '')))
				c.pop();
			if (!jsdoc)
				return c.join('\n');
			return c.map(l => l.replace(/^\s*\*(\s*(?=@)| ?)/, '')).join('\n');
		}

		function make_range(offset: number, length: number): Range {
			return Range.create(_this.document.positionAt(offset), _this.document.positionAt(offset + length));
		}

		function createToken(content: string, type: string, offset: number, length: number, topofline: number): Token {
			let c = input.charAt(offset - 1);
			let tk: Token = { content, type, offset, length, topofline, previous_token: lst, next_token_offset: -1, prefix_is_whitespace: whitespace.includes(c) ? c : undefined };
			_this.tokens[offset] = tk;
			lst.next_token_offset = offset;
			return tk;
		}

		function create_flags(flags_base: any, mode: any) {
			let indentation_level = 0, had_comment = 0;
			let last_text = '', last_word = '', in_expression = [MODE.ArrayLiteral, MODE.Expression, MODE.ObjectLiteral].includes(mode);
			if (flags_base) {
				indentation_level = flags_base.indentation_level;
				had_comment = flags_base.had_comment;
				last_text = flags_base.last_text;
				last_word = flags_base.last_word;
				in_expression ||= flags_base.in_expression;
			}

			let next_flags = {
				case_body: false,
				catch_block: false,
				declaration_statement: false,
				else_block: false,
				finally_block: false,
				had_comment,
				if_block: false,
				in_case_statement: false,
				in_case: false,
				in_expression,
				indentation_level,
				last_text,
				last_word,
				loop_block: 0,
				mode,
				parent: flags_base,
				start_line_index: output_lines.length,
				ternary_depth: 0,
				try_block: false
			};
			return next_flags;
		}

		// Using object instead of string to allow for later expansion of info about each line
		function create_output_line() {
			return { text: [], indent: 0 };
		}

		function trim_newlines() {
			if (continuation_sections_mode)
				return;
			let line = output_lines.pop();
			while (line?.text.length === 0)
				line = output_lines.pop();
			line && output_lines.push(line);
			flags.had_comment && output_lines.push(create_output_line());
		}

		function just_added_newline(): boolean {
			let line = output_lines[output_lines.length - 1];
			return line.text.length === 0;
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
				print_newline(true);
			}
		}

		function print_newline(preserve_statement_flags = false): void {
			if (!preserve_statement_flags) {
				if (last_type !== 'TK_COMMA' && last_type !== 'TK_EQUALS' && (last_type !== 'TK_OPERATOR' || ['++', '--', '%'].includes(flags.last_text))) {
					while (flags.mode === MODE.Statement && (flags.declaration_statement || !flags.if_block && !flags.loop_block && !flags.try_block))
						restore_mode();
				}
			}

			if (!just_added_newline())
				output_lines.push(create_output_line());
		}

		function print_token(printable_token?: string): void {
			let line = output_lines[output_lines.length - 1];
			if (!line.text.length) {
				if (opt.keep_array_indentation && is_array(flags.mode) && input_wanted_newline) {
					if (preindent_string)
						line.text.push(preindent_string);
					if (is_expression(flags.parent.mode))
						print_indent_string(flags.parent.indentation_level);
					else print_indent_string(flags.indentation_level);
				} else {
					if (preindent_string)
						line.text.push(preindent_string);
					print_indent_string(flags.indentation_level);
				}
			} else if (output_space_before_token)
				line.text.push(' ');
			output_space_before_token = false;
			line.text.push(printable_token ?? token_text);

			function print_indent_string(level: number) {
				if (level)
					line.text.push(indent_string.repeat(line.indent = level));
			}
		}

		function indent(): void {
			flags.indentation_level += 1;
		}

		function deindent(): void {
			if (flags.indentation_level > 0 &&
				((!flags.parent) || flags.indentation_level > flags.parent.indentation_level))
				flags.indentation_level -= 1;
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

		function is_array(mode: string): boolean {
			return mode === MODE.ArrayLiteral;
		}

		function is_expression(mode: string): boolean {
			return [MODE.Expression, MODE.Conditional].includes(mode);
		}

		function restore_mode(): void {
			if (flag_store.length > 0) {
				previous_flags = flags;
				flags = flag_store.pop();
			}
		}

		function start_of_object_property(): boolean {
			return flags.parent.mode === MODE.ObjectLiteral && flags.mode === MODE.Statement && flags.last_text === ':' &&
				flags.ternary_depth === 0;
		}

		function start_of_statement(): boolean {
			if ((last_type === 'TK_RESERVED' && ['try', 'else', 'finally'].includes(flags.last_text)) ||
				(last_type === 'TK_END_EXPR' && previous_flags.mode === MODE.Conditional) ||
				(last_type === 'TK_WORD' && flags.mode === MODE.BlockStatement && (
					(!input_wanted_newline && ck.previous_token?.callinfo) ||
					!flags.in_case && !['TK_WORD', 'TK_RESERVED', 'TK_START_EXPR'].includes(token_type) && !['--', '++', '%'].includes(token_text)
				)) || (flags.declaration_statement) ||
				(flags.mode === MODE.ObjectLiteral && flags.last_text === ':' && flags.ternary_depth === 0)) {

				set_mode(MODE.Statement);
				indent();

				switch (flags.last_word) {
					case 'if':
					case 'for':
					case 'loop':
					case 'while':
					case 'catch':
						print_newline(true);
					case 'try':
					case 'finally':
					case 'else':
						flags.declaration_statement = true;
						break;
				}
				return true;
			}
			return false;
		}

		function all_lines_start_with(lines: string[], c: string): boolean {
			for (let i = 0; i < lines.length; i++) {
				let line = lines[i].trim();
				if (line.charAt(0) !== c) {
					return false;
				}
			}
			return true;
		}

		function is_special_word(word: string): boolean {
			return ['break', 'continue', 'global', 'goto', 'local', 'return', 'static', 'throw'].includes(word);
		}

		function is_next(find: string): boolean {
			let local_pos = parser_pos, l = find.length;
			let s = input.substr(local_pos, l);
			while (s !== find && whitespace.includes(s.charAt(0))) {
				local_pos++;
				if (local_pos >= input_length)
					return false;
				s = input.substr(local_pos, l);
			}
			return s === find;
		}

		function get_token_ignore_comment(depth = 0): Token {
			let tk: Token;
			do { tk = get_next_token(depth); } while (tk.type.endsWith('COMMENT'));
			return tk;
		}

		function get_next_token(depth = 0): Token {
			let resulting_string: string, c: string, m: RegExpMatchArray | null;
			let bg = 0, _ppos = parser_pos;
			n_newlines = 0;

			while (whitespace.includes(c = input.charAt(parser_pos++))) {
				if (c === '\n') {
					last_LF = parser_pos - 1;
					n_newlines += 1, begin_line = true;
				} else if (parser_pos >= input_length) {
					add_sharp_foldingrange();
					return {
						content: '', type: 'TK_EOF', offset: input_length, length: 0,
						topofline: 1, next_token_offset: -1, previous_token: lst
					};
				}
			}

			let offset = parser_pos - 1, _tk = _this.tokens[offset];
			if (_tk && _tk.length) {
				begin_line = false;
				parser_pos = _tk.skip_pos ?? offset + _tk.length;
				if (lst = _tk, _tk.ignore) {
					if (_tk.type === 'TK_START_EXPR') {
						continuation_sections_mode = true;
						if (!format_mode)
							return get_next_token();
					} else if (_tk.type === 'TK_END_EXPR') {
						continuation_sections_mode = false;
						if (!format_mode)
							return get_next_token();
					}
				} else if (_tk.type.endsWith('COMMENT'))
					lst = _tk.previous_token ?? EMPTY_TOKEN;
				if (!format_mode) {
					let extra = _tk.previous_extra_tokens;
					if (extra) {
						if (_ppos < offset)
							extra.i = 0;
						if (extra.i < extra.len) {
							_tk = extra.tokens[extra.i++], parser_pos = offset;
						} else extra.i = 0;
					}
				}
				return _tk;
			}
			if (begin_line) {
				begin_line = false, bg = 1;
				let next_LF = input.indexOf('\n', parser_pos);
				if (next_LF < 0)
					next_LF = input_length;
				let line = input.substring(last_LF + 1, next_LF).trim().replace(/(^|\s+);.*$/, '');
				if (line.includes('::') && (block_mode || !'"\''.includes(line[0]) ||
					!['TK_EQUALS', 'TK_COMMA', 'TK_START_EXPR'].includes(lst.type))) {
					if (m = line.match(/^(:([^:]*):(`.|[^`])*?::)(.*)$/i)) {
						let execute: any;
						if ((execute = m[2].match(/[xX]/)) || m[4].match(/^\s*\{?$/))
							parser_pos += m[1].length - 1, lst = createToken(m[1], 'TK_HOT', offset, m[1].length, 1);
						else {
							last_LF = next_LF, parser_pos = offset + m[0].length;
							lst = createToken(m[1], 'TK_HOTLINE', offset, m[1].length, 1), offset += m[1].length;
							lst.skip_pos = parser_pos;
							lst.data = { content: input.substring(offset, parser_pos), offset, length: parser_pos - offset };
							_this.strcommpos.push({ start: offset, end: parser_pos, type: 2 });
						}
						lst.ignore = true, add_sharp_foldingrange();
						if (!m[3])
							_this.addDiagnostic(diagnostic.invalidhotdef(), lst.offset, lst.length);
						if (lst.type === 'TK_HOTLINE' || (!execute && !m[4].match(/^\s*\{/))) {
							if (depth > 5) {
								delete _this.tokens[lst.offset];
								return lst;
							}
							string_mode = execute = true;
							let _lst = lst, tk = get_token_ignore_comment(depth + 1), t: number;
							while (tk.ignore && tk.type === 'TK_STRING') {
								if ((parser_pos = input.indexOf('\n', t = parser_pos)) < 0)
									parser_pos = input_length;
								if (t < parser_pos) {
									let s = input.substring(t, parser_pos).trimRight();
									tk.content += s, tk.length += s.length;
								}
								_this.strcommpos.push({ start: tk.offset, end: tk.offset + tk.length, type: 2 });
								execute = false, tk = get_token_ignore_comment(depth + 1);
							}
							string_mode = false, lst = _lst;
							if (!execute && lst.type === 'TK_HOT') {
								lst.type = 'TK_HOTLINE', lst.skip_pos = parser_pos = offset + m[0].length;
								offset += m[1].length;
								lst.data = { content: input.substring(offset, parser_pos), offset, length: parser_pos - offset };
								_this.strcommpos.push({ start: offset, end: parser_pos, type: 2 });
							} else
								parser_pos = _lst.skip_pos ?? _lst.offset + _lst.length;
						}
						return lst;
					} else if (m = line.match(/^(((([<>$~*!+#^]*?)(`?;|[\x21-\x3A\x3C-\x7E]|[a-z]\w+|[^\x00-\x7f]))|~?(`?;|[\x21-\x3A\x3C-\x7E]|[a-z]\w+|[^\x00-\x7f])\s*&\s*~?(`?;|[\x21-\x3A\x3C-\x7E]|[a-z]\w+|[^\x00-\x7f]))(\s+up)?\s*::)(.*)$/i)) {
						let mm = m[9].match(/^(\s*)(([<>~*!+#^]*?)(`[{;]|[\x21-\x7A\x7C-\x7E]|[a-z]\w+|[^\x00-\x7f]))$/i);
						add_sharp_foldingrange();
						if (mm) {
							let t = mm[2].toLowerCase();
							if (!allIdentifierChar.test(t) || t.match(KEYS_RE)) {
								last_LF = next_LF, parser_pos = offset + m[0].length;
								lst = createToken(m[1].replace(/\s+/g, ' '), 'TK_HOTLINE', offset, m[1].length, 1);
								offset += lst.length + mm[1].length, lst.skip_pos = parser_pos;
								lst.data = { content: m[9].trim(), offset, length: parser_pos - offset, data: mm[2] };
								return lst;
							}
						}
						parser_pos = input.indexOf('::', parser_pos) + 2;
						return lst = createToken(m[1].replace(/\s+/g, ' '), 'TK_HOT', offset, m[1].length, 1);
					}
				}
				if (c !== '#') add_sharp_foldingrange();
			}

			if (isIdentifierChar(c.charCodeAt(0))) {
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
									lst = createToken(c, 'TK_NUMBER', offset, c.length, bg);
									return lst.semantic = { type: SemanticTokenTypes.number }, lst;
								} else if (cc.match(/^\d*[Ee]$/) && p < input_length && '-+'.includes(input.charAt(p))) {
									cc += input.charAt(p), p += 1;
									while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
										t += input.charAt(p), p += 1;
									if (t.match(/^\d+$/))
										c += '.' + cc + t, parser_pos = p;
								}
							}
							lst = createToken(c, 'TK_NUMBER', offset, c.length, bg);
							return lst.semantic = { type: SemanticTokenTypes.number }, lst;
						} else if (parser_pos < input_length && '-+'.includes(input.charAt(parser_pos))) {
							let sign = input.charAt(parser_pos), p = parser_pos, t: Token;
							parser_pos += 1, t = get_next_token(depth + 1);
							delete _this.tokens[t.offset];
							if (t.type === 'TK_NUMBER' && t.content.match(/^\d+$/)) {
								c += sign + t.content;
								lst = createToken(c, 'TK_NUMBER', offset, c.length, bg);
								return lst.semantic = { type: SemanticTokenTypes.number }, lst;
							} else
								parser_pos = p;
						}
					}
					if (reserved_words.includes(c.toLowerCase())) {
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
					if (bg && !continuation_sections_mode) {
						let i = parser_pos, t: string;
						while (i < input_length) {
							if ((t = input.charAt(i++)) === '\n') {
								if (string_mode) {
									// raw string
									// ::hotstring::string
									// (Join`s
									//   continuation
									//   string
									// )
									let o = last_LF + 1, next_LF = input.indexOf('\n', i), m: RegExpMatchArray | null = null;
									let data: number[] = [];
									while (next_LF > 0 && !(m = input.substring(i, next_LF).match(/^\s*\)/)))
										data.push(next_LF - i), next_LF = input.indexOf('\n', i = next_LF + 1);
									if (next_LF < 0)
										data.push(input_length - i), m = input.substring(i, input_length).match(/^\s*\)/);
									parser_pos = m ? i + m[0].length : input_length;
									data.push(parser_pos - i);
									resulting_string = input.substring(offset, parser_pos).trimRight();
									lst = createToken(input.substring(o, offset) + resulting_string, 'TK_STRING', offset, resulting_string.length, 1);
									_this.addFoldingRange(o, parser_pos, 'block');
									lst.data = data;
									// lst.semantic = { type: SemanticTokenTypes.string };
									return lst.ignore = true, lst;
								} else {
									// continuation sections
									// obj := {
									//   (Join,
									//     key1: val1
									//     key2: val2
									//   )
									// }
									let top = !lst.type || (lst.type === 'TK_START_BLOCK' && lst.topofline > 0);
									lst = createToken(c, 'TK_START_EXPR', offset, 1, 1);
									lst.ignore = true, parser_pos = i - 1, continuation_sections_mode = true;
									while (' \t'.includes(input.charAt(++offset) || '\0')) continue;
									let content = input.substring(offset, parser_pos).trimRight();
									lst.data = { content, offset, length: parser_pos - offset };
									lst.skip_pos = parser_pos;
									let js = content.match(/(?<=(^|\s))join(\S*)/i), tk: Token;
									let _lst = lst, lk = lst, optionend = false, _mode = format_mode, llf = parser_pos;
									let create_tokens: (n: number, LF: number) => any = (n, pos) => undefined;
									if (js) {
										let s = js[2].replace(/`[srn]/g, '  '), suffix_is_whitespace = false;
										let tl = new Lexer(TextDocument.create('', 'ahk2', -10, s));
										tl.parseScript();
										let tks = Object.values(tl.tokens);
										offset += 4 + (js.index as number);
										if (tks.length) {
											suffix_is_whitespace = whitespace.includes(s.charAt(s.length - 1));
											tks.map(tk => {
												tk.offset += offset, tk.length = 0;
												tk.next_token_offset = -1;
											});
											create_tokens = (n, last_LF) => {
												let tokens: Token[] = [];
												for (let i = 0; i < n; i++) {
													last_LF = input.indexOf('\n', last_LF + 1);
													for (let tk of tks)
														tk = Object.assign({}, tk), tk.offset = last_LF, tokens.push(tk);
												}
												return { i: 0, len: tokens.length, tokens, suffix_is_whitespace };
											};
											if (',)]}'.includes(tks[0].content))
												optionend = true;
										}
									}
									format_mode = true, tk = get_next_token();
									if (continuation_sections_mode && tk.type !== 'TK_EOF') {
										if (n_newlines > 1)
											tk.previous_extra_tokens = create_tokens(n_newlines - 1, llf);
										tk.topofline = top ? 1 : 0;
										llf = last_LF, lk = tk, tk = get_next_token();
									}
									while (continuation_sections_mode && tk.type !== 'TK_EOF') {
										if (tk.topofline) {
											tk.previous_extra_tokens = create_tokens(n_newlines, llf);
											tk.topofline = 0, llf = last_LF;
											if (optionend && lk.content === '?')
												lk.ignore = true;
										}
										lk = tk, tk = get_next_token();
									}
									if (tk.ignore && tk.type === 'TK_END_EXPR') {
										if (n_newlines > 1)
											tk.previous_extra_tokens = create_tokens(n_newlines - 1, llf);
										_lst.next_pair_pos = tk.offset, tk.previous_pair_pos = _lst.offset;
										_this.addFoldingRange(_lst.offset, tk.offset, 'block');
									}
									parser_pos = _lst.skip_pos as number;
									return lst = (format_mode = _mode) ? _lst : get_next_token();
								}
							} else if (t === ')' || t === '(') {
								if (!input.substring(i - 6, i - 1).match(/[(\s]join\S*$/i))
									break;
							}
						}
					}
				}
				return lst = createToken(c, 'TK_START_EXPR', offset, 1, bg);
			}

			if (c === ')' || c === ']') {
				lst = createToken(c, 'TK_END_EXPR', offset, 1, bg);
				if (c === ')') {
					if (bg && continuation_sections_mode) {
						continuation_sections_mode = false, lst.ignore = true;
						return format_mode ? lst : get_next_token();
					}
				}
				return lst;
			}

			if (c === '{' && (resulting_string = 'TK_START_BLOCK') || c === '}' && (resulting_string = 'TK_END_BLOCK')) {
				if (bg)
					last_LF = offset, begin_line = true;
				return lst = createToken(c, resulting_string, offset, 1, bg);
			}

			if (c === '"' || c === "'") {
				let sep = c, o = offset, nosep = false, se = { type: SemanticTokenTypes.string }, _lst: Token | undefined, pt: Token | undefined;
				resulting_string = '';
				while (c = input.charAt(parser_pos++)) {
					if (c === '`')
						parser_pos++;
					else if (c === sep) {
						resulting_string += input.substring(offset, parser_pos);
						lst = createToken(resulting_string, 'TK_STRING', offset, parser_pos - offset, bg);
						_this.strcommpos.push({ start: offset, end: parser_pos, type: 2 });
						if (nosep) lst.data = null, lst.semantic = se;
						if (_lst)
							lst = _lst, parser_pos = lst.offset + lst.length;
						return lst;
					} else if (continuation_sections_mode) {
						if (c === '\n') {
							let p = parser_pos - 1;
							while (' \t'.includes(c = input.charAt(parser_pos) || '\0'))
								parser_pos++;
							if (c === ')') {
								resulting_string = input.substring(offset, p).trimRight();
								lst = createToken(resulting_string, 'TK_STRING', offset, resulting_string.length, bg = 0);
								_lst ??= lst, resulting_string = '';
								_this.strcommpos.push({ start: offset, end: offset + lst.length, type: 2 });
								let pt = lst.previous_token;
								while (pt && (!pt.ignore || pt.content !== '('))
									pt = pt.previous_token;
								// lst.semantic = se;
								_this.addFoldingRange(offset, p, 'string');
								lst = createToken(')', 'TK_END_EXPR', parser_pos, 1, 1), lst.ignore = true;
								if (pt)
									pt.next_pair_pos = parser_pos, lst.previous_pair_pos = pt.offset;
								continuation_sections_mode = false, nosep = true, offset = ++parser_pos;
								while (' \t'.includes(c = input.charAt(parser_pos) || '\0'))
									parser_pos++;
								resulting_string = input.substring(offset, parser_pos), offset = parser_pos;
							}
						}
					} else if (c === '\n' || c === ';' && ' \t'.includes(input.charAt(parser_pos - 2))) {
						resulting_string = (resulting_string + input.substring(offset, parser_pos - (c === ';' ? 2 : 1))).trimRight();
						if (--parser_pos, resulting_string) {
							lst = createToken(resulting_string, 'TK_STRING', offset, resulting_string.trimLeft().length, bg);
							_this.strcommpos.push({ start: offset, end: offset + lst.length, type: 2 });
							if (nosep) lst.data = null, lst.semantic = se;
							_lst ??= lst, resulting_string = '';
						}
						break;
					}
				}
				if (c) {
					if (depth > 5) {
						lst = _lst as Token, parser_pos = lst.offset + lst.length;
						delete _this.tokens[lst.offset];
						return lst;
					}
					string_mode = block_mode = true;
					let tk = get_token_ignore_comment(depth + 1);
					stringend:
					while (tk.ignore && tk.type === 'TK_STRING') {
						let p = parser_pos, data = tk.data as number[];
						if (nosep)
							tk.semantic = se;
						while (c = input.charAt(parser_pos++)) {
							if (c === '`')
								parser_pos++;
							else if (c === sep) {
								let s = input.substring(p, parser_pos);
								tk.content += s, tk.length += s.length, data[data.length - 1] += s.length;
								_this.strcommpos.push({ start: tk.offset, end: tk.offset + tk.length, type: 2 });
								break stringend;
							} else if (c === '\n' || c === ';' && ' \t'.includes(input.charAt(parser_pos - 2))) {
								let s = input.substring(p, parser_pos - (c === ';' ? 2 : 1)).trimRight();
								if (s)
									tk.content += s, tk.length += s.length, data[data.length - 1] += s.length;
								_this.strcommpos.push({ start: tk.offset, end: tk.offset + tk.length, type: 2 });
								parser_pos--;
								break;
							}
						}
						if (!c) {
							let s = input.substring(p, --parser_pos);
							if (s)
								tk.content += s, tk.length += s.length;
							_this.strcommpos.push({ start: tk.offset, end: tk.offset + tk.length, type: 2 });
						}
						tk = get_token_ignore_comment(depth + 1);
					}
					if (!tk.ignore || tk.type !== 'TK_STRING')
						if (pt = tk.previous_token)
							_this.addDiagnostic(diagnostic.unterminated(), pt.offset + pt.length, 1);
						else _this.addDiagnostic(diagnostic.missing(sep), o, 1);
					string_mode = false, lst = _lst as Token, parser_pos = lst.offset + lst.length;
					return lst;
				} else {
					_this.addDiagnostic(diagnostic.unterminated(), input_length, 1);
					resulting_string += input.substring(offset, input_length);
					lst = createToken(resulting_string, 'TK_STRING', offset, input_length - offset, bg);
					_this.strcommpos.push({ start: offset, end: input_length, type: 2 });
					if (nosep) lst.data = null, lst.semantic = se;
					if (continuation_sections_mode)
						_this.addFoldingRange(offset, input_length, 'string'), continuation_sections_mode = false;
					return lst;
				}
			}

			if (c === '.') {
				let nextc = input.charAt(parser_pos);
				if (nextc === '=') {
					parser_pos++;
					return lst = createToken('.=', 'TK_EQUALS', offset, 2, bg);
				} else if (whitespace.includes(input.charAt(parser_pos - 2)) && whitespace.includes(nextc)) {
					return lst = createToken(c, 'TK_OPERATOR', offset, 1, bg);
				} else if (nextc.match(/\d/) && (lst.type === 'TK_EQUALS' || lst.type === 'TK_OPERATOR')) {
					let p = parser_pos + 1, t = '';
					while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
						nextc += input.charAt(p), p += 1;
					if (nextc.match(/^\d+([Ee]\d+)?$/)) {
						parser_pos = p, c += nextc;
						lst = createToken('0' + c, 'TK_NUMBER', offset, c.length, bg);
						return lst.semantic = { type: SemanticTokenTypes.number }, lst;
					} else if (p < input_length && nextc.match(/^\d+[Ee]$/) && '-+'.includes(input.charAt(p))) {
						nextc += input.charAt(p), p += 1;
						while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
							t += input.charAt(p), p += 1;
						if (t.match(/^\d+$/)) {
							parser_pos = p, c += nextc + t;
							lst = createToken('0' + c, 'TK_NUMBER', offset, c.length, bg);
							return lst.semantic = { type: SemanticTokenTypes.number }, lst;
						}
					}
				}
				return lst = createToken(c, !whitespace.includes(nextc) ? 'TK_DOT' : 'TK_UNKNOWN', offset, 1, bg);
			}

			if (c === ';') {
				let comment = '', comment_type = bg ? 'TK_COMMENT' : 'TK_INLINE_COMMENT', t: any, rg: Range, ignore = undefined;
				let next_LF = offset - 1, line: string, ln = 0;
				while (true) {
					parser_pos = next_LF, next_LF = input.indexOf('\n', parser_pos + 1);
					line = input.substring(parser_pos + 1, next_LF = next_LF < 0 ? input_length : next_LF).trim();
					if (line.startsWith(';')) {
						ln++;
						if (t = line.match(/^;+\s*([{}])/)) {
							if (t[1] === '{')
								customblocks.bracket.push(parser_pos + 1);
							else if ((t = customblocks.bracket.pop()) !== undefined)
								_this.addFoldingRange(t, parser_pos + 1, 'block');
							if (ln === 1)
								ignore = true;
							if (bg)
								continue;
						} else if (t = line.match(/^;(\s*~?\s*)(todo|fixme)(:?\s*)(.*)/i)) {
							_this.children.push(DocumentSymbol.create(`${t[2].toUpperCase()}: ${t[4].trim()}`, undefined,
								SymbolKind.Module, rg = make_range(parser_pos + 1, next_LF - parser_pos - 1), rg));
							if (bg)
								continue;
						} else if (bg) {
							if (t = line.match(/^;\s*#(end)?region\b/i)) {
								ignore = true;
								if (!t[1]) {
									customblocks.region.push(parser_pos + 1);
									if (line = line.substring(t[0].length).trim())
										_this.children.push(DocumentSymbol.create(line, undefined, SymbolKind.Module,
											rg = make_range(parser_pos + 1, next_LF - parser_pos - 1), rg));
								} else if ((t = customblocks.region.pop()) !== undefined)
									_this.addFoldingRange(t, parser_pos + 1, 'region');
							} else if (t = line.match(/^;@include\s+(.*)/i)) {
								ignore = true;
								add_include_dllload(t[1].replace(/\s+;.*$/, '').trim());
							} else if (t = line.match(commentTags)) {
								let g = (t as RegExpMatchArray).groups;
								if (!g)
									t = t[1]?.trim();
								else for (let tag in g)
									if (tag.startsWith('tag') && (t = g[tag]?.trim()))
										break;
								if (t) {
									_this.children.push(DocumentSymbol.create(t, undefined, SymbolKind.Module,
										rg = make_range(parser_pos + 1, next_LF - parser_pos - 1), rg));
									ignore = true;
								}
							}
							continue;
						}
						parser_pos = next_LF;
					}
					break;
				}
				comment = input.substring(offset, parser_pos).trimRight();
				_this.strcommpos.push({ start: offset, end: parser_pos, type: 1 });
				let cmm: Token = _this.tokens[offset] = {
					type: comment_type, content: comment, offset, length: comment.length,
					next_token_offset: -1, topofline: bg, ignore, skip_pos: parser_pos, previous_token: lst
				};
				if (!bg) {
					if (!whitespace.includes(input.charAt(offset - 1)))
						_this.addDiagnostic(diagnostic.unexpected(cmm.content), offset, cmm.length);
				} else if (!string_mode && !ignore && line[0] && !line.startsWith('/*'))
					comments[_this.document.positionAt(parser_pos).line + 1] = cmm;
				if (ln > 1) _this.addFoldingRange(offset, parser_pos, 'comment');
				return cmm;
			}

			if (c === '/' && bg && input.charAt(parser_pos) === '*') {
				let LF = input.indexOf('\n', --parser_pos), ln = 0, tk: Token;
				while (!(m = input.substring(parser_pos, LF > 0 ? LF : input_length).match(/(^\s*\*\/)|(\*\/\s*$)/)) && LF > 0)
					last_LF = LF, LF = input.indexOf('\n', parser_pos = LF + 1), ln++;
				if (m && m[1])
					parser_pos = input.indexOf('*/', last_LF) + 2, begin_line = true, last_LF = parser_pos - 1;
				else parser_pos = LF < 0 ? input_length : LF;
				_this.strcommpos.push({ start: offset, end: parser_pos, type: 1 });
				let cmm: Token = {
					type: 'TK_BLOCK_COMMENT', content: input.substring(offset, parser_pos), offset, length: parser_pos - offset,
					next_token_offset: -1, previous_token: lst, topofline: bg, skip_pos: parser_pos
				};
				if (!string_mode) {
					if (depth > 5)
						return cmm;
					let _lst = lst, _pp = parser_pos;
					if ((tk = get_next_token(1)).length) {
						if (n_newlines < 2) {
							tk.prefix_is_whitespace ??= ' ';
							comments[_this.document.positionAt(tk.offset).line] = cmm;
						}
						cmm.next_token_offset = tk.offset;
					}
					lst = _lst, parser_pos = _pp;
				}
				_this.tokens[offset] = cmm;
				if (ln) _this.addFoldingRange(offset, parser_pos, 'comment');
				return cmm;
			}

			if (punct.includes(c)) {
				while (parser_pos < input_length && punct.includes(c + input.charAt(parser_pos))) {
					c += input.charAt(parser_pos);
					parser_pos += 1;
					if (parser_pos >= input_length)
						break;
				}

				if (c === ',')
					return lst = createToken(c, 'TK_COMMA', offset, 1, bg);
				else if (c === '?') {
					lst = createToken(c, 'TK_OPERATOR', offset, 1, bg);
					let bak = parser_pos, tk = lst, t = get_token_ignore_comment(depth + 1);
					parser_pos = bak;
					if (t.type === 'TK_COMMA' || t.type === 'TK_END_EXPR' || t.content === '}' || t.type === 'TK_EOF')
						tk.ignore = true;
					return lst = tk;
				}
				return lst = createToken(c, c.match(/([:.+\-*/|&^]|\/\/|>>|<<)=/) ? 'TK_EQUALS' : 'TK_OPERATOR', offset, c.length, bg);
			}

			if (c === '#') {
				let sharp = '#';
				while (isIdentifierChar((c = input.charAt(parser_pos)).charCodeAt(0)))
					sharp += c, parser_pos++;
				sharp_offsets.push(offset);
				lst = createToken(sharp, 'TK_SHARP', offset, sharp.length, bg);
				if (sharp.toLowerCase() === '#hotif' && bg && whitespace.includes(c))
					return lst;
				last_LF = input.indexOf('\n', offset = parser_pos);
				parser_pos = last_LF < 0 ? input_length : last_LF;
				if (bg && whitespace.includes(c)) {
					if (c === ' ' || c === '\t') {
						while (' \t'.includes(input.charAt(offset) || '\0'))
							offset++;
						let content = input.substring(offset, parser_pos).trimRight().replace(/(^|\s+);.*$/, '');
						lst.skip_pos = parser_pos = offset + content.length;
						lst.data = { content, offset, length: content.length };
					}
				} else
					lst.type = 'TK_UNKNOWN', lst.content += input.substring(offset, parser_pos).trimRight(), lst.length += parser_pos - offset;
				return lst;
			}

			return lst = createToken(c, 'TK_UNKNOWN', offset, c.length, bg);

			function add_sharp_foldingrange() {
				if (sharp_offsets.length > 1)
					_this.addFoldingRange(sharp_offsets[0], sharp_offsets.pop() as number, 'imports');
				sharp_offsets.length = 0;
			}
		}

		function real_indentation_level() {
			let line = output_lines[flags.start_line_index - 1];
			if (line?.text.length)
				return line.indent;
			return flags.indentation_level;
		}

		function handle_start_expr(): void {
			if (start_of_statement()) {

			} else if (need_newline())
				print_newline();

			let next_mode = MODE.Expression;
			if (token_text === '[') {

				if (!input_wanted_newline && ['TK_WORD', 'TK_STRING', 'TK_END_EXPR'].includes(last_type)) {
					set_mode(next_mode);
					previous_flags.indentation_level = real_indentation_level();
					print_token();
					// indent();
					flags.indentation_level = previous_flags.indentation_level + 1;
					if (opt.space_in_paren) {
						output_space_before_token = true;
					}
					return;
				}

				if (last_type === 'TK_RESERVED')
					output_space_before_token = true;

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
				if (ck.ignore)
					print_newline(true);
				else if (last_type === 'TK_END_EXPR' || last_type === 'TK_WORD')
					output_space_before_token = whitespace.includes(ck.prefix_is_whitespace || '\0');
				else if (last_type === 'TK_STRING')
					output_space_before_token = true;
				else if (last_type === 'TK_RESERVED')
					if (last_text.match(/^(break|continue|goto)$/i))
						output_space_before_token = false;
					else if (['if', 'for', 'while', 'loop', 'case', 'catch', 'switch'].includes(last_text))
						output_space_before_token = Boolean(opt.space_before_conditional);
					else output_space_before_token = space_in_other;
			}

			if (input_wanted_newline && opt.preserve_newlines)
				print_newline(true);
			else if (last_type === 'TK_EQUALS' || last_type === 'TK_COMMA' || last_type === 'TK_OPERATOR') {
				if (!start_of_object_property())
					allow_wrap_or_preserved_newline();
			}

			set_mode(next_mode);
			flags.indentation_level = real_indentation_level();
			print_token();

			// (options\n...\n)
			if (ck.ignore) {
				let c = ck.data.content;
				if (c)
					print_token(c);
			} else if (opt.space_in_paren)
				output_space_before_token = true;

			// In all cases, if we newline while inside an expression it should be indented.
			indent();

			if (token_text === '[' && !opt.keep_array_indentation)
				print_newline(true);
		}

		function handle_end_expr() {
			// statements inside expressions are not valid syntax, but...
			// statements must all be closed when their container closes
			while (flags.mode === MODE.Statement)
				restore_mode();

			if ((last_type === 'TK_END_EXPR' || last_type === 'TK_END_BLOCK') && flags.indentation_level < flags.parent.indentation_level)
				trim_newlines();
			else
				allow_wrap_or_preserved_newline(token_text === ']' && is_array(flags.mode) && !opt.keep_array_indentation);

			output_space_before_token = Boolean(opt.space_in_paren && !(last_type === 'TK_START_EXPR' && !opt.space_in_empty_paren));
			restore_mode();
			if (just_added_newline()) {
				if (previous_flags.indentation_level === flags.indentation_level) {
					deindent();
					if (previous_flags.indentation_level === flags.indentation_level)
						trim_newlines();
				}
			}
			print_token();
		}

		function handle_start_block() {
			if (ck.data) {
				set_mode(MODE.ObjectLiteral), keep_object_line = !_this.tokens[ck.next_token_offset]?.topofline;
				flags.indentation_level = real_indentation_level();
				if (previous_flags.mode !== MODE.Conditional)
					previous_flags.indentation_level = flags.indentation_level;

				if (is_array(previous_flags.mode) && flags.last_text === ',') {
					if (input_wanted_newline && opt.preserve_newlines) {
						flags.indentation_level = ++previous_flags.indentation_level;
						print_newline();
					}
				}
				output_space_before_token ||= last_type !== 'TK_START_EXPR' && space_in_other;
				print_token(), indent();
				output_space_before_token = space_in_other;
			} else {
				if (!['try', 'if', 'for', 'while', 'loop', 'catch', 'else', 'finally'].includes(flags.last_word))
					while (flags.mode === MODE.Statement)
						restore_mode();
				set_mode(MODE.BlockStatement), flags.had_comment = previous_flags.had_comment;
				output_space_before_token = space_in_other;

				if (previous_flags.in_case_statement && flags.last_text.endsWith(':'))
					flags.indentation_level--, trim_newlines();
				if (opt.one_true_brace === 0 || input_wanted_newline && opt.preserve_newlines && !opt.one_true_brace)
					print_newline(true);

				let need_newline = !just_added_newline();
				print_token(), indent();
				if (need_newline || opt.one_true_brace !== undefined)
					print_newline();
				else output_space_before_token = space_in_other;
			}
		}

		function handle_end_block() {
			// statements must all be closed when their container closes
			while (flags.mode === MODE.Statement)
				restore_mode();

			let is_obj = flags.mode === MODE.ObjectLiteral, need_newline = false;
			if (is_obj) {
				if (last_type === 'TK_START_BLOCK')
					output_space_before_token = false;
				else if (is_array(flags.mode) && opt.keep_array_indentation) {
					// we REALLY need a newline here, but newliner would skip that
					opt.keep_array_indentation = false;
					print_newline();
					opt.keep_array_indentation = true;
				} else {
					output_space_before_token = space_in_other;
					if ((last_type === 'TK_END_EXPR' || last_type === 'TK_END_BLOCK') && flags.indentation_level < flags.parent.indentation_level)
						trim_newlines();
					else if (input_wanted_newline && opt.preserve_newlines || !(flags.mode === MODE.ObjectLiteral && keep_object_line))
						print_newline();
				}
			} else if (opt.one_true_brace !== undefined || input_wanted_newline)
				print_newline();

			restore_mode();
			if (previous_flags.indentation_level === flags.indentation_level && just_added_newline())
				deindent();
			print_token();
			if (!is_obj) {
				if (flags.in_case_statement && flags.last_text.endsWith(':'))
					flags.indentation_level++;
				if (opt.one_true_brace !== undefined)
					print_newline(true);
				output_space_before_token = space_in_other;
			}
		}

		function handle_word() {
			let preserve_statement_flags = false;
			if (last_text.match(/[^\W]$/) || ['TK_END_EXPR', 'TK_STRING'].includes(last_type))
				output_space_before_token = true;

			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
				preserve_statement_flags = flags.declaration_statement;
				if (!input_wanted_newline && ['else', 'finally'].includes(flags.last_word) &&
					['if', 'while', 'loop', 'for', 'try', 'switch'].includes(token_text_low))
					deindent();
			}

			if (token_type === 'TK_RESERVED') {
				if (is_special_word(token_text_low)) {
					if (input_wanted_newline && opt.preserve_newlines)
						print_newline(preserve_statement_flags);
				} else {
					let maybe_need_newline = false;

					switch (token_text_low) {
						case 'else':
							while (flags.mode === MODE.Statement && !flags.if_block && !flags.loop_block && !(flags.catch_block && !flags.else_block))
								restore_mode();
							break;
						case 'finally':
							while (flags.mode === MODE.Statement && !flags.catch_block && !flags.try_block && !(flags.else_block && flags.catch_block))
								restore_mode();
							break;
						case 'catch':
							while (flags.mode === MODE.Statement && !flags.try_block && !(flags.catch_block && !flags.else_block))
								restore_mode();
							break;
						case 'until':
							while (flags.mode === MODE.Statement && flags.loop_block !== 1)
								restore_mode();
							break;
						case 'case':
						case 'class':
							while (flags.mode === MODE.Statement)
								restore_mode();
							break;
						case 'if':
						case 'for':
						case 'loop':
						case 'while':
						case 'try':
						case 'switch':
							if (!preserve_statement_flags)
								while (flags.mode === MODE.Statement && flags.declaration_statement)
									restore_mode();
							break;
					}

					if (flags.if_block) {
						if (token_text_low === 'else')
							flags.if_block = false, flags.else_block = true, maybe_need_newline = true;
						else flags.if_block = false;
					} else if (flags.loop_block) {
						if (flags.loop_block === 1 && token_text_low === 'until') {
							flags.loop_block = 0, maybe_need_newline = true;
						} else if (token_text_low === 'else')
							flags.else_block = true, flags.loop_block = 0, maybe_need_newline = true;
						else flags.loop_block = 0;
					} else if (flags.try_block) {
						if (token_text_low === 'catch')
							flags.try_block = false, flags.catch_block = true, maybe_need_newline = true;
						else if (token_text_low === 'finally')
							flags.try_block = false, flags.finally_block = true, maybe_need_newline = true;
						else flags.try_block = false;
					} else if (flags.catch_block) {
						if (token_text_low === 'finally')
							flags.catch_block = flags.else_block = false, flags.finally_block = true, maybe_need_newline = true;
						else if (token_text_low === 'else')
							flags.else_block = true, maybe_need_newline = true;
						else if (token_text_low === 'catch')
							maybe_need_newline = true;
						else flags.catch_block = flags.else_block = false;
					} else
						flags.else_block = flags.finally_block = false;

					if (token_text_low === 'class') {
						print_newline();
						print_token();
						flags.last_word = token_text_low;
						set_mode(MODE.Statement), is_conditional = true;
						return;
					} else if (token_text_low === 'case' && (flags.in_case_statement || (flags.mode === 'BlockStatement' && flags.last_word === 'switch'))) {
						print_newline();
						if (flags.case_body) {
							deindent();
							flags.case_body = false;
						}
						print_token();
						flags.in_case = true;
						flags.in_case_statement = true;
						return;
					}
					if (maybe_need_newline) {
						trim_newlines();
						if (flags.last_text !== '}' || opt.one_true_brace as number < 1 || input_wanted_newline && opt.preserve_newlines && !opt.one_true_brace)
							print_newline(true);
						else output_space_before_token = space_in_other;
					} else if (input_wanted_newline)
						print_newline(preserve_statement_flags);

					switch (token_text_low) {
						case 'loop':
							flags.loop_block = 1;
							break;
						case 'while':
						case 'for':
							flags.loop_block = 2;
							break;
						case 'if':
							flags.if_block = true;
							break;
						case 'try':
							flags.try_block = true;
							break;
					}
				}
				flags.last_word = token_text_low;
			} else {
				if (input_wanted_newline && flags.mode === MODE.Statement && !flags.is_expression &&
					!is_line_continue(ck.previous_token ?? EMPTY_TOKEN, ck))
					print_newline(preserve_statement_flags);
				else if (input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
				else if (['TK_COMMA', 'TK_START_EXPR', 'TK_EQUALS', 'TK_OPERATOR'].includes(last_type))
					if (!start_of_object_property())
						allow_wrap_or_preserved_newline();
				if (!is_conditional && ck.symbol && flags.mode === MODE.BlockStatement)
					set_mode(MODE.Statement), is_conditional = true;
				flags.last_word = '_';
			}

			print_token();
		}

		function handle_string() {
			if (start_of_statement()) {
				if (input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
				else output_space_before_token = true;
			} else if (last_type === 'TK_RESERVED' || last_type === 'TK_WORD') {
				if (input_wanted_newline)
					print_newline();
				else output_space_before_token = true;
			} else if (last_type === 'TK_COMMA' || last_type === 'TK_START_EXPR' || last_type === 'TK_EQUALS' || last_type === 'TK_OPERATOR') {
				if (!start_of_object_property())
					allow_wrap_or_preserved_newline();
			} else {
				// print_newline();
				if (input_wanted_newline)
					print_newline();
				if (ck.ignore || ck.data !== undefined)
					output_space_before_token = false;
				else output_space_before_token = true;
			}
			if (ck.ignore) {
				print_newline(true);
				output_lines[output_lines.length - 1].text = [token_text];
				return;
			}
			print_token();
		}

		function handle_equals() {
			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
			}

			output_space_before_token = space_in_other;
			print_token();
			output_space_before_token = space_in_other;
		}

		function handle_comma() {
			if (flags.mode === MODE.BlockStatement || flags.declaration_statement)
				set_mode(MODE.Statement), indent();
			if (last_type === 'TK_WORD' && whitespace.includes(ck.prefix_is_whitespace || '\0') &&
				ck.previous_token?.callinfo)
				input_wanted_newline && opt.preserve_newlines ? print_newline(true) : output_space_before_token = true;
			else {
				output_space_before_token = space_in_other && last_type === 'TK_COMMA';
				if (flags.mode === MODE.Statement && flags.parent.mode === MODE.ObjectLiteral)
					restore_mode();
				if (input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
				else if (!just_added_newline())
					input_wanted_newline = false;
			}
			print_token();
			if (!input_wanted_newline && !keep_object_line && flags.mode === MODE.ObjectLiteral)
				print_newline();
			else output_space_before_token = space_in_other;
		}

		function handle_operator() {
			let space_before = Boolean(space_in_other || token_text.match(/^\w/));
			let space_after = space_before;
			if (ck.previous_token?.callinfo)
				output_space_before_token = true;
			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
				if (token_text_low.match(/^(\+\+|--|%|!|~|not)$/)) {
					output_space_before_token = true;
					print_token();
					output_space_before_token = token_text_low === 'not';
					return;
				}
			} else if (token_text === '=>') {
				if (flags.mode === MODE.BlockStatement)
					set_mode(MODE.Statement);
				indent();
			} else if (token_text_low.match(/^(\+\+|--|%|!|~|not)$/) && need_newline()) {
				print_newline(), print_token();
				output_space_before_token = token_text_low === 'not';
				return;
			}

			if (last_type === 'TK_RESERVED')
				output_space_before_token = true;

			// %...%
			if (token_text === '%') {
				space_after = Boolean(ck.previous_pair_pos !== undefined && ' \t'.includes(input.charAt(ck.offset + 1) || '\0'));
				output_space_before_token ||= Boolean(ck.next_pair_pos && ' \t'.includes(ck.prefix_is_whitespace || '\0'));
				if (input_wanted_newline && opt.preserve_newlines)
					if (flags.mode === MODE.Statement && is_line_continue(ck.previous_token ?? EMPTY_TOKEN, ck))
						print_newline(true);
				print_token();
				output_space_before_token = space_after;
				return;
			}

			// case ...:
			if (token_text === ':' && (flags.in_case ||
				flags.mode === MODE.Statement && flags.parent.in_case)) {
				if (!flags.in_case)
					restore_mode();
				indent(), print_token();
				if (is_next('\n'))
					print_newline();
				else output_space_before_token = space_in_other;
				flags.in_case = false;
				flags.case_body = true;
				return;
			}

			if (input_wanted_newline && opt.preserve_newlines)
				print_newline(true);
			else if (last_type === 'TK_OPERATOR' && !last_text.match(/^(--|\+\+|%|!|~|not)$/))
				allow_wrap_or_preserved_newline();

			if (['--', '++', '!', '~'].includes(token_text) || ('-+'.includes(token_text) && (['TK_START_BLOCK', 'TK_START_EXPR', 'TK_EQUALS', 'TK_OPERATOR', 'TK_COMMA', 'TK_RESERVED'].includes(last_type) || ck.previous_token?.callinfo))) {
				space_after = false;
				space_before = token_text === '!' && last_type === 'TK_WORD';

				if (!output_space_before_token && (token_text === '++' || token_text === '--') && ['TK_END_EXPR', 'TK_WORD'].includes(last_type))
					space_after = true;
			} else if (token_text === ':') {
				if (flags.ternary_depth)
					flags.ternary_depth--;
				else space_before = false;
			} else if (token_text === '?') {
				if (!ck.ignore) {
					flags.ternary_depth += 1;
					if (!flags.indentation_level)
						indent();
					else if (output_lines.length) {
						let line = output_lines[output_lines.length - 1].text;
						if (line[flags.indentation_level - (line[0] === preindent_string ? 0 : 1)] === indent_string)
							indent();
					}
				} else space_before = space_after = false;
			} else if (token_text === '.')
				space_after = space_before = true;
			else if (token_text === '&') {
				if (last_type !== 'TK_WORD' && last_type !== 'TK_END_EXPR' || ck.previous_token?.callinfo)
					space_after = false;
				if (last_type === 'TK_COMMA' || last_type === 'TK_START_EXPR')
					space_before = false;
			} else if (token_text === '*') {
				if (last_text === '(' || (last_type === 'TK_WORD' && (is_next(')') || is_next(']'))))
					space_before = space_after = false;
				else if (last_text === ',')
					space_after = false;
			}

			output_space_before_token ||= space_before;
			print_token();
			output_space_before_token = space_after;
		}

		function handle_block_comment() {
			let lines = token_text.split('\n');
			let javadoc = lines[0].match(/^\/\*(@ahk2exe-keep|[^*]|$)/i) ? false : true;
			let remove: RegExp | string = '', t: RegExpMatchArray | null, j: number;
			if (!javadoc && (t = lines[lines.length - 1].match(/^(\s)\1*/)) && t[0] !== ' ')
				remove = new RegExp(`^${t[1]}{1,${t[0].length}}`);

			// block comment starts with a new line
			print_newline(true);
			if (flags.mode === MODE.Statement) {
				let nk = _this.tokens[ck.previous_token?.next_token_offset as number];
				if (!nk || !flags.in_expression && !is_line_continue(nk.previous_token ?? EMPTY_TOKEN, nk))
					print_newline();
				else if (flags.had_comment < 2)
					trim_newlines();
			}

			// first line always indented
			print_token(lines[0].trimRight());
			for (j = 1; j < lines.length - 1; j++) {
				print_newline(true);
				if (javadoc) {
					print_token(' * ' + lines[j].replace(/^\s*\* ?|\s+$/g, ''));
				} else {
					print_token(lines[j].trimRight().replace(remove, ''));
				}
			}
			if (lines.length > 1) {
				print_newline(true);
				print_token((javadoc ? ' ' : '') + lines[lines.length - 1].trim());
			}
			// for comments of more than one line, make sure there's a new line after
			print_newline(true);
			flags.had_comment = 3;
		}

		function handle_inline_comment() {
			if (opt.ignore_comment)
				return token_text = '';
			if (just_added_newline())
				output_lines.pop();
			output_lines[output_lines.length - 1].text.push((indent_string || '\t'), token_text);
			print_newline(true);
			flags.had_comment = 1;
		}

		function handle_comment() {
			if (opt.ignore_comment)
				return;
			print_newline(true);
			if (flags.mode === MODE.Statement) {
				let nk = _this.tokens[ck.previous_token?.next_token_offset as number];
				if (!nk || !flags.in_expression && !is_line_continue(nk.previous_token ?? EMPTY_TOKEN, nk))
					print_newline();
				else if (flags.had_comment < 2)
					trim_newlines();
			}
			token_text.split('\n').map(s => {
				print_newline(true);
				print_token(s.trim());
			});
			print_newline(true);
			flags.had_comment = 2;
		}

		function handle_dot() {
			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
			}

			// allow preserved newlines before dots in general
			// force newlines on dots after close paren when break_chained - for bar().baz()
			allow_wrap_or_preserved_newline(flags.last_text === ')' && opt.break_chained_methods);
			print_token();
		}

		function handle_number() {
			token_type = 'TK_WORD';
			handle_word();
		}

		function handle_sharp() {
			print_newline();
			print_token();
			let t = ck.data?.content;
			if (t)
				print_token(token_type === 'TK_HOTLINE' ? t : ' ' + t);
			else output_space_before_token = space_in_other;
		}

		function handle_label() {
			print_newline();
			if (token_text_low === 'default:' && (flags.in_case_statement || (flags.mode === MODE.BlockStatement && flags.last_word === 'switch'))) {
				if (flags.case_body)
					deindent();
				else flags.case_body = true;
				print_token(), indent();
				flags.in_case = false;
				flags.in_case_statement = true;
				output_space_before_token = space_in_other;
				return;
			}
			print_token();
			let t = output_lines[output_lines.length - 1].text;
			if (t[0].trim() === '')
				output_lines[output_lines.length - 1].text = t.slice(1);
			else
				indent();
		}

		function handle_unknown() {
			print_token();
			print_newline();
		}

		function is_line_continue(lk: Token, tk: Token, parent?: DocumentSymbol): boolean {
			switch (tk.type) {
				case 'TK_DOT':
				case 'TK_COMMA':
				case 'TK_EQUALS':
					return true;
				case 'TK_OPERATOR':
					return lk.type === '' || !tk.content.match(/^(!|~|not|%|\+\+|--)$/i) && (!parent || !tk.content.match(/^\w/) || parent.kind !== SymbolKind.Class);
				case 'TK_END_BLOCK':
				case 'TK_END_EXPR':
					return false;
				case 'TK_STRING':
					if (tk.ignore)
						return true;
				default:
					switch (lk.type) {
						case 'TK_COMMA':
						case 'TK_EQUALS':
						case '':
							return true;
						case 'TK_OPERATOR':
							return lk.ignore ? false : !lk.content.match(/^(\+\+|--|%)$/);
						default:
							return false;
					}
			}
		}

		function need_newline() {
			return input_wanted_newline && (flags.parent.mode === MODE.BlockStatement &&
				['TK_END_EXPR', 'TK_START_BLOCK', 'TK_END_BLOCK', 'TK_WORD', 'TK_STRING'].includes(last_type) ||
				(last_type === 'TK_OPERATOR' && last_text.match(/^(\+\+|--|%)$/)) ||
				(last_type === 'TK_RESERVED' && last_text.match(/^(break|continue|goto|global|local|loop|return|static|throw)$/)));
		}
	}

	private clear() {
		this.texts = {}, this.declaration = {}, this.include = {}, this.tokens = {}, this.linepos = {};
		this.labels = {}, this.object = { method: {}, property: {}, userdef: {} };
		this.funccall.length = this.diagnostics.length = this.foldingranges.length = 0;
		this.children.length = this.dllpaths.length = this.strcommpos.length = this.anonymous.length = 0;
		this.includedir = new Map(), this.dlldir = new Map();
	}

	public getWordAtPosition(position: Position, full: boolean = false, ignoreright = false): { text: string, range: Range } {
		let { line, character: start } = position;
		let text = this.document.getText(Range.create(Position.create(line, 0),
			ignoreright ? position : Position.create(line + 1, 0)));
		let len = text.length, end = start, c: number, dot = false;
		while (end < len && isIdentifierChar(text.charCodeAt(end)))
			end++;
		for (start = position.character - 1; start >= 0; start--) {
			c = text.charCodeAt(start);
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
			return { text: text.substring(start + 1, end).replace(/\s/g, ''), range: Range.create(Position.create(line, start + 1), Position.create(line, end)) };
		return { text: '', range: Range.create(position, position) };
	}

	public searchNode(name: string, position?: Position, kind?: SymbolKind)
		: { node: DocumentSymbol, uri: string, ref?: boolean, scope?: DocumentSymbol, fn_is_static?: boolean } | undefined | false | null {
		let node: DocumentSymbol | undefined, t: DocumentSymbol | undefined, uri = this.uri;
		name = name.toLowerCase();
		if (kind === SymbolKind.Variable || kind === SymbolKind.Class || kind === SymbolKind.Function) {
			let scope: DocumentSymbol | undefined, bak: DocumentSymbol | undefined, ref = true, fn_is_static = false;
			if (name.startsWith('$')) {
				if (node = this.anonymous[parseInt(name.substring(1))])
					return { node, uri };
				return null;
			}
			if (position) {
				scope = this.searchScopedNode(position);
				if (scope) {
					if (scope.kind === SymbolKind.Function && (<FuncNode>scope).static)
						fn_is_static = true;
					if (scope.kind === SymbolKind.Class && (<ClassNode>scope).extends) {
						let tks = this.tokens, o = this.document.offsetAt(scope.selectionRange.start);
						let tk = tks[tks[o].next_token_offset];
						if ((tk.pos ??= this.document.positionAt(tk.offset)).line === position.line)
							scope = undefined;
					}
					bak = scope;
				}
			}
			if (scope) {
				while (scope) {
					let dec = (<FuncNode>scope).declaration, loc = (<FuncNode>scope).local, glo = (<FuncNode>scope).global;
					if (loc && (t = loc[name]) && (!fn_is_static || (<Variable>t).static)) {
						if (t.selectionRange.start.character === t.selectionRange.end.character)
							return false;
						return { node: t, uri, scope };
					} else if (glo && glo[name])
						return { node: this.declaration[name] || glo[name], uri, scope };
					else if ((<FuncNode>scope).assume === FuncScope.GLOBAL) {
						if (node = this.declaration[name])
							return { node, uri, scope };
						return undefined;
					} else if (dec && scope.kind !== SymbolKind.Class && (t = dec[name])) {
						if (fn_is_static) {
							if ((<Variable>t).static)
								return { node: t, uri, scope };
							if (bak === scope || (<Variable>t).static === null)
								node = t;
						} else {
							if (scope.kind === SymbolKind.Method || !(<FuncNode>scope).parent)
								return { node: t, uri, scope };
							node = t;
						}
					} else if (fn_is_static && bak === scope) {
						node = scope.children?.find(it => it.name.toLowerCase() === name);
						if (node && (<Variable>node).static)
							return { node, uri, scope };
					}
					scope = (<any>scope).parent;
				}
				if (node) {
					if (fn_is_static && (t = (<Variable>node).def ? node : this.declaration[name]))
						return { node: t, uri, scope };
					else
						return { node, uri, fn_is_static, scope };
				}
				else if (['this', 'super'].includes(name)) {
					scope = bak;
					while (scope && scope.kind !== SymbolKind.Class) {
						if (scope.kind === SymbolKind.Method && (<FuncNode>scope).static)
							ref = false;
						scope = (<FuncNode>scope).parent;
					}
					if (scope) {
						if (name === 'this') {
							return { node: scope, uri, ref, scope };
						} else {
							if ((<ClassNode>scope).extends) {
								let ex = searchNode(this, (<ClassNode>scope).extends.toLowerCase(), Position.create(0, 0), SymbolKind.Class)
								if (ex)
									return { node: ex[0].node, uri: ex[0].uri, ref, scope };
							}
						}
						return undefined;
					}
				}
				if (!scope && this.declaration[name])
					return { node: this.declaration[name], uri };
			} else if (node = this.declaration[name])
				return { node, uri, scope };
		} else if (kind === SymbolKind.Field) {
			let scope = position ? this.searchScopedNode(position) : undefined, lbs = (<any>(scope || this)).labels;
			if (lbs) {
				if (name.slice(-1) === ':')
					name = name.slice(0, -1);
				let a = lbs[name];
				if (a && a[0].def)
					return { node: a[0], uri, scope };
			}
			if (scope)
				return null;
		}
		return undefined;
	}

	public buildContext(position: Position, full = true, ignoreright = false) {
		let word = this.getWordAtPosition(position, full, ignoreright), linetext = '', pre = '', suf = '';
		let kind: SymbolKind = SymbolKind.Null, document = this.document, tokens = this.tokens;
		linetext = document.getText(Range.create(word.range.start.line, 0, word.range.end.line + 1, 0)).trimRight();
		let ttk: Token | undefined = tokens[document.offsetAt(word.range.start)];
		if (full && ttk) {
			if (ttk.content === '.' && ttk.type !== 'TK_OPERATOR') {
				let text = '', end = ttk.offset, tk = ttk, lk = ttk.previous_token;
				let ps: any = { ')': 0, ']': 0, '}': 0 };
				while (lk) {
					switch (lk.type) {
						case 'TK_DOT': tk = lk, lk = lk.previous_token; break;
						case 'TK_WORD':
							if (tk = lk, lk = lk.previous_token)
								if (lk.type !== 'TK_DOT')
									lk = undefined;
							break;
						case 'TK_START_BLOCK': tk = lk, lk = (--ps['}'] < 0) ? undefined : lk.previous_token; break;
						case 'TK_START_EXPR':
							if (tk = lk, --ps[lk.content === '[' ? ']' : ')'] < 0)
								lk = undefined;
							else if (lk = lk.previous_token)
								if (lk.type !== 'TK_WORD' || lk.offset + lk.length !== tk.offset)
									lk = undefined;
							break;
						case 'TK_END_EXPR':
						case 'TK_END_BLOCK':
							tk = lk, ps[lk.content]++;
							if ((lk = tokens[lk.previous_pair_pos as number]) && (lk.content !== '}' || lk.data))
								lk.next_pair_pos = tk.offset;
							else tk = EMPTY_TOKEN, lk = undefined;
							break;
						case 'TK_OPERATOR':
							if (tk = lk, lk.content === '%') {
								if (lk = tokens[lk.previous_pair_pos as number])
									lk.next_pair_pos = tk.offset;
								else tk = EMPTY_TOKEN;
								break;
							}
						default: lk = undefined; break;
					}
				}
				if (ps[')'] > 0 || ps[']'] > 0 || ps['}'] > 0) tk = EMPTY_TOKEN;
				if (tk.type === 'TK_WORD' || tk.type.startsWith('TK_START_') || (tk.content === '%' && tk.next_pair_pos)) {
					let ttk = tk;
					text = tk.content, tk = tokens[tk.next_token_offset];
					while (tk.offset < end) {
						switch (tk.type) {
							case 'TK_DOT': text += '.', tk = tokens[tk.next_token_offset]; break;
							case 'TK_STRING': text += '""', tk = tokens[tk.next_token_offset]; break;
							case 'TK_START_BLOCK': text += ' {}', tk = tokens[tk.next_pair_pos as number]; break;
							case 'TK_START_EXPR':
								if (!tk.prefix_is_whitespace) {
									text += tk.content === '[' ? '[]' : '()';
									tk = tokens[tk.next_pair_pos as number];
									tk = tokens[tk.next_token_offset as number];
									break;
								}
							default: text += (tk.prefix_is_whitespace ? ' ' : '') + tk.content, tk = tokens[tk.next_token_offset]; break;
						}
					}
				} else text = '#any';
				word.range.start = document.positionAt(ttk.offset);
				word.text = text + word.text;
			}
			if (word.text.includes('.'))
				ttk = tokens[document.offsetAt(this.getWordAtPosition(position, false, true).range.start)];
		}
		if (word.range.start.character > 0)
			pre = this.document.getText(Range.create(word.range.start.line, 0, word.range.start.line, word.range.start.character)).trimLeft();
		suf = this.document.getText(Range.create(word.range.end.line, word.range.end.character, word.range.end.line + 1, 0)).trimRight();
		if (ttk) {
			if (ttk.type === 'TK_WORD') {
				let sk = ttk.semantic, symbol = ttk.symbol, fc: FuncNode;
				if (symbol) {
					kind = symbol.kind;
					if (kind === SymbolKind.Class)
						word.text = (symbol as ClassNode).full;
					else if (kind === SymbolKind.Property || kind === SymbolKind.Method)
						word.text = (fc = symbol as FuncNode).full.replace(/^\((\S+)\).*$/i, m =>
							`${fc.static ? m[1] : m[1].replace(/([^.]+)$/, '@$1')}.${fc.name}`);
				} else if (sk) {
					switch (sk.type) {
						case SemanticTokenTypes.function: kind = SymbolKind.Function; break;
						case SemanticTokenTypes.method: kind = SymbolKind.Method; break;
						case SemanticTokenTypes.class: kind = SymbolKind.Class; break;
						case SemanticTokenTypes.property: kind = SymbolKind.Property; break;
						case SemanticTokenTypes.parameter:
						case SemanticTokenTypes.variable: kind = SymbolKind.Variable; break;
					}
				} else
					kind = ttk.previous_token?.type === 'TK_DOT' ? SymbolKind.Property : SymbolKind.Variable;
			} else if (ttk.type === 'TK_LABEL')
				kind = SymbolKind.Field;
		}
		return { text: word.text, range: word.range, kind, pre, suf, linetext, token: ttk };
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
			if (line > item.range.end.line || line < item.selectionRange.start.line)
				continue;
			else if (line === item.selectionRange.start.line && character < item.selectionRange.start.character)
				continue;
			else if (line === item.range.end.line && character > item.range.end.character)
				continue;
			if (item.kind !== SymbolKind.Variable && (its = item.children))
				if (it = this.searchScopedNode(position, its))
					return it;
				else {
					if (position.line > item.selectionRange.start.line || position.character > item.selectionRange.end.character)
						return item;
				}
			return undefined;
		}
		return undefined;
	}

	public getScopeChildren(scopenode?: DocumentSymbol) {
		let p: FuncNode | undefined, nodes: DocumentSymbol[] = [], it: DocumentSymbol, vars: { [key: string]: any } = {}, _l = '';
		if (scopenode) {
			let ff = scopenode as FuncNode, fn_is_static = ff.kind === SymbolKind.Function && ff.static;
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
					if (fn_is_static) {
						let t: Variable;
						for (const n in p.declaration)
							if ((t = p.declaration[n] as Variable) && (t.static || t.static === null) && (!vars[n] || vars[n].static === null))
								vars[n] = t;
					} else {
						for (const n in p.local)
							if (vars[n] === undefined)
								vars[n] = p.local[n];
						for (const n in p.global)
							if (vars[n] === undefined)
								vars[n] = null;
						for (const n in p.declaration)
							if (vars[n] === undefined)
								vars[n] = p.declaration[n];
					}
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

	public update_relevance() {
		let uri = this.uri, { list, main } = getincludetable(uri), dir = (lexers[main.toLowerCase()] ?? this).scriptdir;
		this.relevance = list;
		if (dir !== this.scriptdir)
			this.initlibdirs(dir), this.parseScript();
		for (let u in { ...this.relevance, ...this.include }) {
			let d = lexers[u];
			if (d && !(d.relevance && d.relevance[uri])) {
				d.relevance = getincludetable(u).list;
				if (d.scriptdir !== dir)
					d.initlibdirs(dir), d.parseScript();
			}
		}
	}

	public initlibdirs(dir?: string) {
		if (inBrowser)
			return;
		const workfolder = resolve().toLowerCase();
		if (dir)
			this.scriptdir = dir;
		else if (workfolder !== this.scriptpath && workfolder !== argv0.toLowerCase() && this.scriptpath.startsWith(workfolder) && !this.scriptpath.endsWith('\\lib')) {
			if (existsSync(this.scriptpath + '\\lib') && statSync(this.scriptpath + '\\lib').isDirectory())
				this.scriptdir = this.scriptpath;
			else this.scriptdir = workfolder.replace(/\\lib$/, '');
		} else this.scriptdir = this.scriptpath.replace(/\\lib$/, '');
		this.libdirs = [this.scriptdir + '\\lib'];
		for (const t of libdirs) if (this.libdirs[0] !== t) this.libdirs.push(t);
	}

	public instrorcomm(pos: Position): number | undefined {
		let offset = this.document.offsetAt(pos);
		return this.strcommpos.find(it => offset >= it.start && it.end >= offset)?.type;
	}

	public colors() {
		let t = this.strcommpos, document = this.document, text = document.getText(), colors: ColorInformation[] = [];
		for (let a of t) {
			if (a.type === 2) {
				let s = a.start, e = a.end, m = colorregexp.exec(text.substring(s, e)), range: Range, v = '';
				if (!m || (!m[1] && e - s + 1 !== m[2].length + 2)) continue;
				range = Range.create(document.positionAt(s += m.index + (m[1] ? m[1].length : 0)), document.positionAt(s + m[2].length));
				v = m[5] ? colortable[m[5].toLowerCase()] : m[3] === undefined ? m[2] : m[2].substring(2);
				let color: any = { red: 0, green: 0, blue: 0, alpha: 1 }, cls: string[] = ['red', 'green', 'blue'];
				if (m[4] !== undefined) cls.unshift('alpha');
				for (const i of cls) color[i] = (parseInt('0x' + v.substring(0, 2)) / 255), v = v.slice(2);
				colors.push({ range, color });
			}
		}
		return colors;
	}

	public addDiagnostic(message: string, offset: number, length: number, severity: DiagnosticSeverity = DiagnosticSeverity.Error, arr?: Diagnostic[]) {
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

	private addSymbolFolding(symbol: DocumentSymbol, first_brace: number) {
		let l1 = extsettings.SymbolFoldingFromOpenBrace ? this.document.positionAt(first_brace).line : symbol.range.start.line;
		let l2 = symbol.range.end.line - 1;
		if (l1 < l2) this.foldingranges.push(FoldingRange.create(l1, l2, undefined, undefined, 'block'));
	}
}

export function pathanalyze(path: string, libdirs: string[], workdir: string = '') {
	let m: RegExpMatchArray | null, uri = '';

	if (path.startsWith('<') && path.endsWith('>')) {
		if (!(path = path.slice(1, -1))) return;
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
		if (path.indexOf(':') < 0) path = resolve(workdir, path);
		uri = URI.file(path).toString().toLowerCase();
		return { uri, path };
	}
}

export function parseinclude(include: { [uri: string]: string }, dir: string) {
	for (const uri in include) {
		let path = include[uri];
		if (!(lexers[uri]) && existsSync(path)) {
			let t = openFile(path);
			if (!t)
				continue;
			let doc = new Lexer(t, dir);
			lexers[uri] = doc, doc.parseScript();
			parseinclude(doc.include, dir);
			doc.relevance = getincludetable(uri).list;
		}
	}
}

export function getClassMembers(doc: Lexer, node: DocumentSymbol, staticmem: boolean = true): { [name: string]: DocumentSymbol } {
	if (node.kind !== SymbolKind.Class)
		return {};
	let v: { [name: string]: DocumentSymbol } = {}, l = node.name.toLowerCase();
	let _cls: any = node, cl: ClassNode, tn: DocumentSymbol, hasget: any = {};
	let isobj = l === 'object' || l === 'comobjarray' || (!(node as ClassNode).extends && l !== 'any');
	getmems(doc, node, staticmem);
	if (staticmem) {
		if (isobj && !v['call'] && v['__new']) {
			tn = Object.assign({}, v['__new']), tn.name = 'Call', (<any>tn).def = false;
			v['call'] = tn;
		}
		if ((cl = ahkvars['class'] as ClassNode) && cl !== node) {
			for (l in cl.staticdeclaration)
				if (!v[l]) v[l] = cl.staticdeclaration[l], (<any>v[l]).uri = (<any>cl).uri;
		}
	}
	let other: string[] = ['object', 'any'];
	if (!isobj)
		if (!staticmem) {
			other.splice(0, 1);
			if (node === ahkvars['comobject'])
				other = [];
		}
	for (let cls of other)
		if (cl = ahkvars[cls] as ClassNode) {
			for (l in cl.declaration)
				if (!v[l] || (v[l] as any).def === false) v[l] = cl.declaration[l], (<any>v[l]).uri = (<any>cl).uri;
		}
	return v;

	function getmems(doc: Lexer, node: DocumentSymbol, staticmem: boolean) {
		let u = (<any>node).uri, l2: string;
		if (hasget[l2 = `${u},${(node as ClassNode).full}`.toLowerCase()])
			return;
		hasget[l2] = true;
		if (staticmem) {
			if (!v['__new']) {
				let it = (node as ClassNode).declaration['__new'];
				if (it) v['__new'] = it, (<any>it).uri = u;
			}
			for (let it of Object.values((node as ClassNode).staticdeclaration)) {
				if (!v[l = it.name.toLowerCase()] || (it.kind === SymbolKind.Class || it.kind === SymbolKind.Method) && v[l].kind === SymbolKind.Property)
					v[l] = it, (<any>it).uri = u;
				else if (l === 'call' && (<any>v['call']).def === false)
					v[l] = it, (<any>it).uri = u;
			}
			if ((v['__new'] as FuncNode)?.static)
				delete v['__new'];
		} else {
			for (let it of Object.values((node as ClassNode).declaration)) {
				if (!v[l = it.name.toLowerCase()] || ((<any>v[l]).def === false && (<any>it).def !== false))
					v[l] = it, (<any>it).uri = u;
			}
		}
		if ((l = (<ClassNode>node).extends?.toLowerCase()) && l !== (l2 = (<ClassNode>node).full.toLowerCase())) {
			let cl: any, nd: DocumentSymbol | undefined, dc: Lexer;
			let p = l.split('.'), p2 = l2.split('.'), i = -1;
			if (!isobj && (l === 'object' || l === 'comobjarray'))
				isobj = true;
			while (p[i + 1] === p2[i + 1])
				i++;
			if (p.length > p2.length && i === p2.length - 1) {
				if (i + 1 < p.length && v[p[++i]]) {
					cl = [{ node: v[p[i]], uri: (<any>v[p[i]]).uri }];
					p.splice(0, i);
				}
			} else
				cl = searchNode(doc, p[0], Position.create(0, 0), SymbolKind.Class);
			if (cl && cl.length && (nd = cl[0].node).kind === SymbolKind.Class) {
				_cls.checkmember ??= (nd as any).checkmember;
				dc = lexers[cl[0].uri] ?? doc;
				if (cl[0].uri && (<any>nd).uri === undefined)
					(<any>nd).uri = cl[0].uri;
				while (nd) {
					if (p.length === 1) {
						getmems(dc, nd, staticmem);
						break;
					} else {
						let bak = v;
						v = {};
						getmems(dc, nd, true);
						p.splice(0, 1);
						if ((nd = v[p[0]]) && nd.kind !== SymbolKind.Class)
							nd = undefined;
						v = bak;
					}
				}
			}
		} else if (!l && !isobj && node.name.toLowerCase() !== 'any')
			isobj = true;
	}
}

export function cleardetectcache() {
	hasdetectcache = {};
}

export function getcacheproperty(): string[] {
	return hasdetectcache['##object'] ?? [];
}

export function detectExpType(doc: Lexer, exp: string, pos: Position, types: { [type: string]: DocumentSymbol | boolean }) {
	let nd = new Lexer(TextDocument.create('', 'ahk2', -10, '_:=' + exp));
	searchcache = {}, nd.parseScript();
	let it = nd.children.shift() as Variable, s = Object.keys(it?.returntypes || {}).pop();
	if (s)
		detectExp(doc, s, pos, nd.document.getText(Range.create(it.selectionRange.end, it.range.end))).map(tp => types[tp] = searchcache[tp] ?? false);
}

export function detectVariableType(doc: Lexer, n: { node: DocumentSymbol, scope?: DocumentSymbol }, pos?: Position) {
	let name = n.node.name.toLowerCase(), syms: DocumentSymbol[] = [], types: any = {};
	if (name.match(/^[$@#]([\w.]|[^\x00-\x7f])+$/))
		return [name];
	else if (name.startsWith('a_'))
		if (name === 'a_args')
			return ['#array'];
		else if (builtin_variable.includes(name) || isahk2_h && builtin_variable_h.includes(name))
			return ['#string'];
	if (n.scope) {
		let scope = n.scope;
		if (n.node.kind === SymbolKind.TypeParameter) {
			let s = scope;
			if ((scope = (scope as any).parent)?.kind === SymbolKind.Property && (scope as any).parent?.kind === SymbolKind.Class)
				s = scope;
			let ts = cvt_types(s.detail?.match(new RegExp(`^@(param|arg)\\s+{(.*?)}\\s+${name}\\b`, 'mi'))?.[2] ?? '');
			if (ts && (ts.map(t => types[t] = true), !types['@object']))
				return ts;
		} else
			syms.push(n.node);
	} else {
		syms.push(n.node);
		for (const uri in doc.relevance) {
			let v = lexers[uri]?.declaration?.[name];
			if (v)
				syms.push(v);
		}
	}
	for (let sym of syms) {
		let ts = get_comment_types(sym);
		if (ts)
			if (ts.map(t => types[t] = true), !types['@object'])
				return ts;
			else break;
	}
	let scope = pos ? doc.searchScopedNode(pos) : undefined, ite = syms[0] as Variable;
	while (scope) {
		if (scope.kind === SymbolKind.Class)
			scope = (<ClassNode>scope).parent;
		else if (!(<FuncNode>scope).declaration?.[name])
			scope = (<FuncNode>scope).parent;
		else break;
	}
	if (!scope && pos && pos !== n.node.selectionRange.end)
		scope = doc as any;
	for (const it of scope?.children ?? [])
		if (name === it.name.toLowerCase()) {
			if (it.kind === SymbolKind.Variable || it.kind === SymbolKind.TypeParameter) {
				if (pos && (it.selectionRange.end.line > pos.line || (it.selectionRange.end.line === pos.line && it.selectionRange.start.character > pos.character)))
					break;
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
			for (let s in (<Variable>ite).returntypes)
				detectExp(doc, s.toLowerCase(), ite.range.end, fullexp).map(tp => types[tp] = true);
			// if (types['#func'])
			// 	searchcache['#return'] = { exp: fullexp, pos: ite.range.end, doc };
			if (types['#object'] === true) {
				let p = (ite as any).property;
				if (p?.length) (hasdetectcache['##object'] ??= []).push(...p);
			}
		}
	}
	if (types['#any'])
		return [];
	return Object.keys(types);
}

function get_comment_types(it: DocumentSymbol, prop = false) {
	if (it.detail) {
		return cvt_types((it.detail.match(new RegExp(`^\\s*@${prop ? 'prop(erty)?' : '(var)'}\\s+{(.*?)}\\s+${it.name}\\b`, 'mi')) ??
			it.detail.match(/^\s*@(type)\s+{(.*?)}(?=\s|$)/mi))?.[2] ?? '');
	}
}

export function detectExp(doc: Lexer, exp: string, pos: Position, fullexp?: string): string[] {
	if (exp.includes('=>'))
		return [exp.trim()];
	let tz = `${exp.trim()},${doc.uri},${pos.line},${pos.character}`;
	if (hasdetectcache[tz] !== undefined)
		return hasdetectcache[tz] || [];
	hasdetectcache[tz] = false;
	return hasdetectcache[tz] = detect(doc, exp, pos, 0, fullexp);
	function detect(doc: Lexer, exp: string, pos: Position, deep: number = 0, fullexp?: string): string[] {
		let t: string | RegExpMatchArray | null, tps: string[] = [];
		exp = exp.replace(/#any(\(\)|\.(\w|[^\x00-\x7f])+)+/g, '#any').replace(/\b(true|false)\b/gi, '#number');
		while ((t = exp.replace(/\(((\(\)|[^\(\)])+)\)/g, (...m) => {
			let ts = detect(doc, m[1], pos, deep + 1);
			return ts.length > 1 ? `[${ts.join(',')}]` : (ts.pop() || '#any');
		})) !== exp)
			exp = t;
		while ((t = exp.replace(/\s(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*([+\-*/&|^]|\/\/|<<|>>|\*\*)\s*(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*/g, ' #number ')) !== exp)
			exp = t;
		while ((t = exp.replace(/\s[+-]?(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s+(\.\s+)?[+-]?(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*/g, ' #string ')) !== exp)
			exp = t;
		while ((t = exp.replace(/\s(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*(~=|<|>|[<>]=|!?=?=|\b(is|in|contains)\b)\s*(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*/ig, ' #number ')) !== exp)
			exp = t;
		while ((t = exp.replace(/(not|!|~|\+|-)\s*(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])/g, ' #number ')) !== exp)
			exp = t;
		while ((t = exp.replace(/(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*(\sand\s|\sor\s|&&|\|\||\?\?)\s*(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])/ig, (...m) => {
			let ts: any = {}, mt: RegExpMatchArray | null;
			for (let i = 1; i < 5; i += 3) {
				if (mt = m[i].match(/^\[([^\[\]]+)\]$/)) {
					mt[1].split(',').map(tp => ts[tp] = true);
				} else
					ts[m[i]] = true;
			}
			if (ts['#any'])
				return '#any';
			ts = Object.keys(ts);
			return ts.length > 1 ? `[${ts.join(',')}]` : (ts.pop() || '#void');
		})) !== exp)
			exp = t;
		while ((t = exp.replace(/(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*\?\s*(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])\s*:\s*(([$@#\w.]|[^\x00-\x7f]|\(\))+|\[[^\[\]]+\])/, (...m) => {
			let ts: any = {}, mt: RegExpMatchArray | null;
			for (let i = 3; i < 6; i += 2) {
				if (mt = m[i].match(/^\[([^\[\]]+)\]$/)) {
					mt[1].split(',').map(tp => ts[tp] = true);
				} else
					ts[m[i]] = true;
			}
			if (ts['#any'])
				return '#any';
			ts = Object.keys(ts);
			return ts.length > 1 ? `[${ts.join(',')}]` : (ts.pop() || '#void');
		})) !== exp)
			exp = t;
		if (deep === 0) {
			while (exp !== (t = exp.replace(/((\w|[$@#.]|[^\x00-\x7f])+)\(\)/, (...m) => {
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
								} else if ((uri = (<any>n).uri || uri) && lexers[uri]) {
									let m = cvt_types(n.detail?.match(/^@returns?\s+{(.+?)}/mi)?.[1] ?? ''), o: any = {};
									if (m)
										m.map(s => o[s] = true), n.returntypes = o;
									for (const e in n.returntypes)
										detectExp(lexers[uri], e.toLowerCase(), Position.is(n.returntypes[e]) ? n.returntypes[e] : pos).map(tp => { ts[tp] = true });
								}
								break;
							case SymbolKind.Variable:
								if (lexers[uri])
									detectVariableType(lexers[uri], it, uri === doc.uri ? pos : it.node.selectionRange.end).map(tp => {
										tp.includes('=>') && (searchcache[tp] ??= gen(tp, uri, it.node, it.scope));
										if (n = searchcache[tp]?.node) {
											if (n.kind === SymbolKind.Class || n.kind === SymbolKind.Function || n.kind === SymbolKind.Method)
												for (const e in n.returntypes)
													detect(lexers[uri], e.toLowerCase(), Position.is(n.returntypes[e]) ? n.returntypes[e] : pos).map(tp => { ts[tp] = true });
										}
									});
								break;
							case SymbolKind.Property: {
								let tps: any = {};
								if (get_comment_types(n, true)?.map(tp => tps[tp] = true)) {
								} else if (lexers[uri]) {
									for (s in n.returntypes)
										detectExpType(lexers[uri], s, n.range.end, tps);
								}
								if (tps['#any'])
									return '#any';
								for (const tp in tps) {
									tp.includes('=>') && (searchcache[tp] ??= gen(tp, uri, n, it.scope));
									if (n = searchcache[tp]?.node) {
										if (n.kind === SymbolKind.Class || n.kind === SymbolKind.Function || n.kind === SymbolKind.Method)
											for (const e in n.returntypes)
												detect(lexers[uri], e.toLowerCase(), Position.is(n.returntypes[e]) ? n.returntypes[e] : pos).map(tp => ts[tp] = true);
									}
								}
								break;
							}
							case SymbolKind.Class:
								if ((uri = (<any>n).uri || uri) && lexers[uri])
									for (const i of Object.values(getClassMembers(lexers[uri], n, true)))
										if ((<any>i).def !== false && i.name.toLowerCase() === 'call') {
											let n = i as FuncNode;
											for (const e in n.returntypes)
												detect(lexers[uri], e.toLowerCase(), Position.is(n.returntypes[e]) ? n.returntypes[e] : pos).map(tp => { ts[tp] = true });
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
			if (t = ex.match(/^([@#]?)(\$|\w|[^\x00-\x7f])+(\.[@#]?(\$|\w|[^\x00-\x7f])+)*$/)) {
				let ll = '', ttt: any;
				if ((t[1] && !t[3]) || searchcache[ex])
					ts[ex] = true;
				else for (const n of searchNode(doc, ex, ex === exp ? { line: pos.line, character: pos.character - ex.length } : pos, SymbolKind.Variable) || []) {
					switch (n.node.kind) {
						case SymbolKind.TypeParameter:
						case SymbolKind.Variable:
							detectVariableType(lexers[n.uri], n, n.uri === doc.uri ? pos : n.node.selectionRange.end)
								.map(tp => (tp.includes('=>') && (searchcache[tp] ??= gen(tp, n.uri, n.node, n.scope)), ts[tp] = true));
							break;
						case SymbolKind.Property:
							if (ttt = get_comment_types(n.node, true)) {
								(ttt as string[]).map(tp => (tp.includes('=>') && (searchcache[tp] ??= gen(tp, n.uri, n.node, n.scope)), ts[tp] = true));
							} else if ((<Variable>n.node).returntypes) {
								for (let s in (n.node as Variable).returntypes) {
									if (s === ' #object') {
										ts['#object'] = true;
										let p = (n.node as any).property;
										if (p?.length) (hasdetectcache['##object'] ??= []).push(...p);
									} else if (s)
										detect(lexers[n.uri] ?? doc, s, n.node.range.end)
											.map(tp => (tp.includes('=>') && (searchcache[tp] ??= gen(tp, n.uri, n.node, n.scope)), ts[tp] = true));
								}
							} else if (n.node.children) {
								for (const it of n.node.children) {
									let rets = (<FuncNode>it).returntypes;
									if (it.name.toLowerCase() === 'get' && it.kind === SymbolKind.Function) {
										for (const ret in rets)
											detect(lexers[n.uri] ?? doc, ret.toLowerCase(), Position.is(rets[ret]) ? rets[ret] : pos)
												.map(tp => (tp.includes('=>') && (searchcache[tp] ??= gen(tp, n.uri, n.node, n.scope)), ts[tp] = true));
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
							ts[ll = ex.startsWith('$') ? ex : n.node.name.toLowerCase()] = true, searchcache[ll] = n;
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

	function gen(def: string, uri: string, node: DocumentSymbol, scope?: DocumentSymbol) {
		if (def.startsWith('(('))
			def = def.slice(1, -1);
		let m = def.match(/^\(([^)]*)\)=>(.*)$/);
		if (m) {
			let d = new Lexer(TextDocument.create('', 'ahk2', 0, `${node.name}(${m[1]})=>${m[2].includes('=>') ? 'void' : m[2]}`), undefined, -1);
			d.parseScript();
			let n = d.declaration[node.name.toLowerCase()];
			if (n?.kind === SymbolKind.Function) {
				if (m[2].includes('=>'))
					n.returntypes = { [m[2]]: true };
				if (node.kind === SymbolKind.TypeParameter && scope) {
					let p = (scope as any).parent;
					if (p?.parent?.kind === SymbolKind.Property && p.parent.parent?.kind === SymbolKind.Class)
						scope = p.parent as DocumentSymbol;
					formatMarkdowndetail(scope);
				} else formatMarkdowndetail(node);
				let detail = node.detail?.split('\n___\n').pop();
				if (detail)
					n.detail = detail.trim();
				return { node: n, uri };
			}
		}
	}
}

export function searchNode(doc: Lexer, name: string, pos: Position | undefined, kind: SymbolKind, isstatic = true): [{ node: DocumentSymbol, uri: string, scope?: DocumentSymbol, ref?: boolean }] | undefined | null {
	let node: DocumentSymbol | undefined, res: { node: DocumentSymbol, uri: string, scope?: DocumentSymbol, fn_is_static?: boolean } | undefined | false | null, t: any, uri = doc.uri;
	if (kind === SymbolKind.Method || kind === SymbolKind.Property || name.includes('.')) {
		let p = name.split('.'), nodes = searchNode(doc, p[0], pos, SymbolKind.Class), i = 0, ps = 0;
		if (!nodes || p.length < 2) return undefined;
		let { node: n, uri: u } = nodes[0];
		uri = u || uri;
		if (nodes[0].ref && p[0].match(/^[^@#]/))
			p[0] = '@' + p[0];
		if (n.kind === SymbolKind.Variable) {
			let tps = detectVariableType(lexers[uri], nodes[0], doc.uri === u ? pos : n.selectionRange.end), rs: any = [];
			for (const tp of tps) {
				searchNode(lexers[uri], name.replace(new RegExp('^' + p[0]), tp), tp.match(/^[@#]/) ? undefined : pos, kind)?.map(it => {
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
					let mems = getClassMembers(doc, n, ss), it: DocumentSymbol;
					if (i === ps) {
						if (it = mems[_]) {
							node = it, uri = (<any>it).uri || '';
							if (_ === 'prototype')
								node = Object.assign({}, it), node.kind = SymbolKind.Object;
						}
						if (!node && _ !== 'clone' && (it = mems['__call']))
							node = it, uri = (<any>it).uri || '';
					} else if (it = mems[_])
						node = it, uri = (<any>it).uri || '';
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
		res = searchIncludeNode(doc.relevance ?? {}, name);
	}
	if (res) {
		if (res.node.kind === SymbolKind.Variable && res.node === doc.declaration[name]) {
			let t = searchIncludeNode(doc.relevance ?? {}, name);
			if (t && (t.node.kind !== SymbolKind.Variable || (t.node as any).def))
				res = t;
		}
		if (res.fn_is_static) {
			let nn = res.node, uu = res.uri;
			for (const u in doc.relevance)
				if (t = lexers[u].declaration[name]) {
					if (t.kind !== SymbolKind.Variable)
						return [{ node: t, uri: u }];
					if (!(<Variable>nn).def)
						nn = t, uu = u;
				}
			res.node = nn, res.uri = uu;
		}
	}
	if (kind !== SymbolKind.Field && (!res || (res.node.kind === SymbolKind.Variable && !(<Variable>res.node).def)) && (t = ahkvars[name.replace(/^[@#]/, '')]))
		return [{ uri: t.uri, node: t }];
	if (res)
		return [res];
	else return undefined;
	function searchIncludeNode(list: { [uri: string]: string }, name: string) {
		let ret = undefined;
		for (const uri in list) {
			let d = lexers[uri];
			if (!d) {
				let path = URI.parse(uri).fsPath;
				if (existsSync(path)) {
					let t = openFile(path);
					if (!t)
						continue;
					d = lexers[uri] = new Lexer(t);
					d.parseScript();
				} else
					continue;
			}
			let t = d.searchNode(name, undefined, kind);
			if (t)
				if (t.node.kind !== SymbolKind.Variable)
					return t;
				else if (!ret || (t.node as any).def)
					ret = t;
		}
		return ret;
	}
}

export function getFuncCallInfo(doc: Lexer, position: Position) {
	let func: CallInfo | undefined, offset = doc.document.offsetAt(position), off = { start: 0, end: 0 }, pos: Position = { line: 0, character: 0 };
	let scope = doc.searchScopedNode(position), funccall: CallInfo[], full = '', tt: any;
	let text = '', name = '', index = -1, len = 0, o = offset, fcoffset = 0;
	if (scope) {
		while (scope && !(<FuncNode>scope).funccall)
			scope = (<FuncNode>scope).parent;
		funccall = (<FuncNode>scope)?.funccall ?? doc.funccall;
	} else
		funccall = doc.funccall;
	for (const item of funccall) {
		const start = doc.document.offsetAt(item.range.start), end = doc.document.offsetAt(item.range.end);
		if (start + item.name.length < offset) {
			if (offset > end) {
				if (item.range.end.line !== position.line || doc.document.getText({ start: item.range.end, end: position }).trim())
					continue;
			} else if (offset === end && doc.document.getText(Range.create({ line: position.line, character: position.character - 1 }, position)) === ')')
				continue;
			if (!func || (off.start <= start && end <= off.end))
				func = item, off = { start, end }, pos = item.range.start;
		}
	}
	if (func && func.paraminfo) {
		index = offset > off.start + func.name.length ? 0 : -1;
		if (index !== -1)
			for (let c of func.paraminfo.comma)
				if (offset > c) ++index; else break;
		return { name: func.name.toLowerCase(), pos, index, full };
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
				text = t[2] + '(' + t[4].substring(0, i) + (q === 0 ? ')' : ''), name = full = t[2].toLowerCase();
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
		fcoffset = doc.document.offsetAt(func.range.start);
	} else
		return undefined;
	while ((tt = text.search(/['"]/)) !== -1) {
		let tk: Token;
		if ((tk = doc.tokens[fcoffset + tt]) && tk.type === 'TK_STRING') {
			text = text.substring(0, tt) + '_'.repeat(tk.length) + text.substring(tt + tk.length);
		} else
			break;
	}
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

export function getincludetable(fileuri: string): { count: number, list: { [uri: string]: string }, main: string } {
	let list: { [uri: string]: string } = {}, count = 0, has = false, doc: Lexer, res = { list, count, main: '' };
	for (const uri in lexers) {
		list = {}, count = 0, has = (uri === fileuri);
		traverseinclude(lexers[uri].include, uri);
		if (has && count > res.count)
			res = { list, count, main: uri };
	}
	if (res.count) {
		delete res.list[fileuri];
		if (res.main && res.main !== fileuri)
			res.list[res.main] ??= URI.parse(res.main).fsPath;
	}
	return res;
	function traverseinclude(include: any, cururi: string) {
		for (const uri in include) {
			if (fileuri === uri) {
				has = true;
				if (!list[cururi])
					list[cururi] = URI.parse(cururi).fsPath, count++;
			}
			if (!list[uri] && (doc = lexers[uri])) {
				list[uri] = include[uri], count++;
				if (cururi !== uri)
					traverseinclude(doc.include, uri);
			}
		}
	}
}

export function formatMarkdowndetail(node: DocumentSymbol, name?: string, overloads?: string[]): string {
	let params: { [name: string]: string[] } = {}, details: string[] = [], lastparam = '', m: RegExpMatchArray | null;
	let detail = node.detail, ols = overloads ?? [], s, code = 0;
	if (!detail)
		return '';
	detail.split(/\r?\n/).map(line => {
		if (line.startsWith('@')) {
			lastparam = '';
			if (code)
				code === 2 && details.push('```'), code = 0;
			if (m = line.match(/^@(\S+)(.*)$/)) {
				switch (m[1].toLowerCase()) {
					case 'param':
					case 'arg':
						m[2].replace(/^\s*({(.*?)}\s+)?(\S+)(.*)$/, (...m) => {
							let t = m[4].replace(/^\s*[-—]\s*|\s*$/g, '');
							s = `\`${m[3]}\`${m[2] ? `: *${m[2]}*` : ''}` + (t ? ' — ' + t : '');
							name ?? details.push(`\n*@param* ${s}`);
							(params[lastparam = m[3].toLowerCase()] ??= []).push(s);
							(params[lastparam] as any).types = m[2];
							return '';
						});
						break;
					case 'overload': ols.push('_' + m[2].trim()); break;
					case 'example':
						s = m[2].replace(/\s*<caption>(.*?)<\/caption>\s*/, (...m) => { details.push('\n*@example* ' + m[1]); return ''; });
						if (code = 1, s === m[2]) {
							s = m[2].replace(/\s*<caption>(.*)/, (...m) => { details.push('\n*@example* ' + m[1]); return ''; });
							if (s !== m[2])
								break;
						}
						details.push('```ahk2' + (s ? '\n' + s : '')), code = 2;
						break;
					case 'var':
					case 'prop':
					case 'property':
						s = m[2].replace(/^\s*({(.*?)}\s+)?(\S+)(\s*[-—])?\s*/, (...m) => {
							return m[2] ? `\`${m[3]}\`: *${m[2]}* — ` : m[3] + ' — ';
						}).replace(/\s*—\s*$/, '');
						details.push(`\n*@${m[1].toLowerCase()}* ${s}`);
						break;
					case 'return':
					case 'returns':
						m[2].replace(/^\s*{(.+?)}/, (...m) => {
							let o: any = {}, tps = cvt_types(m[1]);
							if (tps)
								tps.map(t => o[t] = true), (node as FuncNode).returntypes = o;
							return '';
						});
					default:
						s = m[2].replace(/^\s*({(.*?)}(?=\s|$))?(\s*[-—])?\s*/, '*$2* — ').replace(/\s*—\s*$/, '');
						details.push(`\n*@${m[1].toLowerCase()}* ${s}`);
						break;
				}
			} else details.push(line);
		} else if (lastparam)
			params[lastparam].push(line), name ?? details.push(line);
		else if (code === 1 && (s = line.indexOf('</caption>')) > -1)
			details.push(line.substring(0, s), '```ahk2' + ((s = line.substring(s + 10).trimLeft()) ? '\n' + s : '')), code = 2;
		else
			details.push(line);
	});
	if (code === 2)
		details.push('```');
	(node as FuncNode).params?.map(it => {
		let p = params[it.name.toLowerCase()];
		if (p) {
			if (p.length)
				p[0] = '*@param* ' + p[0], it.detail = p.join('\n').replace(/ — ?/, '\n___\n').replace(/(?<!\\)\\@/g, '\n@');
			let o: any = {}, types = cvt_types((p as any).types ?? '');
			if (types)
				it.returntypes = o, types.map(t => o[t] = true);
		}
	});
	if (name !== undefined)
		s = params[name.toLowerCase()]?.join('\n') ?? '', detail = s + '\n\n' + details.join('\n');
	else if (!overloads && ols.length)
		detail = '*@overload*\n```ahk2\n' + ols.join('\n') + '\n```\n' + (details.length ? '___\n' + details.join('\n') : '');
	else detail = details.join('\n');
	return detail;
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
				return diagnostic.assignerr('Class', a.name);
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
		if (!it.name)
			continue;
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
						delete (<Variable>it).def, diags.push({ message: samenameerr(decs[_low], it), range: it.selectionRange, severity: DiagnosticSeverity.Error });
				} else {
					if (decs[_low].kind === SymbolKind.Variable) {
						if ((<Variable>decs[_low]).def)
							delete (<Variable>decs[_low]).def, diags.push({ message: samenameerr(it, decs[_low]), range: decs[_low].selectionRange, severity: DiagnosticSeverity.Error });
						decs[_low] = it;
					} else if ((<Variable>decs[_low]).def !== false)
						diags.push({ message: samenameerr(decs[_low], it), range: it.selectionRange, severity: DiagnosticSeverity.Error });
				}
				break;
		}
	}
}

export function update_commentTags(regexp: string) {
	try {
		commentTags = new RegExp(regexp, 'i');
	} catch (e: any) {
		commentTags = new RegExp('^;;\\s*(?<tag>.*)');
		throw e;
	}
}

function cvt_types(tps: string) {
	if (tps = tps.replace(/\s/g, '')) {
		let t: string, o: any = {};
		while ((t = tps.replace(/\(([^)]*)\)(?!\s*=>)/g, '$1')) !== tps)
			tps = t;
		tps.toLowerCase().split(/(?<!=>\s*[^)]*)\|/)
			.map(tp => o[tp === 'void' ? '#void' : tp.includes('=>') ? tp :
				tp.replace(/(?<=(^|\.))([^.$@#]+)$/, '@$2').replace('$', '')] = true);
		delete o[''];
		let a = Object.keys(o);
		if (a.length)
			return a;
	}
}