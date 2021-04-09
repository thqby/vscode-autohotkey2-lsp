import { DiagnosticSeverity, DocumentSymbol, DocumentSymbolParams, Range, SymbolInformation, SymbolKind } from 'vscode-languageserver';
import { checksamenameerr, ClassNode, FuncNode, FuncScope, Lexer, samenameerr, Variable } from './Lexer';
import { diagnostic } from './localize';
import { ahkvars, lexers, sendDiagnostics, symbolcache } from './server';

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
	doc.reflat = false;
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
			if ((<SymbolKind[]>[SymbolKind.Variable, SymbolKind.Function, SymbolKind.Class]).includes(info.kind)) {
				let _l = info.name.toLowerCase();
				if (!vars[_l]) {
					if (info.kind === SymbolKind.Variable && !(<Variable>info).def && gvar[_l]) {
						vars[_l] = gvar[_l];
					} else
						vars[_l] = info, result.push(info);
				} else if (info.kind === SymbolKind.Variable) {
					let kind = vars[_l].kind
					if ((<Variable>info).def && (kind === SymbolKind.Function || kind === SymbolKind.Class || kind === SymbolKind.Method)) {
						doc.diagnostics.push({ message: samenameerr(vars[_l], info), range: info.selectionRange, severity: DiagnosticSeverity.Error });
					}
				} else if (info !== vars[_l])
					result.push(info), vars[_l] = info;
				else if (info === gvar[_l])
					result.push(info);
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
						inherit[ll = it.name.toLowerCase()] = it, ps[ll] = true;
					});
					for (const k in p.local)
						if (!ps[k])
							inherit[k] = p.local[k], result.push(inherit[k]);
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
								inherit[k] = tt[k], result.push(inherit[k]);
							} else if (tt[k] !== inherit[k]) {
								if (tt[k].kind !== SymbolKind.Variable || (inherit[k] === gvar[k] && (<Variable>tt[k]).def))
									inherit[k] = tt[k], result.push(tt[k]);
							}
					}
				}
				result.push(...flatTree(info.children, inherit, gg));
			}
		});
		return result;
	}
	function checksamename(doc: Lexer) {
		let dec: any = {}, dd: Lexer, lbs: any = {};
		Object.keys(doc.labels).map(lb => lbs[lb] = true);
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
		checksamenameerr(dec, Object.values(doc.declaration), doc.diagnostics);
		for (const uri in doc.relevance) {
			if (dd = lexers[uri])
				checksamenameerr(dec, Object.values(dd.declaration).filter(it => it.kind === SymbolKind.Variable), dd.diagnostics);
		}
	}
}