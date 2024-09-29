import * as assert from 'assert';
import { suite, test } from 'mocha';
import { resolvePath } from './utils';

suite('resolvePath', () => {
	test('empty string', () => {
		assert.strictEqual(resolvePath(''), '');
	});
});
