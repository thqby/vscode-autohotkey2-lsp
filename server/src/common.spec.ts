import { suite, test } from 'mocha';
import { updateConfig } from './common';
import * as assert from 'assert';
import {
	CfgKey,
	getCfg,
	LibIncludeType,
	newConfig,
	setCfg,
} from '../../util/src/config';

suite('updateConfig', () => {
	suite('LibrarySuggestions', () => {
		beforeEach(() => {
			setCfg(CfgKey.LibrarySuggestions, LibIncludeType.Disabled);
		});

		test('LibIncludeType', () => {
			const config = newConfig();
			setCfg<LibIncludeType>(
				CfgKey.LibrarySuggestions,
				LibIncludeType.All,
				config,
			);

			updateConfig(config);

			assert.strictEqual(getCfg(CfgKey.LibrarySuggestions), LibIncludeType.All);
		});

		test('string', () => {
			const config = newConfig();
			setCfg<string>(CfgKey.LibrarySuggestions, 'All', config);

			updateConfig(config);

			assert.strictEqual(getCfg(CfgKey.LibrarySuggestions), LibIncludeType.All);
		});

		test('boolean', () => {
			const config = newConfig();
			setCfg<boolean>(CfgKey.LibrarySuggestions, true, config);

			updateConfig(config);

			assert.strictEqual(getCfg(CfgKey.LibrarySuggestions), LibIncludeType.All);
		});
	});

	suite('Exclude', () => {
		test('works', () => {
			const config = newConfig();
			setCfg<string[]>(CfgKey.Exclude, ['potato'], config);

			updateConfig(config);

			assert.deepStrictEqual(getCfg(CfgKey.Exclude), ['potato']);
		});
	});

	suite('MaxScanDepth', () => {
		test('positive', () => {
			const config = newConfig();
			setCfg<number>(CfgKey.MaxScanDepth, 3, config);

			updateConfig(config);

			assert.strictEqual(getCfg<number>(CfgKey.MaxScanDepth), 3);
		});

		test('negative', () => {
			const config = newConfig();
			setCfg<number>(CfgKey.MaxScanDepth, -3, config);

			updateConfig(config);

			assert.strictEqual(getCfg<number>(CfgKey.MaxScanDepth), Infinity);
		});
	});

	suite('CallWithoutParentheses', () => {
		beforeEach(() => {
			setCfg(CfgKey.CallWithoutParentheses, undefined);
		});

		const theories: [
			value: 'On' | 'Off' | 'Parentheses',
			expected: boolean | 1,
		][] = [
			['On', true],
			['Off', false],
			['Parentheses', 1],
		];

		theories.forEach(([value, expected]) => {
			test(value, () => {
				const config = newConfig();
				setCfg(CfgKey.CallWithoutParentheses, value, config);

				updateConfig(config);

				assert.strictEqual(
					getCfg<number>(CfgKey.CallWithoutParentheses),
					expected,
				);
			});
		});
	});

	suite('WorkingDirectories', () => {
		beforeEach(() => {
			setCfg(CfgKey.WorkingDirectories, undefined);
		});

		const theories: [
			name: string,
			value: undefined | string[] | string,
			expected: string[],
		][] = [
			['undefined', undefined, []],
			['one string[]', ['C:\\'], ['file:///c%3a/']],
			['two string[]', ['C:\\', 'D:\\'], ['file:///c%3a/', 'file:///d%3a/']],
			['string', 'C:\\', []],
		];

		theories.forEach(([name, value, expected]) => {
			test(name, () => {
				const config = newConfig();
				setCfg(CfgKey.WorkingDirectories, value, config);

				updateConfig(config);

				assert.deepStrictEqual(
					getCfg<string[]>(CfgKey.WorkingDirectories),
					expected,
				);
			});
		});
	});
});
