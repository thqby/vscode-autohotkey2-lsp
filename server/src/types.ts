import { DocumentSymbol, Position, Range } from 'vscode-languageserver-types';
import { SymbolKind } from './lsp-enums';

export enum AccessModifier { public, protected, private, all }

export type ActionType = 'Continue' | 'Warn' | 'SkipLine' | 'SwitchToV1' | 'Stop';

export interface AhkSymbol extends DocumentSymbol {
	access?: AccessModifier
	is_builtin?: boolean
	cached_types?: Array<string | AhkSymbol>
	children?: AhkSymbol[]
	data?: unknown
	decl?: boolean
	def?: boolean
	exported?: boolean
	full?: string
	has_warned?: boolean | number
	markdown_detail?: string
	ignore?: boolean
	overwrite?: number
	parent?: AhkSymbol
	returns?: number[] | null
	return_void?: boolean
	since?: string
	static?: boolean | null
	type_annotations?: Array<string | AhkSymbol> | false
	uri?: string
}

export enum BlockType { Script, Func, Class, Method, Mask = Method, Body, Pair = 8 }

export interface CallSite extends AhkSymbol {
	checked?: boolean
	offset?: number
	paraminfo?: ParamInfo
	outer?: AhkSymbol
}

export interface ClassNode extends AhkSymbol {
	base?: AhkSymbol
	full: string
	extends: string
	extendsuri?: string
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

export interface Context {
	usage?: USAGE
	kind: SymbolKind
	linetext: string
	range: Range
	symbol?: AhkSymbol
	text: string
	token: Token
	word: string
}

export interface ContinueSectionOption {
	comments?: boolean
	indent: string
	new_indent?: string
	ltrim?: boolean
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

export interface FormatOptions {
	align_continuation_section_with_ltrim0_to_left?: boolean
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

export interface FormatFlags {
	array_style?: number,
	case_body: boolean | null,
	catch_block: boolean,
	declaration_statement: boolean,
	disable_linewrap?: boolean,
	disable_start?: [number, number],
	else_block: boolean,
	finally_block: boolean,
	had_comment: number,
	hotif_block?: boolean,
	if_block: boolean,
	in_case_statement: boolean,
	in_case: boolean,
	in_conditional?: boolean,
	in_expression: boolean,
	in_fat_arrow?: boolean,
	indentation_level: number,
	indent_after?: boolean,
	last_text: string,
	last_word: string,
	loop_block: number,
	mode: Mode,
	object_style?: number,
	parent: FormatFlags,
	start_line_index: number,
	ternary_depth?: number,
	try_block: boolean
};

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
	labels?: Record<string, AhkSymbol[]>
	declaration: Record<string, AhkSymbol>
	overloads?: string | FuncNode[]
	overload_params?: Record<string, Variable>
	has_this_param?: boolean
	unresolved_vars?: Record<string, Variable>
	ranges?: [number, number][]	// class's __init
	in_expr?: boolean
}

export enum FuncScope { DEFAULT, STATIC, GLOBAL }

export interface Import {
	imp: Array<{ from: string, tk: Token, wildcard: boolean, var: Variable[] }>
	mod?: Record<string, Module | false>
	alias?: Record<string, AhkSymbol>
}

export interface JsDoc {
	detail: string
	tags?: Partial<AhkSymbol>
	vars?: Record<string, {
		detail: string,
		type_annotations?: (string | AhkSymbol)[] | false,
		type_str?: string
	}>
}

export type Maybe<T> = T | undefined;

export enum Mode { BlockStatement, Statement, ObjectLiteral, ArrayLiteral, Conditional, Expression }

export interface Module extends AhkSymbol {
	children: AhkSymbol[]
	declaration: Record<string, AhkSymbol>
	duplicate?: boolean
	export?: Record<string, AhkSymbol>
	flat?: boolean
	import?: Import
	include: Record<string, string>
	labels?: Record<string, AhkSymbol[]>
	modules?: Module[]
	property: Record<string, Variable>
	ranges?: [number, number][]
}

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
	is_call?: boolean
}

export interface ParamList extends Array<Variable> {
	format?: (params: Variable[]) => void
	hasref?: boolean
	offset?: number[]
	full?: string
	variadic?: boolean
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
	resolved?: boolean
}

export enum SemanticTokenModifiers {
	static = 1,		// true
	readonly = 2,
	definition = 4,
	defaultLibrary = 8,
	deprecated = 16,
}

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

export interface Token<T = unknown> {
	// if expression
	//   |statement
	body_start?: number
	callsite?: CallSite
	content: string
	data?: T
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
	op_type?: null | -1 | 0 | 1
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
	unexpected_lf?: boolean
}

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

export enum USAGE { Read, Write }

export interface Variable extends AhkSymbol {
	alias?: string
	alias_to?: AhkSymbol | null
	arr?: boolean | 2			// *, *,  ...
	assigned?: boolean | 1		// 1, ??=
	defaultVal?: string | false | null
	for_index?: number			// for v1, ... in
	from?: string
	full?: string
	index?: number
	is_global?: boolean
	is_param?: boolean
	range_offset?: [number, number]
	pass_by_ref?: boolean
	typed?: boolean | 1			// typed properties
}
