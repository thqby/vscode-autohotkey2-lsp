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
	test('updates LibrarySuggestions', () => {
		const config = newConfig();
		setCfg<LibIncludeType>(
			CfgKey.LibrarySuggestions,
			LibIncludeType.All,
			config,
		);
		setCfg<LibIncludeType>(CfgKey.LibrarySuggestions, LibIncludeType.Disabled);
		// Ensure we've set up the test correctly
		assert.strictEqual(
			getCfg(CfgKey.LibrarySuggestions),
			LibIncludeType.Disabled,
		);

		updateConfig(config);

		// Ensure updateConfig works
		assert.strictEqual(getCfg(CfgKey.LibrarySuggestions), LibIncludeType.All);
	});
});
