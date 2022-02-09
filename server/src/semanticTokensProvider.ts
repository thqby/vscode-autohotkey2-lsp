import { DocumentSymbol, SemanticTokens, SemanticTokensDelta, SemanticTokensDeltaParams, SemanticTokensParams, SemanticTokensRangeParams, SymbolKind } from 'vscode-languageserver';
import { ClassNode, FuncNode, getClassMembers, Lexer, SemanticToken, SemanticTokenModifiers, SemanticTokenTypes, Token } from './Lexer';
import { lexers } from './common';
import { checkParams, globalsymbolcache, symbolProvider } from './symbolProvider';

let curclass: ClassNode | undefined;
let memscache = new Map<ClassNode, { [name: string]: DocumentSymbol }>();

export async function semanticTokensOnFull(params: SemanticTokensParams): Promise<SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], sem = doc.STB;
	sem.previousResult(''), curclass = undefined, memscache.clear();
	await symbolProvider({ textDocument: params.textDocument });
	for (let tk of Object.values(doc.tokens)) {
		if (tk.semantic) {
			let pos = tk.pos || (tk.pos = doc.document.positionAt(tk.offset)), type = tk.semantic.type;
			if (curclass && (type === SemanticTokenTypes.method || type === SemanticTokenTypes.property) || type === SemanticTokenTypes.class)
				type = resolveSemanticType(tk.content.toLowerCase(), tk, doc);
			sem.push(pos.line, pos.character, tk.length, type, tk.semantic.modifier || 0);
		} else if (curclass && tk.type !== 'TK_DOT' && !tk.type.endsWith('COMMENT'))
			curclass = undefined;
	}
	memscache.clear();
	return sem.build();
}

export async function semanticTokensOnDelta(params: SemanticTokensDeltaParams): Promise<SemanticTokensDelta | SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], sem = doc.STB;
	sem.previousResult(''), curclass = undefined, memscache.clear();
	await symbolProvider({ textDocument: params.textDocument });
	for (let tk of Object.values(doc.tokens)) {
		if (tk.semantic) {
			let pos = tk.pos || (tk.pos = doc.document.positionAt(tk.offset)), type = tk.semantic.type;
			if (curclass && (type === SemanticTokenTypes.method || type === SemanticTokenTypes.property) || type === SemanticTokenTypes.class)
				type = resolveSemanticType(tk.content.toLowerCase(), tk, doc);
			sem.push(pos.line, pos.character, tk.length, type, tk.semantic.modifier || 0);
		} else if (curclass && tk.type !== 'TK_DOT' && !tk.type.endsWith('COMMENT'))
			curclass = undefined;
	}
	memscache.clear();
	return sem.buildEdits();
}

export async function semanticTokensOnRange(params: SemanticTokensRangeParams): Promise<SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], sem = doc.STB;
	let start = doc.document.offsetAt(params.range.start), end = doc.document.offsetAt(params.range.end);
	sem.previousResult(''), curclass = undefined, memscache.clear();
	await symbolProvider({ textDocument: params.textDocument });
	for (let tk of Object.values(doc.tokens)) {
		if (tk.offset < start)
			continue;
		if (tk.offset > end)
			break;
		if (tk.semantic) {
			let pos = tk.pos || (tk.pos = doc.document.positionAt(tk.offset)), type = tk.semantic.type;
			if (curclass && (type === SemanticTokenTypes.method || type === SemanticTokenTypes.property) || type === SemanticTokenTypes.class)
				type = resolveSemanticType(tk.content.toLowerCase(), tk, doc);
			sem.push(pos.line, pos.character, tk.length, type, tk.semantic.modifier || 0);
		} else if (curclass && tk.type !== 'TK_DOT' && !tk.type.endsWith('COMMENT'))
			curclass = undefined;
	}
	memscache.clear();
	return sem.build();
}

function resolveSemanticType(name: string, tk: Token, doc: Lexer) {
	let sem = tk.semantic as SemanticToken;
	switch (sem.type) {
		case SemanticTokenTypes.class:
			curclass = globalsymbolcache[name] as ClassNode;
			if (curclass?.kind !== SymbolKind.Class)
				curclass = undefined;
			return SemanticTokenTypes.class;
		case SemanticTokenTypes.method:
		case SemanticTokenTypes.property:
			if (curclass) {
				let n = curclass.staticdeclaration[name], kind = n?.kind, temp: { [name: string]: DocumentSymbol };
				if (!n) {
					let t = (memscache.get(curclass) ?? (memscache.set(curclass, temp = getClassMembers(doc, curclass, true)), temp))[name];
					if (t) n = t, kind = t.kind;
				}
				switch (kind) {
					case SymbolKind.Method:
						sem.modifier = (sem.modifier || 0) | 1 << SemanticTokenModifiers.readonly | 1 << SemanticTokenModifiers.static;
						if (tk.callinfo) checkParams(doc, n as FuncNode, tk.callinfo);
						return sem.type = SemanticTokenTypes.method;
					case SymbolKind.Class:
						sem.modifier = (sem.modifier || 0) | 1 << SemanticTokenModifiers.readonly;
						curclass = curclass.staticdeclaration[name] as ClassNode;
						if (tk.callinfo) checkParams(doc, curclass as unknown as FuncNode, tk.callinfo);
						return sem.type = SemanticTokenTypes.class;
					case SymbolKind.Property:
						let t = n.children;
						if (t?.length === 1 && t[0].name === 'get')
							sem.modifier = (sem.modifier || 0) | 1 << SemanticTokenModifiers.readonly | 1 << SemanticTokenModifiers.static;
						return sem.type = SemanticTokenTypes.property;
				}
			}
		default:
			return sem.type;
	}
}