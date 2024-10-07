//* IDE-specific config functions

import * as vscode from 'vscode';
import { CfgKey, configPrefix } from '../../util/src/config';

/** Get the root config object currently persisted in the IDE */
export function getConfigRoot() {
	return vscode.workspace.getConfiguration(configPrefix);
}

/** Get the config value currently persisted in the IDE */
export function getConfigIDE<T = unknown>(
	key: CfgKey,
	defaultValue: T,
): typeof defaultValue {
	const rawResult = getConfigRoot().get<T>(key);
	if (rawResult === undefined) return defaultValue;
	return rawResult;
}
