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

	test('invalid regex', () => {
		const newRegex = '^;;;\\s*(.*)';
		let regex = updateCommentTagRegex(newRegex);
		assert.throws(() => (regex = updateCommentTagRegex('[')));
		// doesn't update the regex
		assert.deepStrictEqual(regex, new RegExp(newRegex, 'i'));
	});
});
