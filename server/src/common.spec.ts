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
});
