// Same as ahk2/client/src/config.ts
// todo dedupe config.ts

/** Defined in package.json */
export type ActionType =
	| 'Continue'
	| 'Warn'
	| 'SkipLine'
	| 'SwitchToV1'
	| 'Stop';

/** Defined in package.json */
export enum ObjectOrArrayStyle {
	Collapse = 'collapse',
	Expand = 'expand',
	None = 'none',
}

/** Defined in package.json */
export enum BraceStyle {
	OneTrueBrace = 'One True Brace',
	Allman = 'Allman',
	OneTrueBraceVariant = 'One True Brace Variant',
}

export interface FormatterConfig {
	// AHK++ values
	arrayStyle: ObjectOrArrayStyle;
	braceStyle: BraceStyle;
	breakChainedMethods: boolean;
	ignoreComment: boolean;
	indentString: string;
	indentBetweenHotIfDirectives: boolean;
	keywordStartWithUppercase: boolean;
	maxPreserveNewlines: number;
	objectStyle: ObjectOrArrayStyle;
	preserveNewlines: boolean;
	spaceBeforeConditional: boolean;
	spaceAfterDoubleColon: boolean;
	spaceInEmptyParen: boolean;
	spaceInOther: boolean;
	spaceInParen: boolean;
	switchCaseAlignment: boolean;
	symbolWithSameCase: boolean;
	whitespaceBeforeInlineComment: string;
	wrapLineLength: number;

	// thqby values
	array_style?: 'collapse' | 'expand' | 'none';
	brace_style?: 'One True Brace' | 'Allman' | 'One True Brace Variant';
	break_chained_methods?: boolean;
	ignore_comment?: boolean;
	indent_string?: string;
	indent_between_hot_if_directives?: boolean;
	keyword_start_with_uppercase?: boolean;
	max_preserve_newlines?: number;
	object_style?: 'collapse' | 'expand' | 'none';
	preserve_newlines?: boolean;
	space_before_conditional?: boolean;
	space_after_double_colon?: boolean;
	space_in_empty_paren?: boolean;
	space_in_other?: boolean;
	space_in_paren?: boolean;
	switch_case_alignment?: boolean;
	symbol_with_same_case?: boolean;
	whitespace_before_inline_comment?: string;
	wrap_line_length?: number;
}

/** Defined in package.json */
export enum LibrarySuggestions {
	Off = 'Off',
	Local = 'Local',
	UserAndStandard = 'User and Standard',
	All = 'All',
}

/** Defined in package.json */
export enum CallWithoutParentheses {
	Off = 'Off',
	Parentheses = 'Parentheses',
	On = 'On',
}

export enum CfgKey {
	//* ahkpp values
	// ActionWhenV1Detected = 'v2.general.actionWhenV1Detected',
	// CallWithoutParentheses = 'v2.warn.callWithoutParentheses',
	// ClassNonDynamicMemberCheck = 'v2.diagnostics.classNonDynamicMemberCheck',
	// CommentTagRegex = 'v2.general.commentTagRegex',
	// CompleteFunctionCalls = 'v2.general.completeFunctionCalls',
	// CompletionCommitCharacters = 'v2.completionCommitCharacters',
	// Exclude = 'v2.exclude',
	// Formatter = 'v2.formatter',
	// InterpreterPath = 'v2.file.interpreterPath',
	// LibrarySuggestions = 'v2.general.librarySuggestions',
	// LocalSameAsGlobal = 'v2.warn.localSameAsGlobal',
	// MaxScanDepth = 'v2.file.maxScanDepth',
	// ParamsCheck = 'v2.diagnostics.paramsCheck',
	// SymbolFoldingFromOpenBrace = 'v2.general.symbolFoldingFromOpenBrace',
	// Syntaxes = 'v2.general.syntaxes',
	// VarUnset = 'v2.warn.varUnset',
	// WorkingDirectories = 'v2.workingDirectories',
	
	//* thqby values
	ActionWhenV1Detected = 'ActionWhenV1IsDetected',
	CallWithoutParentheses = 'Warn.CallWithoutParentheses',
	ClassNonDynamicMemberCheck = 'Diagnostics.ClassNonDynamicMemberCheck',
	CommentTagRegex = 'CommentTags',
	CompleteFunctionCalls = 'CompleteFunctionParens',
	CompletionCommitCharacters = 'CompletionCommitCharacters',
	Exclude = 'Files.Exclude',
	Formatter = 'FormatOptions',
	InterpreterPath = 'InterpreterPath',
	LibrarySuggestions = 'AutoLibInclude',
	LocalSameAsGlobal = 'Warn.LocalSameAsGlobal',
	MaxScanDepth = 'Files.ScanMaxDepth',
	ParamsCheck = 'Diagnostics.ParamsCheck',
	SymbolFoldingFromOpenBrace = 'SymbolFoldingFromOpenBrace',
	Syntaxes = 'Syntaxes',
	VarUnset = 'Warn.varUnset',
	WorkingDirectories = 'WorkingDirs',
}

export interface CompletionCommitCharacters {
	Class: string;
	Function: string;
}

/** Defined in package.json */
export interface AhkppConfig {
	v2: {
		general: {
			actionWhenV1Detected: ActionType;
			/** The regex denoting a custom symbol. Defaults to `;;` */
			commentTagRegex?: string;
			/** Automatically insert parentheses on function call */
			completeFunctionCalls: boolean;
			/** Suggest library functions */
			librarySuggestions: LibrarySuggestions;
			symbolFoldingFromOpenBrace: boolean;
			syntaxes: string;
		};
		completionCommitCharacters: CompletionCommitCharacters;
		diagnostics: {
			classNonDynamicMemberCheck: boolean;
			paramsCheck: boolean;
		};
		/** Glob pattern of files to ignore */
		exclude: string[];
		file: {
			/** Path to the AHK v2 intepreter */
			interpreterPath: string;
			/** Depth of folders to scan for IntelliSense */
			maxScanDepth: number;
		};
		/** Config of the v2 formatter */
		formatter: FormatterConfig;
		warn: {
			/** Ref to a potentially-unset variable */
			varUnset: boolean;
			/** Undeclared local has same name as global */
			localSameAsGlobal: boolean;
			/** Function call without parentheses */
			callWithoutParentheses: CallWithoutParentheses;
		};
		/** Directories containing AHK files that can be #included */
		workingDirectories: string[];
	};
	locale?: string;
	commands?: string[];
	extensionUri?: string;
	GlobalStorage?: string;
}

/**
 * Returns a formatter config built from the given config and defaults.
 * Defaults defined in package.json
 */
export const newFormatterConfig = (
	config: Partial<FormatterConfig> = {},
): FormatterConfig => ({
	arrayStyle: ObjectOrArrayStyle.None,
	braceStyle: BraceStyle.OneTrueBrace,
	breakChainedMethods: false,
	ignoreComment: false,
	indentString: '    ',
	indentBetweenHotIfDirectives: false,
	keywordStartWithUppercase: false,
	maxPreserveNewlines: 2,
	objectStyle: ObjectOrArrayStyle.None,
	preserveNewlines: true,
	spaceBeforeConditional: true,
	spaceAfterDoubleColon: true,
	spaceInEmptyParen: false,
	spaceInOther: true,
	spaceInParen: false,
	switchCaseAlignment: false,
	symbolWithSameCase: false,
	whitespaceBeforeInlineComment: '',
	wrapLineLength: 120,
	...config,
});

/** Defaults according to package.json */
export const newAhkppConfig = (
	config: Partial<AhkppConfig> = {},
): AhkppConfig => ({
	v2: {
		general: {
			actionWhenV1Detected: 'SwitchToV1',
			commentTagRegex: '^;;\\s*(.*)',
			completeFunctionCalls: false,
			librarySuggestions: LibrarySuggestions.Off,
			symbolFoldingFromOpenBrace: false,
			syntaxes: '',
		},
		completionCommitCharacters: {
			Class: '.(',
			Function: '(',
		},
		diagnostics: {
			classNonDynamicMemberCheck: true,
			paramsCheck: true,
		},
		exclude: [],
		file: {
			interpreterPath:
				'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe',
			maxScanDepth: 2,
		},
		formatter: newFormatterConfig(),
		warn: {
			varUnset: true,
			localSameAsGlobal: false,
			callWithoutParentheses: CallWithoutParentheses.Off,
		},
		workingDirectories: [],
	},
	...config,
});

/** Gets a single config value from the given config */
export const getCfg = <T>(config: AhkppConfig, key: CfgKey): T => {
	const keyPath = key.split('.');
	// ConfigKey values are guaranteed to work ;)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let value: any = config;
	for (const k of keyPath) {
		value = value[k];
	}
	return value;
};
