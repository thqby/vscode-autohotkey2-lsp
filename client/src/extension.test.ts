import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import { resolvePath } from './extension';

suite('resolvePath', () => {
	let lstatSyncStub: sinon.SinonStub;

	suiteSetup(() => {
		lstatSyncStub = sinon.stub(fs, 'lstatSync');
	});

	const theories: ([string, string] | [string, string, boolean])[] = [
		['', ''],
		['C:/out.txt', 'C:/out.txt'],
	];

	theories.forEach(([input, expected, isSymbolicLink = false]) => {
		test(`resolvePath('${input}') === '${expected}'`, () => {
			// Mock the behavior of fs.lstatSync
			lstatSyncStub
				.withArgs(input)
				.returns({ isSymbolicLink: () => isSymbolicLink });

			assert.strictEqual(resolvePath(input), expected);
		});
	});
});
