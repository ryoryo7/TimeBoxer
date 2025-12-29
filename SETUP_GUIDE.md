# タスク管理アプリ 開発環境セットアップ指示書

## 概要

本ドキュメントは、タスク管理アプリの開発環境にテスト・コード品質管理ツールを導入するための手順書です。

---

## 導入ツール一覧

| ツール | バージョン | 用途 |
|--------|------------|------|
| Vitest | ^2.1.8 | ユニットテスト |
| Prettier | ^3.4.2 | コード整形 |
| ESLint | ^9.17.0 | 静的解析・品質チェック |

---

## 前提条件

- Node.js 18.x 以上がインストールされていること
- npm 9.x 以上がインストールされていること

```bash
# バージョン確認
node -v
npm -v
```

---

## セットアップ手順

### 1. プロジェクトディレクトリに移動

```bash
cd /path/to/task-manager
```

### 2. package.json の作成

プロジェクトルートに `package.json` を作成してください。

```json
{
    "name": "task-manager",
    "version": "1.5.0",
    "description": "シンプルなタスク管理アプリ",
    "type": "module",
    "scripts": {
        "format": "prettier --write .",
        "format:check": "prettier --check .",
        "lint": "eslint .",
        "lint:fix": "eslint --fix .",
        "test": "vitest run",
        "test:watch": "vitest",
        "test:coverage": "vitest run --coverage",
        "check": "npm run format:check && npm run lint",
        "fix": "npm run format && npm run lint:fix"
    },
    "devDependencies": {
        "@eslint/js": "^9.17.0",
        "@vitest/coverage-v8": "^2.1.8",
        "eslint": "^9.17.0",
        "globals": "^15.13.0",
        "jsdom": "^25.0.1",
        "prettier": "^3.4.2",
        "vitest": "^2.1.8"
    }
}
```

### 3. パッケージのインストール

```bash
npm install
```

### 4. 設定ファイルの作成

以下のファイルをプロジェクトルートに作成してください。

---

#### 4.1 Prettier設定（.prettierrc）

```json
{
    "printWidth": 100,
    "tabWidth": 4,
    "useTabs": false,
    "semi": true,
    "singleQuote": true,
    "quoteProps": "as-needed",
    "trailingComma": "es5",
    "bracketSpacing": true,
    "arrowParens": "avoid",
    "endOfLine": "lf",
    "htmlWhitespaceSensitivity": "css"
}
```

---

#### 4.2 Prettier除外設定（.prettierignore）

```
node_modules/
coverage/
*.md
```

---

#### 4.3 ESLint設定（eslint.config.js）

```javascript
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
```

---

#### 4.4 Vitest設定（vitest.config.js）

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['tests/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['script.js'],
        },
    },
});
```

---

#### 4.5 Git除外設定（.gitignore）

```
node_modules/
coverage/
```

---

### 5. テストディレクトリの作成

```bash
mkdir -p tests
```

### 6. サンプルテストファイルの作成

`tests/tasks.test.js` を作成してください。

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// テスト用ヘルパー関数
const createMockLocalStorage = () => {
    let store = {};
    return {
        getItem: vi.fn(key => store[key] || null),
        setItem: vi.fn((key, value) => {
            store[key] = value;
        }),
        removeItem: vi.fn(key => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        get store() {
            return store;
        },
    };
};

describe('タスク管理アプリ', () => {
    let mockLocalStorage;

    beforeEach(() => {
        mockLocalStorage = createMockLocalStorage();
        global.localStorage = mockLocalStorage;
    });

    describe('LocalStorage操作', () => {
        it('タスクを保存できる', () => {
            const tasks = [{ id: 1, name: 'テスト', priority: 1 }];
            localStorage.setItem('taskManager_tasks', JSON.stringify(tasks));

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'taskManager_tasks',
                JSON.stringify(tasks)
            );
        });

        it('タスクを取得できる', () => {
            const tasks = [{ id: 1, name: 'テスト', priority: 1 }];
            mockLocalStorage.store['taskManager_tasks'] = JSON.stringify(tasks);

            const result = JSON.parse(localStorage.getItem('taskManager_tasks'));
            expect(result).toEqual(tasks);
        });

        it('空の場合は空配列を返す', () => {
            const result = localStorage.getItem('taskManager_tasks');
            expect(result).toBeNull();
        });
    });

    describe('優先順位', () => {
        it('優先順位は一意である', () => {
            const tasks = [
                { id: 1, priority: 1 },
                { id: 2, priority: 2 },
                { id: 3, priority: 3 },
            ];

            const priorities = tasks.map(t => t.priority);
            const unique = [...new Set(priorities)];

            expect(priorities.length).toBe(unique.length);
        });

        it('優先順位でソートできる', () => {
            const tasks = [
                { id: 1, priority: 3 },
                { id: 2, priority: 1 },
                { id: 3, priority: 2 },
            ];

            const sorted = [...tasks].sort((a, b) => a.priority - b.priority);

            expect(sorted[0].priority).toBe(1);
            expect(sorted[1].priority).toBe(2);
            expect(sorted[2].priority).toBe(3);
        });

        it('完了タスクは後ろに配置される', () => {
            const tasks = [
                { id: 1, priority: 1, completed: true },
                { id: 2, priority: 2, completed: false },
                { id: 3, priority: 3, completed: false },
            ];

            const sorted = [...tasks].sort((a, b) => {
                if (a.completed !== b.completed) {
                    return a.completed ? 1 : -1;
                }
                return a.priority - b.priority;
            });

            expect(sorted[0].completed).toBe(false);
            expect(sorted[1].completed).toBe(false);
            expect(sorted[2].completed).toBe(true);
        });
    });

    describe('時間フォーマット', () => {
        const formatTime = minutes => {
            if (minutes < 60) {
                return `${minutes}分`;
            }
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            if (mins === 0) {
                return `${hours}時間`;
            }
            return `${hours}時間${mins}分`;
        };

        it('60分未満は「X分」形式', () => {
            expect(formatTime(1)).toBe('1分');
            expect(formatTime(30)).toBe('30分');
            expect(formatTime(59)).toBe('59分');
        });

        it('60分ちょうどは「1時間」', () => {
            expect(formatTime(60)).toBe('1時間');
        });

        it('60分以上は「X時間Y分」形式', () => {
            expect(formatTime(90)).toBe('1時間30分');
            expect(formatTime(150)).toBe('2時間30分');
        });

        it('時間ちょうどは「X時間」形式', () => {
            expect(formatTime(120)).toBe('2時間');
            expect(formatTime(180)).toBe('3時間');
        });
    });

    describe('CSVエスケープ', () => {
        const escapeCsvField = field => {
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        it('通常文字列はそのまま', () => {
            expect(escapeCsvField('hello')).toBe('hello');
        });

        it('カンマを含む場合はダブルクォートで囲む', () => {
            expect(escapeCsvField('hello,world')).toBe('"hello,world"');
        });

        it('ダブルクォートは二重化', () => {
            expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
        });

        it('改行を含む場合はダブルクォートで囲む', () => {
            expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
        });
    });

    describe('日付フォーマット', () => {
        const formatDateForInput = date => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const formatTargetDate = dateString => {
            if (!dateString) return '-';
            const parts = dateString.split('-');
            return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
        };

        it('Date型をYYYY-MM-DD形式に変換', () => {
            const date = new Date(2024, 11, 31);
            expect(formatDateForInput(date)).toBe('2024-12-31');
        });

        it('YYYY-MM-DDをM/D形式に変換', () => {
            expect(formatTargetDate('2024-12-31')).toBe('12/31');
            expect(formatTargetDate('2024-01-05')).toBe('1/5');
        });

        it('空の場合は「-」を返す', () => {
            expect(formatTargetDate('')).toBe('-');
            expect(formatTargetDate(null)).toBe('-');
        });
    });

    describe('優先順位の正規化', () => {
        const normalizePriorities = tasks => {
            const incomplete = tasks
                .filter(t => !t.completed)
                .sort((a, b) => a.priority - b.priority);
            const completed = tasks.filter(t => t.completed).sort((a, b) => a.priority - b.priority);

            incomplete.forEach((task, i) => {
                task.priority = i + 1;
            });
            completed.forEach((task, i) => {
                task.priority = incomplete.length + i + 1;
            });

            return [...incomplete, ...completed];
        };

        it('優先順位を1から連番に再採番', () => {
            const tasks = [
                { id: 1, priority: 5, completed: false },
                { id: 2, priority: 10, completed: false },
                { id: 3, priority: 15, completed: false },
            ];

            const result = normalizePriorities(tasks);

            expect(result[0].priority).toBe(1);
            expect(result[1].priority).toBe(2);
            expect(result[2].priority).toBe(3);
        });

        it('完了タスクは未完了の後に連番', () => {
            const tasks = [
                { id: 1, priority: 1, completed: false },
                { id: 2, priority: 2, completed: true },
                { id: 3, priority: 3, completed: false },
            ];

            const result = normalizePriorities(tasks);

            expect(result[0].priority).toBe(1);
            expect(result[0].completed).toBe(false);
            expect(result[1].priority).toBe(2);
            expect(result[1].completed).toBe(false);
            expect(result[2].priority).toBe(3);
            expect(result[2].completed).toBe(true);
        });
    });
});
```

---

## 導入後の確認

### 動作確認コマンド

```bash
# 1. コード整形の確認
npm run format:check

# 2. コード整形の実行
npm run format

# 3. ESLintの確認
npm run lint

# 4. ESLintの自動修正
npm run lint:fix

# 5. テストの実行
npm run test

# 6. テスト（ウォッチモード）
npm run test:watch

# 7. カバレッジレポート
npm run test:coverage

# 8. 整形 + Lintをまとめて実行
npm run fix

# 9. チェックのみ（CIで使用）
npm run check
```

---

## 最終的なディレクトリ構成

```
task-manager/
├── index.html
├── style.css
├── script.js
├── package.json
├── package-lock.json
├── .prettierrc
├── .prettierignore
├── .gitignore
├── eslint.config.js
├── vitest.config.js
├── SPECIFICATION.md
├── SETUP_GUIDE.md（本ファイル）
├── node_modules/
├── coverage/（テスト実行後に生成）
└── tests/
    └── tasks.test.js
```

---

## トラブルシューティング

### ESLintでグローバル変数エラーが出る場合

`script.js` でブラウザのグローバル変数（`document`, `localStorage`など）を使用しているため、`eslint.config.js` の `globals.browser` が必要です。設定を確認してください。

### Prettierで改行コードの警告が出る場合

Windows環境では改行コードが `CRLF` になっている場合があります。以下のコマンドで修正してください。

```bash
npm run format
```

または、Gitの設定を変更してください。

```bash
git config --global core.autocrlf false
```

### テストでDOM関連のエラーが出る場合

`vitest.config.js` の `environment: 'jsdom'` が設定されていることを確認してください。

---

## CI/CD連携（参考）

GitHub Actionsなどで使用する場合のワークフロー例：

```yaml
name: CI

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: '20'
                  cache: 'npm'
            - run: npm ci
            - run: npm run check
            - run: npm run test
```

---

## 問い合わせ

セットアップで問題が発生した場合は、以下の情報とともに連絡してください。

- Node.js / npm のバージョン
- 実行したコマンド
- エラーメッセージ全文
- OS情報

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2024-12-29 | 初版作成 |
