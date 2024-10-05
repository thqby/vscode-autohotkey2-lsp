import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
	AHKLSConfig,
	CfgKey,
	getCfg,
	LibIncludeType,
	newConfig,
	setCfg,
} from './config';

suite('setCfg', () => {
	test('top-level property', () => {
		const cfg: AHKLSConfig = newConfig();

		setCfg(CfgKey.LibrarySuggestions, LibIncludeType.Disabled, cfg);

		assert.strictEqual(
			LibIncludeType.Disabled,
			getCfg(CfgKey.LibrarySuggestions, cfg),
		);

		setCfg(CfgKey.LibrarySuggestions, LibIncludeType.All, cfg);

		assert.strictEqual(
			LibIncludeType.All,
			getCfg(CfgKey.LibrarySuggestions, cfg),
		);
	});

	test('nested property', () => {
		const cfg: AHKLSConfig = newConfig();

		setCfg(CfgKey.CallWithoutParentheses, false, cfg);

		assert.strictEqual(
			false,
			getCfg<boolean>(CfgKey.CallWithoutParentheses, cfg),
		);

		setCfg(CfgKey.CallWithoutParentheses, true, cfg);

		assert.strictEqual(
			true,
			getCfg<boolean>(CfgKey.CallWithoutParentheses, cfg),
		);
	});

	test('nested object property', () => {
		const cfg: AHKLSConfig = newConfig();

		setCfg<number>(CfgKey.ArrayStyle, 1, cfg);
		setCfg<number>(CfgKey.BraceStyle, 0, cfg);

		assert.strictEqual(0, getCfg<boolean>(CfgKey.BraceStyle, cfg));

		setCfg(CfgKey.ArrayStyle, 2, cfg);

		// Check for updated value and other value not deleted
		assert.strictEqual(2, getCfg<boolean>(CfgKey.ArrayStyle, cfg));
		assert.strictEqual(0, getCfg<boolean>(CfgKey.BraceStyle, cfg));
	});
});
