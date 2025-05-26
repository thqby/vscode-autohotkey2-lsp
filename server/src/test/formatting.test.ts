import assert from 'assert';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { openAndParse } from '../common';

suite('Test formatting', () => {
	const dir = resolve(__dirname, '../../src/test/formatting');
	try {
		for (const file of readdirSync(dir)) {
			if (!file.endsWith('.ahk'))
				continue;
			let title = file.slice(0, -4);
			test(title, function () {
				const path = resolve(dir, file);
				const lex = openAndParse(path, false, false);
				if (!lex)
					return assert.ok(false);
				const newText = lex.beautify({ indent_string: '\t' });
				const result = (existsSync(title += '.txt') ? readFileSync(title, { encoding: 'utf8' }) : lex.document.getText()).replaceAll('\r\n', '\n');
				assert.ok(newText === result);
			});
		}
	} catch { }
});