import { suite, test } from 'mocha';
import * as assert from 'assert';
import {
	applyFormatDirective,
	Flag,
	parseFormatDirective,
	updateCommentTagRegex,
} from './lexer';

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

suite('parseFormatDirective', () => {
	const tests: [
		name: string,
		directive: string,
		expected: Record<string, string>,
	][] = [
		['empty directive', '', {}],
		['one directive', ';@format key:value', { key: 'value' }],
		[
			'two directives',
			';@format key1: value1, key2: value2',
			{ key1: 'value1', key2: 'value2' },
		],
		['extra whitespace', ';  @format  key:  value  ', { key: 'value' }],
	];

	tests.forEach(([name, directive, expected]) => {
		test(name, () => {
			assert.deepStrictEqual(parseFormatDirective(directive), expected);
		});
	});
});

suite('Lexer', () => {
	suite('applyFormatDirective', () => {
		const tests: [
			name: string,
			directive: string,
			expectedFlag: Partial<Flag>,
			expectedFormatOptions: Record<string, string>,
		][] = [
			[
				'generic directive',
				';@format key1: value1, key2: value2',
				{},
				{ key1: 'value1', key2: 'value2' },
			],
			[
				'uses flags only',
				';@format array_style: expand, object_style: expand',
				{ array_style: 1, object_style: 1 },
				{},
			],
		];

		tests.forEach(([name, directive, expectedFlag, expectedFormatOptions]) => {
			test(name, () => {
				const flag = {};
				const opt = {};
				applyFormatDirective(directive, flag, opt);
				assert.deepStrictEqual(flag, expectedFlag);
				assert.deepStrictEqual(opt, expectedFormatOptions);
			});
		});
	});
});
