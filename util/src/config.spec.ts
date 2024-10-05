import * as assert from 'assert';
import { suite, test } from 'mocha';
import { AHKLSConfig, CfgKey, FormatOptions, getCfg, LibIncludeType, setCfg } from './config';

suite('setCfg', () => {
	test('top-level property', () => {
		const cfg: AHKLSConfig = { AutoLibInclude: LibIncludeType.All } as AHKLSConfig;

		setCfg(CfgKey.LibrarySuggestions, LibIncludeType.Disabled, cfg);

		assert.strictEqual(LibIncludeType.Disabled, getCfg(CfgKey.LibrarySuggestions, cfg));
	});

	test('nested property', () => {
		const cfg: AHKLSConfig = { FormatOptions: { brace_style: 1 } } as AHKLSConfig;

		setCfg(CfgKey.Formatter, { brace_style: 2 }, cfg);

		assert.strictEqual(2, getCfg<FormatOptions>(CfgKey.Formatter, cfg).brace_style);
	});
});