import { DocumentSymbol, Location, Range, ReferenceParams, SymbolKind } from 'vscode-languageserver';
import { ClassNode, Lexer, FuncScope, FuncNode, searchNode } from './Lexer';
import { Maybe, lexers } from './server';

export async function referenceProvider(params: ReferenceParams): Promise<Location[]> {
	let result: any = [], doc = lexers[params.textDocument.uri.toLowerCase()];
	let refs = getAllReferences(doc, doc.buildContext(params.position));
	for (const uri in refs)
		result.push(...refs[uri].map(range => { return { uri, range } }));
	return result;
}

export function getAllReferences(doc: Lexer, context: any): Maybe<{ [uri: string]: Range[] }> {
	let cls = '', name = context.text.toLowerCase(), references: { [uri: string]: Range[] } = {};
	if (!context.text) return undefined;
	let nodes = searchNode(doc, name, context.range.end, context.kind === SymbolKind.Variable ?
		[SymbolKind.Class, SymbolKind.Variable] : context.kind);
	if (!nodes)
		return undefined;
	let scope = doc.searchScopedNode(nodes[0].node.selectionRange.start), docs: Lexer[];
	switch (context.kind) {
		case SymbolKind.Variable:
			if (scope) {
				if (scope.kind === SymbolKind.Class) {
					if ((<ClassNode>scope).parent) {
						while ((<ClassNode>scope).parent) {
							cls = '.' + scope?.name + cls;
							scope = (<ClassNode>scope).parent;
						}
						cls = scope?.name + cls;
					} else
						scope = undefined;
				} else if (scope.kind === SymbolKind.Function || scope.kind === SymbolKind.Method) {
					if ((<FuncNode>scope).statement.assume === FuncScope.GLOBAL)
						scope = undefined;
					else for (const it in (<FuncNode>scope).statement.global)
						if (it === name) {
							scope = undefined;
							break;
						}
					if (scope) {
						let rgs: Range[] = [];
						findAllVar(scope as FuncNode, name, false, rgs, 1);
						if (rgs.length)
							references[nodes[0].uri] = rgs;
					}
				} else
					return undefined;
			}
			if (scope) {

			} else {
				docs = [doc];
				for (const u in doc.relevance)
					docs.push(lexers[u]);
				docs.map(doc => {
					let rgs = findAllFromDoc(doc, name, SymbolKind.Variable);
					if (rgs.length)
						references[doc.uri] = rgs;
				});
			}
			break;
		case SymbolKind.Function:
			if (!(<any>scope)?.parent) {
				docs = [];
				for (const u in doc.relevance)
					docs.push(lexers[u]);
				docs.map(doc => {
					let rgs = findAllFromDoc(doc, name, SymbolKind.Function);
					if (rgs.length)
						references[doc.uri] = rgs;
				});
			}
			references[doc.uri] = findAllFromDoc(doc, name, SymbolKind.Function, (<any>scope)?.parent);
			if (!references[nodes[0].uri])
				references[nodes[0].uri] = [];
			references[nodes[0].uri].push(nodes[0].node.selectionRange);
			break;
		case SymbolKind.Method:
			break;
		default:
			return undefined;
	}
	if (Object.keys(references).length)
		return references;
}

export function findAllFromDoc(doc: Lexer, name: string, kind: SymbolKind, scope?: DocumentSymbol) {
	let ranges: Range[] = [];
	if (kind === SymbolKind.Function) {
		findAllFunc(scope || { children: doc.symboltree, funccall: doc.funccall }, name, ranges);
	} else if (kind === SymbolKind.Method) {

	} else if (kind === SymbolKind.Variable) {
		doc.symboltree.map(it => {
			if (it.name.toLowerCase() === name && (it.kind === SymbolKind.Variable || it.kind === SymbolKind.Class))
				ranges.push(it.selectionRange);
		});
		let global = doc.global[name] ? true : false;
		for (const t in doc.function)
			findAllVar(doc.function[t], name, global, ranges);
		for (const t in doc.object.method)
			doc.object.method[t].map(func => findAllVar(func, name, global, ranges));
	}
	return ranges;
}

export function findAllVar(node: FuncNode, name: string, global: boolean = false, ranges: Range[], layer = 0) {
	let def = false, glo = false, islocal = true;
	for (const it of node.params)
		if (it.name.toLowerCase() === name) {
			def = true;
			if (layer === 1)
				ranges.push(it.selectionRange);
			else if (layer > 1)
				return;
			break;
		}
	for (const it in node.statement.local)
		if (it === name) {
			def = true;
			break;
		}
	if (node.statement.assume & FuncScope.LOCAL)
		def = true;
	if (node.statement.assume === FuncScope.GLOBAL)
		glo = true;
	else for (const it in node.statement.global)
		if (it === name) {
			glo = true;
			break;
		}
	if (layer > 1 && (def || glo))
		return;
	if (glo || (global && !def))
		islocal = false;
	if (islocal) {
		node.children?.map(it => {
			if (it.kind === SymbolKind.Function) {
				findAllVar(it as FuncNode, name, false, ranges, layer ? layer + 1 : 0);
			} else if (layer && it.kind === SymbolKind.Variable && name === it.name.toLowerCase())
				ranges.push(it.selectionRange);
		})
	} else {
		node.children?.map(it => {
			if (it.kind === SymbolKind.Function)
				findAllVar(it as FuncNode, name, global || glo, ranges, layer);
			else if (it.kind === SymbolKind.Variable && name === it.name.toLowerCase())
				ranges.push(it.selectionRange);
		});
	}
}

function findAllFunc(node: { children?: DocumentSymbol[], funccall?: DocumentSymbol[] }, name: string, ranges: Range[], check = false) {
	if (check && node.children)
		for (const it of node.children)
			if (it.kind === SymbolKind.Function && it.name.toLowerCase() === name)
				return;
	node.children?.map(it => {
		if (it.children)
			findAllFunc(it as FuncNode, name, ranges, true);
	});
	node.funccall?.map(it => {
		if (it.kind === SymbolKind.Function && it.name.toLowerCase() === name)
			ranges.push(it.selectionRange);
	});
}