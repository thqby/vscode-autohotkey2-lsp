//* General global variables that may be changed by forks
// For config-specific values, see `config.ts`
/** ID of the language client, used for internal reference */
export const languageClientId = 'AutoHotkey2';
/** Name of the language client, displayed to users? */
export const languageClientName = 'AutoHotkey2';
/** Name of the output channel for debugging information, displayed to users */
export const outputChannelName = 'AutoHotkey2';

/** Prefix for commands handled by the client */
const clientCommandPrefix = 'ahk2.';
export type ClientCommand = `${typeof clientCommandPrefix}${string}`;
/**
 * Ask the server to execute the provided command.
 * See `executeCommandProvider` in `server/src/commandProvider.ts` for details.
 */
export const clientExecuteCommand = `${clientCommandPrefix}executeCommand`;
/** Get the active text editor URI and position */
export const clientGetActiveEditorInfo: ClientCommand = `${clientCommandPrefix}getActiveTextEditorUriAndPosition`;
/** Insert a snippet */
export const clientInsertSnippet: ClientCommand = `${clientCommandPrefix}insertSnippet`;
/** Set the language of the text document */
export const clientSetTextDocumentLanguage: ClientCommand = `${clientCommandPrefix}setTextDocumentLanguage`;
/** Update the status bar with the new interpreter info */
export const clientUpdateStatusBar: ClientCommand = `${clientCommandPrefix}updateStatusBar`;
/** Get matching AHK files */
export const clientGetWorkspaceFiles: ClientCommand = `${clientCommandPrefix}getWorkspaceFiles`;
/** Get the text content of the provided file */
export const clientGetWorkspaceFileContent: ClientCommand = `${clientCommandPrefix}getWorkspaceFileContent`;
