import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

let loadedCollection: { [key: string]: string };

export namespace completionitem {
	export const include = localize('completionitem.include', 'Auto import from \'{0}\'');
	export const prototype = localize("completionitem.prototype", "Retrieve or set the object on which all instances of the class are based.");
	export const _new = localize("completionitem.new", "export construct a new instance of the class.");
	export const _this = localize("completionitem.this", "In the class, access other instance variables and methods of the class through \'this\'.");
	export const _super = localize("completionitem.super", "In the inherited class, \'super\' can replace \'this\' to access the superclass version of the method or property that is overridden in the derived class.");
}

export namespace codeaction {
	export const include = localize("codeaction.include", "Import '{0}'");
}

export namespace diagnostic {
	export const classdeferr = localize('diagnostic.classdeferr', 'This class declaration conflicts with an existing class');
	export const classinfuncerr = localize('diagnostic.classinfuncerr', 'Functions cannot contain classes');
	export const classuseerr = localize('diagnostic.classuseerr', 'This class cannot be used as an output variable');
	export const filenotexist = localize('diagnostic.filenotexist', '\'{0}\' not exist');
	export const funccallerr = localize('diagnostic.funccallerr', 'Function calls require a space or \'(\',  use comma only between parameters');
	export const funcdeferr = localize('diagnostic.funcdeferr', 'Duplicate function definition');
	export const hotdeferr = localize('diagnostic.hotdeferr', 'Hotkeys/hotstrings cannot be defined in functions/classes');
	export const invalidhotdef = localize('diagnostic.invalidhotdef', 'Invalid hotkey definition');
	export const invalidparam = localize('diagnostic.invalidparam', 'Invalid parameter default value');
	export const invalidprop = localize('diagnostic.invalidprop', 'Invalid dynamic property');
	export const invalidpropname = localize('diagnostic.invalidpropname', 'Invalid property name in object literal');
	export const invalidsymbolname = localize('diagnostic.invalidsymbolname', 'Invalid symbol naming \'{0}\'');
	export const missing = localize('diagnostic.missing', 'Missing \'{0}\'');
	export const objectliteralerr = localize('diagnostic.objectliteralerr', 'Error in object literal');
	export const pathinvalid = localize('diagnostic.pathinvalid', 'Invalid file path');
	export const propdeclaraerr = localize('diagnostic.propdeclaraerr', 'Class property declaration cannot use global/local');
	export const propnotinit = localize('diagnostic.propnotinit', 'Property declaration is not initialized');
	export const reservedworderr = localize('diagnostic.reservedworderr', 'The following reserved word must not be used as a variable name \'{0}\'');
	export const unexpected = localize('diagnostic.unexpected', 'Unexpected \'{0}\'');
	export const unknowninclude = localize('diagnostic.unknowninclude', '\'{0}\' invalid include file format');
	export const unknownoperatoruse = localize('diagnostic.unknownoperatoruse', 'Unknown operator use');
	export const unknowntoken = localize('diagnostic.unknowntoken', 'Unknown token \'{0}\'');
	export const unsupportinclude = localize('diagnostic.unsupportinclude', '#Include in functions and classes cannot correctly deduce scope and code completion');
}

export namespace setting {
	export const ahkpatherr = localize('setting.ahkpatherr', 'The path of the AutoHotkey executable file is incorrect, re-specify in\'Settings-AutoHotkey2.Path\'');
	export const versionerr = localize('setting.versionerr', 'The current AutoHotkey.exe is not the v2 version, and cannot get the correct syntax analysis, completion and other functions');
}

function load() {
	let path = '';
	const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
	const locale = vscodeConfigString ? JSON.parse(vscodeConfigString).locale : 'en-us';
	if (!existsSync(path = resolve(__dirname, `../../package.nls.${locale}.json`)) &&
		!(locale === 'zh-tw' && existsSync(path = resolve(__dirname, '../../package.nls.zh-cn.json'))))
		path = resolve(__dirname, '../../package.nls.json');
	if (existsSync(path))
		loadedCollection = JSON.parse(readFileSync(path, { encoding: 'utf8' }));
	else
		loadedCollection = {};
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
	if (!loadedCollection)
		load();
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
