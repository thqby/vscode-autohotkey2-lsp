import { DocumentSymbol, Position, SemanticTokens, SemanticTokensDelta, SemanticTokensDeltaParams, SemanticTokensParams, SemanticTokensRangeParams, SymbolKind } from 'vscode-languageserver';
import { ClassNode, Lexer, searchNode, SemanticToken, SemanticTokenModifiers, SemanticTokenTypes } from './Lexer';
import { lexers } from './server';
import { globalsymbolcache, symbolProvider } from './symbolProvider';

let curclass: ClassNode | undefined;

export async function semanticTokensOnFull(params: SemanticTokensParams): Promise<SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], sem = doc.STB;
	sem.previousResult(''), curclass = undefined;
	await symbolProvider({ textDocument: params.textDocument });
	for (let tk of Object.values(doc.tokens)) {
		if (tk.semantic) {
			let pos = tk.pos || (tk.pos = doc.document.positionAt(tk.offset)), type = tk.semantic.type;
			if (curclass && (type === SemanticTokenTypes.method || type === SemanticTokenTypes.property) || type === SemanticTokenTypes.class)
				type = resolveSemanticType(tk.content.toLowerCase(), tk.semantic);
			sem.push(pos.line, pos.character, tk.length, type, tk.semantic.modifier || 0);
		} else if (curclass && tk.type !== 'TK_DOT' && tk.type.endsWith('COMMENT'))
			curclass = undefined;
	}
	return sem.build();
}

export async function semanticTokensOnDelta(params: SemanticTokensDeltaParams): Promise<SemanticTokensDelta | SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], sem = doc.STB;
	sem.previousResult(params.previousResultId), curclass = undefined;
	await symbolProvider({ textDocument: params.textDocument });
	for (let tk of Object.values(doc.tokens)) {
		if (tk.semantic) {
			let pos = tk.pos || (tk.pos = doc.document.positionAt(tk.offset)), type = tk.semantic.type;
			if (curclass && (type === SemanticTokenTypes.method || type === SemanticTokenTypes.property) || type === SemanticTokenTypes.class)
				type = resolveSemanticType(tk.content.toLowerCase(), tk.semantic);
			sem.push(pos.line, pos.character, tk.length, type, tk.semantic.modifier || 0);
		} else if (curclass && tk.type !== 'TK_DOT' && tk.type.endsWith('COMMENT'))
			curclass = undefined;
	}
	return sem.buildEdits();
}

export async function semanticTokensOnRange(params: SemanticTokensRangeParams): Promise<SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], sem = doc.STB;
	let start = doc.document.offsetAt(params.range.start);
	let end = doc.document.offsetAt(params.range.end);
	sem.previousResult(''), curclass = undefined;
	await symbolProvider({ textDocument: params.textDocument });
	for (let tk of Object.values(doc.tokens)) {
		if (tk.offset < start)
			continue;
		if (tk.offset > end)
			break;
		if (tk.semantic) {
			let pos = tk.pos || (tk.pos = doc.document.positionAt(tk.offset)), type = tk.semantic.type;
			if (curclass && (type === SemanticTokenTypes.method || type === SemanticTokenTypes.property) || type === SemanticTokenTypes.class)
				type = resolveSemanticType(tk.content.toLowerCase(), tk.semantic);
			sem.push(pos.line, pos.character, tk.length, type, tk.semantic.modifier || 0);
		} else if (curclass && tk.type !== 'TK_DOT' && tk.type.endsWith('COMMENT'))
			curclass = undefined;
	}
	return sem.build();
}

function resolveSemanticType(name: string, sem: SemanticToken) {
	switch (sem.type) {
		case SemanticTokenTypes.class:
			curclass = globalsymbolcache[name] as ClassNode;
			if (curclass?.kind !== SymbolKind.Class)
				curclass = undefined;
			return SemanticTokenTypes.class;
		case SemanticTokenTypes.method:
		case SemanticTokenTypes.property:
			if (curclass) {
				switch (curclass.staticdeclaration[name]?.kind) {
					case SymbolKind.Method:
						sem.modifier = (sem.modifier || 0) | 1 << SemanticTokenModifiers.readonly | 1 << SemanticTokenModifiers.static;
						return SemanticTokenTypes.method;
					case SymbolKind.Class:
						sem.modifier = (sem.modifier || 0) | 1 << SemanticTokenModifiers.readonly;
						curclass = curclass.staticdeclaration[name] as ClassNode;
						return SemanticTokenTypes.class;
					case SymbolKind.Property:
						let t = curclass.staticdeclaration[name].children;
						if (t?.length === 1 && t[0].name === 'get')
							sem.modifier = (sem.modifier || 0) | 1 << SemanticTokenModifiers.readonly | 1 << SemanticTokenModifiers.static;
						return SemanticTokenTypes.property;
				}
			}
		default:
			return sem.type;
	}
}