import { resolve } from 'path';
import { dirname, getlocalefile, getwebfile, inBrowser } from './common';

let loadedCollection: { [key: string]: string } = {};

export namespace completionitem {
	export const author = localize('completionitem.author', 'Add file infos about author, description, date, version.');
	export const comment = localize('completionitem.generatecomment', 'Generate comment template of current function/method.');
	export const include = localize('completionitem.include', 'Auto import from \'{0}\'');
	export const prototype = localize('completionitem.prototype', 'Retrieve or set the object on which all instances of the class are based.');
	export const thishotkey = localize('completionitem.thishotkey', 'The hidden parameter to the hotkey function.');
	export const value = localize('completionitem.value', 'Within the dynamic property \'set\', \'Value\' contains the value being assigned.');
	export const _new = localize('completionitem.new', 'export construct a new instance of the class.');
	export const _this = localize('completionitem.this', 'In the class, access other instance variables and methods of the class through \'this\'.');
	export const _super = localize('completionitem.super', 'In the inherited class, \'super\' can replace \'this\' to access the superclass version of the method or property that is overridden in the derived class.');
}

export namespace codeaction {
	export const include = localize('codeaction.include', 'Import \'{0}\'');
}

export namespace diagnostic {
	export const acceptparams = localize('diagnostic.acceptparams', '\'{0}\' accepts {1} parameter(s)');
	export const assignerr = localize('diagnostic.assignerr', 'This {0} \'{1}\' cannot be used as an output variable');
	export const classinfuncerr = localize('diagnostic.classinfuncerr', 'Functions cannot contain classes');
	export const classuseerr = localize('diagnostic.classuseerr', 'This class cannot be used as an output variable');
	export const conflictserr = localize('diagnostic.conflictserr', 'This {0} \'{2}\' declaration conflicts with an existing {1}');
	export const declarationerr = localize('diagnostic.declarationerr', 'Unexpected declaration');
	export const defaultvalmissing = localize('diagnostic.defaultvalmissing', 'Parameter default required. Specifically: \'{0}\'');
	export const deprecated = localize('diagnostic.deprecated', 'Using \'{0}\' instead of \'{1}\'');
	export const didyoumean = localize('diagnostic.didyoumean', 'Did you mean to use \'{0}\'?');
	export const dupdeclaration = localize('diagnostic.dupdeclaration', 'Duplicate declaration');
	export const duplabel = localize('diagnostic.duplabel', 'Duplicate label');
	export const filenotexist = localize('diagnostic.filenotexist', '\'{0}\' not exist');
	export const funccallerr = localize('diagnostic.funccallerr', 'Function calls require a space or \'(\',  use comma only between parameters');
	export const funccallerr2 = localize('diagnostic.funccallerr2', 'In the expression, the function call requires parentheses');
	export const globalconflicts = localize('diagnostic.globalconflicts', 'This global declaration conflicts with an existing {0}');
	export const hotdeferr = localize('diagnostic.hotdeferr', 'Hotkeys/hotstrings cannot be defined in functions/classes');
	export const hotmissbrace = localize('diagnostic.hotmissbrace', 'Hotkey or hotstring is missing its opening brace');
	export const invaliddefinition = localize('diagnostic.invaliddefinition', 'Invalid {0} definition');
	export const invalidencoding = localize('diagnostic.invalidencoding', '\'{0}\' invalid file encoding');
	export const invalidhotdef = localize('diagnostic.invalidhotdef', 'Invalid hotkey definition');
	export const invalidparam = localize('diagnostic.invalidparam', 'Invalid parameter definition');
	export const invalidprop = localize('diagnostic.invalidprop', 'Invalid dynamic property');
	export const invalidpropname = localize('diagnostic.invalidpropname', 'Invalid property name in object literal');
	export const invalidsymbolname = localize('diagnostic.invalidsymbolname', 'Invalid symbol naming \'{0}\'');
	export const invalidusage = localize('diagnostic.invalidusage', '\'{0}\' cannot be used in functions/classes');
	export const maybehavenotmember = localize('diagnostic.maybehavenotmember', 'Class \'{0}\' maybe have not member \'{1}\'');
	export const maybev1 = localize('diagnostic.maybev1', 'This might be a v1 script, and the lexer stops parsing.');
	export const missing = localize('diagnostic.missing', 'Missing \'{0}\'');
	export const missingparam = localize('diagnostic.missingparam', 'Missing a required parameter');
	export const missingretval = localize('diagnostic.missingretval', 'The function missing a return value');
	export const missingspace = localize('diagnostic.missingspace', 'Missing space or operator before this');
	export const objectliteralerr = localize('diagnostic.objectliteralerr', 'Error in object literal');
	export const paramcounterr = localize('diagnostic.paramcounterr', 'Expected {0} parameters, but got {1}');
	export const pathinvalid = localize('diagnostic.pathinvalid', 'Invalid file path');
	export const propdeclaraerr = localize('diagnostic.propdeclaraerr', 'Not a valid method, class or property definition');
	export const propemptyparams = localize('diagnostic.propemptyparams', 'Empty [] not permitted');
	export const propnotinit = localize('diagnostic.propnotinit', 'Property declaration is not initialized');
	export const requirev1 = localize('diagnostic.requirev1', 'This script requires AutoHotkey v1, and the lexer stops parsing.');
	export const requirevariable = localize('diagnostic.requirevariable', "'&' requires a variable");
	export const reservedworderr = localize('diagnostic.reservedworderr', 'The following reserved word \'{0}\' must not be used as a variable name');
	export const resourcenotfound = localize('diagnostic.resourcenotfound', 'No resource found or could not be resolved');
	export const skipline = localize('diagnostic.skipline', 'The line is skipped and not resolved');
	export const tryswitchtov1 = localize('diagnostic.tryswitchtov1', 'Try switching to AutoHotkey v1.');
	export const typemaybenot = localize('diagnostic.typemaybenot', 'Type maybe not \'{0}\'');
	export const unexpected = localize('diagnostic.unexpected', 'Unexpected \'{0}\'');
	export const unknown = localize('diagnostic.unknown', 'Unknown {0}');
	export const unknownoperatoruse = localize('diagnostic.unknownoperatoruse', 'Unknown operator use');
	export const unknowntoken = localize('diagnostic.unknowntoken', 'Unknown token \'{0}\'');
	export const unsupportinclude = localize('diagnostic.unsupportinclude', '#Include in functions and classes cannot correctly deduce scope and code completion');
	export const unterminated = localize('diagnostic.unterminated', 'Unterminated string text');
	export const varisunset = localize('diagnostic.varisunset', 'Variable \'{0}\' appears to never be assigned a value');
}
export namespace setting {
	export const ahkpatherr = localize('setting.ahkpatherr', 'The AutoHotkey interpreter does not exist, re-specify in\'Settings-AutoHotkey2.InterpreterPath\'');
	export const getenverr = localize('setting.getenverr', 'Failed to get environment variables');
	export const uialimit = localize('setting.uialimit', 'The UIA executable does not allow redirection to stdin/stdout due to security restrictions, so some features that depend on this will not work');
	export const versionerr = localize('setting.versionerr', 'The current AutoHotkey.exe is not the v2 version, and cannot get the correct syntax analysis, completion and other functions');
}

export namespace action {
	export const switchtov1 = localize('action.switchtov1', 'Switch to ahk v1');
	export const skipline = localize('action.skipline', 'Skip the line');
	export const stopparsing = localize('action.stopparsing', 'Stop parsing');
}

export namespace response {
	export const cannotrename = localize('response.cannotrename', 'The element can\'t be renamed.');
	export const cannotrenamestdlib = localize('response.cannotrenamestdlib', 'Elements defined in the standard AutoHotkey library can\'t be renamed.');
}

export function loadlocalize() {
	if (inBrowser) {
		let data = getwebfile(dirname + '/package.nls.<>.json');
		if (data)
			loadedCollection = JSON.parse(data.text);
	} else {
		let s = getlocalefile(resolve(__dirname, '../../package.nls.<>.json'), 'utf8') as string;
		loadedCollection = s ? JSON.parse(s) : {};
	}
}

function localize(key: string, defValue: string): (...args: any[]) => string {
	return (...args: string[]) => {
		if (args.length)
			return format(getString(key, defValue), ...args);
		else
			return getString(key, defValue);
	};
}

function getString(key: string, defValue: string): string {
	return loadedCollection[key] || defValue;
}

function format(message: string, ...args: string[]): string {
	return message.replace(/\{(\d+)\}/g, (...m) => {
		let i = parseInt(m[1]);
		if (i < args.length)
			return args[i];
		return ' ';
	});
}