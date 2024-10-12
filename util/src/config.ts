//* Utility functions to access the config variable from either client or server
export enum CfgKey {
	ActionWhenV1Detected = 'ActionWhenV1IsDetected',
	ArrayStyle = 'FormatOptions.array_style',
	BraceStyle = 'FormatOptions.brace_style',
	BreakChainedMethods = 'FormatOptions.break_chained_methods',
	CallWithoutParentheses = 'Warn.CallWithoutParentheses',
	ClassNonDynamicMemberCheck = 'Diagnostics.ClassNonDynamicMemberCheck',
	Commands = 'commands',
	CommentTagRegex = 'CommentTags',
	CompleteFunctionCalls = 'CompleteFunctionParens',
	CompletionCommitCharacters = 'CompletionCommitCharacters',
	DebugConfiguration = 'DebugConfiguration',
	Exclude = 'Files.Exclude',
	ExtensionUri = 'extensionUri',
	Formatter = 'FormatOptions',
	IgnoreComment = 'FormatOptions.ignore_comment',
	IndentBetweenHotIfDirective = 'FormatOptions.indent_between_hotif_directive',
	IndentString = 'FormatOptions.indent_string',
	InterpreterPath = 'InterpreterPath',
	KeywordStartWithUppercase = 'FormatOptions.keyword_start_with_uppercase',
	LibrarySuggestions = 'AutoLibInclude',
	LocalSameAsGlobal = 'Warn.LocalSameAsGlobal',
	Locale = 'locale',
	MaxPreserveNewlines = 'FormatOptions.max_preserve_newlines',
	MaxScanDepth = 'Files.ScanMaxDepth',
	ObjectStyle = 'FormatOptions.object_style',
	/** Not supported, kept to show warning to users that still have it */
	OneTrueBrace = 'FormatOptions.one_true_brace',
	ParamsCheck = 'Diagnostics.ParamsCheck',
	PreserveNewlines = 'FormatOptions.preserve_newlines',
	SpaceAfterDoubleColon = 'FormatOptions.space_after_double_colon',
	SpaceBeforeConditional = 'FormatOptions.space_before_conditional',
	SpaceInEmptyParen = 'FormatOptions.space_in_empty_paren',
	SpaceInOther = 'FormatOptions.space_in_other',
	SpaceInParen = 'FormatOptions.space_in_paren',
	SwitchCaseAlignment = 'FormatOptions.switch_case_alignment',
	SymbolFoldingFromOpenBrace = 'SymbolFoldingFromOpenBrace',
	SymbolWithSameCase = 'FormatOptions.symbol_with_same_case',
	Syntaxes = 'Syntaxes',
	VarUnset = 'Warn.varUnset',
	WhiteSpaceBeforeInlineComment = 'FormatOptions.white_space_before_inline_comment',
	WorkingDirectories = 'WorkingDirs',
	WrapLineLength = 'FormatOptions.wrap_line_length',
}

export type ActionType =
	| 'Continue'
	| 'Warn'
	| 'SkipLine'
	| 'SwitchToV1'
	| 'Stop';

export enum LibIncludeType {
	Disabled = 'Disabled',
	Local = 'Local',
	UserAndStandard = 'User and Standard',
	All = 'All',
}

export enum CallWithoutParentheses {
	Off = 'Off',
	Parentheses = 'Parentheses',
	On = 'On',
}

/** Possible values for `array_style` and `object_style` */
export type BlockStyle = 'collapse' | 'expand' | 'none';

export type BraceStyle =
	| 'One True Brace'
	| 'Allman'
	| 'One True Brace Variant'
	| 'Preserve';

export interface FormatOptions {
	array_style?: BlockStyle;
	brace_style?: BraceStyle;
	break_chained_methods?: boolean;
	ignore_comment?: boolean;
	indent_string?: string;
	indent_between_hotif_directive?: boolean;
	keyword_start_with_uppercase?: boolean;
	max_preserve_newlines?: number;
	object_style?: BlockStyle;
	preserve_newlines?: boolean;
	space_before_conditional?: boolean;
	space_after_double_colon?: boolean;
	space_in_empty_paren?: boolean;
	space_in_other?: boolean;
	space_in_paren?: boolean;
	switch_case_alignment?: boolean;
	symbol_with_same_case?: boolean;
	white_space_before_inline_comment?: string;
	wrap_line_length?: number;
}

/** Matches the contributed extension configuration in package.json */
export interface AHKLSConfig {
	locale?: string;
	commands?: string[];
	extensionUri?: string;
	ActionWhenV1IsDetected: ActionType;
	AutoLibInclude: LibIncludeType;
	CommentTags?: string;
	CompleteFunctionParens: boolean;
	CompletionCommitCharacters?: {
		Class: string;
		Function: string;
	};
	/** Only used in client */
	DebugConfiguration?: Record<string, unknown>;
	Diagnostics: {
		ClassNonDynamicMemberCheck: boolean;
		ParamsCheck: boolean;
	};
	Files?: {
		Exclude: string[];
		MaxDepth: number;
	};
	FormatOptions: FormatOptions;
	InterpreterPath: string;
	Syntaxes?: string;
	SymbolFoldingFromOpenBrace: boolean;
	Warn: {
		VarUnset: boolean;
		LocalSameAsGlobal: boolean;
		CallWithoutParentheses: CallWithoutParentheses;
	};
	WorkingDirs: string[];
}

/**
 * With no arg provided, returns initial values of the config object.
 * Any values provided in the arg are preserved in the new object.
 */
export const newConfig = (config: Partial<AHKLSConfig> = {}): AHKLSConfig => ({
	ActionWhenV1IsDetected: 'Warn',
	AutoLibInclude: LibIncludeType.Disabled,
	CommentTags: '^;;\\s*(.*)',
	CompleteFunctionParens: false,
	CompletionCommitCharacters: {
		Class: '.(',
		Function: '(',
	},
	Diagnostics: {
		ClassNonDynamicMemberCheck: true,
		ParamsCheck: true,
	},
	Files: {
		Exclude: [],
		MaxDepth: 2,
	},
	FormatOptions: {},
	InterpreterPath: 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe',
	SymbolFoldingFromOpenBrace: false,
	Warn: {
		VarUnset: true,
		LocalSameAsGlobal: false,
		CallWithoutParentheses: CallWithoutParentheses.Off,
	},
	WorkingDirs: [],
	...config,
});

/**
 * The global object shared across the server.
 * The client fetches the config from VS Code directly.
 * Updated when the user changes their settings.
 */
const ahklsConfig: AHKLSConfig = newConfig();

/** The start of each config value in package.json */
export const configPrefix = 'AutoHotkey2';

/**
 * Gets a single config value from the provided config.
 * If no config provided, uses the global config.
 */
export const getCfg = <T = string>(
	key?: CfgKey,
	/**
	 * AHKLSConfig for server, { readonly ... } for client.
	 * Since this func just reads values, both are acceptable.
	 */
	config: AHKLSConfig | { readonly [key: string]: unknown } = ahklsConfig,
): T => {
	if (!key) return config as T;
	const keyPath = key.split('.');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let value: any = config;
	for (const k of keyPath) {
		if (!value) {
			if (config === ahklsConfig) {
				console.warn(`Failed to get config`, key);
			}
			return undefined as T;
		}
		value = value?.[k];
	}
	return value;
};

/**
 * Sets the value of the key in the provided config.
 * If no config provided, updates the global config.
 * Does not update IDE settings.
 */
export const setCfg = <T>(
	key: CfgKey,
	value: T,
	config: AHKLSConfig = ahklsConfig,
): void => {
	const keyPath = key.split('.');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let obj: any = config;
	for (const k of keyPath.slice(0, -1)) {
		obj = obj?.[k];
	}
	if (!obj) {
		if (config === ahklsConfig) {
			console.warn(`(Global) Failed to set config`, key, value);
		}
		return;
	}
	obj[keyPath[keyPath.length - 1]] = value;
};

/**
 * Assign the provided config to the root config.
 * Assumes the provided config is valid.
 */
export const setConfigRoot = (config: AHKLSConfig): void => {
	Object.assign(ahklsConfig, config);
};

export const shouldIncludeUserStdLib = (
	config: AHKLSConfig = ahklsConfig,
): boolean => {
	const result =
		getCfg<LibIncludeType>(CfgKey.LibrarySuggestions, config) ===
			LibIncludeType.UserAndStandard ||
		getCfg<LibIncludeType>(CfgKey.LibrarySuggestions, config) ===
			LibIncludeType.All;
	return result;
};

export const shouldIncludeLocalLib = (
	config: AHKLSConfig = ahklsConfig,
): boolean => {
	const result =
		getCfg<LibIncludeType>(CfgKey.LibrarySuggestions, config) ===
			LibIncludeType.Local ||
		getCfg<LibIncludeType>(CfgKey.LibrarySuggestions, config) ===
			LibIncludeType.All;
	return result;
};

//* Unique to AHK++

/** Defined in package.json */
export type ShowOutput = 'always' | 'never';
