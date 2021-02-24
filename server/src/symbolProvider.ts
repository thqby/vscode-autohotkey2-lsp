import { DocumentSymbol, DocumentSymbolParams, Range, SymbolInformation, SymbolKind } from 'vscode-languageserver';
import { ClassNode, FuncNode, FuncScope } from './Lexer';
import { lexers, symbolcache } from './server';

export async function symbolProvider(params: DocumentSymbolParams): Promise<SymbolInformation[]> {
	let uri = params.textDocument.uri.toLowerCase(), doc = lexers[uri];
	if (!doc || (!doc.reflat && symbolcache.uri === uri)) return symbolcache.sym;
	let tree = <DocumentSymbol[]>doc.symboltree, superglobal: { [key: string]: DocumentSymbol } = {}, gvar: any = {}, glo = doc.global;
	for (const key of ['any', 'array', 'boundfunc', 'buffer', 'class', 'clipboardall', 'closure', 'enumerator', 'error', 'file', 'float', 'func', 'gui', 'indexerror', 'inputhook', 'integer', 'keyerror', 'map', 'membererror', 'memoryerror', 'menu', 'menubar', 'methoderror', 'number', 'object', 'oserror', 'primitive', 'propertyerror', 'regexmatch', 'string', 'targeterror', 'timeouterror', 'typeerror', 'valueerror', 'zerodivisionerror'])
		gvar[key] = superglobal[key] = DocumentSymbol.create(key, undefined, SymbolKind.Class, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0));
	for (const key in glo) {
		superglobal[key] = glo[key];
		if (glo[key].kind === SymbolKind.Class)
			gvar[key] = glo[key];
	}
	let list = doc.relevance;
	for (const uri in list) {
		const gg = lexers[uri].global;
		for (let key in gg) {
			superglobal[key] = superglobal[key] || gg[key];
			if (gg[key].kind === SymbolKind.Class && !glo[key])
				gvar[key] = gg[key];
		}
	}
	symbolcache.uri = uri, doc.reflat = false;
	return symbolcache.sym = (lexers[uri].flattreecache = flatTree(tree, gvar)).map(info => {
		return SymbolInformation.create(info.name, info.kind, info.children ? info.range : info.selectionRange, uri,
			info.kind === SymbolKind.Class && (<ClassNode>info).extends ? (<ClassNode>info).extends : undefined);
	});

	function flatTree(tree: DocumentSymbol[], vars: { [key: string]: DocumentSymbol } = {}, global = false): DocumentSymbol[] {
		const result: DocumentSymbol[] = [], t: DocumentSymbol[] = [];
		tree.map(info => {
			if (info.kind === SymbolKind.Variable) {
				let nm_l = info.name.toLowerCase();
				if (!vars[nm_l]) {
					vars[nm_l] = info;
					if (!global)
						result.push(info);
				}
			} else if (info.children)
				t.push(info);
			else result.push(info);
		});
		t.map(info => {
			result.push(info);
			if (info.children) {
				let inherit: { [key: string]: DocumentSymbol } = {}, gg = false;
				if (info.kind === SymbolKind.Function || info.kind === SymbolKind.Method) {
					let s = (<FuncNode>info).statement;
					// if (vars['#parent'])
					// 	(<FuncNode>info).parent = vars['#parent'];
					for (const k in s.global)
						inherit[k] = s.global[k];
					for (const k in s.local)
						inherit[k] = s.local[k], result.push(inherit[k]);
					(<FuncNode>info).params?.map(it => {
						inherit[it.name.toLowerCase()] = it
					});
					if (s && s.assume === FuncScope.GLOBAL) {
						gg = true;
						for (const k in superglobal)
							if (!inherit[k])
								inherit[k] = superglobal[k];
					} else if (s && (s.assume & FuncScope.LOCAL)) {
						// for (const k in vars) if (!inherit[k]) inherit[k] = vars[k];
					} else {
						gg = global;
						for (const k in superglobal)
							if (!inherit[k])
								inherit[k] = superglobal[k];
						if (vars['#parent'])
							for (const k in vars)
								if (!inherit[k])
									inherit[k] = vars[k];
					}
					inherit['#parent'] = info;
				} else if (info.kind === SymbolKind.Class) {
					inherit['#parent'] = info;
					inherit['this'] = DocumentSymbol.create('this', undefined, SymbolKind.Variable, Range.create(0, 0, 0, 0), Range.create(0, 0, 0, 0));
				}
				result.push(...flatTree(info.children, inherit, gg));
			}
		});
		return result;
	}
}