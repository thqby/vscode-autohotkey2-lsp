import { resolve } from 'path';
import { dirname, getlocalefile, getwebfile, inBrowser } from './global';

let loadedCollection: { [key: string]: string } = {};

export namespace completionitem {
	export const author = localize('completionitem.author', 'Add file infos about author, description, date, version.');
	export const comment = localize('completionitem.generatecomment', 'Generate comment template of current function/method.');
	export const include = localize('completionitem.include', 'Auto import from \'{0}\'');
	export const prototype = localize("completionitem.prototype", "Retrieve or set the object on which all instances of the class are based.");
	export const thishotkey = localize("completionitem.thishotkey", "The hidden parameter to the hotkey function.");
	export const value = localize("completionitem.value", "Within the dynamic property 'set', 'Value' contains the value being assigned.");
	export const _new = localize("completionitem.new", "export construct a new instance of the class.");
	export const _this = localize("completionitem.this", "In the class, access other instance variables and methods of the class through \'this\'.");
	export const _super = localize("completionitem.super", "In the inherited class, \'super\' can replace \'this\' to access the superclass version of the method or property that is overridden in the derived class.");
}

export namespace codeaction {
	export const include = localize("codeaction.include", "Import '{0}'");
}

export namespace diagnostic {
	export const assignerr = localize('diagnostic.assignerr', 'This {0} \'{1}\' cannot be used as an output variable');
	export const classinfuncerr = localize('diagnostic.classinfuncerr', 'Functions cannot contain classes');
	export const classuseerr = localize('diagnostic.classuseerr', 'This class cannot be used as an output variable');
	export const conflictserr = localize('diagnostic.conflictserr', 'This {0} \'{2}\' declaration conflicts with an existing {1}');
	export const declarationerr = localize('diagnostic.declarationerr', 'Unexpected declaration');
	export const defaultvalmissing = localize('diagnostic.defaultvalmissing', 'Parameter default required. Specifically: \'{0}\'');
	export const deprecated = localize('diagnostic.deprecated', 'Using \'{0}\' instead of \'{1}\'');
	export const dupdeclaration = localize('diagnostic.dupdeclaration', 'Duplicate declaration');
	export const duplabel = localize('diagnostic.duplabel', 'Duplicate label');
	export const filenotexist = localize('diagnostic.filenotexist', '\'{0}\' not exist');
	export const funcassignerr = localize('diagnostic.funcassignerr', 'This Func cannot be assigned a value');
	export const funccallerr = localize('diagnostic.funccallerr', 'Function calls require a space or \'(\',  use comma only between parameters');
	export const globalconflicts = localize('diagnostic.globalconflicts', 'This global declaration conflicts with an existing {0}');
	export const hotdeferr = localize('diagnostic.hotdeferr', 'Hotkeys/hotstrings cannot be defined in functions/classes');
	export const invaliddefinition = localize('diagnostic.invaliddefinition', 'Invalid {0} definition');
	export const invalidhotdef = localize('diagnostic.invalidhotdef', 'Invalid hotkey definition');
	export const invalidparam = localize('diagnostic.invalidparam', 'Invalid parameter definition');
	export const invalidprop = localize('diagnostic.invalidprop', 'Invalid dynamic property');
	export const invalidpropname = localize('diagnostic.invalidpropname', 'Invalid property name in object literal');
	export const invalidsymbolname = localize('diagnostic.invalidsymbolname', 'Invalid symbol naming \'{0}\'');
	export const missing = localize('diagnostic.missing', 'Missing \'{0}\'');
	export const objectliteralerr = localize('diagnostic.objectliteralerr', 'Error in object literal');
	export const pathinvalid = localize('diagnostic.pathinvalid', 'Invalid file path');
	export const propdeclaraerr = localize('diagnostic.propdeclaraerr', 'Not a valid method, class or property definition');
	export const propemptyparams = localize('diagnostic.propemptyparams', 'Empty [] not permitted');
	export const propnotinit = localize('diagnostic.propnotinit', 'Property declaration is not initialized');
	export const reservedworderr = localize('diagnostic.reservedworderr', 'The following reserved word \'{0}\' must not be used as a variable name');
	export const returnmultival = localize('diagnostic.returnmultival', '\'Return\' accepts at most 1 parameter.');
	export const unexpected = localize('diagnostic.unexpected', 'Unexpected \'{0}\'');
	export const unknown = localize('diagnostic.unknown', 'Unknown {0}');
	export const unknowninclude = localize('diagnostic.unknowninclude', '\'{0}\' invalid include file format');
	export const unknownoperatoruse = localize('diagnostic.unknownoperatoruse', 'Unknown operator use');
	export const unknowntoken = localize('diagnostic.unknowntoken', 'Unknown token \'{0}\'');
	export const unsupportinclude = localize('diagnostic.unsupportinclude', '#Include in functions and classes cannot correctly deduce scope and code completion');
	export const unsupportresinclude = localize('diagnostic.unsupportresinclude', 'Parsing library files in resource is not supported');
}

export namespace setting {
	export const ahkpatherr = localize('setting.ahkpatherr', 'The AutoHotkey interpreter does not exist, re-specify in\'Settings-AutoHotkey2.InterpreterPath\'');
	export const getenverr = localize('setting.getenverr', 'Failed to get environment variables');
	export const versionerr = localize('setting.versionerr', 'The current AutoHotkey.exe is not the v2 version, and cannot get the correct syntax analysis, completion and other functions');
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

function localize(key: string, defValue: string): Function {
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