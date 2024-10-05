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
		test('LibIncludeType', () => {
			const config = newConfig();
			setCfg<LibIncludeType>(
				CfgKey.LibrarySuggestions,
				LibIncludeType.All,
				config,
			);

			updateConfig(config);

			// Ensure updateConfig works
			assert.strictEqual(getCfg(CfgKey.LibrarySuggestions), LibIncludeType.All);
		});

		test('string', () => {
			const config = newConfig();
			setCfg<string>(CfgKey.LibrarySuggestions, 'All', config);

			updateConfig(config);

			// Ensure updateConfig works
			assert.strictEqual(getCfg(CfgKey.LibrarySuggestions), LibIncludeType.All);
		});

		test('boolean', () => {
			const config = newConfig();
			setCfg<boolean>(CfgKey.LibrarySuggestions, true, config);

			updateConfig(config);

			// Ensure updateConfig works
			assert.strictEqual(getCfg(CfgKey.LibrarySuggestions), LibIncludeType.All);
		});
	});
});
