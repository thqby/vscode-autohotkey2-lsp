//* Utility functions to access the config variable from either client or server
//* All exported values here match contributed settings/configurations in package.json
export enum CfgKey {
	ActionWhenV1Detected = 'v2.general.actionWhenV1Detected',
	ArrayStyle = 'v2.formatter.arrayStyle',
	BraceStyle = 'v2.formatter.braceStyle',
	BreakChainedMethods = 'v2.formatter.breakChainedMethods',
	CallWithoutParentheses = 'v2.warn.callWithoutParentheses',
	ClassNonDynamicMemberCheck = 'v2.diagnostics.classNonDynamicMemberCheck',
	Commands = 'commands',
	CommentTagRegex = 'v2.general.commentTagRegex',
	CompleteFunctionCalls = 'v2.general.completeFunctionCalls',
	CompletionCommitCharacters = 'v2.completionCommitCharacters',
	DebugConfiguration = 'DebugConfiguration',
	Exclude = 'exclude',
	ExtensionUri = 'extensionUri',
	Formatter = 'v2.formatter',
	IgnoreComment = 'v2.formatter.ignoreComment',
	IndentBetweenHotIfDirective = 'v2.formatter.indentBetweenHotIfDirectives',
	IndentString = 'v2.formatter.indent_string',
	InterpreterPath = 'v2.file.interpreterPath',
	InterpreterPathV1 = 'v1.file.interpreterPath', // unique to AHK++
	KeywordStartWithUppercase = 'v2.formatter.keywordStartWithUppercase',
	LibrarySuggestions = 'v2.general.librarySuggestions',
	LocalSameAsGlobal = 'v2.warn.localSameAsGlobal',
	Locale = 'locale',
	MaxPreserveNewlines = 'v2.formatter.maxPreserveNewlines',
	MaxScanDepth = 'v2.file.maxScanDepth',
	ObjectStyle = 'v2.formatter.objectStyle',
	OneTrueBrace = 'v2.formatter.one_true_brace', // deprecated, not used
	ParamsCheck = 'v2.diagnostics.paramsCheck',
	PreserveNewlines = 'v2.formatter.preserveNewlines',
	ShowOutput = 'general.showOutput', // unique to AHK++
	SpaceAfterDoubleColon = 'v2.formatter.spaceAfterDoubleColon',
	SpaceBeforeConditional = 'v2.formatter.spaceBeforeConditional',
	SpaceInEmptyParen = 'v2.formatter.spaceInEmptyParen',
	SpaceInOther = 'v2.formatter.spaceInOther',
	SpaceInParen = 'v2.formatter.spaceInParen',
	SwitchCaseAlignment = 'v2.formatter.switchCaseAlignment',
	SymbolFoldingFromOpenBrace = 'v2.general.symbolFoldingFromOpenBrace',
	SymbolWithSameCase = 'v2.formatter.symbolWithSameCase',
	Syntaxes = 'v2.general.syntaxes',
	VarUnset = 'v2.warn.varUnset',
	WhiteSpaceBeforeInlineComment = 'v2.formatter.whitespaceBeforeInlineComment',
	WorkingDirectories = 'v2.workingDirectories',
	WrapLineLength = 'v2.formatter.wrapLineLength',
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
	arrayStyle: BlockStyle;
	braceStyle: BraceStyle;
	breakChainedMethods: boolean;
	ignoreComment: boolean;
	indentString: string;
	indentBetweenHotIfDirectives: boolean;
	keywordStartWithUppercase: boolean;
	maxPreserveNewlines: number;
	objectStyle: BlockStyle;
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
}

export interface CompletionCommitCharacters {
	Class: string;
	Function: string;
}

/** Matches the contributed extension configuration in package.json */
export interface AHKLSConfig {
	/** Glob pattern of files to ignore */
	exclude: string[];
	v2: {
		general: {
			actionWhenV1Detected: ActionType;
			/** The regex denoting a custom symbol. Defaults to `;;` */
			commentTagRegex?: string;
			/** Automatically insert parentheses on function call */
			completeFunctionCalls: boolean;
			/** Suggest library functions */
			librarySuggestions: LibIncludeType;
			symbolFoldingFromOpenBrace: boolean;
			syntaxes: string;
		};
		completionCommitCharacters: CompletionCommitCharacters;
		diagnostics: {
			classNonDynamicMemberCheck: boolean;
			paramsCheck: boolean;
		};
		file: {
			/** Path to the AHK v2 intepreter */
			interpreterPath: string;
			/** Depth of folders to scan for IntelliSense */
			maxScanDepth: number;
		};
		/** Config of the v2 formatter */
		formatter: FormatOptions;
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
export const newFormatOptions = (
	config: Partial<FormatOptions> = {},
): FormatOptions => ({
	arrayStyle: 'none',
	braceStyle: 'One True Brace',
	breakChainedMethods: false,
	ignoreComment: false,
	indentString: '    ',
	indentBetweenHotIfDirectives: false,
	keywordStartWithUppercase: false,
	maxPreserveNewlines: 2,
	objectStyle: 'none',
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
export const newConfig = (config: Partial<AHKLSConfig> = {}): AHKLSConfig => ({
	exclude: [],
	v2: {
		general: {
			actionWhenV1Detected: 'SwitchToV1',
			commentTagRegex: '^;;\\s*(.*)',
			completeFunctionCalls: false,
			librarySuggestions: LibIncludeType.Disabled,
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
		file: {
			interpreterPath: 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe',
			maxScanDepth: 2,
		},
		formatter: newFormatOptions(),
		warn: {
			varUnset: true,
			localSameAsGlobal: false,
			callWithoutParentheses: CallWithoutParentheses.Off,
		},
		workingDirectories: [],
	},
	...config,
});

/**
 * The global object shared across the server.
 * The client fetches the config from VS Code directly.
 * Updated when the user changes their settings.
 */
const ahklsConfig: AHKLSConfig = newConfig();

/** The start of each config value in package.json */
export const configPrefix = 'AHK++';

/**
 * Gets a single config value from the provided config.
 * If no config provided, uses the global config.
 * If no key provided, returns the entire config.
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
