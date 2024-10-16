import assert from 'assert';
import { suite, test } from 'mocha';
import { shouldExclude } from './exclude';

suite('shouldExclude', () => {
	const tests: [
		name: string,
		args: Parameters<typeof shouldExclude>,
		expected: ReturnType<typeof shouldExclude>,
	][] = [
		['include file', ['file', 'all', { file: [], folder: [] }], false],
		['include folder', ['folder', 'all', { file: [], folder: [] }], false],
		[
			'exclude folder',
			['folder', 'folderOnly', { file: [], folder: [/folder/i] }],
			true,
		],
		['exclude file', ['file', 'all', { file: [/file/i], folder: [] }], true],
		[
			`include folder that matches file pattern`,
			['folder', 'folderOnly', { file: [/file/i], folder: [] }],
			false,
		],
		[
			`exclude file that matches folder pattern`,
			['folder/file', 'all', { file: [], folder: [/folder/i] }],
			true,
		],
	];
	tests.forEach(([name, args, expected]) =>
		test(name, () => assert.strictEqual(shouldExclude(...args), expected)),
	);
});
