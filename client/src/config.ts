// Very similar to ahk2/server/src/config.ts
// todo dedupe config.ts

import * as vscode from 'vscode';

/** Defined in package.json */
export type ShowOutputView = 'always' | 'never';

export enum CfgKey {
	ActionWhenV1Detected = 'v2.general.actionWhenV1Detected',
	CallWithoutParentheses = 'v2.warn.callWithoutParentheses',
	ClassNonDynamicMemberCheck = 'v2.diagnostics.classNonDynamicMemberCheck',
	CommentTagRegex = 'v2.general.commentTagRegex',
	CompleteFunctionCalls = 'v2.general.completeFunctionCalls',
	CompletionCommitCharacters = 'v2.completionCommitCharacters',
	DebugConfiguration = 'v2.debugConfiguration',
	Exclude = 'v2.exclude',
	Formatter = 'v2.formatter',
	InterpreterPathV1 = 'v1.file.interpreterPath',
	InterpreterPathV2 = 'v2.file.interpreterPath',
	LibrarySuggestions = 'v2.general.librarySuggestions',
	LocalSameAsGlobal = 'v2.warn.localSameAsGlobal',
	MaxScanDepth = 'v2.file.maxScanDepth',
	ParamsCheck = 'v2.diagnostics.paramsCheck',
	ShowOutputView = 'general.showOutputView',
	SymbolFoldingFromOpenBrace = 'v2.general.symbolFoldingFromOpenBrace',
	Syntaxes = 'v2.general.syntaxes',
	VarUnset = 'v2.warn.varUnset',
	WorkingDirectories = 'v2.workingDirectories', // still used directly in some places
}

const configPrefix = 'AHK++';

/**
 * Gets AHK++ config value from VS Code.
 * Use `getAhkppConfig` to get the full config object.
 */
export function getCfg<T>(key: CfgKey): T | undefined {
	return getAhkppConfig().get<T>(key);
}

export function getAhkppConfig() {
	return vscode.workspace.getConfiguration(configPrefix);
}
