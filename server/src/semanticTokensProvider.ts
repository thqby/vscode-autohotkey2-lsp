import { SemanticTokens, SemanticTokensDelta, SemanticTokensDeltaParams, SemanticTokensParams, SemanticTokensRangeParams } from 'vscode-languageserver';
import { lexers } from './server';
import { symbolProvider } from './symbolProvider';

export async function semanticTokensOnFull(params: SemanticTokensParams): Promise<SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], sem = doc.STB;
	sem.previousResult('');
	await symbolProvider({ textDocument: params.textDocument });
	for (let tk of Object.values(doc.tokens)) {
		if (tk.semantic) {
			let pos = tk.pos || (tk.pos = doc.document.positionAt(tk.offset));
			sem.push(pos.line, pos.character, tk.length, tk.semantic.type, tk.semantic.modifier || 0);
		}
	}
	return sem.build();
}

export async function semanticTokensOnDelta(params: SemanticTokensDeltaParams): Promise<SemanticTokensDelta | SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], sem = doc.STB;
	sem.previousResult(params.previousResultId);
	await symbolProvider({ textDocument: params.textDocument });
	for (let tk of Object.values(doc.tokens)) {
		if (tk.semantic) {
			let pos = tk.pos || (tk.pos = doc.document.positionAt(tk.offset));
			sem.push(pos.line, pos.character, tk.length, tk.semantic.type, tk.semantic.modifier || 0);
		}
	}
	return sem.buildEdits();
}

export async function semanticTokensOnRange(params: SemanticTokensRangeParams): Promise<SemanticTokens> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], sem = doc.STB;
	let start = doc.document.offsetAt(params.range.start);
	let end = doc.document.offsetAt(params.range.end);
	sem.previousResult('');
	await symbolProvider({ textDocument: params.textDocument });
	for (let tk of Object.values(doc.tokens)) {
		if (tk.offset < start)
			continue;
		if (tk.offset > end)
			break;
		if (tk.semantic) {
			let pos = tk.pos || (tk.pos = doc.document.positionAt(tk.offset));
			sem.push(pos.line, pos.character, tk.length, tk.semantic.type, tk.semantic.modifier || 0);
		}
	}
	return sem.build();
}