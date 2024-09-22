// Very similar to ahk2/server/src/config.ts
// todo dedupe config.ts

import * as vscode from 'vscode';

/** Defined in package.json */
export type ShowOutput = 'always' | 'never';

export enum CfgKey {
	DebugConfiguration = 'v2.debugConfiguration',
	InterpreterPathV1 = 'v1.file.interpreterPath',
	InterpreterPathV2 = 'v2.file.interpreterPath',
	ShowOutput = 'general.showOutput',
	Syntaxes = 'v2.general.syntaxes',
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
