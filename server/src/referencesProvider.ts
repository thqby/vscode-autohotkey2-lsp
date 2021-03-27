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
	let nodes = searchNode(doc, name, context.range.end, context.kind);
	if (!nodes || nodes.length > 1)
		return undefined;
	let { node, uri } = nodes[0];
	let scope = doc.searchScopedNode(node.selectionRange.start), docs: Lexer[];
	switch (node.kind) {
		case SymbolKind.Function:
		case SymbolKind.Variable:
		case SymbolKind.Class:
			if (scope) {
				if (scope.kind === SymbolKind.Class || scope.kind === SymbolKind.Function || scope.kind === SymbolKind.Method || scope.kind === SymbolKind.Event) {
					if ((<FuncNode>scope).global && (<FuncNode>scope).global[name])
						scope = undefined;
				}
			}
			doc = lexers[uri];
			let rgs = findAllFromDoc(doc, name, SymbolKind.Variable, scope);
			if (rgs.length)
				references[uri] = rgs;
			if (!scope) {
				for (const uri in doc.relevance) {
					let rgs = findAllFromDoc(lexers[uri], name, SymbolKind.Variable, undefined);
					if (rgs.length)
						references[uri] = rgs;
				}
			}
			break;
		case SymbolKind.Field:

			break;
		default:
			return undefined;
	}
	if (Object.keys(references).length)
		return references;
}

export function findAllFromDoc(doc: Lexer, name: string, kind: SymbolKind, scope?: DocumentSymbol) {
	let ranges: Range[] = [];
	if (kind === SymbolKind.Method || kind === SymbolKind.Property) {

	} else {
		if (scope) {
			findAllVar(scope as FuncNode, name, false, ranges);
		} else {
			doc.children.map(it => {
				if (it.name.toLowerCase() === name)
					ranges.push(it.selectionRange);
				if (it.children)
					findAllVar(it as FuncNode, name, true, ranges);
			});
			doc.funccall.map(it => {
				if (it.kind === SymbolKind.Function && it.name.toLowerCase() === name)
					ranges.push(it.selectionRange);
			});
		}
	}
	return ranges;
}

export function findAllVar(node: FuncNode, name: string, global: boolean = false, ranges: Range[]) {
	if (global !== !!(node.declaration && node.declaration[name])) {
		node.children?.map(it => {
			if (it.name.toLowerCase() === name && (it.kind !== SymbolKind.Property && it.kind !== SymbolKind.Method && it.kind !== SymbolKind.Class))
				ranges.push(it.selectionRange);
			if (it.children)
				findAllVar(it as FuncNode, name, global, ranges);
		});
		node.funccall?.map(it => {
			if (it.kind === SymbolKind.Function && it.name.toLowerCase() === name)
				ranges.push(it.selectionRange);
		});
	} else
		node.children?.map(it => {
			if (it.children)
				findAllVar(it as FuncNode, name, global, ranges);
		});
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