/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import {
	ColorInformation,
	Diagnostic,
	DiagnosticSeverity,
	DocumentSymbol,
	FoldingRange,
	MarkupContent,
	Position,
	Range,
	SemanticTokensBuilder,
	SymbolInformation,
	SymbolKind
} from 'vscode-languageserver';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { builtin_ahkv1_commands, builtin_variable, builtin_variable_h } from './constants';
import { action, completionitem, diagnostic, warn } from './localize';
import {
	a_vars, ahk_version, ahkuris, ahkvars, alpha_3, connection,
	hoverCache, isahk2_h, lexers, libdirs, libfuncs, locale, openAndParse, openFile,
	restorePath, rootdir, setTextDocumentLanguage, symbolProvider, utils, workspaceFolders
} from './common';
import { ActionType, BlockStyle, BraceStyle, CallWithoutParentheses, CfgKey, FormatOptions, getCfg } from '../../util/src/config';
import { shouldExclude } from '../../util/src/exclude';

export interface ParamInfo {
	offset: number
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
	number,
	operator
}

export enum SemanticTokenModifiers {
	static = 1,		// true
	readonly = 2,
	definition = 4,
	defaultLibrary = 8,
	deprecated = 16,
}

export interface AhkSymbol extends DocumentSymbol {
	cached_types?: Array<string | AhkSymbol>
	children?: AhkSymbol[]
	data?: unknown
	def?: boolean
	full?: string
	has_warned?: boolean | number
	markdown_detail?: string
	ignore?: boolean
	overwrite?: number
	parent?: AhkSymbol
	returns?: number[] | null
	static?: boolean | null
	type_annotations?: Array<string | AhkSymbol> | false
	uri?: string
}

export interface FuncNode extends AhkSymbol {
	alias?: boolean
	assume: FuncScope
	closure?: boolean
	params: Variable[]
	param_offsets: number[]
	param_def_len: number
	global: Record<string, Variable>
	local: Record<string, Variable>
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
	arr?: boolean
	assigned?: boolean | 1		// 1, ??=
	decl?: boolean
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
	callsite?: CallSite
	content: string
	data?: unknown
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
	semantic?: SemanticToken
	skip_pos?: number
	symbol?: AhkSymbol
	topofline: number
	type: string
}

export interface Context {
	text: string;
	word: string;
	range: Range;
	kind: SymbolKind;
	linetext: string;
	token: Token;
	symbol?: AhkSymbol;
};

interface ParamList extends Array<Variable> {
	format?: (params: Variable[]) => void
	hasref?: boolean
	offset?: number[]
	full?: string
	variadic?: boolean
}
/** Flags used for formatter directives and other lexer conditions. */
export interface Flag {
	array_style?: BlockStyle,
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
	last_text: string,
	last_word: string,
	loop_block: number,
	mode: string,
	object_style?: BlockStyle,
	parent: Flag,
	start_line_index: number,
	ternary_depth?: number,
	ternary_indent?: number,
	try_block: boolean
};

export interface InternalFormatOptions {
	array_style: BlockStyle;
	brace_style: BraceStyle;
	break_chained_methods: boolean;
	ignore_comment: boolean;
	indent_string: string;
	indent_between_hotif_directive: boolean;
	keyword_start_with_uppercase: boolean;
	max_preserve_newlines: number;
	object_style: BlockStyle;
	preserve_newlines: boolean;
	space_before_conditional: boolean;
	space_after_double_colon: boolean;
	space_in_empty_paren: boolean;
	space_in_other: boolean;
	space_in_paren: boolean;
	switch_case_alignment: boolean;
	symbol_with_same_case: boolean;
	white_space_before_inline_comment: string;
	wrap_line_length: number;
}

/**
 * When not provided a value, returns the default internal formatter options.
 * Otherwise, properties of the provided value are preserved and merged with the defaults.
 */
export const newInternalFormatOptions = (partial: Partial<InternalFormatOptions> = {}): InternalFormatOptions => ({
	array_style: 'expand',
	brace_style: 'Preserve',
	break_chained_methods: false,
	ignore_comment: false,
	indent_string: '\t',
	indent_between_hotif_directive: false,
	keyword_start_with_uppercase: false,
	max_preserve_newlines: 3,
	object_style: 'expand',
	preserve_newlines: true,
	space_before_conditional: true,
	space_after_double_colon: true,
	space_in_empty_paren: false,
	space_in_other: true,
	space_in_paren: false,
	switch_case_alignment: false,
	symbol_with_same_case: false,
	white_space_before_inline_comment: '',
	wrap_line_length: 0,
	...partial
});

export const mapToInternalFormatOptions = (extOptions: Partial<FormatOptions>): InternalFormatOptions => {
	const defaultOptions = newInternalFormatOptions();
	const result =  {
		array_style: extOptions.arrayStyle ?? defaultOptions.array_style,
		brace_style: extOptions.braceStyle ?? defaultOptions.brace_style,
		break_chained_methods: extOptions.breakChainedMethods ?? defaultOptions.break_chained_methods,
		ignore_comment: extOptions.ignoreComment ?? defaultOptions.ignore_comment,
		indent_string: extOptions.indentString ?? defaultOptions.indent_string,
		indent_between_hotif_directive: extOptions.indentBetweenHotIfDirectives ?? defaultOptions.indent_between_hotif_directive,
		keyword_start_with_uppercase: extOptions.keywordStartWithUppercase ?? defaultOptions.keyword_start_with_uppercase,
		max_preserve_newlines: extOptions.maxPreserveNewlines ?? defaultOptions.max_preserve_newlines,
		object_style: extOptions.objectStyle ?? defaultOptions.object_style,
		preserve_newlines: extOptions.preserveNewlines ?? defaultOptions.preserve_newlines,
		space_before_conditional: extOptions.spaceBeforeConditional ?? defaultOptions.space_before_conditional,
		space_after_double_colon: extOptions.spaceAfterDoubleColon ?? defaultOptions.space_after_double_colon,
		space_in_empty_paren: extOptions.spaceInEmptyParen ?? defaultOptions.space_in_empty_paren,
		space_in_other: extOptions.spaceInOther ?? defaultOptions.space_in_other,
		space_in_paren: extOptions.spaceInParen ?? defaultOptions.space_in_paren,
		switch_case_alignment: extOptions.switchCaseAlignment ?? defaultOptions.switch_case_alignment,
		symbol_with_same_case: extOptions.symbolWithSameCase ?? defaultOptions.symbol_with_same_case,
		white_space_before_inline_comment: extOptions.whitespaceBeforeInlineComment ?? defaultOptions.white_space_before_inline_comment,
		wrap_line_length: extOptions.wrapLineLength ?? defaultOptions.wrap_line_length,
	}
	return result;
};

namespace SymbolNode {
	export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range, children?: AhkSymbol[]): AhkSymbol {
		return { name, kind, range, selectionRange, children };
	}
}

namespace FuncNode {
	export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range, params: ParamList, children?: AhkSymbol[], isstatic?: boolean): FuncNode {
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
		return { name, kind, range, selectionRange: { ...range } };
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

String.prototype.trim = function () {
	return this.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
};

String.prototype.trimStart = function () {
	return this.replace(/^[ \t\r\n]+/, '');
};

String.prototype.trimEnd = function () {
	return this.replace(/[ \t\r\n]+$/, '');
};

const colorregexp = new RegExp(/['" \t](c|background|#)?((0x)?[\da-f]{6}([\da-f]{2})?|(black|silver|gray|white|maroon|red|purple|fuchsia|green|lime|olive|yellow|navy|blue|teal|aqua))\b/i);
const colortable = JSON.parse('{ "black": "000000", "silver": "c0c0c0", "gray": "808080", "white": "ffffff", "maroon": "800000", "red": "ff0000", "purple": "800080", "fuchsia": "ff00ff", "green": "008000", "lime": "00ff00", "olive": "808000", "yellow": "ffff00", "navy": "000080", "blue": "0000ff", "teal": "008080", "aqua": "00ffff" }');
const whitespace = " \t\r\n", punct = '+ - * / % & ++ -- ** // = += -= *= /= //= .= == := != !== ~= > < >= <= >>> >> << >>>= >>= <<= && &= | || ! ~ , ?? ??= : ? ^ ^= |= =>'.split(' ');
const line_starters = 'try,throw,return,global,local,static,if,switch,case,for,while,loop,continue,break,goto'.split(',');
const reserved_words = line_starters.concat(['class', 'in', 'is', 'isset', 'contains', 'else', 'until', 'catch', 'finally', 'and', 'or', 'not', 'as', 'super']);
const MODE = { BlockStatement: 'BlockStatement', Statement: 'Statement', ObjectLiteral: 'ObjectLiteral', ArrayLiteral: 'ArrayLiteral', Conditional: 'Conditional', Expression: 'Expression' };
const KEYS_RE = /^(alttab|alttabandmenu|alttabmenu|alttabmenudismiss|shiftalttab|shift|lshift|rshift|alt|lalt|ralt|control|lcontrol|rcontrol|ctrl|lctrl|rctrl|lwin|rwin|appskey|lbutton|rbutton|mbutton|wheeldown|wheelup|wheelleft|wheelright|xbutton1|xbutton2|(0*[2-9]|0*1[0-6]?)?joy0*([1-9]|[12]\d|3[012])|space|tab|enter|escape|esc|backspace|bs|delete|del|insert|ins|pgdn|pgup|home|end|up|down|left|right|printscreen|ctrlbreak|pause|help|sleep|scrolllock|capslock|numlock|numpad0|numpad1|numpad2|numpad3|numpad4|numpad5|numpad6|numpad7|numpad8|numpad9|numpadmult|numpadadd|numpadsub|numpaddiv|numpaddot|numpaddel|numpadins|numpadclear|numpadleft|numpadright|numpaddown|numpadup|numpadhome|numpadend|numpadpgdn|numpadpgup|numpadenter|f1|f2|f3|f4|f5|f6|f7|f8|f9|f10|f11|f12|f13|f14|f15|f16|f17|f18|f19|f20|f21|f22|f23|f24|browser_back|browser_forward|browser_refresh|browser_stop|browser_search|browser_favorites|browser_home|volume_mute|volume_down|volume_up|media_next|media_prev|media_stop|media_play_pause|launch_mail|launch_media|launch_app1|launch_app2|vk[a-f\d]{1,2}(sc[a-f\d]+)?|sc[a-f\d]+|`[;{]|[\x21-\x7E])$/i;
const EMPTY_TOKEN: Token = { type: '', content: '', offset: 0, length: 0, topofline: 0, next_token_offset: -1 };
export const ASSIGN_TYPE = [':=', '??='];
const OBJECT_STYLE: Record<BlockStyle, BlockStyle> = { collapse: 'collapse', expand: 'expand', none: 'none' };
const ZERO_RANGE = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
const META_FUNCNAME = ['__NEW', '__INIT', '__ITEM', '__ENUM', '__GET', '__CALL', '__SET', '__DELETE'];
export const ANY = create_prototype('Any');
const FLOAT = create_prototype('Float', SymbolKind.Number);
const INTEGER = create_prototype('Integer', SymbolKind.Number);
const NUMBER = create_prototype('Number', SymbolKind.Number);
export const STRING = create_prototype('String', SymbolKind.String);
const ARRAY = create_prototype('Array', SymbolKind.Class, 'Array');
const OBJECT = create_prototype('Object', SymbolKind.Class);
export const UNSET = create_prototype('unset', SymbolKind.Null);
export const VARREF = create_prototype('VarRef', SymbolKind.Class, 'Any');
export const $DLLFUNC = { ...STRING };
export const $DIRPATH = { ...STRING };
export const $FILEPATH = { ...STRING };
export const THIS: Variable = {
	def: true,
	detail: completionitem.this(),
	is_param: true,
	kind: SymbolKind.Variable,
	name: 'this',
	range: ZERO_RANGE,
	selectionRange: ZERO_RANGE,
};
export const SUPER: Variable = { ...THIS, name: 'super', detail: completionitem.super() };

export const allIdentifierChar = new RegExp('^[^\x00-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7f]+$');
let commentTagRegex = new RegExp('^;;\\s*(?<tag>.+)');
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

export class Lexer {
	public actionWhenV1Detected?: ActionType = 'Continue';
	public actived = false;
	public beautify: (options: Partial<FormatOptions>, range?: Range) => string;
	public checkmember: boolean | undefined;
	public children: AhkSymbol[] = [];
	public d = 0;
	public d_uri = '';
	public declaration: Record<string, AhkSymbol> = {};
	public diagnostics: Diagnostic[] = [];
	public last_diags = 0;
	public dlldir = new Map<number, string>();
	public dllpaths: string[] = [];
	public document: TextDocument;
	public find_token: (offset: number, ignore?: boolean) => Token;
	public foldingranges: FoldingRange[] = [];
	public fsPath = '';
	public get_token: (offset?: number, ignorecomment?: boolean) => Token;
	public need_scriptdir = false;
	public include: Record<string, string> = {};
	public includedir = new Map<number, string>();
	public isparsed = false;
	public is_virtual = false;		// uris like `vscode-local-history:`
	public labels: Record<string, AhkSymbol[]> = {};
	public libdirs: string[] = [];
	public linepos: Record<number, number> = {};
	public maybev1?: number;
	public object: { method: Record<string, FuncNode[]>, property: Record<string, Variable[]> } = { method: {}, property: {} };
	public parseScript: () => void;
	public scriptdir = '';
	public scriptpath = '';
	public STB = new SemanticTokensBuilder;
	public symbolInformation: SymbolInformation[] | undefined;
	public texts: Record<string, string> = {};
	public typedef: Record<string, AhkSymbol> = {};
	public tokenranges: { start: number, end: number, type: number, previous?: number }[] = [];
	public tokens: Record<number, Token> = {};
	public uri = '';
	public workspaceFolder = '';
	private hotstringExecuteAction = false;
	constructor(document: TextDocument, scriptdir?: string, d = 0) {
		let begin_line: boolean, callWithoutParentheses: CallWithoutParentheses, comments: Record<number, Token>;
		let continuation_sections_mode: boolean | null, currsymbol: AhkSymbol | undefined;
		let customblocks: { region: number[], bracket: number[] };
		let dlldir: string, includedir: string, includetable: Record<string, string>;
		let input: string, input_length: number, input_wanted_newline: boolean;
		let last_comment_fr: FoldingRange | undefined, last_LF: number, lst: Token;
		let n_newlines: number, parser_pos: number, sharp_offsets: number[];
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const _this = this, uri = URI.parse(document.uri);
		let allow_$ = true, block_mode = true, format_mode = false, h = isahk2_h;
		let in_loop = false, maybev1 = 0, requirev2 = false, string_mode = false;
		let output_lines: { text: string[], indent: number }[], flags: Flag, previous_flags: Flag, flag_store: Flag[];
		let opt: InternalFormatOptions, preindent_string: string, indent_string: string, space_in_other: boolean, ck: Token;
		let token_text: string, token_text_low: string, token_type: string, last_type: string, last_text: string;
		let output_space_before_token: boolean | undefined, is_conditional: boolean;
		const handlers: Record<string, () => void> = {
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
			allow_$ = false;
			this.uri = document.uri.toLowerCase();
			this.setWorkspaceFolder();
			this.scriptpath = (this.fsPath = uri.fsPath).replace(/[\\/][^\\/]+$/, '');
			this.initLibDirs(scriptdir);
			if (uri.scheme !== 'file' && uri.fsPath.substring(1, 3) === ':\\')
				this.is_virtual = true;
		}

		this.get_token = function (offset?: number, ignore = false): Token {
			let p: number, t: Token, b: Token;
			if (offset !== undefined)
				p = parser_pos, b = lst, parser_pos = offset;
			for (; (t = get_next_token()).type.endsWith('COMMENT') && ignore;);
			if (offset !== undefined)
				parser_pos = p!, lst = b!;
			return t;
		}

		this.find_token = function (offset: number, ignore = false): Token {
			let i = offset, c = input.charAt(offset), tk: Token | undefined;
			const tks = _this.tokens;
			const eof = { ...(tks[-1] ?? EMPTY_TOKEN), type: '' };
			if (!c)
				return eof;
			if (whitespace.includes(c)) {
				while (whitespace.includes((c = input.charAt(++i)) || '\0'))
					continue;
				if ((tk = tks[i]))
					return tk;
				if (!c && (tk = tks[_this.tokenranges[_this.tokenranges.length - 1]?.start]))
					if (tk.offset <= offset && offset < tk.offset + tk.length)
						return tk;
					else tk = undefined;
			} else {
				if (isIdentifierChar(c.charCodeAt(0))) {
					while (isIdentifierChar(input.charCodeAt(--i)))
						continue;
				} else {
					while (!whitespace.includes(c = input.charAt(--i)))
						if (isIdentifierChar(c.charCodeAt(0)))
							break;
				}
				if (!(tk = tks[++i] ?? tks[i - 1]) && input.charAt(i) === '.') {
					while (isIdentifierChar(input.charCodeAt(--i)))
						continue;
					tk = tks[i + 1];
				}
			}
			if (!tk && input.slice(i = input.lastIndexOf('\n', i) + 1, offset).trim())
				tk = _this.find_token(i);
			if (tk) {
				if (tk.offset <= offset && offset < tk.offset + tk.length)
					return tk;
				while ((tk = tks[tk.next_token_offset])) {
					if (tk.offset > offset)
						break;
					if (offset < tk.offset + tk.length)
						return tk;
				}
			}
			return !ignore && _this.findStrOrComment(offset) || eof;
		}

		this.beautify = function (options: Partial<FormatOptions>, range?: Range) {
			let end_pos: number;
			!_this.isparsed && _this.parseScript();

			opt = mapToInternalFormatOptions(options);

			last_type = last_text = '', begin_line = true, lst = { ...EMPTY_TOKEN };
			last_LF = -1, end_pos = input_length, ck = _this.get_token(0);
			preindent_string = input.substring(input.lastIndexOf('\n', parser_pos = ck.offset) + 1, parser_pos);
			is_conditional = output_space_before_token = false, format_mode = true;
			indent_string = opt.indent_string ?? '\t', space_in_other = opt.space_in_other ?? true;
			output_lines = [create_output_line()];
			flag_store = [], flags = undefined as unknown as Flag;
			set_mode(MODE.BlockStatement);

			if (opt.symbol_with_same_case)
				symbolProvider({ textDocument: _this.document });

			if (range) {
				end_pos = _this.document.offsetAt(range.end);
				ck = _this.find_token(_this.document.offsetAt(range.start));
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
						if (last_type === 'TK_RESERVED' && ['try', 'else', 'finally'].includes(last_text))
							indent();
						if (!flags.declaration_statement || !just_added_newline())
							print_newline();
						if (pt?.type) {
							while ((ck = _this.find_token(pt.skip_pos ?? pt.offset + pt.length)).offset < end_pos)
								pt = ck;
							for (end = pt.offset + pt.length; ' \t'.includes(input.charAt(end) || '\0'); end++);
							if (!whitespace.includes(input.charAt(end)))
								end = pt.offset + pt.length;
							while (just_added_newline())
								output_lines.pop();
						}
						range.end = _this.document.positionAt(end);
					}
					while (flags.mode === MODE.Statement)
						restore_mode();
					break;
				} else if (is_conditional &&
					!(is_conditional = n_newlines ? !conditional_is_end(ck) :
						token_type !== 'TK_START_BLOCK' || ck.data as boolean)) {
					restore_mode();
					last_type = 'TK_END_EXPR';
					flags.last_text = ')';
					input_wanted_newline = n_newlines > 0;
				} else if ((input_wanted_newline = n_newlines > 0)) {
					if (continuation_sections_mode !== false) {
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
						return /^(!|~|not|%|\+\+|--)$/i.test(tk.content) &&
							!is_line_continue(tk.previous_token ?? EMPTY_TOKEN, tk);
					case 'TK_STRING':
						return !tk.ignore &&
							!is_line_continue(tk.previous_token ?? EMPTY_TOKEN, tk);
					default: {
						const lk = tk.previous_token ?? EMPTY_TOKEN;
						switch (lk.type) {
							case 'TK_COMMA':
							case 'TK_EQUALS':
								return false;
							case 'TK_OPERATOR':
								return /^(\+\+|--|%)$/.test(lk.content);
						}
					}
				}
				return true;
			}
		};

		function format_params_default_val(tokens: Record<number, Token>, params: ParamList) {
			opt = newInternalFormatOptions({ max_preserve_newlines: 1 });
			space_in_other = true, indent_string = '\t';
			format_mode = true, preindent_string = '';
			delete params.format;
			for (const param of params) {
				if (!param.range_offset)
					continue;
				const [start, end] = param.range_offset;
				last_type = last_text = '', output_lines = [create_output_line()];
				output_space_before_token = false, flag_store = [], flags = undefined as unknown as Flag, set_mode(MODE.Expression);
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
				let _low = '', i = 0, j = 0, l = 0, blocks = 0, isstatic = false, rg = make_range(0, 0);
				let _parent = DocumentSymbol.create('', undefined, SymbolKind.Namespace, rg, rg, this.children) as ClassNode;
				let tokens: Token[] = [], tk: Token, lk: Token, _cm: Token | undefined;

				this.clear(), customblocks = { region: [], bracket: [] }, comments = {}, sharp_offsets = [];
				input = this.document.getText(), input_length = input.length, includedir = this.scriptpath;
				lst = { ...EMPTY_TOKEN }, begin_line = true, parser_pos = 0, last_LF = -1, currsymbol = last_comment_fr = undefined;
				includetable = this.include, _parent.property = _parent.$property = this.declaration;

				for (; get_next_token().length;);
				tokens = Object.values(this.tokens), l = tokens.length;

				while (i < l) {
					switch ((tk = tokens[i]).type) {
						case 'TK_WORD':
							if (!tk.topofline && !isstatic) {
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
									_parent.children?.push(tn), tn.static = isstatic, tn.full = `(${cls.join('.')}) ${isstatic ? 'static ' : ''}` + tn.name;
									(isstatic ? _parent.property : _parent.$property!)[_low] ??= tn;
									if ((_cm = comments[tn.selectionRange.start.line]))
										set_detail(_cm.symbol = tn, _cm);
									(this.object.property[_low] ??= []).push(tn);
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
									fn.full += ` => ${join_types(fn.type_annotations) || 'void'}`;
									tk.symbol = tk.definition = fn;
									if (!META_FUNCNAME.includes(_low = fn.name.toUpperCase()))
										tk.semantic = {
											type: blocks ? SemanticTokenTypes.method : SemanticTokenTypes.function,
											modifier: SemanticTokenModifiers.definition | SemanticTokenModifiers.readonly
												| (isstatic as unknown as number)
										};
									if (blocks) {
										fn.has_this_param = true, fn.kind = SymbolKind.Method;
										fn.full = `(${cls.join('.')}) ${fn.full}`, fn.parent = _parent;
										(this.object.method[_low] ??= []).push(fn);
									}
									if ((_cm = comments[fn.selectionRange.start.line]))
										set_detail(_cm.symbol = fn, _cm);
									_parent.children?.push(fn);
									const decl = isstatic ? _parent.property : _parent.$property!;
									if (decl[_low])
										(decl[_low] as Property).call = fn;
									else decl[_low] = fn;
								} else if (!blocks && (['=>', ':', ','].includes(lk.content) || lk.topofline)) {
									const tn = Variable.create(tk.content, SymbolKind.Variable, rg = make_range(tk.offset, tk.length));
									tk.symbol = tk.definition = tn, tn.assigned = tn.def = true;
									tk.semantic = {
										type: SemanticTokenTypes.variable,
										modifier: SemanticTokenModifiers.definition |
											(lk.content === '=>' ? SemanticTokenModifiers.readonly : 0)
									};
									if ((_cm = comments[tn.selectionRange.start.line]))
										set_detail(_cm.symbol = tn, _cm);
									if (['=>', ':'].includes(lk.content))
										parse_types(tn);
									else if (lk.content !== ',')
										--j;
									_parent.children!.push(tn);
									_parent.property[tn.name.toUpperCase()] ??= tn;
								}
							}
							i = j + 1, isstatic = false;
							break;
						case 'TK_RESERVED':
							isstatic = false;
							if (tk.topofline !== 1)
								tk.type = 'TK_WORD';
							else if ((_low = tk.content.toLowerCase()) === 'static')
								isstatic = true, i++;
							else if (i < l - 4 && _low === 'class') {
								let extends_ = '';
								const cl = DocumentSymbol.create((tk = tokens[++i]).content, undefined, SymbolKind.Class,
									make_range(tokens[i - 1].offset, 0), make_range(tk.offset, tk.length), []) as ClassNode;
								j = i + 1, cls.push(cl.name);
								tk.semantic = { type: SemanticTokenTypes.class, modifier: SemanticTokenModifiers.definition | SemanticTokenModifiers.readonly };
								tk.symbol = tk.definition = cl, cl.extends = '', cl.uri ??= this.uri;
								if ((lk = tokens[j])?.content === '<' && !lk.topofline) {
									const type_params: typeof cl.type_params = {};
									let data = 0;
									while ((lk = tokens[++j])?.type === 'TK_WORD') {
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
									if ((lk = tokens[j + 1])?.type === 'TK_WORD')
										this.children.push(Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length)));
									while ((++j) < l && (lk = tokens[j]).content !== '{')
										extends_ += lk.content;
									cl.extends = extends_;
								}
								if ((_cm = comments[cl.selectionRange.start.line]))
									set_detail(_cm.symbol = cl, _cm);
								cl.full = cls.join('.'), cl.property = {}, cl.prototype =
									{ ...cl, detail: undefined, property: cl.$property = {} };
								(!blocks && cl.name.startsWith('$') ? _this.typedef : _parent.property)[cl.name.toUpperCase()] ??= cl;
								_parent.children!.push(cl), blocks++, p.push(_parent), _parent = cl, cl.type_annotations = [cl.full];
								i = j + 1;
							} else if (_low === 'global' && tokens[i + 1].type === 'TK_WORD')
								i++;
							else tk.type = 'TK_WORD';
							break;
						case 'TK_END_BLOCK':
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
					for (const [k, i] of Object.entries(this.declaration)) {
						const it = i as AhkSymbol; // ts is being weird
						switch (it.kind) {
							case SymbolKind.Function:
								it.def = false; it.uri = uri;
							// fall through
							case SymbolKind.Class:
								it.overwrite ??= overwrite; it.def ??= true;
								if (!(t = ahkvars[k]) || overwrite >= (t.overwrite ?? 0))
									ahkvars[k] = it;
								break;
							case SymbolKind.Variable:
								if (it.def)
									ahkvars[k] = it; it.uri = uri;
								break;
						}
					}
					let s;
					if (overwrite) {
						if (ahk_version > alpha_3) {
							['STRUCT', 'SIZEOF', 'OBJDUMP', 'OBJLOAD', 'A_ZIPCOMPRESSIONLEVEL'].forEach(p => delete ahkvars[p]);
						} else if ((s = this.declaration.STRUCT)?.kind === SymbolKind.Class)
							s.def = false;
					}
				}
				parse_unresolved_typedef();
				check_same_name_error({}, this.children, this.diagnostics);
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
						let t: Token, has_typeof: boolean, r: string, tp: string;
						const tps: (string | AhkSymbol)[] = [];
						loop: while ((lk = tokens[++j])) {
							switch (lk.type) {
								case 'TK_WORD':
									r = lk.content, tp = 'TK_WORD';
									if ((has_typeof = r === 'typeof') && tokens[j + 1]?.type === tp && !tokens[j + 1].topofline)
										lk.semantic = { type: SemanticTokenTypes.operator }, lk = tokens[++j], r = lk.content;
									if (r.toLowerCase() !== 'this' || sym.kind === SymbolKind.Function && (sym as FuncNode).parent?.kind !== SymbolKind.Property)
										lk.semantic = { type: SemanticTokenTypes.class };
									while ((lk = tokens[++j]) && !lk.topofline && lk.type !== tp &&
										(/^[.#~]$/.test(lk.content) || lk.type === 'TK_WORD' && (lk.semantic = { type: SemanticTokenTypes.class })))
										r += lk.content, tp = lk.type;
									if (lk?.content === '<' && !lk.topofline) {
										const generic_types: (string | AhkSymbol)[][] = [];
										while (true) {
											generic_types.push(parse());
											if (!lk || lk.content as string === '>') {
												const tp = {
													name: r, kind: r.toLowerCase() === 'comobject' ? SymbolKind.Interface : SymbolKind.Class,
													extends: r, full: `${r}<${generic_types.map(t => join_types(t)).join(', ')}>`,
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
								case 'TK_NUMBER':
								case 'TK_STRING':
									tps.push(lk.content), lk = tokens[++j];
									break;
								case 'TK_START_BLOCK': {
									let full = '';
									const props: Record<string, AhkSymbol> = {}, b = lk;
									const prop_types = ['TK_NUMBER', 'TK_RESERVED', 'TK_WORD'];
									while (prop_types.includes((lk = skip_comment())?.type)) {
										const p = Variable.create(lk.content, SymbolKind.Property, make_range(lk.offset, lk.length));
										props[lk.content.toUpperCase()] ??= p, lk.semantic = { type: SemanticTokenTypes.property };
										full += ', ' + lk.content;
										if (_cm && _cm === comments[p.selectionRange.start.line])
											set_detail(p, _cm);
										if ((lk = tokens[++j])?.content === '?')
											lk.ignore = true, lk = tokens[++j], p.defaultVal = null, full += '?';
										if (lk?.content === ':')
											parse_types(p), lk = tokens[++j], full += `: ${join_types(p.type_annotations) || 'unknown'}`;
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
								case 'TK_COMMENT':
								case 'TK_BLOCK_COMMENT':
									_cm = lk;
								// fall through
								case 'TK_INLINE_COMMENT':
									continue;
								default:
									if (lk.content === '(') {
										if (',:=?&*)['.includes((t = tokens[j + 2])?.content ?? '\0') || t?.content === '=>') {
											const b = lk.offset, params = parse_params();
											const fn = create_fn('', params, make_range(b, 0));
											if (j >= l) break loop;
											if (tokens[j + 1]?.content === '=>')
												++j, parse_types(fn);
											else fn.range.end = _this.document.positionAt(lk.offset + lk.length);
											fn.full += ` => ${join_types(fn.type_annotations) || 'void'}`;
											tps.push(fn), fn.uri = _this.uri;
											if (_cm && _cm === comments[fn.selectionRange.start.line])
												set_detail(_cm.symbol = fn, _cm);
										} else {
											tps.push(...parse());
											if (lk?.content as string === ')')
												lk = tokens[++j];
										}
									} else if (lk.content === '-' && (lk = tokens[++j])?.type === 'TK_NUMBER')
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
					const params: ParamList = [], offset = params.offset ??= [];
					let vr: Variable, star: Variable | undefined, next_is_param: boolean | 1 = true;
					let defVal = 0, full = '', star_offset = 0;
					loop: while ((lk = tokens[++j]) && lk.content !== endc) {
						switch (lk.type) {
							case 'TK_STRING':
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
							case 'TK_WORD':
								if (!next_is_param) {
									skip(endc);
									break loop;
								}
								vr = Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length));
								if (next_is_param === 1)
									params.hasref = vr.pass_by_ref = true, full += '&', next_is_param = true;
								vr.assigned = vr.def = vr.is_param = true, params.push(vr);
								lk.semantic = { type: SemanticTokenTypes.parameter, modifier: SemanticTokenModifiers.definition };
								offset.push(full.length), full += lk.content, lk = tokens[++j];
								if (defVal && (vr.defaultVal = false), lk?.content === '*')
									params.variadic = vr.arr = true, lk = tokens[++j], full += '*';
								else if (lk?.content === '?')
									vr.defaultVal = null, lk.ignore = true, lk = tokens[++j], full += '?';
								if (lk?.content === ':')
									lk = tokens[j = parse_types(vr) + 1], full += `: ${join_types(vr.type_annotations) || 'unknown'}`;
								if (!lk)
									break loop;
								if (lk.content === ':=') {
									if (!(lk = tokens[++j]) || lk.content === endc)
										break loop;
									vr.defaultVal = lk.content;
									if ('-+'.includes(lk.content) && tokens[j + 1]?.type === 'TK_NUMBER')
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
									star ??= (star_offset = full.length, vr), full += '*';
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
					params.full = full, star && (params.push(star), offset.push(star_offset));
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
					for (; (lk = tokens[++j])?.type.endsWith('COMMENT') && (_cm = lk););
					return lk;
				}
				function skip(endc: string) {
					let n = 1;
					const c = { '>': '<', ')': '(', ']': '[', '}': '{' }[endc];
					lk ??= tokens.at(-1)!;
					_this.addDiagnostic(diagnostic.unexpected(lk.content), lk.offset, lk.length);
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
				delete this.actionWhenV1Detected;
			this.parseScript = function (): void {
				input = this.document.getText(), input_length = input.length, includedir = this.scriptpath, dlldir = '';
				begin_line = true, requirev2 = false, maybev1 = 0, lst = { ...EMPTY_TOKEN }, currsymbol = last_comment_fr = undefined;
				parser_pos = 0, last_LF = -1, customblocks = { region: [], bracket: [] }, continuation_sections_mode = false, h = isahk2_h;
				this.clear(), includetable = this.include, comments = {}, sharp_offsets = [];
				callWithoutParentheses = getCfg<CallWithoutParentheses>(CfgKey.CallWithoutParentheses);
				try {
					const rs = utils.get_RCDATA('#2');
					rs && (includetable[rs.uri] = rs.path);
					this.children.push(...parse_block());
				} catch (e) {
					in_loop = requirev2 = string_mode = false;
					if (e instanceof ParseStopError) {
						e.message && this.addDiagnostic(e.message, e.token.offset, e.token.length, DiagnosticSeverity.Warning);
					} else
						console.error(e);
				}
				if (!process.env.BROWSER) {
					const m = _this.d_uri && find_d_ahk(resolve_scriptdir(_this.d_uri)) || find_d_ahk(d_path);
					if (m)
						includetable[_this.d_uri = m.uri] = m.path;
					else _this.d_uri = '';
				}
				parse_unresolved_typedef();
				check_same_name_error(this.declaration, this.children, this.diagnostics);
				this.isparsed = true;
				customblocks.region.forEach(o => this.addFoldingRange(o, parser_pos - 1, 'region'));
				if (this.actived)
					this.actionWhenV1Detected ??= 'Continue';
			}
		}

		function parse_unresolved_typedef() {
			for (const m of Object.values(comments)) {
				if (m.data !== null || !/^[ \t]*\*?[ \t]*@typedef\s/m.test(m.content))
					continue;
				parse_jsdoc_detail(_this, m.content, {} as AhkSymbol);
			}
		}

		function stop_parse(tk: Token, allow_skip = false, message = diagnostic.maybev1()) {
			if (requirev2)
				return false;
			_this.maybev1 ??= maybev1 = 1;
			switch (_this.actionWhenV1Detected ??= getCfg(CfgKey.ActionWhenV1Detected)) {
				case 'SkipLine': {
					if (!allow_skip)
						return true;
					_this.addDiagnostic(diagnostic.skipline(), tk.offset, tk.length, DiagnosticSeverity.Warning);
					let s: string, next_LF: number, tp = 'TK_UNKNOWN';
					if (tk.type === 'TK_WORD' || tk.content === '=' && (tp = 'TK_STRING')) {
						lst = tk, parser_pos = tk.offset + tk.length;
						do {
							next_LF = input.indexOf('\n', parser_pos);
							if (next_LF < 0)
								next_LF = input_length;
							if ((s = input.substring(parser_pos, next_LF).trimStart())) {
								const offset = next_LF - s.length;
								lst = createToken(s = s.trimEnd(), tp, offset, s.length, 0);
							}
							if ((tk = _this.find_token(parser_pos = next_LF, true)).content === '(') {
								delete _this.tokens[tk.offset];
								lst = { ...EMPTY_TOKEN };
							}
							string_mode = true;
							tk = get_token_ignoreComment();
							while (tk.ignore && tk.type === 'TK_STRING') {
								next_LF = input.indexOf('\n', parser_pos);
								if (next_LF < 0)
									next_LF = input_length;
								if ((s = input.substring(parser_pos, next_LF).trimEnd()))
									tk.content += s, tk.length += s.length;
								parser_pos = next_LF;
								tk = get_token_ignoreComment();
							}
							string_mode = false;
						} while (is_line_continue({} as Token, tk));
						parser_pos = tk.offset;
					}
					return true;
				}
				case 'SwitchToV1':
					if (!_this.actived)
						break;
					connection?.console.info([_this.document.uri, message, diagnostic.tryswitchtov1()].join(' '));
					message = '', setTextDocumentLanguage(_this.document.uri);
					break;
				case 'Continue':
					return false;
				case 'Warn': {
					if (!_this.actived)
						break;
					connection?.window.showWarningMessage(
						`file: '${_this.fsPath}', ${message}`,
						{ title: action.switchtov1(), action: 'SwitchToV1' },
						{ title: action.skipline(), action: 'SkipLine' },
						{ title: action.stopparsing(), action: 'Stop' }
					).then((reason?: { action: string }) => {
						if ((_this.actionWhenV1Detected = (reason?.action ?? 'Continue') as ActionType) !== 'Stop')
							if (_this.actionWhenV1Detected === 'SwitchToV1')
								setTextDocumentLanguage(_this.document.uri);
							else _this.update();
					});
					break;
				}
			}
			_this.clear(), parser_pos = input_length;
			throw new ParseStopError(message, tk);
		}

		function parse_block(mode = 0, _parent = _this as unknown as AhkSymbol, classfullname: string = ''): AhkSymbol[] {
			const result: AhkSymbol[] = [], document = _this.document, tokens = _this.tokens;
			let tk = _this.tokens[parser_pos - 1] ?? EMPTY_TOKEN, lk = tk.previous_token ?? EMPTY_TOKEN;
			let blocks = 0, next = true, _low = '';
			let _cm: Token | undefined, line_begin_pos: number | undefined, tn: AhkSymbol | undefined;
			let m: RegExpMatchArray | string | null, last_hotif: number | undefined;
			const baksym = currsymbol, oil = in_loop, blockpos: number[] = [], case_pos: number[] = [];
			if ((block_mode = true, mode !== 0))
				blockpos.push(parser_pos - 1), delete tk.data;
			currsymbol = _parent, in_loop = false;
			parse_brace();
			currsymbol = baksym, in_loop = oil;
			if (tk.type === 'TK_EOF' && blocks > (mode === 0 ? 0 : -1))
				_this.addDiagnostic(diagnostic.missing('}'), blockpos[blocks - (mode === 0 ? 1 : 0)], 1);
			else if (last_hotif !== undefined)
				_this.addFoldingRange(last_hotif, lk.offset, 'region');
			return result;

			function is_func_def() {
				if (input.charAt(tk.offset + tk.length) !== '(')
					return false;
				const _lk = lk, _tk = tk, _lst = lst, _ppos = parser_pos, tp = tk.topofline > 0;
				let n = 0, e = '', c = '';
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

			function check_operator(op: Token) {
				const tp = op.op_type ??= op_type(op);
				if ((tp >= 0 && (op.topofline === 1 || !yields_an_operand(op.previous_token!))) ||
					(tp <= 0 && !check_right(_this.get_token(op.offset + op.length, true))))
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
							if (op.topofline < 1 && yields_an_operand(op.previous_token ?? EMPTY_TOKEN))
								return 0;
							return -1;
						case '++':
						case '--':
							return yields_an_operand(op) ? 1 : -1;
						case ':':
							return 0;
						case '?':
							return op.ignore ? 1 : 0;
						case '*':
							if (',(['.includes(op.previous_token?.content ?? '\0') &&
								',),]()[]'.includes(op.previous_token!.content + (_this.get_token(op.offset + 1, true).content || '\0')))
								return -1;	// skip yields_an_operand check
						// fall through
						default:
							return 0;
					}
				}
				function check_right(tk?: Token) {
					switch (tk?.type) {
						case 'TK_START_BLOCK':
						case 'TK_START_EXPR':
						case 'TK_NUMBER':
						case 'TK_STRING':
							return true;
						case 'TK_WORD':
							if (tk.topofline === 1 && allIdentifierChar.test(op.content) && (_parent as FuncNode).ranges)
								return false;
							return true;
						case 'TK_RESERVED':
							return /^(class|isset|throw|super)$/.test(tk.content.toLowerCase());
						case 'TK_OPERATOR':
							return (tk.op_type ??= op_type(tk)) === -1;
						case 'TK_END_EXPR':
						case 'TK_EOF':
							if (op.op_type! < 1 && op.content === '*')
								return (op.op_type = 1);
						// fall through
						default:
							return false;
					}
				}
			}

			function parse_brace(level = 0) {
				if (tk.type === 'TK_START_BLOCK') {
					delete tk.data;
					nexttoken(), next = false;
					if (!tk.topofline && !lk.topofline)
						_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
				}
				while (block_mode = true, nexttoken()) {
					let _nk: Token | undefined;
					if (tk.topofline === 1) {
						let p: number;
						line_begin_pos = tk.offset;
						if (mode === 2) {
							if (tk.type !== 'TK_RESERVED' && allIdentifierChar.test(tk.content))
								tk.type = 'TK_WORD', delete tk.semantic;
						} else if ((p = is_next_char(':'))) {
							if ((case_pos.length && tk.content.toLowerCase() === 'default' && _this.get_token(p).content === ':') ||
								(p === parser_pos && whitespace.includes(input.charAt(parser_pos + 1)) && allIdentifierChar.test(tk.content)
									&& (!case_pos.length || tk.content.toLowerCase() !== 'case'))) {
								if ((_nk = tokens[p])) {
									if ((tk.next_token_offset = _nk.next_token_offset) > 0)
										tokens[_nk.next_token_offset].previous_token = tk;
									delete tokens[p];
								}
								tk.content += ':', tk.length = (parser_pos = p + 1) - tk.offset, tk.type = 'TK_LABEL';
								delete tk.semantic;
								line_begin_pos = undefined;
							}
						}
					}

					switch (tk.type) {
						case 'TK_EOF': return;

						case 'TK_WORD':
							if (tk.topofline > 0 && !tk.ignore) {
								let isfuncdef = is_func_def();
								nexttoken();
								if (!isfuncdef && h && mode !== 2 && lk.topofline === 1 && !tk.topofline && tk.type === 'TK_WORD' && lk.content.toLowerCase() === 'macro') {
									tk.topofline = 1;
									if ((isfuncdef = is_func_def()))
										nexttoken();
									else tk.topofline = 0;
								}

								if (isfuncdef) {
									let tn: FuncNode | undefined, name_l: string;
									const fc = lk, rl = result.length, isstatic = fc.topofline === 2;
									const se: SemanticToken = lk.semantic = { type: mode === 2 ? SemanticTokenTypes.method : SemanticTokenTypes.function };
									const oo = isstatic ? fc.previous_token?.offset! : fc.offset;
									let par = parse_params(true);
									line_begin_pos = undefined;
									if (/^\d/.test(name_l = fc.content.toUpperCase()))
										_this.addDiagnostic(diagnostic.invalidsymbolname(fc.content), fc.offset, fc.length);
									if (!par)
										par = [], _this.addDiagnostic(diagnostic.invalidparam(), fc.offset, tk.offset + 1 - fc.offset);
									fc.symbol = fc.definition = tn = FuncNode.create(fc.content, mode === 2 ? SymbolKind.Method : SymbolKind.Function,
										Range.create(fc.pos = document.positionAt(fc.offset), { line: 0, character: 0 }),
										make_range(fc.offset, fc.length), par, undefined, isstatic);
									if (mode !== 0)
										tn.parent = _parent;
									if (nexttoken() && tk.content === '=>') {
										const rs = result.splice(rl), storemode = mode, pp = _parent;
										mode = mode === 2 ? 3 : 1, _parent = tn, tn.returns = [parser_pos, 0];
										const sub = parse_line(undefined, 'return', 1);
										result.push(tn), _parent = pp, mode = storemode, tk.fat_arrow_end = true;
										tn.range.end = document.positionAt(tn.returns[1] = lk.offset + lk.length);
										_this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
										tn.children = rs, rs.push(...sub);
										_this.linepos[tn.range.end.line] = oo;
									} else if (tk.content === '{') {
										const rs = result.splice(rl), ofs = tk.offset;
										tk.previous_pair_pos = oo;
										result.push(tn), tn.children = rs;
										rs.push(...parse_block(mode === 2 ? 3 : 1, tn, classfullname));
										tn.range.end = document.positionAt(parser_pos);
										_this.addSymbolFolding(tn, ofs);
									} else {
										_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
										break;
									}
									se.modifier = SemanticTokenModifiers.definition | SemanticTokenModifiers.readonly |
										(isstatic as unknown as number);
									if ((_cm = comments[tn.selectionRange.start.line]))
										set_detail(_cm.symbol = tn, _cm);
									if (mode === 2) {
										tn.has_this_param = true, !tn.static && (tn.parent = (_parent as ClassNode).prototype);
										tn.full = `(${classfullname.slice(0, -1)}) ` + tn.full;
										(_this.object.method[name_l] ??= []).push(tn);
									}
									adddeclaration(tn);
									break;
								}

								if (mode === 2) {
									if (input.charAt(lk.offset + lk.length) === '[' || tk.content.match(/^(=>|\{)$/)) {
										const fc = lk, rl = result.length;
										let par: Variable[] = [], rg: Range;
										line_begin_pos = undefined;
										if (tk.content === '[') {
											par = parse_params(true, ']') ?? [];
											nexttoken();
											if (par.length === 0)
												_this.addDiagnostic(diagnostic.propemptyparams(), fc.offset, lk.offset - fc.offset + 1);
											if (!tk.content.match(/^(=>|\{)$/)) {
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
											const mmm = mode, brace = tk.offset;
											tk.previous_pair_pos = oo;
											nexttoken(), next = false, mode = 1;
											if (tk.type as string === 'TK_END_BLOCK' && !lk.topofline && !tk.topofline)
												_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
											while (nexttoken() && tk.type as string !== 'TK_END_BLOCK') {
												if (tk.topofline && /^[gs]et$/.test(_low = tk.content.toLowerCase())) {
													let v: Variable;
													nexttoken(), nk = lk;
													if (tk.content as string === '=>') {
														tn = FuncNode.create(_low, SymbolKind.Function,
															make_range(lk.offset, parser_pos - lk.offset), make_range(lk.offset, lk.length), [...par]);
														mode = 3, tn.returns = [parser_pos, 0];
														tn.parent = prop, tn.children = parse_line(undefined, 'return', 1), mode = 2;
														tn.range.end = document.positionAt(tn.returns[1] = lk.offset + lk.length);
														prop.range.end = tn.range.end, prop.returns = tn.returns, tk.fat_arrow_end = true;
														_this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
														if (lk.content === '=>')
															_this.addDiagnostic(diagnostic.invaliddefinition('function'), nk.offset, nk.length);
														if (_low === 'set')
															tn.params.unshift(v = Variable.create('Value', SymbolKind.Variable,
																Range.create(0, 0, 0, 0))), v.is_param = v.assigned = v.def = true, v.detail = completionitem.value();
														else prop.returns = tn.returns;
														tn.has_this_param = true, adddeclaration(tn);
														_this.linepos[tn.range.end.line] = nk.offset;
													} else if (tk.content === '{') {
														tn = FuncNode.create(_low, SymbolKind.Function,
															make_range(nk.offset, parser_pos - nk.offset), make_range(nk.offset, 3), [...par]);
														sk = tk, tn.parent = prop, tn.children = parse_block(3, tn, classfullname);
														tn.range.end = document.positionAt(parser_pos);
														if (_low === 'set')
															tn.params.unshift(v = Variable.create('Value', SymbolKind.Variable,
																Range.create(0, 0, 0, 0))), v.is_param = v.assigned = v.def = true, v.detail = completionitem.value();
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
											prop.range.end = document.positionAt(parser_pos - 1), mode = mmm;
											_this.addSymbolFolding(prop, brace);
											if (prop.get && !prop.set)
												fc.semantic.modifier! |= SemanticTokenModifiers.readonly;
										} else if (tk.content === '=>') {
											const off = parser_pos;
											let tn: FuncNode;
											mode = 3, tn = FuncNode.create('get', SymbolKind.Function,
												rg = make_range(off, parser_pos - off), ZERO_RANGE, par);
											tn.parent = prop, prop.get = tn, prop.returns = tn.returns = [parser_pos, 0];
											tn.children = parse_line(undefined, 'return', 1), mode = 2;
											prop.range.end = tn.range.end = document.positionAt(tn.returns[1] = lk.offset + lk.length);
											_this.addFoldingRangePos(tn.range.start, tn.range.end, 'line');
											tn.has_this_param = true, adddeclaration(tn), tk.fat_arrow_end = true;
											_this.linepos[prop.range.end.line] = oo;
											fc.semantic.modifier! |= SemanticTokenModifiers.readonly;
										}
										break;
									}
									tk = lk, lk = EMPTY_TOKEN, next = false;
									parser_pos = tk.offset + tk.length;
									const rl = result.length, _ = _parent;
									_parent = (_parent as ClassNode).$property!.__INIT;
									const sta = parse_statement('');
									_parent.children!.push(...result.splice(rl)), _parent = _;
									result.push(...sta), sta.forEach(it => it.parent = _);
									if (line_begin_pos !== undefined)
										_this.linepos[(lk.pos ??= document.positionAt(lk.offset)).line] = line_begin_pos;
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
								const rl = result.length, _ = _parent;
								_parent = (_parent as ClassNode).$property!.__INIT;
								const sta = parse_statement('');
								_parent.children!.push(...result.splice(rl)), _parent = _;
								result.push(...sta), sta.forEach(it => it.parent = _);
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
								const p = blockpos.pop()!;
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
									if (blockpos.length && tk.previous_pair_pos === undefined)
										tokens[tk.previous_pair_pos = blockpos.at(-1)!].next_pair_pos = tk.offset;
									return;
								}
							}
							break;

						// case 'TK_DOT':
						case 'TK_END_EXPR':
							_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, 1);
							line_begin_pos = undefined;
							break;

						case 'TK_LABEL': {
							if (case_pos.length && tk.content.toLowerCase() === 'default:') {
								const last_case = case_pos.pop();
								if (case_pos.push(tk.offset), last_case)
									_this.addFoldingRange(last_case, lk.offset, 'case');
								nexttoken(), next = false;
								tk.topofline ||= -1;
								break;
							}
							if (mode === 2) {
								_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset, tk.length);
								break;
							}
							tk.symbol = tn = SymbolNode.create(tk.content, SymbolKind.Field,
								make_range(tk.offset, tk.length), make_range(tk.offset, tk.length - 1));
							tn.data = blockpos.at(-1);
							result.push(tn);
							const labels = (_parent as FuncNode).labels;
							if (labels) {
								_low = tk.content.toUpperCase().slice(0, -1), tn.def = true;
								if (!labels[_low])
									labels[_low] = [tn];
								else if (labels[_low][0].def)
									_this.addDiagnostic(diagnostic.duplabel(), tk.offset, tk.length - 1),
										labels[_low].splice(1, 0, tn);
								else
									labels[_low].unshift(tn);
							}
							if ((_cm = comments[tn.selectionRange.start.line]))
								set_detail(tn, _cm);
							if (!(_nk = _this.get_token(parser_pos, true)).topofline)
								_this.addDiagnostic(diagnostic.unexpected(_nk.content), _nk.offset, _nk.length);
							break;
						}

						case 'TK_HOTLINE': {
							tk.symbol = tn = SymbolNode.create(tk.content, SymbolKind.Event,
								make_range(tk.offset, tk.length), make_range(tk.offset, tk.length - 2));
							tn.range.end = document.positionAt(parser_pos - 1), result.push(tn);
							if ((_cm = comments[tn.selectionRange.start.line]))
								set_detail(tn, _cm);
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
							if (!is_valid_hotkey(tk.content))
								_this.addDiagnostic(diagnostic.invalidhotdef(), tk.offset, tk.length);
							break;
						}
						case 'TK_HOT': {
							if (mode !== 0)
								_this.addDiagnostic(diagnostic.hotdeferr(), tk.offset, tk.length);
							else if (!tk.ignore && !is_valid_hotkey(tk.content))
								_this.addDiagnostic(diagnostic.invalidhotdef(), tk.offset, tk.length);
							const ht = tk, tn = SymbolNode.create(tk.content, SymbolKind.Event,
								make_range(tk.offset, tk.length), make_range(tk.offset, tk.length - 2)) as FuncNode;
							if ((_cm = comments[tn.selectionRange.start.line]))
								set_detail(tn, _cm);
							tk.symbol = tn, nexttoken();
							let v: Variable;
							tn.declaration = {}, result.push(tn);
							tn.global = {}, tn.local = {};
							while (tk.type as string === 'TK_SHARP')
								parse_sharp(), nexttoken();
							if (tk.content === '{') {
								tk.previous_pair_pos = ht.offset;
								tn.params = [v = Variable.create('ThisHotkey', SymbolKind.Variable,
									make_range(0, 0))];
								v.detail = completionitem.thishotkey();
								tn.children = parse_block(1, tn);
								tn.range = make_range(ht.offset, parser_pos - ht.offset);
								_this.addSymbolFolding(tn, tk.offset), adddeclaration(tn);
							} else if (tk.topofline) {
								adddeclaration(tn), next = false;
								if (tk.type.startsWith('TK_HOT'))
									break;
								if (tk.type as string !== 'TK_WORD' || !is_func_def()) {
									stop_parse(ht);
									!maybev1 && _this.addDiagnostic(diagnostic.hotmissbrace(), ht.offset, ht.length);
								}
								next = false;
							} else {
								tn.params = [v = Variable.create('ThisHotkey', SymbolKind.Variable,
									make_range(0, 0))];
								v.detail = completionitem.thishotkey();
								const tparent = _parent, tmode = mode, l = tk.content.toLowerCase();
								const rl = result.length;
								_parent = tn, mode = 1;
								if (l === 'return')
									tn.children = parse_line(undefined, 'return');
								else if (['global', 'local', 'static'].includes(l)) {
									parse_reserved();
									tn.children = result.splice(rl);
								} else {
									next = false, parse_body(null, ht.offset);
									tn.children = result.splice(rl);
								}
								_parent = tparent, mode = tmode, adddeclaration(tn);
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
							if (tk.topofline === 1) {
								if (lk !== EMPTY_TOKEN && is_line_continue(lk, tk, _parent))
									tk.topofline = -1;
								else lk = EMPTY_TOKEN;
							}
							if ((next = false, mode === 2))
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
				let _low = tk.content.toLowerCase(), bak = lk;
				const beginpos = tk.offset, tpos = parser_pos;
				let nk: Token | undefined;
				if ((block_mode = false, mode === 2)) {
					nk = get_next_token();
					next = false, parser_pos = tpos, tk.type = 'TK_WORD';
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
					case 'class': {
						if (tk.topofline !== 1) {
							next = false, tk.type = 'TK_WORD';
							break;
						}
						let cl: Token, ex: string = '';
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
									addvariable(tk, 0, _this.children);
									while (parser_pos < input_length && input.charAt(parser_pos) === '.') {
										get_next_token();
										tk = get_next_token();
										if (tk.type === 'TK_WORD')
											ex += '.' + tk.content, addprop(tk);
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
							const tn = DocumentSymbol.create(cl.content, undefined, SymbolKind.Class,
								ZERO_RANGE, make_range(cl.offset, cl.length)) as ClassNode;
							cl.symbol = cl.definition = tn, tn.full = classfullname + cl.content;
							tn.extends = ex, tn.uri = _this.uri;
							if ((_cm = comments[tn.selectionRange.start.line]))
								set_detail(tn, _cm);
							tn.prototype = { ...tn, cache: [], detail: undefined, property: tn.$property = {} };
							tn.children = [], tn.cache = [], tn.property = {};
							tn.type_annotations = [tn.full];
							let t = FuncNode.create('__Init', SymbolKind.Method, make_range(0, 0), make_range(0, 0), [], [], true);
							(tn.property.__INIT = t).ranges = [], t.parent = tn;
							t.full = `(${tn.full}) static __Init()`, t.has_this_param = true;
							t = FuncNode.create('__Init', SymbolKind.Method, make_range(0, 0), make_range(0, 0), [], []);
							(tn.$property!.__INIT = t).ranges = [], t.parent = tn.prototype!;
							t.full = `(${tn.full}) __Init()`, t.has_this_param = true;
							tn.children = parse_block(2, tn as unknown as FuncNode, classfullname + cl.content + '.');
							tn.range = tn.prototype!.range = make_range(beginpos, parser_pos - beginpos);
							cl.semantic = {
								type: SemanticTokenTypes.class,
								modifier: SemanticTokenModifiers.definition | SemanticTokenModifiers.readonly
							};
							adddeclaration(tn), _this.addSymbolFolding(tn, tk.offset);
							result.push(tn);
							return true;
						} else {
							next = false, lk.type = 'TK_WORD', parser_pos = lk.offset + lk.length, tk = lk, lk = bak;
						}
						break;
					}
					case 'global':
					case 'static':
					case 'local':
						nexttoken();
						if (mode === 2 && !tk.topofline && allIdentifierChar.test(tk.content))
							tk.type = 'TK_WORD';
						if (tk.topofline) {
							if (mode === 2)
								_this.addDiagnostic(diagnostic.propdeclaraerr(), lk.offset, lk.length);
							else if (_low === 'local' || result.some(it => it.kind === SymbolKind.Variable))
								_this.addDiagnostic(diagnostic.declarationerr(), lk.offset, lk.length);
							else
								(_parent as FuncNode).assume = _low === 'static' ? FuncScope.STATIC : FuncScope.GLOBAL;
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
								const rl = result.length, _ = _parent;
								if (mode === 2)
									tk.topofline = 2, _parent = (_parent as ClassNode).property.__INIT;
								const fn = _parent as FuncNode;
								next = false;
								const sta = parse_statement(_low === 'global' ? '' : _low);
								if (_low === 'global') {
									sta.forEach(it => fn.global[it.name.toUpperCase()] ??= it);
								} else {
									if (mode === 2) {
										fn.children!.push(...result.splice(rl)), _parent = _;
										for (const it of sta)
											it.static = true, it.full = it.full!.replace(') ', ') static '), (it as FuncNode).parent = _;
									} else {
										const isstatic = _low === 'static';
										sta.forEach(it => {
											fn.local[it.name.toUpperCase()] ??= it;
											it.static = isstatic;
											it.decl = true;
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
					case 'loop': {
						if (mode === 2) {
							nk = _this.get_token(parser_pos);
							next = false, tk.type = 'TK_WORD';
							if (nk.content !== ':=')
								_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset, tk.length);
							break;
						}
						nexttoken();
						if (tk.type === 'TK_COMMA')
							stop_parse(lk), maybev1 && nexttoken();
						let min = 0, max = 1, act = 'loop', sub;
						if (tk.type === 'TK_EQUALS') {
							parser_pos = lk.offset + lk.length, lk.type = 'TK_WORD', tk = lk, lk = bak, next = false;
							if (mode !== 2) _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
							break;
						} else if (mode === 2) {
							_this.addDiagnostic(diagnostic.propdeclaraerr(), lk.offset, lk.length);
							break;
						} else if ((bak = lk, next = ' \t,'.includes(input.charAt(parser_pos) || '\0') && (tk.type === 'TK_WORD' && ['parse', 'files', 'read', 'reg'].includes(sub = tk.content.toLowerCase())))) {
							min = 1, max = sub === 'parse' ? 3 : 2;
							tk.type = 'TK_RESERVED', act += ' ' + sub, lk.hover_word = tk.hover_word = act;
							nexttoken();
							if (tk.type === 'TK_COMMA' && nexttoken())
								tk.topofline = 0;
							next = false;
						}
						if ((!tk.topofline || tk.type === 'TK_COMMA') && tk.type !== 'TK_START_BLOCK')
							result.push(...parse_line('{', act, min, max));
						else if (min)
							_this.addDiagnostic(diagnostic.acceptparams(act, `${min}~${max}`), bak.offset, bak.length);
						if (parse_body(false, beginpos, true))
							return;
						if (tk.type === 'TK_RESERVED' && tk.content.toLowerCase() === 'until')
							next = true, line_begin_pos = tk.offset, result.push(...parse_line(undefined, 'until', 1));
						break;
					}
					case 'for': {
						const nq = is_next_char('('), returns: number[] = [], data: number[] = [];
						let for_index = 0;
						if (nq) nk = get_next_token();
						while (nexttoken()) {
							switch (tk.type) {
								case 'TK_COMMA': for_index++; break;
								case 'TK_RESERVED':
									if (tk.content.toLowerCase() !== 'class' || !(mode & 1)) {
										_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
										break;
									} else
										tk.type = 'TK_WORD';
								// fall through
								case 'TK_WORD': {
									const vr = addvariable(tk, 0);
									if (vr)
										vr.def = vr.assigned = true, vr.for_index = for_index, vr.returns = returns, vr.data = data;
									break;
								}
								case 'TK_OPERATOR':
									if (tk.content.toLowerCase() === 'in') {
										returns.push(tk.offset + 2);
										result.push(...parse_expression(undefined, undefined, '{'));
										returns.push(lk.offset + lk.length);
										if (nk) {
											if (tk.content !== ')') {
												_this.addDiagnostic(diagnostic.missing(')'), nk.offset, nk.length);
											} else next = true, nexttoken();
										}
										data.push(tk.offset);
										if (!parse_body(false, beginpos, true) && (tk as Token).type === 'TK_RESERVED' && tk.content.toLowerCase() === 'until')
											next = true, line_begin_pos = tk.offset, result.push(...parse_line(undefined, 'until', 1));
										data.push(tk.offset, for_index + 1);
										return;
									}
									_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, tk.length);
									next = false;
									return;
								default:
									next = false;
								// fall through
								case 'TK_END_EXPR':
									_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
									return;
								case 'TK_EQUALS':
									_this.addDiagnostic(diagnostic.reservedworderr(lk.content), lk.offset, lk.length);
									return;
							}
						}
						break;
					}
					case 'continue':
					case 'break':
					case 'goto':
						if (mode === 2) {
							next = false, tk.type = 'TK_WORD';
							if (_this.get_token(parser_pos, true).content !== ':=')
								_this.addDiagnostic(diagnostic.propdeclaraerr(), tk.offset, tk.length);
							break;
						}
						nexttoken();
						if (!in_loop && _low !== 'goto')
							_this.addDiagnostic(diagnostic.outofloop(), lk.offset);
						if (tk.type === 'TK_COMMA') {
							stop_parse(lk);
							_this.addDiagnostic(diagnostic.unexpected(','), tk.offset, 1);
						}
						if (!tk.topofline) {
							if (allIdentifierChar.test(tk.content)) {
								if (tk.type === 'TK_NUMBER' && _low !== 'goto') {
									if (tk.content.match(/[^\d]/))
										_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
								} else
									tk.ignore = true, tk.type = 'TK_WORD', addlabel(tk), delete tk.semantic;
								nexttoken(), next = false;
							} else if (input.charAt(lk.offset + lk.length) === '(') {
								const s: Token[] = [];
								parse_pair('(', ')', undefined, undefined, s);
								s.forEach(i => {
									if (i.content.indexOf('\n') < 0)
										addlabel({ content: i.content.slice(1, -1), offset: i.offset + 1, length: i.length - 2, type: '', topofline: 0, next_token_offset: -1 });
								});
								nexttoken(), next = false;
							} else if (tk.type === 'TK_STRING') {
								_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
								nexttoken(), next = false;
							} else {
								parser_pos = lk.offset + lk.length, lk.type = 'TK_WORD', tk = lk, lk = bak, next = false;
								_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
								break;
							}
							if (!tk.topofline)
								_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
						} else if ((next = false, _low === 'goto'))
							_this.addDiagnostic(diagnostic.acceptparams(_low, 1), lk.offset, lk.length);
						break;
					case 'as':
					case 'catch':
					case 'else':
					case 'finally':
					case 'until':
						_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
						break;
					case 'super':
						if (mode === 3) {
							if (input[parser_pos] !== '(') {
								const t = _this.get_token(parser_pos, true);
								if (t.type !== 'TK_DOT' && t.content !== '[' && !(t.topofline && tk.topofline))
									_this.addDiagnostic(diagnostic.syntaxerror(tk.content), tk.offset, tk.length);
							}
						} else
							_this.addDiagnostic(diagnostic.invalidsuper(), tk.offset, tk.length);
						tk.type = 'TK_WORD', next = false;
						break;
					case 'case':
						if (case_pos.length && tk.topofline) {
							const last_case = case_pos.pop();
							if (case_pos.push(tk.offset), last_case)
								_this.addFoldingRange(last_case, lk.offset, 'case');
							nexttoken(), next = false;
							if (tk.content !== ':' && !tk.topofline) {
								result.push(...parse_line(':', 'case', 1, 20));
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
						if (tk.type === 'TK_COMMA')
							stop_parse(lk);
						parse_body(true, beginpos);
						if (tk.type === 'TK_RESERVED' && tk.content.toLowerCase() !== 'else') {
							while (tk.content.toLowerCase() === 'catch')
								next = true, line_begin_pos = tk.offset, parse_catch();
							for (const l of ['else', 'finally'])
								if (tk.content.toLowerCase() === l)
									next = true, line_begin_pos = tk.offset, nexttoken(), next = false, parse_body(true, lk.offset);
						}
						break;
					case 'isset':
						parse_isset(input.charAt(tk.offset + 5));
						break;
					case 'throw':
						if (ahk_version >= alpha_3) {
							tk.type = 'TK_WORD', next = false;
							break;
						}
					// fall through
					default:
						nk = get_token_ignoreComment();
						if (nk.type === 'TK_EQUALS' || nk.content.match(/^([<>]=?|~=|&&|\|\||[.|?:^]|\*\*?|\/\/?|<<|>>|!?==?)$/))
							tk.type = 'TK_WORD', parser_pos = tpos, _this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
						else {
							lk = tk, tk = nk, next = false;
							if (_low === 'return' || _low === 'throw') {
								if (tk.type === 'TK_COMMA')
									stop_parse(lk);
								const b = tk.offset;
								result.push(...parse_line(undefined, _low));
								if ((mode & 1) && _low === 'return' && b <= lk.offset)
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
								} else _this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
							} else if (_low === 'if' || _low === 'while') {
								if (tk.type === 'TK_COMMA')
									stop_parse(lk);
								result.push(...parse_line('{', _low, 1));
								parse_body(false, beginpos, _low === 'while');
							}
						}
						break;
				}

				function addlabel(tk: Token) {
					const labels = (_parent as FuncNode).labels;
					if (labels) {
						labels[_low = tk.content.toUpperCase()] ??= [];
						const rg = make_range(tk.offset, tk.length);
						labels[_low].push(tk.symbol = tn = DocumentSymbol.create(tk.content, undefined, SymbolKind.Field, rg, rg));
						tn.data = blockpos.at(-1);
					}
				}
			}

			function parse_catch() {
				let p: Token | undefined, nk: Token;
				const bp = tk.offset;
				line_begin_pos = bp;
				lk = nk = tk, p = get_token_ignoreComment();
				if (p.topofline || p.content !== '(')
					tk = p, p = undefined;
				else tk = get_token_ignoreComment();
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
					const tps: string[] = [];
					next = true;
					if (tk.content.toLowerCase() !== 'as') {
						while (true) {
							let tp = '';
							if (tk.type !== 'TK_WORD')
								_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
							else addvariable(tk), tp += tk.content;
							lk = tk, tk = get_token_ignoreComment();
							if (tk.type === 'TK_DOT') {
								nexttoken();
								while (true) {
									if (tk.type as string === 'TK_WORD') {
										addprop(tk), tp += '.' + tk.content;
										nexttoken();
									} else if (tk.content === '%') {
										_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
										parse_pair('%', '%');
										nexttoken(), tp = '@';
									} else
										break;
									if (tk.type !== 'TK_DOT')
										break;
									else nexttoken();
								}
							}
							!tp.startsWith('@') && tps.push(tp);
							if (tk.content === ',') {
								lk = tk, tk = get_token_ignoreComment();
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
						lk = tk, tk = get_token_ignoreComment();
						next = false;
						if (tk.type !== 'TK_WORD' && !allIdentifierChar.test(tk.content)) {
							_this.addDiagnostic(diagnostic.unexpected(nk.content), nk.offset, nk.length);
						} else if (tk.type !== 'TK_WORD')
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length), tk.type = 'TK_WORD';
						else {
							const t = get_token_ignoreComment();
							parser_pos = tk.offset + tk.length;
							if (!t.topofline && t.content !== '{' && !(p && t.content === ')'))
								_this.addDiagnostic(diagnostic.unexpected(nk.content), nk.offset, nk.length), next = false;
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
								lk = tk, tk = get_token_ignoreComment();
							else _this.addDiagnostic(diagnostic.missing(')'), p.offset, 1);
						}
						if (!tk.topofline)
							_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
						else next = false, parse_body(null, bp);
					}
				}
			}

			function reset_extra_index(tk: Token) {
				const t = tk.previous_extra_tokens;
				if (t) t.i = 0;
			}

			function parse_top_word() {
				let c = '', maybe;
				next = true, nexttoken(), next = false;
				if ((maybe = tk.ignore && tk.content === '?'))
					tk = get_next_token();
				if (tk.type !== 'TK_EQUALS' && !/^(=[=>]?|\?\??|:)$/.test(tk.content) &&
					(tk.type === 'TK_DOT' || ', \t\r\n'.includes(c = input.charAt(lk.offset + lk.length)))) {
					if (tk.type === 'TK_DOT') {
						const v = addvariable(lk);
						next = true;
						maybe && v && (v.returns = null);
						while (nexttoken()) {
							if (tk.type as string === 'TK_WORD') {
								let maybecaller = true;
								if (input.charAt(parser_pos) === '%') {
									maybecaller = false;
								} else if (addprop(tk), nexttoken(), ASSIGN_TYPE.includes(tk.content))
									maybecaller = false, maybeclassprop(lk, undefined, () => {
										const beg = parser_pos;
										result.push(...parse_expression());
										return [beg, lk.offset + lk.length];
									});
								else if (tk.ignore && tk.content === '?' && (tk = get_next_token()), tk.type === 'TK_DOT')
									continue;
								next = false;
								if (maybecaller && tk.type as string !== 'TK_EQUALS' && !'=??'.includes(tk.content || ' ') &&
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
					let act, offset;
					/^=>?$/.test(tk.content) && (act = tk.content, offset = tk.offset);
					if (maybev1 && act === '=' && stop_parse(tk, true) &&
						(next = false, lk = EMPTY_TOKEN, tk = get_token_ignoreComment()))
						return;
					reset_extra_index(tk), tk = lk, lk = EMPTY_TOKEN, next = false;
					parser_pos = tk.skip_pos ?? tk.offset + tk.length;
					result.push(...parse_line(undefined, act, offset));
				}
			}

			function parse_funccall(type: SymbolKind, nextc: string) {
				let tp;
				const fc = lk;
				const pi: ParamInfo = { offset: fc.offset, miss: [], comma: [], count: 0, unknown: false, name: fc.content };
				if (nextc === ',' || maybev1) {
					if (type === SymbolKind.Function && builtin_ahkv1_commands.includes(fc.content.toLowerCase()) &&
						stop_parse(fc, true) && (next = false, lk = EMPTY_TOKEN, tk = get_token_ignoreComment()))
						return;
					nextc === ',' && _this.addDiagnostic(diagnostic.funccallerr(), tk.offset, 1);
				}
				if ((tp = tk.type) === 'TK_OPERATOR' && !tk.content.match(/^(not|\+\+?|--?|!|~|%|&)$/i))
					_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
				fc.paraminfo = pi;
				result.push(...parse_line(undefined, undefined, undefined, undefined, pi));
				if (type === SymbolKind.Method)
					fc.semantic = undefined;
				if (!fc.ignore)
					fc.semantic ??= {
						type: type === SymbolKind.Function ? SemanticTokenTypes.function :
							(pi.method = true, SemanticTokenTypes.method)
					};
				const tn: CallSite = DocumentSymbol.create(fc.content, undefined, type,
					make_range(fc.offset, lk.offset + lk.length - fc.offset), make_range(fc.offset, fc.length));
				tn.paraminfo = pi, tn.offset = fc.offset, fc.callsite = tn;
				if (lk === fc) {
					const lf = input.indexOf('\n', fc.offset);
					tn.range.end = document.positionAt(lf < 0 ? input_length : lf);
				}
				if (type === SymbolKind.Method)
					maybeclassprop(fc, true);
				if (callWithoutParentheses !== CallWithoutParentheses.Off && (callWithoutParentheses === CallWithoutParentheses.On || tp === 'TK_START_EXPR'))
					_this.diagnostics.push({ message: warn.callwithoutparentheses(), range: tn.selectionRange, severity: DiagnosticSeverity.Warning });
			}

			function parse_body(else_body: boolean | null, previous_pos: number, loop_body = false) {
				const oil = in_loop;
				in_loop ||= loop_body;
				if ((block_mode = false, tk.type === 'TK_START_BLOCK')) {
					tk.previous_pair_pos = previous_pos;
					next = true, blockpos.push(parser_pos - 1), parse_brace(++blocks);
					nexttoken();
					next = tk.type as string === 'TK_RESERVED' && tk.content.toLowerCase() === 'else';
				} else {
					if (tk.type === 'TK_RESERVED' && line_starters.includes(tk.content.toLowerCase())) {
						const t = tk;
						next = true;
						if (parse_reserved())
							return else_body;
						if (t === tk || (t === lk && !next && !tk.topofline))
							if (t === tk && t.type === 'TK_WORD')
								parse_top_word();
							else result.push(...parse_line());
					} else {
						if (tk.type === 'TK_WORD')
							parse_top_word();
						else if (tk.type !== 'TK_EOF')
							lk = EMPTY_TOKEN, next = false, result.push(...parse_line());
					}
					if (line_begin_pos !== undefined)
						_this.linepos[(lk.pos ??= document.positionAt(lk.offset)).line] = line_begin_pos;
					next = tk.type === 'TK_RESERVED' && tk.content.toLowerCase() === 'else';
				}
				in_loop = oil;
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

			function parse_line(end?: string, act?: string, min = 0, max = 1, pi?: ParamInfo): AhkSymbol[] {
				let b: number, hascomma = 0, t = 0, nk: Token | undefined, e: number;
				const res: AhkSymbol[] = [], info = pi ?? { offset: 0, count: 0, comma: [], miss: [], unknown: false };
				if ((block_mode = false, next)) {
					const t = _this.get_token(parser_pos, true);
					b = t.content ? t.offset : parser_pos + 1;
					if (t.type === 'TK_COMMA')
						info.miss.push(info.count++);
					else if (!t.topofline || is_line_continue(tk, t))
						++info.count, nk = t;
				} else {
					b = tk.content ? tk.offset : lk.offset + lk.length + 1;
					if (tk.type === 'TK_COMMA')
						info.miss.push(info.count++);
					else if (!tk.topofline || is_line_continue(lk, tk))
						++info.count, nk = tk;
				}
				while (true) {
					res.push(...parse_expression(undefined, 0, end));
					e ??= tk.offset;
					if (tk.type === 'TK_COMMA') {
						next = true, ++hascomma, ++info.count;
						if (lk.type === 'TK_COMMA' || lk.type === 'TK_START_EXPR')
							info.miss.push(info.comma.length);
						else if (lk.type === 'TK_OPERATOR' && !lk.ignore && !lk.content.match(/(--|\+\+|%)/))
							_this.addDiagnostic(diagnostic.unexpected(','), tk.offset, 1);
						info.comma.push(tk.offset), pi && (tk.paraminfo = pi);
					} else if (tk.topofline) {
						next = false;
						break;
					} else if (end === tk.content)
						break;
					else if (t !== parser_pos)
						_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length), next = false;
					if (t === parser_pos && (!continuation_sections_mode || tk.length))
						break;
					t = parser_pos;
				}
				if (act === '=' || act === '=>') {
					let tk = _this.find_token(b), diag = true;
					const tokens = _this.tokens;
					if (tk.offset < e) {
						while (tk && tk.offset < e) {
							if (!tk.ignore && tk.content === '?') {
								diag = false;
								break;
							}
							if (tk.symbol)
								tk = _this.find_token(_this.document.offsetAt(tk.symbol.range.end), true);
							else tk = tokens[tk.next_pair_pos ?? tk.next_token_offset];
						}
						if (diag) {
							if (act === '=' && stop_parse(tokens[nk!.next_token_offset], true) &&
								(next = false, lk = EMPTY_TOKEN, tk = get_token_ignoreComment()))
								return [];
							_this.addDiagnostic(`${diagnostic.unexpected(act)}, ${diagnostic.didyoumean(':=').toLowerCase()}`, min, act.length);
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
						add_include_dllload(data.content.replace(/`;/g, ';'), data, mode, isdll);
						break;
					case '#dllimport':
						if ((m = data.content.match(/^((\w|[^\x00-\x7f])+)/i))) {
							const rg = make_range(data.offset, m[0].length), rg2 = Range.create(0, 0, 0, 0);
							const tps: Record<string, string> = { t: 'ptr', i: 'int', s: 'str', a: 'astr', w: 'wstr', h: 'short', c: 'char', f: 'float', d: 'double', I: 'int64' };
							const n = m[0], args: Variable[] = [];
							let arg: Variable | undefined, u = '', i = 0, rt = 'i';
							h = true, m = data.content.substring(m[0].length).match(/^[ \t]*,[^,]+,([^,]*)/);
							m = m?.[1].replace(/[ \t]/g, '').toLowerCase().replace(/i6/g, 'I') ?? '';
							for (const c of m.replace(/^(\w*)[=@]?=/, (s, m0) => (rt = m0 || rt, ''))) {
								if (c === 'u')
									u = 'u';
								else {
									if (tps[c])
										args.push(arg = Variable.create(`p${++i}_${u + tps[c]}`, SymbolKind.Variable, rg2)), arg.defaultVal = null, u = '';
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
								requirev2 = true;
							else if (_this.maybev1 = 3, !stop_parse(data as Token, false, diagnostic.requirev1()))
								_this.addDiagnostic(diagnostic.unexpected(data.content), data.offset, data.length);
						}
						break;
					case '#hotif':
						if (mode !== 0)
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
					default:
						if (l.match(/^#(if|hotkey|(noenv|persistent|commentflag|escapechar|menumaskkey|maxmem|maxhotkeysperinterval|keyhistory)\b)/i) &&
							!stop_parse(tk))
							_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
						break;
				}
			}

			function parse_statement(local: string) {
				const sta: Variable[] = [];
				let bak: Token, pc: Token | undefined;
				block_mode = false;
				loop:
				while (nexttoken()) {
					if (tk.topofline === 1 && !is_line_continue(lk, tk, _parent)) { next = false; break; }
					switch (tk.type) {
						case 'TK_WORD':
							bak = lk, nexttoken();
							if (tk.type as string === 'TK_EQUALS') {
								let vr: Variable | undefined;
								const equ = tk.content, pp = parser_pos;
								if (bak.type === 'TK_DOT') {
									addprop(lk);
								} else if ((vr = addvariable(lk, mode, sta))) {
									if (mode === 2 && local)
										lk.semantic!.modifier = SemanticTokenModifiers.static;
									if ((pc = comments[vr.selectionRange.start.line]))
										set_detail(vr, pc);
								} else if (local)
									_this.addDiagnostic(diagnostic.conflictserr(local, 'built-in variable', lk.content), lk.offset, lk.length);
								result.push(...parse_expression());
								const t: [number, number] = [pp, lk.offset + lk.length];
								(_parent as FuncNode).ranges?.push(t);
								if (vr) {
									if (equ === ':=' || equ === '??=' && (vr.assigned ??= 1))
										vr.returns = t;
									else vr.cached_types = [equ === '.=' ? STRING : NUMBER];
									vr.assigned ??= true, vr.def = true;
									vr.range.end = document.positionAt(lk.offset + lk.length), vr.def = true;
								}
							} else {
								if (mode === 2) {
									let llk = lk, ttk = tk, err = diagnostic.propnotinit(), dots = 0;
									const v = addvariable(lk, 2, sta)!;
									if (v.def = false, local)
										lk.semantic!.modifier = SemanticTokenModifiers.static;
									if (tk.type as string === 'TK_DOT') {
										while (nexttoken() && tk.type === 'TK_WORD') {
											if (!nexttoken())
												break;
											if (tk.type as string === 'TK_EQUALS') {
												const pp = parser_pos, p = lk, assign = ASSIGN_TYPE.includes(tk.content);
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
											if (tk.type as string === 'TK_DOT')
												addprop(lk), dots++;
											else if (tk.topofline && (allIdentifierChar.test(tk.content) || tk.content === '}')) {
												lk = EMPTY_TOKEN, next = false;
												break loop;
											} else {
												if (tk.content !== ',')
													err = diagnostic.propdeclaraerr();
												else err = '';
												break;
											}
										}
									} else if (!local && tk.content === ':') {	// Typed properties
										let pp = tk.offset + 1, tpexp = '', is_expr = false, _tp: Token | undefined;
										const _p = _parent, static_init = (currsymbol as ClassNode).property.__INIT as FuncNode;
										const _prop = lk, scl = static_init.children!.length;
										delete v.def;
										v.typed = true;
										if (ahk_version < alpha_3)
											_this.addDiagnostic(diagnostic.requireversion('2.1-alpha.3'), lk.offset, lk.length, DiagnosticSeverity.Warning);
										lk = tk, tk = get_next_token(), err = '';
										if (allIdentifierChar.test(tk.content)) {
											_tp = tk, tpexp += tk.content, nexttoken();
										} else if (tk.type === 'TK_START_EXPR') {
											const l = result.length;
											_parent = static_init, is_expr = true;
											parse_pair(tk.content, tk.content as string === '(' ? ')' : ']');
											static_init.children!.push(...result.splice(l));
											_parent = _p, nexttoken();
										} else if (tk.content as string === ':=' || tk.type === 'TK_COMMA' || tk.topofline && allIdentifierChar.test(tk.content))
											_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length), next = false;
										else err = diagnostic.propdeclaraerr();
										if (!err) {
											while (true) {
												if (tk.content === '.' && tk.type !== 'TK_OPERATOR') {
													if (tk.type !== 'TK_DOT')
														_this.addDiagnostic(diagnostic.unexpected('.'), tk.offset, tk.length);
													if (nexttoken() && tk.type as string === 'TK_WORD')
														tpexp += '.' + tk.content, addprop(tk), nexttoken();
												} else if (tk.type === 'TK_START_EXPR' && !tk.prefix_is_whitespace && allIdentifierChar.test(lk.content)) {
													const l = result.length, fc = lk, ttk = tk, predot = lk.previous_token?.type === 'TK_DOT';
													let item;
													_parent = static_init, is_expr = true;
													parse_pair(tk.content, tk.content as string === '(' ? ')' : item = ']');
													static_init.children!.push(...result.splice(l));
													if (!item) {
														const tn: CallSite = DocumentSymbol.create(fc.content, undefined,
															predot ? SymbolKind.Method : SymbolKind.Function,
															make_range(fc.offset, parser_pos - fc.offset), make_range(fc.offset, fc.length));
														Object.assign(ttk.paraminfo ?? {}, { name: fc.content });
														tn.paraminfo = ttk.paraminfo, tn.offset = fc.offset, fc.callsite = tn;
														fc.semantic ??= { type: predot ? SemanticTokenTypes.method : SemanticTokenTypes.function };
													}
													_parent = _p, nexttoken();
												} else break;
											}
											if (_tp) {
												if (tk.previous_token === _tp && /^([iu](8|16|32|64)|f(32|64)|[iu]ptr)$/i.test(_tp.content))
													v.type_annotations = [/^f/i.test(_tp.content) ? 'Float' : 'Integer'];
												else if (_tp.type === 'TK_WORD')
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
											if (tk.type === 'TK_COMMA' || tk.topofline && (allIdentifierChar.test(tk.content) || tk.content === '}') && !(next = false)) {
												static_init.ranges?.push([pp, tk.offset - 1]);
												continue loop;
											}
											_this.addDiagnostic(diagnostic.propdeclaraerr(), _prop.offset, _prop.length);
											static_init.children?.splice(scl);
											llk = tk.previous_token ?? EMPTY_TOKEN, ttk = tk, v.def = false;
										}
									}
									err && _this.addDiagnostic(err, lk.offset, lk.length);
									if (tk.topofline && allIdentifierChar.test(tk.content)) {
										lk = EMPTY_TOKEN, next = false;
										break loop;
									}
									if (!tk.topofline && tk.type as string !== 'TK_COMMA') {
										next = false, lk = llk, tk = ttk, parser_pos = tk.offset + tk.length;
										parse_expression(',');
									}
									next = false;
									break;
								}
								if (tk.type as string === 'TK_COMMA' || (tk.topofline && !(['TK_COMMA', 'TK_OPERATOR', 'TK_EQUALS'].includes(tk.type) && !tk.content.match(/^(!|~|not)$/i)))) {
									const vr = addvariable(lk, mode, sta);
									if (vr) {
										if ((pc = comments[vr.selectionRange.start.line]))
											set_detail(vr, pc);
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
							next = false;
							break loop;
						case 'TK_END_EXPR': _this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, 1);
						// fall through
						default: break loop;
					}
				}
				return sta;
			}

			function parse_expression(inpair?: string, mustexp = 1, end?: string): AhkSymbol[] {
				const pres = result.length, ternarys: number[] = [];
				const bg = (next && (nexttoken(), next = false), tk.offset);
				let byref = undefined;
				block_mode = false;
				while (nexttoken()) {
					if (tk.topofline === 1)
						if ((!inpair || inpair === ',') && !is_line_continue(lk, tk, _parent)) {
							if (lk.type === 'TK_WORD' && input.charAt(lk.offset - 1) === '.')
								addprop(lk);
							next = false; break;
						} else if (lk !== EMPTY_TOKEN)
							tk.topofline = -1;
					switch (tk.type) {
						case 'TK_WORD': {
							const predot = (input.charAt(tk.offset - 1) === '.');
							if (input.charAt(parser_pos) === '(')
								break;
							nexttoken();
							if (tk.type as string === 'TK_COMMA') {
								if (predot)
									addprop(lk);
								else if (input.charAt(lk.offset - 1) !== '%') {
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
							} else if (tk.content === '=>') {
								const rl = result.length, p = lk, _mode = mode, b = parser_pos;
								mode = 1;
								const rg = make_range(p.offset, p.length);
								const sub = parse_expression(inpair, mustexp || 1, end ?? (ternarys.length ? ':' : undefined));
								mode = _mode;
								const tn = FuncNode.create('', SymbolKind.Function, make_range(p.offset, lk.offset + lk.length - p.offset),
									make_range(p.offset, 0), [Variable.create(p.content, SymbolKind.Variable, rg)],
									result.splice(rl));
								tn.children!.push(...sub), tk.fat_arrow_end = true;
								tn.returns = [b, lk.offset + lk.length];
								if (mode !== 0)
									tn.parent = _parent;
								adddeclaration(tn), result.push(tn);
								break;
							} else if (tk.type as string === 'TK_OPERATOR' && (!tk.topofline || !tk.content.match(/^(!|~|not|\+\+|--)$/i))) {
								let suf = !tk.topofline && ['++', '--'].includes(tk.content);
								if (input.charAt(lk.offset - 1) !== '%' && input.charAt(lk.offset + lk.length) !== '%') {
									if (predot) {
										addprop(lk);
									} else {
										const vr = addvariable(lk);
										if (vr) {
											if (byref !== undefined)
												vr.def = vr.assigned = true, byref ? (vr.pass_by_ref = true) : (vr.cached_types = [NUMBER]);
											if (suf)
												vr.def = vr.assigned = true, vr.cached_types = [NUMBER];
											else if (tk.content === '??' || tk.ignore)
												vr.returns = null;
										}
									}
								} else if (predot) {
									maybeclassprop(lk, null);
									tk = lk, lk = tk.previous_token ?? EMPTY_TOKEN;
									parse_prop(inpair), nexttoken(), suf ||= !tk.topofline && ['++', '--'].includes(tk.content);
								} else
									lk.ignore = true;
								next = false;
								continue;
							} else if (tk.topofline && (tk.type as string !== 'TK_EQUALS' && tk.type as string !== 'TK_DOT')) {
								next = false;
								if (!predot) {
									if (input.charAt(lk.offset - 1) !== '%') {
										const vr = addvariable(lk);
										if (vr && byref !== undefined) {
											vr.def = vr.assigned = true;
											if (byref)
												vr.pass_by_ref = true;
											else vr.cached_types = [NUMBER];
										}
									} else lk.ignore = true;
								} else if (input.charAt(lk.offset - 1) !== '%') {
									addprop(lk);
								} else
									lk.ignore = true;
								ternaryMiss(ternarys);
								return result.splice(pres);
							}
							if (!predot) {
								let vr: Variable | undefined;
								if (input.charAt(lk.offset - 1) !== '%' && (vr = addvariable(lk))) {
									if (byref)
										vr.def = vr.pass_by_ref = vr.assigned = true;
									else if (byref === false && tk.type as string !== 'TK_DOT')
										vr.def = vr.assigned = true, vr.cached_types = [NUMBER];
									if (tk.type as string === 'TK_EQUALS') {
										if ((_cm = comments[vr.selectionRange.start.line]))
											set_detail(vr, _cm);
										const equ = tk.content, b = parser_pos;
										next = true;
										result.push(...parse_expression(inpair, mustexp || 1, end ?? (ternarys.length ? ':' : undefined)));
										vr.range.end = document.positionAt(lk.offset + lk.length);
										if (equ === ':=' || equ === '??=' && (vr.assigned ??= 1))
											vr.returns = [b, lk.offset + lk.length];
										else vr.cached_types = [equ === '.=' ? STRING : NUMBER];
										vr.assigned ??= true, vr.def = true;
									} else {
										next = false;
										if (vr.pass_by_ref && tk.type as string === 'TK_DOT')
											_this.addDiagnostic(diagnostic.requirevariable(), lk.previous_token!.offset, 1);
									}
								} else
									next = false, lk.ignore = true;
							} else {
								addprop(lk);
								if ((next = tk.type as string === 'TK_EQUALS'))
									if (ASSIGN_TYPE.includes(tk.content))
										maybeclassprop(lk, undefined, () => {
											const beg = parser_pos;
											result.push(...parse_expression(inpair, mustexp, end ?? (ternarys.length ? ':' : undefined)));
											return [beg, lk.offset + lk.length];
										});
							}
							break;
						}
						case 'TK_START_EXPR':
							if (tk.content === '[') {
								parse_pair('[', ']');
							} else {
								let fc: Token | undefined, quoteend: number, nk: Token;
								const nospace = !lk.type || input.charAt(lk.offset + lk.length) === '(';
								const rl = result.length, ttk = tk, b = tk.offset;
								const info: ParamInfo = { offset: tk.offset, count: 0, comma: [], miss: [], unknown: false };
								if (lk.type === 'TK_WORD' && nospace)
									if (input.charAt(lk.offset - 1) === '.') {
										const ptk = lk;
										parse_pair('(', ')', undefined, info);
										ptk.semantic = { type: SemanticTokenTypes.method };
										const tn: CallSite = DocumentSymbol.create(ptk.content, undefined, SymbolKind.Method,
											make_range(ptk.offset, parser_pos - ptk.offset), make_range(ptk.offset, ptk.length));
										Object.assign(ttk.paraminfo ?? {}, { name: ptk.content, method: true });
										tn.paraminfo = info, tn.offset = ptk.offset, ptk.callsite = tn;
										maybeclassprop(ptk, true);
										continue;
									} else fc = lk;
								const _t = !fc || (input.charAt(fc.offset - 1) !== '%' || fc.previous_token?.previous_pair_pos === undefined);
								parse_pair('(', ')', undefined, info), quoteend = parser_pos;
								if (_t && ((nk = _this.get_token(parser_pos, true)).content === '=>' ||
									!nk.topofline && end !== '{' && nk.content === '{')) {
									result.splice(rl), lk = (tk = ttk).previous_token ?? EMPTY_TOKEN;
									parser_pos = tk.offset + 1;
									const fat_arrow = nk.content === '=>';
									let par = parse_params(true);
									const bbb = fc ? fc.offset : b, rs = result.splice(rl);
									quoteend = parser_pos, nexttoken();
									if (fc) {
										if (fc.content.match(/^\d/))
											_this.addDiagnostic(diagnostic.invalidsymbolname(fc.content), fc.offset, fc.length);
										fc.semantic = { type: SemanticTokenTypes.function, modifier: SemanticTokenModifiers.definition | SemanticTokenModifiers.readonly };
									};
									if (!par)
										par = [], _this.addDiagnostic(diagnostic.invalidparam(), bbb, quoteend - bbb);
									const tn = FuncNode.create(fc?.content ?? '', SymbolKind.Function,
										make_range(bbb, 0),
										make_range(bbb, fc?.length ?? 0), par);
									const _p = _parent, _m = mode;
									_parent = tn, mode = 1, fc ??= ttk;
									result.push(fc.symbol = fc.definition = tn);
									if (fat_arrow) {
										tn.children = rs, rs.push(...parse_expression(inpair, fc?.topofline ? 2 : mustexp || 1,
											end ?? (ternarys.length ? ':' : undefined)));
										tn.range.end = _this.document.positionAt(lk.offset + lk.length);
										tn.returns = [nk.offset + nk.length, lk.offset + lk.length];
										tk.fat_arrow_end = true;
									} else {
										if (ahk_version < alpha_3)
											_this.addDiagnostic(diagnostic.requireversion('2.1-alpha.3'), fc.offset, parser_pos - fc.offset, DiagnosticSeverity.Warning);
										tk.in_expr = bbb;
										tn.children = rs, rs.push(...parse_block(1, tn));
										tn.range.end = document.positionAt(parser_pos);
										tk = _this.tokens[tk.next_pair_pos!] ?? _this.find_token(parser_pos - 1);
										tk.in_expr = bbb, begin_line = false;
									}
									_parent = _p, mode = _m;
									_this.addFoldingRangePos(tn.range.start, tn.range.end, fat_arrow ? 'line' : undefined);
									if (mode !== 0)
										tn.parent = _parent;
									adddeclaration(tn);
								} else if (fc) {
									if (input.charAt(fc.offset - 1) !== '%' || fc.previous_token?.previous_pair_pos === undefined) {
										addvariable(fc);
										fc.semantic ??= { type: SemanticTokenTypes.function };
										const tn: CallSite = DocumentSymbol.create(fc.content, undefined, SymbolKind.Function,
											make_range(fc.offset, quoteend - fc.offset), make_range(fc.offset, fc.length));
										Object.assign(ttk.paraminfo ?? {}, { name: fc.content });
										tn.paraminfo = info, tn.offset = fc.offset, fc.callsite = tn;
									} else fc.ignore = true, delete fc.semantic;
								}
							}
							break;
						case 'TK_START_BLOCK':
							if (bg < tk.offset && (!(lk.type === 'TK_OPERATOR' && lk.op_type !== 1) && lk.type !== 'TK_EQUALS')) {
								next = false, ternaryMiss(ternarys);
								return result.splice(pres);
							} else {
								const l = _this.diagnostics.length;
								let isobj = false;
								if (lk.type === 'TK_RESERVED' && lk.content.toLowerCase() === 'switch') {
									let t: Token;
									next = false;
									if (tk.topofline || (t = _this.get_token(parser_pos)).topofline || t.type.endsWith('COMMENT')) {
										ternaryMiss(ternarys);
										return result.splice(pres);
									}
									next = isobj = true;
								} else if (lk.type === 'TK_EQUALS') {
									if (!':=??='.includes(lk.content)) _this.addDiagnostic(diagnostic.unknownoperatoruse(lk.content), lk.offset, lk.length);
								} else if (mustexp === 1) {
									if (lk.type === 'TK_WORD' || lk.type === 'TK_OPERATOR' && lk.content !== '=>' || lk.type.startsWith('TK_END'))
										mustexp = 0;
								}
								if (parse_obj(mustexp > 0 || isobj)) {
									break;
								} else {
									_this.diagnostics.splice(l);
									ternaryMiss(ternarys), next = false;
									return result.splice(pres);
								}
							}
						case 'TK_NUMBER':
						case 'TK_STRING': break;
						case 'TK_END_BLOCK':
						case 'TK_END_EXPR':
						case 'TK_COMMA':
							next = false;
							ternaryMiss(ternarys);
							return result.splice(pres);
						case 'TK_LABEL': _this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length); break;
						case 'TK_UNKNOWN': _this.addDiagnostic(diagnostic.unknowntoken(tk.content), tk.offset, tk.length); break;
						case 'TK_RESERVED': {
							const c = input.charAt(tk.offset + tk.length);
							if (c === '%' || input.charAt(tk.offset - 1) === '%') {
								next = false, tk.type = 'TK_WORD', tk.semantic = { type: SemanticTokenTypes.variable };
								break;
							}
							if (/^(class|super|isset)$/i.test(tk.content)) {
								if (tk.content.toLowerCase() === 'isset' && parse_isset(c))
									break;
								next = false, tk.type = 'TK_WORD';
								break;
							} else if (ahk_version >= alpha_3) {
								if (tk.content.toLowerCase() === 'throw') {
									next = false, tk.type = 'TK_WORD';
									break;
								}
							}
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
							break;
						}
						case 'TK_OPERATOR':
							if (tk.content === '%') {
								const prec = input.charAt(tk.offset - 1);
								if (inpair === '%') {
									next = false;
									ternaryMiss(ternarys);
									return result.splice(pres);
								}
								prec === '.' ? (maybeclassprop(tk, null), parse_prop()) : parse_pair('%', '%');
							} else if (tk.content === '=>' && lk.type === 'TK_WORD') {
								if (result.length && result.at(-1)!.name === lk.content)
									result.pop();
								const tn = FuncNode.create('', SymbolKind.Function, make_range(lk.offset, lk.length),
									make_range(lk.offset, 0), [Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length))]);
								tn.returns = [parser_pos, 0];
								tn.children = parse_expression(inpair, 1, end ?? (ternarys.length ? ':' : undefined));
								tn.range.end = document.positionAt(tn.returns[1] = lk.offset + lk.length);
								tk.fat_arrow_end = true;
								if (mode !== 0)
									tn.parent = _parent;
								result.push(tn), adddeclaration(tn);
							} else {
								if (allIdentifierChar.test(tk.content) && (input[tk.offset - 1] === '%' || input[tk.offset + tk.length] === '%')) {
									next = false, tk.type = 'TK_WORD', tk.semantic = { type: SemanticTokenTypes.variable };
									break;
								}
								if (tk.content === ':') {
									if (ternarys.pop() === undefined) {
										if (end === ':') {
											next = false;
											return result.splice(pres);
										}
										_this.addDiagnostic(diagnostic.unexpected(':'), tk.offset, 1);
									}
								} else if (tk.content === '?') {
									if (!tk.ignore)
										ternarys.push(tk.offset);
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
						case 'TK_EQUALS': break;
					}
					byref = undefined;
				}
				ternaryMiss(ternarys);
				return result.splice(pres);
			}

			function parse_params(must = false, endc = ')') {
				const beg = parser_pos - 1, cache: ParamList = [], la = [',', endc === ')' ? '(' : '['];
				let byref = false, paramsdef = true, bb = parser_pos, bak = tk, hasexpr = false, lineno: number | undefined;
				const info: ParamInfo = { offset: beg, count: 0, comma: [], miss: [], unknown: false };
				block_mode = false, bak.paraminfo = info;
				if (lk.type === 'TK_WORD' && bak.prefix_is_whitespace === undefined)
					info.name = lk.content;
				while (nexttoken()) {
					if (tk.topofline === 1)
						tk.topofline = -1;
					if (tk.content === endc) {
						if (lk.type === 'TK_COMMA') {
							if (must) {
								_this.addDiagnostic(diagnostic.unexpected(endc), tk.offset, tk.length);
								break;
							}
							tk.previous_pair_pos = beg;
							lk.paraminfo = info;
							info.miss.push(info.count++);
							result.push(...cache);
							return;
						}
						break;
					} else if (tk.type === 'TK_WORD') {
						if (is_builtinvar(tk.content.toLowerCase())) {
							paramsdef = false; break;
						}
						info.count++;
						if (la.includes(lk.content) || lk === EMPTY_TOKEN) {
							nexttoken();
							if (tk.content === ',' || tk.content === endc) {
								if (lk.content.match(/^\d/))
									_this.addDiagnostic(diagnostic.invalidsymbolname(lk.content), lk.offset, lk.length);
								const tn = Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length));
								if ((_cm = comments[tn.selectionRange.start.line]) && tn.selectionRange.start.line > (lineno ??= _this.document.positionAt(beg).line))
									set_detail(tn, _cm);
								if (byref)
									byref = false, tn.pass_by_ref = tn.def = tn.assigned = true;
								cache.push(tn), bb = parser_pos, bak = tk;
								if (tk.content === ',')
									info.comma.push(tk.offset), tk.paraminfo = info;
								else break;
							} else if (tk.content === ':=' || must && tk.content === '=') {
								if (tk.content === '=') {
									stop_parse(lk);
									_this.addDiagnostic(`${diagnostic.unexpected('=')}, ${diagnostic.didyoumean(':=').toLowerCase()}`, tk.offset, tk.length);
								}
								const ek = tk;
								if (lk.content.match(/^\d/))
									_this.addDiagnostic(diagnostic.invalidsymbolname(lk.content), lk.offset, lk.length);
								const tn = Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length));
								if ((_cm = comments[tn.selectionRange.start.line]) && tn.selectionRange.start.line > (lineno ??= _this.document.positionAt(beg).line))
									set_detail(tn, _cm);
								tn.def = true, tn.defaultVal = null, cache.push(tn);
								result.push(...parse_expression(',', 2)), next = true;
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
								if (tk.type as string === 'TK_COMMA') {
									info.comma.push(tk.offset);
									tk.paraminfo = info;
									continue;
								} else {
									paramsdef = tk.content === endc;
									break;
								}
							} else if (tk.type as string === 'TK_OPERATOR') {
								if (tk.content === '*') {
									const t = lk;
									nexttoken();
									if (tk.content === endc) {
										const tn = Variable.create(t.content, SymbolKind.Variable, make_range(t.offset, t.length));
										cache.push(tn), tn.arr = true, info.unknown = true, bb = parser_pos, bak = tk;
										break;
									} else { paramsdef = false, info.count--; break; }
								} else if (tk.content === '?' && tk.ignore) {
									const t = lk;
									const tn = Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length));
									tn.def = true, tn.defaultVal = null, cache.push(tn);
									if (byref)
										byref = false, tn.pass_by_ref = tn.assigned = true;
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
							} else {
								if (must && lk.type === 'TK_WORD' && lk.content.toLowerCase() === 'byref' && tk.type === 'TK_WORD') {
									stop_parse(lk);
									_this.addDiagnostic(diagnostic.deprecated('&', 'ByRef'), lk.offset, tk.topofline ? lk.length : tk.offset - lk.offset);
									next = false, lk = EMPTY_TOKEN;
									continue;
								}
								paramsdef = false, info.count--;
								break;
							}
						} else { paramsdef = false, info.count--; break; }
					} else if (la.includes(lk.content)) {
						if (tk.content === '*') {
							const t = tk;
							let tn;
							nexttoken();
							if (tk.content === endc) {
								cache.push(tn = Variable.create('', SymbolKind.Variable, make_range(t.offset, 0)));
								tn.arr = true;
								break;
							} else _this.addDiagnostic(diagnostic.unexpected('*'), t.offset, 1);
						} else if (tk.content === '&') {
							const t = tk;
							tk = get_token_ignoreComment();
							if (tk.type === 'TK_WORD') {
								byref = true, next = false; continue;
							} else _this.addDiagnostic(diagnostic.unexpected('&'), t.offset, 1);
						}
						paramsdef = false; break;
					} else {
						paramsdef = false; break;
					}
				}
				info.comma.forEach(o => _this.tokens[o].paraminfo = info);
				if (paramsdef) {
					if (hasexpr)
						cache.format = format_params_default_val.bind(undefined, _this.tokens);
					tk.previous_pair_pos = beg, _this.tokens[beg].next_pair_pos = tk.offset;
					_this.addFoldingRange(beg, parser_pos, 'block');
					return cache;
				} else {
					result.push(...cache);
					parser_pos = bb, tk = bak;
					parse_pair(endc === ')' ? '(' : '[', endc, beg, info);
					return;
				}
			}

			function parse_prop(end?: string) {
				next = false, parser_pos = tk.offset + tk.length;
				while (nexttoken()) {
					switch (tk.type) {
						case 'TK_OPERATOR':
							if (tk.content === '%') {
								if (end === '%')
									return next = false;
								parse_pair('%', '%');
								if (isIdentifierChar(input.charCodeAt(parser_pos)))
									break;
								return;
							}
						// fall through
						case 'TK_NUMBER':
							if (!allIdentifierChar.test(tk.content))
								return next = false;
						// fall through
						case 'TK_RESERVED':
						case 'TK_WORD':
							tk.type = 'TK_WORD';
							tk.semantic = { type: SemanticTokenTypes.property };
							if (input.charAt(parser_pos) === '%' && (tk.ignore = true))
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
				const l = lk, b = tk, rl = result.length, mark: number[] = [], props: Record<string, AhkSymbol> = {};
				let isobj = true, k: Token | undefined, e: Token | undefined;
				block_mode = false, next = true, tk.data = OBJECT;
				while (isobj) {
					if (!objkey() || objval()) {
						if (must && !isobj) {
							e = lk, isobj = true;
							while (!',}'.includes(tk.content))
								parse_expression('}', 2), next = true;
							next = true;
							_this.addDiagnostic(diagnostic.objectliteralerr(), e.offset, lk.offset + lk.length - e.offset);
							if (tk.content === ',')
								continue;
						}
						break;
					}
				}
				if (isobj || must)
					for (const o of mark)
						(k = tokens[o]).type = 'TK_WORD', k.semantic = { type: SemanticTokenTypes.property };
				if (!isobj) {
					lk = l, tk = b, result.splice(rl);
					parser_pos = tk.skip_pos ?? tk.offset + tk.length;
					return next = false;
				} else if (lk.content === ':' || lk.type === 'TK_LABEL')
					_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
				if (b.data = OBJECT, tk.type === 'TK_END_BLOCK') {
					_this.addFoldingRange(tk.previous_pair_pos = b.offset, tk.offset);
					b.next_pair_pos = tk.offset;
					if (Object.keys(props).length) {
						const cls = DocumentSymbol.create('', undefined, SymbolKind.Class, ZERO_RANGE, ZERO_RANGE) as ClassNode;
						b.data = cls, cls.property = props, cls.name = cls.full = cls.extends = '';
					}
					tk.data = b.data;
				} else
					_this.addDiagnostic(diagnostic.missing('}'), b.offset, 1);
				return true;

				function objkey(): boolean {
					while (nexttoken()) {
						k = undefined;
						tk.topofline === 1 && (tk.topofline = -1);
						switch (tk.type) {
							case 'TK_OPERATOR':
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
							case 'TK_NUMBER':
								if (!allIdentifierChar.test(tk.content))
									return isobj = false;
							// fall through
							case 'TK_RESERVED':
							case 'TK_WORD': {
								mark.push(tk.offset);
								if (input.charAt(parser_pos) === '%')
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
							case 'TK_STRING':
								nexttoken();
								if (tk.content === ':') {
									k = { ...lk }, k.content = k.content.slice(1, -1), k.offset++, k.length -= 2;
									if (!h && (!lk.content.startsWith('"') || !stop_parse(lk)))
										_this.addDiagnostic(
											[diagnostic.invalidpropname(), diagnostic.didyoumean(k.content)].join(', '),
											lk.offset, lk.length);
									return true;
								}
								return isobj = false;
							case 'TK_LABEL':
								if (tk.content.match(/^(\w|[^\x00-\x7f])+:$/)) {
									k = { ...tk }, k.content = k.content.slice(0, -1), k.length--;
									return true;
								}
								return isobj = false;
							case 'TK_END_BLOCK':
								if (lk.type === 'TK_START_BLOCK' || lk.type === 'TK_COMMA')
									return false;
							// fall through
							case 'TK_START_EXPR':
								return isobj = false;
							case 'TK_COMMA':
								if (lk.type === 'TK_COMMA' || lk.type === 'TK_START_BLOCK')
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
						(props[k.content.toUpperCase()] = Variable.create(k.content, SymbolKind.Property, make_range(k.offset, k.length)))
							.returns = [colon + 1, lk.offset + lk.length];
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

			function parse_pair(b: string, e: string, pairbeg?: number, paraminfo?: ParamInfo, strs?: Token[]) {
				let pairnum = 0, apos = result.length, tp = parser_pos, llk = lk;
				const pairpos = [pairbeg ??= tk.offset], _pk = _this.tokens[pairbeg], ternarys: number[] = [];
				const info: ParamInfo = paraminfo ?? { offset: pairbeg, count: 0, comma: [], miss: [], unknown: false };
				let iscall = false, rpair = 0, byref;
				if (b !== '%') {
					const t = _pk.previous_token;
					_pk.paraminfo = info;
					if (info.name || !_pk.topofline && t && _pk.prefix_is_whitespace === undefined
						&& ((t.previous_pair_pos ?? t.in_expr) !== undefined || t.type === 'TK_WORD' || t.type === 'TK_DOT'))
						iscall = true;
				} else _pk.op_type = -1;
				while (nexttoken()) {
					if (tk.topofline) {
						if (b === '%' && !(['TK_COMMA', 'TK_OPERATOR', 'TK_EQUALS'].includes(tk.type) && !tk.content.match(/^(!|~|not)$/i))) {
							stop_parse(_pk);
							_pk.next_pair_pos = -1;
							_this.addDiagnostic(diagnostic.missing('%'), pairbeg, 1);
							next = false;
							ternaryMiss(ternarys);
							return;
						}
						if (tk.topofline === 1)
							tk.topofline = -1;
					}
					if (b !== '(' && tk.content === '(') {
						apos = result.length, tp = parser_pos, rpair = 1, llk = lk;
						parse_pair('(', ')');
					} else if (tk.content === e) {
						tokens[tk.previous_pair_pos = pairpos.pop() as number].next_pair_pos = tk.offset;
						if (e !== '%')
							_this.addFoldingRange(tk.previous_pair_pos as number, tk.offset + 1, 'block');
						else tk.op_type = 1;
						if ((--pairnum) < 0)
							break;
						if (e === ')')
							rpair++;
					} else if (tk.content === b) {
						if (b === '(') {
							if (input.charAt(tk.offset - 1) === ')') {
								parse_pair('(', ')');
								continue;
							}
							apos = result.length, tp = parser_pos, rpair = 0;
						}
						pairnum++, pairpos.push(parser_pos - 1), llk = lk;
					} else if (tk.content === '=>' || rpair === 1 && lk.content === ')' && tk.content === '{') {
						let rs = result.splice(apos), par: AhkSymbol[] | undefined, nk: Token, b = -1;
						const end = tk.content, bb = tk;
						if (lk.content === ')') {
							if (rpair !== 1) {
								_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, 2), next = true;
								continue;
							}
							lk = llk, parser_pos = tp - 1, tk = get_next_token(), b = tk.offset;
							rs = [], par = parse_params(true);
							if (!par) { par = [], _this.addDiagnostic(diagnostic.invalidparam(), b, tk.offset - b + 1); }
							nk = get_token_ignoreComment();
						} else if (lk.type === 'TK_WORD' && input.charAt(lk.offset - 1) !== '.') {
							nk = tk, b = lk.offset;
							par = [Variable.create(lk.content, SymbolKind.Variable, make_range(lk.offset, lk.length))];
						} else {
							_this.addDiagnostic(diagnostic.unknownoperatoruse(), tk.offset, 2), next = true;
							continue;
						}
						if (nk.content !== end) {
							tk = bb, parser_pos = bb.offset + bb.length, next = true, result.push(...rs);
							_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, tk.length);
							continue;
						}
						rs.push(...result.splice(apos));
						const tn = FuncNode.create('', SymbolKind.Function, make_range(b, 0), make_range(b, 0), par, rs);
						_this.tokens[b].symbol = tn;
						if (nk.content === '=>') {
							lk = tk, tk = nk;
							rs.push(...parse_expression(e, 2, ternarys.length ? ':' : undefined));
							tn.range.end = _this.document.positionAt(lk.offset + lk.length);
							tn.returns = [nk.offset + 2, lk.offset + lk.length];
							tk.fat_arrow_end = true;
						} else {
							if (ahk_version < alpha_3)
								_this.addDiagnostic(diagnostic.requireversion('2.1-alpha.3'), tp - 1, parser_pos - tp, DiagnosticSeverity.Warning);
							nk.in_expr = b;
							rs.push(...parse_block(1, tn));
							tn.range.end = document.positionAt(parser_pos);
							tk = _this.tokens[tk.next_pair_pos!] ?? _this.find_token(parser_pos - 1);
							tk.in_expr = b, begin_line = false;
						}
						if (mode !== 0)
							tn.parent = _parent;
						apos = result.length;
						result.push(tn), adddeclaration(tn);
						if (end === '=>' && ',:)]}'.includes(tk.content))
							tk.fat_arrow_end = true;
					} else switch (tk.type) {
						case 'TK_WORD':
							if (input.charAt(tk.offset - 1) !== '.') {
								if (input.charAt(parser_pos) !== '(') {
									if (b === '%' || (input.charAt(tk.offset - 1) !== '%' && input.charAt(tk.offset + tk.length) !== '%')) {
										const vr = addvariable(tk);
										if (vr) {
											nexttoken(), next = false;
											if (tk.type as string === 'TK_EQUALS') {
												if ((_cm = comments[vr.selectionRange.start.line]))
													set_detail(vr, _cm);
												const equ = tk.content, bb = parser_pos;
												next = true;
												result.push(...parse_expression(e, 2, ternarys.length ? ':' : undefined));
												vr.range.end = document.positionAt(lk.offset + lk.length);
												if (equ === ':=' || equ === '??=' && (vr.assigned ??= 1))
													vr.returns = [bb, lk.offset + lk.length];
												else vr.cached_types = [equ === '.=' ? STRING : NUMBER];
												vr.assigned ??= true, vr.def = true;
											} else if (!byref) {
												if (tk.type as string === 'TK_DOT')
													byref ||= undefined;
												else !tk.topofline && ['++', '--'].includes(tk.content) && (byref = false);
											}
											if (byref !== undefined)
												vr.def = vr.assigned = true, byref ? (vr.pass_by_ref = true) : (vr.cached_types = [NUMBER]);
											else if (tk.content === '??' || tk.ignore && tk.content === '?')
												vr.returns = null;
										}
									} else tk.ignore = true;
								} else {
									lk = tk, tk = get_next_token();
									const fc = lk, ttk = tk, rl = result.length, par = parse_params(), quoteend = parser_pos;
									const _t = input.charAt(fc.offset - 1) !== '%' || fc.previous_token?.previous_pair_pos === undefined;
									let fat_arrow: boolean;
									nexttoken();
									if (_t && ((fat_arrow = tk.content === '=>') || tk.content === '{')) {
										const pp = _parent, b = parser_pos;
										if (!par) { _this.addDiagnostic(diagnostic.invalidparam(), fc.offset, tk.offset - fc.offset + 1); }
										const tn = FuncNode.create(fc.content, SymbolKind.Function, make_range(fc.offset, parser_pos - fc.offset),
											make_range(fc.offset, fc.length), <Variable[]>par || []);
										if (fc.content.match(/^\d/))
											_this.addDiagnostic(diagnostic.invalidsymbolname(fc.content), fc.offset, fc.length);
										fc.symbol = fc.definition = _parent = tn;
										if (fat_arrow) {
											(tn.children = result.splice(rl)).push(
												...parse_expression(e, 2, ternarys.length ? ':' : undefined));
											tn.range.end = document.positionAt(lk.offset + lk.length);
											tn.returns = [b, lk.offset + lk.length];
											tk.fat_arrow_end = true;
										} else {
											if (ahk_version < alpha_3)
												_this.addDiagnostic(diagnostic.requireversion('2.1-alpha.3'), fc.offset, parser_pos - fc.offset, DiagnosticSeverity.Warning);
											tk.in_expr = fc.offset;
											(tn.children = result.splice(rl)).push(...parse_block(1, tn));
											tn.range.end = document.positionAt(parser_pos);
											tk = _this.tokens[tk.next_pair_pos!] ?? _this.find_token(parser_pos - 1);
											tk.in_expr = fc.offset, begin_line = false;
										}
										fc.semantic = { type: SemanticTokenTypes.function, modifier: SemanticTokenModifiers.definition | SemanticTokenModifiers.readonly };
										_parent = pp;
										if (mode !== 0)
											tn.parent = _parent;
										adddeclaration(tn);
										result.push(tn), _this.addFoldingRangePos(tn.range.start, tn.range.end, fat_arrow ? 'line' : undefined);
									} else {
										if (_t) {
											let tn: CallSite;
											addvariable(fc), tn = DocumentSymbol.create(fc.content, undefined, SymbolKind.Function,
												make_range(fc.offset, quoteend - fc.offset), make_range(fc.offset, fc.length));
											Object.assign(ttk.paraminfo ?? {}, { name: fc.content });
											tn.paraminfo = ttk.paraminfo, tn.offset = fc.offset, fc.callsite = tn;
											fc.semantic ??= { type: SemanticTokenTypes.function };
										} else
											fc.ignore = true, delete fc.semantic;
										next = false;
										if (par) for (const it of par) if (!is_builtinvar(it.name.toLowerCase())) {
											result.push(it);
											if (it.pass_by_ref || it.returns)
												it.def = true;
										}
									}
								}
							} else if (input.charAt(parser_pos) === '(') {
								const ptk = tk, ttk = tk = get_next_token();
								parse_pair('(', ')');
								ptk.semantic = { type: SemanticTokenTypes.method };
								const tn: CallSite = DocumentSymbol.create(ptk.content, undefined, SymbolKind.Method,
									make_range(ptk.offset, parser_pos - ptk.offset), make_range(ptk.offset, ptk.length));
								Object.assign(ttk.paraminfo ?? {}, { name: ptk.content, method: true });
								tn.paraminfo = ttk.paraminfo, tn.offset = ptk.offset, ptk.callsite = tn;
								maybeclassprop(ptk, true);
							} else if (b !== '%' && input.charAt(parser_pos) === '%') {
								maybeclassprop(tk, null), parse_prop();
								nexttoken(), next = false;
							} else {
								addprop(tk), nexttoken(), next = false;
								if (tk.type as string === 'TK_EQUALS')
									if (ASSIGN_TYPE.includes(tk.content))
										maybeclassprop(lk, undefined, () => {
											const beg = parser_pos;
											result.push(...parse_expression(e, 2, ternarys.length ? ':' : undefined));
											return [beg, lk.offset + lk.length];
										});
							}
							break;
						case 'TK_START_BLOCK':
							if (['TK_WORD', 'TK_STRING', 'TK_NUMBER'].includes(lk.type))
								_this.addDiagnostic(diagnostic.unexpected('{'), tk.offset, tk.length);
							parse_obj(true);
							break;
						case 'TK_STRING':
							strs?.push(tk);
							if (b === '[' && is_next_char(']') && !/\n|`n/.test(tk.content))
								addtext(tk.content.substring(1, tk.content.length - 1));
							break;
						case 'TK_END_BLOCK':
						case 'TK_END_EXPR':
							_this.addDiagnostic(diagnostic.unexpected(tk.content), tk.offset, 1);
							pairMiss(), next = false;
							ternaryMiss(ternarys);
							return;
						case 'TK_RESERVED': {
							const c = input.charAt(tk.offset + tk.length);
							if (b !== '%' && (c === '%' || input.charAt(tk.offset - 1) === '%')) {
								next = false, tk.type = 'TK_WORD', tk.semantic = { type: SemanticTokenTypes.variable };
								continue;
							}
							if (/^(class|super|isset)$/i.test(tk.content)) {
								if (tk.content.toLowerCase() === 'isset' && parse_isset(c))
									continue;
								next = false, tk.type = 'TK_WORD';
								continue;
							} else if (ahk_version >= alpha_3) {
								if (tk.content.toLowerCase() === 'throw') {
									next = false, tk.type = 'TK_WORD';
									continue;
								}
							}
							_this.addDiagnostic(diagnostic.reservedworderr(tk.content), tk.offset, tk.length);
							break;
						}
						case 'TK_COMMA':
							if (pairnum === 0 && b !== '%') {
								++info.count;
								if (lk.type === 'TK_COMMA' || lk.type === 'TK_START_EXPR')
									info.miss.push(info.comma.length);
								else if (!lk.ignore && lk.type === 'TK_OPERATOR' && !lk.content.match(/(--|\+\+|%)/))
									_this.addDiagnostic(diagnostic.unexpected(','), tk.offset, 1);
								info.comma.push(tk.offset), iscall && (tk.paraminfo = info);
							}
							break;
						case 'TK_OPERATOR':
							if (tk.content === '%') {
								const prec = input.charAt(tk.offset - 1);
								prec === '.' ? (maybeclassprop(tk, null), parse_prop(e)) : parse_pair('%', '%');
								break;
							}
							if (allIdentifierChar.test(tk.content) && (input[tk.offset - 1] === '%' || input[tk.offset + tk.length] === '%')) {
								next = false, tk.type = 'TK_WORD', tk.semantic = { type: SemanticTokenTypes.variable };
								continue;
							}
							if (tk.content === ':') {
								if (ternarys.pop() === undefined)
									_this.addDiagnostic(diagnostic.unexpected(':'), tk.offset, 1);
							} else if (tk.content === '?')
								!tk.ignore && ternarys.push(tk.offset);
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
						case 'TK_UNKNOWN':
							_this.addDiagnostic(diagnostic.unknown(tk.content), tk.offset, tk.length);
							break;
						default:
							if (tk.content === '[')
								parse_pair('[', ']');
							else if (tk.content === '.')
								check_operator(tk);
							break;
					}
					byref = undefined;
				}
				if (tk.type === 'TK_EOF' && pairnum > -1)
					e === '%' && stop_parse(_pk), pairMiss();
				else
					tokens[tk.previous_pair_pos!].next_pair_pos = tk.offset;
				if (b !== '%') {
					if (lk.content === ',')
						info.miss.push(info.count++);
					else if (lk.type !== 'TK_START_EXPR') {
						info.count++;
						if (lk.content === '*')
							info.unknown = true, info.count--;
					}
				}
				ternaryMiss(ternarys);

				function pairMiss() {
					let o: number | undefined;
					while ((o = pairpos.pop()) !== undefined)
						_this.addDiagnostic(diagnostic.missing(e), o, 1);
				}
			}

			function parse_isset(c: string) {
				const l = result.length;
				tk.definition = ahkvars.ISSET;
				tk.ignore = true, tk.type = 'TK_WORD';
				tk.semantic = { type: SemanticTokenTypes.operator };
				if (c === '(') {
					const fc = tk;
					addvariable(tk);
					nexttoken(), parse_pair('(', ')');
					const pc = tokens[tk.previous_pair_pos!]?.paraminfo?.count ?? 0;
					if (pc !== 1 && getCfg(CfgKey.ParamsCheck))
						_this.addDiagnostic(diagnostic.paramcounterr(1, pc), fc.offset, parser_pos - fc.offset);
					else if (result.length > l && lk.type === 'TK_WORD') {
						const vr = result.at(-1) as Variable;
						if (lk.content === vr.name && lk.offset === _this.document.offsetAt(vr.range.start))
							vr.assigned ??= 1, vr.returns ??= null;
					}
					return true;
				}
				_this.addDiagnostic(diagnostic.missing('('), tk.offset, 5);
			}

			function ternaryMiss(ternarys: number[]) {
				let o: number | undefined;
				while ((o = ternarys.pop()) !== undefined) {
					const q = _this.tokens[o];
					const t = _this.tokens[q.next_token_offset] ?? EMPTY_TOKEN;
					// %a?%
					if (t.previous_pair_pos !== undefined && (q.ignore = true))
						continue;
					// a?.123
					if (input[t.offset] === '.') {
						if (ahk_version < alpha_3 - 1)
							_this.addDiagnostic(diagnostic.requireversion('2.1-alpha.2'), o, 1, DiagnosticSeverity.Warning);
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
				if (input.charAt(ts.offset - 1) === '.' &&
					(ts.content.toLowerCase() !== 'prototype' ||
						(proto = true, !(ts = ts.previous_token?.previous_token) ||
							input.charAt(ts.offset - 1) === '.')))
					return;
				_low = ts!.content.toLowerCase();
				if (_low !== 'this' && _low !== 'super' || !(cls = get_class()) || proto && !(cls = cls.prototype) || !cls.cache)
					return;
				if (flag) {
					const pi = tk.callsite?.paraminfo;
					if (pi && tk.content.toLowerCase() === 'defineprop' && pi.count > 1 && pi.miss[0] !== 0) {
						const end = pi.comma[0], s = !!cls.prototype;
						let nk = tokens[tk.next_token_offset];
						if (input.charAt(tk.offset + tk.length) === '(')
							nk = tokens[nk.next_token_offset];
						if (nk.type !== 'TK_STRING' || nk.next_token_offset !== end)
							cls.checkmember = false;
						else {
							const o = tokens[tokens[end].next_token_offset], prop = nk.content.slice(1, -1);
							let t: Property | FuncNode, pp, sym;
							rg = make_range(nk.offset + 1, prop.length);
							if (o.type !== 'TK_START_BLOCK' || !(pp = (o.data as ClassNode)?.property) ||
								pp.GET || pp.VALUE || pp.SET) {
								t = Variable.create(prop, SymbolKind.Property, rg);
								t.full = `(${classfullname.slice(0, -1)}) ${((t.static = s)) ? 'static ' : ''}${prop}`;
								t.parent = cls, sym = t;
								if ((t.returns = pp?.GET?.returns))
									(t as FuncNode).alias = true;
								else t.returns = pp?.VALUE?.returns;
							}
							if ((pp = pp?.CALL)) {
								t = Variable.create('', SymbolKind.Variable, make_range(0, 0)), t.arr = true;
								t = FuncNode.create(prop, SymbolKind.Method, rg, rg, [t], undefined, s);
								t.full = `(${classfullname.slice(0, -1)}) ${t.full}`;
								t.returns = pp.returns, (t as FuncNode).alias = true;
								t.parent = cls;
								if (!sym)
									sym = t;
								else {
									sym = { ...sym, [(sym as FuncNode).alias ? 'get' : sym.returns ? 'val' : 'set']: sym };
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
					const kinds: SymbolKind[] = [SymbolKind.Method, SymbolKind.Property];
					let p = _parent, s = true;
					while (p && p.kind !== SymbolKind.Class) {
						if (kinds.includes(p.kind))
							s = !!p.static;
						p = p.parent!;
					}
					if (s)
						return p as ClassNode;
					return (p as ClassNode)?.prototype;
				}
			}

			function is_builtinvar(name: string, mode = 0): boolean {
				if (mode === 2)
					return false;
				if (builtin_variable.includes(name) || (h && builtin_variable_h.includes(name)))
					return true;
				return false;
			}

			function addvariable(token: Token, md: number = 0, p?: AhkSymbol[]) {
				const _low = token.content.toLowerCase();
				if (token.ignore || is_builtinvar(_low, md) && (token.ignore = true)) {
					if ((token.definition = ahkvars[_low.toUpperCase()])?.uri)
						(p ?? result).push(Variable.create(token.content, SymbolKind.Variable, make_range(token.offset, token.length)));
					return;
				}
				if (!token.length)
					return;
				const rg = make_range(token.offset, token.length), tn = Variable.create(token.content, SymbolKind.Variable, rg);
				if (md === 2) {
					tn.kind = SymbolKind.Property;
					addprop(token, tn);
					if (classfullname)
						tn.full = `(${classfullname.slice(0, -1)}) ${tn.name}`, token.symbol = tn;
				} else if (_low.match(/^\d/))
					_this.addDiagnostic(diagnostic.invalidsymbolname(token.content), token.offset, token.length);
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
				const _diags = _this.diagnostics, severity = DiagnosticSeverity.Error;
				let t: Variable, lpv = false, pars: Record<string, Variable> = {};
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
								_diags.push({ message: diagnostic.dupdeclaration(), range: it.selectionRange, severity });
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
							_diags.push({ message: diagnostic.dupdeclaration(), range: it.selectionRange, severity });
					});
					children.push(...__init, ...cls.cache ?? [], ...cls.prototype!.cache ?? []);
					cls.cache?.forEach(it => sdec[it.name.toUpperCase()] ??= it);
					cls.prototype!.cache?.forEach(it => dec[it.name.toUpperCase()] ??= it);
					delete cls.cache;
					delete cls.prototype!.cache;
				} else {
					const fn = node as FuncNode, dec = fn.declaration, has_this_param = fn.has_this_param;
					let vars: Record<string, Variable> = {}, unresolved_vars: Record<string, Variable> = {}, vr: Variable;
					let named_params: Variable[] | undefined = [];
					if (has_this_param) {
						pars.THIS = dec.THIS = THIS;
						pars.SUPER = dec.SUPER = SUPER;
						if (fn.kind === SymbolKind.Function)
							named_params = undefined;
					} else if (reserved_words.includes(fn.name.toLowerCase()))
						_this.diagnostics.push({ message: diagnostic.reservedworderr(fn.name), range: fn.selectionRange, severity });
					for (const it of fn.params ?? []) {
						it.def = it.assigned = it.is_param = true;
						if (!it.name)
							continue;
						named_params?.push(it);
						if (it.defaultVal !== undefined || it.arr)
							lpv = true;
						else if (lpv)
							_diags.push({
								message: diagnostic.defaultvalmissing(it.name),
								range: it.selectionRange, severity
							});
						if ((t = pars[_low = it.name.toUpperCase()]))
							_diags.push({
								message: diagnostic.conflictserr('parameter', 'parameter', t.name),
								range: it.selectionRange, severity
							});
						else pars[_low] = dec[_low] = vars[_low] = it;
					}
					for (const [k, v] of Object.entries(fn.local ?? {})) {
						if ((t = pars[k]))
							_diags.push({
								message: diagnostic.conflictserr(v.static ? 'static' : 'local', 'parameter', t.name),
								range: v.selectionRange, severity
							});
						else dec[k] = v, v.assigned ||= Boolean(v.returns);
					}
					for (const [k, v] of Object.entries(fn.global ?? {})) {
						if ((t = dec[k])) {
							if (pars[k]) {
								_diags.push({
									message: diagnostic.conflictserr('global', 'parameter', t.name),
									range: v.selectionRange, severity
								});
								continue;
							}
							const varsp = v.static ? 'static' : 'local';
							_diags.push({
								message: diagnostic.conflictserr(...(
									t.selectionRange.start.line < v.selectionRange.start.line ?
										(t = v, ['global', varsp]) : [varsp, 'global']
								), t.name),
								range: t.selectionRange, severity
							});
							if (v !== t) continue;
							delete fn.local[k];
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
										range: it.selectionRange, severity
									});
									continue;
								} else if ((t = fn.global[_low])) {
									_diags.push({
										message: diagnostic.conflictserr(...(
											t.selectionRange.start.line < it.selectionRange.start.line ||
												t.selectionRange.start.line === it.selectionRange.start.line &&
												t.selectionRange.start.character < it.selectionRange.start.character ?
												(t = it, ['function', 'global']) : ['global', 'function']
										), t.name),
										range: t.selectionRange, severity
									});
									if (it === t) continue;
									delete fn.global[_low];
									delete t.is_global;
									if (_this.declaration[_low] === t)
										delete _this.declaration[_low];
								} else if ((t = fn.local[_low])) {
									if (t.selectionRange.start.line < it.selectionRange.start.line ||
										t.selectionRange.start.line === it.selectionRange.start.line &&
										t.selectionRange.start.character < it.selectionRange.start.character) {
										_diags.push({
											message: diagnostic.conflictserr('function',
												t.kind === SymbolKind.Function ? 'Func' : t.static ? 'static' : 'local', it.name),
											range: it.selectionRange, severity
										});
										continue;
									} else if (t.static)
										_diags.push({
											message: diagnostic.conflictserr(t.kind === SymbolKind.Function ? 'function' : 'static',
												it.kind === SymbolKind.Function ? 'Func' : 'static', t.name),
											range: t.selectionRange, severity
										});
								}
							}
							dec[_low] = fn.local[_low] = it;
						} else if (it.kind === SymbolKind.Variable)
							((vr = it as Variable).def ? vars : unresolved_vars)[_low] ??= (vr.assigned ||= Boolean(vr.returns), it);
					}
					fn.children.unshift(...named_params ?? []);
					if ((fn.parent as FuncNode)?.assume === FuncScope.GLOBAL)
						fn.assume ??= FuncScope.GLOBAL;
					if (fn.assume === FuncScope.GLOBAL) {
						for (const [k, v] of Object.entries(vars = { ...unresolved_vars, ...vars })) {
							if (!(t = dec[k]))
								_this.declaration[k] ??= fn.global[k] = v, v.is_global = true;
							else if (t.kind === SymbolKind.Function && v.def)
								v.assigned !== 1 && _diags.push({ message: diagnostic.assignerr('Func', t.name), range: v.selectionRange, severity });
							else if (t.kind === SymbolKind.Variable && v.def && v.kind === t.kind)
								t.def = true, t.assigned ||= Boolean(v.returns);
						}
						unresolved_vars = {};
					} else {
						const assme_static = fn.assume === FuncScope.STATIC;
						const is_outer = fn.kind !== SymbolKind.Function || !fn.parent;
						for (const [k, v] of Object.entries(vars)) {
							delete unresolved_vars[k];
							if (!(t = dec[k])) {
								if (dec[k] = v, is_outer)
									fn.local[k] = v, v.static = assme_static;
								else if (assme_static)
									v.static = null;
							} else if (t.kind === SymbolKind.Function)
								v.assigned !== 1 && _diags.push({ message: diagnostic.assignerr('Func', t.name), range: v.selectionRange, severity });
							else if (t.kind === SymbolKind.Variable && v.def && v.kind === t.kind)
								t.def = true, t.assigned ||= Boolean(v.returns);
						}
					}
					vars = unresolved_vars, unresolved_vars = {};
					for (const k in vars)
						if (!dec[k]) (unresolved_vars[k] = vars[k]).def = false;
					fn.unresolved_vars = unresolved_vars;
					for (const k in vars = fn.local)
						vars[k].def = true;
					pars = Object.assign(fn.local, pars);
					if (has_this_param)
						delete pars.THIS, delete pars.SUPER, delete dec.THIS, delete dec.SUPER;
				}
			}

			function nexttoken() {
				if (next) return lk = tk, next = (tk = get_token_ignoreComment()).type !== 'TK_EOF';
				else return next = tk.type !== 'TK_EOF';
			}
		}

		function set_extends(tn: ClassNode, str: string) {
			tn.extends = (str = str.trim()).replace(/^(.+[\\/])?/, m => {
				if ((m = m.slice(0, -1))) {
					let u: URI;
					m = m.replace(/\\/g, '/').toLowerCase();
					if (!m.endsWith('.ahk'))
						m += '.d.ahk';
					if (m.startsWith('~/'))
						u = process.env.BROWSER ? URI.parse(rootdir + m.slice(1)) : URI.file(rootdir + m.slice(1));
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
				tn.extendsuri = ahkvars[(tn.extends = tn.extends.substring(1)).toUpperCase()]?.uri ?? ahkuris.ahk2;
		}

		function resolve_scriptdir(path: string) {
			return path.replace(/%(a_scriptdir|a_workingdir)%/i, () => (_this.need_scriptdir = true, _this.scriptdir))
				.replace(/%a_linefile%/i, _this.fsPath);
		}

		function add_include_dllload(text: string, tk?: Pick<Token, 'offset' | 'pos' | 'length' | 'content' | 'data'>, mode = 0, isdll = false) {
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
						_this.addDiagnostic(diagnostic.pathinvalid(), tk.offset, tk.length);
				} else if (!process.env.BROWSER) {
					if (isdll) {
						if (existsSync(m) && statSync(m).isDirectory())
							dlldir = m.endsWith('/') || m.endsWith('\\') ? m : m + '\\';
						else {
							if (!m.match(/\.\w+$/))
								m = m + '.dll';
							m = find_include_path(m, [], dlldir, true)?.path ?? m;
							if (m.includes(':'))
								_this.dllpaths.push(m.replace(/\\/g, '/'));
							else _this.dllpaths.push((dlldir && existsSync(dlldir + m) ? dlldir + m : m).replace(/\\/g, '/'));
						}
					} else {
						const islib = m.startsWith('<');
						if (tk) {
							if (m.startsWith('*')) {
								const rs = utils.get_RCDATA(tk.content.substring(1));
								if (rs)
									includetable[rs.uri] = rs.path, tk.data = [undefined, rs.uri];
								else
									_this.addDiagnostic(diagnostic.resourcenotfound(), tk.offset, tk.length, DiagnosticSeverity.Warning);
								return;
							} else if (!(m = find_include_path(m, _this.libdirs, includedir)) || !existsSync(m.path)) {
								if (!ignore)
									_this.addDiagnostic(m ? diagnostic.filenotexist(m.path) : diagnostic.pathinvalid(), tk.offset, tk.length);
							} else if (statSync(m.path).isDirectory())
								_this.includedir.set(tk.pos!.line, includedir = m.path);
							else
								includetable[m.uri] = m.path, tk.data = [m.path, m.uri];
							if (mode !== 0) _this.addDiagnostic(diagnostic.unsupportinclude(), tk.offset, tk.length, DiagnosticSeverity.Warning);
						} else if ((m = find_d_ahk(m)))
							includetable[m.uri] = m.path;
						_this.need_scriptdir ||= islib && (!m || m.path.toLowerCase().startsWith(_this.libdirs[0].toLowerCase()));
					}
				}
			} else if (text && tk)
				_this.addDiagnostic(diagnostic.pathinvalid(), tk.offset, tk.length);
		}

		function find_d_ahk(path: string) {
			if (path.startsWith('<'))
				path = path.replace(/(\.d)?>$/i, '.d>');
			else path = path.replace(/(\.d\.ahk)?$/i, '.d.ahk');
			const m = find_include_path(path,
				_this.libdirs, _this.scriptpath, true,
				{ ...a_vars, locale });
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
					sym.type_annotations = v.type_annotations ??= resolve_type_annotations(v.type_str);
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
									vr.type_annotations ??= resolve_type_annotations(tp);
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
									sym.type_annotations ??= resolve_type_annotations(tp);
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
								sym.type_annotations ??= resolve_type_annotations(tp);
						} else if (t === 'type') {
							(vars ??= {})[''] ??= {
								detail: line,
								type_annotations: resolve_type_annotations(tp)
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
								type_annotations: resolve_type_annotations(tp)
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
					obj.type_annotations ??= resolve_type_annotations(tp);
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

		function createToken(content: string, type: string, offset: number, length: number, topofline: number): Token {
			const c = input.charAt(offset - 1);
			const tk: Token = { content, type, offset, length, topofline, previous_token: lst, next_token_offset: -1, prefix_is_whitespace: whitespace.includes(c) ? c : undefined };
			_this.tokens[offset] = tk;
			lst.next_token_offset = offset;
			return tk;
		}

		function create_flags(flags_base: Flag | undefined, mode: string) {
			let indentation_level = 0, had_comment = 0, ternary_depth;
			let last_text = '', last_word = '', array_style, object_style;
			let in_expression = [MODE.ArrayLiteral, MODE.Expression, MODE.ObjectLiteral].includes(mode);
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
				array_style: array_style,
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
				object_style: object_style,
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
				if (preserve_statement_flags === null || !is_line_continue(ck.previous_token ?? EMPTY_TOKEN, EMPTY_TOKEN)) {
					// while (flags.mode === MODE.Statement && (flags.declaration_statement || !flags.if_block && !flags.loop_block && !flags.try_block))
					// 	restore_mode();
					while (flags.mode === MODE.Statement)
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
				flags.indentation_level = print_indentString(flags.indentation_level);
			} else if (output_space_before_token)
				line.text.push(' ');
			output_space_before_token = undefined;
			line.text.push(printable_token ?? token_text);

			function print_indentString(level: number) {
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

		function set_mode(mode: string): void {
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
			return flags.parent.mode === MODE.ObjectLiteral && flags.mode === MODE.Statement &&
				flags.last_text === ':' && !flags.ternary_depth;
		}

		function start_of_statement(): boolean {
			if ((last_type === 'TK_RESERVED' && ['try', 'else', 'finally'].includes(flags.last_text)) ||
				(last_type === 'TK_END_EXPR' && previous_flags.mode === MODE.Conditional) ||
				(last_type === 'TK_WORD' && flags.mode === MODE.BlockStatement && (
					(!input_wanted_newline && ck.previous_token?.callsite) ||
					!flags.in_case && !['TK_WORD', 'TK_RESERVED', 'TK_START_EXPR'].includes(token_type) && !['--', '++', '%'].includes(token_text)
				)) || (flags.declaration_statement && (!n_newlines || is_line_continue(ck.previous_token ?? EMPTY_TOKEN, ck))) ||
				(flags.mode === MODE.ObjectLiteral && flags.last_text === ':' && !flags.ternary_depth)) {

				set_mode(MODE.Statement);
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
			let local_pos = parser_pos, c = input.charAt(local_pos);
			while (c !== find_char && whitespace.includes(c) && ++local_pos < input_length)
				c = input.charAt(local_pos);
			return c === find_char ? local_pos : 0;
		}

		function get_token_ignoreComment(depth = 0): Token {
			let tk: Token;
			do { tk = get_next_token(depth); } while (tk.type.endsWith('COMMENT'));
			return tk;
		}

		function get_next_token(depth = 0): Token {
			let resulting_string: string, c: string, m: RegExpMatchArray | null;
			let bg = 0;
			const _ppos = parser_pos;
			n_newlines = 0;

			while (whitespace.includes(c = input.charAt(parser_pos++))) {
				if (c === '\n') {
					last_LF = parser_pos - 1;
					n_newlines += 1, begin_line = true;
				} else if (parser_pos >= input_length) {
					add_comment_foldingrange(), add_sharp_foldingrange();
					return _this.tokens[-1] ??= {
						content: '', type: 'TK_EOF', offset: input_length, length: 0,
						topofline: is_line_continue(lst, EMPTY_TOKEN) ? -1 : 1,
						next_token_offset: -1, previous_token: lst
					};
				}
			}

			let offset = parser_pos - 1, _tk = _this.tokens[offset];
			if (_tk && _tk.length) {
				let next = false;
				if ((begin_line = Boolean(_tk.topofline && _tk.type.endsWith('_BLOCK'))))
					last_LF = offset;
				parser_pos = _tk.skip_pos ?? offset + _tk.length;
				if ((lst = _tk, _tk.ignore)) {
					if (_tk.type === 'TK_START_EXPR') {
						continuation_sections_mode = true;
						next = !format_mode;
					} else if (_tk.type === 'TK_END_EXPR') {
						continuation_sections_mode = null;
						next = !format_mode;
					} else if (_tk.type.endsWith('COMMENT'))
						lst = _tk.previous_token ?? EMPTY_TOKEN;
				} else if (_tk.type.endsWith('COMMENT'))
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
				const line = input.substring(last_LF + 1, next_LF).trim().replace(/(^|[ \t]+);.*$/, '');
				if (line.includes('::') && (block_mode || !'"\''.includes(line[0]) ||
					!['TK_EQUALS', 'TK_COMMA', 'TK_START_EXPR'].includes(lst.type))) {
					if ((m = line.match(/^(:([^:]*):(`.|[^`])*?::)(.*)$/i))) {
						let execute: boolean;
						if ((execute = /x(?!0)/i.test(m[2])) || /^[ \t]*\{?$/.test(m[4]) || (execute = _this.hotstringExecuteAction && !/x0/i.test(m[2])))
							parser_pos += m[1].length - 1, lst = createToken(m[1], 'TK_HOT', offset, m[1].length, 1);
						else {
							last_LF = next_LF, parser_pos = offset + m[0].length;
							lst = createToken(m[1], 'TK_HOTLINE', offset, m[1].length, 1), offset += m[1].length;
							lst.skip_pos = parser_pos;
							lst.data = { content: input.substring(offset, parser_pos), offset, length: parser_pos - offset };
							_this.tokenranges.push({ start: offset, end: parser_pos, type: 3, previous: lst.offset });
						}
						lst.ignore = true, add_sharp_foldingrange();
						if (!m[3])
							_this.addDiagnostic(diagnostic.invalidhotdef(), lst.offset, lst.length);
						if (lst.type === 'TK_HOTLINE' || (!execute && !/^[ \t]*\{/.test(m[4]))) {
							if (depth > 5) {
								delete _this.tokens[lst.offset];
								return lst;
							}
							string_mode = execute = true;
							const _lst = lst;
							let tk = get_token_ignoreComment(depth + 1), t: number;
							while (tk.ignore && tk.type === 'TK_STRING') {
								if ((parser_pos = input.indexOf('\n', t = parser_pos)) < 0)
									parser_pos = input_length;
								if (t < parser_pos) {
									const s = input.substring(t, parser_pos).trimEnd();
									tk.content += s, tk.length += s.length;
								}
								_this.tokenranges.push({ start: tk.offset, end: tk.offset + tk.length, type: 3 });
								execute = false, tk = get_token_ignoreComment(depth + 1);
							}
							string_mode = false, lst = _lst;
							if (!execute && lst.type === 'TK_HOT') {
								lst.type = 'TK_HOTLINE', lst.skip_pos = parser_pos = offset + m[0].length;
								offset += m[1].length;
								lst.data = { content: input.substring(offset, parser_pos), offset, length: parser_pos - offset };
								_this.tokenranges.push({ start: offset, end: parser_pos, type: 3, previous: lst.offset });
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
								lst = createToken(m[1].replace(/[ \t]+/g, ' '), 'TK_HOTLINE', offset, m[1].length, 1);
								offset += lst.length + mm[1].length, lst.skip_pos = parser_pos;
								lst.data = { content: m[9].trim(), offset, length: parser_pos - offset, data: mm[2] };
								_this.tokenranges.push({ start: offset, end: parser_pos, type: 3, previous: lst.offset });
								return lst;
							}
						}
						parser_pos = input.indexOf('::', parser_pos) + 2;
						return lst = createToken(m[1].replace(/[ \t]+/g, ' '), 'TK_HOT', offset, m[1].length, 1);
					}
				}
				if (c !== '#') add_sharp_foldingrange();
			}

			if (isIdentifierChar(c.charCodeAt(0)) || c === '$' && allow_$) {
				while (parser_pos < input_length && isIdentifierChar(input.charCodeAt(parser_pos)))
					c += input.charAt(parser_pos), parser_pos += 1;

				// small and surprisingly unugly hack for 1E-10 representation
				if (input.charAt(offset - 1) !== '.') {
					if ((m = c.match(/^(\d+[Ee](\d+)?|(0[Xx][\da-fA-F]+)|(\d+))$/))) {
						if (m[2] || m[3]) {
							lst = createToken(c, 'TK_NUMBER', offset, c.length, bg);
							lst.data = !!m[2], lst.semantic = { type: SemanticTokenTypes.number };
							return lst;
						}
						if (m[4]) {
							let data;
							if (parser_pos < input_length && input.charAt(parser_pos) === '.') {
								let cc = '', t = '', p = parser_pos + 1;
								while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
									cc += input.charAt(p), p += 1;
								if (cc.match(/^\d*([Ee]\d+)?$/)) {
									c += '.' + cc, parser_pos = p;
									lst = createToken(c, 'TK_NUMBER', offset, c.length, bg);
									lst.data = true;
									return lst.semantic = { type: SemanticTokenTypes.number }, lst;
								} else if (cc.match(/^\d*[Ee]$/) && p < input_length && '-+'.includes(input.charAt(p))) {
									cc += input.charAt(p), p += 1;
									while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
										t += input.charAt(p), p += 1;
									if (t.match(/^\d+$/))
										c += '.' + cc + t, parser_pos = p;
								}
								data = true;
							}
							lst = createToken(c, 'TK_NUMBER', offset, c.length, bg), lst.data = data;
							return lst.semantic = { type: SemanticTokenTypes.number }, lst;
						} else if (parser_pos < input_length && '-+'.includes(input.charAt(parser_pos))) {
							const sign = input.charAt(parser_pos), p = parser_pos;
							let t: Token;
							parser_pos += 1, t = get_next_token(depth + 1);
							delete _this.tokens[t.offset];
							if (t.type === 'TK_NUMBER' && t.content.match(/^\d+$/)) {
								c += sign + t.content;
								lst = createToken(c, 'TK_NUMBER', offset, c.length, bg), lst.data = true;
								return lst.semantic = { type: SemanticTokenTypes.number }, lst;
							} else
								parser_pos = p;
						}
					}
					if (reserved_words.includes(resulting_string = c.toLowerCase())) {
						if (/^(and|or|not|in|is|contains)$/.test(resulting_string)) // hack for 'in' operator
							return lst = createToken(c, 'TK_OPERATOR', offset, c.length, bg);
						if (bg || resulting_string !== 'class')
							return lst = createToken(c, 'TK_RESERVED', offset, c.length, bg);
					}
				}
				return lst = createToken(c, 'TK_WORD', offset, c.length, bg);
			}

			if (c === '(' || c === '[') {
				if (c === '(') {
					if (bg && !continuation_sections_mode) {
						let i = parser_pos, b = i, t: string;
						while (i < input_length) {
							if ((t = input.charAt(i++)) === '\n') {
								if (string_mode) {
									// raw string
									// ::hotstring::string
									// (Join`s
									//   continuation
									//   string
									// )
									let next_LF = input.indexOf('\n', i), m: RegExpMatchArray | null = null;
									const o = last_LF + 1, data: number[] = [];
									while (next_LF > 0 && !(m = input.substring(i, next_LF).match(/^[ \t]*\)/)))
										data.push(next_LF - i), next_LF = input.indexOf('\n', i = next_LF + 1);
									if (next_LF < 0)
										data.push(input_length - i), m = input.substring(i, input_length).match(/^[ \t]*\)/);
									parser_pos = m ? i + m[0].length : input_length;
									data.push(parser_pos - i);
									resulting_string = input.substring(offset, parser_pos).trimEnd();
									lst = createToken(input.substring(o, offset) + resulting_string, 'TK_STRING', offset, resulting_string.length, 1);
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
									const top = !lst.type || (lst.type === 'TK_START_BLOCK' && lst.topofline > 0);
									lst = createToken(c, 'TK_START_EXPR', offset, 1, 1);
									lst.ignore = true, parser_pos = i - 1, continuation_sections_mode = true;
									while (' \t'.includes(input.charAt(++offset) || '\0')) continue;
									const content = input.substring(offset, parser_pos).trimEnd();
									lst.data = { content, offset, length: parser_pos - offset };
									lst.skip_pos = parser_pos;
									_this.tokenranges.push({ start: offset, end: parser_pos, type: 3, previous: lst.offset });
									const js = content.match(/(^|[ \t])join([^ \t]*)/i), ignoreComment = /(^|[ \t])[Cc]/.test(content);
									const _lst = lst, _mode = format_mode;
									let lk = lst, optionend = false, llf = parser_pos, sum = 0, tk: Token;
									let create_tokens: (n: number, LF: number) => typeof lk.previous_extra_tokens = () => undefined;
									if (js) {
										const s = js[2].replace(/`[srn]/g, '  ');
										const tl = new Lexer(TextDocument.create('', 'ahk2', -10, s));
										let suffix_is_whitespace = false
										tl.parseScript();
										delete tl.tokens[-1];
										const tks = Object.values(tl.tokens);
										offset += 4 + js[1].length + js.index!;
										if (tks.length) {
											suffix_is_whitespace = whitespace.includes(s.charAt(s.length - 1));
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
									if (continuation_sections_mode && tk.type !== 'TK_EOF') {
										if (ignoreComment && tk.topofline && tk.type.endsWith('COMMENT')) {
											sum = n_newlines - 2;
										} else {
											if (n_newlines > 1)
												tk.previous_extra_tokens = create_tokens(n_newlines - 1, llf);
											tk.topofline = top ? 1 : 0;
										}
										llf = last_LF, lk = tk, tk = get_next_token();
									}
									while (continuation_sections_mode && tk.type !== 'TK_EOF') {
										if (tk.topofline) {
											if (ignoreComment && tk.type.endsWith('COMMENT')) {
												sum += n_newlines - 1;
											} else {
												if ((sum += n_newlines))
													tk.previous_extra_tokens = create_tokens(sum, llf);
												tk.topofline = sum = 0;
												if (optionend && lk.content === '?')
													lk.ignore = true;
											}
											llf = last_LF;
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
									return lst = ((format_mode = _mode)) ? _lst : get_next_token();
								}
							} else if (t === ')' || t === '(') {
								if (i - b < 5 || input.substring(b, b + 4).toLowerCase() !== 'join')
									break;
							} else if (t === ' ' || t === '\t')
								b = i;
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
				const sep = c, o = offset, se = { type: SemanticTokenTypes.string };
				let nosep = false, _lst: Token | undefined, pt: Token | undefined;
				resulting_string = '';
				if (!/^[ \t\r\n+\-*/%:?~!&|^=<>[({,.]$/.test(c = input.charAt(offset - 1))) {
					let msg = diagnostic.missingspace(), eo = offset;
					if (sep === c) {
						if (c === "'" || !stop_parse(lst))
							msg = diagnostic.didyoumean(`\`${c}`), eo--;
						else msg = '', offset = lst.offset, lst = lst.previous_token!, _this.tokenranges.pop();
					}
					msg && _this.addDiagnostic(msg, eo, 1);
				}
				while ((c = input.charAt(parser_pos++))) {
					if (c === '`')
						parser_pos++;
					else if (c === sep) {
						resulting_string += input.substring(offset, parser_pos);
						lst = createToken(resulting_string, 'TK_STRING', offset, parser_pos - offset, bg);
						_this.tokenranges.push({ start: offset, end: parser_pos, type: 2 });
						if (nosep) lst.data = null, lst.semantic = se;
						if (_lst)
							lst = _lst, parser_pos = lst.offset + lst.length;
						if (isIdentifierChar(input.charCodeAt(parser_pos)))
							_this.addDiagnostic(diagnostic.missingspace(), parser_pos);
						return lst;
					} else if (continuation_sections_mode) {
						if (c === '\n') {
							const p = parser_pos - 1;
							while (' \t'.includes(c = input.charAt(parser_pos) || '\0'))
								parser_pos++;
							if (c === ')') {
								resulting_string = input.substring(offset, p).trimEnd();
								lst = createToken(resulting_string, 'TK_STRING', offset, resulting_string.length, bg = 0);
								_lst ??= lst, resulting_string = '';
								_this.tokenranges.push({ start: offset, end: offset + lst.length, type: 3 });
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
						resulting_string = (resulting_string + input.substring(offset, parser_pos - (c === ';' ? 2 : 1))).trimEnd();
						if (--parser_pos, resulting_string) {
							lst = createToken(resulting_string, 'TK_STRING', offset, resulting_string.trimStart().length, bg);
							_this.tokenranges.push({ start: offset, end: offset + lst.length, type: 3 });
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
					let tk = get_token_ignoreComment(depth + 1);
					stringend:
					while (tk.ignore && tk.type === 'TK_STRING') {
						const p = parser_pos, data = tk.data as number[];
						if (nosep)
							tk.semantic = se;
						while ((c = input.charAt(parser_pos++))) {
							if (c === '`')
								parser_pos++;
							else if (c === sep) {
								const s = input.substring(p, parser_pos);
								tk.content += s, tk.length += s.length, data[data.length - 1] += s.length;
								_this.tokenranges.push({ start: tk.offset, end: tk.offset + tk.length, type: 3 });
								if (isIdentifierChar(input.charCodeAt(parser_pos)))
									_this.addDiagnostic(diagnostic.missingspace(), parser_pos);
								break stringend;
							} else if (c === '\n' || c === ';' && ' \t'.includes(input.charAt(parser_pos - 2))) {
								const s = input.substring(p, parser_pos - (c === ';' ? 2 : 1)).trimEnd();
								if (s)
									tk.content += s, tk.length += s.length, data[data.length - 1] += s.length;
								_this.tokenranges.push({ start: tk.offset, end: tk.offset + tk.length, type: 3 });
								parser_pos--;
								break;
							}
						}
						if (!c) {
							const s = input.substring(p, --parser_pos);
							if (s)
								tk.content += s, tk.length += s.length;
							_this.tokenranges.push({ start: tk.offset, end: tk.offset + tk.length, type: 3 });
						}
						tk = get_token_ignoreComment(depth + 1);
					}
					if (!tk.ignore || tk.type !== 'TK_STRING')
						if ((pt = tk.previous_token))
							_this.addDiagnostic(diagnostic.unterminated(), pt.offset + pt.length, 1);
						else _this.addDiagnostic(diagnostic.missing(sep), o, 1);
					string_mode = false, lst = _lst as Token, parser_pos = lst.offset + lst.length;
					return lst;
				} else {
					_this.addDiagnostic(diagnostic.unterminated(), input_length, 1);
					resulting_string += input.substring(offset, input_length);
					lst = createToken(resulting_string, 'TK_STRING', offset, input_length - offset, bg);
					_this.tokenranges.push({ start: offset, end: input_length, type: 3 });
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
				} else if (nextc.match(/\d/) && ['TK_EQUALS', 'TK_OPERATOR', 'TK_COMMA', 'TK_START_EXPR'].includes(lst.type)) {
					let p = parser_pos + 1, t = '';
					while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
						nextc += input.charAt(p), p += 1;
					if (nextc.match(/^\d+([Ee]\d+)?$/)) {
						parser_pos = p, c += nextc;
						lst = createToken('0' + c, 'TK_NUMBER', offset, c.length, bg);
						lst.data = true;
						return lst.semantic = { type: SemanticTokenTypes.number }, lst;
					} else if (p < input_length && nextc.match(/^\d+[Ee]$/) && '-+'.includes(input.charAt(p))) {
						nextc += input.charAt(p), p += 1;
						while (p < input_length && isIdentifierChar(input.charCodeAt(p)))
							t += input.charAt(p), p += 1;
						if (t.match(/^\d+$/)) {
							parser_pos = p, c += nextc + t;
							lst = createToken('0' + c, 'TK_NUMBER', offset, c.length, bg);
							lst.data = true;
							return lst.semantic = { type: SemanticTokenTypes.number }, lst;
						}
					}
				}
				return lst = createToken(c, /[%([]|[^\x00-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7f]/.test(nextc) ?
					'TK_DOT' : 'TK_UNKNOWN', offset, 1, bg);
			}

			if (c === ';') {
				const comment_type = bg && '\n'.includes(input.charAt(last_LF)) ? 'TK_COMMENT' : (bg = 0, 'TK_INLINE_COMMENT');
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
										h && (t = lexers[ahkuris.winapi]) && Object.defineProperty(
											includetable, ahkuris.winapi, { value: t.fsPath, enumerable: false });
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
								SymbolKind.Module, rg = make_range(parser_pos + 1, next_LF - parser_pos - 1), rg));
							if (bg)
								continue;
						}
						if (bg) {
							if ((t = line.match(/^;\s*[@#](end)?region\b/i))) {
								ignore = true, create_fr = false, add_comment_foldingrange();
								if (!t[1]) {
									customblocks.region.push(parser_pos + 1);
									if ((line = line.substring(t[0].length).trim()))
										_this.children.push(DocumentSymbol.create(line, undefined, SymbolKind.Module,
											rg = make_range(parser_pos + 1, next_LF - parser_pos - 1), rg));
								} else if ((t = customblocks.region.pop()) !== undefined)
									_this.addFoldingRange(t, parser_pos + 1, 'region');
							} else if ((t = line.match(commentTagRegex))) {
								const g = t.groups;
								for (const tag in g)
									if (tag.startsWith('tag') && (t = g[tag]?.trim()))
										break;
								if (typeof t !== 'string')
									t = t[1]?.trim();
								if (t) {
									_this.children.push(DocumentSymbol.create(t, undefined, SymbolKind.Module,
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
				_this.tokenranges.push({ start: offset, end: parser_pos, type: 1 });
				const cmm: Token = _this.tokens[offset] = {
					type: comment_type, content: comment, offset, length: comment.length,
					next_token_offset: -1, topofline: bg, ignore, skip_pos: parser_pos, previous_token: lst
				};
				if (!bg) {
					if (!whitespace.includes(input.charAt(offset - 1)))
						_this.addDiagnostic(diagnostic.unexpected(cmm.content), offset, cmm.length);
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

			if (c === '/' && bg && input.charAt(parser_pos) === '*') {
				let LF = input.indexOf('\n', --parser_pos), ln = 0, e = '';
				while (!(m = input.substring(parser_pos, LF > 0 ? LF : input_length).match(/(^[ \t]*\*\/)|\*\/([ \t]*\r?)$/)) && LF > 0)
					last_LF = LF, LF = input.indexOf('\n', parser_pos = LF + 1), ln++;
				if (m?.[1])
					parser_pos = input.indexOf('*/', last_LF) + 2, begin_line = true, last_LF = parser_pos - 1;
				else parser_pos = (LF < 0 ? input_length : LF) - (m?.[2].length ?? (e = '*/', 0));
				_this.tokenranges.push({ start: offset, end: parser_pos, type: 1 });
				const cmm: Token = {
					type: 'TK_BLOCK_COMMENT', content: input.substring(offset, parser_pos) + e, offset, length: parser_pos - offset,
					next_token_offset: -1, previous_token: lst, topofline: bg, skip_pos: parser_pos
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

			if (punct.includes(c)) {
				if (allow_$ && '<>'.includes(c))
					return lst = createToken(c, c === '<' ? 'TK_START_EXPR' : 'TK_END_EXPR', offset, c.length, bg);
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
					const bak = parser_pos, tk = lst, t = get_token_ignoreComment(depth + 1);
					parser_pos = bak;
					if (')]},:??'.includes(t.content) || t.content === '.' && t.type !== 'TK_OPERATOR') {
						tk.ignore = true;
						if (t.content.startsWith('.') && ahk_version < alpha_3 - 1)
							_this.addDiagnostic(diagnostic.requireversion('2.1-alpha.2'), tk.offset, tk.length, DiagnosticSeverity.Warning);
					}
					return lst = tk;
				} else if (c === '??=' && ahk_version < alpha_3 - 1)
					_this.addDiagnostic(diagnostic.requireversion('2.1-alpha.2'), offset, c.length, DiagnosticSeverity.Warning);
				return lst = createToken(c, c.match(/([:.+\-*/|&^]|\/\/|>>|<<|\?\?)=/) ? 'TK_EQUALS' : 'TK_OPERATOR', offset, c.length, bg);
			}

			if (c === '#') {
				let sharp = '#';
				while (isIdentifierChar((c = input.charAt(parser_pos)).charCodeAt(0)))
					sharp += c, parser_pos++;
				sharp_offsets.push(offset);
				lst = createToken(sharp, 'TK_SHARP', offset, sharp.length, bg);
				token_text_low = sharp.toLowerCase();
				if (bg && whitespace.includes(c) && (token_text_low === '#hotif' || h && token_text_low === '#initexec'))
					return lst;
				last_LF = input.indexOf('\n', offset = parser_pos);
				parser_pos = last_LF < 0 ? input_length : last_LF;
				if (bg && whitespace.includes(c)) {
					if (c === ' ' || c === '\t') {
						while (' \t'.includes(input.charAt(offset) || '\0'))
							offset++;
						const content = input.substring(offset, parser_pos).trimEnd().replace(/(^|[ \t]+);.*$/, '');
						lst.data = { content, offset, length: content.length };
						parser_pos = offset + content.length;
						if (content) {
							lst.skip_pos = parser_pos;
							_this.tokenranges.push({ start: offset, end: offset + content.length, type: 3, previous: lst.offset });
						}
					}
				} else
					lst.type = 'TK_UNKNOWN', lst.content += input.substring(offset, parser_pos).trimEnd(), lst.length += parser_pos - offset;
				return lst;
			}

			return lst = createToken(c, 'TK_UNKNOWN', offset, c.length, bg);

			function add_sharp_foldingrange() {
				if (sharp_offsets.length > 1)
					_this.addFoldingRange(sharp_offsets[0], sharp_offsets.pop() as number, 'imports');
				sharp_offsets.length = 0;
			}
			function add_comment_foldingrange() {
				if (!last_comment_fr)
					return;
				if (last_comment_fr.endLine > last_comment_fr.startLine)
					_this.foldingranges.push(last_comment_fr);
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
			if (flags.mode === MODE.ObjectLiteral)
				return flags.object_style ?? opt.object_style;
			if (flags.mode === MODE.ArrayLiteral)
				return flags.array_style ?? opt.array_style;
		}

		function handle_start_expr(): void {
			if (start_of_statement())
				flags.last_word = '_';
			else if (need_newline() || (input_wanted_newline && !is_line_continue(ck.previous_token ?? EMPTY_TOKEN, ck)))
				print_newline(null);

			let next_mode = MODE.Expression;
			if (token_text !== '(') {
				if (ck.ignore) {	// only in the parameter list of *.d.ahk
					set_mode(next_mode);
					output_space_before_token = ck.previous_token?.content !== '(';
					print_token();
					flags.last_word = '';
					return;
				}
				if (ck.topofline < 1 && yields_an_operand(ck.previous_token ?? EMPTY_TOKEN)) {
					set_mode(next_mode);
					print_token();
					flags.last_word = '';
					flags.indentation_level = real_indentation_level() + 1;
					if (opt.space_in_paren) {
						output_space_before_token = true;
					}
					return;
				}
				if (!input_wanted_newline && ck.previous_token?.callsite || last_type === 'TK_RESERVED')
					output_space_before_token = true;

				next_mode = MODE.ArrayLiteral;
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

			if (!start_of_object_property()) {
				if (input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
				else if (last_type === 'TK_EQUALS' || last_type === 'TK_COMMA' || last_type === 'TK_OPERATOR')
					allow_wrap_or_preserved_newline();
			}

			set_mode(next_mode);
			flags.last_word = '';
			previous_flags.indentation_level = Math.min(
				previous_flags.indentation_level,
				flags.indentation_level = real_indentation_level())
			print_token();

			// (options\n...\n)
			if (ck.ignore) {
				const c = (ck.data as Token).content;
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
			while (flags.mode === MODE.Statement)
				restore_mode();

			const is_array = token_text === ']' && flags.mode === MODE.ArrayLiteral;
			restore_mode();
			if (is_array) {
				const style = flags.array_style ?? opt.array_style;
				if (style === OBJECT_STYLE.collapse || last_text === '[' || flags.indentation_level >= previous_flags.indentation_level)
					trim_newlines();
				else if (style !== 'none' || input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
			} else if ((last_type === 'TK_END_EXPR' || last_type === 'TK_END_BLOCK') && flags.indentation_level >= previous_flags.indentation_level)
				trim_newlines();
			else if (last_type !== 'TK_START_EXPR')
				allow_wrap_or_preserved_newline();

			output_space_before_token = Boolean(opt.space_in_paren && !(last_type === 'TK_START_EXPR' && !opt.space_in_empty_paren));
			print_token();
			continuation_sections_mode ??= false;
		}

		function handle_start_block() {
			if (ck.data) {
				set_mode(MODE.ObjectLiteral);
				flags.indentation_level = real_indentation_level();
				if (previous_flags.mode !== MODE.Conditional)
					previous_flags.indentation_level = flags.indentation_level;

				output_space_before_token ||= space_in_other && last_type !== 'TK_START_EXPR';
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
				else while (flags.mode === MODE.Statement)
					restore_mode();
				flags.declaration_statement = false;
				set_mode(MODE.BlockStatement);
				flags.in_expression = false;
				flags.indentation_level = level ??= flags.indentation_level;
				output_space_before_token ??= space_in_other;

				if (previous_flags.in_case_statement && last_type === 'TK_LABEL' && /^(default)?:$/.test(last_text))
					flags.case_body = null, print_newline(), flags.indentation_level--;
				else if (opt.brace_style === 'Allman' || input_wanted_newline && opt.preserve_newlines && opt.brace_style === 'Preserve')
					if (ck.in_expr === undefined || flags.mode === MODE.Expression)
						print_newline(true);

				const need_newline = !just_added_newline();
				print_token();
				previous_flags.indentation_level = Math.min(previous_flags.indentation_level, flags.indentation_level);
				if (!(opt.switch_case_alignment && flags.last_word === 'switch'))
					indent();
				if (need_newline || opt.brace_style !== 'Preserve')
					print_newline(true);
				else output_space_before_token = space_in_other;
			}
			flags.last_word = '';
		}

		function handle_end_block() {
			// statements must all be closed when their container closes
			while (flags.mode === MODE.Statement)
				restore_mode();

			const is_obj = flags.mode === MODE.ObjectLiteral, is_exp = is_obj || (ck.in_expr !== undefined);
			if (is_obj) {
				const style = flags.object_style ?? opt.object_style;
				if (style === OBJECT_STYLE.collapse || last_text === '{')
					trim_newlines();
				else if (style !== 'none' || input_wanted_newline && opt.preserve_newlines)
					print_newline(true);
				output_space_before_token = space_in_other && last_text !== '{';
			} else if (opt.brace_style !== 'Preserve' || input_wanted_newline)
				print_newline(true);

			restore_mode();
			print_token();
			if (!is_exp) {
				if (previous_flags.case_body === null)
					indent();
				if (opt.brace_style !== 'Preserve')
					print_newline(true);
				output_space_before_token = space_in_other;
			}
		}

		function handle_word() {
			let preserve_statement_flags = false;
			output_space_before_token ||= /^(TK_NUMBER|TK_WORD|TK_RESERVED|TK_STRING|TK_END_)/.test(last_type);

			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
				preserve_statement_flags = flags.declaration_statement;
				if (!input_wanted_newline && ['try', 'else', 'finally'].includes(flags.last_word) &&
					['if', 'while', 'loop', 'for', 'try', 'switch'].includes(token_text_low))
					deindent();
			}

			if (token_type === 'TK_RESERVED') {
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
							if (!preserve_statement_flags) {
								if (input_wanted_newline && flags.mode === MODE.Statement &&
									!flags.declaration_statement && !flags.in_expression)
									print_newline(false);
								else while (flags.mode === MODE.Statement && flags.declaration_statement)
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
						print_newline();
						print_token();
						flags.last_word = token_text_low;
						flags.start_line_index = output_lines.length;
						set_mode(MODE.Statement), is_conditional = true;
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
						if (
							flags.last_text !== '}' 
							|| opt.brace_style === 'Allman'
							|| opt.brace_style === 'One True Brace Variant'
							|| input_wanted_newline 
								&& opt.preserve_newlines 
								&& opt.brace_style !== 'Preserve'
						)
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
				if (input_wanted_newline && flags.mode === MODE.Statement && !flags.in_expression &&
					!is_line_continue(ck.previous_token ?? EMPTY_TOKEN, ck))
					print_newline(preserve_statement_flags);
				else if (input_wanted_newline && (opt.preserve_newlines || ck.symbol)) {
					if (ck.symbol || get_style() !== OBJECT_STYLE.collapse)
						print_newline(!ck.symbol);
				} else if (['TK_COMMA', 'TK_START_EXPR', 'TK_EQUALS', 'TK_OPERATOR'].includes(last_type))
					if (!start_of_object_property())
						allow_wrap_or_preserved_newline();
				if (!is_conditional && flags.mode === MODE.BlockStatement && ck.symbol?.children)
					set_mode(MODE.Statement), is_conditional = true;
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
						output_space_before_token = last_type !== 'TK_OPERATOR';
					else {
						const pk = ck.previous_token!;
						output_space_before_token = pk.op_type !== -1 && !pk.next_pair_pos && space_in_other;
					}
				}
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
				let p: number;
				print_newline(true);
				if (opt.ignore_comment && token_text.trimStart().startsWith('(') && (p = token_text.indexOf('\n')) > 0) {
					const t = token_text.slice(0, p).trimEnd().replace(/[ \t]+;.*$/, '');
					if (/(^[ \t]*\(|[ \t])c(om(ments?)?)?/i.test(t))
						token_text = `${t}\n${token_text.slice(p + 1).replace(/^[ \t]*;.*\r?\n/gm, '').replace(/[ \t]+;.*/gm, '')}`;
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
			if (flags.ternary_depth !== undefined) {
				for (let i = flags.ternary_indent!; i > 0; i--, deindent());
				flags.ternary_indent = 0;
				delete flags.ternary_depth;
			}
			if (flags.mode === MODE.BlockStatement || flags.declaration_statement)
				set_mode(MODE.Statement), indent();
			if (last_type === 'TK_WORD' && whitespace.includes(ck.prefix_is_whitespace || '\0') &&
				ck.previous_token?.callsite)
				input_wanted_newline && opt.preserve_newlines ? print_newline(true) : output_space_before_token = true;
			else {
				output_space_before_token = space_in_other && last_type === 'TK_COMMA' || last_text === 'for' && last_type === 'TK_RESERVED';
				if (flags.mode === MODE.Statement && flags.parent.mode === MODE.ObjectLiteral)
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
			let space_before = Boolean(space_in_other || token_text.match(/^\w/));
			let space_after = space_before;
			if (ck.previous_token?.callsite)
				output_space_before_token = true;
			if (start_of_statement()) {
				// The conditional starts the statement if appropriate.
				if (flags.declaration_statement && token_text_low.match(/^(\+\+|--|%|!|~|not)$/)) {
					output_space_before_token = true, flags.last_word = '_';
					print_token();
					if (token_text_low === 'not')
						output_space_before_token = true;
					return;
				}
			} else if (token_text === '=>') {
				// ^fn() => xx
				if (is_conditional && flags.mode === MODE.Statement && flags.parent.mode === MODE.BlockStatement)
					is_conditional = false;
				set_mode(MODE.Statement);
				indent(), flags.in_fat_arrow = true;
			} else if (token_text_low.match(/^(\+\+|--|%|!|~|not)$/) && need_newline()) {
				print_newline(), print_token();
				if (token_text_low === 'not')
					output_space_before_token = true;
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
				if (is_next_char('\n'))
					print_newline();
				else output_space_before_token = space_in_other;
				flags.in_case = false;
				flags.case_body = true;
				set_mode(MODE.Statement);
				flags.case_body = true;
				token_type = 'TK_LABEL';
				return;
			}

			if (input_wanted_newline && opt.preserve_newlines)
				print_newline(true);
			else if (last_type === 'TK_OPERATOR' && !last_text.match(/^(--|\+\+|%|!|~|not)$/))
				allow_wrap_or_preserved_newline();

			if (['--', '++', '!', '~'].includes(token_text) || ('-+'.includes(token_text) && (['TK_START_BLOCK', 'TK_START_EXPR', 'TK_EQUALS', 'TK_OPERATOR', 'TK_COMMA', 'TK_RESERVED'].includes(last_type) || ck.previous_token?.callsite))) {
				space_after = false;
				space_before = token_text === '!' && last_type === 'TK_WORD';

				if (!output_space_before_token && (token_text === '++' || token_text === '--') && ['TK_END_EXPR', 'TK_WORD'].includes(last_type))
					space_after = true;
			} else if (token_text === ':') {
				if (flags.ternary_depth)
					restore_mode(), flags.ternary_depth--;
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
					indent(), flags.ternary_indent = (flags.ternary_indent ?? 0) + 1;
					set_mode(MODE.Expression);
					flags.ternary_depth = flags.parent.ternary_depth;
				}
			} else if (token_text === '.')
				space_after = space_before = true;
			else if (token_text === '&') {
				if (last_type !== 'TK_WORD' && last_type !== 'TK_END_EXPR' || ck.previous_token?.callsite)
					space_after = false;
				if (last_type === 'TK_COMMA' || last_type === 'TK_START_EXPR')
					space_before = false;
			} else if (token_text === '*') {
				if (last_text === ',')
					space_after = false;
				else if (_this.tokens[ck.next_token_offset]?.type === 'TK_END_EXPR')
					space_before = space_after = false;
			}

			output_space_before_token ||= space_before;
			print_token();
			output_space_before_token = space_after;
		}

		function handle_block_comment() {
			// block comment starts with a new line
			if (flags.mode === MODE.Statement) {
				const nk = _this.tokens[ck.previous_token?.next_token_offset!];
				if (!nk || !flags.in_expression && !is_line_continue(nk.previous_token ?? EMPTY_TOKEN, nk))
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

		function handle_inline_comment() {
			applyFormatDirective(token_text, flags, opt);
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
			if (flags.mode === MODE.Statement) {
				const nk = _this.tokens[ck.previous_token?.next_token_offset!];
				if (!nk || !flags.in_expression && !is_line_continue(nk.previous_token ?? EMPTY_TOKEN, nk))
					print_newline();
				else if (flags.had_comment < 2)
					trim_newlines();
			}
			applyFormatDirective(token_text, flags, opt);
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
			token_type = 'TK_WORD';
			handle_word();
		}

		function handle_sharp() {
			print_newline();
			if (opt.symbol_with_same_case && token_type === 'TK_SHARP')
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
				print_token(token_type === 'TK_HOTLINE' ? t : ' ' + t);
			else if (token_type === 'TK_HOT')
				output_space_before_token = !!opt.space_after_double_colon;
			else output_space_before_token = space_in_other || token_type === 'TK_SHARP';
		}

		function handle_label() {
			print_newline(null);
			if (token_text_low === 'default:' && (flags.in_case_statement || (flags.mode === MODE.BlockStatement && flags.last_word === 'switch'))) {
				if (flags.case_body)
					deindent();
				else flags.case_body = true;
				print_token(), indent();
				flags.in_case = false;
				flags.in_case_statement = true;
				output_space_before_token = space_in_other;
				set_mode(MODE.Statement);
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
			return input_wanted_newline && (flags.parent.mode === MODE.BlockStatement &&
				['TK_END_EXPR', 'TK_START_BLOCK', 'TK_END_BLOCK', 'TK_WORD', 'TK_STRING'].includes(last_type) ||
				(last_type === 'TK_OPERATOR' && /^(\+\+|--|%)$/.test(last_text)) ||
				(last_type === 'TK_RESERVED' && /^(break|continue|goto|global|local|loop|return|static|throw)$/.test(last_text)));
		}
	}

	private clear() {
		this.texts = {}, this.declaration = {}, this.include = {}, this.tokens = {}, this.linepos = {};
		this.labels = {}, this.typedef = {}, this.object = { method: {}, property: {} };
		this.need_scriptdir = this.hotstringExecuteAction = this.isparsed = false;
		this.children.length = this.dllpaths.length = this.tokenranges.length = 0;
		this.diagnostics.length = this.foldingranges.length = 0;
		this.includedir.clear(), this.dlldir.clear();
		this.d_uri = '';
		delete this.maybev1;
		delete this.checkmember;
		delete this.symbolInformation;
	}

	get included() { return includedcache[this.uri] ?? {}; }
	get relevance() {
		const uri = this.uri, r = { ...includecache[uri] };
		for (const u in includedcache[uri])
			Object.assign(r, includecache[u]);
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
			return (node = from_d(this.d ? uri : this.d_uri)) && { node, uri, is_global: true };
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
				if ((node = get_class_base(node, this)))
					return { node, uri, scope, is_this: false };
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
		let kind: SymbolKind, symbol: AhkSymbol | undefined, token: Token | undefined, start: number, is_end_expr, text;
		const document = this.document, tokens = this.tokens, { line } = position;
		const linetext = document.getText(Range.create(line, 0, line + 1, 0)).trimEnd();
		let { character } = position;
		for (start = character; --start >= 0 && isIdentifierChar(linetext.charCodeAt(start)););
		if (!ignoreright)
			for (; isIdentifierChar(linetext.charCodeAt(character)); character++);
		const range = Range.create(line, start += (this.d && linetext[start] === '$' ? 0 : 1), line, character);
		const word = text = linetext.slice(start, character);
		const off = document.offsetAt(range.start);
		const pt = ((token = tokens[off])) ? token.previous_token : tokens[off - 1];
		if (pt?.content === '.' && !token?.prefix_is_whitespace && pt.type !== 'TK_OPERATOR' ||
			(is_end_expr = pt && yields_an_operand(pt) && token?.type === 'TK_START_EXPR' &&
				token.topofline < 1 && (token.content === '[' || token.prefix_is_whitespace === undefined))) {
			let tk = pt, lk = is_end_expr ? pt : pt.previous_token;
			const iscall = Boolean(token?.paraminfo) || linetext[character] === '(';
			while (lk) {
				switch (lk.type) {
					case 'TK_DOT': tk = lk, lk = lk.previous_token; break;
					case 'TK_END_EXPR':
						if (!(lk = tokens[lk.previous_pair_pos!]))
							break;
						if ((tk = lk, !lk.next_pair_pos || lk.topofline > 0))
							lk = undefined;
						else if (lk.prefix_is_whitespace === undefined || lk.content === '[' && !lk.previous_token?.callsite) {
							if ((lk = lk.previous_token)) {
								if (lk.type === 'TK_NUMBER' || lk.type === 'TK_STRING' || lk.content === '%' && (lk = EMPTY_TOKEN))
									tk = lk, lk = undefined;
								else if (!(lk.type === 'TK_WORD' || lk.type === 'TK_DOT' || lk.type.startsWith('TK_END_')))
									lk = undefined;
							}
						} else lk = undefined;
						break;
					case 'TK_END_BLOCK':
						if (lk.in_expr !== undefined) {
							tk = tokens[lk.in_expr], lk = undefined;
							break;
						}
						if ((tk = lk, !(lk = tokens[lk.previous_pair_pos!])))
							break;
					// fall through
					case 'TK_START_BLOCK':
						tk = lk.data ? lk : EMPTY_TOKEN, lk = undefined; break;
					case 'TK_NUMBER':
					case 'TK_STRING':
						tk = lk, lk = undefined; break;
					case 'TK_WORD':
						if ((tk = lk, lk = lk.previous_token)) {
							if (lk.type === 'TK_DOT')
								break;
							if (lk.type === 'TK_START_BLOCK') {
								lk = undefined;
								break;
							}
							if (tk.prefix_is_whitespace === undefined && lk.previous_pair_pos !== undefined && lk.content === '%')
								tk = EMPTY_TOKEN;
							lk = undefined;
						}
						break;
					case 'TK_OPERATOR':
						if (lk.ignore && lk.content === '?') {
							tk = lk, lk = lk.previous_token;
							break;
						}
					// fall through
					default: lk = undefined; break;
				}
			}
			if (/TK_WORD|TK_NUMBER|TK_STRING|TK_START_/.test(tk.type)) {
				token = tk;
				range.start = document.positionAt(tk.offset);
				range.end = document.positionAt(pt.offset + (is_end_expr ? 1 : 0));
			} else token = EMPTY_TOKEN, kind = SymbolKind.Null;
			text = '', kind ??= is_end_expr ? SymbolKind.Variable : iscall ? SymbolKind.Method : SymbolKind.Property;
		} else if (token) {
			if (token.type === 'TK_WORD') {
				const sk = token.semantic, sym = (symbol = token.symbol) ?? token.definition;
				let fc: FuncNode;
				if (sym) {
					kind = sym.kind, fc = sym as FuncNode;
					if (kind === SymbolKind.Class)
						text = fc.full;
					else if (kind === SymbolKind.Property || kind === SymbolKind.Method)
						text = fc.full.replace(/^\(([^ \t]+)\).*$/, (...m) => `${m[1]}${fc.static ? '.' : '#'}${fc.name}`);
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
				} else kind = SymbolKind.Variable;
			} else if (token.type === 'TK_LABEL')
				kind = SymbolKind.Field;
		} else if (pt?.content.startsWith('#'))
			token = pt, text = pt.content;
		else {
			token = this.find_token(range.start.character === linetext.length ? off - 1 : off);
			if (token.type === 'TK_STRING')
				text = token.content;
			else if (token.type.endsWith('COMMENT')) {
				let s = linetext.substring(0, character), m = s.match(
					/(@see|\{@link(code|plain)?|@param(\s+\{[^}]*\})?)\s+((\[[ \t]*)?[^ \t]+)$/);
				if (m) {
					if ((s = m[4], m[1].startsWith('@param'))) {
						s = s.replace(/^\[[ \t]*/, '');
						const sym = token.symbol as FuncNode;
						if (sym?.params)
							s = `${type_naming(sym)}~${s}`;
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
		return { text, word, range, kind, linetext, token, symbol };
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
		let workDir: string;
		if (!dir) {
			for (workDir of getCfg(CfgKey.WorkingDirectories))
				if (this.uri.startsWith(workDir)) {
					dir = restorePath(URI.parse(workDir).fsPath.replace(/[\\/]$/, ''));
					break;
				}
		}
		if (dir)
			this.scriptdir = dir;
		else if ((workDir = resolve()).toLowerCase() !== this.scriptpath.toLowerCase()
			&& workDir.toLowerCase() !== process.argv0.toLowerCase()
			&& this.scriptpath.toLowerCase().startsWith(workDir.toLowerCase())
			&& !/\\lib(\\.+)?$/i.test(this.scriptpath)) {
			if (existsSync(this.scriptpath + '\\Lib') && statSync(this.scriptpath + '\\Lib').isDirectory())
				this.scriptdir = this.scriptpath;
			else this.scriptdir = workDir;
		} else this.scriptdir = this.scriptpath.replace(/\\Lib(\\.+)?$/i, '');
		this.libdirs = [dir = this.scriptdir + '\\Lib\\'];
		dir = dir.toLowerCase();
		for (const t of libdirs)
			dir !== t.toLowerCase() && this.libdirs.push(t);
	}

	public getColors() {
		const t = this.tokenranges, document = this.document, text = document.getText(), colors: ColorInformation[] = [];
		for (const a of t) {
			if (a.type === 2) {
				let s = a.start, v = '';
				const e = a.end, m = colorregexp.exec(text.substring(s, e));
				if (!m || (!m[1] && e - s !== m[2].length + 2)) continue;
				const range = Range.create(document.positionAt(s += m.index + 1 + (m[1]?.length ?? 0)), document.positionAt(s + m[2].length));
				v = m[5] ? colortable[m[5].toLowerCase()] : m[3] === undefined ? m[2] : m[2].substring(2);
				const color = { red: 0, green: 0, blue: 0, alpha: 1 }, cls = ['red', 'green', 'blue'];
				if (m[4] !== undefined) cls.unshift('alpha');
				for (const i of cls) color[i as keyof typeof color] = (parseInt('0x' + v.substring(0, 2)) / 255), v = v.slice(2);
				colors.push({ range, color });
			}
		}
		return colors;
	}

	public addDiagnostic(message: string, offset: number, length?: number, severity: DiagnosticSeverity = DiagnosticSeverity.Error, arr?: Diagnostic[]) {
		const beg = this.document.positionAt(offset);
		let end = beg;
		if (length !== undefined) end = this.document.positionAt(offset + length);
		(arr || this.diagnostics).push({ range: Range.create(beg, end), message, severity });
	}

	private addFoldingRange(start: number, end: number, kind: string = 'block') {
		const l1 = this.document.positionAt(start).line, l2 = this.document.positionAt(end).line - (kind === 'block' ? 1 : 0);
		if (l1 < l2) this.foldingranges.push(FoldingRange.create(l1, l2, undefined, undefined, kind));
	}

	private addFoldingRangePos(start: Position, end: Position, kind: string = 'block') {
		const l1 = start.line, l2 = end.line - (kind === 'block' ? 1 : 0);
		if (l1 < l2) this.foldingranges.push(FoldingRange.create(l1, l2, undefined, undefined, kind));
	}

	private addSymbolFolding(symbol: AhkSymbol, first_brace: number) {
		const l1 = getCfg(CfgKey.SymbolFoldingFromOpenBrace) ? this.document.positionAt(first_brace).line : symbol.range.start.line;
		const l2 = symbol.range.end.line - 1;
		const ranges = this.foldingranges;
		if (l1 < l2) {
			if (ranges[ranges.length - 1]?.startLine === l1)
				ranges.pop();
			ranges.push(FoldingRange.create(l1, l2, undefined, undefined, 'block'));
		}
	}

	public update() {
		const uri = this.uri, initial = this.include;
		this.parseScript();
		this.foldingranges.reverse();
		if (libfuncs[uri]) {
			libfuncs[uri].length = 0;
			libfuncs[uri].push(...Object.values(this.declaration).filter(it => it.kind === SymbolKind.Class || it.kind === SymbolKind.Function));
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
			parse_include(this, this.scriptdir);
		if (change === 1) {
			const c = traverse_include(this);
			for (const u in this.included)
				Object.assign(includecache[u], c);
		} else update_include_cache();
		let main = this.scriptpath, max = Object.keys(includecache[uri]).length;
		for (const u in includedcache[uri]) {
			l = Object.keys(includecache[u]).length;
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
			if ((lex = lexers[u]).scriptdir.toLowerCase() === m)
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
		this.include = {}, this.last_diags = 0;
		connection?.sendDiagnostics({ uri: this.document.uri, diagnostics: [] });
	}

	public sendDiagnostics(update = false, all = false) {
		const last_diags = this.last_diags;
		if (last_diags !== this.diagnostics.length || update && last_diags) {
			connection?.sendDiagnostics({ uri: this.document.uri, diagnostics: this.diagnostics });
			this.last_diags = this.diagnostics.length;
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
		let it;
		for (const u in this.relevance)
			if ((it = lexers[u])?.actived && it.relevance[uri])
				return true;
		return false;
	}

	public close(force = false, other = true) {
		this.actived = false;
		if (!force && this.keepAlive())
			return;
		this.clearDiagnostics();
		const relevance = this.relevance;
		if (force || !this.workspaceFolder) {
			delete lexers[this.uri];
			delete includecache[this.uri];
			!this.actived && lexers[this.d_uri]?.close(false, false);
		}
		if (!other)
			return;
		let o = true;
		for (const u in relevance)
			o = false, lexers[u]?.close(false, false);
		if (o) {
			if (!lexers[this.uri])
				delete includedcache[this.uri];
		} else update_include_cache();
	}

	public findStrOrComment(offset: number): Token | undefined {
		const sc = this.tokenranges;
		let l = 0, r = sc.length - 1, i = 0, it;
		while (l <= r) {
			it = sc[i = (l + r) >> 1];
			if (offset < it.start)
				r = i - 1;
			else if (offset >= it.end)
				l = i + 1;
			else break;
		}
		if (l <= r && it)
			return (this.tokens[it.start] ?? ((it = this.tokens[it.previous!])?.data
				&& { ...it.data, previous_token: it, type: '' })) as Token;
	}
}

function create_prototype(name: string, kind = 0, extends_ = '') {
	return { name, full: name, kind, extends: extends_, range: ZERO_RANGE, selectionRange: ZERO_RANGE, uri: '' } as AhkSymbol;
}

function is_valid_hotkey(s: string) {
	const m = s.match(/^((([<>$~*!+#^]*?)(`?;|[\x21-\x3A\x3C-\x7E]|\w+|[^\x00-\x7f]))|~?(`?;|[\x21-\x3A\x3C-\x7E]|\w+|[^\x00-\x7f])[ \t]+&[ \t]+~?(`?;|[\x21-\x3A\x3C-\x7E]|\w+|[^\x00-\x7f]))([ \t]+up)?::$/i);
	if (!m)
		return false;
	for (let i = 4; i < 7; i++)
		if ((m[i] ?? '').length > 1 && !KEYS_RE.test(m[i]))
			return false;
	return true;
}

function find_include_path(path: string, libdirs: string[], workdir: string = '', check_exists = false, vars = a_vars) {
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

export function parse_include(lex: Lexer, dir: string, _set = new Set()) {
	const include = lex.include, l = dir.toLowerCase();
	_set.add(lex);
	for (const uri in include) {
		const path = include[uri];
		if (shouldExclude(path)) continue;
		let lex, t;
		if (!(lex = lexers[uri])) {
			if (!existsSync(path) || !(t = openFile(restorePath(path))))
				continue;
			(lexers[uri] = lex = new Lexer(t, dir)).parseScript();
		} else if (lex.scriptdir.toLowerCase() !== l)
			lex.initLibDirs(dir), lex.need_scriptdir && lex.parseScript();
		_set.has(lex) || parse_include(lex, dir, _set);
	}
}

export function get_class_base(node: AhkSymbol, lex?: Lexer) {
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
	cls = find_class(lex ?? lexers[ahkuris.ahk2], name, uri)!;
	return iscls ? cls : cls?.prototype;
}

export function get_class_member(lex: Lexer, node: AhkSymbol, name: string, ismethod: boolean, bases?: (ClassNode | null)[]): AhkSymbol | undefined {
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
			if (ismethod) {
				if (sym.kind === SymbolKind.Method)
					return sym.uri ??= cls.uri, sym;
				if ((t = sym).kind === SymbolKind.Class || (t = (sym as Property).call))
					return t.uri ??= cls.uri, t;
				prop ??= (sym.uri ??= cls.uri, sym);
			} else if (sym.kind === SymbolKind.Method)
				method ??= (sym.uri ??= cls.uri, sym);
			else if (sym.children)
				return sym.uri ??= cls.uri, sym;
			else prop ??= (sym.uri ??= cls.uri, sym);
		}

		if ((t = _bases[++i]) === null)
			break;
		if (!(cls = t ?? get_class_base(cls, lex))) {
			_bases.push(null);
			break;
		}
	}
	if ((prop ??= method))
		return prop;
}

export function get_class_members(lex: Lexer, node: AhkSymbol, bases?: ClassNode[]): Record<string, AhkSymbol> {
	let cls = node as ClassNode;
	const _bases = bases ?? [], properties = [];
	while (cls && !_bases.includes(cls))
		_bases.push(cls), properties.push(cls.property), cls = get_class_base(cls, lex) as ClassNode;
	if (!bases) for (let t; (cls = _bases.pop()!); t = cls.checkmember ??= t);
	return Object.assign({}, ...properties.reverse());
}

export function get_class_constructor(cls: ClassNode, lex?: Lexer) {
	const fn = get_class_member(lex ??= lexers[cls.uri!], cls, 'call', true) as FuncNode;
	if (fn?.full?.startsWith('(Object) static Call('))
		return get_class_member(lex, cls.prototype!, '__new', true) ?? fn;
	return fn;
}

function get_class_ownprop(lex: Lexer, cls: ClassNode, name: string) {
	const bases: ClassNode[] = [];
	let t;
	do {
		if ((t = cls.property?.[name]))
			return t.uri ??= cls.uri, t;
	} while ((cls = ((t = cls.extends?.toLowerCase()) && [t, `(${t}) prototype`].includes(cls.full.toLowerCase()) &&
		!bases.includes(cls) && bases.push(cls) ? get_class_base(cls, lex) as ClassNode : undefined)!));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function get_class_ownprops(doc: Lexer, node: AhkSymbol) {
	const cls = node as ClassNode;
	if (!cls.extends || cls.extends.toLowerCase() !== cls.full.toLowerCase())
		return cls.property ?? {};
	let ex = find_class(doc, cls.extends, cls.extendsuri);
	!cls.prototype && (ex = ex?.prototype);
	return { ...ex?.property, ...cls.property };
}

export function find_class(lex: Lexer, name: string, uri?: string) {
	const arr = name.toUpperCase().split('.');
	let n = arr.shift()!;
	let cls = (uri ? lexers[uri]?.declaration[n] : find_symbol(lex, n)?.node) as ClassNode;
	if (!cls?.property || cls.def === false)
		return;
	uri ??= cls.uri;
	for (n of arr)
		if (!(cls = get_class_ownprop(lex, cls, n) as ClassNode))
			return;
	return cls.uri ??= uri, cls;
}

function yields_an_operand(tk: Token): boolean {
	switch (tk.type) {
		case 'TK_DOT':
			return true;
		case 'TK_END_BLOCK':
			return Boolean(tk.data ?? tk.in_expr !== undefined);
		case 'TK_END_EXPR':
		case 'TK_NUMBER':
		case 'TK_STRING':
			return true;
		case 'TK_WORD':
			return !tk.paraminfo;
		case 'TK_OPERATOR':
			if (tk.op_type === 1)
				return true;
			switch (tk.content) {
				case '?': return Boolean(tk.ignore);
				case '%': return tk.previous_pair_pos !== undefined;
				case '++':
				case '--':	// postfix, true
					return !tk.topofline && yields_an_operand(tk.previous_token ?? EMPTY_TOKEN);
			}
		// fall through
		default: return false;
	}
}

export function decltype_expr(lex: Lexer, tk: Token, end_pos: number | Position, _this?: ClassNode): AhkSymbol[] {
	const stack: Token[] = [], op_stack: Token[] = [], tokens = lex.tokens;
	let operand = [0], pre = EMPTY_TOKEN, end: number, t, tt;
	if (typeof end_pos === 'object')
		end = lex.document.offsetAt(end_pos);
	else end = end_pos;
	loop:
	while (tk && tk.offset < end) {
		switch (tk.type) {
			case 'TK_STRING':
			case 'TK_NUMBER':
				if (check_concat())
					break loop;
				stack.push(tk), pre = tk;
				break;
			case 'TK_WORD':
				if (check_concat())
					break loop;
				stack.push(tk), pre = tk;
				if (tk.symbol) {
					tk = lex.find_token(lex.document.offsetAt(tk.symbol!.range.end), true);
					continue;
				} else if (tk.callsite) {
					if (tk.next_token_offset >= end || tk.next_token_offset === -1)
						break loop;
					stack.push(t = {
						content: '', type: 'TK_FUNC',
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
			case 'TK_DOT':
				if ((tk = tokens[tk.next_token_offset])?.type === 'TK_WORD') {
					t = tokens[tk.next_token_offset];
					if (t?.content === '[' && t.topofline < 1 || t?.content === '(' && !t.prefix_is_whitespace) {
						const call = { content: tk.content, type: 'TK_FUNC' } as Token;
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
						stack.push({ content: tk.content, type: 'TK_FUNC' } as Token);
				} else if (tk?.type === 'TK_START_EXPR') {
					if (tk.offset >= end)
						break loop;
					stack.push({
						content: '', type: 'TK_FUNC',
						data: tk.content === '(',
						paraminfo: tk.paraminfo
					} as Token);
					if (!(tk = tokens[tk.next_pair_pos!])) {
						stack.length = 0;
						break loop;
					}
				} else skip_operand();
				break;
			case 'TK_OPERATOR':
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
			case 'TK_EQUALS':
				if (op_push(tk))
					break loop;
				break;
			case 'TK_START_EXPR':
				if (!(tk = tokens[(t = tk).next_pair_pos!])) {
					stack.length = 0;
					break loop;
				}
				if (!t.symbol && (!t.prefix_is_whitespace || t.content === '[' && t.topofline < 1) &&
					(pre.op_type === 1 || ['TK_WORD', 'TK_NUMBER', 'TK_STRING', 'TK_END_EXPR'].includes(pre.type) ||
						pre.type === 'TK_END_BLOCK' && (tt = tokens[pre.previous_pair_pos!]) && (tt.data ?? tt.in_expr !== undefined))) {
					stack.push({
						content: '', type: 'TK_FUNC',
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
						tk = lex.find_token(lex.document.offsetAt(t.symbol!.range.end), true);
						continue;
					}
				}
				pre = tk;
				break;
			case 'TK_START_BLOCK':
				if (!(tk = tokens[(t = tk).next_pair_pos!])) {
					stack.length = 0;
					break loop;
				}
				stack.push(t);
				break;
			case 'TK_COMMENT':
			case 'TK_INLINE_COMMENT':
			case 'TK_BLOCK_COMMENT':
				break;
			case 'TK_COMMA':
				stack.length = op_stack.length = 0;
				pre = EMPTY_TOKEN, operand = [0];
				break;
			case 'TK_END_BLOCK':
			case 'TK_END_EXPR':
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
				let prop = tk.symbol;
				const cls = prop.parent as ClassNode;
				if ((prop = cls?.property?.[prop.name.toUpperCase()]))
					syms = decltype_returns(prop, lexers[cls.uri!] ?? lex, cls);
				else syms = [];
			} else syms = [tk.symbol], tk.symbol.uri ??= lex.uri;
		} else switch (tk.type) {
			case 'TK_FUNC': {
				const call = !!tk.data, name = tk.content.toLowerCase() || (call ? 'call' : '__item');
				syms = decltype_invoke(lex, syms, name, call, tk.paraminfo, that);
				break;
			}
			case 'TK_WORD': {
				const pos = lex.document.positionAt(tk.offset);
				const r = find_symbol(lex, tk.content, SymbolKind.Variable, pos);
				if (!r) break;
				syms = new Set;
				const node = r.node;
				if (node.kind === SymbolKind.Variable) {
					for (const n of decltype_var(node, lex, pos, r.scope, _this))
						syms.add(n);
				} else if (syms.add(node), r.is_this !== undefined) {
					that = _this ?? node as ClassNode;
					continue;
				}
				break;
			}
			case 'TK_NUMBER':
				if (/^[-+]?(\d+$|0[xX])/.test(tk.content))
					syms = [INTEGER];
				else if (/^[-+]?\d+[.eE]/.test(tk.content))
					syms = [FLOAT];
				else syms = [NUMBER];
				break;
			case 'TK_STRING': syms = [STRING]; break;
			case 'TK_START_BLOCK':
				if (!(t = tk.data as ClassNode)) break;
				syms = [t], t.uri ??= lex.uri;
				if ((tt = !t.extends && t.property?.BASE)) {
					const tps = decltype_returns(tt, lex, _this);
					if (tps.length < 2)
						t.base = tps[0];
					else {
						syms = [];
						for (const base of tps)
							syms.push({ ...t, base } as ClassNode);
					}
				}
				break;
			case 'TK_START_EXPR': {
				const b = (t = tk.paraminfo?.comma)?.length ? t.at(-1)! : tk.next_token_offset;
				syms = decltype_expr(lex, tokens[b], tk.next_pair_pos! - 1, _this);
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
		let l = operand.pop(), ret = { content: '', type: 'TK_NUMBER' } as Token;
		const rv = stack.splice(l ?? 0);
		if (l === undefined || !rv.length) {
			stack.length = 0;
			return true;
		}
		switch (op.op_type ?? (op.type === 'TK_EQUALS' && 0)) {
			case -1:
				if (op.content === '&' && rv.length === 1 && (rv[0].type === 'TK_WORD' && rv[0].offset))
					ret = { symbol: VARREF } as Token;
			// fall through
			case 1:
				break;
			case 0: {
				const lv = stack.splice((l = operand.pop()) ?? 0);
				let s;
				if (l === undefined || !lv.length) {
					stack.length = 0;
					return true;
				}
				if (op.content.startsWith('.'))
					ret.type = 'TK_STRING';
				else if (op.content === ':=') {
					operand.push(stack.length), stack.push(...rv);
					return;
				} else if (['&&', 'and'].includes(s = op.content.toLowerCase())) {
					operand.push(stack.length);
					stack.push(ret), stack.push({ type: 'TK_OPERATOR', content: '||', op_type: 0 } as Token);
					stack.push(...rv);
					return;
				} else if (['||', 'or', '??', '??=', ':'].includes(s)) {
					operand.push(stack.length);
					stack.push(...lv), stack.push({ type: 'TK_OPERATOR', content: '||', op_type: 0 } as Token);
					stack.push(...rv);
					return;
				}
				break;
			}
			default: stack.length = 0; return true;
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
		if (yields_an_operand(pre))
			return op_push(pre = { content: '.', type: 'TK_OPERATOR', op_type: 0 } as Token);
	}
	function skip_operand() {
		let lk = tk;
		stack.splice(operand[operand.length - 1]);
		stack.push({ symbol: ANY } as Token);
		do {
			while (tk) {
				if (tk.type === 'TK_WORD') {
					lk = tk, tk = tokens[tk.next_token_offset];
					if (!tk || tk.content !== '%' || tk.prefix_is_whitespace)
						break;
				} else if (tk.content === '%' && tk.previous_pair_pos === undefined) {
					lk = tokens[tk.next_pair_pos!], tk = tokens[lk?.next_token_offset];
					if (!tk || tk.type !== 'TK_WORD' || tk.prefix_is_whitespace)
						break;
				} else break;
			}
			if (tk && (tk.content === '[' || tk.content === '(' && !tk.prefix_is_whitespace)) {
				lk = tk, tk = tokens[tk.next_pair_pos!];
				if (!tk) break;
				lk = tk, tk = tokens[tk.next_token_offset];
			}
		} while (tk?.type === 'TK_DOT' && tk.offset < end);
		pre = tk = lk;
	}
	function precedence(tk: Token, in_stack = true) {
		if (tk.type === 'TK_OPERATOR') {
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
		if (tk.type === 'TK_DOT')
			return 86;
		if (tk.type === 'TK_EQUALS')
			return in_stack ? 7 : 99;
		if (tk.type === 'TK_COMMA')
			return 6;
		return 0;
	}
}

export function decltype_invoke(lex: Lexer, syms: Set<AhkSymbol> | AhkSymbol[], name: string, call: boolean, paraminfo?: ParamInfo, _this?: ClassNode) {
	const tps = new Set<AhkSymbol>;
	let that = _this;
	for (let n of syms) {
		const cls = n as ClassNode;
		that = _this ?? cls;
		switch (n.kind) {
			case 0 as SymbolKind: return [ANY];
			case SymbolKind.Class:
				if (call && name === 'call') {
					if (!(n = get_class_member(lex, cls, name, call)!))
						if (invoke_meta_func(cls))
							break;
						else continue;
					const full = (n as Variable).full ?? '';
					if (full.startsWith('(ComObject)')) {
						const tks = lex.tokens, s = [];
						let tk = tks[tks[paraminfo?.offset!]?.next_token_offset];
						if (tk?.type === 'TK_STRING') {
							s.push(tk.content);
							if ((tk = tks[tk.next_token_offset])?.content === ',') {
								tk = tks[tk.next_token_offset];
								if (tk?.type === 'TK_STRING')
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
				if (call && name === 'call')
					break;
			// fall through
			default:
				if (!(n = get_class_member(lex, cls, name, call)!))
					if ((n = invoke_meta_func(cls)!))
						break;
					else continue;
				if (n.kind !== SymbolKind.Property) {
					if ((n as FuncNode).alias) {
						// if (paraminfo) continue;
						const tt = decltype_returns(n, lexers[n.uri!] ?? lex, that);
						for (const t of call ? decltype_invoke(lex, tt, 'call', true) : tt)
							tps.add(t);
						continue;
					} else if (call) break;
					if (!paraminfo)
						tps.add(n);
					else for (const t of decltype_invoke(lex, [n], '__item', false, paraminfo, that))
						tps.add(t);
					continue;
				} else if ((n as FuncNode).alias) {
					const tt = decltype_invoke(lex, decltype_returns(n, lexers[n.uri!] ?? lex, that), 'call', true);
					for (const t of call ? decltype_invoke(lex, tt, 'call', true) : tt)
						tps.add(t);
					continue;
				} else if (call || paraminfo && !(n as Property).get?.params.length) {
					for (const t of decltype_invoke(lex, decltype_returns(n, lexers[n.uri!] ?? lex, that),
						call ? 'call' : '__item', call, paraminfo))
						tps.add(t);
					continue;
				}
				break;
		}
		for (const t of decltype_returns(n, lexers[n.uri!] ?? lex, that))
			tps.add(t);
	}
	return tps;
	function invoke_meta_func(_this: ClassNode) {
		const n = get_class_member(lex, _this, call ? '__call' : '__get', call);
		if (!n) return;
		if (n.kind === SymbolKind.Method && !(n as FuncNode).alias)
			return n;
		const syms = n.kind === SymbolKind.Class ? [n] : !n.children ?
			decltype_returns(n, lexers[n.uri!] ?? lex, that) : undefined;
		if (!syms?.length)
			return;
		for (const t of decltype_invoke(lex, syms, 'call', true, paraminfo))
			tps.add(t);
	}
}

function decltype_byref(sym: Variable, lex: Lexer, types: AhkSymbol[], _this?: ClassNode) {
	const res = get_callinfo(lex, sym.selectionRange.start);
	if (!res || res.index < 0)
		return [];
	const { pos, index, kind } = res;
	const context = lex.getContext(pos);
	const tps = decltype_expr(lex, context.token, context.range.end, _this);
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
					types.push(...decltype_type_annotations((t as ClassNode).generic_types?.[0] ?? [], lex,
						_this, get_declare_class(lex, _this)?.type_params));
				}
				break;
			}
			case SymbolKind.Class: {
				let n = get_class_member(lex, it, prop, iscall);
				const cls = it as ClassNode;
				if (!n)
					break;
				if (iscall) {
					if (n.kind === SymbolKind.Class)
						n = get_class_constructor(n as ClassNode);
					else if ((n as FuncNode).full?.startsWith('(Object) static Call('))
						n = get_class_member(lex, cls.prototype!, '__new', true) ?? n;
					else if (n.kind === SymbolKind.Property || (n as FuncNode).alias) {
						let tps: AhkSymbol[] | Set<AhkSymbol> = decltype_returns(n, lexers[n.uri!] ?? lex, cls);
						if (n.kind === SymbolKind.Property && (n as FuncNode).alias)
							tps = decltype_invoke(lex, tps, 'call', true);
						tps.forEach(it => resolve(it, 'call', types, -1));
						return;
					}
					if (n?.kind === SymbolKind.Method)
						resolve(n, 'call', types, -1);
					return;
				} else if (n.kind === SymbolKind.Class)
					n = get_class_member(lex, n, '__item', false);
				else if (n.kind !== SymbolKind.Property)
					return;
				else if (!(n as FuncNode).params) {
					for (let t of decltype_returns(n, lexers[n.uri!] ?? lex, cls))
						(t = get_class_member(lex, t, '__item', false)!) &&
							resolve(t, '', types);
					return;
				}
				n && resolve(n, '', types);
			}
		}
		return;
	}
}

function get_declare_class(lex: Lexer, cls?: ClassNode): ClassNode | undefined {
	if (!cls || cls.children)
		return cls;
	const t = find_symbol(lex, cls.full.replace(/<.+/, ''))?.node as ClassNode;
	if (t?.prototype)
		return t;
}

function decltype_var(sym: Variable, lex: Lexer, pos: Position, scope?: AhkSymbol, _this?: ClassNode): AhkSymbol[] {
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
		ts = decltype_returns(sym, lex, _this);
		t && (sym.returns = t);
		if (sym.is_param && sym.pass_by_ref) {
			const tt = new Set<AhkSymbol>;
			for (const t of ts) {
				if (t === VARREF)
					return [ANY];
				if (t.data === VARREF)
					resolve_cached_types((t as ClassNode).generic_types?.[1] ?? [ANY], tt, lex, _this);
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
				if (it.pass_by_ref || it.returns && (it.for_index === undefined || var_in_for_block(it, t ??= lex.document.offsetAt(pos))))
					sym = it;
			} else return [it];
		}
	if (sym.for_index !== undefined) {
		if (sym === _def && !var_in_for_block(sym, t ??= lex.document.offsetAt(pos)))
			return [];
		const tps = decltype_returns(sym, lex, _this);
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
					if (invoke_enum && (t = get_class_member(lex, it, '__enum', true, bases))) {
						if (t.kind !== SymbolKind.Method)
							break;
						for (const tp of decltype_returns(t, lexers[t.uri!] ?? lex, it as ClassNode))
							resolve(tp, false);
						break;
					} else if ((t = get_class_member(lex, it, 'call', true, bases))?.kind === SymbolKind.Method)
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
						ts!.push(...decltype_type_annotations((t as ClassNode).generic_types?.[0] ?? [], lex,
							cls, get_declare_class(lex, cls)?.type_params));
					}
					break;
				}
			}
		}
	}
	if (sym.pass_by_ref && !sym.is_param)
		return decltype_byref(sym, lex, ts, _this);
	ts.push(...decltype_returns(sym, lex, _this));
	ts = [...new Set(ts)];
	return ts.includes(ANY) ? [ANY] : ts;
}

function var_in_for_block(it: Variable, offset: number) {
	const range = it.data as number[];
	return range[0] <= offset && offset < range[1];
}

function decltype_type_annotations(annotations: (string | AhkSymbol)[], lex: Lexer, _this?: ClassNode, type_params?: Record<string, AhkSymbol>) {
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
	resolve_cached_types([...types], tps, lex, _this, type_params);
	return [...tps];
}

function resolve_cached_types(tps: (string | AhkSymbol)[], resolved_types: Set<AhkSymbol>, lex: Lexer,
	_this?: ClassNode, type_params?: Record<string, AhkSymbol>) {
	let re: RegExp, i = -1, is_this, is_typeof, t, param, update;
	for (let tp of tps) {
		if (i++, typeof tp === 'string') {
			(is_typeof = tp.startsWith('typeof ')) && (tp = tp.substring(7));
			if ((param = type_params?.[tp.toUpperCase()]))
				resolve_cached_types(_this!.generic_types?.[param.data as number] ?? (param.type_annotations || []),
					resolved_types, lex, _this, type_params);
			else if ((t = (is_this = tp === 'this') && _this || find_symbol(lex, tp)?.node as ClassNode))
				if (t.kind === SymbolKind.TypeParameter)
					update = true, tps[i] = '', tps.push(...decltype_type_annotations(t.type_annotations || [], lex));
				else if (t.kind !== SymbolKind.Variable)
					resolved_types.add(t = !is_typeof && t.prototype || t), !is_this && (tps[i] = t);
		} else if (tp.kind === SymbolKind.TypeParameter)
			update = true, tps[i] = '', tps.push(...decltype_type_annotations(tp.type_annotations || [], lex));
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
				`<${generic_types.map(t => join_types(t)).join(', ')}>`)
		} as ClassNode;
	}
}

export function decltype_returns(sym: AhkSymbol, lex: Lexer, _this?: ClassNode): AhkSymbol[] {
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
			resolve_cached_types(ct = sym.cached_types!, types = new Set, lex, _this, _this && (sym.parent as ClassNode)?.type_params);
			if (!has_obj)
				return [...types];
	}

	let tps: AhkSymbol[];
	if (sym.returns) {
		sym.cached_types = [ANY], tps = [];
		for (let i = 0, r = sym.returns, l = r.length; i < l; i += 2)
			tps.push(...decltype_expr(lex, lex.find_token(r[i], true), r[i + 1], _this));
		if (types) {
			for (const n of new Set(tps as ClassNode[]))
				if (n.property && !n.name && !types.has(n))
					types.add(n), ct!.push(n);
			tps = [...types], sym.cached_types = ct;
		} else types = new Set(tps), sym.cached_types = tps = [...types];
	} else tps = types ? [...types] : [];
	return tps;
}

function type_naming(sym: AhkSymbol) {
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
						names.splice(-1, 1, type_naming(s));
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
				s += ` => ${generate_type_annotation(sym) || 'void'}`;
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

export function generate_type_annotation(sym: AhkSymbol, lex?: Lexer, _this?: ClassNode) {
	return join_types((sym.type_annotations || decltype_returns(sym, lexers[sym.uri!] ?? lex, _this)));
}

export function join_types(tps?: Array<string | AhkSymbol> | false) {
	if (!tps) return '';
	let ts = [...new Set(tps.map(s => typeof s === 'string' ? s : type_naming(s)))];
	const t = ts.pop();
	if (!t) return '';
	(ts = ts.map(s => s.includes('=>') && !'"\''.includes(s[0]) ? `(${s})` : s)).push(t);
	return ts.join(' | ');
}

function resolve_type_annotations(annotation?: string) {
	if (annotation) {
		const lex = new Lexer(TextDocument.create('', 'ahk2', 0, `$:${annotation}`), undefined, -1);
		lex.parseScript();
		return lex.declaration.$?.type_annotations ?? false;
	}
	return false;
}

const MaybeLocalKind: SymbolKind[] = [SymbolKind.Variable, SymbolKind.Function, SymbolKind.Field];
export function find_symbol(lex: Lexer, fullname: string, kind?: SymbolKind, pos?: Position) {
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
				if (!(node = get_class_ownprop(lex, node as ClassNode, name)))
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
		if ((t = ahkvars[name]))
			return t;
		for (const uri of [ahkuris.ahk2_h, ahkuris.ahk2])
			if ((t = lexers[uri]?.typedef[name]))
				return t.uri ??= uri, t;
		if (notdef && !l)
			if ((t = lexers[uri = ahkuris.winapi]?.declaration[name]))
				return t.uri ??= uri, t;
	}
	function find_include_symbol(list: Record<string, string>, name: string) {
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

export function find_symbols(lex: Lexer, context: Context) {
	const { text, word, range, kind } = context;
	let t;
	if (text)
		return (t = find_symbol(lex, text, kind, range.end)) && [t];
	const syms = [], ismethod = kind === SymbolKind.Method;
	const tps = decltype_expr(lex, context.token, range.end);
	if (!word && tps.length) {
		for (const node of tps)
			syms.push({ node, uri: node.uri! });
		return syms;
	}
	for (const tp of tps)
		if ((t = get_class_member(lex, tp, word, ismethod)))
			syms.push({ node: t, uri: t.uri!, parent: tp });
	if (syms.length)
		return syms;
}

export function get_callinfo(doc: Lexer, position: Position, pi?: ParamInfo) {
	let pos: Position, index: number, kind: SymbolKind, pt: Token | undefined;
	const tokens = doc.tokens, offset = doc.document.offsetAt(position);
	function get(pi: ParamInfo) {
		const tk = tokens[pi.offset];
		pos = doc.document.positionAt(pi.offset);
		if (tk.type === 'TK_WORD') {
			if (pt && position.line > doc.document.positionAt(pt.offset + pt.length).line && !is_line_continue(pt, EMPTY_TOKEN))
				return;
			index = offset > pi.offset + tk.content.length ? 0 : -1;
		} else {
			if (tk.previous_token?.symbol)
				return;
			if ((index = 0, tk.content === '[')) {
				if (tk.topofline === 1 || !yields_an_operand(tk.previous_token!))
					return;
				kind = SymbolKind.Property;
			} else if (tk.prefix_is_whitespace || !yields_an_operand(tk.previous_token!))
				return;
		}
		if (index !== -1)
			for (const c of pi.comma)
				if (offset > c) ++index; else break;
		kind ??= pi.method ? SymbolKind.Method : SymbolKind.Function;
		return { name: pi.name ?? '', pos, index, kind };
	}
	if (pi)
		return get(pi);
	let tk: Token | undefined = doc.find_token(offset), nk = pt = tk.previous_token;
	if (offset <= tk.offset && !(tk = nk))
		return;
	if (tk.callsite && offset > tk.offset + tk.length && position.line <= tk.callsite.range.end.line)
		return get(tk.paraminfo!);
	if (tk.topofline > 0)
		return;
	while (tk.topofline <= 0) {
		switch (tk.type) {
			case 'TK_END_BLOCK':
				tk = tokens[tk.previous_pair_pos!];
				break;
			case 'TK_END_EXPR':
				tk = tokens[(nk = tk).previous_pair_pos!];
				tk = tk?.previous_token;
				break;
			case 'TK_START_EXPR':
			case 'TK_COMMA':
				if ((nk = tk, tk.paraminfo))
					return get(tk.paraminfo);
				break;
			case 'TK_OPERATOR':
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

let includecache: Record<string, Record<string, string>> = {};
let includedcache: Record<string, Record<string, string>> = {};
export function update_include_cache() {
	includecache = {}, includedcache = {};
	for (const lex of Object.values(lexers))
		traverse_include(lex);
}
export function traverse_include(lex: Lexer, included?: Record<string, string>) {
	const { uri, include } = lex;
	let hascache = true;
	let cache = includecache[uri] ??= (hascache = false, { [uri]: lex.fsPath });
	included = ((included ??= includedcache[uri])) ? { ...included } : {};
	if (!lex.is_virtual)
		included[uri] = lex.fsPath;
	for (const u in include) {
		Object.assign(includedcache[u] ??= {}, included);
		if (!(lex = lexers[u]))
			continue;
		if (!cache[u]) {
			if (hascache && included[u])
				continue;
			const c = traverse_include(lex, included);
			if (c[uri]) {
				cache = includecache[uri] = Object.assign(c, cache);
			} else Object.assign(cache, c);
		} else if (!included[u])
			traverse_include(lex, included);
	}
	return cache;
}

export function get_detail(sym: AhkSymbol, lex: Lexer, remove_re?: RegExp): string | MarkupContent {
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
			const n = find_symbol(lex, name, name.includes('.') ?
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

export function make_same_name_error(a: AhkSymbol, b: AhkSymbol): string {
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

export function check_same_name_error(decs: Record<string, AhkSymbol>, arr: AhkSymbol[], diags: Diagnostic[]) {
	let _low = '', v1: Variable, v2: Variable;
	const severity = DiagnosticSeverity.Error;
	for (const it of arr) {
		if (!it.name || !it.selectionRange.end.character)
			continue;
		switch ((v1 = it as Variable).kind) {
			case SymbolKind.Variable:
				v1.assigned ||= Boolean(v1.returns);
			// fall through
			case SymbolKind.Class:
			case SymbolKind.Function:
				if (!(v2 = decs[_low = it.name.toUpperCase()])) {
					decs[_low] = it;
				} else if (v2.is_global) {
					if (v1.kind === SymbolKind.Variable) {
						if (v1.def && v2.kind !== SymbolKind.Variable) {
							if (v1.assigned !== 1)
								it.has_warned ??= diags.push({ message: diagnostic.assignerr(v2.kind === SymbolKind.Function ? 'Func' : 'Class', it.name), range: it.selectionRange, severity });
							continue;
						}
					} else if (v2.kind === SymbolKind.Function) {
						it.has_warned ??= diags.push({ message: make_same_name_error(v2, it), range: it.selectionRange, severity });
						continue;
					} else if (v2.def && v2.assigned !== 1)
						v2.has_warned ??= diags.push({ message: diagnostic.assignerr(it.kind === SymbolKind.Function ? 'Func' : 'Class', it.name), range: v2.selectionRange, severity });
					decs[_low] = it;
				} else if (v1.kind === SymbolKind.Variable) {
					if (v2.kind === SymbolKind.Variable) {
						if (v1.def && !v2.def)
							decs[_low] = it;
						else v2.assigned ||= v1.assigned;
					} else if (v1.def) {
						delete v1.def;
						if (v1.assigned !== 1)
							it.has_warned ??= diags.push({ message: make_same_name_error(v2, it), range: it.selectionRange, severity });
					}
				} else {
					if (v2.kind === SymbolKind.Variable) {
						if (v2.def) {
							delete v2.def;
							if (v2.assigned !== 1)
								v2.has_warned ??= diags.push({ message: make_same_name_error(it, v2), range: v2.selectionRange, severity });
						}
						decs[_low] = it;
					} else if (v2.def !== false)
						it.has_warned ??= diags.push({ message: make_same_name_error(v2, it), range: it.selectionRange, severity });
					else if (v1.def !== false)
						decs[_low] = it;
				}
				break;
		}
	}
}

export function is_line_continue(lk: Token, tk: Token, parent?: AhkSymbol): boolean {
	switch (lk.type) {
		case '':
		case 'TK_COMMA':
		case 'TK_EQUALS':
		case 'TK_START_EXPR':
			return true;
		case 'TK_OPERATOR':
			if (lk.ignore)
				return false;
			if (!/^(%|\+\+|--)$/.test(lk.content))
				return true;
		// fall through
		default:
			switch (tk.type) {
				case 'TK_DOT':
				case 'TK_COMMA':
				case 'TK_EQUALS':
					return true;
				case 'TK_OPERATOR':
					return !/^(!|~|not|%|\+\+|--)$/i.test(tk.content) && (!(parent as FuncNode)?.ranges || !allIdentifierChar.test(tk.content));
				// case 'TK_END_BLOCK':
				// case 'TK_END_EXPR':
				// 	return false;
				case 'TK_STRING':
					if (tk.ignore)
						return true;
				// fall through
				default:
					return false;
			}
	}
}

/**
 * Tries to update the commentTagRegex to the provided value.
 * If a new regex cannot be made from the provied value, throws an error.
 */
export function updateCommentTagRegex(newCommentTagRegex: string): RegExp {
	const oldCommentTagRegex = commentTagRegex;
	try {
		if (newCommentTagRegex) {
			commentTagRegex = new RegExp(newCommentTagRegex, 'i');
		}
	} catch (e) {
		commentTagRegex = oldCommentTagRegex;
		throw e;
	}
	return commentTagRegex;
}

/**
 * Updates the provided options in-place (not pure).
 * Convert the provided format config from user settings to in-memory interface.
 */
export function fixupFormatConfig(options: { braceStyle?: string | undefined }) {
	switch (options.braceStyle) {
		case 'Allman':
		case '0': options.braceStyle = 'Allman'; break;
		case 'One True Brace':
		case '1': options.braceStyle = 'One True Brace'; break;
		case 'One True Brace Variant':
		case '-1': options.braceStyle = 'One True Brace Variant'; break;
		default: options.braceStyle = 'Preserve'; break;
	}
	return options;
}

/**
 * Parse a directive of the form `; @format key1: value1, key2: value2, ...`
 * Returns an object with the key-value pairs.
 * Whitespace-insensitive.
 * Does not validate that keys are valid FormatOptions keys.
 */
export function parseFormatDirective(directive: string): Record<string, string> {
	// Run regex against the directive to confirm it matches
	const m = directive.match(/^;\s*@format\b/i);
	if (!m) return {};
	
	// Get all the key-value pairs of the directive
	const record = Object.fromEntries(directive.substring(m[0].length).split(',').map(s => {
		const p = s.indexOf(':');
		return [s.substring(0, p).trim(), s.substring(p + 1).trim()];
	}));

	return record;
}

/**
 * Handle format directives. Format directives dictate options for every line below them.
 * Example: `;@format array_style: expand, object_style: expand`
 * See `client/src/test/formatting/array_object_style.ahk` for an in-code example.
 */
export function applyFormatDirective(directive: string, flags: Partial<Flag>, opt: Partial<InternalFormatOptions>) {
	const parsedDirective = parseFormatDirective(directive);
	for (const k of ['array_style', 'object_style'] as const) {
		if (k in parsedDirective) {
				flags[k] = parsedDirective[k] as BlockStyle;
				delete parsedDirective[k];
		}
	}
	Object.assign(opt, parsedDirective);
}