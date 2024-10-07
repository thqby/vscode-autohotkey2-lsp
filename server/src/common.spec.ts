import { suite, test } from 'mocha';
import { updateConfig } from './common';
import * as assert from 'assert';
import {
	BraceStyle,
	CallWithoutParentheses,
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

		const theories: [value: CallWithoutParentheses][] = [
			[CallWithoutParentheses.On],
			[CallWithoutParentheses.Off],
			[CallWithoutParentheses.Parentheses],
		];

		theories.forEach(([value]) => {
			test(value, () => {
				const config = newConfig();
				setCfg(CfgKey.CallWithoutParentheses, value, config);

				updateConfig(config);

				assert.strictEqual(
					getCfg<number>(CfgKey.CallWithoutParentheses),
					value,
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

	suite('Syntaxes', () => {
		beforeEach(() => {
			setCfg(CfgKey.Syntaxes, undefined);
		});

		const theories: [
			name: string,
			value: string | undefined,
			expected: string | undefined,
		][] = [
			['absolute path with forward slashes', 'C:/ahk.json', 'c:\\ahk.json'],
			['undefined', undefined, undefined],
		];

		theories.forEach(([name, value, expected]) => {
			test(name, () => {
				const config = newConfig();
				setCfg<string | undefined>(CfgKey.Syntaxes, value, config);

				updateConfig(config);

				assert.strictEqual(getCfg<string>(CfgKey.Syntaxes), expected);
			});
		});
	});

	suite('BraceStyle', () => {
		beforeEach(() => {
			setCfg(CfgKey.BraceStyle, undefined);
		});

		const theories: [
			name: string,
			value: string | undefined,
			expected: BraceStyle,
		][] = [
			['Allman', 'Allman', 'Allman'],
			['One True Brace', 'One True Brace', 'One True Brace'],
			[
				'One True Brace Variant',
				'One True Brace Variant',
				'One True Brace Variant',
			],
			['Preserve', 'Preserve', 'Preserve'],
			['undefined', undefined, 'Preserve'],
			['0', '0', 'Allman'],
			['1', '1', 'One True Brace'],
			['-1', '-1', 'One True Brace Variant'],
			['other value', 'potato', 'Preserve'],
		];

		theories.forEach(([name, value, expected]) => {
			test(name, () => {
				const config = newConfig();
				setCfg<string | undefined>(CfgKey.BraceStyle, value, config);

				updateConfig(config);

				assert.strictEqual(getCfg(CfgKey.BraceStyle), expected);
			});
		});
	});
});
