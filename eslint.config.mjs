import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {typeof tseslint.configs.recommended} */
export default [
	pluginJs.configs.recommended,
	...tseslint.configs.recommended,
	{
		ignores: [
			'**/*.{js,mjs}',
			'**/*.d.ts',
			'**/.vscode-test-web/*',
			'**/.vscode-test/*',
		],
	},
	{
		rules: {
			'no-control-regex': 'off',
			'no-empty': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					args: 'none',
					varsIgnorePattern: '^_',
					caughtErrors: 'none',
					ignoreRestSiblings: true,
				},
			],
		},
	},
];
