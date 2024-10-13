import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

/**
 * Shortcut for `vscode.workspace.openTextDocument(Uri.file(fileName))`
 * @param path A name of a file on disk. This is the full path to the file.
 */
export const getDocument = async (path: string): Promise<vscode.TextDocument> =>
	await vscode.workspace.openTextDocument(path);

// Copying to test helpers for easy import
export async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

let client: LanguageClient | undefined = undefined;
/** Singleton exported client to be used across test files */
export const getClient = async () => {
	if (client) return client;
	client = (await vscode.extensions
		.getExtension<LanguageClient>('thqby.vscode-autohotkey2-lsp')
		?.activate()) as LanguageClient;
	if (!client) throw new Error('Failed to activate language client');
	return client;
}