import { CancellationToken, DefinitionParams, LocationLink, Range } from 'vscode-languageserver';
import { AhkSymbol, findSymbols, Lexer, lexers, resolveVarAlias, restorePath, SymbolKind, Token, TokenType, URI, Variable, ZERO_RANGE } from './common';

export async function defintionProvider(params: DefinitionParams, token: CancellationToken): Promise<LocationLink[] | undefined> {
	if (token.isCancellationRequested) return;
	let uri = params.textDocument.uri.toLowerCase(), pt;
	const lex = Lexer.curr = lexers[uri], context = lex?.getContext(params.position);
	const locas: LocationLink[] = [];
	if (!context)
		return;
	const { token: tk } = context;
	if (tk.type === TokenType.Text) {
		pt = tk.previous_token;
		if (pt?.content.match(/^#include/i)) {
			const line = params.position.line;
			let character = context.linetext.indexOf('#');
			const d = pt.data as Token, p = d?.data as string[];
			if (p) {
				character += d.offset - pt.offset;
				const rg = Range.create(0, 0, lexers[p[1]]?.document.lineCount ?? 0, 0);
				const end = character + d.content.length;
				const uri = p[0] ? URI.file(restorePath(p[0].replaceAll('`;', ';'))).toString() : p[1];
				return [LocationLink.create(uri, rg, rg, Range.create(line, character, line, end))];
			}
		}
		return;
	}
	pt = tk.previous_token;
	if (pt?.type === TokenType.Directive && !tk.topofline && pt.content.toLowerCase() === '#import' &&
		(tk.type === TokenType.Identifier || tk.type === TokenType.String)) {
		const v = tk.value as string ?? tk.content;
		let mod, has_default;
		mod = lex.import?.mod?.[v.toUpperCase()];
		if (mod) {
			const rg: Range = {
				start: lex.document.positionAt(tk.offset),
				end: lex.document.positionAt(tk.offset + tk.length)
			};
			let mods = (mod = mod.modules ?? [mod]).filter(t => t.name);
			if (!mods.length)
				mods = [mod[0]];
			for (mod of mods) {
				has_default ||= !!mod.export?.[''];
				locas.push(LocationLink.create(
					((mod as Lexer).document ?? lexers[mod.uri!]?.document ?? mod).uri!,
					mod.range, mod.selectionRange, rg));
			}
		}
		if (tk.type === TokenType.String)
			return locas;
		if (has_default)
			locas.length = 0;
	}
	if (context.kind === SymbolKind.Null)
		return;
	const set: AhkSymbol[] = [];
	findSymbols(lex, context)?.forEach(it => {
		let { node, uri } = it;
		if ((node as Variable).from !== undefined)
			node = resolveVarAlias(node as Variable), uri = node.uri!;
		if (!set.includes(node) && set.push(node) && node.selectionRange !== ZERO_RANGE && uri)
			locas.push(LocationLink.create(lexers[uri].document.uri, node.range, node.selectionRange));
	});
	return locas;
}