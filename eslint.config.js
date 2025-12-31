import globals from 'globals';
import js from '@eslint/js';

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
                Chart: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern:
                        '^(addTask|toggleComplete|deleteTask|startEdit|cancelEdit|saveEdit|handleEditKeypress|handleDragStart|handleDragEnd|handleDragOver|handleDrop|handleDragLeave|handleTaskSelect|setPresetTime|adjustTime|startTimer|stopTimer|clearTimer|startLogEdit|saveLogEdit|cancelLogEdit|deleteLog|handleLogEditKeypress|onLogTaskChange|exportToCsv|exportLogsToCsv|deleteSelectedTasks|deleteAllTasks|deleteAllLogs|toggleMemoCollapse|selectMemoTab|addMemoTab|deleteMemoTab|startEditTabName|saveMemoContent|updateChart|toggleTimeline|updateTimeline|openTimelineModal|closeTimelineModal|showTimelineTooltip|hideTimelineTooltip|loadFromGoogleSheets|saveToGoogleSheets|saveAllToGoogleSheets|syncFromGoogleSheets|filterLogs|clearLogFilter|adjustLogFilterDate)$',
                },
            ],
            'no-extra-semi': 'error',
            'no-extra-boolean-cast': 'error',
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-duplicate-case': 'error',
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
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                vi: 'readonly',
            },
        },
    },
];
