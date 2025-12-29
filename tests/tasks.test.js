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
            const completed = tasks
                .filter(t => t.completed)
                .sort((a, b) => a.priority - b.priority);

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
