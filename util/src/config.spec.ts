import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
	AHKLSConfig,
	CallWithoutParentheses,
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

		setCfg(CfgKey.CallWithoutParentheses, CallWithoutParentheses.Off, cfg);

		assert.strictEqual(
			CallWithoutParentheses.Off,
			getCfg(CfgKey.CallWithoutParentheses, cfg),
		);

		setCfg(CfgKey.CallWithoutParentheses, CallWithoutParentheses.On, cfg);

		assert.strictEqual(
			CallWithoutParentheses.On,
			getCfg(CfgKey.CallWithoutParentheses, cfg),
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

	test('invalid property', () => {
		// no assertion necessary, just needs not to throw
		setCfg('potato' as CfgKey, 1);
	});
});

suite('getCfg', () => {
	test('invalid nested property', () => {
		const cfg: AHKLSConfig = newConfig();

		// no assertion necessary, just needs not to throw
		getCfg(`${CfgKey.Formatter}.superDuperInvalid` as CfgKey, cfg);
	});
});
