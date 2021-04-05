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
	if (!uri)
		return undefined;
	let scope = node === doc.declaration[name] ? undefined : doc.searchScopedNode(node.selectionRange.start);
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
			if (scope) {
				let lbs = (<FuncNode>scope).labels;
				if (lbs && lbs[name])
					references[uri] = lbs[name].map(it => it.selectionRange);
			} else {
				let lbs = doc.labels;
				if (lbs[name])
					references[uri] = lbs[name].map(it => it.selectionRange);
				for (const uri in doc.relevance) {
					lbs = lexers[uri].labels;
					if (lbs[name])
						references[uri] = lbs[name].map(it => it.selectionRange);
				}
			}
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
		let node = scope ? scope as FuncNode : doc, gg = !scope, c: boolean | undefined = gg;
		if (!c) {
			let local = (<FuncNode>node).local, dec = (<FuncNode>node).declaration;
			if (!((local && local[name]) || (dec && dec[name])))
				c = undefined;
		}
		node.children?.map(it => {
			if (it.name.toLowerCase() === name)
				ranges.push(it.selectionRange);
			if (it.children)
				findAllVar(it as FuncNode, name, gg, ranges, gg || it.kind === SymbolKind.Function ? c : undefined);
		});
		node.funccall?.map(it => {
			if (it.kind === SymbolKind.Function && it.name.toLowerCase() === name)
				ranges.push(it.selectionRange);
		});
	}
	return ranges;
}

export function findAllVar(node: FuncNode, name: string, global: boolean = false, ranges: Range[], closure?: boolean) {
	if (node.local && node.local[name]) {
		if (!global)
			return;
		closure = false;
	} else if (node.assume === FuncScope.GLOBAL || (node.global && node.global[name])) {
		if (!global)
			return;
		closure = true;
	}
	if (closure === global) {
		node.children?.map(it => {
			if (it.name.toLowerCase() === name && (it.kind !== SymbolKind.Property && it.kind !== SymbolKind.Method && it.kind !== SymbolKind.Class))
				ranges.push(it.selectionRange);
			if (it.children)
				findAllVar(it as FuncNode, name, global, ranges, it.kind === SymbolKind.Function ? closure : global || undefined);
		});
		node.funccall?.map(it => {
			if (it.kind === SymbolKind.Function && it.name.toLowerCase() === name)
				ranges.push(it.selectionRange);
		});
	} else {
		node.children?.map(it => {
			if (it.children)
				findAllVar(it as FuncNode, name, global, ranges, global ? false : undefined);
		});
		if (!global)
			node.funccall?.map(it => {
				if (it.kind === SymbolKind.Function && it.name.toLowerCase() === name)
					ranges.push(it.selectionRange);
			});
	}
}