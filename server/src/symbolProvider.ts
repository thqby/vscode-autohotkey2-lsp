import { DiagnosticSeverity, DocumentSymbol, DocumentSymbolParams, Range, SymbolInformation, SymbolKind } from 'vscode-languageserver';
import { checksamenameerr, ClassNode, FuncNode, FuncScope, Lexer, SemanticToken, SemanticTokenModifiers, SemanticTokenTypes, Token, Variable } from './Lexer';
import { diagnostic } from './localize';
import { ahkvars, lexers, sendDiagnostics, symbolcache } from './server';

export let globalsymbolcache: { [name: string]: DocumentSymbol } = {};

export async function symbolProvider(params: DocumentSymbolParams): Promise<SymbolInformation[]> {
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri];
	if (!doc || (!doc.reflat && symbolcache[uri])) return symbolcache[uri];
	let tree = <DocumentSymbol[]>doc.children, gvar: any = {}, glo = doc.declaration;
	for (const key in ahkvars)
		gvar[key] = ahkvars[key];
	let list = doc.relevance;
	for (const uri in list) {
		const gg = lexers[uri]?.declaration;
		for (let key in gg)
			if (!gvar[key] || gg[key].kind !== SymbolKind.Variable)
				gvar[key] = gg[key];
	}
	for (const key in glo) {
		if (!gvar[key] || gvar[key].kind === SymbolKind.Variable)
			gvar[key] = glo[key];
	}
	doc.reflat = false, globalsymbolcache = gvar;
	symbolcache[uri] = flatTree(tree).map(info => {
		return SymbolInformation.create(info.name, info.kind, info.children ? info.range : info.selectionRange, uri,
			info.kind === SymbolKind.Class && (<ClassNode>info).extends ? (<ClassNode>info).extends : undefined);
	});
	checksamename(doc), sendDiagnostics();
	return symbolcache[uri];

	function flatTree(tree: DocumentSymbol[], vars: { [key: string]: DocumentSymbol } = {}, global = false): DocumentSymbol[] {
		const result: DocumentSymbol[] = [], t: DocumentSymbol[] = [], p: { [name: string]: DocumentSymbol } = {};
		tree.map(info => {
			if (info.children)
				t.push(info);
			if (info.kind === SymbolKind.Function || info.kind === SymbolKind.Variable || info.kind === SymbolKind.Class) {
				let _l = info.name.toLowerCase();
				if (!vars[_l]) {
					if (info.kind === SymbolKind.Variable && !(<Variable>info).def && gvar[_l]) {
						vars[_l] = gvar[_l];
						if (info === gvar[_l])
							result.push(info), converttype(info);
						else converttype(info, gvar[_l] === ahkvars[_l], gvar[_l].kind);
					} else {
						vars[_l] = info, result.push(info);
						converttype(info, ahkvars[_l] && gvar[_l] === ahkvars[_l], gvar[_l]?.kind);
					}
				} else if (info.kind === SymbolKind.Variable) {
					if (info !== vars[_l] && (vars[_l].kind !== SymbolKind.TypeParameter || vars[_l].selectionRange.start.character !== vars[_l].selectionRange.end.character))
						converttype(info, vars[_l] === ahkvars[_l], vars[_l].kind);
				} else if (info !== vars[_l])
					result.push(info), vars[_l] = info, converttype(info, info === ahkvars[_l]);
				else if (info === gvar[_l])
					result.push(info), converttype(info, info === ahkvars[_l]);
			} else
				result.push(info);
		});
		t.map(info => {
			if (info.children) {
				let inherit: { [key: string]: DocumentSymbol } = {}, gg = false;
				if (info.kind === SymbolKind.Function || info.kind === SymbolKind.Method || info.kind === SymbolKind.Event) {
					let p = info as FuncNode, ps: any = {}, ll = '';
					for (const k in p.global)
						inherit[k] = p.global[k];
					(<FuncNode>info).params?.map(it => {
						inherit[ll = it.name.toLowerCase()] = it, ps[ll] = true, converttype(it, false, SymbolKind.TypeParameter);
					});
					for (const k in p.local)
						if (!ps[k])
							inherit[k] = p.local[k], result.push(inherit[k]), converttype(inherit[k]);
					if (p.assume === FuncScope.GLOBAL || global) {
						gg = true;
					} else {
						gg = false;
						let kk = (<FuncNode>info).parent, tt = p.declaration;
						if (kk) {
							if (kk.kind === SymbolKind.Class) {
								let rg = Range.create(0, 0, 0, 0);
								inherit['this'] = DocumentSymbol.create('this', undefined, SymbolKind.Variable, rg, rg);
								if ((<ClassNode>kk).extends)
									inherit['super'] = DocumentSymbol.create('super', undefined, SymbolKind.Variable, rg, rg);
							} else if (kk.kind === SymbolKind.Function || kk.kind === SymbolKind.Method || kk.kind === SymbolKind.Event)
								for (const k in vars)
									if (!inherit[k])
										inherit[k] = vars[k];
						}
						for (const k in tt)
							if (!inherit[k]) {
								inherit[k] = tt[k], result.push(inherit[k]), converttype(tt[k]);
							} else if (tt[k] !== inherit[k]) {
								if (tt[k].kind !== SymbolKind.Variable || (inherit[k] === gvar[k] && (<Variable>tt[k]).def))
									inherit[k] = tt[k], result.push(tt[k]), converttype(tt[k]);
								else converttype(tt[k], false, inherit[k].kind);
							} else if (!ps[k]) converttype(tt[k]);
					}
				}
				result.push(...flatTree(info.children, inherit, gg));
			}
		});
		return result;
	}
	function checksamename(doc: Lexer) {
		let dec: any = {}, dd: Lexer, lbs: any = {};
		if (doc.d)
			return;
		Object.keys(doc.labels).map(lb => lbs[lb] = true);
		for (const k in ahkvars) {
			let t = ahkvars[k];
			dec[k] = t;
			if (t.kind === SymbolKind.Function || t.name.toLowerCase() === 'struct')
				(<Variable>t).def = false;
		}
		for (const uri in doc.relevance) {
			if (dd = lexers[uri]) {
				dd.diagnostics.splice(dd.diags);
				checksamenameerr(dec, Object.values(dd.declaration).filter(it => it.kind !== SymbolKind.Variable), dd.diagnostics);
				for (const lb in dd.labels)
					if ((<any>dd.labels[lb][0]).def)
						if (lbs[lb])
							dd.diagnostics.push({ message: diagnostic.duplabel(), range: dd.labels[lb][0].selectionRange, severity: 1 });
						else lbs[lb] = true;
			}
		}
		let t = Object.values(doc.declaration);
		checksamenameerr(dec, t, doc.diagnostics);
		for (const uri in doc.relevance) {
			if (dd = lexers[uri])
				checksamenameerr(dec, Object.values(dd.declaration).filter(it => it.kind === SymbolKind.Variable), dd.diagnostics);
		}
		t.map(it => {
			if (it.kind === SymbolKind.Class && !checkextendsclassexist((<ClassNode>it).extends))
				err_not_exist(doc, <ClassNode>it);
		});
		for (const uri in doc.relevance) {
			if (dd = lexers[uri])
				for (const it of Object.values(dd.declaration))
					if (it.kind === SymbolKind.Class && !checkextendsclassexist((<ClassNode>it).extends))
						err_not_exist(dd, <ClassNode>it);
		}

		function checkextendsclassexist(name: string) {
			if (!name)
				return true;
			let n = name.toLowerCase().split('.'), l = n.length, c: ClassNode | undefined;
			for (let i = 0; i < l; i++) {
				c = c ? c.staticdeclaration[n[i]] : dec[n[i]];
				if (!c || c.kind !== SymbolKind.Class || (<any>c).def === false)
					return false;
			}
			return true;
		}
		function err_not_exist(doc: Lexer, it: ClassNode) {
			let o = doc.document.offsetAt(it.selectionRange.end) + 1, tk: Token;
			tk = doc.get_tokon(o);
			while (tk.type !== 'TK_WORD')
				tk = doc.get_tokon(o = tk.offset + tk.length);
			o = tk.offset;
			let rg: Range = { start: doc.document.positionAt(o), end: doc.document.positionAt(o + it.extends.length) };
			doc.diagnostics.push({ message: diagnostic.unknown("class '" + it.extends) + "'", range: rg, severity: DiagnosticSeverity.Error });
		}
	}
	function converttype(it: DocumentSymbol, islib: boolean = false, kind?: number) {
		let tk: Token, stk: SemanticToken | undefined, st: SemanticTokenTypes | undefined;
		switch (kind || it.kind) {
			case SymbolKind.TypeParameter:
				if (it.range.start.line === 0 && it.range.start.character === 0)
					return;
				st = SemanticTokenTypes.parameter; break;
			case SymbolKind.Variable:
				st = SemanticTokenTypes.variable; break;
			case SymbolKind.Class:
				st = SemanticTokenTypes.class; break;
			case SymbolKind.Function:
				st = SemanticTokenTypes.function; break;
		}
		if (st !== undefined && (tk = doc.tokens[doc.document.offsetAt(it.selectionRange.start)])) {
			if ((stk = tk.semantic) === undefined)
				tk.semantic = stk = { type: st };
			else if (kind !== undefined)
				stk.type = st;
			if (st < 3)
				stk.modifier = (stk.modifier || 0) | (1 << SemanticTokenModifiers.readonly) | (islib ? 1 << SemanticTokenModifiers.defaultLibrary : 0);
		}
	}
}