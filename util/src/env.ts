//* General global variables that may be changed by forks
// For config-specific values, see `config.ts`

/** ID of the language client, used for internal reference */
export const languageClientId = 'AutoHotkey2';

/** Name of the language client, displayed to users? */
export const languageClientName = 'AutoHotkey2';

/** Name of the output channel for debugging information, displayed to users */
export const outputChannelName = 'AutoHotkey2';

//* Internal commands - Client-side

/** Prefix for commands handled by the client. These are not registered in package.json */
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

//* Internal commands - Server-side

/** Prefix for commands handled by the server. These are not registered in package.json */
const serverCommandPrefix = 'ahk2.';
export type ServerCommand = `${typeof serverCommandPrefix}${string}`;

export const serverExportSymbols = `${serverCommandPrefix}exportSymbols`;

export const serverGetAHKVersion = `${serverCommandPrefix}getAHKVersion`;

export const serverGetContent = `${serverCommandPrefix}getContent`;

export const serverGetVersionInfo = `${serverCommandPrefix}getVersionInfo`;

//* External commands (contributed by package.json)
//* These should not change unless package.json changes

const extCommandPrefix = 'ahk2.';
export type ExtensionCommand = `${typeof extCommandPrefix}${string}`;

/** Diagnose all files */
export const extDiagnoseAll = `${extCommandPrefix}diagnose.all`;

/** Generate a method header comment */
export const extGenerateComment = `${extCommandPrefix}generate.comment`;

/** Set the script directory */
export const extSetScriptDir = `${extCommandPrefix}set.scriptdir`;

/** Open AHK help */
export const extHelp = `${extCommandPrefix}help`;

/** Compile the script in the active text editor */
export const extCompile = `${extCommandPrefix}compile`;

/** Run the script in the active text editor */
export const extRun = `${extCommandPrefix}run`;

/** Run the selected text */
export const extRunSelection = `${extCommandPrefix}run.selection`;

/** Stop an AHK script started by this process */
export const extStop = `${extCommandPrefix}stop`;

/** Set the interpreter */
export const extSetInterpreter = `${extCommandPrefix}set.interpreter`;

/** Debug the script in the active text editor */
export const extDebugFile = `${extCommandPrefix}debug.file`;

/** Debug from a selected config */
export const extDebugConfig = `${extCommandPrefix}debug.configs`;

/** Debug with params */
export const extDebugParams = `${extCommandPrefix}debug.params`;

/** Debug and attach */
export const extDebugAttach = `${extCommandPrefix}debug.attach`;

/** Select syntaxes */
export const extSelectSyntaxes = `${extCommandPrefix}select.syntaxes`;

/** Update version info file header comment */
export const extUpdateVersionInfo = `${extCommandPrefix}update.versioninfo`;

/** Extract the symbols from the active editor */
export const extExtractSymbols = `${extCommandPrefix}extract.symbols`;

/** Switch the current editor from AHK v1 to AHK v2 and vice versa */
export const extSwitchAHKVersion = `${extCommandPrefix}switch`;
