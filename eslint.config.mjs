import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {typeof tseslint.configs.recommended} */
export default [
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: [
            '**/*.js',
            '**/*.d.ts',
            '**/.vscode-test-web/*',
            '**/.vscode-test/*',
        ],
    },
    {
        rules: {
            'no-control-regex': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrors: 'none',
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
];
