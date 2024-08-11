import * as assert from 'assert';
import {resolvePath} from '../extension';

suite('resolvePath', () => {
	[['', '']].forEach(([input, expected]) => {
		test(`resolvePath('${input}') === '${expected}'`, () => {
			assert.strictEqual(resolvePath(input), expected);
		});
	});
});