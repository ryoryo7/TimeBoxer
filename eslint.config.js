import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        ignores: ['node_modules/**', 'coverage/**'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            // 未使用変数
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

            // 冗長なコード
            'no-extra-semi': 'error',
            'no-extra-boolean-cast': 'error',

            // 一貫性
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],

            // バグ検出
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-duplicate-case': 'error',

            // スタイル
            'no-multiple-empty-lines': ['error', { max: 1 }],
            'no-trailing-spaces': 'error',
        },
    },
    {
        files: ['tests/**/*.js', '**/*.test.js'],
        languageOptions: {
            globals: {
                ...globals.node,
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                vi: 'readonly',
            },
        },
    },
];
