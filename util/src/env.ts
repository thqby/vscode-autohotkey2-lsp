//* General global variables that may be changed by forks
// For config-specific values, see `config.ts`

/** ID of the language client, used for internal reference */
export const languageClientId = 'AHK++';

/** Name of the language client, displayed to users? */
export const languageClientName = 'AHK++';

/** Name of the output channel for debugging information, displayed to users */
export const outputChannelName = 'AHK++';

//* Internal commands - Client-side

/** Prefix for commands handled by the client. These are not registered in package.json */
const clientCommandPrefix = 'ahk++.';
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

//* Internal commands - Server-side

/** Prefix for commands handled by the server. These are not registered in package.json */
const serverCommandPrefix = 'ahk++.lsp.';
export type ServerCommand = `${typeof serverCommandPrefix}${string}`;

export const serverExportSymbols = `${serverCommandPrefix}exportSymbols`;

export const serverGetAHKVersion = `${serverCommandPrefix}getAHKversion`;

export const serverGetContent = `${serverCommandPrefix}getContent`;

export const serverGetVersionInfo = `${serverCommandPrefix}getVersionInfo`;

/** Set the path to the AHK v2 interpreter to match the provided value */
export const serverResetInterpreterPath = `${serverCommandPrefix}setV2Interpreter`;

//* External commands (contributed by package.json)
//* These should not change unless package.json changes

const extCommandPrefix = 'ahk++.';
export type ExtensionCommand = `${typeof extCommandPrefix}${string}`;

/** Diagnose all files */
export const extDiagnoseAll = `${extCommandPrefix}diagnostic.full`;

/** Generate a method header comment */
export const extGenerateComment = `${extCommandPrefix}addDocComment`;

/** Set the script directory */
export const extSetScriptDir = `${extCommandPrefix}setAScriptDir`;

/** Run the script in the active text editor */
export const extRun = `${extCommandPrefix}run`;

/** Run the selected text */
export const extRunSelection = `${extCommandPrefix}runSelection`;

/** Stop an AHK script started by this process */
export const extStop = `${extCommandPrefix}stop`;

/** Set the interpreter */
export const extSetInterpreter = `${extCommandPrefix}setV2Interpreter`;

/** Debug from a selected config */
export const extDebugConfig = `${extCommandPrefix}debugConfigs`;

/** Debug with params */
export const extDebugParams = `${extCommandPrefix}debugParams`;

/** Debug and attach */
export const extDebugAttach = `${extCommandPrefix}debugAttach`;

/** Select syntaxes */
export const extSelectSyntaxes = `${extCommandPrefix}select.syntaxes`;

/** Update version info file header comment */
export const extUpdateVersionInfo = `${extCommandPrefix}updateVersionInfo`;

/** Extract the symbols from the active editor */
export const extExtractSymbols = `${extCommandPrefix}exportSymbols`;

/** Switch the current editor from AHK v1 to AHK v2 and vice versa */
export const extSwitchAHKVersion = `${extCommandPrefix}switchAhkVersion`;
