import assert from 'assert';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { openAndParse } from '../common';

suite('Test formattingProvider', () => {
	const dir = resolve(__dirname, '../../src/test/formatting');
	try {
		for (const file of readdirSync(dir)) {
			if (!file.endsWith('.ahk'))
				continue;
			let title = file.slice(0, -4);
			test(title, function () {
				let path = resolve(dir, file);
				const lex = openAndParse(path, false, false);
				if (!lex)
					return assert.ok(false);
				const newText = lex.beautify({ indent_string: '\t' }).replace(/\n+$/, '');
				const result = (existsSync(path = resolve(dir, title + '.txt')) ?
					readFileSync(path, { encoding: 'utf8' }) : lex.document.getText())
					.replaceAll('\r\n', '\n').replace(/\n+$/, '');
				if (newText !== result) {
					const n = newText.split('\n');
					const r = result.split('\n');
					r.forEach((t, i) => assert.strictEqual(n[i], t, `line ${i + 1}`));
				}
			});
		}
	} catch { }
});