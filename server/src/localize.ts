import { rootdir, getlocalefile, getwebfile } from './common';
import { CfgKey } from './config';

let loadedCollection: Record<string, string> = {};

export const completionitem = {
	author: localize('completionitem.author', 'Add file infos about author, description, date, version.'),
	comment: localize('completionitem.generatecomment', 'Generate comment template of current function/method.'),
	include: localize('completionitem.include', 'Auto import from \'{0}\''),
	prototype: localize('completionitem.prototype', 'Retrieve or set the object on which all instances of the class are based.'),
	thishotkey: localize('completionitem.thishotkey', 'The hidden parameter to the hotkey function.'),
	value: localize('completionitem.value', 'Within the dynamic property \'set\', \'Value\' contains the value being assigned.'),
	new: localize('completionitem.new', 'export construct a new instance of the class.'),
	this: localize('completionitem.this', 'In the class, access other instance variables and methods of the class through \'this\'.'),
	super: localize('completionitem.super', 'In the inherited class, \'super\' can replace \'this\' to access the superclass version of the method or property that is overridden in the derived class.'),
}

export const codeaction = {
	include: localize('codeaction.include', 'Import \'{0}\''),
}

export const diagnostic = {
	acceptparams: localize('diagnostic.acceptparams', '\'{0}\' accepts {1} parameter(s)'),
	assignerr: localize('diagnostic.assignerr', 'This {0} \'{1}\' cannot be used as an output variable'),
	classinfuncerr: localize('diagnostic.classinfuncerr', 'Functions cannot contain classes'),
	classuseerr: localize('diagnostic.classuseerr', 'This class cannot be used as an output variable'),
	conflictserr: localize('diagnostic.conflictserr', 'This {0} \'{2}\' declaration conflicts with an existing {1}'),
	declarationerr: localize('diagnostic.declarationerr', 'Unexpected declaration'),
	defaultvalmissing: localize('diagnostic.defaultvalmissing', 'Parameter default required. Specifically: \'{0}\''),
	deprecated: localize('diagnostic.deprecated', 'Using \'{0}\' instead of \'{1}\''),
	didyoumean: localize('diagnostic.didyoumean', 'Did you mean to use \'{0}\'?'),
	dupdeclaration: localize('diagnostic.dupdeclaration', 'Duplicate declaration'),
	duplabel: localize('diagnostic.duplabel', 'Duplicate label'),
	filenotexist: localize('diagnostic.filenotexist', '\'{0}\' does not exist'),
	funccallerr: localize('diagnostic.funccallerr', 'Function calls require a space or \'(\', use comma only between parameters'),
	funccallerr2: localize('diagnostic.funccallerr2', 'In the expression, the function call requires parentheses'),
	globalconflicts: localize('diagnostic.globalconflicts', 'This global declaration conflicts with an existing {0}'),
	hotdeferr: localize('diagnostic.hotdeferr', 'Hotkeys/hotstrings cannot be defined in functions/classes'),
	hotmissbrace: localize('diagnostic.hotmissbrace', 'Hotkey or hotstring is missing its opening brace'),
	invaliddefinition: localize('diagnostic.invaliddefinition', 'Invalid {0} definition'),
	invalidencoding: localize('diagnostic.invalidencoding', '\'{0}\' invalid file encoding'),
	invalidhotdef: localize('diagnostic.invalidhotdef', 'Invalid hotkey definition'),
	invalidparam: localize('diagnostic.invalidparam', 'Invalid parameter definition'),
	invalidprop: localize('diagnostic.invalidprop', 'Invalid dynamic property'),
	invalidpropname: localize('diagnostic.invalidpropname', 'Invalid property name in object literal'),
	invalidsymbolname: localize('diagnostic.invalidsymbolname', 'Invalid symbol naming \'{0}\''),
	invalidsuper: localize('diagnostic.invalidsuper', '\'super\' is valid only inside a class'),
	invalidscope: localize('diagnostic.invalidscope', '\'{0}\' cannot be used in functions/classes'),
	maybehavenotmember: localize('diagnostic.maybehavenotmember', 'Class \'{0}\' might not have member \'{1}\''),
	maybev1: localize('diagnostic.maybev1', 'This appears be a v1 script, continue parsing?'),
	missing: localize('diagnostic.missing', 'Missing \'{0}\''),
	missingparam: localize('diagnostic.missingparam', 'Missing a required parameter'),
	missingoperand: localize('diagnostic.missingoperand', 'Missing operand'),
	missingretval: localize('diagnostic.missingretval', 'The function missing a return value'),
	missingspace: localize('diagnostic.missingspace', 'Missing space or operator before this'),
	objectliteralerr: localize('diagnostic.objectliteralerr', 'Error in object literal'),
	outofloop: localize('diagnostic.outofloop', 'Break/Continue must be enclosed by a Loop'),
	paramcounterr: localize('diagnostic.paramcounterr', 'Expected {0} parameters, but got {1}'),
	pathinvalid: localize('diagnostic.pathinvalid', 'Invalid file path'),
	propdeclaraerr: localize('diagnostic.propdeclaraerr', 'Not a valid method, class or property definition'),
	propemptyparams: localize('diagnostic.propemptyparams', 'Empty [] not permitted'),
	propnotinit: localize('diagnostic.propnotinit', 'Property declaration is not initialized'),
	requirev1: localize('diagnostic.requirev1', 'This script requires AutoHotkey v1, continue parsing?'),
	requireversion: localize('diagnostic.requireversion', 'This feature requires the AutoHotkey version >= v{0}'),
	requirevariable: localize('diagnostic.requirevariable', "'&' requires a variable"),
	reservedworderr: localize('diagnostic.reservedworderr', 'The following reserved word \'{0}\' must not be used as a variable name'),
	resourcenotfound: localize('diagnostic.resourcenotfound', 'No resource found or could not be resolved'),
	skipline: localize('diagnostic.skipline', 'The line is skipped and not resolved'),
	syntaxerror: localize('diagnostic.syntaxerror', 'Syntax error. Specifically: {0}'),
	tryswitchtov1: localize('diagnostic.tryswitchtov1', 'Try switching to AutoHotkey v1.'),
	typemaybenot: localize('diagnostic.typemaybenot', 'This param should be a \'{0}\''),
	unexpected: localize('diagnostic.unexpected', 'Unexpected \'{0}\''),
	unknown: localize('diagnostic.unknown', 'Unknown {0}'),
	unknownoperatoruse: localize('diagnostic.unknownoperatoruse', 'Unknown operator use'),
	unknowntoken: localize('diagnostic.unknowntoken', 'Unknown token \'{0}\''),
	unsupportinclude: localize('diagnostic.unsupportinclude', '#Include in functions and classes cannot correctly deduce scope and code completion'),
	unterminated: localize('diagnostic.unterminated', 'Unterminated string text'),
}

export const warn = {
	varisunset: localize('warn.varisunset', 'Variable \'{0}\' appears to never be assigned a value'),
	localsameasglobal: localize('warn.localsameasglobal', 'This local variable \'{0}\' has the same name as a global variable'),
	callwithoutparentheses: localize('warn.callwithoutparentheses', 'This function or method call has no parentheses'),
}

export const setting = {
	ahkpatherr: localize('setting.ahkpatherr', `AutoHotkey interpreter not found, check settings: AHK++.${CfgKey.InterpreterPath}`),
	getenverr: localize('setting.getenverr', 'Failed to get environment variables'),
	uialimit: localize('setting.uialimit', 'The UIA executable does not allow redirection to stdin/stdout due to security restrictions, so some features that depend on this will not work'),
	versionerr: localize('setting.versionerr', 'The current AutoHotkey.exe is not the v2 version, and cannot get the correct syntax analysis, completion and other functions'),
}

export const action = {
	switchtov1: localize('action.switchtov1', 'Switch to ahk v1'),
	skipline: localize('action.skipline', 'Skip the line'),
	stopparsing: localize('action.stopparsing', 'Stop parsing'),
}

export const response = {
	cannotrename: localize('response.cannotrename', 'The element can\'t be renamed.'),
	cannotrenamestdlib: localize('response.cannotrenamestdlib', 'Elements defined in the standard AutoHotkey library can\'t be renamed.'),
}

export function loadlocalize() {
	if (process.env.BROWSER) {
		const data = getwebfile(`${rootdir}/package.nls.<>.json`);
		if (data)
			loadedCollection = JSON.parse(data.text);
	} else {
		const s = getlocalefile(`${rootdir}/package.nls.<>.json`, 'utf8') as string;
		loadedCollection = s ? JSON.parse(s) : {};
	}
}

function localize(key: string, defValue: string) {
	return (...args: (number | string)[]) => {
		if (args.length)
			return format(getString(key, defValue), ...args as string[]);
		else
			return getString(key, defValue);
	};
}

function getString(key: string, defValue: string): string {
	return loadedCollection[key] || defValue;
}

function format(message: string, ...args: string[]): string {
	return message.replace(/\{(\d+)\}/g, (...m) => {
		const i = parseInt(m[1]);
		if (i < args.length)
			return args[i];
		return ' ';
	});
}