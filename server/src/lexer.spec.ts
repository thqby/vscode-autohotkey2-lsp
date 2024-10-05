import { suite, test } from 'mocha';
import * as assert from 'assert';
import { updateCommentTagRegex } from './lexer';

suite('updateCommentTagRegex', () => {
	test('should update the comment tag regex', () => {
		const newRegex = '^;;;\\s*(.*)';
		assert.deepStrictEqual(
			updateCommentTagRegex(newRegex),
			new RegExp(newRegex, 'i'),
		);
	});
});
