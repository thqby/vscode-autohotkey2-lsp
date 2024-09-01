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

export interface AhkppConfig {
	v2: {
		actionWhenV1Detected: ActionType;
		/** The regex denoting a custom symbol. Defaults to `;;` */
		commentTagRegex?: string;
		/** Automatically insert parentheses on function call */
		completeFunctionCalls: boolean;
		completionCommitCharacters: {
			Class: string;
			Function: string;
		};
		diagnostics: {
			classNonDynamicMemberCheck: boolean;
			paramsCheck: boolean;
		};
		file: {
			/** Glob pattern of files to ignore */
			exclude: string[];
			/** Path to the AHK v2 intepreter */
			interpreterPath: string;
			/** Depth of folders to scan for IntelliSense */
			maxScanDepth: number;
		};
		/** Config of the v2 formatter */
		formatter: FormatterConfig;
		/** Suggest library functions */
		librarySuggestions: LibrarySuggestions;
		warn: {
			/** Ref to a potentially-unset variable */
			varUnset: boolean;
			/** Undeclared local has same name as global */
			localSameAsGlobal: boolean;
			/** Function call without parentheses */
			callWithoutParentheses: CallWithoutParentheses;
		};
		symbolFoldingFromOpenBrace: boolean;
		syntaxes: string;
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

export const newAhkppConfig = (
	config: Partial<AhkppConfig> = {},
): AhkppConfig => ({
	v2: {
		actionWhenV1Detected: 'SwitchToV1',
		librarySuggestions: LibrarySuggestions.Off,
		commentTagRegex: '^;;\\s*(.*)',
		completeFunctionCalls: false,
		completionCommitCharacters: {
			Class: '.(',
			Function: '(',
		},
		diagnostics: {
			classNonDynamicMemberCheck: true,
			paramsCheck: true,
		},
		warn: {
			varUnset: true,
			localSameAsGlobal: false,
			callWithoutParentheses: CallWithoutParentheses.Off,
		},
		file: {
			exclude: [],
			interpreterPath:
				'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe',
			maxScanDepth: 2,
		},
		formatter: newFormatterConfig(),
		symbolFoldingFromOpenBrace: false,
		workingDirectories: [],
		syntaxes: '',
	},
	...config,
});
