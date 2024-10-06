//* General global variables that may be changed by forks
// For config-specific values, see `config.ts`
/** ID of the language client, used for internal reference */
export const languageClientId = 'AutoHotkey2';
/** Name of the language client, displayed to users? */
export const languageClientName = 'AutoHotkey2';
/** Name of the output channel for debugging information, displayed to users */
export const outputChannelName = 'AutoHotkey2';

/** Prefix for commands sent by the client */
const lspCommandPrefix = 'ahk2.';
export type LSPCommand = `${typeof lspCommandPrefix}${string}`;
/**
 * Ask the server to execute the provided command.
 * See `executeCommandProvider` in `server/src/commandProvider.ts` for details.
 */
export const lspExecuteCommand = `${lspCommandPrefix}executeCommand`;
/** Get the active text editor URI and position */
export const lspGetActiveTextEditorUriAndPosition: LSPCommand = `${lspCommandPrefix}getActiveTextEditorUriAndPosition`;
/** Insert a snippet */
export const lspInsertSnippet: LSPCommand = `${lspCommandPrefix}insertSnippet`;
/** Set the language of the text document */
export const lspSetTextDocumentLanguage: LSPCommand = `${lspCommandPrefix}setTextDocumentLanguage`;
/** LSP command ID to update the status bar */
export const lspUpdateStatusBar: LSPCommand = `${lspCommandPrefix}updateStatusBar`;
