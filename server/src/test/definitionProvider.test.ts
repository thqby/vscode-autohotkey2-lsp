import assert from 'assert';
import { readdirSync } from 'fs';
import { relative, resolve } from 'path';
import { CancellationToken } from 'vscode-languageserver';
import { defintionProvider, openAndParse, resolveImports, TokenType, URI } from '../common';

suite('Test definitionProvider', () => {
	const dir = resolve(__dirname, '../../src/test/definition');
	const token = { isCancellationRequested: false } as CancellationToken;
	try {
		for (const file of readdirSync(dir)) {
			if (!file.endsWith('.ahk'))
				continue;
			const title = file.slice(0, -4);
			test(title, async function () {
				const path = resolve(dir, file);
				const lex = openAndParse(path, false, true);
				if (!lex)
					return assert.ok(false);
				resolveImports(lex);
				const tks = Object.values(lex.tokens);
				let tk = tks.pop();
				tk?.type && tks.push(tk);
				while ((tk = tks.pop())) {
					if (tk.type !== TokenType.Comment && tk.type)
						break;
					if (!tk.content.startsWith(';@test'))
						break;
					const o = JSON.parse(tk.content.substring(6));
					const r = await defintionProvider({
						textDocument: { uri: lex.uri },
						position: { line: o.p[0], character: o.p[1] }
					}, token);
					assert.deepEqual(r?.map(v => relative(dir, URI.parse(v.targetUri).fsPath).replaceAll('\\', '/')), o.r);
				}
			});
		}
	} catch { }
});
