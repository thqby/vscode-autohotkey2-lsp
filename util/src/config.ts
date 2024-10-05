//* Utility functions to access the config variable from either client or server
export enum CfgKey {	
	ActionWhenV1Detected = 'ActionWhenV1IsDetected',
	CallWithoutParentheses = 'Warn.CallWithoutParentheses',
	ClassNonDynamicMemberCheck = 'Diagnostics.ClassNonDynamicMemberCheck',
	Commands = 'commands',
	CommentTagRegex = 'CommentTags',
	CompleteFunctionCalls = 'CompleteFunctionParens',
	CompletionCommitCharacters = 'CompletionCommitCharacters',
	Exclude = 'Files.Exclude',
	ExtensionUri = 'extensionUri',
	Formatter = 'FormatOptions',
	InterpreterPath = 'InterpreterPath',
	LibrarySuggestions = 'AutoLibInclude',
	LocalSameAsGlobal = 'Warn.LocalSameAsGlobal',
	Locale = 'locale',
	MaxScanDepth = 'Files.ScanMaxDepth',
	ParamsCheck = 'Diagnostics.ParamsCheck',
	SymbolFoldingFromOpenBrace = 'SymbolFoldingFromOpenBrace',
	Syntaxes = 'Syntaxes',
	VarUnset = 'Warn.varUnset',
	WorkingDirectories = 'WorkingDirs',
}

export type ActionType = 'Continue' | 'Warn' | 'SkipLine' | 'SwitchToV1' | 'Stop';

export enum LibIncludeType {
	'Disabled',
	'Local',
	'User and Standard',
	'All'
}

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

/** Matches the contributed extension configuration in package.json */
export interface AHKLSConfig {
	locale?: string
	commands?: string[]
	extensionUri?: string
	ActionWhenV1IsDetected: ActionType
	AutoLibInclude: LibIncludeType
	CommentTags?: string
	CompleteFunctionParens: boolean
	CompletionCommitCharacters?: {
		Class: string
		Function: string
	}
	Diagnostics: {
		ClassNonDynamicMemberCheck: boolean
		ParamsCheck: boolean
	}
	Files: {
		Exclude: string[]
		MaxDepth: number
	}
	FormatOptions: FormatOptions
	InterpreterPath: string
	GlobalStorage?: string
	Syntaxes?: string
	SymbolFoldingFromOpenBrace: boolean
	Warn: {
		VarUnset: boolean
		LocalSameAsGlobal: boolean
		CallWithoutParentheses: boolean | /* Parentheses */ 1
	}
	WorkingDirs: string[]
}

/**
 * The global object shared across the server.
 * The client fetches the config from VS Code directly.
 * Updated when the user changes their settings.
 */
export const ahklsConfig: AHKLSConfig = {
	ActionWhenV1IsDetected: 'Warn',
	AutoLibInclude: 0,
	CommentTags: '^;;\\s*(.*)',
	CompleteFunctionParens: false,
	CompletionCommitCharacters: {
		Class: '.(',
		Function: '('
	},
	Diagnostics: {
		ClassNonDynamicMemberCheck: true,
		ParamsCheck: true
	},
	Files: {
		Exclude: [],
		MaxDepth: 2
	},
	FormatOptions: {},
	InterpreterPath: 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe',
	SymbolFoldingFromOpenBrace: false,
	Warn: {
		VarUnset: true,
		LocalSameAsGlobal: false,
		CallWithoutParentheses: false
	},
	WorkingDirs: []
};

/** The start of each config value in package.json */
export const configPrefix = 'AutoHotkey2';


/** Gets a single config value from the given config */
export const getCfg = <T = string>(key: CfgKey, config: AHKLSConfig = ahklsConfig): T => {
	const keyPath = key.split('.');
	// ConfigKey values are guaranteed to work ;)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let value: any = config;
	for (const k of keyPath) {
		value = value[k];
	}
	return value;
};

export const setCfg = (key: CfgKey, value: unknown, config: AHKLSConfig = ahklsConfig): void => {
	const keyPath = key.split('.');
	// ConfigKey values are guaranteed to work ;)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let obj: any = config;
	for (const k of keyPath.slice(0, -1)) {
		obj = obj[k];
	}
	obj[keyPath[keyPath.length - 1]] = value;
};
