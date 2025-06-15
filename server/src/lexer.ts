/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { existsSync, statSync } from 'fs';
import { basename, resolve } from 'path';
import {
	ColorInformation, Diagnostic, DocumentSymbol, FoldingRange, MarkupContent,
	Position, Range, SemanticTokensBuilder, SymbolInformation,
} from 'vscode-languageserver';

import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	a_Vars, action, ahkUris, ahkVars, ahkVersion, alpha_11, alpha_3, builtinCommands_v1,
	commentTags, configCache, diagnostic, hoverCache, inactiveVars, isahk2_h, lexers, libDirs,
	libSymbols, locale, openAndParse, parseInclude, reservedIndex, restorePath, rootDir,
	symbolProvider, URI, utils, versionMatch, warn, workspaceFolders
} from './common';
import { DiagnosticSeverity, MessageType, SymbolKind } from './lsp-enums';

export interface ParamInfo {
	offset: number
	end?: number
	count: number
	comma: number[]
	miss: number[]
	unknown: boolean
	method?: boolean
	data?: string[]
	name?: string
}

export interface CallSite extends AhkSymbol {
	offset?: number
	paraminfo?: ParamInfo
}

export interface AhkDoc {
	include: string[]
	children: AhkSymbol[]
}

enum BlockType { Script, Func, Class, Method, Mask = Method, Body, Pair = 8 }

export enum TokenType {
	EOF,
	Comma,
	Dot,
	Assign,
	Operator,
	String,
	Identifier,
	Reserved,
	Number,
	Directive,
	Label,
	Text,
	Invoke,
	Unknown,
	BracketStart = 16,
	BracketEnd,
	BlockStart = 32,
	BlockEnd,
	Comment = 64,
	BlockComment,
	InlineComment,
	Hotkey = 128,
	HotkeyLine,
}

export enum FuncScope { DEFAULT, STATIC, GLOBAL }

export enum SemanticTokenTypes {
	class,
	function,
	method,
	module,
	parameter,
	variable,
	property,
	keyword,
	string,
	number,
	comment,
	operator,
	event,
	'keyword.control.directive',
}
const SE_CLASS = { type: SemanticTokenTypes.class };
const SE_KEYWORD = { type: SemanticTokenTypes.keyword };
const SE_NUMBER = { type: SemanticTokenTypes.number };
const SE_OPERATOR = { type: SemanticTokenTypes.operator };
const SE_PARAM = { type: SemanticTokenTypes.parameter };
const SE_PROPERTY = { type: SemanticTokenTypes.property };
const SE_STRING = { type: SemanticTokenTypes.string };
const SE_COMMENT = { type: SemanticTokenTypes.comment };
const SE_EVENT = { type: SemanticTokenTypes.event };
export const TT2STT: Record<number, SemanticToken> = {
	[TokenType.Number]: SE_NUMBER,
	[TokenType.Reserved]: SE_KEYWORD,
	[TokenType.String]: SE_STRING,
	[TokenType.Text]: SE_STRING,
	[TokenType.Comment]: SE_COMMENT,
	[TokenType.BlockComment]: SE_COMMENT,
	[TokenType.InlineComment]: SE_COMMENT,
	[TokenType.Hotkey]: SE_EVENT,
	[TokenType.HotkeyLine]: SE_EVENT,
	[TokenType.Directive]: { type: SemanticTokenTypes['keyword.control.directive'] },
};

export enum SemanticTokenModifiers {
	static = 1,		// true
	readonly = 2,
	definition = 4,
	defaultLibrary = 8,
	deprecated = 16,
}

export enum DiagnosticCode {
	call = 'call statement',
	expect = 'expect',
	func_expr = 'function definition expressions',
	include = 'include',
	maybe_assign = 'maybe-assign',
	module = 'module',
	opt_chain = 'optional chaining',
	typed_prop = 'typed properties',
	v_ref = 'virtual references',
}

enum Mode { BlockStatement, Statement, ObjectLiteral, ArrayLiteral, Conditional, Expression }

export interface AhkSymbol extends DocumentSymbol {
	alias?: string
	alias_range?: Range
	module?: string
	cached_types?: Array<string | AhkSymbol>
	children?: AhkSymbol[]
	data?: unknown
	decl?: boolean
	def?: boolean
	export?: boolean
	full?: string
	has_warned?: boolean | number
	markdown_detail?: string
	ignore?: boolean
	overwrite?: number
	parent?: AhkSymbol
	returns?: number[] | null
	since?: string
	static?: boolean | null
	type_annotations?: Array<string | AhkSymbol> | false
	type_name?: string
	uri?: string
}

export interface FuncNode extends AhkSymbol {
	assume: FuncScope
	closure?: boolean
	params: Variable[]
	param_offsets: number[]
	param_def_len: number
	global: Record<string, Variable>
	local: Record<string, Variable>
	eval?: boolean
	full: string
	hasref: boolean
	variadic: boolean
	labels: Record<string, AhkSymbol[]>
	declaration: Record<string, AhkSymbol>
	overloads?: string | FuncNode[]
	overload_params?: Record<string, Variable>
	has_this_param?: boolean
	unresolved_vars?: Record<string, Variable>
	ranges?: [number, number][]	// class's __init
}

export interface ClassNode extends AhkSymbol {
	base?: AhkSymbol
	full: string
	extends: string
	extendsuri?: string
	parent?: AhkSymbol
	prototype?: ClassNode
	property: Record<string, FuncNode | ClassNode | Variable>
	$property?: Record<string, FuncNode | ClassNode | Variable> // aliases for prototype.property
	cache?: Variable[]
	undefined?: Record<string, Token>
	checkmember?: boolean
	static?: boolean	// not use
	generic_types?: (string | AhkSymbol)[][]
	type_params?: Record<string, AhkSymbol>
}

export interface Variable extends AhkSymbol {
	arr?: boolean | 2			// *, *,  ...
	assigned?: boolean | 1		// 1, ??=
	defaultVal?: string | false | null
	for_index?: number			// for v1, ... in
	full?: string
	is_global?: boolean
	is_param?: boolean
	range_offset?: [number, number]
	pass_by_ref?: boolean
	typed?: boolean | 1			// typed properties
}

export interface Property extends Variable {
	local?: Record<string, AhkSymbol>
	declaration?: Record<string, AhkSymbol>
	unresolved_vars?: Record<string, Variable>
	has_this_param?: boolean
	params?: Variable[]
	param_offsets?: number[]
	call?: FuncNode
	get?: FuncNode
	set?: FuncNode
	val?: Variable
}

export interface SemanticToken {
	type: SemanticTokenTypes
	modifier?: number
}

export interface Token {
	// if expression
	//   |statement
	body_start?: number
	callsite?: CallSite
	content: string
	data?: unknown
	has_LF?: boolean
	definition?: AhkSymbol
	fat_arrow_end?: boolean
	has_warned?: boolean | number
	hover_word?: string
	ignore?: boolean
	in_expr?: number
	length: number
	next_pair_pos?: number
	next_token_offset: number	// Next non-comment token offset
	offset: number
	op_type?: -1 | 0 | 1
	paraminfo?: ParamInfo
	pos?: Position
	prefix_is_whitespace?: string
	previous_extra_tokens?: { i: number, len: number, tokens: Token[], suffix_is_whitespace: boolean }
	previous_pair_pos?: number
	previous_token?: Token		// Previous non-comment token
	__ref?: boolean				// &x.y
	semantic?: SemanticToken
	skip_pos?: number
	symbol?: AhkSymbol
	topofline: number
	type: TokenType
}

export enum USAGE { Read, Write }

export interface Context {
	usage?: USAGE
	kind: SymbolKind
	linetext: string
	range: Range
	symbol?: AhkSymbol
	text: string
	token: Token
	word: string
};

export interface FormatOptions {
	array_style?: number
	brace_style?: number
	break_chained_methods?: boolean
	ignore_comment?: boolean
	indent_string?: string
	indent_between_hotif_directive?: boolean
	keyword_start_with_uppercase?: boolean
	max_preserve_newlines?: number
	object_style?: number
	preserve_newlines?: boolean
	space_before_conditional?: boolean
	space_after_double_colon?: boolean
	space_in_empty_paren?: boolean
	space_in_other?: boolean
	space_in_paren?: boolean
	switch_case_alignment?: boolean
	symbol_with_same_case?: boolean
	white_space_before_inline_comment?: string
	wrap_line_length?: number
}

interface ParamList extends Array<Variable> {
	format?: (params: Variable[]) => void
	hasref?: boolean
	offset?: number[]
	full?: string
	variadic?: boolean
}

namespace FuncNode {
	export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range, params: ParamList, children?: AhkSymbol[], isstatic?: boolean | null): FuncNode {
		let full = '', hasref = false, variadic = false;
		const param_offsets = [];
		params.format?.(params);
		for (const param of params) {
			param_offsets.push(full.length);
			full += `, ${param.pass_by_ref ? (hasref = true, ++param_offsets[param_offsets.length - 1], '&') : ''}${param.name}${param.defaultVal ?
				` := ${param.defaultVal}` : param.defaultVal === null ? '?' : param.arr ? (variadic = true, '*') : ''}`;
		}
		return {
			assume: FuncScope.DEFAULT, static: isstatic, variadic, children,
			hasref, name, kind, range, selectionRange, params, param_offsets,
			param_def_len: full.length || 2,
			full: `${isstatic ? 'static ' : ''}${name}(${full.substring(2)})`,
			declaration: {}, global: {}, local: {}, labels: {}
		};
	}
}

namespace Variable {
	export function create(name: string, kind: SymbolKind, range: Range): Variable {
		return { name, kind, range: { ...range }, selectionRange: range };
	}
}

export const allIdentifierChar = new RegExp('^[^\x00-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7f]+$');
export function isIdentifierChar(code: number) {
	if (code < 48) return false;
	if (code < 58) return true;
	if (code < 65) return false;
	if (code < 91) return true;
	if (code < 97) return code === 95;
	if (code < 123) return true;
	return code > 127;
}

String.prototype.trim = function () {
	return this.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
};

String.prototype.trimStart = function () {
	return this.replace(/^[ \t\r\n]+/, '');
};

String.prototype.trimEnd = function () {
	return this.replace(/[ \t\r\n]+$/, '');
};

const COLOR_RE = new RegExp(/['" \t](c|background|#)?((0x)?[\da-f]{6}([\da-f]{2})?|(black|silver|gray|white|maroon|red|purple|fuchsia|green|lime|olive|yellow|navy|blue|teal|aqua))\b/i);
const COLOR_VALS = JSON.parse('{"black":"000000","silver":"c0c0c0","gray":"808080","white":"ffffff","maroon":"800000","red":"ff0000","purple":"800080","fuchsia":"ff00ff","green":"008000","lime":"00ff00","olive":"808000","yellow":"ffff00","navy":"000080","blue":"0000ff","teal":"008080","aqua":"00ffff"}');
const EMPTY_TOKEN: Token = { type: TokenType.EOF, content: '', offset: 0, length: 0, topofline: 0, next_token_offset: -1 };
const KEYS_RE = /^(alttab|alttabandmenu|alttabmenu|alttabmenudismiss|shiftalttab|shift|lshift|rshift|alt|lalt|ralt|control|lcontrol|rcontrol|ctrl|lctrl|rctrl|lwin|rwin|appskey|lbutton|rbutton|mbutton|wheeldown|wheelup|wheelleft|wheelright|xbutton1|xbutton2|(0*[2-9]|0*1[0-6]?)?joy0*([1-9]|[12]\d|3[012])|space|tab|enter|escape|esc|backspace|bs|delete|del|insert|ins|pgdn|pgup|home|end|up|down|left|right|printscreen|ctrlbreak|pause|help|sleep|scrolllock|capslock|numlock|numpad0|numpad1|numpad2|numpad3|numpad4|numpad5|numpad6|numpad7|numpad8|numpad9|numpadmult|numpadadd|numpadsub|numpaddiv|numpaddot|numpaddel|numpadins|numpadclear|numpadleft|numpadright|numpaddown|numpadup|numpadhome|numpadend|numpadpgdn|numpadpgup|numpadenter|f1|f2|f3|f4|f5|f6|f7|f8|f9|f10|f11|f12|f13|f14|f15|f16|f17|f18|f19|f20|f21|f22|f23|f24|browser_back|browser_forward|browser_refresh|browser_stop|browser_search|browser_favorites|browser_home|volume_mute|volume_down|volume_up|media_next|media_prev|media_stop|media_play_pause|launch_mail|launch_media|launch_app1|launch_app2|vk[a-f\d]{1,2}(sc[a-f\d]+)?|sc[a-f\d]+|`[;{]|[\x21-\x7E])$/i;
const LINE_STARTERS = 'export break case continue for global goto if local loop return static switch throw try while'.split(' ');
const META_FUNCNAME = '__NEW __INIT __ITEM __ENUM __GET __CALL __SET __DELETE'.split(' ');
const OBJECT_STYLE = { collapse: 2, expand: 1, none: 0 }, PROP_NEXT_TOKEN = ['[', '{', '=>'];
const PUNCT = '% : + ++ - -- * ** / // & && | || ^ < << <= = == => > >> >>> >= ? ?? ! != !== ~ ~= := += -= *= /= //= &= |= ^= ??= <<= >>= >>>='.split(' ');
const RESERVED_OP = 'isset throw super false true'.split(' '), ASSIGN_INDEX = PUNCT.indexOf(':=');
const RESERVED_WORDS = LINE_STARTERS.concat('as catch else false finally isset super true until and contains in is not or'.split(' '));
const WHITESPACE = " \t\r\n", OP_INDEX = RESERVED_WORDS.indexOf('and');
export const ASSIGN_TYPE = [':=', '??='], ZERO_RANGE = Range.create(0, 0, 0, 0);
export const ANY = createPrototype('Any');
const ARRAY = createPrototype('Array', SymbolKind.Class, 'Array');
const FLOAT = createPrototype('Float', SymbolKind.Number);
const INTEGER = createPrototype('Integer', SymbolKind.Number);
const NUMBER = createPrototype('Number', SymbolKind.Number);
const OBJECT = createPrototype('Object', SymbolKind.Class);
export const STRING = createPrototype('String', SymbolKind.String);
export const UNSET = createPrototype('unset', SymbolKind.Null);
export const VARREF = createPrototype('VarRef', SymbolKind.Class, 'Any');
export const $DIRPATH = { ...STRING }, $DLLFUNC = { ...STRING }, $FILEPATH = { ...STRING };
export const THIS: Variable = {
	assigned: true,
	decl: true,
	def: true,
	is_param: true,
	kind: SymbolKind.Variable,
	name: 'this',
	range: ZERO_RANGE,
	selectionRange: ZERO_RANGE,
};
export const SUPER: Variable = { ...THIS, name: 'super' };
export const HIDDEN_PARAMS = {
	this: THIS, super: SUPER,
	thishotkey: { ...THIS, name: 'ThisHotkey' } as Variable,
	value: { ...THIS, name: 'Value' } as Variable,
};

const S2O: Record<string, AhkSymbol> = {
	$DIRPATH,
	$DLLFUNC,
	$FILEPATH,
	ANY,
	ARRAY,
	FLOAT,
	INTEGER,
	NUMBER,
	OBJECT,
	STRING,
	UNSET,
	VARREF,
};

class ParseStopError {
	public message: string;
	public token: Token;
	constructor(message: string, token: Token) {
		this.message = message;
		this.token = token;
	}
}

export type ActionType = 'Continue' | 'Warn' | 'SkipLine' | 'SwitchToV1' | 'Stop';

export class Lexer {
	public actionwhenv1?: ActionType = 'Continue';
	public actived = false;
	public beautify: (options: FormatOptions, range?: Range) => string;
	public checkmember: boolean | undefined;
	public children: AhkSymbol[] = [];
	public d = 0;
	public d_uri = '';
	public declaration: Record<string, AhkSymbol> = {};
	public diagnostics: Diagnostic[] = [];
	public diag_pending?: boolean;
	public diag_timer?: unknown;
	public last_diags = 0;
	public dlldir = new Map<number, string>();
	public dllpaths: string[] = [];
	public document: TextDocument;
	public findToken: (offset: number, ignore?: boolean) => Token;
	public folding_ranges: FoldingRange[] = [];
	public fsPath = '';
	public getToken: (offset?: number, ignorecomment?: boolean) => Token;
	public need_scriptdir = false;
	public include: Record<string, string> = {};
	public includedir = new Map<number, string>();
	public isparsed = false;
	public is_virtual = false;		// uris like `vscode-local-history:`
	public labels: Record<string, AhkSymbol[]> = {};
	public libdirs: string[] = [];
	public line_ranges: [number, number][] = [];
	public maybev1?: number;
	public object: { method: Record<string, FuncNode[]>, property: Record<string, Variable[]> } = { method: {}, property: {} };
	public parseScript: () => void;
	public scriptdir = '';
	public scriptpath = '';
	public STB = new SemanticTokensBuilder;
	public symbolInformation: SymbolInformation[] | undefined;
	public texts: Record<string, string> = {};
	public typedef: Record<string, AhkSymbol> = {};
	public token_ranges: { start: number, end: number, type: number, previous?: number }[] = [];
	public tokens: Record<number, Token> = {};
	public uri = '';
	public workspaceFolder = '';
	private hotstringExecuteAction = false;
	constructor(document: TextDocument, scriptdir?: string, d = 0) {
		let begin_line: boolean, callWithoutParentheses: boolean | 1, comments: Record<number, Token>;
		let continuation_sections_mode: boolean | null, currsymbol: AhkSymbol | undefined;
		let customblocks: { region: number[], bracket: number[] }, maybev1: number | undefined;
		let dlldir: string, includedir: string, includetable: Record<string, string>;
		let input: string, input_length: number, input_wanted_newline: boolean;
		let last_comment_fr: FoldingRange | undefined, last_LF: number, lst: Token;
		let n_newlines: number, parser_pos: number, sharp_offsets: number[];
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const _this = this, uri = URI.parse(document.uri);
		let allow_$ = true, block_mode = true, format_mode = false, h = isahk2_h;
		let in_loop = false, string_mode = false;

		interface Flag {
			array_style?: number,
			case_body: boolean | null,
			catch_block: boolean,
			declaration_statement: boolean,
			else_block: boolean,
			finally_block: boolean,
			had_comment: number,
			hotif_block?: boolean,
			if_block: boolean,
			in_case_statement: boolean,
			in_case: boolean,
			in_expression: boolean,
			in_fat_arrow?: boolean,
			indentation_level: number,
			indent_after?: boolean,
			last_text: string,
			last_word: string,
			loop_block: number,
			mode: Mode,
			object_style?: number,
			parent: Flag,
			start_line_index: number,
			ternary_depth?: number,
			try_block: boolean
		};
		let output_lines: { text: string[], indent: number }[], flags: Flag, previous_flags: Flag, flag_store: Flag[];
		let opt: FormatOptions, preindent_string: string, indent_string: string, space_in_other: boolean, ck: Token;
		let token_text: string, token_text_low: string, token_type: TokenType, last_type: TokenType, last_text: string;
		let output_space_before_token: boolean | undefined, is_conditional: boolean;
		const handlers: Record<number, () => void> = {
			[TokenType.BracketStart]: handle_start_expr,
			[TokenType.BracketEnd]: handle_end_expr,
			[TokenType.BlockStart]: handle_start_block,
			[TokenType.BlockEnd]: handle_end_block,
			[TokenType.Identifier]: handle_word,
			[TokenType.Reserved]: handle_word,
			[TokenType.String]: handle_string,
			[TokenType.Assign]: handle_equals,
			[TokenType.Operator]: handle_operator,
			[TokenType.Comma]: handle_comma,
			[TokenType.BlockComment]: handle_block_comment,
			[TokenType.InlineComment]: handle_inline_comment,
			[TokenType.Comment]: handle_comment,
			[TokenType.Dot]: handle_dot,
			[TokenType.Hotkey]: handle_sharp,
			[TokenType.Directive]: handle_sharp,
			[TokenType.Number]: handle_number,
			[TokenType.Label]: handle_label,
			[TokenType.HotkeyLine]: handle_sharp,
			[TokenType.Unknown]: handle_unknown,
		};

		this.document = document;
		if (document.uri) {
			allow_$ = false;
			this.uri = document.uri.toLowerCase();
			this.setWorkspaceFolder();
			this.scriptpath = (this.fsPath = uri.fsPath).replace(/[\\/][^\\/]+$/, '');
			this.initLibDirs(scriptdir);
			if (!/^(ahkres|file)$/.test(uri.scheme) && uri.fsPath.substring(1, 3) === ':\\')
				this.is_virtual = true;
		}

		this.getToken = function (offset?: number, ignore = false): Token {
			let p: number, t: Token, b: Token;
			if (offset !== undefined)
				p = parser_pos, b = lst, parser_pos = offset;
			for (; ((t = get_next_token()).type & TokenType.Comment) && ignore;);
			if (offset !== undefined)
				parser_pos = p!, lst = b!;
			return t;
		}

		this.findToken = function (offset: number, ignore = false) {
			let tk = find_token(offset);
			if (ignore)
				while (tk.type & TokenType.Comment)
					tk = find_token(tk.offset + tk.length);
			return tk;
		};
		function find_token(offset: number): Token {
			let i = offset, c = input[offset], tk: Token | undefined;
			const tks = _this.tokens;
			const eof = { ...(tks[-1] ?? EMPTY_TOKEN) };
			if (!c)
				return eof;
			if (WHITESPACE.includes(c)) {
				while (WHITESPACE.includes(c = input[++i]))
					continue;
				if (!c) {
					const t = _this.token_ranges.at(-1)!;
					if (t?.start <= offset && offset < t.end)
						tk = tks[t.start];
					return tk ?? eof;
				}
				if ((tk = tks[i]))
					return tk;
			} else {
				if (isIdentifierChar(c.charCodeAt(0))) {
					while (isIdentifierChar(input.charCodeAt(--i)))
						continue;
					if ((tk = tks[i + 1] ?? tks[i]))
						return tk;
					c = input.charAt(i);
				} else if ((tk = tks[i]))
					return tk;
				else if (PUNCT.includes(c)) {
					for (let j = 0; j < 3 && !WHITESPACE.includes(c = input.charAt(--i)) && PUNCT.includes(c); j++)
						if ((tk = tks[i]))
							return tk;
				}
				if (!WHITESPACE.includes(c)) {
					tk = find_token(input.indexOf('\n', offset) + 1 || input_length);
					do {
						if (tk.offset + tk.length <= offset)
							break;
						if (tk.offset <= offset)
							return tk;
					} while ((tk = tk.previous_token));
				}
			}
			return _this.findStrOrComment(offset) ?? eof;
		}

		this.beautify = function (options: FormatOptions, range?: Range) {
			let end_pos: number;
			!_this.isparsed && _this.parseScript();

			opt = {
				break_chained_methods: false,
				ignore_comment: false,
				indent_string: '\t',
				max_preserve_newlines: 3,
				preserve_newlines: true,
				space_before_conditional: true,
				space_after_double_colon: true,
				space_in_empty_paren: false,
				space_in_other: true,
				space_in_paren: false,
				wrap_line_length: 0,
				...options
			};

			last_type = TokenType.EOF, last_text = '', begin_line = true, lst = { ...EMPTY_TOKEN };
			last_LF = -1, end_pos = input_length, ck = _this.getToken(0);
			preindent_string = input.substring(input.lastIndexOf('\n', parser_pos = ck.offset) + 1, parser_pos);
			is_conditional = output_space_before_token = false, format_mode = true;
			indent_string = opt.indent_string ?? '\t', space_in_other = opt.space_in_other ?? true;
			output_lines = [create_output_line()];
			flag_store = [], flags = undefined as unknown as Flag;
			set_mode(Mode.BlockStatement);

			if (opt.symbol_with_same_case)
				symbolProvider({ textDocument: _this.document });

			if (range) {
				end_pos = _this.document.offsetAt(range.end);
				ck = _this.findToken(_this.document.offsetAt(range.start));
				range.start = _this.document.positionAt(parser_pos = ck.offset);
				preindent_string = input.substring(input.lastIndexOf('\n', parser_pos) + 1, parser_pos).match(/^[ \t]*/)![0];
			}

			while (true) {
				token_type = (ck = get_next_token()).type;
				token_text_low = (token_text = ck.content).toLowerCase();
				if (ck.fat_arrow_end) {
					while (flags.in_fat_arrow)
						restore_mode();
				}

				if (ck.offset >= end_pos) {
					if (range) {
						let pt = ck.previous_token, end = parser_pos;
						if (last_type === TokenType.Reserved && ['try', 'else', 'finally'].includes(last_text))
							indent();
						if (!flags.declaration_statement || !just_added_newline())
							print_newline();
						if (pt?.type) {
							while ((ck = _this.findToken(pt.skip_pos ?? pt.offset + pt.length)).offset < end_pos)
								pt = ck;
							for (end = pt.offset + pt.length; ' \t'.includes(input[end]); end++);
							if (!WHITESPACE.includes(input.charAt(end)))
								end = pt.offset + pt.length;
							while (just_added_newline())
								output_lines.pop();
						}
						range.end = _this.document.positionAt(end);
						options.indent_string = preindent_string + indent_string.repeat(flags.indentation_level);
					}
					while (flags.mode === Mode.Statement)
						restore_mode();
					break;
				} else if (is_conditional &&
					!(is_conditional = n_newlines ? !conditional_is_end(ck) :
						token_type !== TokenType.BlockStart || ck.data as boolean)) {
					restore_mode();
					last_type = TokenType.BracketEnd;
					flags.last_text = ')';
					input_wanted_newline = n_newlines > 0;
				} else if ((input_wanted_newline = n_newlines > 0)) {
					if (continuation_sections_mode !== false) {
						print_newline();
						for (let i = 1; i < n_newlines; i++)
							output_lines.push(create_output_line());
					} else if (!is_conditional && !flags.in_expression) {
						if (((ck.type & TokenType.Comment) || !isContinuousLine(flags.mode === Mode.Statement ? ck.previous_token ?? EMPTY_TOKEN : {} as Token, ck)) &&
							!(last_type === TokenType.Reserved && ['catch', 'else', 'finally', 'until'].includes(last_text))) {
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

				if (!(token_type & TokenType.Comment)) {
					if (!is_conditional && token_type === TokenType.Reserved && ['if', 'for', 'while', 'loop', 'catch', 'switch'].includes(token_text_low)) {
						is_conditional = true;
						set_mode(Mode.Conditional);
						if (token_text_low !== 'switch')
							indent();
					}
					flags.last_text = token_text_low;
					flags.had_comment = 0;
					last_type = token_type;
					last_text = token_text_low;
				}
			}

			const sweet_code = output_lines.map(line => line.text.join('')).join('\n');
			output_lines = [], format_mode = false;
			return sweet_code;

			function conditional_is_end(tk: Token) {
				if (![Mode.Conditional, Mode.Statement].includes(flags.mode) || flags.parent.mode === Mode.ObjectLiteral)
					return false;
				switch (tk.type) {
					case TokenType.Dot:
					case TokenType.Comma:
					case TokenType.Assign:
					case TokenType.Comment:
					case TokenType.InlineComment:
					case TokenType.BlockComment:
						return false;
					case TokenType.Operator:
						return /^(!|~|not|%|\+\+|--)$/i.test(tk.content) &&
							!isContinuousLine(tk.previous_token ?? EMPTY_TOKEN, tk);
					case TokenType.String:
						return !tk.ignore &&
							!isContinuousLine(tk.previous_token ?? EMPTY_TOKEN, tk);
					default: {
						const lk = tk.previous_token ?? EMPTY_TOKEN;
						switch (lk.type) {
							case TokenType.Comma:
							case TokenType.Assign:
								return false;
							case TokenType.Operator:
								return /^(\+\+|--|%)$/.test(lk.content);
						}
					}
				}
				return true;
			}
		};

		function format_params_default_val(tokens: Record<number, Token>, params: ParamList) {
			opt = { max_preserve_newlines: 1 };
			space_in_other = true, indent_string = '\t';
			format_mode = true, preindent_string = '';
			delete params.format;
			for (const param of params) {
				if (!param.range_offset)
					continue;
				const [start, end] = param.range_offset;
				last_type = TokenType.EOF, last_text = '', output_lines = [create_output_line()];
				output_space_before_token = false, flag_store = [], flags = undefined as unknown as Flag, set_mode(Mode.Expression);
				for (ck = tokens[tokens[start].next_token_offset]; ck && ck.offset < end; ck = tokens[ck.next_token_offset]) {
					token_type = ck.type, token_text = ck.content, token_text_low = token_text.toLowerCase();
					handlers[token_type]();
					last_type = token_type;
					flags.last_text = last_text = token_text_low;
				}
				param.defaultVal = output_lines.map(line => line.text.join('')).join('\n').trim();
			}
			format_mode = false, output_lines = [];
		}

		if (d || /\.d\.(ahk2?|ah2)$/i.test(this.fsPath)) {
			this.d = d || 1, allow_$ ||= true;
			this.parseScript = function (): void {
				const p: ClassNode[] = [], cls: string[] = [], uri = this.uri
				let _low = '', i = 0, j = 0, blocks = 0, isstatic = false, rg = ZERO_RANGE;
				let _parent = DocumentSymbol.create('', undefined, SymbolKind.Namespace, rg, rg, this.children) as ClassNode;
				let tk: Token, lk: Token, _cm: Token | undefined;

				this.clear(), customblocks = { region: [], bracket: [] }, comments = {}, sharp_offsets = [];
				input = this.document.getText(), input_length = input.length, includedir = this.scriptpath;
				lst = { ...EMPTY_TOKEN }, begin_line = true, parser_pos = 0, last_LF = -1, currsymbol = last_comment_fr = undefined;
				includetable = this.include, _parent.property = _parent.$property = this.declaration;

				for (; get_next_token().length;);
				const tokens = Object.values(this.tokens), l = tokens.length;

				while (i < l) {
					switch ((tk = tokens[i]).type) {
						case TokenType.Identifier:
							if (tk.topofline > 0) {
								if (i < l - 4 && tk.content === 'class' && (lk = tokens[i + 1]).topofline === 0 &&
									(lk.type === TokenType.Identifier || allIdentifierChar.test(lk.content))) {
									tk.type = TokenType.Reserved;
									break;
								}
							} else if (!isstatic) {
								i++;
								break;
							}
							j = i + 1;
							if (j < l) {
								if (blocks && ((lk = tokens[j]).topofline || ['=>', '?', ':', '[', '{'].includes(lk.content))) {
									const tn = Variable.create(tk.content, SymbolKind.Property, rg = make_range(tk.offset, tk.length));
									const fn = tn as FuncNode, sem = {
										type: SemanticTokenTypes.property,
										modifier: SemanticTokenModifiers.definition | (isstatic as unknown as number)
									};
									let readonly = lk.content === '=>';
									tk.symbol = tk.definition = tn, fn.parent = _parent, fn.has_this_param = true;
									let params: ParamList = [];
									if (!META_FUNCNAME.includes(_low = tn.name.toUpperCase()))
										tk.semantic = sem;
									tn.static = isstatic, tn.full = `(${cls.join('.')}) ${isstatic ? 'static ' : ''}` + tn.name;
									if ((_cm = comments[tn.selectionRange.start.line]))
										set_detail(_cm.symbol = tn, _cm);
									_parent.children?.push(tn);
									if (!_parent.since) {
										(isstatic ? _parent.property : _parent.$property!)[_low] ??= tn;
										(this.object.property[_low] ??= []).push(tn);
									}
									if (lk.content === '[') {
										params = parse_params(']');
										if (params.length) {
											fn.children = fn.params = params;
											fn.full += `[${params.full}]`;
											fn.param_offsets = params.offset!;
											fn.param_def_len = params.full!.length + 2;
											fn.declaration = fn.local = {};
											for (const v of params)
												fn.local[_low = v.name.toUpperCase()] ??= v;
										}
										if (!(lk = tokens[++j]))
											break;
									}
									if (lk.content === '{') {
										const t = tn as Property;
										while ((tk = tokens[++j]).content !== '}') {
											if (tk.content === '=>') {
												const tt = FuncNode.create(lk.content, SymbolKind.Function, rg = make_range(lk.offset, lk.length), { ...rg }, params);
												_low = lk.content.toLowerCase(), tt.parent = tn;
												lk.symbol = lk.definition = tt, parse_types(tt);
												if (_low === 'get' || _low === 'set')
													tt.has_this_param = true, t[_low] = tt;
											} else lk = tk;
										}
										tn.type_annotations = t.get?.type_annotations, readonly = Boolean(t.get && !t.set);
										tn.range.end = this.document.positionAt(tk.offset + tk.length);
									} else if (lk.content === '=>') {
										const tt = FuncNode.create('get', SymbolKind.Function, rg = make_range(lk.offset, lk.length), { ...rg }, params);
										tt.parent = tn, (tn as Property).get = tt, readonly = true, tt.has_this_param = true;
										parse_types(tt), tn.type_annotations = tt.type_annotations, tn.range.end = tt.range.end;
									} else {
										delete fn.has_this_param;
										if (lk.content === '?')
											lk.ignore = true, lk = tokens[++j], tn.defaultVal = null;
										if (lk?.content === ':')
											parse_types(tn);
										else lk = tokens[--j], tn.range.end = this.document.positionAt(lk.offset + lk.length);
									}
									if (readonly)
										sem.modifier! |= SemanticTokenModifiers.readonly;
								} else if ((lk = tokens[j]).content === '(') {
									const params = parse_params();
									const fn = create_fn(tk.content, params, make_range(tk.offset, tk.length), isstatic);
									if (tokens[j + 1]?.content === '=>')
										++j, parse_types(fn);
									else fn.range.end = this.document.positionAt(lk.offset + lk.length);
									fn.full += ` => ${joinTypes(fn.type_annotations) || 'void'}`;
									tk.symbol = tk.definition = fn;
									if (!META_FUNCNAME.includes(_low = fn.name.toUpperCase()))
										tk.semantic = {
											type: blocks ? SemanticTokenTypes.method : SemanticTokenTypes.function,
											modifier: SemanticTokenModifiers.definition | SemanticTokenModifiers.readonly
												| (isstatic as unknown as number)
										};
									if ((_cm = comments[fn.selectionRange.start.line]))
										set_detail(_cm.symbol = fn, _cm);
									_parent.children?.push(fn);
									if (!(_parent.since ?? fn.since)) {
										if (blocks) {
											fn.has_this_param = true, fn.kind = SymbolKind.Method;
											fn.full = `(${cls.join('.')}) ${fn.full}`, fn.parent = _parent;
											(this.object.method[_low] ??= []).push(fn);
										}
										const decl = isstatic ? _parent.property : _parent.$property!;
										if (decl[_low])
											(decl[_low] as Property).call = fn;
										else decl[_low] = fn;
									} else if (!blocks)
										inactiveVars[_low] = fn.since!;
								} else if (!blocks && (['=>', ':', ','].includes(lk.content) || lk.topofline)) {
									const tn = Variable.create(tk.content, SymbolKind.Variable, rg = make_range(tk.offset, tk.length));
									tk.symbol = tk.definition = tn, tn.assigned = tn.def = true;
									if ((_cm = comments[tn.selectionRange.start.line]))
										set_detail(_cm.symbol = tn, _cm);
									if (['=>', ':'].includes(lk.content))
										parse_types(tn);
									else if (lk.content !== ',')
										--j;
									_low = tn.name.toUpperCase();
									_parent.children!.push(tn);
									if (!tn.since) {
										_parent.property[_low] ??= tn;
									} else inactiveVars[_low] = tn.since;
								}
							}
							i = j + 1, isstatic = false;
							break;
						case TokenType.Operator:
							if (!allIdentifierChar.test(tk.content)) {
								i++, isstatic = false;
								break;
							}
						// fall through
						case TokenType.Reserved:
							if ((_low = tk.content.toLowerCase()) === 'class') {
								let extends_ = '';
								const cl = DocumentSymbol.create((tk = tokens[++i]).content, undefined, SymbolKind.Class,
									make_range(tokens[i - 1].offset, 0), make_range(tk.offset, tk.length), []) as ClassNode;
								j = i + 1, cls.push(cl.name);
								tk.semantic = { type: SemanticTokenTypes.class, modifier: SemanticTokenModifiers.definition | SemanticTokenModifiers.readonly };
								tk.symbol = tk.definition = cl, cl.extends = '', cl.uri ??= this.uri;
								if ((lk = tokens[j])?.content === '<' && !lk.topofline) {
									const type_params: typeof cl.type_params = {};
									let data = 0;
									while ((lk = tokens[++j])?.type === TokenType.Identifier) {
										const range = make_range(lk.offset, lk.length);
										const tp = {
											name: lk.content, data,
											kind: SymbolKind.TypeParameter,
											range, selectionRange: range
										};
										data++, type_params[lk.content.toUpperCase()] ??= tp;
										if ((lk = tokens[++j])?.content === '=')
											parse_types(tp), lk = tokens[++j];
										if (lk?.content === ',')
											continue;
										break;
									}
									if (lk?.content === '>') {
										cl.type_params = type_params;
										lk = tokens[++j];
									} else skip('>');
								}
								if (lk?.content.toLowerCase() === 'extends') {
									if ((lk = tokens[j + 1])?.type === TokenType.Identifier)
										this.children.push(Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length)));
									while ((++j) < l && (lk = tokens[j]).content !== '{')
										extends_ += lk.content;
									cl.extends = extends_;
								}
								if ((_cm = comments[cl.selectionRange.start.line]))
									set_detail(_cm.symbol = cl, _cm);
								cl.full = cls.join('.'), cl.property = {}, cl.prototype =
									{ ...cl, detail: undefined, property: cl.$property = {} };
								_low = cl.name.toUpperCase();
								_parent.children!.push(cl);
								if (!cl.since) {
									(!blocks && cl.name.startsWith('$') ? _this.typedef : _parent.property)[_low] ??= cl;
								} else if (!blocks)
									inactiveVars[_low] = cl.since;
								blocks++, p.push(_parent), _parent = cl, cl.type_annotations = [cl.full];
								i = j + 1;
							} else if (tk.topofline && 'global,static'.includes(_low = tk.content.toLowerCase()) &&
								(!blocks || _low !== 'global') && (lk = tokens[i + 1])?.topofline === 0 &&
								(lk.type === TokenType.Identifier || allIdentifierChar.test(lk.content)))
								i++, isstatic = _low === 'static';
							else tk.type = TokenType.Identifier, tk.topofline && (isstatic = false);
							break;
						case TokenType.BlockEnd:
							if (blocks) {
								_parent.range.end = _parent.prototype!.range.end =
									this.document.positionAt(tk.offset + tk.length);
								_parent.property.PROTOTYPE = {
									..._parent.prototype!, children: undefined,
									name: 'Prototype', kind: SymbolKind.Property,
									full: `(${_parent.full}) Prototype`,
									selectionRange: ZERO_RANGE,
									type_annotations: [_parent.full]
								};
								_parent.uri = uri, (_parent = _parent.prototype!).uri = uri;
								this.addFoldingRangePos(_parent.range.start, _parent.range.end);
								Object.values(_parent.property).forEach(it => it.parent = _parent);
								blocks--, cls.pop(), _parent = p.pop()!;
							}
						// fall through
						default:
							i++, isstatic = false;
							break;
					}
				}

				if (this.d < 0)
					return;
				if (this.d & 2) {
					const overwrite = uri.endsWith('/ahk2_h.d.ahk') ? 1 : 0;
					let t;
					for (const [k, it] of Object.entries(this.declaration)) {
						switch (it.kind) {
							case SymbolKind.Function:
								it.def = false, it.uri = uri;
							// fall through
							case SymbolKind.Class:
								it.overwrite ??= overwrite, it.def ??= true;
								if (!(t = ahkVars[k]) || overwrite >= (t.overwrite ?? 0))
									ahkVars[k] = it;
								break;
							case SymbolKind.Variable:
								if (it.def)
									ahkVars[k] = it, it.uri = uri;
								break;
						}
					}
				}
				parse_unresolved_typedef();
				checkDupError({}, this.children, this);
				this.isparsed = true;
				customblocks.region.forEach(o => this.addFoldingRange(o, parser_pos - 1, 'region'));

				function parse_types(sym: AhkSymbol) {
					const types = parse();
					if (!(lk = tokens[--j]))
						lk = tokens[j = tokens.length - 1];
					if (types.length) {
						const t = new Set(types);
						t.delete('void');
						sym.type_annotations = Array.from(t);
					}
					sym.range.end = _this.document.positionAt(lk.offset + lk.length);
					return j;
					function parse(): Array<string | AhkSymbol> {
						let t: Token, has_typeof: boolean, r: string, tp;
						const tps: (string | AhkSymbol)[] = [];
						loop: while ((lk = tokens[++j])) {
							switch (lk.type) {
								case TokenType.Identifier:
									r = lk.content, tp = TokenType.Identifier;
									if ((has_typeof = r === 'typeof') && tokens[j + 1]?.type === tp && !tokens[j + 1].topofline)
										lk.semantic = SE_OPERATOR, lk = tokens[++j], r = lk.content;
									if (r.toLowerCase() !== 'this' || sym.kind === SymbolKind.Function && (sym as FuncNode).parent?.kind !== SymbolKind.Property)
										lk.semantic = SE_CLASS;
									while ((lk = tokens[++j]) && !lk.topofline && lk.type !== tp &&
										(/^[.#~]$/.test(lk.content) || lk.type === TokenType.Identifier && (lk.semantic = SE_CLASS)))
										r += lk.content, tp = lk.type;
									if (lk?.content === '<' && !lk.topofline) {
										const generic_types: (string | AhkSymbol)[][] = [];
										while (true) {
											generic_types.push(parse());
											if (!lk || lk.content as string === '>') {
												const tp = {
													name: r, kind: r.toLowerCase() === 'comobject' ? SymbolKind.Interface : SymbolKind.Class,
													extends: r, full: `${r}<${generic_types.map(t => joinTypes(t)).join(', ')}>`,
													range: ZERO_RANGE, selectionRange: ZERO_RANGE
												} as ClassNode;
												tp.generic_types = generic_types;
												if (has_typeof)
													tp.prototype = { ...tp };
												else tp.data = S2O[r.toUpperCase()];
												tps.push(tp), lk = tokens[++j];
												break;
											}
											if (lk.content as string === ',')
												continue;
											skip('>'), lk = tokens[++j];
											break;
										}
									} else if (r)
										tps.push(has_typeof ? `typeof ${r}` : S2O[r.toUpperCase()] ?? r);
									break;
								case TokenType.Number:
								case TokenType.String:
									tps.push(lk.content), lk = tokens[++j];
									break;
								case TokenType.BlockStart: {
									let full = '';
									const props: Record<string, AhkSymbol> = {}, b = lk;
									while ((lk = skip_comment()) && (lk.type === TokenType.Identifier || allIdentifierChar.test(lk.content))) {
										const p = Variable.create(lk.content, SymbolKind.Property, make_range(lk.offset, lk.length));
										props[lk.content.toUpperCase()] ??= p, lk.semantic = SE_PROPERTY;
										full += ', ' + lk.content;
										if (_cm && _cm === comments[p.selectionRange.start.line])
											set_detail(p, _cm);
										if ((lk = tokens[++j])?.content === '?')
											lk.ignore = true, lk = tokens[++j], p.defaultVal = null, full += '?';
										if (lk?.content === ':')
											parse_types(p), lk = tokens[++j], full += `: ${joinTypes(p.type_annotations) || 'unknown'}`;
										if (lk?.content !== ',')
											break;
										_cm = undefined;
									}
									if (lk?.content === '}') {
										const cls = DocumentSymbol.create('', undefined, SymbolKind.Class, ZERO_RANGE, ZERO_RANGE) as ClassNode;
										cls.property = props, cls.name = cls.extends = '', cls.uri = _this.uri;
										tps.push(b.data = lk.data = cls), cls.full = (full = full.substring(2)) && `{ ${full} }`;
									} else skip('}'), b.data = OBJECT, lk?.content === '}' && (lk.data = OBJECT);
									lk = tokens[++j];
									break;
								}
								case TokenType.Comment:
								case TokenType.BlockComment:
									_cm = lk;
								// fall through
								case TokenType.InlineComment:
									continue;
								default:
									if (lk.content === '(') {
										if (',:=?&*)['.includes((t = tokens[j + 2])?.content ?? '\0') || t?.content === '=>') {
											const b = lk.offset, params = parse_params();
											const fn = create_fn('', params, make_range(b, 0));
											if (j >= l) break loop;
											if (tokens[j + 1]?.content === '=>')
												++j, parse_types(fn), lk = tokens[++j];
											else fn.range.end = _this.document.positionAt(lk.offset + lk.length);
											fn.full += ` => ${joinTypes(fn.type_annotations) || 'void'}`;
											tps.push(fn), fn.uri = _this.uri;
											if (_cm && _cm === comments[fn.selectionRange.start.line])
												set_detail(_cm.symbol = fn, _cm);
										} else {
											tps.push(...parse());
											if (lk?.content as string === ')')
												lk = tokens[++j];
										}
									} else if (lk.content === '-' && (lk = tokens[++j])?.type === TokenType.Number)
										tps.push(`-${lk.content}`), lk = tokens[++j];
									else {
										if (lk.content.toLowerCase() === 'throw' && lk.previous_token?.content === '=>')
											lk = tokens[++j];
										break loop;
									}
									break;
							}
							if (lk?.content !== '|')
								break;
							_cm = undefined;
						}
						return tps;
					}
				}
				function parse_params(endc = ')') {
					const params: ParamList = [], offset = params.offset ??= [], star_offset = [];
					let vr: Variable, star: Variable | undefined, next_is_param: boolean | 1 = true;
					let defVal = 0, full = '';
					loop: while ((lk = tokens[++j]) && lk.content !== endc) {
						switch (lk.type) {
							case TokenType.String:
								if (next_is_param !== true) {
									skip(endc);
									break;
								}
								vr = Variable.create(lk.content, SymbolKind.String, make_range(lk.offset, lk.length));
								offset.push(full.length), full += lk.content;
								params.push(vr), next_is_param = false;
								if ((lk = tokens[++j])?.content === '[')
									defVal++, lk.ignore = true, full += ' [';
								else j--;
								break;
							case TokenType.Identifier:
								if (!next_is_param) {
									skip(endc);
									break loop;
								}
								vr = Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length));
								if (next_is_param === 1)
									params.hasref = vr.pass_by_ref = true, full += '&', next_is_param = true;
								vr.assigned = vr.def = vr.is_param = true, params.push(vr);
								lk.semantic = SE_PARAM;
								offset.push(full.length), full += lk.content, lk = tokens[++j];
								if (defVal && (vr.defaultVal = false), lk?.content === '*')
									params.variadic = vr.arr = true, lk = tokens[++j], full += '*';
								else if (lk?.content === '?')
									vr.defaultVal = null, lk.ignore = true, lk = tokens[++j], full += '?';
								if (lk?.content === ':')
									lk = tokens[j = parse_types(vr) + 1], full += `: ${joinTypes(vr.type_annotations) || 'unknown'}`;
								if (!lk)
									break loop;
								if (lk.content === ':=') {
									if (!(lk = tokens[++j]) || lk.content === endc)
										break loop;
									vr.defaultVal = lk.content;
									if ('-+'.includes(lk.content) && tokens[j + 1]?.type === TokenType.Number)
										vr.defaultVal += tokens[++j].content;
									full += ` := ${vr.defaultVal}`;
									if (!(lk = tokens[++j]))
										break loop;
								}
								if (lk.content === '[')
									defVal++, lk.ignore = true, lk = tokens[++j], full += ' [';
								else if (defVal && lk.content === ']')
									defVal--, lk.ignore = true, lk = tokens[++j], full += ']';
								if (lk?.content === ',')
									full += ', ';
								else j--, next_is_param = false;
								break;
							default:
								if (lk.content === ',') {
									if (next_is_param) {
										skip(endc);
										break loop;
									}
									full += ', ', next_is_param = true;
								} else if (lk.content === '*') {
									if (!next_is_param) {
										skip(endc);
										break loop;
									}
									vr = Variable.create('', SymbolKind.Variable, make_range(lk.offset, 0));
									params.variadic = vr.arr = vr.assigned = vr.def = vr.is_param = true;
									defVal && (vr.defaultVal = false), next_is_param = false;
									star_offset.push(full.length), full += '*';
									if (star)
										star.data = params.length % (star.arr = 2);
									else star = vr;
								} else if (lk.content === '[')
									defVal++, lk.ignore = true, full += '[';
								else if (defVal && lk.content === ']')
									defVal--, lk.ignore = true, full = full.trimEnd() + '] ';
								else if (next_is_param === true && lk.content === '&')
									next_is_param = 1, lk.op_type = -1;
								else {
									skip(endc);
									break loop;
								}
								break;
						}
					}
					params.full = full, star && (params.push(star), offset.push(...star_offset));
					return params;
				}
				function create_fn(name: string, params: ParamList, range: Range, isstatic = false) {
					const fn = {
						assume: FuncScope.DEFAULT,
						children: [],
						declaration: {},
						full: `${isstatic ? 'static ' : ''}${name}(${params.full!})`,
						global: {},
						local: {},
						hasref: params.hasref!,
						kind: SymbolKind.Function,
						labels: {},
						name,
						param_def_len: params.full!.length + 2,
						param_offsets: params.offset!,
						params,
						range,
						selectionRange: { ...range },
						static: isstatic,
						variadic: params.variadic!,
					} as FuncNode;
					fn.local = fn.declaration;
					for (const p of params)
						fn.local[p.name.toUpperCase()] = p;
					delete fn.local[''];
					return fn;
				}
				function skip_comment() {
					for (; ((lk = tokens[++j])?.type & TokenType.Comment) && (_cm = lk););
					return lk;
				}
				function skip(endc: string) {
					let n = 1;
					const c = { '>': '<', ')': '(', ']': '[', '}': '{' }[endc];
					unexpected(lk ??= tokens.at(-1)!);
					while ((lk = tokens[++j]) && (lk.content !== endc || --n)) {
						if (lk.topofline > 0)
							return j--;
						lk.content === c && ++n;
					}
				}
			}
		} else {
			const d_path = this.fsPath.replace(/\.\w+$/, '.d.ahk');
			if (!this.fsPath.endsWith('2'))
				delete this.actionwhenv1;
			this.parseScript = function (): void {
				input = this.document.getText(), input_length = input.length, includedir = this.scriptpath, dlldir = '';
				begin_line = true, lst = { ...EMPTY_TOKEN }, currsymbol = last_comment_fr = maybev1 = undefined;
				parser_pos = 0, last_LF = -1, customblocks = { region: [], bracket: [] }, continuation_sections_mode = false, h = isahk2_h;
				this.clear(), includetable = this.include, comments = {}, sharp_offsets = [];
				callWithoutParentheses = configCache.Warn?.CallWithoutParentheses;
				try {
					const rs = utils.getRCData?.('#2');
					rs && (includetable[rs.uri] = rs.path);
					this.children.push(...parse_block());
				} catch (e) {
					in_loop = string_mode = false;
					if (e instanceof ParseStopError) {
						if (e.message)
							this.addDiagnostic(e.message, e.token.offset, e.token.length, { severity: DiagnosticSeverity.Warning });
					} else
						console.error(e);
				}
				if (!process.env.BROWSER) {
					const m = this.d_uri && find_d_ahk(resolve_scriptdir(this.d_uri)) || find_d_ahk(d_path);
					if (m)
						includetable[this.d_uri = m.uri] = m.path;
					else this.d_uri = '';
				}
				parse_unresolved_typedef();
				checkDupError(this.declaration, this.children, this);
				this.isparsed = true;
				customblocks.region.forEach(o => this.addFoldingRange(o, parser_pos - 1, 'region'));
				if (this.actived)
					this.actionwhenv1 ??= 'Continue';
				if (process.env.DEBUG) {
					let l = -1;
					for (const [line] of this.line_ranges)
						if (line <= l)
							throw new Error();
						else l = line;
					l = -1;
					for (const { start } of this.token_ranges)
						if (start <= l)
							throw new Error();
						else l = start;
				}
			}
		}

		function unexpected(tk: Token) {
			tk.has_warned ??= (_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length), true);
		}

		function unexpected_lf(tk: Token) {
			_this.addDiagnostic(diagnostic.unexpected('`n'), input.lastIndexOf('\n', tk.offset), 1);
		}

		function parse_unresolved_typedef() {
			for (const m of Object.values(comments)) {
				if (m.data !== null || !/^[ \t]*\*?[ \t]*@typedef\s/m.test(m.content))
					continue;
				parse_jsdoc_detail(_this, m.content, {} as AhkSymbol);
			}
		}

		function stop_parse(tk: Token, allow_skip = false, message = diagnostic.maybev1()) {
			if (maybev1 === 0)
				return false;
			maybev1 ??= _this.maybev1 = 1;
			switch (_this.actionwhenv1 ??= configCache.ActionWhenV1IsDetected) {
				case 'SkipLine': {
					if (!allow_skip)
						return true;
					_this.addDiagnostic(diagnostic.skipline(), tk.offset, tk.length, { severity: DiagnosticSeverity.Warning });
					let s: string, next_LF: number, tp = TokenType.Unknown;
					if (tk.type === TokenType.Identifier || tk.content === '=' && (tp = TokenType.String)) {
						lst = tk, parser_pos = tk.offset + tk.length;
						do {
							next_LF = input.indexOf('\n', parser_pos);
							if (next_LF < 0)
								next_LF = input_length;
							if ((s = input.substring(parser_pos, next_LF).trimStart())) {
								const offset = next_LF - s.length;
								lst = createToken(s = s.trimEnd(), tp, offset, s.length, 0);
							}
							if ((tk = _this.findToken(parser_pos = next_LF, true)).content === '(') {
								delete _this.tokens[tk.offset];
								lst = { ...EMPTY_TOKEN };
							}
							string_mode = true;
							tk = get_token_ignore_comment();
							while (tk.ignore && tk.type === TokenType.String) {
								next_LF = input.indexOf('\n', parser_pos);
								if (next_LF < 0)
									next_LF = input_length;
								if ((s = input.substring(parser_pos, next_LF).trimEnd()))
									tk.content += s, tk.length += s.length;
								parser_pos = next_LF;
								tk = get_token_ignore_comment();
							}
							string_mode = false;
						} while (isContinuousLine({} as Token, tk));
						parser_pos = tk.offset;
					}
					return true;
				}
				case 'SwitchToV1':
					if (!_this.actived)
						break;
					console.info([_this.document.uri, message, diagnostic.tryswitchtov1()].join(' '));
					message = '', switchToV1(_this.document.uri);
					break;
				case 'Continue':
					return false;
				case 'Warn': {
					if (!_this.actived)
						break;
					utils.showMessage(MessageType.Warning,
						`file: '${_this.fsPath}', ${message}`,
						{ title: action.switchtov1(), action: 'SwitchToV1' },
						{ title: action.skipline(), action: 'SkipLine' },
						{ title: action.stopparsing(), action: 'Stop' }
					)?.then(reason => {
						if ((_this.actionwhenv1 = (reason?.action ?? 'Continue') as ActionType) !== 'Stop')
							if (_this.actionwhenv1 === 'SwitchToV1')
								switchToV1(_this.document.uri);
							else _this.update();
					});
					break;
				}
			}
			_this.clear(), parser_pos = input_length;
			throw new ParseStopError(message, tk);
			function switchToV1(uri: string) {
				utils.sendNotification?.('switchToV1', uri);
			}
		}

		function parse_block(mode = BlockType.Script, _parent = _this as unknown as AhkSymbol, classfullname: string = ''): AhkSymbol[] {
			const result: AhkSymbol[] = [], { document, line_ranges, tokens } = _this;
			let tk = tokens[parser_pos - 1] ?? EMPTY_TOKEN, lk = tk.previous_token ?? EMPTY_TOKEN;
			let blocks = 0, next = true, _low = '';
			let _cm: Token | undefined, tn: AhkSymbol | undefined;
			let m: RegExpMatchArray | string | null, last_hotif: number | undefined;
			let line_begin_offset: number | undefined, line_end_token: Token | undefined;
			const baksym = currsymbol, oil = in_loop, blockpos: number[] = [], case_pos: number[] = [];
			if (block_mode = true, mode & BlockType.Mask)
				blockpos.push(parser_pos - 1), delete tk.data;
			currsymbol = _parent, in_loop = false;
			parse_brace();
			currsymbol = baksym, in_loop = oil;
			if (tk.type === TokenType.EOF)
				if (set_line_begin(), blocks > (!(mode & BlockType.Mask) ? 0 : -1))
					_this.addDiagnostic(diagnostic.missing('}'), blockpos[blocks - (!(mode & BlockType.Mask) ? 1 : 0)], 1);
			if (last_hotif !== undefined)
				_this.addFoldingRange(last_hotif, lk.offset, 'region');
			return result;

			function is_func_def() {
				if (input[tk.offset + tk.length] !== '(')
					return false;
				if (mode === BlockType.Class)
					return true;
				const _lk = lk, _tk = tk, _lst = lst, _ppos = parser_pos;
				const o: Record<string, number> = { '(': -1, '[': 0, '{': 0 };
				let e = '', c = '';
				block_mode = false;
				outloop:
				while (nexttoken()) {
					switch (c = tk.content) {
						case '(': case '[': case '{': o[c]++; break;
						case ')': case ']': case '}':
							if (--o[{ ')': '(', ']': '[', '}': '{' }[c]] < 0) {
								if (c === ')' && !o['['] && !o['{'] && nexttoken())
									e = tk.content;
								break outloop;
							}
							break;
					}
				}
				lk = _lk, tk = _tk, lst = _lst, parser_pos = _ppos, next = true;
				return e === '=>' || e === '{';
			}

			function check_operator(op: Token) {
				const tp = op.op_type ??= op_type(op);
				if ((tp >= 0 && (op.topofline === 1 || !isYieldsOperand(op.previous_token!))) ||
					(tp <= 0 && !check_right(_this.getToken(op.offset + op.length, true))))
					_this.addDiagnostic(diagnostic.missingoperand(), op.offset, op.length);
				return op.op_type;
				// -1 prefix; 0 binary; 1 postfix
				function op_type(op: Token) {
					switch (op.content.toLowerCase()) {
						case '!':
						case '~':
						case 'not':
							return -1;
						case '%':
							return op.previous_pair_pos === undefined ? -1 : 1;
						case '&':
						case '+':
						case '-':
							if (op.topofline < 1 && isYieldsOperand(op.previous_token ?? EMPTY_TOKEN))
								return 0;
							return -1;
						case '++':
						case '--':
							return isYieldsOperand(op) ? 1 : -1;
						case ':':
							return 0;
						case '?':
							return op.ignore ? 1 : 0;
						case '*':
							if (',(['.includes(op.previous_token?.content ?? '\0') &&
								',),]()[]'.includes(op.previous_token!.content + (_this.getToken(op.offset + 1, true).content || '\0')))
								return -1;	// skip yields_an_operand check
						// fall through
						default:
							return 0;
					}
				}
				function check_right(tk?: Token) {
					switch (tk?.type) {
						case TokenType.BlockStart:
						case TokenType.BracketStart:
						case TokenType.Number:
						case TokenType.String:
							return true;
						case TokenType.Identifier:
							if (tk.topofline === 1 && allIdentifierChar.test(op.content) && (_parent as FuncNode).ranges)
								return false;
							return true;
						case TokenType.Reserved:
							return RESERVED_OP.includes(tk.content.toLowerCase());
						case TokenType.Operator:
							return (tk.op_type ??= op_type(tk)) === -1;
						case TokenType.BracketEnd:
						case TokenType.EOF:
							if (op.op_type! < 1 && op.content === '*')
								return (op.op_type = 1);
						// fall through
						default:
							return false;
					}
				}
			}

			function set_line_begin(offset?: number) {
				if (line_end_token && line_begin_offset !== undefined)
					line_ranges.push([(line_end_token.pos ?? document.positionAt(
						line_end_token.offset + line_end_token.length)).line, line_begin_offset]);
				return line_end_token = undefined, line_begin_offset = offset;
			}

			function parse_brace(level = 0) {
				if (tk.type === TokenType.BlockStart) {
					delete tk.data;
					nexttoken(), next = false;
					if (!tk.topofline && !lk.topofline)
						unexpected(tk);
				}
				while (block_mode = true, nexttoken()) {
					if (tk.topofline === 1) {
						let nk: Token | undefined;
						set_line_begin(tk.offset);
						if (mode === BlockType.Class) {
							if (allIdentifierChar.test(tk.content) &&
								(tk.content.toLowerCase() !== 'static' || '.[('.includes(input[parser_pos]) ||
									(nk = _this.getToken(parser_pos, true)).topofline || !isIdentifierChar(nk.content.charCodeAt(0))))
								tk.type = TokenType.Identifier;
						} else {
							const is_default = case_pos.length && tk.content.toLowerCase() === 'default' &&
								(nk = _this.getToken(parser_pos, true)).content === ':';
							if (is_default || input[parser_pos] === ':' &&
								WHITESPACE.includes(input.charAt(parser_pos + 1)) && allIdentifierChar.test(tk.content)) {
								if (nk) {
									if ((tk.next_token_offset = nk.next_token_offset) > 0)
										tokens[nk.next_token_offset].previous_token = tk;
									delete tokens[nk.offset];
									tk.skip_pos = parser_pos = nk.offset + 1;
								} else parser_pos++;
								tk.content += ':', tk.length++, tk.type = TokenType.Label;
								line_begin_offset = undefined;
								delete tk.semantic;
								if (is_default) {
									const last_case = case_pos.pop();
									if (case_pos.push(tk.offset), last_case)
										_this.addFoldingRange(last_case, lk.offset, 'case');
									tk.hover_word = 'default';
									nexttoken(), next = false;
									tk.topofline ||= -1;
									continue;
								}
								tk.symbol = tn = DocumentSymbol.create(tk.content, undefined, SymbolKind.Field,
									make_range(tk.offset, tk.length), make_range(tk.offset, tk.length - 1));
								tn.data = blockpos.at(-1), tn.def = true, result.push(tn);
								(_cm = comments[tn.selectionRange.start.line]) && set_detail(tn, _cm);
								const labels = (_parent as FuncNode).labels[tn.name.slice(0, -1).toUpperCase()] ??= [];
								if (labels[0]?.def)
									_this.addDiagnostic(diagnostic.duplabel(), tk.offset, tk.length - 1),
										labels.splice(1, 0, tn);
								else labels.unshift(tn);
								nexttoken(), next = false;
								tk.topofline || unexpected(tk);
								continue;
							}
						}
					}

					switch (tk.type) {
						case TokenType.EOF: return;

						case TokenType.Identifier:
							if (tk.topofline > 0 && input[parser_pos] !== '%') {
								switch (nexttoken(), lk.content.toLowerCase()) {
									case 'class':
										if (!tk.topofline && parse_class())
											continue;
										break;
									case 'import':
										if (ahkVersion >= alpha_11 && mode === BlockType.Script && ' \t'.includes(input[lk.offset + lk.length])) {
											parse_import();
											continue;
										}
										break;
									case 'macro':
										if (h && mode !== BlockType.Class && !tk.topofline && lk.topofline === 1 &&
											allIdentifierChar.test(tk.content) && is_func_def()) {
											lk.type = TokenType.Reserved, tk.topofline = 2, nexttoken();
											const tn = parse_func(lk, null);
											if (tn)
												tn.full = `macro ${tn.full}`;
											continue;
										}
										break;
								}

								if (mode === BlockType.Class) {
									if (input[lk.offset + lk.length] === '(') {
										parse_func(lk);
										break;
									}
									if (PROP_NEXT_TOKEN.includes(tk.content, tk.topofline)) {
										const fc = lk, rl = result.length;
										let par: Variable[] = [], rg: Range;
										line_begin_offset = undefined;
										if (tk.content === '[') {
											par = parse_params(']') ?? [];
											nexttoken();
											if (par.length === 0)
												_this.addDiagnostic(diagnostic.propemptyparams(), fc.offset, lk.offset - fc.offset + 1);
											if (!PROP_NEXT_TOKEN.includes(tk.content, 1)) {
												_this.addDiagnostic(diagnostic.propdeclaraerr(), fc.offset, fc.length);
												next = false;
												break;
											}
										}
										const isstatic = fc.topofline === 2;
										const oo = isstatic ? fc.previous_token?.offset as number : fc.offset;
										const prop = fc.symbol = DocumentSymbol.create(fc.content, undefined, SymbolKind.Property,
											rg = make_range(fc.offset, fc.length), { ...rg }) as Property;
										if ((_cm = comments[prop.selectionRange.start.line]))
											set_detail(_cm.symbol = prop, _cm);
										prop.parent = isstatic ? _parent : (_parent as ClassNode).prototype;
										prop.has_this_param = true, prop.static = isstatic;
										prop.children = result.splice(rl);
										let pd = '';
										if (par.length) {
											const f = FuncNode.create('', SymbolKind.Function, rg, rg, par);
											pd = `[${f.full.slice(1, -1)}]`;
											prop.local = f.local, prop.declaration = f.declaration;
											prop.param_offsets = f.param_offsets, prop.params = par;
											adddeclaration(prop as FuncNode);
										}
										result.push(prop), addprop(fc, prop);
										prop.full = `(${classfullname.slice(0, -1)}) ${isstatic ? 'static ' : ''}${fc.content}${pd}`;
										fc.semantic = { type: SemanticTokenTypes.property, modifier: SemanticTokenModifiers.definition | (isstatic as unknown as number) };
										if (tk.content === '{') {
											let nk: Token, sk: Token, tn: FuncNode | undefined, _low: string;
											const brace = tk.offset;
											tk.previous_pair_pos = oo;
											nexttoken(), next = false, mode = BlockType.Func;
											if (tk.type as TokenType === TokenType.BlockEnd && !lk.topofline && !tk.topofline)
												unexpected(tk);
											while (nexttoken() && tk.type as TokenType !== TokenType.BlockEnd) {
												if (tk.topofline && /^[gs]et$/.test(_low = tk.content.toLowerCase())) {
													nexttoken(), nk = lk;
													if (tk.content as string === '=>') {
														tn = FuncNode.create(_low, SymbolKind.Function,
															make_range(lk.offset, parser_pos - lk.offset), make_range(lk.offset, lk.length), [...par]);
														mode = BlockType.Method, tn.returns = [parser_pos, 0];
														tn.parent = prop, tn.children = parse_line(undefined, 'return', 1), mode = BlockType.Class;
														tn.range.end = document.positionAt(tn.returns[1] = lk.offset + lk.length);
														tk.fat_arrow_end = true;
														_this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
														if (_low === 'set')
															tn.params.unshift(HIDDEN_PARAMS.value);
														else prop.returns = tn.returns;
														tn.has_this_param = true, adddeclaration(tn);
														line_ranges.push([tn.range.end.line, nk.offset]);
													} else if (tk.content === '{') {
														tn = FuncNode.create(_low, SymbolKind.Function,
															make_range(nk.offset, parser_pos - nk.offset), make_range(nk.offset, 3), [...par]);
														sk = tk, tn.parent = prop, tn.children = parse_block(3, tn, classfullname);
														tn.range.end = document.positionAt(parser_pos);
														if (_low === 'set')
															tn.params.unshift(HIDDEN_PARAMS.value);
														else prop.returns = tn.returns;
														tn.has_this_param = true, adddeclaration(tn);
														_this.addSymbolFolding(tn, sk.offset);
													} else {
														tn = undefined;
														_this.addDiagnostic(diagnostic.invalidprop(), tk.offset, tk.length);
														if (tk.content === '}') {
															next = false; break;
														} else {
															let b = 0;
															while (tk.type as TokenType !== TokenType.EOF) {
																if (tk.content === '{')
																	b++;
																else if (tk.content === '}' && (--b) < 0)
																	break;
																nexttoken();
															}
															next = false;
														}
													}
													if (tn && tn !== (prop[tn.name as 'get' | 'set'] ??= tn))
														_this.addDiagnostic(diagnostic.dupdeclaration(), nk.offset, nk.length);
												} else {
													let b = 0;
													_this.addDiagnostic(diagnostic.invalidprop(), tk.offset, tk.length);
													next = false;
													while (nexttoken()) {
														if (tk.content === '{')
															b++;
														else if (tk.content === '}' && (--b) < 0)
															break;
													}
													next = false;
												}
											}
											prop.range.end = document.positionAt(parser_pos - 1), mode = BlockType.Class;
											_this.addSymbolFolding(prop, brace);
											if (prop.get && !prop.set)
												fc.semantic.modifier! |= SemanticTokenModifiers.readonly;
										} else if (tk.content === '=>') {
											const off = parser_pos;
											let tn: FuncNode;
											mode = BlockType.Method, tn = FuncNode.create('get', SymbolKind.Function,
												rg = make_range(off, parser_pos - off), ZERO_RANGE, par);
											tn.parent = prop, prop.get = tn, prop.returns = tn.returns = [parser_pos, 0];
											tn.children = parse_line(undefined, 'return', 1), mode = BlockType.Class;
											prop.range.end = tn.range.end = document.positionAt(tn.returns[1] = lk.offset + lk.length);
											_this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
											tn.has_this_param = true, adddeclaration(tn), tk.fat_arrow_end = true;
											line_ranges.push([prop.range.end.line, oo]);
											fc.semantic.modifier! |= SemanticTokenModifiers.readonly;
										}
										if (prop.children.length) {
											const ps = [prop.get, prop.set].filter(Boolean) as FuncNode[];
											for (const k in prop.local)
												for (const f of ps)
													if (k in f.unresolved_vars!)
														f.declaration[k] = f.unresolved_vars![k], delete f.unresolved_vars![k];
											for (const k in prop.unresolved_vars) {
												let unset = true;
												for (const f of ps)
													if ((k in f.declaration) && !(k in f.global))
														delete f.local[k], unset = false;
												if (unset) continue;
												prop.local![k] = prop.declaration![k] = prop.unresolved_vars[k];
												delete prop.unresolved_vars[k];
											}
										}
										break;
									}
									tk = lk, lk = EMPTY_TOKEN, next = false;
									parser_pos = tk.offset + tk.length;
									const rl = result.length, _ = _parent;
									_parent = (_parent as ClassNode).$property!.__INIT;
									const sta = parse_statement('');
									_parent.children!.push(...result.splice(rl)), _parent = _;
									result.push(...sta), sta.forEach(it => it.parent = (_ as ClassNode).prototype);
								} else if (input[lk.offset + lk.length] === '(') {
									if (parse_call(lk, '('))
										break;
									result.push(...parse_line());
								} else {
									reset_extra_index(tk), tk = lk, lk = EMPTY_TOKEN;
									parser_pos = tk.offset + tk.length, next = true;
									parse_top_word();
								}
								line_end_token = lk;
								break;
							}

							if (mode === BlockType.Class) {
								const rl = result.length, _ = _parent;
								_parent = (_parent as ClassNode).$property!.__INIT;
								const sta = parse_statement('');
								_parent.children!.push(...result.splice(rl)), _parent = _;
								result.push(...sta), sta.forEach(it => it.parent = _);
							} else if (tk.topofline)
								next = true, parse_top_word();
							else next = false, result.push(...parse_line());
							line_end_token = lk;
							break;

						case TokenType.Directive: parse_sharp(); break;

						case TokenType.Reserved: parse_reserved(); break;

						case TokenType.BlockStart:
							if (mode === BlockType.Class)
								unexpected(tk);
							else blocks++, blockpos.push(parser_pos - 1);
							break;

						case TokenType.BlockEnd:
							if ((--blocks) >= 0 && blockpos.length) {
								const p = blockpos.pop()!;
								_this.addFoldingRange(tk.previous_pair_pos = p, parser_pos - 1);
								tokens[p].next_pair_pos = tk.offset;
								if (tk.topofline === 1)
									last_LF = tk.offset, begin_line = true;
							}
							if (blocks < level) {
								if (!(mode & BlockType.Mask) && level === 0)
									unexpected(tk), blocks = blockpos.length = 0;
								else {
									!tk.topofline && unexpected(tk);
									if (blockpos.length && tk.previous_pair_pos === undefined)
										tokens[tk.previous_pair_pos = blockpos.at(-1)!].next_pair_pos = tk.offset;
									return;
								}
							}
							break;

						// case TokenType.DOT:
						case TokenType.BracketEnd:
							unexpected(tk);
							line_begin_offset = undefined;
							break;

						case TokenType.HotkeyLine: {
							tk.symbol = tn = DocumentSymbol.create(tk.content, undefined, SymbolKind.Event,
								make_range(tk.offset, tk.length), make_range(tk.offset, tk.length - 2));
							tn.range.end = document.positionAt(parser_pos - 1), result.push(tn);
							if ((_cm = comments[tn.selectionRange.start.line]))
								set_detail(tn, _cm);
							if (mode & BlockType.Mask)
								_this.addDiagnostic(diagnostic.hotdeferr(), tk.offset, tk.length);
							if (tk.ignore) {
								while (nexttoken()) {
									if (!tk.ignore || tk.type as TokenType !== TokenType.String)
										break;
								}
								tn.range.end = document.positionAt(lk.offset + lk.length);
								next = false;
								break;
							}
							if (!isValidHotkey(tk.content))
								_this.addDiagnostic(diagnostic.invalidhotdef(), tk.offset, tk.length);
							break;
						}
						case TokenType.Hotkey: {
							if (mode & BlockType.Mask)
								_this.addDiagnostic(diagnostic.hotdeferr(), tk.offset, tk.length);
							else if (!tk.ignore && !isValidHotkey(tk.content))
								_this.addDiagnostic(diagnostic.invalidhotdef(), tk.offset, tk.length);
							const ht = tk, tn = DocumentSymbol.create(tk.content, undefined, SymbolKind.Event,
								make_range(tk.offset, tk.length), make_range(tk.offset, tk.length - 2)) as FuncNode;
							if ((_cm = comments[tn.selectionRange.start.line]))
								set_detail(tn, _cm);
							tk.symbol = tn, nexttoken();
							tn.declaration = {}, result.push(tn);
							tn.global = {}, tn.local = {}, tn.labels = {};
							while (tk.type as TokenType === TokenType.Directive)
								parse_sharp(), nexttoken();
							if (tk.type & TokenType.Hotkey) {
								next = false;
								break;
							}
							if (tk.type as TokenType === TokenType.Identifier && is_func_def()) {
								const fc = tk, fn = nexttoken() && parse_func(fc), r = fn && getParamCount(fn);
								if (!fc.topofline && ahkVersion < alpha_3)
									_this.addDiagnostic(diagnostic.unexpected(fc.content), fc.offset);
								if (!r || r.max < 1 || r.min > 1)
									_this.addDiagnostic(diagnostic.hotparamerr(), fc.offset);
								break;
							}
							if (tk.topofline && tk.content !== '{') {
								stop_parse(ht) || _this.addDiagnostic(diagnostic.hotmissbrace(), ht.offset, ht.length);
								next = false;
								break;
							}
							tn.params = [HIDDEN_PARAMS.thishotkey];
							if (tk.content === '{') {
								tk.previous_pair_pos = ht.offset;
								tn.children = parse_block(1, tn);
								tn.range = make_range(ht.offset, parser_pos - ht.offset);
								_this.addSymbolFolding(tn, tk.offset);
							} else {
								const tparent = _parent, tmode = mode, l = tk.type as TokenType === TokenType.Reserved ? tk.content.toLowerCase() : '';
								const rl = result.length;
								_parent = tn, mode = BlockType.Func, lk.body_start = tk.offset;
								if (l === 'return')
									tn.children = parse_line(undefined, 'return');
								else if (['global', 'local', 'static'].includes(l)) {
									parse_reserved();
									tn.children = result.splice(rl);
								} else {
									next = false, parse_body(null, ht.offset);
									tn.children = result.splice(rl);
								}
								_parent = tparent, mode = tmode;
								let o = lk.offset + lk.length;
								for (; ' \t'.includes(input[o]); o++);
								tn.range = make_range(ht.offset, o - ht.offset);
								line_begin_offset = undefined;
								line_ranges.push([tn.range.end.line, ht.offset]);
							}
							adddeclaration(tn);
							break;
						}
						case TokenType.Unknown:
							_this.addDiagnostic(diagnostic.unknowntoken(tk.content), tk.offset, tk.length);
							break;

						default:
							if (tk.topofline === 1) {
								if (tk.type === TokenType.Comma)
									unexpected(tk);
								else if (lk !== EMPTY_TOKEN && isContinuousLine(lk, tk, _parent))
									tk.topofline = -1;
								else lk = EMPTY_TOKEN;
							}
							if (next = false, mode === BlockType.Class)
								_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset, tk.length), parse_line();
							else {
								result.push(...parse_line());
								line_end_token = lk;
							}
							break;
					}
				}
			}

			function parse_func(fc: Token, is_static: boolean | null = false, params?: Variable[], rpair?: string, end?: string) {
				const in_cls = mode === BlockType.Class, prev_mode = mode, prev_parent = _parent;
				const range = make_range(fc.offset, fc.length), tn = _parent = {} as FuncNode;
				const se: SemanticToken = fc.semantic = {
					type: SemanticTokenTypes.function,
					modifier: SemanticTokenModifiers.definition | SemanticTokenModifiers.readonly |
						(is_static as unknown as number)
				};
				const rl = result.length, oo = is_static ? fc.previous_token!.offset : fc.offset;
				if (in_cls) {
					mode = BlockType.Method;
					tn.has_this_param = true;
					tn.kind = SymbolKind.Method;
					se.type = SemanticTokenTypes.method;
					tn.parent = is_static ? prev_parent : (prev_parent as ClassNode).prototype;
					if (fc.content[0] <= '9')
						_this.diagnostics.push({ message: diagnostic.invalidsymbolname(fc.content), range: tn.selectionRange });
				} else {
					mode = BlockType.Func;
					tn.kind = SymbolKind.Function;
					(prev_mode & BlockType.Mask) && (tn.parent = prev_parent);
					if (fc.length) {
						if (fc.content[0] <= '9')
							_this.diagnostics.push({ message: diagnostic.invalidsymbolname(fc.content), range: tn.selectionRange });
						else if (RESERVED_WORDS.includes(fc.content.toLowerCase()))
							_this.diagnostics.push({ message: diagnostic.reservedworderr(fc.content), range: tn.selectionRange });
					} else tokens[fc.offset].symbol = tn;
				}
				Object.assign(tn, FuncNode.create(fc.content, tn.kind,
					{ start: fc.pos = range.start, end: { character: 0, line: 0 } }, range,
					params ??= parse_params() ?? (_this.addDiagnostic(diagnostic.invalidparam(),
						fc.offset, tk.offset + 1 - fc.offset), []), undefined, is_static));
				fc.symbol = fc.definition = tn;
				if (fc.topofline && (_cm = comments[tn.selectionRange.start.line]))
					set_detail(_cm.symbol = tn, _cm);

				if (nexttoken() && tk.content === '=>') {
					const rs = result.splice(rl);
					tn.returns = [parser_pos, 0];
					const sub = rpair ? parse_expression(rpair, end) : parse_line(undefined, 'return', 1);
					tk.fat_arrow_end = true;
					result.push(tn), (tn.children = rs).push(...sub);
					tn.range.end = document.positionAt(tn.returns[1] = lk.offset + lk.length);
					_this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
					if (fc.topofline > 0 && tk.topofline) {
						line_begin_offset = undefined;
						line_ranges.push([tn.range.end.line, oo]);
					}
				} else if (tk.content === '{') {
					const rs = result.splice(rl), lb = tk;
					result.push(tn), (tn.children = rs).push(...parse_block(mode, tn, classfullname));
					tn.range.end = document.positionAt(parser_pos);
					_this.addSymbolFolding(tn, lb.offset);
					lb.previous_pair_pos = oo;
					tk = tokens[tk.next_pair_pos!] ?? _this.findToken(parser_pos - 1);
					if (rpair) {
						if (ahkVersion < alpha_3)
							_this.addDiagnostic(diagnostic.requireVerN(alpha_3), fc.offset, lb.offset - fc.offset, { code: DiagnosticCode.func_expr });
						lb.in_expr = tk.in_expr = fc.offset;
						begin_line = false;
					}
				} else {
					_this.diagnostics.push({ message: diagnostic.declarationerr(), range: tn.selectionRange });
					_parent = prev_parent, mode = prev_mode;
					return next = false, undefined;
				}
				_parent = prev_parent, mode = prev_mode;
				if (in_cls) {
					tn.full = `(${classfullname.slice(0, -1)}) ` + tn.full;
					(_this.object.method[fc.content.toUpperCase()] ??= []).push(tn);
				}

				adddeclaration(tn);
				return tn;
			}

			function parse_reserved() {
				let _low = tk.content.toLowerCase(), bak = lk;
				const beginpos = tk.offset, tpos = parser_pos;
				let nk: Token | undefined;
				block_mode = false;
				if (input[tk.offset - 1] === '%' || input[tpos] === '%') {
					tk.type = TokenType.Identifier, next = false;
					return;
				}
				switch (_low) {
					case 'global': case 'static': case 'local':
						nexttoken();
						if (tk.topofline && !isContinuousLine(lk, tk, _parent)) {
							if (mode === BlockType.Class)
								_this.addDiagnostic(diagnostic.propdeclaraerr(), lk.offset, lk.length);
							else if (_low === 'local' || _parent.static === null || result.some(it => it.kind === SymbolKind.Variable))
								_this.addDiagnostic(diagnostic.declarationerr(), lk.offset, lk.length);
							else (_parent as FuncNode).assume = _low === 'static' ? FuncScope.STATIC : FuncScope.GLOBAL;
						} else if (isIdentifierChar(tk.content.charCodeAt(0))) {
							if (input[parser_pos] === '(') {
								let isstatic = false;
								if (!(mode & BlockType.Mask) || _low !== 'static')
									_this.addDiagnostic(diagnostic.declarationerr(), lk.offset, lk.length);
								else isstatic = true, tk.topofline = 2;
								tk.type = TokenType.Identifier;
								nexttoken(), parse_func(lk, isstatic);
								break;
							}
							next = false;
							if (!(mode & BlockType.Mask)) {
								if (_low !== 'global')
									_this.addDiagnostic(diagnostic.declarationerr(), lk.offset, lk.length);
								else result.push(...parse_statement(''));
								break;
							}
							if ((mode === BlockType.Class) && PROP_NEXT_TOKEN.includes(
								(nk = _this.getToken(parser_pos, true)).content, nk.topofline)) {
								tk.topofline = 2, tk.type = TokenType.Identifier;
								break;
							}
							const rl = result.length, _ = _parent;
							if (mode === BlockType.Class)
								tk.topofline = 2, _parent = (_parent as ClassNode).property.__INIT;
							const fn = _parent as FuncNode;
							const sta = parse_statement(_low === 'global' ? '' : _low);
							if (_low === 'global') {
								for (const it of sta)
									fn.global[it.name.toUpperCase()] ??= it;
							} else {
								if (mode === BlockType.Class) {
									fn.children!.push(...result.splice(rl)), _parent = _;
									for (const it of sta) {
										it.static = true;
										(it as FuncNode).parent = _;
										it.full = it.full!.replace(') ', ') static ');
									}
								} else {
									const isstatic = _low === 'static';
									for (const it of sta) {
										it.static = isstatic;
										fn.local[it.name.toUpperCase()] ??= it;
									}
								}
							}
							result.push(...sta);
						} else {
							parser_pos = tpos, lk.type = TokenType.Identifier, tk = lk, lk = bak;
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						}
						next = false;
						break;
					case 'loop': {
						nexttoken();
						if (tk.type === TokenType.Comma)
							stop_parse(lk) || _this.addDiagnostic(diagnostic.funccallerr(), tk.offset, 1), nexttoken();
						let min = 0, max = 1, act = 'loop', sub;
						if (tk.type === TokenType.Assign) {
							parser_pos = lk.offset + lk.length, lk.type = TokenType.Identifier, tk = lk, lk = bak, next = false;
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
							break;
						} else if ((bak = lk, next = ' \t,'.includes(input[parser_pos]) && (tk.type === TokenType.Identifier && ['parse', 'files', 'read', 'reg'].includes(sub = tk.content.toLowerCase())))) {
							min = 1, max = sub === 'parse' ? 3 : 2;
							tk.type = TokenType.Reserved, act += ' ' + sub, lk.hover_word = tk.hover_word = act;
							nexttoken();
							if (tk.type as TokenType === TokenType.Comma && nexttoken())
								tk.topofline = 0;
							next = false;
						}
						if (!tk.topofline || tk.type === TokenType.Comma)
							result.push(...parse_line('{', act, min, max));
						else if (min)
							_this.addDiagnostic(diagnostic.acceptparams(act, `${min}~${max}`), bak.offset, bak.length);
						if (parse_body(false, beginpos, true))
							return;
						if (tk.type === TokenType.Reserved && tk.content.toLowerCase() === 'until')
							next = true, set_line_begin(tk.offset), result.push(...parse_line(undefined, 'until', 1));
						break;
					}
					case 'for': {
						const nq = is_next_char('('), returns: number[] = [], data: number[] = [];
						let for_index = 0;
						if (nq) nk = get_next_token();
						while (nexttoken()) {
							switch (tk.type) {
								case TokenType.Comma: for_index++; break;
								case TokenType.Reserved:
									_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
									break;
								case TokenType.Identifier: {
									const vr = addvariable(tk, 0);
									if (vr)
										vr.def = vr.assigned = true, vr.for_index = for_index, vr.returns = returns, vr.data = data;
									break;
								}
								case TokenType.Operator:
									if (tk.content.toLowerCase() === 'in') {
										returns.push(tk.offset + 2);
										result.push(...parse_expression(undefined, '{'));
										returns.push(lk.offset + lk.length);
										if (nk) {
											if (tk.content !== ')') {
												_this.addDiagnostic(diagnostic.missing(')'), nk.offset, nk.length);
											} else next = true, nexttoken();
										}
										data.push(tk.offset);
										if (!parse_body(false, beginpos, true) && tk.type as TokenType === TokenType.Reserved && tk.content.toLowerCase() === 'until')
											next = true, set_line_begin(tk.offset), result.push(...parse_line(undefined, 'until', 1));
										data.push(tk.offset, for_index + 1);
										return;
									}
									_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, tk.length);
									next = false;
									return;
								default:
									next = false;
								// fall through
								case TokenType.BracketEnd:
									unexpected(tk);
									return;
								case TokenType.Assign:
									_this.addDiagnostic(diagnostic.reservedworderr(lk.content), lk.offset, lk.length);
									return;
							}
						}
						break;
					}
					case 'break': case 'continue': case 'goto':
						nexttoken();
						if (!in_loop && _low !== 'goto')
							_this.addDiagnostic(diagnostic.outofloop(), lk.offset);
						if (tk.type === TokenType.Comma) {
							unexpected(tk);
							stop_parse(lk);
						}
						if (!tk.topofline) {
							if (allIdentifierChar.test(tk.content)) {
								if (tk.type === TokenType.Number && _low !== 'goto') {
									if (/[^\d]/.test(tk.content))
										unexpected(tk);
								} else
									tk.ignore = true, tk.type = TokenType.Identifier, addlabel(tk), delete tk.semantic;
								nexttoken(), next = false;
							} else if (input[lk.offset + lk.length] === '(') {
								const s: Token[] = [];
								parse_pair('(', ')', undefined, undefined, s);
								s.forEach(i => {
									if (i.content.indexOf('\n') < 0)
										addlabel({ content: i.content.slice(1, -1), offset: i.offset + 1, length: i.length - 2, type: TokenType.Label, topofline: 0, next_token_offset: -1 });
								});
								nexttoken(), next = false;
							} else if (tk.type === TokenType.String) {
								unexpected(tk);
								nexttoken(), next = false;
							} else {
								parser_pos = lk.offset + lk.length, lk.type = TokenType.Identifier, tk = lk, lk = bak, next = false;
								_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
								break;
							}
							if (!tk.topofline)
								unexpected(tk);
						} else if ((next = false, _low === 'goto'))
							_this.addDiagnostic(diagnostic.acceptparams(_low, 1), lk.offset, lk.length);
						break;
					case 'as': case 'catch': case 'else': case 'finally': case 'until':
						unexpected(tk);
						break;
					case 'super': parse_super(); break;
					case 'case':
						if (case_pos.length && tk.topofline) {
							const last_case = case_pos.pop();
							if (case_pos.push(tk.offset), last_case)
								_this.addFoldingRange(last_case, lk.offset, 'case');
							nexttoken(), next = false;
							if (tk.content !== ':' && !tk.topofline) {
								result.push(...parse_line(':', 'case', 1, 20));
								if (tk.content !== ':')
									unexpected(tk), next = false;
								else {
									next = true, nexttoken(), next = false;
									if (tk.type === TokenType.BlockStart)
										tk.previous_pair_pos = beginpos;
									else tk.topofline ||= -1;
								}
							} else
								next = tk.content === ':', unexpected(tk);
						} else
							tk.type = TokenType.Identifier, _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						break;
					case 'try':
						nexttoken(), next = false;
						if (tk.type === TokenType.Comma)
							stop_parse(lk);
						parse_body(true, beginpos);
						if (tk.type === TokenType.Reserved && tk.content.toLowerCase() !== 'else') {
							while (tk.type === TokenType.Reserved && tk.content.toLowerCase() === 'catch')
								next = true, parse_catch();
							for (const l of ['else', 'finally'])
								if (tk.type === TokenType.Reserved && tk.content.toLowerCase() === l)
									next = true, set_line_begin(tk.offset), nexttoken(), next = false, parse_body(true, lk.offset);
						}
						break;
					case 'isset':
						parse_isset(input[tk.offset + 5]);
						break;
					case 'false': case 'true':
						if (_this.getToken(parser_pos, true).type === TokenType.Assign)
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						else next = false;
						tk.type = TokenType.Identifier;
						break;
					case 'export':
						tk.semantic = SE_KEYWORD;
						if (mode === BlockType.Script) {
							let is_default = false;
							tk.semantic = SE_KEYWORD;
							nexttoken();
							if (tk.topofline || tk.content !== '(' && !allIdentifierChar.test(tk.content)) {
								unexpected(lk);
								break;
							}
							_this.addDiagnostic(warn.notimplemented(), lk.offset, lk.length, { code: DiagnosticCode.module, severity: DiagnosticSeverity.Warning });
							if ((_low = tk.content.toLowerCase()) === 'default') {
								nk = _this.getToken(parser_pos, true);
								if (!nk.topofline && (allIdentifierChar.test(nk.content) || nk.content === '(')) {
									is_default = true, tk.semantic = SE_KEYWORD, tk.type = TokenType.Reserved;
									nexttoken(), _low = tk.content.toLowerCase();
								}
							} else if (_low === 'import' && input[parser_pos] !== '(' &&
								isContinuousLine(EMPTY_TOKEN, _this.getToken(parser_pos, true)))
								return nexttoken() && parse_import();
							if (_low === 'class' && ' \t'.includes(input[parser_pos]) &&
								!(nk = _this.getToken(parser_pos, true)).topofline && allIdentifierChar.test(nk.content)) {
								tk.topofline = 2, nexttoken(), parse_class(is_default ? 'd' : 'e');
								break;
							}
							if (input[parser_pos] === '(' && allIdentifierChar.test(_low))
								nk = tk, nexttoken();
							else nk = undefined;
							if (tk.content === '(') {
								parse_func(nk ?? { ...EMPTY_TOKEN, offset: tk.offset });
								break;
							}
							next = false, tk.topofline = 2;
							is_default && _this.addDiagnostic(diagnostic.declarationerr(), lk.offset);
							const sta = parse_statement('');
							for (const it of sta)
								it.export = true;
							result.push(...sta);
						} else unexpected(tk);
						break;
					case 'throw':
						if (ahkVersion >= alpha_3) {
							tk.type = TokenType.Identifier, next = false;
							break;
						}
					// fall through
					default:
						nk = get_token_ignore_comment();
						if (nk.type === TokenType.Assign || /^([<>]=?|~=|&&|\|\||[.|?:^]|\*\*?|\/\/?|<<|>>|!?==?)$/.test(nk.content))
							tk.type = TokenType.Identifier, parser_pos = tpos, _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						else {
							lk = tk, tk = nk, next = false;
							if (_low === 'return' || _low === 'throw') {
								if (tk.type === TokenType.Comma)
									stop_parse(lk);
								const b = tk.offset;
								result.push(...parse_line(undefined, _low));
								if ((mode & BlockType.Func) && _low === 'return' && b <= lk.offset)
									(_parent.returns ??= []).push(b, lk.offset + lk.length);
							} else if (_low === 'switch') {
								result.push(...parse_line('{', _low, 0, 2));
								if (tk.content === '{') {
									tk.previous_pair_pos = beginpos, next = true;
									blockpos.push(parser_pos - 1);
									case_pos.push(0);
									parse_brace(++blocks);
									const last_case = case_pos.pop();
									if (last_case)
										_this.addFoldingRange(last_case, lk.offset, 'case');
									nexttoken(), next = false;
								} else unexpected(tk);
							} else if (_low === 'if' || _low === 'while') {
								if (tk.type === TokenType.Comma)
									stop_parse(lk);
								result.push(...parse_line('{', _low, 1));
								parse_body(false, beginpos, _low === 'while');
							}
						}
						break;
				}

				function addlabel(tk: Token) {
					const labels = (_parent as FuncNode).labels;
					if (!labels) return;
					labels[_low = tk.content.toUpperCase()] ??= [];
					const rg = make_range(tk.offset, tk.length);
					labels[_low].push(tk.symbol = tn = DocumentSymbol.create(tk.content, undefined, SymbolKind.Field, rg, rg));
					tn.data = blockpos.at(-1);
				}
			}

			function parse_class(export_?: string) {
				if (!allIdentifierChar.test(tk.content))
					return false;
				const cl = tk, bp = lk.offset;
				let ex = '';
				lk.type = TokenType.Reserved;
				if (tk.type !== TokenType.Identifier) {
					tk.type = TokenType.Identifier;
					_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
				} else if (tk.content[0] <= '9')
					_this.addDiagnostic(diagnostic.invalidsymbolname(tk.content), tk.length);
				if (mode & BlockType.Func) _this.addDiagnostic(diagnostic.classinfuncerr(), tk.offset, tk.length);
				tk = get_token_ignore_comment();
				if (!tk.topofline && tk.content.toLowerCase() === 'extends') {
					tk = get_next_token();
					if (!tk.topofline && tk.type === TokenType.Identifier) {
						ex = tk.content;
						addvariable(tk, 0, _this.children);
						while (parser_pos < input_length && input[parser_pos] === '.') {
							get_next_token();
							tk = get_next_token();
							if (!tk.prefix_is_whitespace && tk.type === TokenType.Identifier)
								ex += '.' + tk.content, addprop(tk);
							else break;
						}
						if (tk.type === TokenType.Identifier)
							tk = get_token_ignore_comment();
					} else if (tk.content === '{')
						unexpected(tk);
				}
				if (tk.content !== '{') {
					unexpected(tk);
					if (tk.topofline)
						return lk = tk.previous_token!, !(next = false);
					lk = tk, tk = get_token_ignore_comment();
					if (tk.content !== '{') {
						lk = (tk = lk).previous_token!;
						parser_pos = tk.offset + tk.length;
						return !(next = false);
					}
				}
				tk.previous_pair_pos = bp;
				const tn = DocumentSymbol.create(cl.content, undefined, SymbolKind.Class,
					ZERO_RANGE, make_range(cl.offset, cl.length)) as ClassNode;
				cl.symbol = cl.definition = tn, tn.full = classfullname + cl.content;
				tn.extends = ex, tn.uri = _this.uri;
				if ((_cm = comments[tn.selectionRange.start.line]))
					set_detail(tn, _cm);
				tn.prototype = { ...tn, cache: [], detail: undefined, property: tn.$property = {} };
				tn.children = [], tn.cache = [], tn.property = {};
				tn.type_annotations = [tn.full];
				let t = FuncNode.create('__Init', SymbolKind.Method, ZERO_RANGE, ZERO_RANGE, [], [], true);
				(tn.property.__INIT = t).ranges = [], t.parent = tn;
				t.full = `(${tn.full}) static __Init()`, t.has_this_param = true;
				t = FuncNode.create('__Init', SymbolKind.Method, ZERO_RANGE, ZERO_RANGE, [], []);
				(tn.$property!.__INIT = t).ranges = [], t.parent = tn.prototype!;
				t.full = `(${tn.full}) __Init()`, t.has_this_param = true;
				tn.children = parse_block(2, tn as unknown as FuncNode, classfullname + cl.content + '.');
				tn.range = tn.prototype!.range = make_range(bp, parser_pos - bp);
				cl.semantic = {
					type: SemanticTokenTypes.class,
					modifier: SemanticTokenModifiers.definition | SemanticTokenModifiers.readonly
				};
				adddeclaration(tn), _this.addSymbolFolding(tn, tk.offset);
				result.push(tn);
				return true;
			}

			function parse_catch() {
				let p: Token | undefined, nk: Token;
				const bp = set_line_begin(tk.offset)!;
				lk = nk = tk, p = get_token_ignore_comment();
				if (p.topofline || p.content !== '(')
					tk = p, p = undefined;
				else tk = get_token_ignore_comment();
				if (tk.topofline || (tk.type !== TokenType.Identifier && !allIdentifierChar.test(tk.content))) {
					if (p) {
						parser_pos = p.offset - 1;
						unexpected(tk);
					} else {
						next = false;
						if (tk.topofline || tk.content === '{')
							parse_body(null, bp);
						else unexpected(tk);
					}
				} else {
					const tps: string[] = [];
					next = true;
					if (tk.content.toLowerCase() !== 'as') {
						while (true) {
							let tp = '';
							if (tk.type !== TokenType.Identifier)
								unexpected(tk);
							else addvariable(tk), tp += tk.content;
							lk = tk, tk = get_token_ignore_comment();
							if (tk.type === TokenType.Dot) {
								nexttoken();
								while (true) {
									if (tk.type as TokenType === TokenType.Identifier) {
										addprop(tk), tp += '.' + tk.content;
										nexttoken();
									} else if (tk.content === '%') {
										unexpected(tk);
										parse_pair('%', '%');
										nexttoken(), tp = '@';
									} else
										break;
									if (tk.type !== TokenType.Dot)
										break;
									else nexttoken();
								}
							}
							!tp.startsWith('@') && tps.push(tp);
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
						if (tk.type !== TokenType.Identifier && !allIdentifierChar.test(tk.content)) {
							unexpected(nk);
						} else if (tk.type !== TokenType.Identifier)
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length), tk.type = TokenType.Identifier;
						else {
							const t = get_token_ignore_comment();
							parser_pos = tk.offset + tk.length;
							if (!t.topofline && t.content !== '{' && !(p && t.content === ')'))
								unexpected(nk), next = false;
							else {
								const vr = addvariable(tk);
								if (vr) {
									next = true, vr.def = vr.assigned = true;
									!tps.length && tps.push('Error');
									vr.type_annotations = tps;
								}
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
							unexpected(tk);
						else next = false, parse_body(null, bp);
					}
				}
			}

			function parse_import() {
				const kw = SE_KEYWORD;
				const mod = { type: SemanticTokenTypes.module };
				let has_from = true, next_is_id = true, has_suffix_imps, sk, vk, vr;
				lk.type = TokenType.Reserved;
				lk.semantic = kw;
				_this.addDiagnostic(warn.notimplemented(), lk.offset, lk.length, { code: DiagnosticCode.module, severity: DiagnosticSeverity.Warning });
				if (tk.content === '*')
					nexttoken();
				else if (tk.topofline)
					return next = false, unexpected_lf(tk);
				else if (tk.content === '{') {
					parse_imps();
				} else if ((has_from = !(tk.type === TokenType.String || allIdentifierChar.test(tk.content))))
					unexpected(tk);
				if (has_from) {
					if (tk.content.toLowerCase() === 'from') {
						if (tk.topofline && lk.content !== '*')
							unexpected_lf(tk);
						tk.type = TokenType.Reserved;
						tk.semantic = kw, nexttoken();
						if (tk.topofline)
							return next = false, unexpected_lf(tk);
						if (allIdentifierChar.test(tk.content))
							tk.semantic = mod, tk.type = TokenType.Identifier;
						else next = tk.type as TokenType === TokenType.String;
						if (allIdentifierChar.test(tk.content) || tk.type as TokenType === TokenType.String)
							has_from = false, has_suffix_imps = 0;
						else next = false;
					} else if (next = false, tk.topofline)
						return unexpected_lf(tk);
				}
				nexttoken();
				if (!has_from) {
					if ((sk = lk).type !== TokenType.String)
						(vk = lk).semantic = mod, lk.type = TokenType.Identifier;
					if (tk.content.toLowerCase() === 'as') {
						tk.semantic = kw, nexttoken();
						if (tk.topofline && lk.topofline)
							return next = false, unexpected_lf(tk);
						if (allIdentifierChar.test(tk.content)) {
							(vk = tk).semantic = mod, tk.type = TokenType.Identifier;
							nexttoken();
						} else vk = undefined, next = false;
					}
					has_suffix_imps ??= next && !tk.topofline && tk.content === '{';
					if (vk && (has_suffix_imps === false || sk !== vk)) {
						vr = Variable.create(vk.content, SymbolKind.Module,
							make_range(vk.offset, vk.length));
						if (sk !== vk)
							vr.alias = sk.content, vr.alias_range = make_range(sk.offset, sk.length);
						vr.decl = vr.def = vr.assigned = true;
						result.push(vr);
					}
					has_suffix_imps && parse_imps();
				}
				if ((next = !tk.topofline || isContinuousLine(lk, tk)))
					unexpected(tk), parse_line();
				function parse_imps() {
					const bk = tk, obj: Record<string, Variable> = {};
					bk.data = obj;
					while (nexttoken()) {
						if (next_is_id && (sk = tk).type === TokenType.Identifier) {
							if (nexttoken(), tk.content as string === 'as') {
								tk.semantic = kw;
								if (nexttoken(), tk.type === TokenType.Identifier) {
									vk = tk, nexttoken();
								} else vk = undefined, unexpected(tk);
							} else vk = lk;
							if (vk) {
								const n = vk.content.toUpperCase();
								if (obj[n])
									_this.addDiagnostic(diagnostic.dupdeclaration(), vk.offset, vk.length);
								else {
									obj[n] = vr = Variable.create(vk.content, SymbolKind.Variable,
										make_range(vk.offset, vk.length));
									if (sk !== vk)
										vr.alias = sk.content, vr.alias_range = make_range(sk.offset, sk.length);
									vr.decl = vr.def = vr.has_warned = true;
									result.push(vr);
								}
							}
							if ((next_is_id = tk.content as string === ','))
								continue;
						} else if (next_is_id && tk.content === '*')
							nexttoken();
						if (tk.content as string === '}') {
							begin_line = false;
							bk.next_pair_pos = tk.offset;
							tk.previous_pair_pos = bk.offset;
							_this.addFoldingRange(bk.offset, tk.offset);
							nexttoken();
							break;
						}
						next_is_id = tk.content as string === ',';
						unexpected(tk);
					}
				}
			}

			function reset_extra_index(tk: Token) {
				const t = tk.previous_extra_tokens;
				if (t) t.i = 0;
			}

			function parse_top_word() {
				let c = '', maybe;
				nexttoken(), next = false;
				if ((maybe = tk.ignore && tk.content === '?'))
					tk = get_next_token();
				if (tk.type !== TokenType.Assign && !/^(=[=>]?|\?\??|:)$/.test(tk.content) &&
					(tk.type === TokenType.Dot || ', \t\r\n'.includes(c = input.charAt(lk.offset + lk.length)))) {
					if (tk.type === TokenType.Dot) {
						const v = addvariable(lk);
						next = true;
						maybe && v && (v.returns = null);
						while (nexttoken()) {
							if (tk.type as TokenType === TokenType.Identifier) {
								let maybecaller = true;
								if (input[parser_pos] === '%') {
									maybecaller = false;
								} else if (addprop(tk), nexttoken(), ASSIGN_TYPE.includes(tk.content))
									maybecaller = false, maybeclassprop(lk, undefined, () => {
										const beg = parser_pos;
										result.push(...parse_expression());
										return [beg, lk.offset + lk.length];
									});
								else if (tk.ignore && tk.content === '?' && (tk = get_next_token()), tk.type === TokenType.Dot)
									continue;
								next = false;
								if (maybecaller && tk.type as TokenType !== TokenType.Assign && !'=??'.includes(tk.content || ' ') &&
									', \t\r\n'.includes(c = input.charAt(lk.offset + lk.length)))
									parse_call(lk, c, SymbolKind.Method);
								else
									result.push(...parse_line());
							} else
								next = false, result.push(...parse_line());
							break;
						}
					} else
						addvariable(lk), parse_call(lk, c);
				} else {
					let act, offset;
					/^=>?$/.test(tk.content) && (act = tk.content, offset = tk.offset);
					if (maybev1 && act === '=' && stop_parse(tk, true) &&
						(next = false, lk = EMPTY_TOKEN, tk = get_token_ignore_comment()))
						return;
					reset_extra_index(tk), tk = lk, lk = EMPTY_TOKEN, next = false;
					parser_pos = tk.skip_pos ?? tk.offset + tk.length;
					result.push(...parse_line(undefined, act, offset));
				}
			}

			function parse_call(fc: Token, nextc: string, kind?: SymbolKind, rpair?: string, end?: string) {
				const pi: ParamInfo = { offset: fc.offset, miss: [], comma: [], count: 0, unknown: false, name: fc.content };
				let range, tp, nk;
				if ('(['.includes(nextc ||= '\0')) {
					const pk = tk, rl = result.length, dl = _this.diagnostics.length;
					parse_pair(nextc, nextc === '(' ? ')' : ']', tk.offset, pi);
					if (kind === undefined) {
						nk = _this.getToken(parser_pos, true);
						tp = nk.content;
						if (tp === '=>' || tp === '{' && end !== '{' && (fc.topofline > 0 ||
							!nk.topofline || (mode & BlockType.Pair))) {
							result.splice(rl), _this.diagnostics.splice(dl);
							if (fc.ignore && input[fc.offset - 1] === '%') {
								delete fc.ignore;
								_this.addDiagnostic(diagnostic.missingspace(), fc.offset);
							}
							lk = fc, tk = pk, parser_pos = tk.offset + tk.length, next = true;
							return parse_func(fc, fc.topofline === 2, undefined, rpair, end);
						}
					}
					pi.offset = pk.offset;
					range = make_range(fc.offset, fc.length);
				} else {
					if (nextc === ',' || maybev1) {
						if (!kind && builtinCommands_v1.includes(fc.content.toLowerCase()) &&
							stop_parse(fc, true) && (next = false, lk = EMPTY_TOKEN, tk = get_token_ignore_comment()))
							return;
						nextc === ',' && _this.addDiagnostic(diagnostic.funccallerr(), tk.offset, 1);
					}
					if ((tp = tk.type) === TokenType.Operator && !/^(not|\+\+?|--?|!|~|%|&)$/i.test(tk.content))
						unexpected(tk);
					fc.paraminfo = pi;
					result.push(...parse_line(undefined, undefined, undefined, undefined, pi));
					range = make_range(fc.offset, fc.length);
					if (callWithoutParentheses === true || callWithoutParentheses && tp === TokenType.BracketStart)
						_this.diagnostics.push({
							code: DiagnosticCode.call, range,
							message: warn.callwithoutparentheses(),
							severity: DiagnosticSeverity.Warning,
						});
				}
				if (fc.ignore)
					return delete fc.semantic, undefined;
				const tn: CallSite = DocumentSymbol.create(fc.content, undefined,
					kind ??= SymbolKind.Function, { ...range }, range);
				tn.paraminfo = pi, tn.offset = fc.offset, fc.callsite = tn;
				if (lk === fc) {
					const lf = input.indexOf('\n', fc.offset);
					pi.end = lf < 0 ? input_length : lf;
				} else pi.end = lk.offset + lk.length;
				tn.range.end = document.positionAt(pi.end);
				switch (kind) {
					case SymbolKind.Method:
						maybeclassprop(fc, pi.method = true)
						fc.semantic = { type: SemanticTokenTypes.method };
						break;
					case SymbolKind.Function:
						fc.semantic = { type: SemanticTokenTypes.function };
					// fall through
					case SymbolKind.Variable:
						addvariable(fc);
						break;
				}
			}

			function parse_body(else_body: boolean | null, previous_pos: number, loop_body = false) {
				const oil = in_loop, prev = mode;
				in_loop ||= loop_body, next = true, mode |= BlockType.Body;
				if ((block_mode = false, tk.type === TokenType.BlockStart)) {
					tk.previous_pair_pos = previous_pos;
					blockpos.push(parser_pos - 1), parse_brace(++blocks);
					nexttoken();
					next = tk.type as TokenType === TokenType.Reserved && tk.content.toLowerCase() === 'else';
				} else {
					const t = tk;
					if (tk.type === TokenType.Reserved && LINE_STARTERS.includes(tk.content.toLowerCase())) {
						parse_reserved();
						if (t === tk || (t === lk && !next && !tk.topofline))
							if (t === tk && t.type === TokenType.Identifier)
								next = true, parse_top_word();
							else result.push(...parse_line());
					} else {
						if (tk.type === TokenType.Identifier) {
							if (tk.topofline > 0 && tk.content.toLowerCase() === 'class') {
								if (nexttoken() && parse_class())
									return mode = prev, else_body;
								next = false;
							}
							parse_top_word();
						} else if (tk.type !== TokenType.EOF)
							lk = EMPTY_TOKEN, next = false, result.push(...parse_line());
					}
					const e = tokens[previous_pos];
					if (t.content.length)
						e.body_start = t.offset;
					else delete t.body_start;
					line_end_token = lk;
					next = tk.type === TokenType.Reserved && tk.content.toLowerCase() === 'else';
				}
				in_loop = oil, mode = prev;
				if (typeof else_body === 'boolean') {
					if (else_body)
						next = false;
					else if (next) {
						set_line_begin(tk.offset);
						nexttoken(), next = false;
						parse_body(true, lk.offset);
						return true;
					}
				} else next = false;
				return false;
			}

			function parse_line(end?: string, act?: string, min = 0, max = 1, pi?: ParamInfo): AhkSymbol[] {
				let b: number, hascomma = 0, t = 0, nk: Token | undefined, e: number;
				const res: AhkSymbol[] = [], info = pi ?? { offset: 0, count: 0, comma: [], miss: [], unknown: false };
				if ((block_mode = false, next)) {
					const t = _this.getToken(parser_pos, true);
					b = t.content ? t.offset : parser_pos + 1;
					if (t.type === TokenType.Comma)
						info.miss.push(info.count++);
					else if (!t.topofline || isContinuousLine(tk, t))
						++info.count, nk = t;
				} else {
					b = tk.content ? tk.offset : lk.offset + lk.length + 1;
					if (tk.type === TokenType.Comma)
						info.miss.push(info.count++);
					else if (!tk.topofline || isContinuousLine(lk, tk))
						++info.count, nk = tk;
				}
				while (true) {
					res.push(...parse_expression(undefined, end));
					e ??= tk.offset;
					if (tk.type === TokenType.Comma) {
						next = true, ++hascomma, ++info.count;
						if (lk.type === TokenType.Comma || lk.type === TokenType.BracketStart)
							info.miss.push(info.comma.length);
						else if (lk.type === TokenType.Operator && !lk.ignore && !/(--|\+\+|%)/.test(lk.content))
							unexpected(tk);
						info.comma.push(tk.offset), pi && (tk.paraminfo = pi);
					} else if (tk.topofline) {
						next = false;
						break;
					} else if (end === tk.content)
						break;
					else if (t !== parser_pos)
						unexpected(tk), next = false;
					if (t === parser_pos && (!continuation_sections_mode || tk.length))
						break;
					t = parser_pos;
				}
				if (act === '=' || act === '=>') {
					let tk = _this.findToken(b), diag = true;
					if (tk.offset < e) {
						while (tk && tk.offset < e) {
							if (!tk.ignore && tk.content === '?') {
								diag = false;
								break;
							}
							if (tk.symbol)
								tk = _this.findToken(_this.document.offsetAt(tk.symbol.range.end), true);
							else tk = tokens[tk.next_pair_pos ?? tk.next_token_offset];
						}
						if (diag) {
							if (act === '=' && stop_parse(tokens[nk!.next_token_offset], true) &&
								(next = false, lk = EMPTY_TOKEN, tk = get_token_ignore_comment()))
								return [];
							_this.addDiagnostic(`${diagnostic.unexpected(act)}, ${diagnostic.didyoumean(':=')}`, min, act.length,
								{ code: DiagnosticCode.expect, data: ':=' });
						}
					}
				} else if (act && (hascomma >= max || (info.count - (tk === nk ? 1 : 0) < min)))
					_this.addDiagnostic(diagnostic.acceptparams(act, max === min ? min : `${min}~${max}`), b, lk.offset + lk.length - b);
				if (lk.content === '*')
					info.unknown = true, info.count--;
				return res;
			}

			function parse_sharp() {
				let isdll = false, l: string;
				const data = tk.data as Token ?? { content: '', offset: tk.offset + tk.length, length: 0 };
				switch (l = tk.content.toLowerCase()) {
					case '#dllload':
						isdll = true;
					// fall through
					case '#include':
					case '#includeagain':
						add_include_dllload(data.content.replaceAll('`;', ';'), data, mode, isdll);
						break;
					case '#dllimport':
						if ((m = data.content.match(/^((\w|[^\x00-\x7f])+)/i))) {
							const rg = make_range(data.offset, m[0].length);
							const tps: Record<string, string> = { t: 'ptr', i: 'int', s: 'str', a: 'astr', w: 'wstr', h: 'short', c: 'char', f: 'float', d: 'double', I: 'int64' };
							const n = m[0], args: Variable[] = [];
							let arg: Variable | undefined, u = '', i = 0, rt = 'i';
							h = true, m = data.content.substring(m[0].length).match(/^[ \t]*,[^,]+,([^,]*)/);
							m = m?.[1].replace(/[ \t]/g, '').toLowerCase().replaceAll('i6', 'I') ?? '';
							for (const c of m.replace(/^(\w*)[=@]?=/, (s, m0) => (rt = m0 || rt, ''))) {
								if (c === 'u')
									u = 'u';
								else {
									if (tps[c])
										args.push(arg = Variable.create(`p${++i}_${u + tps[c]}`, SymbolKind.Variable, ZERO_RANGE)), arg.defaultVal = null, u = '';
									else if (arg && (c === '*' || c === 'p'))
										arg.name += 'p', arg = undefined;
									else {
										_this.addDiagnostic(diagnostic.invalidparam(), data.offset, data.length);
										return;
									}
								}
							}
							const fn = FuncNode.create(n, SymbolKind.Function, rg, rg, args);
							fn.type_annotations = ['fd'.includes(rt) ? 'Float' : 'asw'.includes(rt) ? 'String' : 'Integer'];
							result.push(fn);
						}
						break;
					case '#requires':
						l = data.content.toLowerCase();
						h ||= l.startsWith('autohotkey_h');
						if ((m = l.match(/^\w+[ \t]+v(1|2)/))) {
							if (m[1] === '2')
								_this.maybev1 = maybev1 = 0;
							else if (_this.maybev1 = maybev1 = 3, !stop_parse(data, false, diagnostic.requirev1()))
								unexpected(data);
						}
						break;
					case '#hotif':
						if (mode & BlockType.Mask)
							_this.addDiagnostic(diagnostic.invalidscope(tk.content), tk.offset, tk.length);
						else {
							if (last_hotif !== undefined)
								_this.addFoldingRange(last_hotif, tk.offset);
							nexttoken(), next = false;
							last_hotif = tk.topofline ? undefined : lk.offset;
						}
						break;
					case '#hotstring':
						l = data.content?.trim().toLowerCase() ?? '';
						if (l !== 'nomouse' && l !== 'endchars')
							_this.hotstringExecuteAction = /x(?!0)/.test(l);
						break;
					case '#module':
						if (ahkVersion < alpha_11)
							_this.addDiagnostic(diagnostic.requireVerN(alpha_11), tk.offset, tk.length, { code: DiagnosticCode.module });
						else
							_this.addDiagnostic(warn.notimplemented(), tk.offset, tk.length, { code: DiagnosticCode.module, severity: DiagnosticSeverity.Warning });
						break;
					default:
						if (/^#(if|hotkey|(noenv|persistent|commentflag|escapechar|menumaskkey|maxmem|maxhotkeysperinterval|keyhistory)\b)/i.test(l) &&
							!stop_parse(tk))
							unexpected(tk);
						break;
				}
			}

			function parse_statement(local: string) {
				const sta: Variable[] = [], md = mode, incls = md === BlockType.Class;
				let pc: Token | undefined;
				block_mode = false, incls && (mode = BlockType.Method);
				loop: while (nexttoken()) {
					if (tk.topofline === 1 && !isContinuousLine(lk, tk, _parent)) {
						next = false; break;
					}
					switch (tk.type) {
						case TokenType.Operator:
							if (!allIdentifierChar.test(tk.content)) {
								unexpected(tk); parse_expression(',');
								break;
							}
						// fall through
						case TokenType.Reserved:
							if (!incls)
								_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
							tk.type = TokenType.Identifier;
						// fall through
						case TokenType.Identifier:
							if (nexttoken() && tk.type as TokenType === TokenType.Assign) {
								const equ = tk.content, pp = parser_pos;
								const vr = addvariable(lk, md, sta);
								if (incls) {
									if (local)
										lk.semantic!.modifier = SemanticTokenModifiers.static;
									if (equ !== ':=')
										_this.addDiagnostic(`${diagnostic.unexpected(equ)}, ${diagnostic.didyoumean(':=')}`,
											tk.offset, tk.length, { code: DiagnosticCode.expect });
								}
								if ((pc = comments[vr.selectionRange.start.line]))
									set_detail(vr, pc);
								result.push(...parse_expression());
								const t: [number, number] = [pp, lk.offset + lk.length];
								(_parent as FuncNode).ranges?.push(t);
								if (equ === ':=' || equ === '??=' && (vr.assigned ??= 1))
									vr.returns = t;
								else vr.cached_types = [equ === '.=' ? STRING : NUMBER];
								vr.assigned ??= true, vr.decl = vr.def = true;
								vr.range.end = document.positionAt(lk.offset + lk.length);
							} else if (incls) {
								let err = diagnostic.propnotinit(), dots = 0;
								const llk = lk, v = addvariable(lk, 2, sta)!;
								if (v.def = false, local)
									lk.semantic!.modifier = SemanticTokenModifiers.static;
								if (tk.type as TokenType === TokenType.Dot) {
									err = diagnostic.propdeclaraerr();
									while (!tk.prefix_is_whitespace && nexttoken() && tk.type === TokenType.Identifier) {
										if (!nexttoken())
											break;
										if (tk.type as TokenType === TokenType.Assign) {
											const pp = parser_pos, p = lk, assign = ASSIGN_TYPE.includes(tk.content);
											if (assign && tk.content !== ':=')
												_this.addDiagnostic(`${diagnostic.unexpected(tk.content)}, ${diagnostic.didyoumean(':=')}`,
													tk.offset, tk.length, { code: DiagnosticCode.expect });
											addprop(lk);
											result.push(...parse_expression());
											const t: [number, number] = [pp, lk.offset + lk.length];
											(_parent as FuncNode).ranges?.push(t);
											if (!dots && assign && _parent.static && llk.content.toLowerCase() === 'prototype') {
												const prop = Variable.create(p.content, SymbolKind.Property, make_range(p.offset, p.length));
												const cls = (_parent.parent as ClassNode).prototype!;
												if ((_cm = comments[prop.selectionRange.start.line]))
													set_detail(prop, _cm);
												prop.parent = cls, prop.returns = t;
												cls.cache!.push(prop);
											}
											continue loop;
										}
										if (tk.type as TokenType === TokenType.Dot)
											addprop(lk), dots++;
										else break;
									}
								} else if (!local && tk.content === ':') {	// Typed properties
									let pp = tk.offset + 1, tpexp = '', is_expr = false, _tp: Token | undefined;
									const _p = _parent, static_init = (currsymbol as ClassNode).property.__INIT as FuncNode;
									const scl = static_init.children!.length;
									delete v.def;
									v.typed = true;
									lk = tk, tk = get_next_token(), err = '';
									if (allIdentifierChar.test(tk.content)) {
										_tp = tk, tpexp += tk.content, nexttoken();
									} else if (tk.type === TokenType.BracketStart) {
										const l = result.length;
										_parent = static_init, is_expr = true;
										parse_pair(tk.content, tk.content === '(' ? ')' : ']');
										static_init.children!.push(...result.splice(l));
										_parent = _p, nexttoken();
									} else if (tk.content === ':=' || tk.type === TokenType.Comma || tk.topofline && allIdentifierChar.test(tk.content))
										unexpected(tk), next = false;
									else err = diagnostic.propdeclaraerr();
									if (ahkVersion < alpha_3)
										_this.addDiagnostic(diagnostic.requireVerN(alpha_3), llk.offset, lk.offset + lk.length - llk.offset, { code: DiagnosticCode.typed_prop });
									if (!err) {
										while (true) {
											if (tk.content === '.' && tk.type !== TokenType.Operator) {
												if (tk.type !== TokenType.Dot)
													unexpected(tk);
												if (nexttoken() && tk.type === TokenType.Identifier)
													tpexp += '.' + tk.content, addprop(tk), nexttoken();
											} else if (tk.type === TokenType.BracketStart && !tk.prefix_is_whitespace && allIdentifierChar.test(lk.content)) {
												const l = result.length, predot = lk.previous_token?.type === TokenType.Dot;
												_parent = static_init, is_expr = true;
												parse_call(lk, tk.content, tk.content === '[' ?
													predot ? SymbolKind.Property : SymbolKind.Variable :
													predot ? SymbolKind.Method : SymbolKind.Function);
												static_init.children!.push(...result.splice(l));
												_parent = _p, nexttoken();
											} else break;
										}
										if (_tp) {
											if (tk.previous_token === _tp && /^([iu](8|16|32|64)|f(32|64)|[iu]ptr)$/i.test(_tp.content)) {
												v.type_annotations = [/^f/i.test(_tp.content) ? 'Float' : 'Integer'];
												_tp.semantic = SE_CLASS;
											} else if (_tp.type === TokenType.Identifier)
												addvariable(_tp, 3, static_init.children);
										}
										v.type_annotations ??= is_expr || !tpexp ? ['Any'] : [tpexp];
										if (tk.content === ':=') {
											static_init.ranges?.push([pp, tk.offset - 1]);
											pp = tk.offset + 2;
											result.push(...parse_expression());
											(_parent as FuncNode).ranges?.push([pp, lk.offset + lk.length]);
											continue loop;
										}
										if (tk.content === ',' || (tk.content === '}' || tk.topofline && allIdentifierChar.test(tk.content)) && !(next = false)) {
											static_init.ranges?.push([pp, tk.offset - 1]);
											continue loop;
										}
										err = diagnostic.propdeclaraerr();
										static_init.children?.splice(scl);
										v.def = false;
									}
								}
								err && _this.addDiagnostic(err, llk.offset);
								if (tk.content === '}' || tk.topofline && allIdentifierChar.test(tk.content)) {
									lk = EMPTY_TOKEN, next = false;
									break loop;
								}
								if (tk.content !== ',')
									unexpected(tk), parse_expression();
							} else if (tk.content === ',' || tk.topofline && !isContinuousLine(lk, tk, _parent)) {
								const vr = addvariable(lk, md, sta);
								vr.decl = vr.def = true;
								if ((pc = comments[vr.selectionRange.start.line]))
									set_detail(vr, pc);
								if (tk.content !== ',') {
									next = false;
									break loop;
								}
							} else unexpected(tk), parse_expression(',');
							break;
						case TokenType.Comma:
							lk.content === ',' && unexpected(tk);
							continue;
						case TokenType.BlockEnd:
							next = false;
							break loop;
						case TokenType.Number:
							if (incls && allIdentifierChar.test(tk.content.replace(/(?<!^)\./g, ''))) {
								const i = tk.content.indexOf('.');
								if (i > -1)
									parser_pos = tk.offset + (tk.length = i), tk.content = tk.content.substring(0, i);
								tk.type = TokenType.Identifier;
								delete tk.semantic;
								delete tk.data;
								next = false;
								break;
							}
						// fall through
						default: unexpected(tk); parse_expression(',');
					}
				}
				return mode = md, sta;
			}

			function parse_expression(rpair = ',', end?: string): AhkSymbol[] {
				const pres = result.length, ternarys: number[] = [];
				let byref;
				block_mode = false;
				while (nexttoken()) {
					if (tk.topofline === 1)
						if (rpair === ',' && !isContinuousLine(lk, tk, _parent)) {
							if (lk.type === TokenType.Identifier && input[lk.offset - 1] === '.')
								addprop(lk);
							next = false; break;
						} else if (lk !== EMPTY_TOKEN)
							tk.topofline = -1;
					switch (tk.type) {
						case TokenType.Identifier: {
							if (input[parser_pos] === '(')
								continue;
							const predot = input[tk.offset - 1] === '.';
							nexttoken();
							if (tk.type as TokenType === TokenType.Comma) {
								if (predot)
									addprop(lk), byref && (lk.__ref = true);
								else if (input[lk.offset - 1] !== '%') {
									const vr = addvariable(lk);
									if (vr && byref !== undefined) {
										vr.def = vr.assigned = true;
										if (byref)
											vr.pass_by_ref = true;
										else vr.cached_types = [NUMBER];
									};
								} else lk.ignore = true;
								next = false;
								return result.splice(pres);
							} else if (tk.type as TokenType === TokenType.Operator && (!tk.topofline || !/^(!|~|not|\+\+|--)$/i.test(tk.content))) {
								let suf = !tk.topofline && ['++', '--'].includes(tk.content);
								if (input[lk.offset - 1] !== '%' && input[lk.offset + lk.length] !== '%') {
									if (predot) {
										addprop(lk);
										if (byref) {
											if (tk.ignore && _this.getToken(parser_pos, true).type === TokenType.Dot)
												continue;
											lk.__ref = true;
										}
									} else {
										const vr = addvariable(lk);
										if (vr) {
											if (byref !== undefined)
												vr.def = vr.assigned = true, byref ? (vr.pass_by_ref = true) : (vr.cached_types = [NUMBER]);
											if (suf)
												vr.def = vr.assigned = true, vr.cached_types = [NUMBER];
											else if (tk.content === '??' || tk.ignore)
												vr.returns = null;
											else if (byref === undefined && tk.content === '=>')
												parse_func({ ...EMPTY_TOKEN, offset: lk.offset }, next = false,
													result.splice(-1), rpair, end ?? (ternarys.length ? ':' : undefined));
										}
									}
								} else if (predot) {
									maybeclassprop(lk, null);
									tk = lk, lk = tk.previous_token ?? EMPTY_TOKEN;
									parse_prop(rpair), nexttoken(), suf ||= !tk.topofline && ['++', '--'].includes(tk.content);
								} else
									lk.ignore = true;
								next = false;
								break;
							} else if (tk.topofline && (tk.type as TokenType !== TokenType.Assign && tk.type as TokenType !== TokenType.Dot)) {
								next = false;
								if (!predot) {
									if (input[lk.offset - 1] !== '%') {
										const vr = addvariable(lk);
										if (vr && byref !== undefined) {
											vr.def = vr.assigned = true;
											if (byref)
												vr.pass_by_ref = true;
											else vr.cached_types = [NUMBER];
										}
									} else lk.ignore = true;
								} else if (input[lk.offset - 1] !== '%') {
									addprop(lk), byref && (lk.__ref = true);
								} else
									lk.ignore = true;
								ternaryMiss(ternarys);
								return result.splice(pres);
							}
							if (!predot) {
								let vr: Variable | undefined;
								if (input[lk.offset - 1] !== '%' && (vr = addvariable(lk))) {
									if (byref) {
										if (tk.type as TokenType !== TokenType.Dot)
											vr.assigned = vr.def = vr.pass_by_ref = true;
										else if (ahkVersion < alpha_3 + 7)
											_this.addDiagnostic(diagnostic.requireVerN(alpha_3 + 7), lk.previous_token!.offset, 1, { code: DiagnosticCode.v_ref });
										else { tk.topofline &&= -1; continue; }
									} else if (byref === false && tk.type as TokenType !== TokenType.Dot)
										vr.def = vr.assigned = true, vr.cached_types = [NUMBER];
									if (tk.type as TokenType === TokenType.Assign) {
										if ((_cm = comments[vr.selectionRange.start.line]))
											set_detail(vr, _cm);
										const equ = tk.content, b = parser_pos;
										next = true;
										result.push(...parse_expression(rpair, end ?? (ternarys.length ? ':' : undefined)));
										vr.range.end = document.positionAt(lk.offset + lk.length);
										if (equ === ':=' || equ === '??=' && (vr.assigned ??= 1))
											vr.returns = [b, lk.offset + lk.length];
										else vr.cached_types = [equ === '.=' ? STRING : NUMBER];
										vr.assigned ??= true, vr.def = true;
									} else next = false;
								} else
									next = false, lk.ignore = true;
							} else {
								addprop(lk);
								if ((next = tk.type as TokenType === TokenType.Assign)) {
									ASSIGN_TYPE.includes(tk.content) && maybeclassprop(lk, undefined, () => {
										const beg = parser_pos;
										result.push(...parse_expression(rpair, end ?? (ternarys.length ? ':' : undefined)));
										return [beg, lk.offset + lk.length];
									});
								} else if (byref) {
									if (tk.type as TokenType === TokenType.Dot ||
										tk.ignore && tk.content === '?' && _this.getToken(parser_pos, true).type === TokenType.Dot)
										continue;
									else lk.__ref = true;
								}
							}
							break;
						}
						case TokenType.BracketStart:
							if (tk.content === '[') {
								parse_pair('[', ']');
							} else {
								let fc: Token, kind;
								if (lk.type === TokenType.Identifier && lk.offset + lk.length === tk.offset) {
									if ((fc = lk).previous_token?.type === TokenType.Dot)
										kind = SymbolKind.Method;
									else if (input[lk.offset - 1] === '%' && fc.previous_token?.op_type === 1)
										fc.ignore = delete fc.semantic;
								} else fc = { ...EMPTY_TOKEN, offset: tk.offset, ignore: true };
								parse_call(fc, '(', kind, rpair, end ?? (ternarys.length ? ':' : undefined));
							}
							continue;
						case TokenType.BlockStart:
							if (!end || !tk.data) {
								const l = _this.diagnostics.length, bo = tk.offset;
								let must;
								if (end === '{') {
									if (lk.topofline && lk.type === TokenType.Reserved) {
										if (!tk.topofline && !_this.getToken(parser_pos, true).topofline)
											must = true;
									} else if (!(lk.op_type === 1 || isYieldsOperand(lk)))
										must = false;
								} else must = true, isYieldsOperand(lk) && _this.addDiagnostic(diagnostic.unexpected('{'), bo, 1);
								if (must !== undefined) {
									if (parse_obj(must))
										break;
									_this.diagnostics.splice(l);
									if (!must && (lk.type === TokenType.Assign || (lk.op_type ?? 1) < 1))
										_this.addDiagnostic(diagnostic.unexpected('{'), bo, 1);
								}
							}
							ternaryMiss(ternarys), next = false;
							return result.splice(pres);
						case TokenType.Number:
						case TokenType.String: break;
						case TokenType.BlockEnd:
						case TokenType.BracketEnd:
						case TokenType.Comma:
							next = false;
							ternaryMiss(ternarys);
							return result.splice(pres);
						case TokenType.Label: unexpected(tk); break;
						case TokenType.Unknown: _this.addDiagnostic(diagnostic.unknowntoken(tk.content), tk.offset, tk.length); break;
						case TokenType.Reserved: {
							const c = input[tk.offset + tk.length];
							if (c === '%' || input[tk.offset - 1] === '%') {
								tk.ignore = true, tk.type = TokenType.Identifier;
								continue;
							}
							switch (_low = tk.content.toLowerCase()) {
								case 'false': case 'true':
									tk.type = TokenType.Identifier;
									if (byref !== undefined || _this.getToken(parser_pos, true).type === TokenType.Assign)
										_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
									else next = false;
									continue;
								case 'isset': parse_isset(c); continue;
								case 'super': parse_super(); continue;
							}
							if (ahkVersion >= alpha_3 && _low === 'throw') {
								next = false, tk.type = TokenType.Identifier;
								continue;
							}
							if (tk.topofline && !')]'.includes(rpair) && LINE_STARTERS.includes(_low)) {
								tk.topofline = 1;
								next = false;
								unexpected_lf(tk);
								ternaryMiss(ternarys);
								return result.splice(pres);
							}
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
							break;
						}
						case TokenType.Operator:
							if (tk.content === '%') {
								if (rpair === '%') {
									next = false;
									ternaryMiss(ternarys);
									return result.splice(pres);
								}
								input[tk.offset - 1] === '.' ? (maybeclassprop(tk, null), parse_prop()) : parse_pair('%', '%');
								continue;
							} else if (tk.content === '=>')
								unexpected(tk);
							else {
								if (allIdentifierChar.test(tk.content) && (input[tk.offset - 1] === '%' || input[parser_pos] === '%')) {
									tk.ignore = true, tk.type = TokenType.Identifier;
									continue;
								}
								if (tk.content === ':') {
									if (ternarys.pop() === undefined) {
										if (end === ':') {
											next = false;
											return result.splice(pres);
										}
										unexpected(tk);
									}
								} else if (tk.content === '?') {
									if (!tk.ignore)
										ternarys.push(tk.offset);
									else continue;
								}
								if (check_operator(tk) === -1) {
									if (tk.content === '&') {
										byref = true;
										continue;
									}
									if (['++', '--'].includes(tk.content)) {
										byref = false;
										continue;
									}
								}
							}
							break;
						case TokenType.Assign: break;
						case TokenType.Dot: continue;
					}
					byref = undefined;
				}
				ternaryMiss(ternarys);
				return result.splice(pres);
			}

			function parse_params(endc = ')') {
				const beg = parser_pos - 1, cache: ParamList = [];
				const la = [',', endc === ')' ? '(' : '['], pk = tk;
				let byref = false, paramsdef = true, bb = parser_pos, bak = tk;
				let must = false, hasexpr = false, lineno: number | undefined;
				const info: ParamInfo = { offset: beg, count: 0, comma: [], miss: [], unknown: false };
				block_mode = false, bak.paraminfo = info;
				if (lk.type === TokenType.Identifier && bak.prefix_is_whitespace === undefined)
					info.name = lk.content, must = lk.topofline > 0;
				while (nexttoken()) {
					if (tk.topofline === 1)
						tk.topofline = -1;
					if (tk.content === endc) {
						lk.type === TokenType.Comma && unexpected(tk);
						break;
					} else if (tk.type === TokenType.Identifier) {
						info.count++;
						if (la.includes(lk.content) || lk === EMPTY_TOKEN) {
							nexttoken();
							if (tk.content === ',' || tk.content === endc) {
								const tn = Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length));
								if ((_cm = comments[tn.selectionRange.start.line]) && tn.selectionRange.start.line > (lineno ??= _this.document.positionAt(beg).line))
									set_detail(tn, _cm);
								if (byref)
									byref = false, tn.pass_by_ref = tn.def = tn.assigned = true;
								cache.push(tn), bb = parser_pos, bak = tk;
								if (tk.content === ',')
									info.comma.push(tk.offset), tk.paraminfo = info;
								else break;
							} else if (tk.content === ':=' || tk.content === '=') {
								if (tk.content === '=') {
									must && stop_parse(lk);
									_this.addDiagnostic(`${diagnostic.unexpected('=')}, ${diagnostic.didyoumean(':=')}`, tk.offset, tk.length,
										{ code: DiagnosticCode.expect, data: ':=' });
								}
								const ek = tk;
								const tn = Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length));
								if ((_cm = comments[tn.selectionRange.start.line]) && tn.selectionRange.start.line > (lineno ??= _this.document.positionAt(beg).line))
									set_detail(tn, _cm);
								tn.def = true, tn.defaultVal = null, cache.push(tn);
								result.push(...parse_expression(',')), next = true;
								bb = parser_pos, bak = tk;
								if (lk !== ek) {
									tn.returns = [ek.offset + ek.length, lk.offset + lk.length];
									tn.range.end = _this.document.positionAt(lk.offset + lk.length);
									let t = tk.previous_token;
									const tt: Token[] = [];
									while (t && t !== ek && tt.unshift(t) < 3)
										t = t.previous_token;
									if (tt.length === 1)
										tt[0].content.toLowerCase() !== 'unset' && (tn.defaultVal = tt[0].content);
									else if (tt.length === 2 && '-+'.includes(tt[0].content))
										tn.defaultVal = `${tt[0].content}${tt[1].content}`;
									else tn.range_offset = [ek.offset, tk.offset], hasexpr = true;
								}
								if (byref)
									byref = false, tn.pass_by_ref = tn.assigned = true;
								if (tk.type as TokenType === TokenType.Comma) {
									info.comma.push(tk.offset);
									tk.paraminfo = info;
									continue;
								} else {
									paramsdef = tk.content === endc;
									break;
								}
							} else if (tk.type as TokenType === TokenType.Operator) {
								if (tk.content === '*') {
									const t = lk;
									nexttoken();
									if (tk.content === endc) {
										const tn = Variable.create(t.content, SymbolKind.Variable, make_range(t.offset, t.length));
										cache.push(tn), tn.arr = true, info.unknown = true, bb = parser_pos, bak = tk;
										break;
									} else { paramsdef = false, info.count--; break; }
								} else if (tk.content === '?' && tk.ignore) {
									const tn = Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length));
									tn.def = true, tn.defaultVal = null, cache.push(tn);
									if (byref)
										byref = false, tn.pass_by_ref = tn.assigned = true;
									nexttoken();
									if (tk.type as TokenType === TokenType.Comma) {
										info.comma.push(tk.offset), bb = parser_pos, bak = tk;
										continue;
									} else {
										if (!(paramsdef = tk.content === endc))
											cache.pop(), info.count--;
										break;
									}
								} else { paramsdef = false, info.count--; break; }
							} else {
								if (lk.type === TokenType.Identifier && lk.content.toLowerCase() === 'byref' && tk.type === TokenType.Identifier) {
									must && stop_parse(lk);
									_this.addDiagnostic(diagnostic.deprecated('&', 'ByRef'), lk.offset, tk.topofline ? lk.length : tk.offset - lk.offset,
										{ code: DiagnosticCode.expect, data: '&' });
									next = false, lk = EMPTY_TOKEN;
									continue;
								}
								paramsdef = false, info.count--;
								break;
							}
						} else { paramsdef = false, info.count--; break; }
					} else if (la.includes(lk.content)) {
						const t = tk;
						if (tk.content === '*') {
							let tn;
							nexttoken();
							if (tk.content === endc) {
								cache.push(tn = Variable.create('', SymbolKind.Variable, make_range(t.offset, 0)));
								tn.arr = true;
								break;
							} else unexpected(t);
						} else if (tk.content === '&') {
							tk = get_token_ignore_comment();
							if (tk.type === TokenType.Identifier) {
								byref = true, next = false; continue;
							} else unexpected(t);
						}
						paramsdef = false; break;
					} else {
						paramsdef = false; break;
					}
				}
				info.comma.forEach(o => tokens[o].paraminfo = info);
				if (paramsdef) {
					if (hasexpr)
						cache.format = format_params_default_val.bind(undefined, tokens);
					tk.previous_pair_pos = beg, pk.next_pair_pos = tk.offset;
					_this.addFoldingRange(beg, parser_pos, 'block');
					return cache;
				} else {
					const l = result.length;
					parser_pos = bb, tk = bak;
					parse_pair(endc === ')' ? '(' : '[', endc, beg, info);
					result.splice(l);
					return;
				}
			}

			function parse_prop(end?: string) {
				next = false, parser_pos = tk.offset + tk.length;
				while (nexttoken()) {
					switch (tk.type) {
						case TokenType.Operator:
							if (tk.content === '%') {
								if (end === '%')
									return next = false;
								parse_pair('%', '%');
								if (isIdentifierChar(input.charCodeAt(parser_pos)))
									break;
								return;
							}
						// fall through
						case TokenType.Number:
							if (!allIdentifierChar.test(tk.content))
								return next = false;
						// fall through
						case TokenType.Reserved:
						case TokenType.Identifier:
							tk.type = TokenType.Identifier;
							tk.semantic = { type: SemanticTokenTypes.property };
							if (input[parser_pos] === '%' && (tk.ignore = true))
								break;
							if (lk.content === '%')
								tk.ignore = true;
							return;
						default:
							return next = false;
					}
				}
			}

			function parse_obj(must = false): boolean {
				const l = lk, b = tk, rl = result.length, prev_mode = mode;
				const mark: Token[] = [], props: Record<string, AhkSymbol> = {};
				let isobj = true, k: Token | undefined, e: Token | undefined;
				block_mode = false, next = true, tk.data = OBJECT, mode |= BlockType.Pair;
				while (isobj) {
					if (!objkey() || objval()) {
						if (must && !isobj) {
							e = lk, isobj = true;
							while (!',}'.includes(tk.content))
								parse_expression('}'), next = true;
							next = true;
							_this.addDiagnostic(diagnostic.objectliteralerr(), e.offset, lk.offset + lk.length - e.offset);
							if (tk.content === ',')
								continue;
						}
						break;
					}
				}
				if (isobj || must)
					for (k of mark)
						k.type = TokenType.Identifier, k.semantic = SE_PROPERTY;
				if (!isobj) {
					lk = l, tk = b, result.splice(rl), mode = prev_mode;
					parser_pos = tk.skip_pos ?? tk.offset + tk.length;
					return next = false;
				} else if (lk.content === ':' || lk.type === TokenType.Label)
					unexpected(tk);
				if (b.data = OBJECT, tk.type === TokenType.BlockEnd) {
					begin_line = false;
					_this.addFoldingRange(tk.previous_pair_pos = b.offset, tk.offset);
					b.next_pair_pos = tk.offset;
					if (Object.keys(props).length) {
						const cls = DocumentSymbol.create('', undefined, SymbolKind.Class, ZERO_RANGE, ZERO_RANGE) as ClassNode;
						b.data = cls, cls.property = props, cls.name = cls.full = cls.extends = '';
						for (k of mark)
							((k.symbol = props[k.content.toUpperCase()]) ?? {}).parent = cls;
					}
					tk.data = b.data;
				} else
					_this.addDiagnostic(diagnostic.missing('}'), b.offset, 1);
				mode = prev_mode;
				return true;

				function objkey(): boolean {
					while (nexttoken()) {
						k = undefined;
						tk.topofline === 1 && (tk.topofline = -1);
						switch (tk.type) {
							case TokenType.Operator:
								if (tk.content === '%') {
									parse_pair('%', '%');
									if (isIdentifierChar(input.charCodeAt(parser_pos)))
										break;
									else {
										nexttoken();
										if (tk.content as string === ':')
											return true;
										return isobj = false;
									}
								}
							// fall through
							case TokenType.Number:
								if (!allIdentifierChar.test(tk.content))
									return isobj = false;
							// fall through
							case TokenType.Reserved:
							case TokenType.Identifier: {
								mark.push(tk);
								if (input[parser_pos] === '%')
									break;
								const t = lk;
								nexttoken();
								if (tk.content === ':') {
									if (t.content !== '%')
										k = lk;
									return true;
								}
								return isobj = false;
							}
							case TokenType.String:
								nexttoken();
								if (tk.content === ':') {
									k = { ...lk }, k.content = k.content.slice(1, -1), k.offset++, k.length -= 2;
									if (!h && (!lk.content.startsWith('"') || !stop_parse(lk)))
										_this.addDiagnostic(
											`${diagnostic.invalidpropname()}, ${diagnostic.didyoumean(k.content)}`,
											lk.offset, lk.length, { code: DiagnosticCode.expect, data: k.content });
									return true;
								}
								return isobj = false;
							case TokenType.Label:
								if (/^(\w|[^\x00-\x7f])+:$/.test(tk.content)) {
									k = { ...tk }, k.content = k.content.slice(0, -1), k.length--;
									return true;
								}
								return isobj = false;
							case TokenType.BlockEnd:
								if (lk.type === TokenType.BlockStart || lk.type === TokenType.Comma)
									return false;
							// fall through
							case TokenType.BracketStart:
								return isobj = false;
							case TokenType.Comma:
								if (lk.type === TokenType.Comma || lk.type === TokenType.BlockStart)
									return true;
							// fall through
							default:
								return isobj = false;
						}
					}
					return false;
				}

				function objval(): boolean {
					const colon = tk.offset;
					result.push(...parse_expression(','));
					if (k) {
						addprop(k);
						(props[k.content.toUpperCase()] ??= Variable.create(k.content, SymbolKind.Property, make_range(k.offset, k.length)))
							.returns = [colon + 1, lk.offset + lk.length];
					}
					if (tk.type === TokenType.Comma)
						return !(next = true);
					else if (tk.type === TokenType.BlockEnd)
						return next = true;
					else if (tk.type === TokenType.EOF)
						return true;
					else
						return !(isobj = false);
				}
			}

			function parse_pair(b: string, e: string, pairbeg?: number, paraminfo?: ParamInfo, strs?: Token[]) {
				let pairnum = 0, iscall = false, rl, byref;
				const pairpos = [pairbeg ??= tk.offset], rls = [result.length], _pk = tokens[pairbeg];
				const prev_mode = mode, ternarys: number[] = [];
				paraminfo ??= { offset: pairbeg, count: 0, comma: [], miss: [], unknown: false };
				if (b !== '%') {
					mode |= BlockType.Pair;
					const t = _pk.previous_token;
					_pk.paraminfo = paraminfo;
					if (paraminfo.name || !_pk.topofline && t && _pk.prefix_is_whitespace === undefined
						&& ((t.previous_pair_pos ?? t.in_expr) !== undefined || t.type === TokenType.Identifier || t.type === TokenType.Dot))
						iscall = true;
				} else _pk.op_type = -1;
				while (nexttoken()) {
					if (tk.topofline) {
						if (b === '%' && !([TokenType.Comma, TokenType.Operator, TokenType.Assign].includes(tk.type) && !/^(!|~|not)$/i.test(tk.content))) {
							stop_parse(_pk);
							_pk.next_pair_pos = -1;
							_this.addDiagnostic(diagnostic.missing('%'), pairbeg, 1);
							next = false, mode = prev_mode;
							ternaryMiss(ternarys);
							return;
						}
						if (tk.topofline === 1)
							tk.topofline = -1;
					}
					if (tk.content === e) {
						tokens[tk.previous_pair_pos = pairpos.pop() as number].next_pair_pos = tk.offset;
						if (e !== '%')
							_this.addFoldingRange(tk.previous_pair_pos as number, tk.offset + 1, 'block');
						else tk.op_type = 1;
						if ((--pairnum) < 0)
							break;
						rl = rls.pop();
					} else if (tk.content === b) {
						if (b === '(') {
							if (input[tk.offset - 1] === ')') {
								parse_pair('(', ')');
								continue;
							}
							rls.push(result.length);
						}
						pairnum++, pairpos.push(parser_pos - 1);
					} else if (tk.content === '(') {
						parse_call({ ...EMPTY_TOKEN, offset: tk.offset, ignore: true },
							'(', undefined, e, ternarys.length ? ':' : undefined);
					} else switch (tk.type) {
						case TokenType.Identifier:
							if (input[tk.offset - 1] !== '.') {
								if (input[parser_pos] !== '(') {
									if (b === '%' || (input[tk.offset - 1] !== '%' && input[tk.offset + tk.length] !== '%')) {
										const vr = addvariable(tk);
										if (vr) {
											nexttoken(), next = false;
											if (tk.type as TokenType === TokenType.Assign) {
												if ((_cm = comments[vr.selectionRange.start.line])?.offset > pairpos.at(-1)!)
													set_detail(vr, _cm);
												const equ = tk.content, bb = parser_pos;
												next = true;
												result.push(...parse_expression(e, ternarys.length ? ':' : undefined));
												vr.range.end = document.positionAt(lk.offset + lk.length);
												if (equ === ':=' || equ === '??=' && (vr.assigned ??= 1))
													vr.returns = [bb, lk.offset + lk.length];
												else vr.cached_types = [equ === '.=' ? STRING : NUMBER];
												vr.assigned ??= true, vr.def = true;
											} else if (!byref) {
												if (tk.type as TokenType === TokenType.Dot)
													byref ||= undefined;
												else !tk.topofline && ['++', '--'].includes(tk.content) && (byref = false);
											}
											if (byref) {
												if (tk.type as TokenType !== TokenType.Dot) {
													vr.assigned = vr.def = vr.pass_by_ref = true;
												} else if (ahkVersion < alpha_3 + 7)
													_this.addDiagnostic(diagnostic.requireVerN(alpha_3 + 7), lk.previous_token!.offset, 1, { code: DiagnosticCode.v_ref });
												else { tk.topofline &&= -1; continue; }
											} else if (byref === false)
												vr.def = vr.assigned = true, vr.cached_types = [NUMBER];
											else if (tk.content === '??' || tk.ignore && tk.content === '?')
												vr.returns = null;
											else if (tk.content === '=>')
												parse_func({ ...EMPTY_TOKEN, offset: lk.offset }, false,
													result.splice(-1), e, ternarys.length ? ':' : undefined);
										}
									} else tk.ignore = true;
								} else {
									if (input[tk.offset - 1] === '%' && lk.op_type === 1)
										tk.ignore = true;
									lk = tk, tk = get_next_token();
									parse_call(lk, '(', undefined, e, ternarys.length ? ':' : undefined);
								}
							} else if (input[parser_pos] === '(') {
								lk = tk, tk = get_next_token();
								parse_call(lk, '(', SymbolKind.Method);
							} else if (b !== '%' && input[parser_pos] === '%') {
								maybeclassprop(tk, null), parse_prop();
								nexttoken(), next = false;
							} else {
								addprop(tk), nexttoken(), next = false;
								if (tk.type as TokenType === TokenType.Assign) {
									ASSIGN_TYPE.includes(tk.content) && maybeclassprop(lk, undefined, () => {
										const beg = parser_pos;
										result.push(...parse_expression(e, ternarys.length ? ':' : undefined));
										return [beg, lk.offset + lk.length];
									});
								} else if (byref) {
									if (tk.type as TokenType === TokenType.Dot ||
										tk.ignore && tk.content === '?' && _this.getToken(parser_pos, true).type === TokenType.Dot)
										continue;
									else lk.__ref = true;
								}
							}
							break;
						case TokenType.BlockStart:
							if ([TokenType.Identifier, TokenType.String, TokenType.Number].includes(lk.type))
								unexpected(tk);
							else if (lk.content === ')' && lk.previous_pair_pos !== undefined) {
								tk = tokens[lk.previous_pair_pos], parser_pos = tk.offset + 1;
								lk = tk.previous_token ?? EMPTY_TOKEN, result.splice(rl!);
								parse_func({ ...EMPTY_TOKEN, offset: tk.offset }, false, undefined, e, ternarys.length ? ':' : undefined);
								continue;
							}
							parse_obj(true);
							break;
						case TokenType.String:
							strs?.push(tk);
							if (b === '[' && is_next_char(']') && !/\n|`n/.test(tk.content))
								addtext(tk.content.substring(1, tk.content.length - 1));
							break;
						case TokenType.BlockEnd:
						case TokenType.BracketEnd:
							unexpected(tk);
							pairMiss(), next = false, mode = prev_mode;
							ternaryMiss(ternarys);
							return;
						case TokenType.Reserved: {
							const c = input[parser_pos];
							if (b !== '%' && (c === '%' || input[tk.offset - 1] === '%')) {
								tk.ignore = true, tk.type = TokenType.Identifier;
								continue;
							}
							switch (_low = tk.content.toLowerCase()) {
								case 'false': case 'true':
									tk.type = TokenType.Identifier;
									if (byref !== undefined || _this.getToken(parser_pos, true).type === TokenType.Assign)
										_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset);
									else next = false;
									continue;
								case 'isset': parse_isset(c); continue;
								case 'super': parse_super(); continue;
							}
							if (ahkVersion >= alpha_3 && _low === 'throw') {
								next = false, tk.type = TokenType.Identifier;
								continue;
							}
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
							break;
						}
						case TokenType.Comma:
							if (pairnum === 0 && b !== '%') {
								++paraminfo.count;
								if (lk.type === TokenType.Comma || lk.type === TokenType.BracketStart)
									paraminfo.miss.push(paraminfo.comma.length);
								else if (!lk.ignore && lk.type === TokenType.Operator && !/(--|\+\+|%)/.test(lk.content))
									unexpected(tk);
								paraminfo.comma.push(tk.offset), iscall && (tk.paraminfo = paraminfo);
							}
							break;
						case TokenType.Operator:
							switch (tk.content) {
								case '%':
									lk.type === TokenType.Dot ? (maybeclassprop(tk, null), parse_prop(e)) : parse_pair('%', '%');
									continue;
								case ':':
									ternarys.pop() ?? unexpected(tk);
									break;
								case '?':
									if (tk.ignore) continue;
									ternarys.push(tk.offset);
									break;
								case '=>':
									if (byref !== undefined || lk.content !== ')' || lk.previous_pair_pos === undefined)
										byref = undefined, unexpected(tk);
									else {
										tk = tokens[lk.previous_pair_pos], parser_pos = tk.offset + 1;
										lk = tk.previous_token ?? EMPTY_TOKEN, result.splice(rl!);
										parse_func({ ...EMPTY_TOKEN, offset: tk.offset }, false, undefined, e, ternarys.length ? ':' : undefined);
									}
									continue;
								default:
									if (allIdentifierChar.test(tk.content) && (input[tk.offset - 1] === '%' || input[parser_pos] === '%')) {
										tk.ignore = true, tk.type = TokenType.Identifier;
										continue;
									}
							}
							if (check_operator(tk) === -1) {
								if (tk.content === '&') {
									byref = true;
									continue;
								}
								if (['++', '--'].includes(tk.content)) {
									byref = false;
									continue;
								}
							}
							break;
						case TokenType.Unknown:
							_this.addDiagnostic(diagnostic.unknown(tk.content), tk.offset, tk.length);
							break;
						default:
							if (tk.content === '[')
								parse_pair('[', ']');
							else if (tk.content === '.')
								check_operator(tk);
							else break;
							continue;
					}
					byref = undefined;
				}
				if (tk.type === TokenType.EOF && pairnum > -1)
					e === '%' && stop_parse(_pk), pairMiss();
				else
					tokens[tk.previous_pair_pos!].next_pair_pos = tk.offset;
				if (b !== '%') {
					if (lk.content === ',')
						paraminfo.miss.push(paraminfo.count++);
					else if (lk.type !== TokenType.BracketStart) {
						paraminfo.count++;
						if (lk.content === '*')
							paraminfo.unknown = true, paraminfo.count--;
					}
					paraminfo.end = tk.offset;
				}
				mode = prev_mode;
				ternaryMiss(ternarys);

				function pairMiss() {
					let o: number | undefined;
					while ((o = pairpos.pop()) !== undefined)
						_this.addDiagnostic(diagnostic.missing(e), o, 1);
				}
			}

			function parse_isset(c: string) {
				const l = result.length;
				tk.definition = ahkVars.ISSET;
				tk.ignore = true, tk.type = TokenType.Identifier;
				tk.semantic = SE_OPERATOR;
				if (c === '(') {
					const fc = tk;
					addvariable(tk);
					nexttoken(), parse_pair('(', ')');
					const pc = tokens[tk.previous_pair_pos!]?.paraminfo?.count ?? 0;
					if (pc !== 1)
						configCache.Diagnostics.ParamsCheck && _this.addDiagnostic(diagnostic.paramcounterr(1, pc), fc.offset, parser_pos - fc.offset);
					else if (result.length > l && lk.type === TokenType.Identifier) {
						const vr = result.at(-1) as Variable;
						if (lk.content === vr.name && lk.offset === _this.document.offsetAt(vr.range.start))
							vr.assigned ??= 1, vr.returns ??= null;
					}
					return true;
				}
				_this.addDiagnostic(diagnostic.missing('('), tk.offset, 5);
			}

			function parse_super() {
				if ((mode & BlockType.Mask) === BlockType.Method) {
					if (input[parser_pos] !== '(') {
						const t = _this.getToken(parser_pos, true);
						if (t.type !== TokenType.Dot && t.content !== '[' && !(t.topofline && tk.topofline))
							return _this.addDiagnostic(diagnostic.syntaxerror(tk.content), tk.offset, tk.length);
					}
					tk.type = TokenType.Identifier, next = false;
				} else
					_this.addDiagnostic(diagnostic.invalidsuper(), tk.offset, tk.length);
			}

			function ternaryMiss(ternarys: number[]) {
				let o: number | undefined;
				while ((o = ternarys.pop()) !== undefined) {
					const q = tokens[o];
					const t = tokens[q.next_token_offset] ?? EMPTY_TOKEN;
					// %a?%
					if (t.previous_pair_pos !== undefined && (q.ignore = true))
						continue;
					// a?.123
					if (input[t.offset] === '.') {
						if (ahkVersion < alpha_3 - 1)
							_this.addDiagnostic(diagnostic.requireVerN(alpha_3 - 1), o, 1, { code: DiagnosticCode.opt_chain });
						else q.ignore = true;
					} else _this.addDiagnostic(diagnostic.missing(':'), o, 1);
				}
			}

			function maybeclassprop(tk: Token, flag: boolean | null = false, parse_expr?: () => number[]) {
				if (classfullname === '')
					return;
				let rg: Range, cls: ClassNode | undefined;
				let proto = false, ts = tk.previous_token?.previous_token;
				if (!ts) return;
				if (input[ts.offset - 1] === '.' &&
					(ts.content.toLowerCase() !== 'prototype' ||
						(proto = true, !(ts = ts.previous_token?.previous_token) ||
							input[ts.offset - 1] === '.')))
					return;
				_low = ts!.content.toLowerCase();
				if (_low !== 'this' && _low !== 'super' || !(cls = get_class()) || proto && !(cls = cls.prototype) || !cls.cache)
					return;
				if (flag) {
					const pi = tk.callsite?.paraminfo;
					if (pi && tk.content.toLowerCase() === 'defineprop' && pi.count > 1 && pi.miss[0] !== 0) {
						const end = pi.comma[0], s = !!cls.prototype;
						let nk = tokens[tk.next_token_offset];
						if (input[tk.offset + tk.length] === '(')
							nk = tokens[nk.next_token_offset];
						if (nk.type !== TokenType.String || nk.next_token_offset !== end)
							cls.checkmember = false;
						else {
							const o = tokens[tokens[end].next_token_offset], prop = nk.content.slice(1, -1);
							let t: Property | FuncNode, pp, sym;
							rg = make_range(nk.offset + 1, prop.length);
							if (o.type !== TokenType.BlockStart || !(pp = (o.data as ClassNode)?.property) ||
								pp.GET || pp.VALUE || pp.SET) {
								t = Variable.create(prop, SymbolKind.Property, rg);
								t.full = `(${classfullname.slice(0, -1)}) ${((t.static = s)) ? 'static ' : ''}${prop}`;
								t.parent = cls, sym = t;
								if ((t.returns = pp?.GET?.returns))
									(t as FuncNode).eval = true;
								else t.returns = pp?.VALUE?.returns;
							}
							if ((pp = pp?.CALL)) {
								t = Variable.create('', SymbolKind.Variable, ZERO_RANGE), t.arr = true;
								t = FuncNode.create(prop, SymbolKind.Method, rg, rg, [t], undefined, s);
								t.full = `(${classfullname.slice(0, -1)}) ${((t.static = s)) ? 'static ' : ''}${t.full}`;
								t.returns = pp.returns, (t as FuncNode).eval = true;
								t.parent = cls;
								if (!sym)
									sym = t;
								else {
									sym = { ...sym, [(sym as FuncNode).eval ? 'get' : sym.returns ? 'val' : 'set']: sym };
									if (!sym.val)
										sym.call = t as FuncNode;
									else sym = t;
								}
							}
							sym && cls.cache.push(sym);
						}
					}
				} else {
					if (flag === null)
						return cls.checkmember = false, undefined;
					const t = Variable.create(tk.content, SymbolKind.Property, rg = make_range(tk.offset, tk.length));
					t.static = !!cls.prototype, cls.cache.push(t), t.def = false, t.parent = cls;
					t.returns = parse_expr?.();
					if ((_cm = comments[t.selectionRange.start.line]))
						set_detail(t, _cm);
				}
				return;

				function get_class() {
					let p = _parent;
					while (p && p.kind !== SymbolKind.Class)
						p = p.parent!;
					return p as ClassNode;
				}
			}

			function addvariable(token: Token, md: number = 0, p?: AhkSymbol[]) {
				const rg = make_range(token.offset, token.length), tn = Variable.create(token.content, SymbolKind.Variable, rg);
				token.pos = rg.start;
				if (md === 2) {
					tn.kind = SymbolKind.Property;
					addprop(token, tn);
					if (classfullname)
						tn.full = `(${classfullname.slice(0, -1)}) ${tn.name}`, token.symbol = tn;
				}
				(p ?? result).push(tn);
				return tn;
			}

			function addprop(tk: Token, v?: Variable) {
				const t = _this.object.property[tk.content.toUpperCase()] ??= [];
				tk.semantic ??= { type: SemanticTokenTypes.property };
				if (v)
					t.unshift(v);
				else t[0] ??= Variable.create(tk.content, SymbolKind.Property, make_range(tk.offset, tk.length));
			}

			function addtext(text: string) {
				_this.texts[text.toUpperCase()] = text;
			}

			function adddeclaration(node: FuncNode | ClassNode) {
				const _diags = _this.diagnostics;
				let t: Variable, lpv = false, pars: Record<string, Variable> = {};
				node.decl = node.def = true;
				if (node.kind === SymbolKind.Class) {
					const cls = node as ClassNode, dec = cls.$property!, sdec = cls.property ??= {}, children = cls.children ??= [];
					const __init = [sdec.__INIT], prototype = cls.prototype!;
					prototype.checkmember ??= cls.checkmember;
					adddeclaration(sdec.__INIT as FuncNode);
					if ((dec.__INIT as FuncNode)?.ranges?.length)
						adddeclaration(dec.__INIT as FuncNode), __init.push(dec.__INIT);
					else delete dec.__INIT;
					sdec.PROTOTYPE = {
						...prototype, children: undefined,
						name: 'Prototype', kind: SymbolKind.Property,
						full: `(${cls.full}) Prototype`,
						selectionRange: ZERO_RANGE,
						type_annotations: [cls.full]
					};
					children.forEach((it: AhkSymbol) => {
						_low = it.name.toUpperCase();
						if (META_FUNCNAME.includes(_low))
							delete (tokens[document.offsetAt(it.selectionRange.start)] ?? {}).semantic;
						if (it.children) {
							const tc = it.static || it.kind === SymbolKind.Class ? sdec : dec;
							const t = tc[_low] as Property;
							if (!t)
								tc[_low] = it;
							else if (t.kind === SymbolKind.Property && !(t.get ?? t.set)) {
								if (it.children.length || it.kind !== SymbolKind.Property)
									tc[_low] = it;
							} else {
								if (t.kind !== it.kind && ![it.kind, t.kind].includes(SymbolKind.Class)) {
									let method;
									const prop: Property = t.kind === SymbolKind.Property ? (method = it, t) : (method = t, it);
									if (!prop.call)
										return (prop.call = method as FuncNode, tc[_low] = prop);
								}
								_diags.push({ message: diagnostic.dupdeclaration(), range: it.selectionRange });
							}
						}
					});
					children.forEach((it: Variable) => {
						if (it.children) return;
						const tc = it.static ? sdec : dec;
						if (!(t = tc[_low = it.name.toUpperCase()]))
							return it.def === false || (tc[_low] = it);
						if (t.typed === true && (it.typed || !it.children && (t.typed = 1)))
							return;
						if (t.children && (!it.typed || it.range.start.line < t.range.start.line)) {
							const _ = t as Property;
							if (!_.val) return _.val = it;
						}
						if (it.def !== false)
							_diags.push({ message: diagnostic.dupdeclaration(), range: it.selectionRange });
					});
					children.push(...__init, ...cls.cache ?? [], ...cls.prototype!.cache ?? []);
					cls.cache?.forEach(it => sdec[it.name.toUpperCase()] ??= it);
					cls.prototype!.cache?.forEach(it => dec[it.name.toUpperCase()] ??= it);
					delete cls.cache;
					delete cls.prototype!.cache;
				} else {
					const fn = node as FuncNode, has_this_param = fn.has_this_param;
					const dec = fn.declaration, local = fn.local ?? {}, global = fn.global ?? {};
					let vars: Record<string, Variable> = {}, unresolved_vars: Record<string, Variable> = {}, vr: Variable;
					let named_params: Variable[] | undefined = [];
					if (has_this_param) {
						pars.THIS = dec.THIS = THIS;
						pars.SUPER = dec.SUPER = SUPER;
						if (fn.kind === SymbolKind.Function)
							named_params = undefined;
					}
					for (const it of fn.params ?? []) {
						it.decl = it.def = it.assigned = it.is_param = true;
						if (!it.name)
							continue;
						named_params?.push(it);
						if (it.defaultVal !== undefined || it.arr)
							lpv = true;
						else lpv && ahkVersion < alpha_11 + 7 && _diags.push({
							message: diagnostic.defaultvalmissing(it.name),
							range: it.selectionRange
						});
						if ((t = pars[_low = it.name.toUpperCase()]))
							_diags.push({
								message: diagnostic.conflictserr('parameter', 'parameter', t.name),
								range: it.selectionRange
							});
						else pars[_low] = dec[_low] = vars[_low] = it;
					}
					for (const [k, v] of Object.entries(local)) {
						if ((t = pars[k]))
							_diags.push({
								message: diagnostic.conflictserr(v.static ? 'static' : 'local', 'parameter', t.name),
								range: v.selectionRange
							});
						else dec[k] = v, v.assigned ||= Boolean(v.returns);
					}
					for (const [k, v] of Object.entries(global)) {
						if ((t = dec[k])) {
							if (pars[k]) {
								_diags.push({
									message: diagnostic.conflictserr('global', 'parameter', t.name),
									range: v.selectionRange
								});
								continue;
							}
							const varsp = v.static ? 'static' : 'local';
							_diags.push({
								message: diagnostic.conflictserr(...(
									t.selectionRange.start.line < v.selectionRange.start.line ?
										(t = v, ['global', varsp]) : [varsp, 'global']
								), t.name),
								range: t.selectionRange
							});
							if (v !== t) continue;
							delete local[k];
						}
						dec[k] ??= v;
						_this.declaration[k] ??= v;
						v.assigned ||= Boolean(v.returns);
						v.is_global = true;
					}
					for (const it of fn.children ??= []) {
						_low = it.name.toUpperCase();
						if (it.kind === SymbolKind.Function) {
							const _f = it as FuncNode;
							if (!_f.static)
								_f.closure = true;
							if (!_low)
								continue;
							if (dec[_low]) {
								if ((t = pars[_low])) {
									_diags.push({
										message: diagnostic.conflictserr('function', 'parameter', t.name),
										range: it.selectionRange
									});
									continue;
								} else if ((t = global[_low])) {
									_diags.push({
										message: diagnostic.conflictserr(...(
											t.selectionRange.start.line < it.selectionRange.start.line ||
												t.selectionRange.start.line === it.selectionRange.start.line &&
												t.selectionRange.start.character < it.selectionRange.start.character ?
												(t = it, ['function', 'global']) : ['global', 'function']
										), t.name),
										range: t.selectionRange
									});
									if (it === t) continue;
									delete global[_low];
									delete t.is_global;
									if (_this.declaration[_low] === t)
										delete _this.declaration[_low];
								} else if ((t = local[_low])) {
									if (t.selectionRange.start.line < it.selectionRange.start.line ||
										t.selectionRange.start.line === it.selectionRange.start.line &&
										t.selectionRange.start.character < it.selectionRange.start.character) {
										_diags.push({
											message: diagnostic.conflictserr('function',
												t.kind === SymbolKind.Function ? 'Func' : t.static ? 'static' : 'local', it.name),
											range: it.selectionRange
										});
										continue;
									} else if (t.static)
										_diags.push({
											message: diagnostic.conflictserr(t.kind === SymbolKind.Function ? 'function' : 'static',
												it.kind === SymbolKind.Function ? 'Func' : 'static', t.name),
											range: t.selectionRange
										});
								}
							}
							dec[_low] = local[_low] = it;
						} else if (it.kind === SymbolKind.Variable)
							((vr = it as Variable).def ? vars : unresolved_vars)[_low] ??= (vr.assigned ||= Boolean(vr.returns), it);
					}
					fn.children.unshift(...named_params ?? []);
					if ((fn.parent as FuncNode)?.assume === FuncScope.GLOBAL)
						fn.assume ??= FuncScope.GLOBAL;
					if (fn.assume === FuncScope.GLOBAL) {
						for (const [k, v] of Object.entries(Object.assign(unresolved_vars, vars))) {
							if (!(t = dec[k]))
								_this.declaration[k] ??= global[k] = v, v.is_global = true;
							else if (t.kind === SymbolKind.Function && v.def)
								v.assigned !== 1 && _diags.push({ message: diagnostic.assignerr('Func', t.name), range: v.selectionRange });
							else if (t.kind === SymbolKind.Variable && v.def && v.kind === t.kind)
								t.def = true, t.assigned ||= Boolean(v.returns);
						}
						unresolved_vars = {};
					} else if (fn.static !== null) {
						const assme_static = fn.assume === FuncScope.STATIC;
						const is_outer = fn.kind !== SymbolKind.Function || !fn.parent;
						for (const [k, v] of Object.entries(vars)) {
							delete unresolved_vars[k];
							if (!(t = dec[k])) {
								if (dec[k] = v, is_outer)
									local[k] = v, v.static = assme_static;
								else if (assme_static)
									v.static = null;
							} else if (t.kind === SymbolKind.Function)
								v.assigned !== 1 && _diags.push({ message: diagnostic.assignerr('Func', t.name), range: v.selectionRange });
							else if (t.kind === SymbolKind.Variable && v.def && v.kind === t.kind)
								t.def = true, t.assigned ||= Boolean(v.returns);
						}
					} else {
						for (const [k, v] of Object.entries(Object.assign(unresolved_vars, vars))) {
							if (!(t = dec[k])) {
								(dec[k] = v).has_warned = true;
							} else if (v.def && v.assigned !== 1 && t.kind === SymbolKind.Function)
								_diags.push({ message: diagnostic.assignerr('Func', t.name), range: v.selectionRange });
						}
						unresolved_vars = {};
					}
					vars = unresolved_vars, unresolved_vars = {};
					for (const k in vars)
						if (!dec[k]) (unresolved_vars[k] = vars[k]).def = false;
					fn.unresolved_vars = unresolved_vars;
					for (const v of Object.values(local))
						v.def = true;
					pars = Object.assign(local, pars);
					if (has_this_param)
						delete pars.THIS, delete pars.SUPER, delete dec.THIS, delete dec.SUPER;
					for (const k of Object.keys(dec))
						if (k.substring(0, 2) === 'A_' && ahkVars[k]) {
							if (!(vr = dec[k]).decl)
								delete dec[k], delete local[k];
							else _diags.push({
								message: diagnostic.conflictserr(
									(vr as FuncNode).params ? 'function' : vr.is_param ? 'parameter' : 'variable',
									'built-in variable', vr.name),
								range: vr.selectionRange
							});
						}
				}
			}

			function nexttoken() {
				if (next) return lk = tk, next = (tk = get_token_ignore_comment()).type !== TokenType.EOF;
				else return next = tk.type !== TokenType.EOF;
			}
		}

		function set_extends(tn: ClassNode, str: string) {
			tn.extends = (str = str.trim()).replace(/^(.+[\\/])?/, m => {
				if ((m = m.slice(0, -1))) {
					let u: URI;
					m = m.replaceAll('\\', '/').toLowerCase();
					if (!m.endsWith('.ahk'))
						m += '.d.ahk';
					if (m.startsWith('~/'))
						u = process.env.BROWSER ? URI.parse(rootDir + m.slice(1)) : URI.file(rootDir + m.slice(1));
					else if (/^([a-z]:)?\//.test(m))
						u = URI.file(m);
					else if (!m.includes(':')) {
						const t = (uri.path + '/../' + m).split('/'), arr: string[] = [];
						t.shift();
						for (const s of t) {
							if (s !== '..')
								arr.push(s);
							else if (!arr.pop())
								return '';
						}
						u = uri.with({ path: arr.join('/') });
					} else u = URI.parse(m);
					tn.extendsuri = u.toString().toLowerCase();
				}
				return '';
			});
			if (!tn.extendsuri && tn.extends.startsWith('#'))
				tn.extendsuri = ahkVars[(tn.extends = tn.extends.substring(1)).toUpperCase()]?.uri ?? ahkUris.ahk2;
		}

		function resolve_scriptdir(path: string) {
			return path.replace(/%a_(\w+)%/gi, (s, s1: string) => {
				s1 = s1.toLowerCase();
				if (s1 === 'linefile')
					return _this.fsPath;
				if ('scriptdir,initialworkingdir'.includes(s1))
					return _this.need_scriptdir = true, _this.scriptdir;
				if ('scriptname,icontip'.includes(s1))
					return basename(_this.fsPath);
				return s;
			});
		}

		function add_include_dllload(text: string, tk?: Token, mode = 0, isdll = false) {
			let m, ignore = false;
			const q = text[0];
			if (`'"`.includes(q) && text.endsWith(q))
				text = text.slice(1, -1);
			if ((m = text.match(/^(\*[iI][ \t])?(.*)$/))) {
				ignore = Boolean(m[1]);
				m = resolve_scriptdir(m[2]);
				if (tk)
					_this[isdll ? 'dlldir' : 'includedir'].set(
						(tk.pos ??= _this.document.positionAt(tk.offset)).line, isdll ? dlldir : includedir);
				if (!m.trim()) {
					if (isdll)
						dlldir = '';
					else if (tk)
						_this.addDiagnostic(diagnostic.pathinvalid(), tk.offset, tk.length, { code: DiagnosticCode.include });
				} else if (!process.env.BROWSER) {
					if (isdll) {
						if (existsSync(m) && statSync(m).isDirectory())
							dlldir = m.endsWith('/') || m.endsWith('\\') ? m : m + '\\';
						else {
							if (!/\.\w+$/.test(m))
								m = m + '.dll';
							m = findLibrary(m, [], dlldir || _this.scriptpath, true)?.path ?? m;
							if (m.includes(':'))
								_this.dllpaths.push(m.replaceAll('\\', '/'));
							else _this.dllpaths.push((dlldir && existsSync(dlldir + m) ? dlldir + m : m).replace(/\\/g, '/'));
						}
					} else {
						const islib = m.startsWith('<');
						if (tk) {
							if (m.startsWith('*')) {
								const rs = utils.getRCData?.(tk.content.substring(1));
								if (rs)
									includetable[rs.uri] = rs.path, tk.data = [undefined, rs.uri];
								else if (!ignore)
									_this.addDiagnostic(diagnostic.resourcenotfound(), tk.offset, tk.length,
										{ code: DiagnosticCode.include, severity: DiagnosticSeverity.Warning });
								return;
							} else if (!(m = findLibrary(m, _this.libdirs, includedir)) || !existsSync(m.path)) {
								if (!ignore)
									_this.addDiagnostic(m ? diagnostic.filenotexist(m.path) : diagnostic.pathinvalid(), tk.offset, tk.length,
										{ code: 'include', data: m?.path });
							} else if (statSync(m.path).isDirectory())
								_this.includedir.set(tk.pos!.line, includedir = m.path);
							else
								includetable[m.uri] = m.path, tk.data = [m.path, m.uri];
							if (mode & BlockType.Mask) _this.addDiagnostic(diagnostic.unsupportinclude(), tk.offset, tk.length,
								{ code: DiagnosticCode.include, severity: DiagnosticSeverity.Warning });
						} else if ((m = find_d_ahk(m)))
							includetable[m.uri] = m.path;
						_this.need_scriptdir ||= islib && (!m || m.path.toLowerCase().startsWith(_this.libdirs[0].toLowerCase()));
					}
				}
			} else if (text && tk)
				_this.addDiagnostic(diagnostic.pathinvalid(), tk.offset, tk.length, { code: DiagnosticCode.include });
		}

		function find_d_ahk(path: string) {
			if (path.startsWith('<'))
				path = path.replace(/(\.d)?>$/i, '.d>');
			else path = path.replace(/(\.d\.ahk)?$/i, '.d.ahk');
			const m = findLibrary(path,
				_this.libdirs, _this.scriptpath, true,
				{ ...a_Vars, locale });
			if (m && !statSync(m.path).isDirectory())
				return m;
		}

		function join_markdown(s1: string, s2: string) {
			if (s2)
				return (s1 && (s1 + '\n\n')) + s2;
			return s1;
		}
		function set_detail(sym: AhkSymbol, cm: Token) {
			const comment = cm.content;
			if (comment.startsWith(';')) {
				sym.detail = (cm.data as string) ??= comment.replace(/^[ \t]*; ?/gm, '');
				return;
			}
			if (!/^\/\*\*(?!\/)/.test(comment)) {
				sym.detail = (cm.data as string) ??= comment.replace(
					new RegExp(`^${input.substring(input.lastIndexOf('\n', cm.offset) + 1, cm.offset)}`, 'gm'), '')
					.replace(/^\/\*\s*\n|\s*\*+\/$/g, '');
				return;
			}
			if (!cm.data)
				cm.data = parse_jsdoc_detail(_this, comment, sym);
			else {
				const { detail, ignore, tags, vars } = cm.data as JsDoc;
				const v = vars && (vars[sym.name.toUpperCase()] ?? vars['']);
				if (ignore) sym.ignore = ignore;
				if (tags) sym.tags = tags as typeof sym.tags;
				sym.markdown_detail = join_markdown(v?.detail ?? '', detail);
				if (v)
					sym.type_annotations = v.type_annotations ??= resolveTypeAnnotation(v.type_str);
			}
		}

		interface JsDoc {
			detail: string
			ignore?: boolean
			tags?: number[]
			vars?: {
				[name: string]: {
					detail: string,
					type_annotations?: (string | AhkSymbol)[] | false,
					type_str?: string
				}
			}
		}

		function parse_jsdoc_detail(lex: Lexer, detail: string, sym: AhkSymbol): JsDoc {
			sym.detail = detail;
			detail = detail.replace(/^[ \t]*(\*?[ \t]*(?=@)|\* ?)/gm, '')
				.replace(/^\/\*+\s*|\s*\**\/$/g, '');
			if (!detail)
				return { detail: sym.markdown_detail = sym.detail = '' };
			const details: string[] = [], ols: string[] = [];
			let vars: {
				[n: string]: {
					detail: string,
					type_annotations?: (string | AhkSymbol)[] | false,
					type_str?: string
				}
			} | undefined, tp = '', t;
			const fn = sym as FuncNode, objs: Record<string, ClassNode> = {}, params: Record<string, Variable> = {};
			let get_param = (_: string) => undefined as Variable | undefined;
			let m: RegExpMatchArray | null, vr: Variable | undefined, obj: ClassNode | undefined;
			const kind = ({ [SymbolKind.Variable]: 'var', [SymbolKind.Property]: 'prop' } as Record<number, string>)[sym.kind];
			if (fn.params) {
				const _params = fn.params;
				get_param = (name: string) => {
					if (/^d/.test(name))
						return;
					return params[name] ??= _params.find(it => name === it.name.toUpperCase() && !(it.markdown_detail = '')) ??
						((fn.overload_params ??= {})[name] = { type_annotations: false, markdown_detail: '' } as Variable);
				};
			}
			for (let line of detail.split(/\n(?=@)/)) {
				if (!(m = line.match(/^@(\w*)/))) {
					details.push(line);
					continue;
				}
				t = m[1].toLowerCase(), line = line.substring(t.length + 1);
				obj && !t.startsWith('prop') && (obj = undefined);
				switch (t) {
					case 'arg':
					case 'argument':
						t = 'param';
					// fall through
					case 'param':
					case 'prop':
					case 'property':
					case 'var':
						line = parse_type(line);
						if ((m = line.match(/^\s*(\[(\w|[^\x00-\x7f]|(\[\])?\.)*.*?\]|(\w|[^\x00-\x7f]|(\[\])?\.)*)/))) {
							let defval = '', name = m[1] ??= '', opt = false;
							const _name = () => opt ? `<u>\`${name}\`</u>` : `\`${name}\``;
							line = line.substring(m[0].length);
							if (name.startsWith('['))
								name.slice(1, -1).replace(/^((\w|[^\x00-\x7f]|(\[\])?\.)*)(.*)$/, (...t) => {
									if ((name = t[4].trimStart()).startsWith('='))
										defval = name.substring(1).trim();
									return name = t[1];
								}), opt = true;
							if (t === 'param') {
								vr = get_param(name.replace(/(\[\])?\..*$/, '').toUpperCase());
								if (vr?.name?.length === name.length) {
									opt = vr.defaultVal !== undefined;
									vr.type_annotations ??= resolveTypeAnnotation(tp);
								} else if (vr?.name) {
									const t = name.split('.');
									add_prop(add_obj_type(vr, t.shift()!), t, tp,
										`*@param* ${_name()}${tp && `: *\`${tp}\`*`}${line.trim() && `\n___\n${line}`}`);
									if (!vr.markdown_detail)
										vr = undefined;
								}
								t = `*@param* ${_name()}${tp && `: *\`${tp}\`*`}${defval && ` := \`${defval}\``}${join_detail(line)}`;
								details.push(t), vr && (vr.markdown_detail += `${t}\n\n`);
								continue;
							} else if (t.startsWith('prop')) {
								t = 'property'
								obj ??= objs[''] ??= create_obj();
								add_prop(add_obj_type(obj, obj.name), name.split('.'), tp,
									`*@${t}* ${_name()}${tp && `: *\`${tp}\`*`}${defval && ` := \`${defval}\``}${line.trim() && `\n___\n${line}`}`);
							} else if (kind === 'var') {
								line = line.trimStart();
								if (sym.name.toLowerCase() === name.toLowerCase()) {
									sym.type_annotations ??= resolveTypeAnnotation(tp);
									(vars ??= {})[name.toUpperCase()] ??= {
										detail: line,
										type_annotations: sym.type_annotations
									};
									sym.markdown_detail ??= line;
								} else (vars ??= {})[name.toUpperCase()] ??= {
									detail: line, type_str: tp
								};
								continue;
							}
							line = join_detail(line);
							details.push(t = `*@${t}* \`${name}\`${tp && `: *\`${tp}\`*`}${defval && ` := \`${defval}\``}${line}`);
						}
						continue;
					case 'return':
					case 'returns':
					case 'type':
						line = parse_type(line);
						details.push(`*@${t}*${tp && ` *\`${tp}\`*`}${join_detail(line)}`);
						if (!kind || (sym as Property).get) {
							if (kind || t !== 'type')
								sym.type_annotations ??= resolveTypeAnnotation(tp);
						} else if (t === 'type') {
							(vars ??= {})[''] ??= {
								detail: line,
								type_annotations: resolveTypeAnnotation(tp)
							};
							details.pop();
						}
						continue;
					case 'enum':
					case 'throws':
						line = parse_type(line);
						details.push(`*@${t}*${tp && ` *\`${tp}\`*`}${join_detail(line)}`);
						continue;
					case 'typedef':
						line = parse_type(line);
						m = line.match(/^\s*(\$?(\w|[^\x00-\x7f])*)/)!;
						if ((t = m[1]))
							lex.typedef[t.toUpperCase()] ??= obj = {
								name: t, kind: SymbolKind.TypeParameter,
								range: ZERO_RANGE, selectionRange: ZERO_RANGE,
								type_annotations: resolveTypeAnnotation(tp)
							} as ClassNode;
						details.push(`*@typedef* \`${t}\`: *\`${tp || 'Any'}\`*${join_detail(line.substring(m[0].length))}`);
						continue;
					case 'overload':
						if (!(m = line.match(/^\s*(\w|[^\x00-\x7f])*(?=[([])/)))
							break;
						ols.push(`${sym.name || '_'}${line.substring(m[0].length).trimEnd()}`);
						continue;
					case 'example':
						details.push('*@example*');
						if ((line = line.replace(/^\s*<caption>(.*?)<\/caption>/, (s0, s1) => (details.push(s1), '')).replace(/^[ \t\r\n]+/, '')))
							details.push('```ahk2\n' + line + '\n```');
						continue;
					case 'extends':
						t = '*@extends* ';
						if ((m = line.match(/^\s*{([^{}]+)}/))) {
							if (sym.kind === SymbolKind.Class)
								set_extends(sym as ClassNode, m[1]);
							t += `\`${m[1]}\``, line = line.substring(m[0].length);
						}
						details.push(`${t}${join_detail(line)}`);
						continue;
					case 'ignore': sym.ignore = true; break;
					case 'deprecated': sym.tags ??= [1]; break;
					case 'since':
						if (!process.env.BROWSER && (_this.d & 2) && !versionMatch(line = line.trim()))
							sym.since = line || 'unknown';
						break;
					case 'alias':
						if (sym.kind === SymbolKind.Class && (tp = line.trim()).endsWith('>') && tp.startsWith(sym.name + '<')) {
							const lex = new Lexer(TextDocument.create('', 'ahk2', 0, `class ${tp}{\n}`), undefined, 1);
							lex.parseScript();
							const params = (lex.declaration[sym.name.toUpperCase()] as ClassNode)?.type_params;;
							if (params) {
								(sym as ClassNode).type_params = params;
								Object.values(params).forEach(it => it.range = it.selectionRange = ZERO_RANGE);
							}
						}
						break;
				}
				details.push(`*@${t}*${join_detail(line)}`);
			}
			if (kind) {
				let tt = vars?.['']?.type_annotations;
				if (!tt && (t = objs['']))
					((vars ??= {})[''] ??= { detail: '' }).type_annotations = tt = [t];
				sym.type_annotations ??= tt;
			} else if (fn.params && (t = ols.join('\n')))
				(sym as FuncNode).overloads = t;
			detail = details.join('\n\n');
			sym.markdown_detail = join_markdown(sym.markdown_detail ?? '', detail);
			return { detail, ignore: sym.ignore, tags: sym.tags, vars };
			function join_detail(str: string) {
				str = str.replace(/^[ \t]*[-—]/, '');
				let n = 0, ln = 0, i = 0;
				for (let c of str) {
					switch (i++, c) {
						case '\n':
							if (n > 1 || ++ln === 2)
								return str;
						// fall through
						case '\t': n = 0; break;
						case ' ': n++; break;
						case '\r': break;
						default:
							if (ln) {
								let newline = false;
								if (c === '|' || c === '>' ||
									'-+*'.includes(c) && ' \t'.includes(str[i]) ||
									str.substring(i - 1, i + 2) === '```')
									newline = true;
								else if (c === '#') {
									for (; str[i] === '#'; i++);
									newline = ' \t'.includes(str[i]);
								} else if (c !== '.') {
									for (; c >= '0' && c <= '9'; c = str[i++]);
									newline = c === '.' && ' \t'.includes(str[i]);
								}
								if (newline)
									return `\n${str}`;
							}
							return ` — ${str}`;
					}
				}
				return '';
			}
			function create_obj(name = ''): ClassNode {
				return {
					kind: SymbolKind.Class, name, full: '', extends: '', uri: '',
					property: {}, range: ZERO_RANGE, selectionRange: ZERO_RANGE
				};
			}
			function remove_types(tps: (string | AhkSymbol)[], remove: AhkSymbol[], add?: ClassNode) {
				for (let i = tps.length - 1; i >= 0; i--)
					remove.includes(tps[i] as AhkSymbol) && tps.splice(i, 1);
				add && tps.push(add);
				return add;
			}
			function add_obj_type(sym: AhkSymbol, name: string): ClassNode {
				const is_arr = name.endsWith(']') && (name = name.slice(0, -2), true);
				const o = objs[name = name.toUpperCase()] ??= remove_types(
					sym.type_annotations ||= [], [OBJECT], create_obj(sym.name))!;
				if (is_arr)
					return objs[`${name}[]`] ??= (o.extends ||= 'Array',
						remove_types(sym.type_annotations || [], [ARRAY]),
						remove_types((o.generic_types ??= [])[0] ??= [], [OBJECT], create_obj())!);
				return o;
			}
			function add_prop(obj: ClassNode, props: string[], tp: string, detail: string) {
				let full = obj.name.toUpperCase(), l = props.length;
				for (let name of props) {
					let is_arr = 0, u: string;
					while (name.endsWith(']'))
						name = name.slice(0, -2), is_arr++;
					full += `.${u = name.toUpperCase()}`, l--;
					obj = objs[full] ??= (obj.property[u] ??= {
						kind: SymbolKind.Property, name,
						range: ZERO_RANGE, selectionRange: ZERO_RANGE
					}) as ClassNode;
					if (is_arr || l) {
						do {
							obj = objs[full + '.'] ??= remove_types(
								obj.type_annotations ||= [], [OBJECT], create_obj())!;
							if (is_arr) {
								obj = objs[full += '[]'] ??= (obj.extends ||= 'Array', remove_types(
									(obj.generic_types ??= [])[0] ??= [],
									is_arr > 1 ? [OBJECT, ARRAY] : [OBJECT], create_obj())!);
								is_arr--;
							}
						} while (is_arr);
					}
				}
				if (!obj.property) {
					obj.markdown_detail ??= detail;
					obj.type_annotations ??= resolveTypeAnnotation(tp);
				}
			}
			function parse_type(str: string) {
				const m = str.match(/^\s*\{/);
				tp = '';
				if (!m) return str;
				let n = 1, i = m[0].length;
				const b = i;
				while (n) {
					switch (str[i++]) {
						case '{': n++; continue;
						case '}': n--; continue;
						case undefined: return str;
						case '"':
						case "'": {
							const q = str[i - 1];
							let c: string;
							while ((c = str[i++]) !== q) {
								if (c === '`')
									i++;
								else if (!c || c === '\n')
									return str;
							}
							break;
						}
					}
				}
				tp = str.substring(b, i - 1).trim();
				return str.substring(i);
			}
		}

		function make_range(offset: number, length: number): Range {
			return Range.create(_this.document.positionAt(offset), _this.document.positionAt(offset + length));
		}

		function createToken(content: string, type: TokenType, offset: number, length: number, topofline: number): Token {
			const c = input.charAt(offset - 1);
			const tk: Token = { content, type, offset, length, topofline, previous_token: lst, next_token_offset: -1, prefix_is_whitespace: WHITESPACE.includes(c) ? c : undefined };
			_this.tokens[offset] = tk;
			lst.next_token_offset = offset;
			return tk;
		}

		function create_flags(flags_base: Flag | undefined, mode: Mode) {
			let indentation_level = 0, had_comment = 0, ternary_depth;
			let last_text = '', last_word = '', array_style, object_style;
			let in_expression = [Mode.ArrayLiteral, Mode.Expression, Mode.ObjectLiteral].includes(mode);
			if (flags_base) {
				indentation_level = flags_base.indentation_level;
				had_comment = flags_base.had_comment;
				last_text = flags_base.last_text;
				last_word = flags_base.last_word;
				in_expression ||= flags_base.in_expression;
				array_style = flags_base.array_style;
				object_style = flags_base.object_style;
			}

			const next_flags: Flag = {
				array_style,
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
				object_style,
				parent: flags_base!,
				start_line_index: output_lines.length,
				ternary_depth,
				try_block: false
			};
			return next_flags;
		}

		// Using object instead of string to allow for later expansion of info about each line
		function create_output_line() {
			return { text: [], indent: 0 };
		}

		function trim_newlines() {
			if (continuation_sections_mode !== false)
				return;
			let line = output_lines.pop();
			while (line?.text.length === 0)
				line = output_lines.pop();
			line && output_lines.push(line);
			flags.had_comment && output_lines.push(create_output_line());
		}

		function just_added_newline(): boolean {
			const line = output_lines.at(-1)!;
			return line.text.length === 0;
		}

		function allow_wrap_or_preserved_newline(force_linewrap = false): void {
			if (opt.wrap_line_length && !force_linewrap) {
				const line = output_lines.at(-1)!;
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

		function print_newline(preserve_statement_flags: boolean | null = false): void {
			if (!preserve_statement_flags) {
				if (preserve_statement_flags === null || !isContinuousLine(ck.previous_token ?? EMPTY_TOKEN, EMPTY_TOKEN)) {
					// while (flags.mode === MODE.Statement && (flags.declaration_statement || !flags.if_block && !flags.loop_block && !flags.try_block))
					// 	restore_mode();
					while (flags.mode === Mode.Statement)
						restore_mode();
					flags.if_block = flags.try_block = flags.catch_block = false, flags.loop_block = 0;
				}
			}

			if (!just_added_newline())
				output_lines.push(create_output_line());
		}

		function print_token(printable_token?: string): void {
			const line = output_lines.at(-1)!;
			if (!line.text.length) {
				if (preindent_string)
					line.text.push(preindent_string);
				flags.indentation_level = print_indent_string(flags.indentation_level);
			} else if (output_space_before_token)
				line.text.push(' ');
			output_space_before_token = undefined;
			line.text.push(printable_token ?? token_text);

			function print_indent_string(level: number) {
				if (level) {
					for (let i = output_lines.length - 2; i >= 0; i--)
						if (output_lines[i].text.length) {
							level = Math.min(output_lines[i].indent + 1, level);
							break;
						}
					line.text.push(indent_string.repeat(line.indent = level));
				}
				return level;
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

		function set_mode(mode: Mode): void {
			if (flags) {
				flag_store.push(flags);
				previous_flags = flags;
			} else {
				previous_flags = create_flags(undefined, mode);
			}

			flags = create_flags(previous_flags, mode);
		}

		function restore_mode(): void {
			if (flag_store.length > 0) {
				previous_flags = flags;
				flags = flag_store.pop()!;
			}
		}

		function start_of_object_property(): boolean {
			return flags.parent.mode === Mode.ObjectLiteral && flags.mode === Mode.Statement &&
				flags.last_text === ':' && !flags.ternary_depth;
		}

		function start_of_statement(): boolean {
			if ((last_type === TokenType.Reserved && ['try', 'else', 'finally'].includes(flags.last_text)) ||
				(last_type === TokenType.BracketEnd && previous_flags.mode === Mode.Conditional) ||
				(last_type === TokenType.Identifier && flags.mode === Mode.BlockStatement && (
					(!input_wanted_newline && ck.previous_token?.callsite) ||
					!flags.in_case && ![TokenType.Identifier, TokenType.Reserved, TokenType.BracketStart].includes(token_type) && !['--', '++', '%'].includes(token_text)
				)) || (flags.declaration_statement && (!n_newlines || isContinuousLine(ck.previous_token ?? EMPTY_TOKEN, ck))) ||
				(flags.mode === Mode.ObjectLiteral && flags.last_text === ':' && !flags.ternary_depth)) {

				set_mode(Mode.Statement);
				indent();

				switch (flags.last_word) {
					case 'if':
					case 'for':
					case 'loop':
					case 'while':
					case 'catch':
						print_newline(true);
					// fall through
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

		function is_special_word(word: string): boolean {
			return ['break', 'continue', 'global', 'goto', 'local', 'return', 'static', 'throw'].includes(word);
		}

		function is_next_char(find_char: string) {
			let local_pos = parser_pos, c = input[local_pos];
			while (c !== find_char && WHITESPACE.includes(c) && ++local_pos < input_length)
				c = input[local_pos];
			return c === find_char ? local_pos : 0;
		}

		function get_token_ignore_comment(depth = 0): Token {
			let tk: Token;
			do { tk = get_next_token(depth); } while (tk.type & TokenType.Comment);
			return tk;
		}

		function get_next_token(depth = 0): Token {
			let resulting_string: string, line, c, m, i, bg = 0;
			const _ppos = parser_pos;
			n_newlines = 0;

			while (WHITESPACE.includes(c = input[parser_pos++])) {
				if (c === '\n')
					last_LF = parser_pos - 1, n_newlines += 1, begin_line = true;
			}
			if (!c) {
				add_comment_foldingrange(), add_sharp_foldingrange();
				return _this.tokens[-1] ??= {
					content: '', type: TokenType.EOF, offset: input_length, length: 0,
					topofline: isContinuousLine(lst, EMPTY_TOKEN) ? -1 : 1,
					next_token_offset: -1, previous_token: lst
				};
			}

			let offset = parser_pos - 1, _tk = _this.tokens[offset];
			if (_tk && _tk.length) {
				let next = false;
				if ((begin_line = Boolean(_tk.topofline && (_tk.type & TokenType.BlockStart))))
					last_LF = offset;
				parser_pos = _tk.skip_pos ?? offset + _tk.length;
				if ((lst = _tk, _tk.ignore)) {
					if (_tk.type === TokenType.BracketStart) {
						continuation_sections_mode = true;
						next = !format_mode;
					} else if (_tk.type === TokenType.BracketEnd) {
						continuation_sections_mode = null;
						next = !format_mode;
					} else if (_tk.type & TokenType.Comment)
						lst = _tk.previous_token ?? EMPTY_TOKEN;
				} else if (_tk.type & TokenType.Comment)
					lst = _tk.previous_token ?? EMPTY_TOKEN;
				if (!format_mode) {
					const extra = _tk.previous_extra_tokens, t = _tk;
					if (extra) {
						if (_ppos < offset)
							extra.i = 0;
						if (extra.i < extra.len) {
							_tk = extra.tokens[extra.i++], parser_pos = offset;
						} else extra.i = 0;
					}
					if (next && t === _tk)
						return get_next_token();
				}
				return _tk;
			}
			if (begin_line) {
				begin_line = false, bg = 1;
				let next_LF = input.indexOf('\n', parser_pos);
				if (next_LF < 0)
					next_LF = input_length;
				line = input.substring(offset, next_LF).replace(/((^|[ \t]+)(;.*)?)?\r?$/, '');
				if (line.includes('::') && (block_mode || !'"\''.includes(line[0]) ||
					![TokenType.Assign, TokenType.Comma, TokenType.BracketStart].includes(lst.type))) {
					if ((m = line.match(/^(:([^:]*):(`.|[^`])*?::)(.*)$/i))) {
						let execute: boolean;
						if ((execute = /x(?!0)/i.test(m[2])) || /^[ \t]*\{?$/.test(m[4]) || (execute = _this.hotstringExecuteAction && !/x0/i.test(m[2])))
							parser_pos += m[1].length - 1, lst = createToken(m[1], TokenType.Hotkey, offset, m[1].length, 1);
						else {
							last_LF = next_LF, parser_pos = offset + m[0].length;
							lst = createToken(m[1], TokenType.HotkeyLine, offset, m[1].length, 1), offset += m[1].length;
							lst.skip_pos = parser_pos;
							_this.tokens[offset] = {
								...lst.data = { content: input.substring(offset, parser_pos), offset, length: parser_pos - offset },
								type: TokenType.Text, previous_token: lst, next_token_offset: -1, topofline: 0
							};
							_this.token_ranges.push({ start: offset, end: parser_pos, type: 3, previous: lst.offset });
						}
						lst.ignore = true, add_sharp_foldingrange();
						if (!m[3])
							_this.addDiagnostic(diagnostic.invalidhotdef(), lst.offset, lst.length);
						if (lst.type === TokenType.HotkeyLine || (!execute && !/^[ \t]*\{/.test(m[4]))) {
							if (depth > 5) {
								delete _this.tokens[lst.offset];
								return lst;
							}
							string_mode = execute = true;
							const _lst = lst;
							let tk = get_token_ignore_comment(depth + 1), t: number;
							while (tk.ignore && tk.type === TokenType.String) {
								if ((parser_pos = input.indexOf('\n', t = parser_pos)) < 0)
									parser_pos = input_length;
								if (t < parser_pos) {
									const s = input.substring(t, parser_pos).trimEnd();
									tk.content += s, tk.length += s.length;
								}
								_this.token_ranges.push({ start: tk.offset, end: tk.offset + tk.length, type: 3 });
								execute = false, tk = get_token_ignore_comment(depth + 1);
							}
							string_mode = false, lst = _lst;
							if (!execute && lst.type === TokenType.Hotkey) {
								lst.type = TokenType.HotkeyLine, lst.skip_pos = parser_pos = offset + m[0].length;
								offset += m[1].length;
								lst.data = { content: input.substring(offset, parser_pos), offset, length: parser_pos - offset };
								_this.token_ranges.push({ start: offset, end: parser_pos, type: 3, previous: lst.offset });
							} else
								parser_pos = _lst.skip_pos ?? _lst.offset + _lst.length;
						}
						return lst;
					} else if ((m = line.match(/^(((([<>$~*!+#^]*?)(`?;|[\x21-\x3A\x3C-\x7E]|[^\x00-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7f]+))|~?(`?;|[\x21-\x3A\x3C-\x7E]|[^\x00-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7f]+)[ \t]*&[ \t]*~?(`?;|[\x21-\x3A\x3C-\x7E]|[^\x00-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7f]+))([ \t]+up)?[ \t]*::)(.*)$/i))) {
						const mm = m[9].match(/^([ \t]*)(([<>~*!+#^]*?)(`[{;]|[a-z]\w+|[^{]))$/i);
						add_sharp_foldingrange();
						if (mm) {
							const t = mm[4].toLowerCase();
							if (t.length === 1 || !/^joy|^pause$/.test(t) && KEYS_RE.test(t)) {
								last_LF = next_LF, parser_pos = offset + m[0].length;
								lst = createToken(m[1].replace(/[ \t]+/g, ' '), TokenType.HotkeyLine, offset, m[1].length, 1);
								offset += lst.length + mm[1].length, lst.skip_pos = parser_pos;
								lst.data = { content: m[9].trim(), offset, length: parser_pos - offset, data: mm[2] };
								_this.token_ranges.push({ start: offset, end: parser_pos, type: 3, previous: lst.offset });
								return lst;
							}
						}
						parser_pos = input.indexOf('::', parser_pos) + 2;
						return lst = createToken(m[1].replace(/[ \t]+/g, ' '), TokenType.Hotkey, offset, m[1].length, 1);
					}
				}
				if (c !== '#') add_sharp_foldingrange();
			}

			if (isIdentifierChar(c.charCodeAt(0)) || c === '$' && allow_$) {
				let tp = TokenType.Identifier;
				while (parser_pos < input_length && isIdentifierChar(input.charCodeAt(parser_pos)))
					c += input[parser_pos], parser_pos += 1;

				// small and surprisingly unugly hack for 1E-10 representation
				if (input[offset - 1] !== '.') {
					if ((m = c.match(/^(\d+[Ee](\d+)?|(0[Xx][\da-fA-F]+)|(\d+))$/))) {
						if (m[2] || m[3]) {
							lst = createToken(c, TokenType.Number, offset, c.length, bg);
							lst.data = !!m[2], lst.semantic = SE_NUMBER;
							return lst;
						}
						if (m[4]) {
							let data;
							if (parser_pos < input_length && input[parser_pos] === '.') {
								let cc = '', t = '', p = parser_pos + 1;
								while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
									cc += input[p], p += 1;
								if (/^\d*([Ee]\d+)?$/.test(cc)) {
									c += '.' + cc, parser_pos = p;
									lst = createToken(c, TokenType.Number, offset, c.length, bg);
									lst.data = true;
									return lst.semantic = SE_NUMBER, lst;
								} else if (/^\d*[Ee]$/.test(cc) && p < input_length && '-+'.includes(input[p])) {
									cc += input[p], p += 1;
									while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
										t += input[p], p += 1;
									if (/^\d+$/.test(t))
										c += '.' + cc + t, parser_pos = p;
								}
								data = true;
							}
							lst = createToken(c, TokenType.Number, offset, c.length, bg), lst.data = data;
							return lst.semantic = SE_NUMBER, lst;
						} else if (parser_pos < input_length && '-+'.includes(input[parser_pos])) {
							const sign = input[parser_pos], p = parser_pos;
							let t: Token;
							parser_pos += 1, t = get_next_token(depth + 1);
							delete _this.tokens[t.offset];
							if (t.type === TokenType.Number && /^\d+$/.test(t.content)) {
								c += sign + t.content;
								lst = createToken(c, TokenType.Number, offset, c.length, bg), lst.data = true;
								return lst.semantic = SE_NUMBER, lst;
							} else
								parser_pos = p;
						}
					}
					if (-1 < (i = RESERVED_WORDS.indexOf(c.toLowerCase(), reservedIndex)))
						tp = i < OP_INDEX ? TokenType.Reserved : TokenType.Operator;
				}
				return lst = createToken(c, tp, offset, c.length, bg);
			}

			if (c === '(' || c === '[') {
				if (c === '(') {
					if (bg && !continuation_sections_mode) {
						let i = parser_pos, b = i, lc = 0, t: string, join: [number, string] = [0, ''], comments = false;
						function check_option() {
							if ((t = input.slice(b, i - 1).toLowerCase()))
								if (t.startsWith('join'))
									join = [b + 4, input.substring(b + 4, i - 1)];
								else if (/^c(com(ments)?)?$/.test(t))
									comments = true;
						}
						while (true) {
							if (i >= input_length || (t = input[i++]) === '\n') {
								check_option();
								if (string_mode) {
									// raw string
									// ::hotstring::string
									// (Join`s
									//   continuation
									//   string
									// )
									let next_LF = input.indexOf('\n', i), m: RegExpMatchArray | null = null;
									const o = last_LF + 1, data = [lc, i - 1 - o - lc];
									while (!(m = (t = input.substring(i, next_LF < 0 ? next_LF = input_length : next_LF)).match(/^[ \t]*\)/)) && next_LF > 0) {
										if (comments && (b = t.search(/(?<=^|[ \t]);/)) > -1)
											data.push(t.length - b, b);
										else data.push(0, t.length);
										next_LF = input.indexOf('\n', i = next_LF + 1);
									}
									parser_pos = m ? i + m[0].length : input_length;
									data.push(0, parser_pos - i);
									lst = createToken(input.substring(o, parser_pos), TokenType.String, offset, parser_pos - offset, 1);
									_this.addFoldingRange(o, parser_pos, 'block');
									lst.data = data;
									return lst.ignore = true, lst;
								} else {
									// continuation sections
									// obj := {
									//   (Join,
									//     key1: val1
									//     key2: val2
									//   )
									// }
									const top = !lst.type || (lst.type === TokenType.BlockStart && lst.topofline > 0);
									lst = createToken(c, TokenType.BracketStart, offset, 1, 1);
									lst.ignore = true, parser_pos = i - 1, continuation_sections_mode = true;
									while (' \t'.includes(input[++offset])) continue;
									const content = input.substring(offset, parser_pos).trimEnd().replace(/[ \t]+;.*$/, '');
									lst.data = { content, offset, length: content.length };
									lst.skip_pos = parser_pos = offset + content.length;
									_this.token_ranges.push({ start: offset, end: parser_pos, type: 3, previous: lst.offset });
									const _lst = lst, _mode = format_mode, join_str = join[1].replace(/`[tsrn]/g, '  ');
									let lk = lst, optionend = false, llf = parser_pos, sum = 0, tk: Token;
									let create_tokens: (n: number, LF: number) => typeof lk.previous_extra_tokens = () => undefined;
									if (join_str.trim()) {
										const tl = new Lexer(TextDocument.create('', 'ahk2', -10, join_str));
										const suffix_is_whitespace = WHITESPACE.includes(join_str.slice(-1));
										tl.parseScript();
										delete tl.tokens[-1];
										const tks = Object.values(tl.tokens);
										offset = join[0];
										if (tks.length) {
											tks.forEach(tk => {
												tk.offset += offset, tk.length = 0;
												tk.next_token_offset = -1;
											});
											create_tokens = (n, last_LF) => {
												const tokens: Token[] = [];
												for (let i = 0; i < n; i++) {
													last_LF = input.indexOf('\n', last_LF + 1);
													for (let tk of tks)
														tk = { ...tk }, tk.offset = last_LF, tokens.push(tk);
												}
												return { i: 0, len: tokens.length, tokens, suffix_is_whitespace };
											};
											if (',)]}'.includes(tks[0].content))
												optionend = true;
										}
									}
									format_mode = true, tk = get_next_token();
									if (continuation_sections_mode && tk.type !== TokenType.EOF) {
										if (comments && (tk.topofline && tk.type & TokenType.Comment)) {
											sum = n_newlines - 2;
										} else {
											if (n_newlines > 1)
												tk.previous_extra_tokens = create_tokens(n_newlines - 1, llf);
											tk.topofline = top ? 1 : -1;
										}
										llf = last_LF, lk = tk, tk = get_next_token();
									}
									while (continuation_sections_mode && tk.type !== TokenType.EOF) {
										if (tk.topofline) {
											if (comments && (tk.type & TokenType.Comment)) {
												sum += n_newlines - 1;
											} else {
												if ((sum += n_newlines))
													tk.previous_extra_tokens = create_tokens(sum, llf);
												tk.topofline = -1, sum = 0;
												if (optionend && lk.content === '?')
													lk.ignore = true;
											}
											llf = last_LF;
										}
										lk = tk, tk = get_next_token();
									}
									if (tk.ignore && tk.type === TokenType.BracketEnd) {
										if (n_newlines > 1)
											tk.previous_extra_tokens = create_tokens(n_newlines - 1, llf);
										_lst.next_pair_pos = tk.offset, tk.previous_pair_pos = _lst.offset;
										_this.addFoldingRange(_lst.offset, tk.offset, 'block');
									}
									parser_pos = _lst.skip_pos as number;
									return lst = ((format_mode = _mode)) ? _lst : get_next_token();
								}
							} else if (t === ' ' || t === '\t')
								check_option(), b = i;
							else if (t === ';') {
								if (b === i - 1 && input[b - 1] !== '(') {
									if (0 > (i = input.indexOf('\n', i)))
										i = input_length;
									lc = i - b, b = i;
								}
							} else if (t === ')' || t === '(')
								if (i - b < 5 || input.substring(b, b + 4).toLowerCase() !== 'join')
									break;
						}
					}
				}
				return lst = createToken(c, TokenType.BracketStart, offset, 1, bg);
			}

			if (c === ')' || c === ']') {
				lst = createToken(c, TokenType.BracketEnd, offset, 1, bg);
				if (c === ')') {
					if (bg && continuation_sections_mode) {
						continuation_sections_mode = false, lst.ignore = true;
						return format_mode ? lst : get_next_token();
					}
				}
				return lst;
			}

			if (c === '{' || c === '}') {
				if (bg)
					last_LF = offset, begin_line = true;
				return lst = createToken(c, c === '{' ? TokenType.BlockStart : TokenType.BlockEnd, offset, 1, bg);
			}

			if (c === ',')
				return lst = createToken(c, TokenType.Comma, offset, 1, bg);

			if (c === '"' || c === "'") {
				const sep = c, o = offset;
				let nosep = false, _lst: Token | undefined, pt: Token | undefined, lf;
				resulting_string = '';
				if (!' \t\r\n+-*/%:?~!&|^=<>[({,.]'.includes(c = input.charAt(offset - 1))) {
					if (sep === c) {
						if (c === "'" || !stop_parse(lst))
							_this.addDiagnostic(diagnostic.didyoumean(c = `\`${c}`), offset - 1, input[offset + 1] === sep ? 2 : 1,
								{ code: DiagnosticCode.expect, data: c });
						else offset = lst.offset, lst = lst.previous_token!, _this.token_ranges.pop();
					} else _this.addDiagnostic(diagnostic.missingspace(), offset, 1);
				}
				while ((c = input[parser_pos++])) {
					if (c === '`')
						parser_pos++;
					else if (c === sep) {
						resulting_string += input.substring(offset, parser_pos);
						lst = createToken(resulting_string, TokenType.String, offset, parser_pos - offset, bg);
						_this.token_ranges.push({ start: offset, end: parser_pos, type: 2 });
						if (nosep) lst.data = null, lst.semantic = SE_STRING;
						else lst.has_LF = lf;
						if (_lst)
							lst = _lst, parser_pos = lst.offset + lst.length;
						if (isIdentifierChar(input.charCodeAt(parser_pos)))
							_this.addDiagnostic(diagnostic.missingspace(), parser_pos);
						return lst;
					} else if (continuation_sections_mode) {
						if (c === '\n') {
							const p = parser_pos - 1;
							while (' \t'.includes(c = input[parser_pos]))
								parser_pos++;
							if (c === ')') {
								resulting_string = input.substring(offset, p);
								lst = createToken(resulting_string, TokenType.String, offset, resulting_string.length, bg = 0);
								lst.has_LF = lf, lf = false;
								_lst ??= lst, resulting_string = '';
								_this.token_ranges.push({ start: offset, end: offset + lst.length, type: 3 });
								let pt = lst.previous_token;
								while (pt && (!pt.ignore || pt.content !== '('))
									pt = pt.previous_token;
								// lst.semantic = se;
								_this.addFoldingRange(offset, p, 'string');
								lst = createToken(')', TokenType.BracketEnd, parser_pos, 1, 1), lst.ignore = true;
								if (pt)
									pt.next_pair_pos = parser_pos, lst.previous_pair_pos = pt.offset;
								continuation_sections_mode = false, nosep = true, offset = ++parser_pos;
								while (' \t'.includes(c = input[parser_pos]))
									parser_pos++;
								resulting_string = input.substring(offset, parser_pos), offset = parser_pos;
							} else lf = true;
						}
					} else if (c === '\n' || c === ';' && ' \t'.includes(input[parser_pos - 2])) {
						resulting_string = (resulting_string + input.substring(offset, parser_pos - (c === ';' ? 2 : 1))).trimEnd();
						if (--parser_pos, resulting_string) {
							lst = createToken(resulting_string, TokenType.String, offset, resulting_string.trimStart().length, bg);
							_this.token_ranges.push({ start: offset, end: offset + lst.length, type: 3 });
							if (nosep) lst.data = null, lst.semantic = SE_STRING;
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
					while (tk.ignore && tk.type === TokenType.String) {
						const p = parser_pos, data = tk.data as number[];
						if (nosep)
							tk.semantic = SE_STRING;
						while ((c = input[parser_pos++])) {
							if (c === '`')
								parser_pos++;
							else if (c === sep) {
								const s = input.substring(p, parser_pos);
								tk.content += s, tk.length += s.length, data[data.length - 1] += s.length;
								_this.token_ranges.push({ start: tk.offset, end: tk.offset + tk.length, type: 3 });
								if (isIdentifierChar(input.charCodeAt(parser_pos)))
									_this.addDiagnostic(diagnostic.missingspace(), parser_pos);
								break stringend;
							} else if (c === '\n' || c === ';' && ' \t'.includes(input[parser_pos - 2])) {
								const s = input.substring(p, parser_pos - (c === ';' ? 2 : 1)).trimEnd();
								if (s)
									tk.content += s, tk.length += s.length, data[data.length - 1] += s.length;
								_this.token_ranges.push({ start: tk.offset, end: tk.offset + tk.length, type: 3 });
								parser_pos--;
								break;
							}
						}
						if (!c) {
							const s = input.substring(p, --parser_pos);
							if (s)
								tk.content += s, tk.length += s.length;
							_this.token_ranges.push({ start: tk.offset, end: tk.offset + tk.length, type: 3 });
						}
						tk = get_token_ignore_comment(depth + 1);
					}
					if (!tk.ignore || tk.type !== TokenType.String)
						if ((pt = tk.previous_token))
							_this.addDiagnostic(diagnostic.unterminated(), pt.offset + pt.length, 1);
						else _this.addDiagnostic(diagnostic.missing(sep), o, 1);
					string_mode = false, lst = _lst as Token, parser_pos = lst.offset + lst.length;
					return lst;
				} else {
					_this.addDiagnostic(diagnostic.unterminated(), input_length, 1);
					resulting_string += input.substring(offset, input_length);
					lst = createToken(resulting_string, TokenType.String, offset, input_length - offset, bg);
					_this.token_ranges.push({ start: offset, end: input_length, type: 3 });
					if (nosep) lst.data = null, lst.semantic = SE_STRING;
					if (continuation_sections_mode)
						_this.addFoldingRange(offset, input_length, 'string'), continuation_sections_mode = false;
					return lst;
				}
			}

			if (c === '.') {
				let nextc = input[parser_pos];
				if (nextc === '=') {
					parser_pos++;
					return lst = createToken('.=', TokenType.Assign, offset, 2, bg);
				} else if (WHITESPACE.includes(nextc) && WHITESPACE.includes(input[parser_pos - 2])) {
					return lst = createToken(c, TokenType.Operator, offset, 1, bg);
				} else if (/\d/.test(nextc) && [TokenType.Assign, TokenType.Operator, TokenType.Comma, TokenType.BracketStart].includes(lst.type)) {
					let p = parser_pos + 1, t = '';
					while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
						nextc += input[p], p += 1;
					if (/^\d+([Ee]\d+)?$/.test(nextc)) {
						parser_pos = p, c += nextc;
						lst = createToken('0' + c, TokenType.Number, offset, c.length, bg);
						lst.data = true;
						return lst.semantic = SE_NUMBER, lst;
					} else if (p < input_length && /^\d+[Ee]$/.test(nextc) && '-+'.includes(input[p])) {
						nextc += input[p], p += 1;
						while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
							t += input[p], p += 1;
						if (/^\d+$/.test(t)) {
							parser_pos = p, c += nextc + t;
							lst = createToken('0' + c, TokenType.Number, offset, c.length, bg);
							lst.data = true;
							return lst.semantic = SE_NUMBER, lst;
						}
					}
				}
				return lst = createToken(c, /[%([]|[^\x00-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7f]/.test(nextc) ?
					TokenType.Dot : TokenType.Unknown, offset, 1, bg);
			}

			if (c === ';') {
				const comment_type = bg && '\n'.includes(input.charAt(last_LF)) ? TokenType.Comment : (bg = 0, TokenType.InlineComment);
				let comment = '', t, rg: Range, ignore = undefined;
				let next_LF = offset - 1, line: string, ln = 0, create_fr = true;
				while (true) {
					parser_pos = next_LF, next_LF = input.indexOf('\n', parser_pos + 1);
					line = input.substring(parser_pos + 1, next_LF = next_LF < 0 ? input_length : next_LF).trim();
					if (line.startsWith(';')) {
						ln++;
						if ((t = line.match(/^;\s*@/))) {
							if (ln > 1) break;
							let s = line.substring(t[0].length).replace(/\s+;.*$/, '').toLowerCase();
							if ((t = s.match(/^([-.\w]+)(?=(\s|$))/))) {
								switch (t[1]) {
									case 'include':
										(s = s.substring(t[1].length).trimStart()) && add_include_dllload(s);
										break;
									case 'include-winapi':
										h && (t = lexers[ahkUris.winapi]) && Object.defineProperty(
											includetable, ahkUris.winapi, { value: t.fsPath, enumerable: false });
										break;
									case 'reference':
										_this.d_uri ||= s.substring(t[1].length).trimStart();
										break;
									case 'lint-disable':
									case 'lint-enable':
										s = s.substring(t[1].length).trimStart();
										if (s === 'class-non-dynamic-member-check')
											if (t[1] === 'lint-enable')
												delete (currsymbol as ClassNode ?? _this).checkmember;
											else (currsymbol as ClassNode ?? _this).checkmember = false;
										break;
								}
							}
							ignore = true;
						} else if ((t = line.match(/^;+\s*([{}])/))) {
							create_fr = false;
							if (t[1] === '{')
								customblocks.bracket.push(parser_pos + 1);
							else if ((t = customblocks.bracket.pop()) !== undefined)
								_this.addFoldingRange(t, parser_pos + 1, 'block');
							if (ln === 1)
								ignore = true;
							if (bg && !ignore)
								continue;
							parser_pos = next_LF;
							break;
						}
						if ((t = line.match(/^;\s*(~?\s*|@)(todo|fixme)(:?\s*)(.*)/i))) {
							_this.children.push(DocumentSymbol.create(`${t[2].toUpperCase()}: ${t[4].trim()}`, undefined,
								SymbolKind.Null, rg = make_range(parser_pos + 1, next_LF - parser_pos - 1), rg));
							if (bg)
								continue;
						}
						if (bg) {
							if ((t = line.match(/^;\s*[@#](end)?region\b/i))) {
								ignore = true, create_fr = false, add_comment_foldingrange();
								if (!t[1]) {
									customblocks.region.push(parser_pos + 1);
									if ((line = line.substring(t[0].length).trim()))
										_this.children.push(DocumentSymbol.create(line, undefined, SymbolKind.Null,
											rg = make_range(parser_pos + 1, next_LF - parser_pos - 1), rg));
								} else if ((t = customblocks.region.pop()) !== undefined)
									_this.addFoldingRange(t, parser_pos + 1, 'region');
							} else if ((t = commentTags?.exec(line))) {
								const g = t.groups;
								for (const tag in g)
									if (tag.startsWith('tag') && (t = g[tag]?.trim()))
										break;
								if (typeof t !== 'string')
									t = t[1]?.trim();
								if (t) {
									_this.children.push(DocumentSymbol.create(t, undefined, SymbolKind.Null,
										rg = make_range(parser_pos + 1, next_LF - parser_pos - 1), rg));
									ignore = true;
								}
							}
							if (!ignore) continue;
						}
						parser_pos = next_LF;
					}
					break;
				}
				comment = input.substring(offset, parser_pos).trimEnd();
				_this.token_ranges.push({ start: offset, end: parser_pos, type: 1 });
				const cmm: Token = _this.tokens[offset] = {
					type: comment_type, content: comment, offset, length: parser_pos - offset, has_LF: ln > 1,
					next_token_offset: -1, topofline: bg, ignore, skip_pos: parser_pos, previous_token: lst
				};
				if (!bg) {
					if (!WHITESPACE.includes(input[offset - 1]))
						unexpected(cmm);
				} else {
					const l = _this.document.positionAt(parser_pos).line;
					if (!string_mode && !ignore && line[0] && !line.startsWith('/*'))
						comments[l + 1] = cmm;
					if (last_comment_fr && (lst.pos ??= _this.document.positionAt(lst.offset)).line > last_comment_fr.endLine)
						add_comment_foldingrange();
					if (last_comment_fr)
						last_comment_fr.endLine = l;
					else if (create_fr)
						last_comment_fr = FoldingRange.create(_this.document.positionAt(offset).line, l, undefined, undefined, 'comment');
				}
				return cmm;
			}

			if (c === '/' && bg && input[parser_pos] === '*') {
				let LF = input.indexOf('\n', --parser_pos), ln = 0;
				while (!(m = line!.match(/(^[ \t]*\*\/)|\*\/([ \t]*\r?)$/)) && LF > 0) {
					last_LF = LF, LF = input.indexOf('\n', parser_pos = LF + 1), ln++;
					line = input.substring(parser_pos, LF > 0 ? LF : input_length);
				}
				if (m?.[1])
					parser_pos = input.indexOf('*/', last_LF) + 2, begin_line = true, last_LF = parser_pos - 1;
				else if (!ln && m)
					parser_pos = offset + line!.length;
				else parser_pos = (LF < 0 ? input_length : LF) - (m?.[2].length ?? 0);
				_this.token_ranges.push({ start: offset, end: parser_pos, type: 1 });
				const cmm: Token = {
					type: TokenType.BlockComment, content: input.substring(offset, parser_pos), offset, length: parser_pos - offset,
					next_token_offset: -1, previous_token: lst, topofline: bg, skip_pos: parser_pos, has_LF: ln > 1
				};
				if (!string_mode) {
					let i = parser_pos, n = 0;
					for (; ' \t\r'.includes(c = input[i] ?? '\0') || c === '\n' && ++n < 2; i++);
					if (input[offset + 2] === '*' && input[offset + 3] !== '/' && !(cmm.data = null) ||
						!'\n\0'.includes(c))
						comments[_this.document.positionAt(i).line] = cmm;
				}
				add_comment_foldingrange();
				_this.tokens[offset] = cmm;
				if (ln) _this.addFoldingRange(offset, parser_pos, 'comment');
				return cmm;
			}

			if (-1 < (i = PUNCT.indexOf(c))) {
				if (allow_$ && '<>'.includes(c))
					return lst = createToken(c, c === '<' ? TokenType.BracketStart : TokenType.BracketEnd, offset, c.length, bg);
				while (parser_pos < input_length && -1 < (m = PUNCT.indexOf(c + input[parser_pos], i)))
					c += input[parser_pos++], i = m;

				if (c === '?') {
					lst = createToken(c, TokenType.Operator, offset, 1, bg);
					const bak = parser_pos, tk = lst, t = get_token_ignore_comment(depth + 1);
					parser_pos = bak;
					if (')]},:??'.includes(t.content) || t.content === '.' && t.type !== TokenType.Operator) {
						tk.ignore = true;
						if (t.content === '.' && ahkVersion < alpha_3 - 1)
							_this.addDiagnostic(diagnostic.requireVerN(alpha_3 - 1), tk.offset, tk.length, { code: DiagnosticCode.opt_chain });
					}
					return lst = tk;
				} else if (c === '??=' && ahkVersion < alpha_3 - 1)
					_this.addDiagnostic(diagnostic.requireVerN(alpha_3 - 1), offset, c.length, { code: DiagnosticCode.maybe_assign });
				return lst = createToken(c, i >= ASSIGN_INDEX ? TokenType.Assign : TokenType.Operator, offset, c.length, bg);
			}

			if (bg && c === '#') {
				let sharp = '#';
				while (isIdentifierChar(input.charCodeAt(parser_pos)))
					sharp += input[parser_pos++];
				sharp_offsets.push(offset);
				lst = createToken(sharp, TokenType.Directive, offset, sharp.length, bg);
				token_text_low = sharp.toLowerCase();
				if (WHITESPACE.includes(c = input.charAt(parser_pos)) && (token_text_low === '#hotif' || h && token_text_low === '#initexec'))
					return lst;
				last_LF = input.indexOf('\n', offset = parser_pos);
				parser_pos = last_LF < 0 ? input_length : last_LF;
				if (c === ' ' || c === '\t') {
					while (' \t'.includes(input[offset]))
						offset++;
					const content = input.substring(offset, parser_pos).trimEnd().replace(/(^|[ \t]+);.*$/, '');
					if (content) {
						lst.skip_pos = parser_pos = offset + content.length;
						_this.tokens[offset] = {
							...lst.data = { content, offset, length: content.length },
							type: TokenType.Text, previous_token: lst, next_token_offset: -1, topofline: 0
						};
						_this.token_ranges.push({ start: offset, end: offset + content.length, type: 3, previous: lst.offset });
					}
				} else if (!WHITESPACE.includes(c))
					lst.type = TokenType.Unknown, lst.content += input.substring(offset, parser_pos).trimEnd(), lst.length += parser_pos - offset;
				return lst;
			}

			return lst = createToken(c, TokenType.Unknown, offset, c.length, bg);

			function add_sharp_foldingrange() {
				if (sharp_offsets.length > 1)
					_this.addFoldingRange(sharp_offsets[0], sharp_offsets.pop() as number, 'imports');
				sharp_offsets.length = 0;
			}
			function add_comment_foldingrange() {
				if (!last_comment_fr)
					return;
				if (last_comment_fr.endLine > last_comment_fr.startLine)
					_this.folding_ranges.push(last_comment_fr);
				last_comment_fr = undefined;
			}
		}

		function real_indentation_level(index = flags.start_line_index) {
			const line = output_lines[index - 1];
			if (line?.text.length)
				return line.indent;
			return flags.indentation_level;
		}

		function get_style() {
			if (flags.mode === Mode.ObjectLiteral)
				return flags.object_style ?? opt.object_style;
			if (flags.mode === Mode.ArrayLiteral)
				return flags.array_style ?? opt.array_style;
		}

		function handle_start_expr(): void {
			if (start_of_statement())
				flags.last_word = '_';
			else if (need_newline() || (input_wanted_newline && !isContinuousLine(ck.previous_token ?? EMPTY_TOKEN, ck)))
				print_newline(null);

			let next_mode = Mode.Expression;
			if (token_text !== '(') {
				if (ck.ignore) {	// only in the parameter list of *.d.ahk
					set_mode(next_mode);
					output_space_before_token = ck.previous_token?.content !== '(';
					print_token();
					flags.last_word = '';
					return;
				}
				if (ck.topofline < 1 && isYieldsOperand(ck.previous_token ?? EMPTY_TOKEN)) {
					set_mode(next_mode);
					print_token();
					flags.last_word = '';
					flags.indentation_level = real_indentation_level() + 1;
					if (opt.space_in_paren) {
						output_space_before_token = true;
					}
					return;
				}
				if (!input_wanted_newline && ck.previous_token?.callsite || last_type === TokenType.Reserved)
					output_space_before_token = true;

				next_mode = Mode.ArrayLiteral;
			} else {
				if (ck.ignore)
					print_newline(true);
				else if (last_type === TokenType.BracketEnd || last_type === TokenType.Identifier)
					output_space_before_token = WHITESPACE.includes(ck.prefix_is_whitespace || '\0');
				else if (last_type === TokenType.String)
					output_space_before_token = true;
				else if (last_type === TokenType.Reserved)
					if (/^(break|continue|goto)$/i.test(last_text))
						output_space_before_token = false;
					else if (['if', 'for', 'while', 'loop', 'case', 'catch', 'switch'].includes(last_text))
						output_space_before_token = Boolean(opt.space_before_conditional);
					else output_space_before_token = space_in_other;
			}

			if (!start_of_object_property()) {
				if (input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
				else if (last_type === TokenType.Assign || last_type === TokenType.Comma || last_type === TokenType.Operator)
					allow_wrap_or_preserved_newline();
			}

			set_mode(next_mode);
			flags.last_word = '';
			flags.indentation_level = real_indentation_level();
			if (flags.indentation_level < previous_flags.indentation_level)
				previous_flags.indentation_level = flags.indentation_level, flags.indent_after = true;
			print_token();

			// (options\n...\n)
			if (ck.ignore) {
				let c = (ck.data as Token).content;
				if (opt.ignore_comment)
					c = c.replace(/[ \t]+;.*$/, '');
				if (c)
					print_token(c);
			} else if (opt.space_in_paren)
				output_space_before_token = true;

			// In all cases, if we newline while inside an expression it should be indented.
			indent();

			if (token_text === '[' && (flags.array_style ?? opt.array_style) === OBJECT_STYLE.expand)
				print_newline(true);
		}

		function handle_end_expr() {
			// statements inside expressions are not valid syntax, but...
			// statements must all be closed when their container closes
			while (flags.mode === Mode.Statement)
				restore_mode();

			const is_array = token_text === ']' && flags.mode === Mode.ArrayLiteral;
			restore_mode();
			flags.had_comment = previous_flags.had_comment;
			if (is_array) {
				const style = flags.array_style ?? opt.array_style;
				if (style === OBJECT_STYLE.collapse || last_text === '[' || flags.indentation_level >= previous_flags.indentation_level)
					trim_newlines();
				else if (style || input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
			} else if ((last_type === TokenType.BracketEnd || last_type === TokenType.BlockEnd) && flags.indentation_level >= previous_flags.indentation_level)
				trim_newlines();
			else if (last_type !== TokenType.BracketStart)
				allow_wrap_or_preserved_newline();

			output_space_before_token = Boolean(opt.space_in_paren && !(last_type === TokenType.BracketStart && !opt.space_in_empty_paren));
			print_token(), previous_flags.indent_after && indent();
			continuation_sections_mode ??= false;
		}

		function handle_start_block() {
			if (ck.data) {
				set_mode(Mode.ObjectLiteral);
				flags.indentation_level = real_indentation_level();
				if (previous_flags.mode !== Mode.Conditional) {
					flags.indent_after = flags.indentation_level < previous_flags.indentation_level;
					previous_flags.indentation_level = flags.indentation_level;
				}

				output_space_before_token ||= space_in_other && last_type !== TokenType.BracketStart;
				print_token(), indent();
				if ((flags.object_style ?? opt.object_style) === OBJECT_STYLE.expand)
					print_newline(true);
				else output_space_before_token = space_in_other;
			} else {
				let level;
				// fn := () {\n}
				if (ck.in_expr)
					level = real_indentation_level();
				else if (['try', 'if', 'for', 'while', 'loop', 'catch', 'else', 'finally', 'switch'].includes(flags.last_word))
					level = real_indentation_level();
				else while (flags.mode === Mode.Statement)
					restore_mode();
				flags.declaration_statement = false;
				set_mode(Mode.BlockStatement);
				flags.in_expression = false;
				flags.indentation_level = level ??= flags.indentation_level;
				output_space_before_token ??= space_in_other;

				if (previous_flags.in_case_statement && last_type === TokenType.Label && /^(default)?:$/.test(last_text))
					flags.case_body = null, print_newline(), flags.indentation_level--;
				else if (opt.brace_style === 0 || input_wanted_newline && opt.preserve_newlines && !opt.brace_style)
					if (ck.in_expr === undefined || flags.mode === Mode.Expression)
						print_newline(true);

				const need_newline = !just_added_newline();
				print_token();
				if (flags.indentation_level < previous_flags.indentation_level)
					previous_flags.indentation_level = flags.indentation_level, flags.indent_after = true;
				if (!(opt.switch_case_alignment && flags.last_word === 'switch'))
					indent();
				if (need_newline || opt.brace_style !== undefined)
					print_newline(true);
				else output_space_before_token = space_in_other;
			}
			flags.last_word = '';
		}

		function handle_end_block() {
			// statements must all be closed when their container closes
			while (flags.mode === Mode.Statement)
				restore_mode();

			const is_obj = flags.mode === Mode.ObjectLiteral, is_exp = is_obj || (ck.in_expr !== undefined);
			if (is_obj) {
				const style = flags.object_style ?? opt.object_style;
				if (style === OBJECT_STYLE.collapse || last_text === '{')
					trim_newlines();
				else if (style || input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
				output_space_before_token = space_in_other && last_text !== '{';
			} else if (opt.brace_style !== undefined || input_wanted_newline)
				print_newline(true);

			restore_mode();
			print_token(), previous_flags.indent_after && indent();
			if (!is_exp) {
				if (previous_flags.case_body === null)
					indent();
				if (opt.brace_style !== undefined)
					print_newline(true);
				output_space_before_token = space_in_other;
			}
		}

		function handle_word() {
			let preserve_statement_flags = false;
			output_space_before_token ||= [TokenType.Number, TokenType.Identifier, TokenType.Reserved, TokenType.String, TokenType.BracketEnd, TokenType.BlockEnd].includes(last_type);

			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
				preserve_statement_flags = flags.declaration_statement;
				if (!input_wanted_newline && ['try', 'else', 'finally'].includes(flags.last_word) &&
					['if', 'while', 'loop', 'for', 'try', 'switch'].includes(token_text_low))
					deindent();
			}

			if (token_type === TokenType.Reserved) {
				if (opt.keyword_start_with_uppercase !== undefined)
					token_text = opt.keyword_start_with_uppercase ?
						token_text_low.replace(/^./, s => s.toUpperCase()) : token_text_low;
				if (is_special_word(token_text_low)) {
					if (input_wanted_newline)
						print_newline(preserve_statement_flags);
				} else {
					let maybe_need_newline = false;

					switch (token_text_low) {
						case 'else':
							while (flags.mode === Mode.Statement && !flags.if_block && !flags.loop_block && !(flags.catch_block && !flags.else_block))
								restore_mode();
							break;
						case 'finally':
							while (flags.mode === Mode.Statement && !flags.catch_block && !flags.try_block && !(flags.else_block && flags.catch_block))
								restore_mode();
							break;
						case 'catch':
							while (flags.mode === Mode.Statement && !flags.try_block && !(flags.catch_block && !flags.else_block))
								restore_mode();
							break;
						case 'until':
							while (flags.mode === Mode.Statement && flags.loop_block !== 1)
								restore_mode();
							break;
						case 'case':
						case 'class':
							while (flags.mode === Mode.Statement)
								restore_mode();
							break;
						case 'if':
						case 'for':
						case 'loop':
						case 'while':
						case 'try':
						case 'switch':
							if (!preserve_statement_flags) {
								if (input_wanted_newline && flags.mode === Mode.Statement &&
									!flags.declaration_statement && !flags.in_expression)
									print_newline(false);
								else while (flags.mode === Mode.Statement && flags.declaration_statement)
									restore_mode();
							}
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
						ck.topofline === 1 && print_newline();
						print_token();
						flags.last_word = token_text_low;
						flags.start_line_index = output_lines.length;
						set_mode(Mode.Statement), is_conditional = true;
						return;
					} else if (token_text_low === 'case') {
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
						if (flags.last_text !== '}' || opt.brace_style! < 1 || input_wanted_newline && opt.preserve_newlines && !opt.brace_style)
							print_newline(true);
						else output_space_before_token = space_in_other;
					} else if (input_wanted_newline)
						if (last_text === 'else' && !opt.preserve_newlines && ['if', 'for', 'loop', 'while', 'try', 'switch'].includes(token_text_low))
							deindent();
						else
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
				flags.start_line_index = output_lines.length;
			} else {
				if (input_wanted_newline && flags.mode === Mode.Statement && !flags.in_expression &&
					!isContinuousLine(ck.previous_token ?? EMPTY_TOKEN, ck))
					print_newline(preserve_statement_flags);
				else if (input_wanted_newline && (opt.preserve_newlines || ck.symbol)) {
					if (ck.symbol || get_style() !== OBJECT_STYLE.collapse)
						print_newline(!ck.symbol);
				} else if ([TokenType.Comma, TokenType.BracketStart, TokenType.Assign, TokenType.Operator].includes(last_type))
					if (!start_of_object_property())
						allow_wrap_or_preserved_newline();
				if (!is_conditional && flags.mode === Mode.BlockStatement && ck.symbol?.children)
					set_mode(Mode.Statement), is_conditional = true;
				flags.last_word = '_';
				if (opt.symbol_with_same_case)
					token_text = ck.definition?.name || token_text;
			}

			print_token();
		}

		function handle_string() {
			if (start_of_statement()) {
				if (input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
				else {
					if (flags.declaration_statement)
						output_space_before_token = last_type !== TokenType.Operator;
					else {
						const pk = ck.previous_token!;
						output_space_before_token = pk.op_type !== -1 && !pk.next_pair_pos && space_in_other;
					}
				}
			} else if (last_type === TokenType.Reserved || last_type === TokenType.Identifier) {
				if (input_wanted_newline)
					print_newline();
				else output_space_before_token = true;
			} else if (last_type === TokenType.Comma || last_type === TokenType.BracketStart || last_type === TokenType.Assign || last_type === TokenType.Operator) {
				if (!start_of_object_property())
					allow_wrap_or_preserved_newline();
			} else {
				// print_newline();
				if (input_wanted_newline)
					print_newline();
				// ck.ignore -> '
				// (
				// str
				// )'
				// (
				// 'str
				// ) str' <- ck.data === null
				if (ck.ignore || ck.data === null)
					output_space_before_token = false;
				else output_space_before_token = true;
			}
			if (ck.ignore) {
				let p: number;
				print_newline(true);
				if (opt.ignore_comment && token_text.trimStart().startsWith('(') && (p = token_text.indexOf('\n')) > 0) {
					const t = token_text.slice(0, p).replace(/[ \t]+;.*$/, '');
					if (/(^[ \t]*\(|[ \t])c(om(ments?)?)?([ \t]|$)/i.test(t))
						token_text = `${t}\n${token_text.slice(p + 1).replace(/^[ \t]*;.*\r?\n|[ \t]+;.*/gm, '')}`;
					else token_text = `${t}\n${token_text.slice(p + 1)}`;
				}
				print_token();
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
			delete flags.ternary_depth;
			if (flags.mode === Mode.BlockStatement || flags.declaration_statement)
				set_mode(Mode.Statement), indent();
			if (last_type === TokenType.Identifier && WHITESPACE.includes(ck.prefix_is_whitespace || '\0') &&
				ck.previous_token?.callsite)
				input_wanted_newline && opt.preserve_newlines ? print_newline(true) : output_space_before_token = true;
			else {
				output_space_before_token = space_in_other && last_type === TokenType.Comma || last_text === 'for' && last_type === TokenType.Reserved;
				if (flags.mode === Mode.Statement && flags.parent.mode === Mode.ObjectLiteral)
					restore_mode();
				if (input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
				else if (!just_added_newline())
					input_wanted_newline = false;
			}
			const style = get_style();
			if (style)
				trim_newlines();
			print_token();
			if (style === OBJECT_STYLE.expand)
				print_newline(true);
			else output_space_before_token = space_in_other;
		}

		function handle_operator() {
			let space_before = Boolean(space_in_other || /^\w/.test(token_text));
			let space_after = space_before;
			if (ck.previous_token?.callsite)
				output_space_before_token = true;
			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
				if (flags.declaration_statement && /^(\+\+|--|%|!|~|not)$/.test(token_text_low)) {
					output_space_before_token = true, flags.last_word = '_';
					print_token();
					if (token_text_low === 'not')
						output_space_before_token = true;
					return;
				}
			} else if (token_text === '=>') {
				// ^fn() => xx
				if (is_conditional && flags.mode === Mode.Statement && flags.parent.mode === Mode.BlockStatement)
					is_conditional = false;
				set_mode(Mode.Statement);
				indent(), flags.in_fat_arrow = true;
			} else if (/^(\+\+|--|%|!|~|not)$/.test(token_text_low) && need_newline()) {
				print_newline(), print_token();
				if (token_text_low === 'not')
					output_space_before_token = true;
				return;
			}

			if (last_type === TokenType.Reserved)
				output_space_before_token = true;

			// %...%
			if (token_text === '%') {
				space_after = Boolean(ck.previous_pair_pos !== undefined && ' \t'.includes(input[ck.offset + 1]));
				output_space_before_token ||= Boolean(ck.next_pair_pos && ' \t'.includes(ck.prefix_is_whitespace || '\0'));
				if (input_wanted_newline && opt.preserve_newlines)
					if (flags.mode === Mode.Statement && isContinuousLine(ck.previous_token ?? EMPTY_TOKEN, ck))
						print_newline(true);
				print_token();
				output_space_before_token = space_after;
				return;
			}

			// case ...:
			if (token_text === ':' && (flags.in_case ||
				flags.mode === Mode.Statement && flags.parent.in_case)) {
				if (!flags.in_case)
					restore_mode();
				indent(), print_token();
				if (is_next_char('\n'))
					print_newline();
				else output_space_before_token = space_in_other;
				flags.in_case = false;
				flags.case_body = true;
				set_mode(Mode.Statement);
				flags.case_body = true;
				token_type = TokenType.Label;
				return;
			}

			if (input_wanted_newline && opt.preserve_newlines)
				print_newline(true);
			else if (last_type === TokenType.Operator && !/^(--|\+\+|%|!|~|not)$/.test(last_text))
				allow_wrap_or_preserved_newline();

			if (['--', '++', '!', '~'].includes(token_text) || ('-+'.includes(token_text) && ([TokenType.BlockStart, TokenType.BracketStart, TokenType.Assign, TokenType.Operator, TokenType.Comma, TokenType.Reserved].includes(last_type) || ck.previous_token?.callsite))) {
				space_after = false;
				space_before = token_text === '!' && last_type === TokenType.Identifier;

				if (!output_space_before_token && (token_text === '++' || token_text === '--') && (last_type === TokenType.Identifier || last_type === TokenType.BracketEnd))
					space_after = true;
			} else if (token_text === ':') {
				if (flags.ternary_depth)
					restore_mode(), deindent(), flags.ternary_depth--;
				else if ((space_before = false, get_style()))
					trim_newlines();
			} else if (token_text === '?') {
				if (ck.ignore) {
					space_before = false;
					space_after = _this.tokens[ck.next_token_offset]?.content.startsWith('?') ?? false;
				} else {
					if (flags.ternary_depth === undefined)
						flags.ternary_depth = 1;
					else flags.ternary_depth++;
					indent();
					set_mode(Mode.Expression);
					flags.ternary_depth = flags.parent.ternary_depth;
				}
			} else if (token_text === '.')
				space_after = space_before = true;
			else if (token_text === '&') {
				if (last_type !== TokenType.Identifier && last_type !== TokenType.BracketEnd || ck.previous_token?.callsite)
					space_after = false;
				if (last_type === TokenType.Comma || last_type === TokenType.BracketStart)
					space_before = false;
			} else if (token_text === '*') {
				if (last_text === ',')
					space_after = false;
				else if (_this.tokens[ck.next_token_offset]?.type === TokenType.BracketEnd)
					space_before = space_after = false;
			}

			output_space_before_token ||= space_before;
			print_token();
			output_space_before_token = space_after;
		}

		function handle_block_comment() {
			// block comment starts with a new line
			if (flags.mode === Mode.Statement) {
				const nk = _this.tokens[ck.previous_token?.next_token_offset!];
				if (!nk || !flags.in_expression && !isContinuousLine(nk.previous_token ?? EMPTY_TOKEN, nk))
					print_newline();
				else if (flags.had_comment < 2)
					trim_newlines();
			}
			if (opt.ignore_comment)
				return;

			const lines = token_text.split('\n');
			const jsdoc = /^\/\*\*(?!\/)/.test(token_text);
			let remove: RegExp | string = '';
			if (!jsdoc)
				remove = new RegExp(`^${input.substring(input.lastIndexOf('\n', ck.offset) + 1, ck.offset)}`);
			// first line always indented
			print_newline(true);
			print_token(lines[0].trimEnd());
			for (let j = 1, l = lines.length - 1; j < l; j++) {
				print_newline(true);
				if (jsdoc) {
					print_token(lines[j].replace(/^(\s*(\*?\s*(?=@)|\* ?))?/, ' * '));
				} else {
					print_token(lines[j].trimEnd().replace(remove, ''));
				}
			}
			if (lines.length > 1) {
				print_newline(true);
				print_token((jsdoc ? ' ' : '') + lines.at(-1)!.trim());
			}
			print_newline(true);
			flags.had_comment = 3;
		}

		function format_directives(str: string) {
			const m = str.match(/^;\s*@format\b/i);
			if (!m) return;
			const new_opts = fixupFormatOptions(Object.fromEntries(str.substring(m[0].length).split(',').map(s => {
				const p = s.indexOf(':');
				return [s.substring(0, p).trim(), s.substring(p + 1).trim()];
			})));
			for (const k of ['array_style', 'object_style'] as const)
				if (k in new_opts)
					flags[k] = new_opts[k], delete new_opts[k];
			Object.assign(opt, new_opts);
		}

		function handle_inline_comment() {
			format_directives(token_text);
			if (opt.ignore_comment)
				return;
			if (just_added_newline() && output_lines.length > 1)
				output_lines.pop();
			let t;
			output_lines[output_lines.length - 1].text.push(
				opt.white_space_before_inline_comment ||
				(((t = ck.previous_token)) ? input.substring(t.skip_pos ?? t.offset + t.length, ck.offset) : '\t'),
				token_text);
			print_newline(true);
			flags.had_comment = 1;
		}

		function handle_comment() {
			if (flags.mode === Mode.Statement) {
				const nk = _this.tokens[ck.previous_token?.next_token_offset!];
				if (!nk || !flags.in_expression && !isContinuousLine(nk.previous_token ?? EMPTY_TOKEN, nk))
					print_newline();
				else if (flags.had_comment < 2)
					trim_newlines();
			}
			format_directives(token_text);
			if (opt.ignore_comment)
				return;
			token_text.split('\n').forEach(s => {
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
			token_type = TokenType.Identifier;
			handle_word();
		}

		function handle_sharp() {
			print_newline();
			if (opt.symbol_with_same_case && token_type === TokenType.Directive)
				token_text = hoverCache[token_text_low]?.[0] || token_text;
			if (token_text_low === '#hotif' && opt.indent_between_hotif_directive) {
				if (flags.hotif_block)
					deindent(), flags.hotif_block = false;
				print_token();
				if (_this.tokens[ck.next_token_offset]?.topofline === 0)
					indent(), flags.hotif_block = true;
				output_space_before_token = true;
				return;
			}
			print_token();
			const t = (ck.data as Token)?.content;
			if (t)
				print_token(token_type === TokenType.HotkeyLine ? t : ' ' + t);
			else if (token_type === TokenType.Hotkey)
				output_space_before_token = !!opt.space_after_double_colon;
			else output_space_before_token = space_in_other || token_type === TokenType.Directive;
		}

		function handle_label() {
			print_newline(null);
			if (token_text_low === 'default:' && (flags.in_case_statement || (flags.mode === Mode.BlockStatement && flags.last_word === 'switch'))) {
				if (flags.case_body)
					deindent();
				else flags.case_body = true;
				print_token(), indent();
				flags.in_case = false;
				flags.in_case_statement = true;
				output_space_before_token = space_in_other;
				set_mode(Mode.Statement);
				flags.case_body = true;
				return;
			}
			print_token();
			const t = output_lines.at(-1)!.text;
			if (t[0].trim() === '')
				output_lines[output_lines.length - 1].text = t.slice(1);
			else
				indent();
		}

		function handle_unknown() {
			print_token();
			if (_this.tokens[ck.next_token_offset!]?.topofline === 1)
				print_newline();
		}

		function need_newline() {
			return input_wanted_newline && (flags.parent.mode === Mode.BlockStatement &&
				[TokenType.BracketEnd, TokenType.BlockStart, TokenType.BlockEnd, TokenType.Identifier, TokenType.String].includes(last_type) ||
				(last_type === TokenType.Operator && /^(\+\+|--|%)$/.test(last_text)) ||
				(last_type === TokenType.Reserved && /^(break|continue|goto|global|local|loop|return|static|throw)$/.test(last_text)));
		}
	}

	private clear() {
		this.texts = {}, this.declaration = {}, this.include = {}, this.tokens = {};
		this.labels = {}, this.typedef = {}, this.object = { method: {}, property: {} };
		this.need_scriptdir = this.hotstringExecuteAction = this.isparsed = false;
		this.children.length = this.dllpaths.length = this.token_ranges.length = 0;
		this.diagnostics.length = this.folding_ranges.length = this.line_ranges.length = 0;
		this.includedir.clear(), this.dlldir.clear();
		this.d_uri = '';
		delete this.maybev1;
		delete this.checkmember;
		delete this.symbolInformation;
	}

	get included() { return includedCache[this.uri] ?? {}; }
	get relevance() {
		const uri = this.uri, r = { ...includeCache[uri] };
		for (const u in includedCache[uri])
			Object.assign(r, includeCache[u]);
		delete r[uri];
		return r;
	}

	public findSymbol(name: string, kind?: SymbolKind, position?: Position)
		: {
			node: AhkSymbol, uri: string, is_global?: boolean | 1	// maybe
			is_this?: boolean, parent?: AhkSymbol, scope?: AhkSymbol
		} | null | undefined {
		let node: AhkSymbol | undefined, scope: FuncNode | undefined, uri = this.uri;
		if (kind === SymbolKind.Field) {
			const tokens = this.tokens, offset = position ? this.document.offsetAt(position) : -1;
			let data: number;
			scope = position && this.searchScopedNode(position) as FuncNode;
			for (node of (scope as FuncNode ?? this).labels?.[name.endsWith(':') ? name.slice(0, -1) : name] ?? []) {
				if (!node.def) break;
				if ((data = node.data as number) === -1 || data < offset &&
					(!(data = tokens[tokens[data].next_pair_pos!]?.offset) || offset < data))
					return { node, uri, scope };
			}
			return scope && null;
		}
		let t: AhkSymbol | undefined, parent: AhkSymbol | undefined, is_global: boolean | 1 = true;
		if (name.startsWith('$'))
			return (node = from_d(this.d ? uri : this.d_uri) ?? this.typedef[name]) && { node, uri, is_global: true };
		if ((scope = position && this.searchScopedNode(position) as FuncNode)) {
			if (scope.kind === SymbolKind.Class)
				scope = undefined;
			else if (scope.kind === SymbolKind.Property) {
				if (name === 'THIS')
					return { node: scope.parent!, uri, scope, is_this: true };
			}
		}
		let fn = scope;
		while (fn?.local) {
			if ((t = fn.local[name])) {
				node = t, parent = fn, is_global = false;
				if ((node as Variable).is_param) {
					if (fn.parent?.kind === SymbolKind.Property)
						parent = fn.parent;
				}
				break;
			}
			if (fn.has_this_param && (name === 'THIS' || name === 'SUPER')) {
				node = fn;
				while (node.kind !== SymbolKind.Class)
					if (!(node = node.parent as FuncNode))
						return null;
				if (name === 'THIS')
					return { node, uri, scope, is_this: true };
				if ((parent = getClassBase(node, this)))
					return {
						node: { ...parent, prototype: (node as ClassNode).prototype } as ClassNode,
						uri, scope, is_this: false
					};
				return null;
			}
			if (((t = fn.global?.[name]) && (node = t) ||
				fn.assume === FuncScope.GLOBAL) && (is_global = true))
				break;
			if ((t = fn.declaration?.[name]))
				node = t, parent = fn, is_global = false;
			else node ??= (parent = fn, fn.unresolved_vars?.[name]);
			if (fn.static && fn.kind === SymbolKind.Function) {
				if ((t = (fn.parent as FuncNode)?.local[name])?.static)
					node = t, parent = fn.parent;
				if (node?.def)
					is_global = false;
				break;
			}
			fn = fn.parent as FuncNode;
		}
		if (is_global)
			node = from_d(this.d_uri) ?? this.declaration[name] ??
				(is_global = 1, node) ?? (is_global = true, this.typedef[name]);
		return node && { node, uri, scope, is_global, parent };
		function from_d(d_uri: string) {
			const lex = lexers[d_uri];
			if (!lex) return;
			const n = lex.declaration[name] ?? lex.typedef[name];
			return n && (uri = n.uri = d_uri, n);
		}
	}

	public getContext(position: Position, ignoreright = false): Context {
		// eslint-disable-next-line prefer-const
		let { character, line } = position, usage;
		let kind: SymbolKind, symbol: AhkSymbol | undefined, token: Token | undefined, start: number, is_end_expr, text;
		const { document, tokens } = this;
		const linetext = document.getText(Range.create(line, 0, line + 1, 0)).trimEnd();
		for (start = character; --start >= 0 && isIdentifierChar(linetext.charCodeAt(start)););
		if (!ignoreright)
			for (; isIdentifierChar(linetext.charCodeAt(character)); character++);
		const range = Range.create(line, start += (this.d && linetext[start] === '$' ? 0 : 1), line, character);
		const word = text = linetext.slice(start, character);
		const off = document.offsetAt(range.start);
		const pt = ((token = tokens[off])) ? token.previous_token : tokens[off - 1];
		if (pt?.type === TokenType.Dot || pt?.type === TokenType.Unknown && pt.content === '.' ||
			(is_end_expr = pt && isYieldsOperand(pt) && token?.type === TokenType.BracketStart &&
				token.topofline < 1 && (token.content === '[' || token.prefix_is_whitespace === undefined))) {
			const iscall = Boolean(token?.paraminfo) || linetext[character] === '(';
			let tk = pt, lk = is_end_expr ? pt : (
				usage = ASSIGN_TYPE.includes(tokens[token?.next_token_offset]?.content) ? USAGE.Write : USAGE.Read,
				pt.previous_token);
			while (lk) {
				switch (lk.type) {
					case TokenType.Dot: tk = lk, lk = lk.previous_token; break;
					case TokenType.BracketEnd:
						if (!(lk = tokens[lk.previous_pair_pos!]))
							break;
						if ((tk = lk, !lk.next_pair_pos || lk.topofline > 0))
							lk = undefined;
						else if (lk.prefix_is_whitespace === undefined || lk.content === '[' && !lk.previous_token?.callsite) {
							if ((lk = lk.previous_token)) {
								if (lk.type === TokenType.Number || lk.type === TokenType.String || lk.content === '%' && (lk = EMPTY_TOKEN))
									tk = lk, lk = undefined;
								else if (![TokenType.Identifier, TokenType.Dot, TokenType.BracketEnd, TokenType.BlockEnd].includes(lk.type))
									lk = undefined;
							}
						} else lk = undefined;
						break;
					case TokenType.BlockEnd:
						if (lk.in_expr !== undefined) {
							tk = tokens[lk.in_expr], lk = undefined;
							break;
						}
						if ((tk = lk, !(lk = tokens[lk.previous_pair_pos!])))
							break;
					// fall through
					case TokenType.BlockStart:
						tk = lk.data ? lk : EMPTY_TOKEN, lk = undefined; break;
					case TokenType.Number:
					case TokenType.String:
						tk = lk, lk = undefined; break;
					case TokenType.Identifier:
						if ((tk = lk, lk = lk.previous_token)) {
							if (lk.type === TokenType.Dot)
								break;
							if (lk.type === TokenType.BlockStart) {
								lk = undefined;
								break;
							}
							if (tk.prefix_is_whitespace === undefined && lk.previous_pair_pos !== undefined && lk.content === '%')
								tk = EMPTY_TOKEN;
							lk = undefined;
						}
						break;
					case TokenType.Operator:
						if (lk.ignore && lk.content === '?') {
							tk = lk, lk = lk.previous_token;
							break;
						}
					// fall through
					default: lk = undefined; break;
				}
			}
			if ([TokenType.Identifier, TokenType.Number, TokenType.String, TokenType.BracketStart, TokenType.BlockStart].includes(tk.type)) {
				token = tk;
				range.start = document.positionAt(tk.offset);
				range.end = document.positionAt(pt.offset + (is_end_expr ? 1 : 0));
				kind = is_end_expr ? SymbolKind.Variable : iscall ? SymbolKind.Method : SymbolKind.Property;
			} else token = EMPTY_TOKEN, kind = SymbolKind.Null;
			text = '';
		} else if (token) {
			if (token.type === TokenType.Identifier) {
				const sk = token.semantic, sym = (symbol = token.symbol) ?? token.definition;
				if (sym) {
					kind = sym.kind;
					if (kind === SymbolKind.Class)
						text = sym.full ?? '';
					else if (kind === SymbolKind.Property || kind === SymbolKind.Method)
						text = sym.full?.replace(/^\(([^ \t]+)\).*$/, (...m) => `${m[1]}${sym.static ? '.' : '#'}${sym.name}`) ?? '';
				} else if (sk) {
					switch (sk.type) {
						case SemanticTokenTypes.function: kind = SymbolKind.Function; break;
						case SemanticTokenTypes.method: kind = SymbolKind.Method; break;
						case SemanticTokenTypes.class: kind = SymbolKind.Class; break;
						case SemanticTokenTypes.property: kind = SymbolKind.Property; break;
						case SemanticTokenTypes.variable: if (token.ignore) break;
						// fall through
						case SemanticTokenTypes.parameter: kind = SymbolKind.Variable; break;
					}
				} else {
					let t: Token;
					if (!token.ignore || !(
						(t = tokens[off - 1])?.op_type === 1 && t.content === '%' ||
						(t = tokens[off + token.length])?.op_type === -1 && t.content === '%'
					))
						kind = SymbolKind.Variable;
				}
			} else if (token.type === TokenType.Label && !token.hover_word)
				kind = SymbolKind.Field;
		} else if (pt?.content.startsWith('#'))
			token = pt, text = pt.content;
		else {
			token = this.findToken(range.start.character === linetext.length ? off - 1 : off);
			if (token.type === TokenType.String)
				text = token.content;
			else if (token.type === TokenType.BlockComment && typeof token.data === 'object') {
				let s = linetext.substring(0, character), m = s.match(
					/(@see|\{@link(code|plain)?|@param(\s+\{[^}]*\})?)\s+((\[[ \t]*)?[^ \t]+)$/);
				if (m) {
					if ((s = m[4], m[1].startsWith('@param'))) {
						s = s.replace(/^\[[ \t]*/, '');
						const sym = token.symbol as FuncNode;
						if (sym?.params && allIdentifierChar.test(s))
							s = `${typeNaming(sym)}~${s}`;
					} else if (linetext[character] === ':' && /^[a-zA-Z]+$/.test(s))
						s = '';
					if ((m = s.match(/^(([\w.$#~]|[^\x00-\x7f])+)(\(\))?$/))) {
						text = m[1], kind = text.includes('.') ?
							m[3] ? SymbolKind.Method : SymbolKind.Property :
							m[3] ? SymbolKind.Function : SymbolKind.Class;
					}
				} else if ((m = s.match(/(([\w.]|[^\x00-\x7f])+)$/)))
					text = m[1] + word;
			}
		}
		kind ??= SymbolKind.Null;
		return { text, word, range, kind, linetext, token, symbol, usage };
	}

	public searchScopedNode(pos: Position, root?: AhkSymbol[]): AhkSymbol | undefined {
		const { line, character } = pos;
		let its: AhkSymbol[] | undefined, cls: ClassNode, fn: FuncNode, offset: number;
		for (let item of (root ?? this.children)) {
			if (!(its = item.children) || line > item.range.end.line || line < item.selectionRange.start.line ||
				(line === item.selectionRange.start.line && character < item.selectionRange.start.character) ||
				(line === item.range.end.line && character > item.range.end.character))
				continue;
			if (pos.line > item.selectionRange.start.line || pos.character > item.selectionRange.end.character) {
				item = this.searchScopedNode(pos, its) ?? item;
				switch (item.kind) {
					case SymbolKind.Property:
						return this.searchScopedNode(pos, [(item as Property).get!,
						(item as Property).set!].filter(Boolean)) ?? item;
					case SymbolKind.Class:
						offset = this.document.offsetAt(pos), cls = item as ClassNode;
						for (fn of [cls.property.__INIT, cls.$property?.__INIT] as FuncNode[])
							for (const rg of fn?.ranges ?? [])
								if (offset < rg[0]) break;
								else if (offset <= rg[1])
									return this.searchScopedNode(pos, fn.children) ?? fn;
				}
				return item;
			}
			return;
		}
		return;
	}

	public getScopeSymbols(scope?: AhkSymbol): Record<string, Variable> {
		if (!scope || scope.kind === SymbolKind.Class || scope.kind === SymbolKind.Property)
			return {};
		let fn = scope as FuncNode;
		const roots = [fn];
		while ((fn = fn.parent as FuncNode))
			if (fn.kind === SymbolKind.Class)
				break;
			else roots.push(fn);
		let vars: Record<string, Variable> = fn?.kind === SymbolKind.Class ? { THIS, SUPER } : {};
		while ((fn = roots.pop() as FuncNode)) {
			if (fn.kind === SymbolKind.Property)
				continue;
			if (fn.assume === FuncScope.GLOBAL)
				vars = {};
			else if (fn.assume === FuncScope.STATIC)
				Object.entries(vars).forEach(([k, v]) => !v.static && v.static !== null && delete vars[k]);
			Object.assign(vars, fn.local ?? {});
			Object.entries(fn.declaration ?? {}).forEach(([k, v]) => vars[k] ??= v);
			Object.entries(fn.unresolved_vars ?? {}).forEach(([k, v]) => vars[k] ??= v);
			Object.keys(fn.global ?? {}).forEach(k => delete vars[k]);
		}
		return vars;
	}

	public initLibDirs(dir?: string) {
		if (process.env.BROWSER)
			return;
		let workfolder: string;
		if (!dir) {
			for (workfolder of configCache.WorkingDirs)
				if (this.uri.startsWith(workfolder)) {
					dir = restorePath(URI.parse(workfolder).fsPath.replace(/[\\/]$/, ''));
					break;
				}
		}
		if (dir)
			this.scriptdir = dir;
		else if ((workfolder = resolve()).toLowerCase() !== this.scriptpath.toLowerCase()
			&& workfolder.toLowerCase() !== process.argv0.toLowerCase()
			&& this.scriptpath.toLowerCase().startsWith(workfolder.toLowerCase())
			&& !/\\lib(\\.+)?$/i.test(this.scriptpath)) {
			if (existsSync(this.scriptpath + '\\Lib') && statSync(this.scriptpath + '\\Lib').isDirectory())
				this.scriptdir = this.scriptpath;
			else this.scriptdir = workfolder;
		} else this.scriptdir = this.scriptpath.replace(/\\Lib(\\.+)?$/i, '');
		this.libdirs = [dir = this.scriptdir + '\\Lib\\'];
		dir = dir.toLowerCase();
		for (const t of libDirs)
			dir !== t.toLowerCase() && this.libdirs.push(t);
	}

	public getColors() {
		const t = this.token_ranges, document = this.document, text = document.getText(), colors: ColorInformation[] = [];
		for (const a of t) {
			if (a.type === 2) {
				let s = a.start, v = '';
				const e = a.end, m = COLOR_RE.exec(text.substring(s, e));
				if (!m || (!m[1] && e - s !== m[2].length + 2)) continue;
				const range = Range.create(document.positionAt(s += m.index + 1 + (m[1]?.length ?? 0)), document.positionAt(s + m[2].length));
				v = m[5] ? COLOR_VALS[m[5].toLowerCase()] : m[3] === undefined ? m[2] : m[2].substring(2);
				const color = { red: 0, green: 0, blue: 0, alpha: 1 }, cls = ['red', 'green', 'blue'];
				if (m[4] !== undefined) cls.unshift('alpha');
				for (const i of cls) color[i as keyof typeof color] = (parseInt('0x' + v.substring(0, 2)) / 255), v = v.slice(2);
				colors.push({ range, color });
			}
		}
		return colors;
	}

	public addDiagnostic(message: string, offset: number, length = 0, extra?: Partial<Diagnostic>) {
		const beg = this.document.positionAt(offset);
		const end = length ? this.document.positionAt(offset + length) : beg;
		this.diagnostics.push({ message, range: Range.create(beg, end), ...extra });
	}

	private addFoldingRange(start: number, end: number, kind: string = 'block') {
		const l1 = this.document.positionAt(start).line, l2 = this.document.positionAt(end).line - (kind === 'block' ? 1 : 0);
		if (l1 < l2) this.folding_ranges.push(FoldingRange.create(l1, l2, undefined, undefined, kind));
	}

	private addFoldingRangePos(start: Position, end: Position, kind: string = 'block') {
		const l1 = start.line, l2 = end.line - (kind === 'block' ? 1 : 0);
		if (l1 < l2) this.folding_ranges.push(FoldingRange.create(l1, l2, undefined, undefined, kind));
	}

	private addSymbolFolding(symbol: AhkSymbol, first_brace: number) {
		const l1 = configCache.SymbolFoldingFromOpenBrace ? this.document.positionAt(first_brace).line : symbol.range.start.line;
		const l2 = symbol.range.end.line - 1;
		const ranges = this.folding_ranges;
		if (l1 < l2) {
			if (ranges[ranges.length - 1]?.startLine === l1)
				ranges.pop();
			ranges.push(FoldingRange.create(l1, l2, undefined, undefined, 'block'));
		}
	}

	public update() {
		const uri = this.uri, initial = this.include;
		this.parseScript();
		this.folding_ranges.reverse();
		if (libSymbols[uri]) {
			libSymbols[uri].length = 0;
			libSymbols[uri].push(...Object.values(this.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function));
		}
		const after = this.include;
		let l = Object.keys(after).length, change = 0;
		for (const u in initial)
			if (!(u in after)) { change = 2; break; }
		if (!change && (l > Object.keys(initial).length || '' in initial))
			change = 1;
		if (!change)
			return this.sendDiagnostics(true);
		if (!process.env.BROWSER)
			parseInclude(this, this.scriptdir);
		if (change === 1) {
			const c = traverseInclude(this);
			for (const u in this.included)
				Object.assign(includeCache[u], c);
		} else updateIncludeCache();
		let main = this.scriptpath, max = Object.keys(includeCache[uri]).length;
		for (const u in includedCache[uri]) {
			l = Object.keys(includeCache[u]).length;
			if (l > max || l === max && lexers[u].scriptpath.length < main.length)
				main = lexers[u].scriptpath, max = l;
		}
		let lex: Lexer, m = main.toLowerCase();
		const relevance = this.relevance;
		if ((m + '\\').startsWith(this.scriptdir.toLowerCase() + '\\lib\\'))
			main = this.scriptdir, m = main.toLowerCase();
		else if (m !== this.scriptdir.toLowerCase())
			this.initLibDirs(main);
		for (const u in relevance) {
			delete initial[u];
			if (!(lex = lexers[u]) || lex.scriptdir.toLowerCase() === m)
				continue;
			lex.initLibDirs(main), lex.need_scriptdir && lex.parseScript();
		}
		for (const u in initial) {
			const t = lexers[u];
			t && !t.actived && t.close();
		}
		this.sendDiagnostics(true, true);
	}

	public clearDiagnostics() {
		if (!this.last_diags)
			return;
		this.include = {}, this.diagnostics = [], this.last_diags = 0;
		utils.sendDiagnostics?.(this.document.uri, []);
	}

	public sendDiagnostics(update = false, all = false) {
		const last_diags = this.last_diags;
		if (last_diags !== this.diagnostics.length || update && last_diags) {
			this.last_diags = this.diagnostics.length;
			if (utils.sendDiagnostics) {
				this.diag_pending = true;
				if (!(process.env.BROWSER ? clearTimeout(this.diag_timer as number) : (this.diag_timer as NodeJS.Timeout)?.refresh()))
					this.diag_timer = setTimeout(async () => {
						this.diag_pending = false;
						await utils.sendDiagnostics!(this.document.uri, this.diagnostics);
						this.diag_pending ||= undefined;
					}, 500);
			}
		}
		if (!all) return;
		for (const u in this.relevance)
			lexers[u]?.sendDiagnostics(update);
	}

	public setWorkspaceFolder() {
		const uri = this.uri;
		for (const u of workspaceFolders)
			if (uri.startsWith(u))
				return this.workspaceFolder = u;
		return this.workspaceFolder = '';
	}

	public keepAlive() {
		if (this.actived)
			return true;
		const { uri, d } = this;
		if (!lexers[uri])
			return false;
		if (d) {
			if (d > 2 && !uri.includes('?'))
				return true;
			// if (lexers[uri.slice(0, -5) + 'ahk']?.keepAlive())
			// 	return true;
		}
		for (const u in this.relevance)
			if (lexers[u]?.actived)
				return true;
		return false;
	}

	public close(force = false, other = true) {
		this.actived = false;
		if (!force && this.keepAlive())
			return;
		const relevance = other ? this.relevance : undefined;
		delete this.diag_timer;
		this.clearDiagnostics();
		if (force || !this.workspaceFolder) {
			delete lexers[this.uri];
			delete includeCache[this.uri];
			!this.actived && lexers[this.d_uri]?.close(false, false);
		}
		if (!other)
			return;
		let o = true;
		for (const u in relevance)
			o = false, lexers[u]?.close(false, false);
		if (o) {
			if (!lexers[this.uri])
				delete includedCache[this.uri];
		} else updateIncludeCache();
	}

	public findStrOrComment(offset: number): Token | undefined {
		const rgs = this.token_ranges;
		let l = 0, r = rgs.length - 1, i, it;
		while (l <= r) {
			it = rgs[i = (l + r) >> 1];
			if (offset < it.start)
				r = i - 1;
			else if (offset >= it.end)
				l = i + 1;
			else return this.tokens[it.start] ?? ((it = this.tokens[it.previous!])?.data
				&& { type: TokenType.Text, previous_token: it, ...it.data });
		}
	}
}

function createPrototype(name: string, kind = 0, extends_ = '') {
	return { name, full: name, kind, extends: extends_, range: ZERO_RANGE, selectionRange: ZERO_RANGE, uri: '' } as AhkSymbol;
}

function isValidHotkey(s: string) {
	const m = s.match(/^((([<>$~*!+#^]*?)(`?;|[\x21-\x3A\x3C-\x7E]|\w+|[^\x00-\x7f]))|~?(`?;|[\x21-\x3A\x3C-\x7E]|\w+|[^\x00-\x7f])[ \t]+&[ \t]+~?(`?;|[\x21-\x3A\x3C-\x7E]|\w+|[^\x00-\x7f]))([ \t]+up)?::$/i);
	if (!m)
		return false;
	for (let i = 4; i < 7; i++)
		if ((m[i] ?? '').length > 1 && !KEYS_RE.test(m[i]))
			return false;
	return true;
}

function findLibrary(path: string, libdirs: string[], workdir: string = '', check_exists = false, vars = a_Vars) {
	let m: RegExpMatchArray | null, uri = '';
	const raw = path;

	if (path.startsWith('<') && path.endsWith('>')) {
		if (!(path = path.slice(1, -1))) return;
		const search: string[] = [path + '.ahk'];
		if ((m = path.match(/^((\w|[^\x00-\x7f])+)_.*/))) search.push(m[1] + '.ahk');
		for (const dir of libdirs) {
			for (const file of search)
				if (existsSync(path = dir + file)) {
					uri = URI.file(path).toString().toLowerCase();
					return { uri, path: lexers[uri]?.fsPath ?? path, raw };
				}
		}
	} else {
		while ((m = path.match(/%a_(\w+)%/i))) {
			const a_ = m[1].toLowerCase();
			if (vars[a_])
				path = path.replace(m[0], vars[a_]);
			else return;
		}
		if (path.indexOf(':') < 0)
			path = resolve(workdir, path);
		else if (path.includes('..'))
			path = resolve(path);
		if (check_exists && !existsSync(path))
			return;
		uri = URI.file(path).toString().toLowerCase();
		return { uri, path: lexers[uri]?.fsPath ?? path, raw };
	}
}

export function getClassBase(node: AhkSymbol, lex?: Lexer) {
	let iscls = false, uri, base, name: string, cls: ClassNode;
	switch (node.kind) {
		case SymbolKind.Method:
		case SymbolKind.Function: name = 'func'; break;
		case SymbolKind.Number: name = node.name; break;
		case SymbolKind.String: name = 'string'; break;
		default: if (!(node as ClassNode).property) return;
		// fall through
		case SymbolKind.Class:
			cls = node as ClassNode, base;
			if ((base = cls.base))
				return base;
			iscls = !!cls.prototype, name = cls.extends;
			lex ??= lexers[cls.uri!], uri = cls.extendsuri;
			if (!name) {
				if ((cls.full || cls.name).toLowerCase() === 'any')
					if (iscls)
						iscls = false, name = 'class';
					else return;
				else name = 'object';
			}
			break;
	}
	cls = findClass(lex ?? lexers[ahkUris.ahk2], name, uri)!;
	return iscls ? cls : cls?.prototype;
}

export function getClassMember(lex: Lexer, node: AhkSymbol, name: string, ismethod: boolean | null, bases?: (ClassNode | null)[]): AhkSymbol | undefined {
	let prop, method, sym, t, i = 0, cls = node as ClassNode;
	const _bases = bases ??= [];
	name = name.toUpperCase();
	while (true) {
		if (i === _bases.length) {
			if (_bases.includes(cls))
				break;
			_bases.push(cls);
		}
		if ((sym = cls.property?.[name])) {
			if (ismethod) {	// call
				if (sym.kind === SymbolKind.Method)
					return sym.uri ??= cls.uri, sym;
				if ((t = sym).kind === SymbolKind.Class || (t = (sym as Property).call))
					return t.uri ??= cls.uri, t;
				if (!sym.children)
					prop = (sym.uri ??= cls.uri, sym);
				else ((sym as Property).get)
				method ??= (sym.uri ??= cls.uri, sym);
			} else if (ismethod === null) {	// set
				if ((sym as Property).set)
					return sym.uri ??= cls.uri, sym;
				if (!sym.children)
					prop = (sym.uri ??= cls.uri, sym);
				else method ??= (sym.uri ??= cls.uri, sym);
			} else if ((sym as Property).get || sym.kind === SymbolKind.Class)
				return sym.uri ??= cls.uri, sym;
			else if (!sym.children)
				prop = (sym.uri ??= cls.uri, sym);
			else if (sym.kind === SymbolKind.Method || (sym = (sym as Property).call))
				method ??= (sym.uri ??= cls.uri, sym);
		}

		if ((t = _bases[++i]) === null)
			break;
		if (!(cls = t ?? getClassBase(cls, lex))) {
			_bases.push(null);
			break;
		}
	}
	if (ismethod === false)
		return prop ?? method;
	return method ?? prop;
}

export function getClassMembers(lex: Lexer, node: AhkSymbol, bases?: ClassNode[]): Record<string, AhkSymbol> {
	let cls = node as ClassNode;
	const _bases = bases ?? [], properties = [];
	while (cls && !_bases.includes(cls))
		_bases.push(cls), properties.push(cls.property), cls = getClassBase(cls, lex) as ClassNode;
	if (!bases) for (let t; (cls = _bases.pop()!); t = cls.checkmember ??= t);
	return Object.assign({}, ...properties.reverse());
}

export function getClassConstructor(cls: ClassNode, lex?: Lexer) {
	const fn = getClassMember(lex ??= lexers[cls.uri!], cls, 'call', true) as FuncNode;
	if (fn?.full?.startsWith('(Object) static Call('))
		return getClassMember(lex, cls.prototype!, '__new', true) ?? fn;
	return fn;
}

function getClassOwnProp(lex: Lexer, cls: ClassNode, name: string) {
	const bases: ClassNode[] = [];
	let t;
	do {
		if ((t = cls.property?.[name]))
			return t.uri ??= cls.uri, t;
	} while ((cls = ((t = cls.extends?.toLowerCase()) && [t, `(${t}) prototype`].includes(cls.full.toLowerCase()) &&
		!bases.includes(cls) && bases.push(cls) ? getClassBase(cls, lex) as ClassNode : undefined)!));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getClassOwnProps(doc: Lexer, node: AhkSymbol) {
	const cls = node as ClassNode;
	if (!cls.extends || cls.extends.toLowerCase() !== cls.full.toLowerCase())
		return cls.property ?? {};
	let ex = findClass(doc, cls.extends, cls.extendsuri);
	!cls.prototype && (ex = ex?.prototype);
	return { ...ex?.property, ...cls.property };
}

export function findClass(lex: Lexer, name: string, uri?: string) {
	const arr = name.toUpperCase().split('.');
	let n = arr.shift()!;
	let cls = (uri ? lexers[uri]?.declaration[n] : findSymbol(lex, n)?.node) as ClassNode;
	if (!cls?.property || cls.def === false)
		return;
	uri ??= cls.uri;
	for (n of arr)
		if (!(cls = getClassOwnProp(lex, cls, n) as ClassNode))
			return;
	return cls.uri ??= uri, cls;
}

function isYieldsOperand(tk: Token): boolean {
	switch (tk.type) {
		case TokenType.Dot:
			return true;
		case TokenType.BlockEnd:
			return Boolean(tk.data ?? tk.in_expr !== undefined);
		case TokenType.BracketEnd:
		case TokenType.Number:
		case TokenType.String:
			return true;
		case TokenType.Identifier:
			return !tk.paraminfo;
		case TokenType.Reserved:
			return RESERVED_OP.includes(tk.content.toLowerCase(), 3);
		case TokenType.Operator:
			if (tk.op_type === 1)
				return true;
			switch (tk.content) {
				case '?': return Boolean(tk.ignore);
				case '%': return tk.previous_pair_pos !== undefined;
				case '++':
				case '--':	// postfix, true
					return !tk.topofline && isYieldsOperand(tk.previous_token ?? EMPTY_TOKEN);
			}
		// fall through
		default: return false;
	}
}

export function decltypeExpr(lex: Lexer, tk: Token, end_pos: number | Position, _this?: ClassNode): AhkSymbol[] {
	const stack: Token[] = [], op_stack: Token[] = [], { document, tokens } = lex;
	let operand = [0], pre = EMPTY_TOKEN, end: number, t, tt;
	if (typeof end_pos === 'object')
		end = document.offsetAt(end_pos);
	else end = end_pos;
	loop:
	while (tk && tk.offset < end) {
		switch (tk.type) {
			case TokenType.String:
			case TokenType.Number:
				if (check_concat())
					break loop;
				stack.push(tk), pre = tk;
				break;
			case TokenType.Identifier:
				if (check_concat())
					break loop;
				stack.push(tk), pre = tk;
				if (tk.symbol) {
					tk = lex.findToken(document.offsetAt(tk.symbol!.range.end), true);
					continue;
				} else if (tk.callsite) {
					if (tk.next_token_offset >= end || tk.next_token_offset === -1)
						break loop;
					stack.push(t = {
						content: '', type: TokenType.Invoke,
						paraminfo: tk.callsite.paraminfo ?? tk.paraminfo
					} as Token);
					tk = tokens[tk.next_token_offset];
					t.data = tk?.content === '(';
					if (!tk || !(tk = tokens[tk.next_pair_pos!])) {
						stack.length = 0;
						break loop;
					}
				}
				break;
			case TokenType.Dot:
				if ((tk = tokens[tk.next_token_offset])?.type === TokenType.Identifier) {
					t = tokens[tk.next_token_offset];
					if (t?.content === '[' && t.topofline < 1 || t?.content === '(' && !t.prefix_is_whitespace) {
						const call = { content: tk.content, type: TokenType.Invoke } as Token;
						stack.push(call);
						if (t.offset >= end)
							break loop;
						call.data = t.content === '(';
						call.paraminfo = t.paraminfo;
						if (!(tk = tokens[t.next_pair_pos!])) {
							stack.length = 0;
							break loop;
						}
						break;
					}
					if (t?.content === '%' && !t.prefix_is_whitespace && t.previous_pair_pos === undefined)
						skip_operand();
					else
						stack.push({ content: tk.content, type: TokenType.Invoke } as Token);
				} else if (tk?.type === TokenType.BracketStart) {
					if (tk.offset >= end)
						break loop;
					stack.push({
						content: '', type: TokenType.Invoke,
						data: tk.content === '(',
						paraminfo: tk.paraminfo
					} as Token);
					if (!(tk = tokens[tk.next_pair_pos!])) {
						stack.length = 0;
						break loop;
					}
				} else skip_operand();
				break;
			case TokenType.Operator:
				if (tk.content === '%' && tk.previous_pair_pos === undefined) {
					if (!tk.prefix_is_whitespace)
						skip_operand();
					else {
						if (check_concat())
							break loop;
						skip_operand();
					}
					break;
				}
			// fall through
			case TokenType.Assign:
				if (op_push(tk))
					break loop;
				break;
			case TokenType.BracketStart:
				if (!(tk = tokens[(t = tk).next_pair_pos!])) {
					stack.length = 0;
					break loop;
				}
				if (!t.symbol && (!t.prefix_is_whitespace || t.content === '[' && t.topofline < 1) &&
					(pre.op_type === 1 || [TokenType.Identifier, TokenType.Number, TokenType.String, TokenType.BracketEnd].includes(pre.type) ||
						pre.type === TokenType.BlockEnd && (tt = tokens[pre.previous_pair_pos!]) && (tt.data ?? tt.in_expr !== undefined))) {
					stack.push({
						content: '', type: TokenType.Invoke,
						paraminfo: t.paraminfo, data: t.content === '('
					} as Token);
				} else if (t.content === '[') {
					stack.push({ symbol: ARRAY } as Token);
				} else {
					if (check_concat())
						break loop;
					stack.push(t);
					if (t.symbol) {
						pre = tk;
						tk = lex.findToken(document.offsetAt(t.symbol!.range.end), true);
						continue;
					}
				}
				pre = tk;
				break;
			case TokenType.BlockStart:
				if (!(tk = tokens[(t = tk).next_pair_pos!])) {
					stack.length = 0;
					break loop;
				}
				stack.push(t);
				break;
			case TokenType.Comment:
			case TokenType.InlineComment:
			case TokenType.BlockComment:
				break;
			case TokenType.Comma:
				stack.length = op_stack.length = 0;
				pre = EMPTY_TOKEN, operand = [0];
				break;
			case TokenType.BlockEnd:
			case TokenType.BracketEnd:
				if (tk.offset === end - 1)
					break loop;
			// fall through
			default:
				stack.length = 0;
				break loop;
		}
		tk = tokens[tk.next_token_offset];
	}
	if (!stack.length)
		return [];
	while ((tk = op_stack.pop()!))
		calculate(tk);
	const result = new Set<AhkSymbol>;
	let syms: Set<AhkSymbol> | AhkSymbol[] = [], that;
	for (tk of stack) {
		if (tk.symbol) {
			if (tk.symbol.kind === SymbolKind.Property) {
				let prop = tk.symbol as Property;
				const cls = prop.parent as ClassNode;
				if ((prop = cls?.property?.[prop.name.toUpperCase()])) {
					if (!prop.get && ((t = prop).kind !== SymbolKind.Property || (t = prop.call)))
						syms = [t];
					else syms = decltypeReturns(prop, lexers[cls.uri!] ?? lex, cls);
				} else syms = [];
			} else syms = [tk.symbol], tk.symbol.uri ??= lex.uri;
		} else switch (tk.type) {
			case TokenType.Invoke: {
				const call = !!tk.data, name = tk.content.toLowerCase() || (call ? 'call' : '__item');
				syms = decltypeInvoke(lex, syms, name, call, tk.paraminfo, that);
				break;
			}
			case TokenType.Identifier: {
				const pos = document.positionAt(tk.offset);
				const r = findSymbol(lex, tk.content, SymbolKind.Variable, pos);
				if (!r) break;
				syms = new Set;
				const node = r.node;
				if (node.kind === SymbolKind.Variable) {
					if (r.uri !== lex.uri)
						pos.line = NaN;
					for (const n of decltypeVar(node, lexers[r.uri] ?? lex, pos, r.scope, _this))
						syms.add(n);
				} else if (syms.add(node), r.is_this !== undefined) {
					that = _this ?? node as ClassNode;
					if (_this && r.is_this === false)
						(node as ClassNode).prototype = _this.prototype;
					continue;
				}
				break;
			}
			case TokenType.Number:
				if (/^[-+]?(\d+$|0[xX])/.test(tk.content))
					syms = [INTEGER];
				else if (/^[-+]?\d+[.eE]/.test(tk.content))
					syms = [FLOAT];
				else syms = [NUMBER];
				break;
			case TokenType.String: syms = [STRING]; break;
			case TokenType.BlockStart:
				if (!(t = tk.data as ClassNode)) break;
				syms = [t], t.uri ??= lex.uri;
				if ((tt = !t.extends && t.property?.BASE)) {
					const tps = decltypeReturns(tt, lex, _this);
					if (tps.length < 2)
						t.base = tps[0];
					else {
						syms = [];
						for (const base of tps)
							syms.push({ ...t, base } as ClassNode);
					}
				}
				break;
			case TokenType.BracketStart: {
				const b = (t = tk.paraminfo?.comma)?.length ? t.at(-1)! : tk.next_token_offset;
				syms = decltypeExpr(lex, tokens[b], tk.next_pair_pos! - 1, _this);
				break;
			}
			default:
				if (tk.content === '||')
					for (const n of syms)
						result.add(n);
				syms = [];
				break;
		}
		that = undefined;
	}
	for (const n of syms)
		result.add(n);
	return [...result];
	function calculate(op: Token) {
		let l = operand.pop(), ret = { content: '', type: TokenType.Number } as Token;
		const rv = stack.splice(l ?? 0);
		if (l === undefined || !rv.length)
			return !(stack.length = 0);
		switch (op.op_type ?? (op.type === TokenType.Assign && 0)) {
			case -1:
				if (op.content === '&' && rv[0]?.offset && rv[0].type === TokenType.Identifier) {
					if (rv.length === 1)
						ret = { symbol: VARREF } as Token;
					else {
						const t = rv.at(-1)!;
						if (t.type !== TokenType.Invoke || t.data)
							return !(stack.length = 0);
						operand.push(stack.length);
						t.content = '__ref', t.data = true;
						stack.push(...rv);
						return;
					}
				}
			// fall through
			case 1:
				break;
			case 0: {
				const lv = stack.splice((l = operand.pop()) ?? 0);
				let s;
				if (l === undefined || !lv.length)
					return !(stack.length = 0);
				if (op.content.startsWith('.'))
					ret.type = TokenType.String;
				else if (op.content === ':=') {
					operand.push(stack.length), stack.push(...rv);
					return;
				} else if (['&&', 'and'].includes(s = op.content.toLowerCase())) {
					operand.push(stack.length);
					stack.push(ret), stack.push({ type: TokenType.Operator, content: '||', op_type: 0 } as Token);
					stack.push(...rv);
					return;
				} else if (['||', 'or', '??', '??=', ':'].includes(s)) {
					operand.push(stack.length);
					stack.push(...lv), stack.push({ type: TokenType.Operator, content: '||', op_type: 0 } as Token);
					stack.push(...rv);
					return;
				}
				break;
			}
			default: return !(stack.length = 0);
		}
		operand.push(stack.length), stack.push(ret);
	}
	function op_push(tk: Token) {
		const p2 = precedence(tk, false);
		let p1 = op_stack.length ? precedence(op_stack[op_stack.length - 1]) : -1;
		while (p2 <= p1) {
			if (calculate(op_stack.pop()!))
				return true;
			p1 = op_stack.length ? precedence(op_stack[op_stack.length - 1]) : -1;
		}
		if (tk.content === '?') {
			if (!tk.ignore)
				stack.splice(operand[operand.length - 1] ?? 0);
		} else
			op_stack.push(tk), !tk.op_type && operand.push(stack.length);
		pre = tk;
	}
	function check_concat() {
		if (isYieldsOperand(pre))
			return op_push(pre = { content: '.', type: TokenType.Operator, op_type: 0 } as Token);
	}
	function skip_operand() {
		let lk = tk;
		stack.splice(operand[operand.length - 1]);
		stack.push({ symbol: ANY } as Token);
		do {
			while (tk) {
				if (tk.type === TokenType.Identifier) {
					lk = tk, tk = tokens[tk.next_token_offset];
					if (!tk || tk.content !== '%' || tk.prefix_is_whitespace)
						break;
				} else if (tk.content === '%' && tk.previous_pair_pos === undefined) {
					lk = tokens[tk.next_pair_pos!], tk = tokens[lk?.next_token_offset];
					if (!tk || tk.type !== TokenType.Identifier || tk.prefix_is_whitespace)
						break;
				} else break;
			}
			if (tk && (tk.content === '[' || tk.content === '(' && !tk.prefix_is_whitespace)) {
				lk = tk, tk = tokens[tk.next_pair_pos!];
				if (!tk) break;
				lk = tk, tk = tokens[tk.next_token_offset];
			}
			if (tk?.type === TokenType.Dot && tk.offset < end)
				lk = tk, tk = tokens[tk.next_token_offset];
			else break;
		} while (tk);
		pre = tk = lk;
	}
	function precedence(tk: Token, in_stack = true) {
		if (tk.type === TokenType.Operator) {
			switch (tk.content.toLowerCase()) {
				case '++':
				case '--':
					return tk.op_type === -1 ? 77 : 82;
				case '||':
				case 'or': return 17;
				case '&&':
				case 'and': return 21;
				case 'is': return 28;
				case '>':
				case '<':
				case '>=':
				case '<=': return 34;
				case '=':
				case '==':
				case '!=':
				case '!==': return 30;
				case '~=': return 36;
				case '.': return 38;
				case '|': return 42;
				case '^': return 46;
				case '&': return tk.op_type === -1 ? 67 : 50;
				case '<<':
				case '>>':
				case '<<<': return 54;
				case '//': return 62;
				case '+':
				case '-': return tk.op_type === -1 ? 67 : 58;
				case '*':
				case '/': return 62;
				case '**': return 73;
				case 'not': return 25;
				case '!': return 67;
				case '?': return tk.ignore ? 85 : 11;
				case ':': return 11;
				default: return 0;
			}
		}
		if (tk.type === TokenType.Dot)
			return 86;
		if (tk.type === TokenType.Assign)
			return in_stack ? 7 : 99;
		if (tk.type === TokenType.Comma)
			return 6;
		return 0;
	}
}

export function decltypeInvoke(lex: Lexer, syms: Set<AhkSymbol> | AhkSymbol[], name: string, call: boolean, paraminfo?: ParamInfo, _this?: ClassNode) {
	const tps = new Set<AhkSymbol>;
	let that = _this;
	for (let n of syms) {
		const cls = n as ClassNode;
		that = _this ?? cls;
		switch (n.kind) {
			case 0 as SymbolKind: return [ANY];
			case SymbolKind.Class:
				if (call && name === 'call') {
					if (!(n = getClassMember(lex, cls, name, call)!))
						if ((n = invoke_meta_func(cls)!))
							break;
						else continue;
					const full = (n as Variable).full ?? '';
					if (full.startsWith('(ComObject)')) {
						const tks = lex.tokens, s = [];
						let tk = tks[tks[paraminfo?.offset!]?.next_token_offset];
						if (tk?.type === TokenType.String) {
							s.push(tk.content);
							if ((tk = tks[tk.next_token_offset])?.content === ',') {
								tk = tks[tk.next_token_offset];
								if (tk?.type === TokenType.String)
									s.push(tk.content), tk = tks[tk.next_token_offset];
							}
							if (tk?.content === ')')
								tps.add({
									kind: SymbolKind.Interface, name: 'ComObject',
									full: `ComObject<${s.join(', ')}>`, generic_types: [s],
									range: ZERO_RANGE, selectionRange: ZERO_RANGE
								} as ClassNode);
						}
						continue;
					}
					break;
				}
			// fall through
			case SymbolKind.Function:
			case SymbolKind.Method:
				if (call && name === 'call') {
					if (!(n as FuncNode).has_this_param || (that = undefined, !paraminfo))
						break;
					for (const that of decltypeExpr(lex, lex.findToken(paraminfo.offset + 1),
						paraminfo.comma[0] ?? paraminfo.end, _this))
						for (const t of decltypeReturns(n, lexers[n.uri!] ?? lex, that as ClassNode))
							tps.add(t);
					continue;
				}
			// fall through
			default:
				if (!(n = getClassMember(lex, cls, name, call)!))
					if ((n = invoke_meta_func(cls)!))
						break;
					else continue;
				if (n.kind !== SymbolKind.Property) {
					if ((n as FuncNode).eval) {
						// if (paraminfo) continue;
						const tt = decltypeReturns(n, lexers[n.uri!] ?? lex, that);
						for (const t of call ? decltypeInvoke(lex, tt, 'call', true) : tt)
							tps.add(t);
						continue;
					} else if (call) break;
					if (!paraminfo)
						tps.add(n);
					else for (const t of decltypeInvoke(lex, [n], '__item', false, paraminfo, that))
						tps.add(t);
					continue;
				} else if ((n as FuncNode).eval) {
					const tt = decltypeInvoke(lex, decltypeReturns(n, lexers[n.uri!] ?? lex, that), 'call', true);
					for (const t of call ? decltypeInvoke(lex, tt, 'call', true) : tt)
						tps.add(t);
					continue;
				} else if (call || paraminfo && !(n as Property).get?.params.length) {
					for (const t of decltypeInvoke(lex, decltypeReturns(n, lexers[n.uri!] ?? lex, that),
						call ? 'call' : '__item', call, paraminfo))
						tps.add(t);
					continue;
				}
				break;
		}
		for (const t of decltypeReturns(n, lexers[n.uri!] ?? lex, that))
			tps.add(t);
	}
	return tps;
	function invoke_meta_func(_this: ClassNode) {
		const n = getClassMember(lex, _this, call ? '__call' : '__get', call);
		if (!n) return;
		if (n.kind === SymbolKind.Method && !(n as FuncNode).eval)
			return n;
		const syms = n.kind === SymbolKind.Class ? [n] : !n.children ?
			decltypeReturns(n, lexers[n.uri!] ?? lex, that) : undefined;
		if (!syms?.length)
			return;
		for (const t of decltypeInvoke(lex, syms, 'call', true, paraminfo))
			tps.add(t);
	}
}

function decltypeByref(sym: Variable, lex: Lexer, types: AhkSymbol[], _this?: ClassNode) {
	const res = getCallInfo(lex, sym.selectionRange.start);
	if (!res || res.index < 0)
		return [];
	const { pos, index, kind } = res;
	const context = lex.getContext(pos);
	const tps = decltypeExpr(lex, context.token, context.range.end, _this);
	let iscall = true;
	if (tps.includes(ANY))
		return [ANY];
	if (!tps.length)
		return [];
	let prop = context.text ? '' : context.word.toLowerCase();
	if (kind === SymbolKind.Property)
		prop ||= '__item', iscall = false;
	else prop ||= 'call';
	for (const it of tps)
		if (resolve(it, prop, types))
			return [ANY];
	types = [...new Set(types)];
	return types.includes(ANY) ? [ANY] : types;
	function resolve(it: AhkSymbol, prop: string, types: AhkSymbol[], needthis = 0) {
		switch (it.kind) {
			case SymbolKind.Method:
				needthis++;
			// fall through
			case SymbolKind.Function:
				if (!iscall || prop !== 'call')
					break;
			// fall through
			case SymbolKind.Property: {
				const param = (it as FuncNode).params?.[index + needthis];
				let annotations;
				if (!param || !(annotations = param.type_annotations))
					break;
				for (const t of annotations) {
					if (t === VARREF)
						return true;
					if ((t as AhkSymbol).data !== VARREF)
						continue;
					types.push(...decltypeTypeAnnotation((t as ClassNode).generic_types?.[0] ?? [], lex,
						_this, getDeclareClass(lex, _this)?.type_params));
				}
				break;
			}
			case SymbolKind.Class: {
				let n = getClassMember(lex, it, prop, iscall);
				const cls = it as ClassNode;
				if (!n)
					break;
				if (iscall) {
					if (n.kind === SymbolKind.Class)
						n = getClassConstructor(n as ClassNode);
					else if ((n as FuncNode).full?.startsWith('(Object) static Call('))
						n = getClassMember(lex, cls.prototype!, '__new', true) ?? n;
					else if (n.kind === SymbolKind.Property || (n as FuncNode).eval) {
						let tps: AhkSymbol[] | Set<AhkSymbol> = decltypeReturns(n, lexers[n.uri!] ?? lex, cls);
						if (n.kind === SymbolKind.Property && (n as FuncNode).eval)
							tps = decltypeInvoke(lex, tps, 'call', true);
						tps.forEach(it => resolve(it, 'call', types, -1));
						return;
					}
					if (n?.kind === SymbolKind.Method)
						resolve(n, 'call', types, -1);
					return;
				} else if (n.kind === SymbolKind.Class)
					n = getClassMember(lex, n, '__item', false);
				else if (n.kind !== SymbolKind.Property)
					return;
				else if (!(n as FuncNode).params) {
					for (let t of decltypeReturns(n, lexers[n.uri!] ?? lex, cls))
						(t = getClassMember(lex, t, '__item', false)!) &&
							resolve(t, '', types);
					return;
				}
				n && resolve(n, '', types);
			}
		}
		return;
	}
}

function getDeclareClass(lex: Lexer, cls?: ClassNode): ClassNode | undefined {
	if (!cls || cls.children)
		return cls;
	const t = findSymbol(lex, cls.full.replace(/<.+/, ''))?.node as ClassNode;
	if (t?.prototype)
		return t;
}

function decltypeVar(sym: Variable, lex: Lexer, pos: Position, scope?: AhkSymbol, _this?: ClassNode): AhkSymbol[] {
	const name = sym.name.toUpperCase(), _def = sym, syms = sym.type_annotations ? [sym] : [];
	if (!scope)
		for (const uri in lex?.relevance) {
			const v = lexers[uri]?.declaration?.[name];
			v?.type_annotations && (syms.includes(v) || syms.push(v));
		}
	let ts: AhkSymbol[] | undefined, t;
	for (const sym of syms) {
		if ((t = sym.returns))
			sym.returns = undefined;
		ts = decltypeReturns(sym, lex, _this);
		t && (sym.returns = t);
		if (sym.is_param && sym.pass_by_ref) {
			const tt = new Set<AhkSymbol>;
			for (const t of ts) {
				if (t === VARREF)
					return [ANY];
				if (t.data === VARREF)
					resolveCachedTypes((t as ClassNode).generic_types?.[1] ?? [ANY], tt, lex, _this);
				else tt.add(t);
			}
			ts = [...tt];
		}
		if (ts.includes(ANY) && (ts = [ANY]) || !ts.includes(OBJECT))
			return ts;
		break;
	}
	ts ??= [], t = undefined;
	for (const it of (scope ?? lex).children as Variable[] ?? [])
		if (name === it.name.toUpperCase()) {
			if (it.kind === SymbolKind.Variable) {
				if (it.range.end.line > pos.line || (it.range.end.line === pos.line && it.range.end.character > pos.character))
					break;
				if (it.pass_by_ref || it.returns && (it.for_index === undefined || isVarInForBlock(it, t ??= lex.document.offsetAt(pos))))
					sym = it;
			} else return [it];
		}
	if (sym.for_index !== undefined) {
		if (sym === _def && !isVarInForBlock(sym, t ??= lex.document.offsetAt(pos)))
			return [];
		const tps = decltypeReturns(sym, lex, _this);
		for (const it of tps)
			if (resolve(it))
				return [ANY];
		ts = [...new Set(ts)];
		return ts.includes(ANY) ? [ANY] : ts;
		function resolve(it: AhkSymbol, invoke_enum = true) {
			let needthis = 0, cls: ClassNode | undefined;
			switch (it.kind) {
				case SymbolKind.Class: {
					const bases: ClassNode[] = [];
					if (invoke_enum && (t = getClassMember(lex, it, '__enum', true, bases))) {
						if (t.kind !== SymbolKind.Method)
							break;
						for (const tp of decltypeReturns(t, lexers[t.uri!] ?? lex, it as ClassNode))
							resolve(tp, false);
						break;
					} else if ((t = getClassMember(lex, it, 'call', true, bases))?.kind === SymbolKind.Method)
						needthis = -1, cls = it as ClassNode, it = t!;
					else break;
				}
				// fall through
				case SymbolKind.Method:
					needthis++;
				// fall through
				case SymbolKind.Function: {
					const param = (it as FuncNode).params?.[sym.for_index! + needthis];
					let annotations;
					if (!param || !(annotations = param.type_annotations))
						break;
					for (const t of annotations) {
						if (t === VARREF)
							return true;
						if ((t as AhkSymbol).data !== VARREF)
							continue;
						ts!.push(...decltypeTypeAnnotation((t as ClassNode).generic_types?.[0] ?? [], lex,
							cls, getDeclareClass(lex, cls)?.type_params));
					}
					break;
				}
			}
		}
	}
	if (sym.pass_by_ref && !sym.is_param)
		return decltypeByref(sym, lex, ts, _this);
	ts.push(...decltypeReturns(sym, lex, _this));
	ts = [...new Set(ts)];
	return ts.includes(ANY) ? [ANY] : ts;
}

function isVarInForBlock(it: Variable, offset: number) {
	const range = it.data as number[];
	return range[0] <= offset && offset < range[1];
}

function decltypeTypeAnnotation(annotations: (string | AhkSymbol)[], lex: Lexer, _this?: ClassNode, type_params?: Record<string, AhkSymbol>) {
	const types = new Set<string | AhkSymbol>;
	let is_typeof;
	for (let tp of annotations) {
		if (typeof tp === 'object') {
			types.add(tp);
			continue;
		}
		if ((is_typeof = tp.startsWith('typeof ')))
			tp = tp.substring(7);
		if ('\'"'.includes(tp[0]))
			types.add(STRING);
		else if (/^[-+]?(\d+$|0[xX])/.test(tp))
			types.add(INTEGER);
		else if (/^[-+]?\d+[.eE]/.test(tp))
			types.add(FLOAT);
		else types.add(`${is_typeof ? 'typeof ' : ''}${tp}`);
	}
	const tps = new Set<AhkSymbol>;
	resolveCachedTypes([...types], tps, lex, _this, type_params);
	return [...tps];
}

function resolveCachedTypes(tps: (string | AhkSymbol)[], resolved_types: Set<AhkSymbol>, lex: Lexer,
	_this?: ClassNode, type_params?: Record<string, AhkSymbol>) {
	let re: RegExp, i = -1, is_this, is_typeof, t, param, update;
	for (let tp of tps) {
		if (i++, typeof tp === 'string') {
			(is_typeof = tp.startsWith('typeof ')) && (tp = tp.substring(7));
			if ((param = type_params?.[tp.toUpperCase()]))
				resolveCachedTypes(_this!.generic_types?.[param.data as number] ?? (param.type_annotations || []),
					resolved_types, lex, _this, type_params);
			else if ((t = (is_this = tp === 'this') && _this || findSymbol(lex, tp)?.node as ClassNode))
				if (t.kind === SymbolKind.TypeParameter)
					update = true, tps[i] = '', tps.push(...decltypeTypeAnnotation(t.type_annotations || [], lex));
				else if (t.kind !== SymbolKind.Variable)
					resolved_types.add(t = !is_typeof && t.prototype || t), !is_this && (tps[i] = t);
		} else if (tp.kind === SymbolKind.TypeParameter)
			update = true, tps[i] = '', tps.push(...decltypeTypeAnnotation(tp.type_annotations || [], lex));
		else
			resolved_types.add(type_params ? resolve_generic_type(tp as ClassNode) : tp);
	}
	if (update)
		tps.push(...new Set(tps.splice(0).filter(Boolean)));
	function resolve_generic_type(cls: ClassNode): AhkSymbol {
		let generic_types = cls.generic_types;
		if (!generic_types)
			return cls;
		re ??= new RegExp(`[< ](${Object.keys(type_params!).join('|')})[,>]`, 'i');
		if (!re.test(cls.full))
			return cls;
		generic_types = generic_types.map(gt => gt.flatMap(tp => {
			if (typeof tp === 'object')
				return [resolve_generic_type(tp as ClassNode)];
			if ((param = type_params![tp.toUpperCase()]))
				return _this!.generic_types?.[param.data as number] ?? (param.type_annotations || []);
			return [tp];
		}));
		if (!generic_types.length)
			generic_types = undefined;
		return {
			...cls, generic_types,
			full: cls.full.replace(/<.+/, !generic_types ? '' :
				`<${generic_types.map(t => joinTypes(t)).join(', ')}>`)
		} as ClassNode;
	}
}

export function decltypeReturns(sym: AhkSymbol, lex: Lexer, _this?: ClassNode): AhkSymbol[] {
	let types: Set<AhkSymbol> | undefined, ct: Array<string | AhkSymbol> | undefined, is_typeof, has_obj;
	switch (!sym.cached_types) {
		case true: {
			const annotations = sym.type_annotations;
			if (!annotations) break;
			types = new Set;
			for (let tp of annotations) {
				if (typeof tp === 'object') {
					types.add(tp);
					continue;
				}
				if ((is_typeof = tp.startsWith('typeof ')))
					tp = tp.substring(7);
				if ('\'"'.includes(tp[0]))
					types.add(STRING);
				else if (/^[-+]?(\d+$|0[xX])/.test(tp))
					types.add(INTEGER);
				else if (/^[-+]?\d+[.eE]/.test(tp))
					types.add(FLOAT);
				else types.add(`${is_typeof ? 'typeof ' : ''}${tp}` as unknown as AhkSymbol);
			}
			if (types.has(ANY))
				return sym.cached_types = [ANY];
			sym.cached_types = [...types], has_obj = types.has(OBJECT);
		}
		// fall through

		default:
			resolveCachedTypes(ct = sym.cached_types!, types = new Set, lex, _this, _this && (sym.parent as ClassNode)?.type_params);
			if (!has_obj)
				return [...types];
	}

	let tps: AhkSymbol[];
	if (lex && sym.returns) {
		sym.cached_types = [ANY], tps = [];
		for (let i = 0, r = sym.returns, l = r.length; i < l; i += 2)
			tps.push(...decltypeExpr(lex, lex.findToken(r[i], true), r[i + 1], _this));
		if (types) {
			for (const n of new Set(tps as ClassNode[]))
				if (n.property && !n.name && !types.has(n))
					types.add(n), ct!.push(n);
			tps = [...types], sym.cached_types = ct;
		} else types = new Set(tps), sym.cached_types = tps = [...types];
	} else tps = types ? [...types] : [];
	return tps;
}

export function typeNaming(sym: AhkSymbol) {
	let s;
	switch (sym.kind) {
		case SymbolKind.Interface:
			return (sym as ClassNode).full;
		case SymbolKind.Class:
			s = sym as ClassNode;
			if (s.prototype)
				return `typeof ${s.full}`;
			return s.full || 'Object';
		case SymbolKind.Function: {
			if (sym.name) {
				let s = sym;
				const ps = [sym], names = [sym.name];
				while ((s.parent as FuncNode)?.params)
					ps.push(s = s.parent!), names.push(s.name);
				if (!names.includes('') && s.kind !== SymbolKind.Property) {
					if (s.kind !== SymbolKind.Function)
						names.splice(-1, 1, typeNaming(s));
					return names.reverse().join('~');
				}
			}
			const fn = sym as FuncNode;
			s = fn.full.replace(/^[^()]+/, '');
			if (s.length === fn.param_def_len) {
				if (fn.params.some(param => param.range_offset))
					s = `(${fn.params.map(param =>
						`${param.pass_by_ref ? '&' : ''}${param.name}${param.defaultVal === null || param.range_offset ?
							'?' : param.defaultVal ? ` := ${param.defaultVal}` : param.arr ? '*' : ''}`).join(', ')})`;
				s += ` => ${generateTypeAnnotation(sym) || 'void'}`;
			}
			return s;
		}
		case SymbolKind.String:
		case SymbolKind.Number:
			return (sym.data as string | number ?? sym.name).toString();
		case 0 as SymbolKind:
			return 'Any';
		case SymbolKind.Null:
			return 'unset';
		case SymbolKind.Method:
		case SymbolKind.Property:
			if ((s = (sym as FuncNode).full?.match(/^\((.+?)\)/)?.[1]))
				return `${s}${sym.static ? '.' : '#'}${sym.name}`;
		// fall through
		default: return 'unknown';
	}
}

export function generateTypeAnnotation(sym: AhkSymbol, lex?: Lexer, _this?: ClassNode) {
	return joinTypes((sym.type_annotations || decltypeReturns(sym, lexers[sym.uri!] ?? lex, _this)));
}

export function joinTypes(tps?: Array<string | AhkSymbol> | false) {
	if (!tps) return '';
	let ts = [...new Set(tps.map(s => typeof s === 'string' ? s : typeNaming(s)))];
	const t = ts.pop();
	if (!t) return '';
	(ts = ts.map(s => s.includes('=>') && !'"\''.includes(s[0]) ? `(${s})` : s)).push(t);
	return ts.join(' | ');
}

function resolveTypeAnnotation(annotation?: string) {
	if (annotation) {
		const lex = new Lexer(TextDocument.create('', 'ahk2', 0, `$:${annotation}`), undefined, -1);
		lex.parseScript();
		return lex.declaration.$?.type_annotations ?? false;
	}
	return false;
}

const MaybeLocalKind: SymbolKind[] = [SymbolKind.Variable, SymbolKind.Function, SymbolKind.Field];
export function findSymbol(lex: Lexer, fullname: string, kind?: SymbolKind, pos?: Position) {
	const names = fullname.toUpperCase().split(/[.#~]/), l = names.length - 1;
	let name = names.shift()!, notdef = true, uri, t;
	let res = lex.findSymbol(name, kind,
		!l && MaybeLocalKind.includes(kind!) ? pos : undefined);
	if (res === null)
		return;
	const scope = res?.scope;
	if (!res || res.is_global === 1)
		res = find_include_symbol(lex.relevance, name) ?? res;
	else if (res.is_global && res.node.kind === SymbolKind.Variable) {
		t = find_include_symbol(lex.relevance, name);
		if (t && (t.node.kind !== SymbolKind.Variable || t.node.def && !res.node.def))
			res = t;
	}
	if (kind === SymbolKind.Field)
		return res;
	if ((!res || res.node.kind === SymbolKind.Variable && ((notdef = !res.node.def) || res.is_global)) && (t = find_builtin_symbol(name)))
		res = { uri: t.uri!, node: t, is_global: true };
	else if (scope)
		scope.uri ??= lex.uri, res!.scope = scope;
	if (!res)
		return;
	let p = name.length, parent: AhkSymbol | undefined, node: typeof parent = res.node;
	node.uri ??= res.uri;
	for (name of names) {
		switch (fullname[p]) {
			default: return;
			case '#': if (!(node = (node as ClassNode).prototype)) return;
			// fall through
			case '.':
				if (!(node = getClassOwnProp(lex, parent = node as ClassNode, name)))
					return;
				break;
			case '~':
				if (!(node = (parent = node as FuncNode).declaration?.[name]))
					return;
				node.uri ??= parent.uri;
		}
		p += name.length + 1;
	}
	if (l) {
		if (kind === SymbolKind.Method && (t = (node as Property).call))
			t.uri ??= node.uri, node = t;
		res = { node, uri: node.uri!, parent };
	}
	return res;
	function find_builtin_symbol(name: string) {
		if ((t = ahkVars[name]))
			return t;
		for (const uri of [ahkUris.ahk2_h, ahkUris.ahk2])
			if ((t = lexers[uri]?.typedef[name]))
				return t.uri ??= uri, t;
		if (notdef && !l)
			if ((t = lexers[uri = ahkUris.winapi]?.declaration[name]))
				return t.uri ??= uri, t;
	}
	function find_include_symbol(list: Record<string, string>, name: string) {
		if (process.env.BROWSER)
			return;
		let ret, t;
		for (const uri in list) {
			if ((t = (lexers[uri] ?? openAndParse(restorePath(list[uri]), false))?.findSymbol(name, kind)))
				if (t.node.kind !== SymbolKind.Variable)
					return t;
				else if (!ret || t.node.def && !ret.node.def)
					ret = t;
		}
		return ret;
	}
}

export function findSymbols(lex: Lexer, context: Context) {
	const { text, word, range, kind, usage } = context;
	let t;
	t = context.symbol;
	if (t?.parent && !t.children)	// kind === SymbolKind.Property
		if ((t = getClassMember(lex, t.parent, t.name, t.def === false ? false : null)))
			return [{ node: t, uri: t.uri ?? lex.uri, parent: context.symbol!.parent }];
	if (text)
		return (t = findSymbol(lex, text, kind, range.end)) && [t];
	const syms = [], ismethod = kind === SymbolKind.Method || usage === USAGE.Write && null;
	const tps = decltypeExpr(lex, context.token, range.end);
	if (!word && tps.length) {
		for (const node of tps)
			syms.push({ node, uri: node.uri! });
		return syms;
	}
	for (const tp of tps)
		if ((t = getClassMember(lex, tp, word, ismethod)))
			syms.push({ node: t, uri: t.uri!, parent: tp });
	if (syms.length)
		return syms;
}

export function getCallInfo(lex: Lexer, position: Position, pi?: ParamInfo) {
	let pos: Position, index: number, kind: SymbolKind, pt: Token | undefined;
	const tokens = lex.tokens, offset = lex.document.offsetAt(position);
	function get(pi: ParamInfo) {
		const tk = tokens[pi.offset];
		pos = lex.document.positionAt(pi.offset);
		if (tk.type === TokenType.Identifier) {
			if (pt && position.line > lex.document.positionAt(pt.offset + pt.length).line && !isContinuousLine(pt, EMPTY_TOKEN))
				return;
			index = offset > pi.offset + tk.content.length ? 0 : -1;
		} else {
			const prev = tk.previous_token ?? EMPTY_TOKEN;
			if (prev.symbol || prev.ignore)
				return null;
			if ((index = 0, tk.content === '[')) {
				if (tk.topofline === 1 || !isYieldsOperand(tk.previous_token!))
					return;
				kind = SymbolKind.Property;
			} else if (tk.prefix_is_whitespace || !isYieldsOperand(prev))
				return;
		}
		if (index !== -1)
			for (const c of pi.comma)
				if (offset > c) ++index; else break;
		kind ??= pi.method ? SymbolKind.Method : SymbolKind.Function;
		return { name: pi.name ?? '', pos, index, kind, count: pi.count };
	}
	if (pi)
		return get(pi);
	let tk: Token | undefined = lex.findToken(offset), nk = pt = tk.previous_token;
	if (offset <= tk.offset && !(tk = nk))
		return;
	if (tk.callsite && offset > tk.offset + tk.length && position.line <= tk.callsite.range.end.line)
		return get(tk.paraminfo!);
	if (tk.topofline > 0)
		return;
	while (tk.topofline <= 0) {
		switch (tk.type) {
			case TokenType.BlockEnd:
				tk = tokens[tk.previous_pair_pos!];
				break;
			case TokenType.BracketEnd:
				tk = tokens[(nk = tk).previous_pair_pos!];
				tk = tk?.previous_token;
				break;
			case TokenType.BracketStart:
			case TokenType.Comma:
				if ((nk = tk, tk.paraminfo))
					return get(tk.paraminfo);
				break;
			case TokenType.Operator:
				if (tk.content === '%' && !tk.next_pair_pos)
					tk = tokens[tk.previous_pair_pos!];
			// fall through
			default: break;
		}
		if (!(tk = tk?.previous_token))
			break;
		if (tk.callsite && tk.paraminfo)
			return get(tk.paraminfo);
	}
}

let includeCache: Record<string, Record<string, string>> = {};
let includedCache: Record<string, Record<string, string>> = {};
export function updateIncludeCache() {
	includeCache = {}, includedCache = {};
	for (const lex of Object.values(lexers))
		traverseInclude(lex);
}
export function traverseInclude(lex: Lexer, included?: Record<string, string>) {
	const { uri, include } = lex;
	let hascache = true;
	let cache = includeCache[uri] ??= (hascache = false, { [uri]: lex.fsPath });
	included = ((included ??= includedCache[uri])) ? { ...included } : {};
	if (!lex.is_virtual)
		included[uri] = lex.fsPath;
	for (const u in include) {
		Object.assign(includedCache[u] ??= {}, included);
		if (!(lex = lexers[u]))
			continue;
		if (!cache[u]) {
			if (hascache && included[u])
				continue;
			const c = traverseInclude(lex, included);
			if (c[uri]) {
				cache = includeCache[uri] = Object.assign(c, cache);
			} else Object.assign(cache, c);
		} else if (!included[u])
			traverseInclude(lex, included);
	}
	return cache;
}

export function getSymbolDetail(sym: AhkSymbol, lex: Lexer, remove_re?: RegExp): string | MarkupContent {
	let detail = sym.markdown_detail;
	if (detail === undefined)
		return sym.detail ?? '';
	if (remove_re)
		detail = detail.replace(remove_re, '');
	detail = detail.replace(/\{@link(code|plain)?\b([^{}\n]*)\}/gm, (...m) => {
		let link: string = m[2]?.trim() ?? '', tag = '', name: string | undefined;
		const p = link.search(/[|\s]/);
		if (p !== -1)
			tag = link.substring(p + 1).trim(), link = link.slice(0, p).trim();
		if (lex && (name = link.match(/^(([\w.$#~]|[^\x00-\x7f])+)(\(\))?$/)?.[1])) {
			const n = findSymbol(lex, name, name.includes('.') ?
				link.endsWith(')') ? SymbolKind.Method : SymbolKind.Property :
				link.endsWith(')') ? SymbolKind.Function : SymbolKind.Class);
			if (n && (lex = lexers[n.uri])) {
				const { start: { line, character } } = n.node.selectionRange;
				const encode_params = encodeURIComponent(JSON.stringify([
					URI.parse(lex.document.uri).toJSON(),
					[-1, { selection: { startLineNumber: line + 1, startColumn: character + 1 } }]
				]));
				tag ||= link, link = `command:_workbench.open?${encode_params}`;
			}
		}
		return /^[a-z]+:/.test(link) && (tag ||= link) ? `[${m[1] === 'code' ? `\`${tag}\`` : tag}](${link})` : ` ${link} ${tag} `;
	});
	if (detail)
		return { kind: 'markdown', value: detail };
	return '';
}

export function getParamCount(fn: FuncNode) {
	const params = fn.params;
	let min = params.length, max = min;
	if (fn.variadic) {
		max = Infinity;
		if (min > 0 && params[min - 1].arr)
			min--;
	}
	while (min > 0 && params[min - 1].defaultVal !== undefined)
		--min;
	for (let i = 0; i < min; ++i)
		if (params[i].defaultVal === false)
			--min;
	return { min, max, has_this_param: fn.has_this_param };
}

export function makeDupError(a: AhkSymbol, b: AhkSymbol): string {
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
					return diagnostic.assignerr('Func', a.name);
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

export function checkDupError(decs: Record<string, AhkSymbol>, syms: AhkSymbol[], lex: Lexer) {
	const { children, diagnostics, uri, relevance } = lex;
	const severity = DiagnosticSeverity.Error;
	let l = '', v1: Variable, v2: Variable;
	if (ahkVersion < alpha_11)
		Object.assign(relevance, { [ahkUris.ahk2]: 1, [ahkUris.ahk2_h ?? '\0']: 1 });
	for (const it of syms) {
		if (!it.name || it.selectionRange === ZERO_RANGE)
			continue;
		let is_var;
		switch ((v1 = it as Variable).kind) {
			case SymbolKind.Variable:
				v1.assigned ||= !!v1.returns, is_var = true;
			// fall through
			case SymbolKind.Class:
			case SymbolKind.Function:
			case SymbolKind.Module:
				v2 = decs[l = it.name.toUpperCase()];
				if (l.substring(0, 2) === 'A_' && ahkVars[l]) {
					if (is_var) continue;
					if ((it as FuncNode).params)
						it.has_warned ??= diagnostics.push({
							message: diagnostic.conflictserr('function', 'built-in variable', it.name),
							range: it.selectionRange
						});
				}
				if (syms === children)
					it.uri = uri;
				else if (v2 && !relevance[v2.uri!]) {
					decs[l] = it;
					continue;
				}
				if (!v2)
					decs[l] = it;
				else if (v2.is_global) {
					if (is_var) {
						if (v1.def && v2.kind !== SymbolKind.Variable) {
							if (v1.assigned !== 1)
								it.has_warned ??= diagnostics.push({ message: diagnostic.assignerr(v2.kind === SymbolKind.Function ? 'Func' : 'Class', it.name), range: it.selectionRange, severity });
							continue;
						}
					} else if (v2.kind === SymbolKind.Function) {
						it.has_warned ??= diagnostics.push({ message: makeDupError(v2, it), range: it.selectionRange, severity });
						continue;
					} else if (v2.def && v2.assigned !== 1)
						v2.has_warned ??= diagnostics.push({ message: diagnostic.assignerr(it.kind === SymbolKind.Function ? 'Func' : 'Class', it.name), range: v2.selectionRange, severity });
					decs[l] = it;
				} else if (is_var) {
					if (v2.kind === SymbolKind.Variable) {
						if (v1.def && !v2.def)
							decs[l] = it;
						else v2.assigned ||= v1.assigned;
					} else if (v1.def) {
						delete v1.def;
						if (v1.assigned !== 1)
							it.has_warned ??= diagnostics.push({ message: makeDupError(v2, it), range: it.selectionRange, severity });
					}
				} else {
					if (v2.kind === SymbolKind.Variable) {
						if (v2.def) {
							delete v2.def;
							if (v2.assigned !== 1)
								v2.has_warned ??= diagnostics.push({ message: makeDupError(it, v2), range: v2.selectionRange, severity });
						}
						decs[l] = it;
					} else if (v2.def !== false)
						it.has_warned ??= diagnostics.push({ message: makeDupError(v2, it), range: it.selectionRange, severity });
					else if (v1.def !== false)
						decs[l] = it;
				}
				break;
		}
	}
}

export function isContinuousLine(lk: Token, tk: Token, parent?: AhkSymbol): boolean {
	switch (lk.type) {
		case TokenType.EOF:
		case TokenType.Comma:
		case TokenType.Assign:
		case TokenType.BracketStart:
			return true;
		case TokenType.Operator:
			if (lk.ignore)
				return false;
			if (!/^(%|\+\+|--)$/.test(lk.content))
				return true;
		// fall through
		default:
			switch (tk.type) {
				case TokenType.Dot:
				case TokenType.Comma:
				case TokenType.Assign:
					return true;
				case TokenType.Operator:
					return !/^(!|~|not|%|\+\+|--)$/i.test(tk.content) && (
						!(parent as FuncNode)?.has_this_param || !allIdentifierChar.test(tk.content) ||
						parent!.returns?.[1] !== 0 || parent!.kind === SymbolKind.Function);
				// case TokenType.END_BLOCK:
				// case TokenType.END_EXPR:
				// 	return false;
				case TokenType.String:
					if (tk.ignore)
						return true;
				// fall through
				default:
					return false;
			}
	}
}

export function fixupFormatOptions(opts: FormatOptions) {
	if (typeof opts.brace_style === 'string') {
		switch (opts.brace_style) {
			case '0':
			case 'Allman': opts.brace_style = 0; break;
			case '1':
			case 'One True Brace': opts.brace_style = 1; break;
			case '-1':
			case 'One True Brace Variant': opts.brace_style = -1; break;
			default: delete opts.brace_style; break;
		}
	}
	for (const k of ['array_style', 'object_style'] as const) {
		const v = opts[k];
		if (typeof v === 'string')
			opts[k] = OBJECT_STYLE[v];
	}
	return opts;
}