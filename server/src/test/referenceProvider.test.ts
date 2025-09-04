import assert from 'assert';
import { readdirSync } from 'fs';
import { resolve } from 'path';
import { getAllReferences, openAndParse, TokenType } from '../common';

suite('Test referenceProvider', () => {
	const dir = resolve(__dirname, '../../src/test/reference');
	try {
		for (const file of readdirSync(dir)) {
			if (!file.endsWith('.ahk'))
				continue;
			const title = file.slice(0, -4);
			test(title, function () {
				const path = resolve(dir, file);
				const lex = openAndParse(path, false, true);
				if (!lex)
					return assert.ok(false);
				const tks = Object.values(lex.tokens);
				let tk = tks.pop();
				tk?.type && tks.push(tk);
				while ((tk = tks.pop())) {
					if (tk.type !== TokenType.Comment && tk.type)
						break;
					if (!tk.content.startsWith(';@test'))
						break;
					const o = JSON.parse(tk.content.substring(6));
					const r = getAllReferences(lex, lex.getContext({ line: o.p[0], character: o.p[1] }))
						?.[lex.document.uri];
					assert.deepEqual(r?.map(v => Object.values(v.start)), o.r);
				}
			});
		}
	} catch { }
});