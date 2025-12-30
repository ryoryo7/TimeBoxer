import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== テスト用のセットアップ ====================

// LocalStorageのモック
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: key => store[key] || null,
        setItem: (key, value) => {
            store[key] = String(value);
        },
        removeItem: key => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
    };
})();

// グローバル設定
beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal('localStorage', localStorageMock);
});

// ==================== ユーティリティ関数（テスト対象） ====================

// LocalStorage操作
const STORAGE_KEY_TASKS = 'taskManager_tasks';
const STORAGE_KEY_LOGS = 'taskManager_logs';

function getTasks() {
    const data = localStorage.getItem(STORAGE_KEY_TASKS);
    return data ? JSON.parse(data) : [];
}

function saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
}

function getLogs() {
    const data = localStorage.getItem(STORAGE_KEY_LOGS);
    return data ? JSON.parse(data) : [];
}

function saveLogs(logs) {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
}

// 時間フォーマット（整数）
function formatTime(minutes) {
    if (minutes < 60) {
        return `${minutes}分`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
        return `${hours}時間`;
    }
    return `${hours}時間${mins}分`;
}

// 時間フォーマット（小数）
function formatTimeDecimal(minutes) {
    if (minutes < 60) {
        return `${minutes.toFixed(1)}分`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = (minutes % 60).toFixed(1);
    if (parseFloat(mins) === 0) {
        return `${hours}時間`;
    }
    return `${hours}時間${mins}分`;
}

// 日時フォーマット（秒付き）
function formatDateTimeWithSeconds(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// HTMLエスケープ
function escapeHtml(text) {
    const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, char => escapeMap[char]);
}

// CSVエスケープ
function escapeCsvField(text) {
    if (!text) return '';
    return text.replace(/"/g, '""');
}

// 今日の日付を取得
function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// 優先順位の再採番
function renumberPriorities(tasks) {
    const incompleteTasks = tasks.filter(t => !t.completed).sort((a, b) => a.priority - b.priority);
    incompleteTasks.forEach((task, index) => {
        task.priority = index + 1;
    });
}

// タスク別合計時間の計算
function calculateTaskTotal(logs, taskId, upToIndex) {
    let total = 0;
    for (let i = 0; i <= upToIndex; i++) {
        if (logs[i].taskId === taskId) {
            total += logs[i].duration;
        }
    }
    return parseFloat(total.toFixed(1));
}

// ==================== 8. ユーティリティ関数テスト ====================

describe('8. ユーティリティ関数', () => {
    describe('8.1 時間フォーマット（整数）', () => {
        it('60分未満は「XX分」で表示される', () => {
            expect(formatTime(0)).toBe('0分');
            expect(formatTime(1)).toBe('1分');
            expect(formatTime(30)).toBe('30分');
            expect(formatTime(59)).toBe('59分');
        });

        it('60分は「1時間」で表示される', () => {
            expect(formatTime(60)).toBe('1時間');
        });

        it('60分以上は「X時間XX分」で表示される', () => {
            expect(formatTime(90)).toBe('1時間30分');
            expect(formatTime(120)).toBe('2時間');
            expect(formatTime(150)).toBe('2時間30分');
            expect(formatTime(1440)).toBe('24時間');
        });
    });

    describe('8.2 時間フォーマット（小数）', () => {
        it('60分未満は小数点第一位で表示される', () => {
            expect(formatTimeDecimal(0)).toBe('0.0分');
            expect(formatTimeDecimal(1.5)).toBe('1.5分');
            expect(formatTimeDecimal(30.3)).toBe('30.3分');
            expect(formatTimeDecimal(59.9)).toBe('59.9分');
        });

        it('60分以上は「X時間XX.X分」で表示される', () => {
            expect(formatTimeDecimal(60)).toBe('1時間');
            expect(formatTimeDecimal(90.5)).toBe('1時間30.5分');
            expect(formatTimeDecimal(120)).toBe('2時間');
        });
    });

    describe('8.3 日時フォーマット', () => {
        it('秒付きで正しくフォーマットされる', () => {
            const date = new Date('2025-12-30T14:30:45');
            expect(formatDateTimeWithSeconds(date)).toBe('2025-12-30 14:30:45');
        });

        it('月・日・時・分・秒が1桁の場合はゼロ埋めされる', () => {
            const date = new Date('2025-01-05T09:05:03');
            expect(formatDateTimeWithSeconds(date)).toBe('2025-01-05 09:05:03');
        });
    });

    describe('8.4 HTMLエスケープ', () => {
        it('特殊文字が正しくエスケープされる', () => {
            expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
            expect(escapeHtml('a & b')).toBe('a &amp; b');
            expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
            expect(escapeHtml("it's")).toBe('it&#039;s');
        });

        it('エスケープ不要な文字はそのまま', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World');
            expect(escapeHtml('タスク名')).toBe('タスク名');
        });
    });

    describe('8.5 CSVエスケープ', () => {
        it('ダブルクォートが正しくエスケープされる', () => {
            expect(escapeCsvField('He said "Hello"')).toBe('He said ""Hello""');
            expect(escapeCsvField('""')).toBe('""""');
        });

        it('空文字列やnullは空文字を返す', () => {
            expect(escapeCsvField('')).toBe('');
            expect(escapeCsvField(null)).toBe('');
        });

        it('エスケープ不要な文字はそのまま', () => {
            expect(escapeCsvField('Hello World')).toBe('Hello World');
            expect(escapeCsvField('タスク,名')).toBe('タスク,名');
        });
    });
});

// ==================== 1. タスク管理機能テスト ====================

describe('1. タスク管理機能', () => {
    describe('1.1 タスク追加（必須項目のみ）', () => {
        it('タスク名のみで追加できる', () => {
            const tasks = [];
            const newTask = {
                id: Date.now(),
                name: 'テストタスク',
                priority: 1,
                estimatedTime: 30,
                targetDate: getTodayString(),
                completed: false,
                createdAt: new Date().toISOString(),
            };
            tasks.push(newTask);
            saveTasks(tasks);

            const savedTasks = getTasks();
            expect(savedTasks.length).toBe(1);
            expect(savedTasks[0].name).toBe('テストタスク');
        });
    });

    describe('1.2 タスク追加（全項目）', () => {
        it('全項目入力して追加できる', () => {
            const tasks = [];
            const newTask = {
                id: Date.now(),
                name: 'フルタスク',
                priority: 2,
                estimatedTime: 60,
                targetDate: '2025-12-31',
                completed: false,
                createdAt: new Date().toISOString(),
            };
            tasks.push(newTask);
            saveTasks(tasks);

            const savedTasks = getTasks();
            expect(savedTasks.length).toBe(1);
            expect(savedTasks[0].name).toBe('フルタスク');
            expect(savedTasks[0].priority).toBe(2);
            expect(savedTasks[0].estimatedTime).toBe(60);
            expect(savedTasks[0].targetDate).toBe('2025-12-31');
        });
    });

    describe('1.3 優先順位自動採番', () => {
        it('優先順位未指定時、末尾の優先順位+1が自動設定される', () => {
            const tasks = [
                {
                    id: 1,
                    name: 'タスク1',
                    priority: 1,
                    estimatedTime: 30,
                    targetDate: getTodayString(),
                    completed: false,
                    createdAt: new Date().toISOString(),
                },
                {
                    id: 2,
                    name: 'タスク2',
                    priority: 2,
                    estimatedTime: 30,
                    targetDate: getTodayString(),
                    completed: false,
                    createdAt: new Date().toISOString(),
                },
            ];

            // 新しいタスクを追加（優先順位未指定）
            const incompleteTasks = tasks.filter(t => !t.completed);
            const maxPriority =
                incompleteTasks.length > 0 ? Math.max(...incompleteTasks.map(t => t.priority)) : 0;
            const newPriority = maxPriority + 1;

            const newTask = {
                id: 3,
                name: 'タスク3',
                priority: newPriority,
                estimatedTime: 30,
                targetDate: getTodayString(),
                completed: false,
                createdAt: new Date().toISOString(),
            };
            tasks.push(newTask);

            expect(newTask.priority).toBe(3);
        });

        it('タスクがない場合、優先順位は1になる', () => {
            const tasks = [];
            const incompleteTasks = tasks.filter(t => !t.completed);
            const newPriority =
                incompleteTasks.length === 0
                    ? 1
                    : Math.max(...incompleteTasks.map(t => t.priority)) + 1;

            expect(newPriority).toBe(1);
        });
    });

    describe('1.4 優先順位指定時の繰り下げ', () => {
        it('既存の優先順位を指定すると、以降が繰り下がる', () => {
            const tasks = [
                {
                    id: 1,
                    name: 'タスク1',
                    priority: 1,
                    completed: false,
                },
                {
                    id: 2,
                    name: 'タスク2',
                    priority: 2,
                    completed: false,
                },
                {
                    id: 3,
                    name: 'タスク3',
                    priority: 3,
                    completed: false,
                },
            ];

            // 優先順位2に新しいタスクを挿入
            const insertPriority = 2;
            tasks.forEach(task => {
                if (!task.completed && task.priority >= insertPriority) {
                    task.priority++;
                }
            });

            const newTask = {
                id: 4,
                name: '割り込みタスク',
                priority: insertPriority,
                completed: false,
            };
            tasks.push(newTask);

            // 検証
            expect(tasks.find(t => t.id === 1).priority).toBe(1);
            expect(tasks.find(t => t.id === 4).priority).toBe(2); // 新規
            expect(tasks.find(t => t.id === 2).priority).toBe(3); // 繰り下げ
            expect(tasks.find(t => t.id === 3).priority).toBe(4); // 繰り下げ
        });
    });

    describe('1.5 優先順位の一意性', () => {
        it('未完了タスクの優先順位が重複しない', () => {
            const tasks = [
                { id: 1, name: 'タスク1', priority: 1, completed: false },
                { id: 2, name: 'タスク2', priority: 2, completed: false },
                { id: 3, name: 'タスク3', priority: 3, completed: false },
                { id: 4, name: '完了タスク', priority: 1, completed: true },
            ];

            const incompleteTasks = tasks.filter(t => !t.completed);
            const priorities = incompleteTasks.map(t => t.priority);
            const uniquePriorities = [...new Set(priorities)];

            expect(priorities.length).toBe(uniquePriorities.length);
        });

        it('再採番後も一意性が保たれる', () => {
            const tasks = [
                { id: 1, name: 'タスク1', priority: 5, completed: false },
                { id: 2, name: 'タスク2', priority: 10, completed: false },
                { id: 3, name: 'タスク3', priority: 3, completed: false },
            ];

            renumberPriorities(tasks);

            const incompleteTasks = tasks.filter(t => !t.completed);
            const priorities = incompleteTasks.map(t => t.priority).sort((a, b) => a - b);

            expect(priorities).toEqual([1, 2, 3]);
        });
    });

    describe('1.6 タスク完了切替', () => {
        it('未完了→完了に切り替えられる', () => {
            const tasks = [{ id: 1, name: 'タスク1', priority: 1, completed: false }];

            tasks[0].completed = true;

            expect(tasks[0].completed).toBe(true);
        });

        it('完了→未完了に切り替えられる', () => {
            const tasks = [{ id: 1, name: 'タスク1', priority: 1, completed: true }];

            tasks[0].completed = false;

            expect(tasks[0].completed).toBe(false);
        });
    });

    describe('1.7 完了タスクの表示位置', () => {
        it('完了タスクは未完了タスクの後ろに表示される', () => {
            const tasks = [
                { id: 1, name: '完了タスク', priority: 1, completed: true },
                { id: 2, name: '未完了タスク1', priority: 1, completed: false },
                { id: 3, name: '未完了タスク2', priority: 2, completed: false },
            ];

            // ソート: 未完了を先、その中で優先順位昇順
            const sortedTasks = [...tasks].sort((a, b) => {
                if (a.completed !== b.completed) {
                    return a.completed ? 1 : -1;
                }
                return a.priority - b.priority;
            });

            expect(sortedTasks[0].name).toBe('未完了タスク1');
            expect(sortedTasks[1].name).toBe('未完了タスク2');
            expect(sortedTasks[2].name).toBe('完了タスク');
        });
    });

    describe('1.8 タスク削除', () => {
        it('個別のタスクを削除できる', () => {
            const tasks = [
                { id: 1, name: 'タスク1', priority: 1, completed: false },
                { id: 2, name: 'タスク2', priority: 2, completed: false },
            ];
            saveTasks(tasks);

            const taskIdToDelete = 1;
            const remainingTasks = getTasks().filter(t => t.id !== taskIdToDelete);
            saveTasks(remainingTasks);

            const savedTasks = getTasks();
            expect(savedTasks.length).toBe(1);
            expect(savedTasks[0].id).toBe(2);
        });
    });

    describe('1.9 選択削除', () => {
        it('チェックしたタスクをまとめて削除できる', () => {
            const tasks = [
                { id: 1, name: 'タスク1', priority: 1, completed: false },
                { id: 2, name: 'タスク2', priority: 2, completed: false },
                { id: 3, name: 'タスク3', priority: 3, completed: false },
            ];
            saveTasks(tasks);

            const idsToDelete = [1, 3];
            const remainingTasks = getTasks().filter(t => !idsToDelete.includes(t.id));
            saveTasks(remainingTasks);

            const savedTasks = getTasks();
            expect(savedTasks.length).toBe(1);
            expect(savedTasks[0].id).toBe(2);
        });
    });

    describe('1.10 全削除', () => {
        it('全タスクを削除できる', () => {
            const tasks = [
                { id: 1, name: 'タスク1', priority: 1, completed: false },
                { id: 2, name: 'タスク2', priority: 2, completed: false },
            ];
            saveTasks(tasks);

            saveTasks([]);

            const savedTasks = getTasks();
            expect(savedTasks.length).toBe(0);
        });
    });

    describe('1.11 タスク編集', () => {
        it('タスクの各項目を編集できる', () => {
            const tasks = [
                {
                    id: 1,
                    name: '元のタスク',
                    priority: 1,
                    estimatedTime: 30,
                    targetDate: '2025-12-30',
                    completed: false,
                },
            ];
            saveTasks(tasks);

            const loadedTasks = getTasks();
            loadedTasks[0].name = '編集後タスク';
            loadedTasks[0].priority = 5;
            loadedTasks[0].estimatedTime = 60;
            loadedTasks[0].targetDate = '2025-12-31';
            saveTasks(loadedTasks);

            const savedTasks = getTasks();
            expect(savedTasks[0].name).toBe('編集後タスク');
            expect(savedTasks[0].priority).toBe(5);
            expect(savedTasks[0].estimatedTime).toBe(60);
            expect(savedTasks[0].targetDate).toBe('2025-12-31');
        });
    });

    describe('1.12 編集キャンセル', () => {
        it('編集をキャンセルすると元の値が保持される', () => {
            const originalTask = {
                id: 1,
                name: '元のタスク',
                priority: 1,
                estimatedTime: 30,
                targetDate: '2025-12-30',
                completed: false,
            };
            const tasks = [{ ...originalTask }];
            saveTasks(tasks);

            // 編集開始（値を変更するが保存しない）
            const editingTask = { ...getTasks()[0] };
            editingTask.name = '編集中タスク';

            // キャンセル（元のデータを再読み込み）
            const savedTasks = getTasks();
            expect(savedTasks[0].name).toBe('元のタスク');
        });
    });
});

// ==================== 4. 実行ログ機能テスト ====================

describe('4. 実行ログ機能', () => {
    describe('4.4 タスク別合計', () => {
        it('同一タスクの累計実行時間が正しく計算される', () => {
            const logs = [
                { id: 1, taskId: 1, taskName: 'タスクA', duration: 25.0 },
                { id: 2, taskId: 2, taskName: 'タスクB', duration: 30.0 },
                { id: 3, taskId: 1, taskName: 'タスクA', duration: 45.5 },
                { id: 4, taskId: 1, taskName: 'タスクA', duration: 10.0 },
            ];

            // インデックス0: タスクA 1回目 → 25.0
            expect(calculateTaskTotal(logs, 1, 0)).toBe(25.0);

            // インデックス1: タスクB 1回目 → 30.0
            expect(calculateTaskTotal(logs, 2, 1)).toBe(30.0);

            // インデックス2: タスクA 2回目 → 25.0 + 45.5 = 70.5
            expect(calculateTaskTotal(logs, 1, 2)).toBe(70.5);

            // インデックス3: タスクA 3回目 → 25.0 + 45.5 + 10.0 = 80.5
            expect(calculateTaskTotal(logs, 1, 3)).toBe(80.5);
        });

        it('割り込みタスクの合計も正しく計算される', () => {
            const logs = [
                { id: 1, taskId: 'interrupt', taskName: '割り込みタスク', duration: 5.0 },
                { id: 2, taskId: 1, taskName: 'タスクA', duration: 30.0 },
                { id: 3, taskId: 'interrupt', taskName: '割り込みタスク', duration: 10.5 },
            ];

            expect(calculateTaskTotal(logs, 'interrupt', 0)).toBe(5.0);
            expect(calculateTaskTotal(logs, 'interrupt', 2)).toBe(15.5);
        });
    });

    describe('4.1 ログ表示', () => {
        it('ログが保存・取得できる', () => {
            const logs = [
                {
                    id: 1,
                    taskId: 1,
                    taskName: 'テストタスク',
                    taskDetail: '詳細',
                    achievement: 50,
                    estimatedTime: 30,
                    startDateTime: '2025-12-30 14:00:00',
                    endDateTime: '2025-12-30 14:25:30',
                    duration: 25.5,
                    completed: true,
                },
            ];
            saveLogs(logs);

            const savedLogs = getLogs();
            expect(savedLogs.length).toBe(1);
            expect(savedLogs[0].taskName).toBe('テストタスク');
        });
    });

    describe('4.2 日時表示形式', () => {
        it('実行日時が秒単位で保存される', () => {
            const log = {
                id: 1,
                startDateTime: formatDateTimeWithSeconds(new Date('2025-12-30T14:30:45')),
                endDateTime: formatDateTimeWithSeconds(new Date('2025-12-30T15:00:30')),
            };

            expect(log.startDateTime).toBe('2025-12-30 14:30:45');
            expect(log.endDateTime).toBe('2025-12-30 15:00:30');
        });
    });

    describe('4.3 実行時間表示', () => {
        it('実行時間が小数点第一位で保存される', () => {
            const durationMs = 25 * 60 * 1000 + 30 * 1000; // 25分30秒
            const durationMinutes = parseFloat((durationMs / 1000 / 60).toFixed(1));

            expect(durationMinutes).toBe(25.5);
        });
    });

    describe('4.5 ログ編集', () => {
        it('ログの各項目を編集できる', () => {
            const logs = [
                {
                    id: 1,
                    taskId: 1,
                    taskName: '元のタスク',
                    taskDetail: '元の詳細',
                    achievement: 50,
                    estimatedTime: 30,
                    startDateTime: '2025-12-30 14:00:00',
                    endDateTime: '2025-12-30 14:25:00',
                    duration: 25.0,
                    completed: true,
                },
            ];
            saveLogs(logs);

            const loadedLogs = getLogs();
            loadedLogs[0].taskName = '編集後タスク';
            loadedLogs[0].taskDetail = '編集後詳細';
            loadedLogs[0].achievement = 80;
            loadedLogs[0].duration = 30.5;
            saveLogs(loadedLogs);

            const savedLogs = getLogs();
            expect(savedLogs[0].taskName).toBe('編集後タスク');
            expect(savedLogs[0].taskDetail).toBe('編集後詳細');
            expect(savedLogs[0].achievement).toBe(80);
            expect(savedLogs[0].duration).toBe(30.5);
        });
    });

    describe('4.8 ログ削除', () => {
        it('個別のログを削除できる', () => {
            const logs = [
                { id: 1, taskName: 'ログ1', duration: 10 },
                { id: 2, taskName: 'ログ2', duration: 20 },
            ];
            saveLogs(logs);

            const logIdToDelete = 1;
            const remainingLogs = getLogs().filter(l => l.id !== logIdToDelete);
            saveLogs(remainingLogs);

            const savedLogs = getLogs();
            expect(savedLogs.length).toBe(1);
            expect(savedLogs[0].id).toBe(2);
        });
    });

    describe('4.9 達成度範囲', () => {
        it('達成度が0〜100の範囲でクランプされる', () => {
            const clampAchievement = value => {
                if (value === null) return null;
                return Math.max(0, Math.min(100, value));
            };

            expect(clampAchievement(50)).toBe(50);
            expect(clampAchievement(0)).toBe(0);
            expect(clampAchievement(100)).toBe(100);
            expect(clampAchievement(-10)).toBe(0);
            expect(clampAchievement(150)).toBe(100);
            expect(clampAchievement(null)).toBe(null);
        });
    });
});

// ==================== 3. タイマー機能テスト ====================

describe('3. タイマー機能', () => {
    describe('3.2 プリセット時間', () => {
        it('プリセット値が正しく設定される', () => {
            const presets = [5, 10, 30, 60];

            presets.forEach(preset => {
                expect(preset).toBeGreaterThan(0);
                expect(Number.isInteger(preset)).toBe(true);
            });
        });
    });

    describe('3.3 カスタム時間', () => {
        it('任意の分数を設定できる', () => {
            const customMinutes = 45;
            const totalSeconds = customMinutes * 60;

            expect(totalSeconds).toBe(2700);
        });

        it('1分未満は無効', () => {
            const isValidTime = minutes => minutes >= 1;

            expect(isValidTime(0)).toBe(false);
            expect(isValidTime(0.5)).toBe(false);
            expect(isValidTime(1)).toBe(true);
            expect(isValidTime(999)).toBe(true);
        });
    });

    describe('3.7 タイマー完了時のログ保存', () => {
        it('完了時にログが保存される', () => {
            const startTime = new Date('2025-12-30T14:00:00');
            const endTime = new Date('2025-12-30T14:25:30');
            const durationMs = endTime.getTime() - startTime.getTime();
            const durationMinutes = parseFloat((durationMs / 1000 / 60).toFixed(1));

            const log = {
                id: Date.now(),
                taskId: 1,
                taskName: 'テストタスク',
                taskDetail: '',
                achievement: null,
                estimatedTime: 30,
                startDateTime: formatDateTimeWithSeconds(startTime),
                endDateTime: formatDateTimeWithSeconds(endTime),
                duration: durationMinutes,
                completed: true,
            };

            expect(log.duration).toBe(25.5);
            expect(log.completed).toBe(true);
            expect(log.startDateTime).toBe('2025-12-30 14:00:00');
            expect(log.endDateTime).toBe('2025-12-30 14:25:30');
        });
    });

    describe('3.9 デフォルトタスク', () => {
        it('デフォルトは割り込みタスク', () => {
            const defaultTaskId = 'interrupt';
            const defaultTaskName = '割り込みタスク';

            expect(defaultTaskId).toBe('interrupt');
            expect(defaultTaskName).toBe('割り込みタスク');
        });
    });

    describe('3.4 タイマー停止時のログ保存', () => {
        it('停止時にもログが保存される（completed: false）', () => {
            const startTime = new Date('2025-12-30T14:00:00');
            const stopTime = new Date('2025-12-30T14:10:00');
            const durationMs = stopTime.getTime() - startTime.getTime();
            const durationMinutes = parseFloat((durationMs / 1000 / 60).toFixed(1));

            const log = {
                id: Date.now(),
                taskId: 1,
                taskName: 'テストタスク',
                duration: durationMinutes,
                completed: false,
            };

            expect(log.duration).toBe(10.0);
            expect(log.completed).toBe(false);
        });
    });
});

// ==================== 追加: 優先順位再採番テスト ====================

describe('優先順位再採番', () => {
    it('バラバラの優先順位が1から連番に再採番される', () => {
        const tasks = [
            { id: 1, name: 'タスク1', priority: 10, completed: false },
            { id: 2, name: 'タスク2', priority: 5, completed: false },
            { id: 3, name: 'タスク3', priority: 20, completed: false },
        ];

        renumberPriorities(tasks);

        const task1 = tasks.find(t => t.id === 1);
        const task2 = tasks.find(t => t.id === 2);
        const task3 = tasks.find(t => t.id === 3);

        // 元の優先順位順（5, 10, 20）→ (1, 2, 3)
        expect(task2.priority).toBe(1); // 元: 5
        expect(task1.priority).toBe(2); // 元: 10
        expect(task3.priority).toBe(3); // 元: 20
    });

    it('完了タスクは再採番の対象外', () => {
        const tasks = [
            { id: 1, name: 'タスク1', priority: 10, completed: false },
            { id: 2, name: '完了タスク', priority: 1, completed: true },
            { id: 3, name: 'タスク3', priority: 5, completed: false },
        ];

        renumberPriorities(tasks);

        const completedTask = tasks.find(t => t.id === 2);
        expect(completedTask.priority).toBe(1); // 変更されない

        const task1 = tasks.find(t => t.id === 1);
        const task3 = tasks.find(t => t.id === 3);
        expect(task3.priority).toBe(1); // 元: 5 → 1
        expect(task1.priority).toBe(2); // 元: 10 → 2
    });
});

// ============================================
// 時間調整機能のテスト
// ============================================
describe('時間調整機能', () => {
    describe('adjustTime - 時間の加減算', () => {
        beforeEach(() => {
            // タイマー入力要素のモック
            document.body.innerHTML = `
                <input type="number" id="timerMinutes" value="25">
                <div id="timerDisplay">25:00</div>
            `;
        });

        test('正の値を加算できる', () => {
            const input = document.getElementById('timerMinutes');
            input.value = '25';

            // adjustTime相当の処理をテスト
            let currentValue = parseInt(input.value) || 0;
            currentValue += 10;
            currentValue = Math.max(1, Math.min(999, currentValue));
            input.value = currentValue;

            expect(parseInt(input.value)).toBe(35);
        });

        test('負の値を減算できる', () => {
            const input = document.getElementById('timerMinutes');
            input.value = '25';

            let currentValue = parseInt(input.value) || 0;
            currentValue += -10;
            currentValue = Math.max(1, Math.min(999, currentValue));
            input.value = currentValue;

            expect(parseInt(input.value)).toBe(15);
        });

        test('最小値は1分', () => {
            const input = document.getElementById('timerMinutes');
            input.value = '5';

            let currentValue = parseInt(input.value) || 0;
            currentValue += -10;
            currentValue = Math.max(1, Math.min(999, currentValue));
            input.value = currentValue;

            expect(parseInt(input.value)).toBe(1);
        });

        test('最大値は999分', () => {
            const input = document.getElementById('timerMinutes');
            input.value = '990';

            let currentValue = parseInt(input.value) || 0;
            currentValue += 60;
            currentValue = Math.max(1, Math.min(999, currentValue));
            input.value = currentValue;

            expect(parseInt(input.value)).toBe(999);
        });
    });
});

// ============================================
// 超過時間計算のテスト
// ============================================
describe('超過時間計算', () => {
    // calculateOverrunTime関数のロジックをテスト
    function calculateOverrunTime(estimatedTime, taskTotal) {
        if (!estimatedTime || estimatedTime <= 0) {
            return null;
        }
        const overrun = taskTotal - estimatedTime;
        return parseFloat(overrun.toFixed(1));
    }

    function formatOverrunTime(overrunTime) {
        if (overrunTime === null) {
            return '-';
        }
        if (overrunTime === 0) {
            return '0分';
        }
        if (overrunTime > 0) {
            return `+${overrunTime}分`;
        }
        return `${overrunTime}分`;
    }

    describe('calculateOverrunTime', () => {
        test('想定時間がない場合はnullを返す', () => {
            expect(calculateOverrunTime(0, 30)).toBe(null);
            expect(calculateOverrunTime(null, 30)).toBe(null);
            expect(calculateOverrunTime(undefined, 30)).toBe(null);
        });

        test('超過していない場合は負の値を返す', () => {
            expect(calculateOverrunTime(60, 45)).toBe(-15);
        });

        test('ちょうど想定時間の場合は0を返す', () => {
            expect(calculateOverrunTime(30, 30)).toBe(0);
        });

        test('超過している場合は正の値を返す', () => {
            expect(calculateOverrunTime(30, 45)).toBe(15);
        });

        test('小数点第1位まで計算する', () => {
            expect(calculateOverrunTime(30, 35.5)).toBe(5.5);
        });
    });

    describe('formatOverrunTime', () => {
        test('nullの場合は"-"を返す', () => {
            expect(formatOverrunTime(null)).toBe('-');
        });

        test('0の場合は"0分"を返す', () => {
            expect(formatOverrunTime(0)).toBe('0分');
        });

        test('正の値の場合は"+XX分"を返す', () => {
            expect(formatOverrunTime(15)).toBe('+15分');
            expect(formatOverrunTime(5.5)).toBe('+5.5分');
        });

        test('負の値の場合は"-XX分"を返す', () => {
            expect(formatOverrunTime(-10)).toBe('-10分');
            expect(formatOverrunTime(-3.5)).toBe('-3.5分');
        });
    });
});

// ============================================
// 期間フィルターのテスト
// ============================================
describe('期間フィルター', () => {
    function filterLogsByPeriod(logs, period) {
        if (period === 'all') return logs;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return logs.filter(log => {
            const logDate = new Date(log.startDateTime.replace(' ', 'T'));
            const logDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());

            switch (period) {
                case 'today':
                    return logDay.getTime() === today.getTime();
                case 'week': {
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return logDay >= weekAgo;
                }
                case 'month': {
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    return logDay >= monthAgo;
                }
                default:
                    return true;
            }
        });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const formatDate = date => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d} 10:00:00`;
    };

    const todayLog = { id: 1, startDateTime: formatDate(today), taskName: '今日' };

    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoLog = { id: 2, startDateTime: formatDate(threeDaysAgo), taskName: '3日前' };

    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const tenDaysAgoLog = { id: 3, startDateTime: formatDate(tenDaysAgo), taskName: '10日前' };

    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const twoMonthsAgoLog = { id: 4, startDateTime: formatDate(twoMonthsAgo), taskName: '2ヶ月前' };

    const allLogs = [todayLog, threeDaysAgoLog, tenDaysAgoLog, twoMonthsAgoLog];

    test('today - 今日のログのみ返す', () => {
        const result = filterLogsByPeriod(allLogs, 'today');
        expect(result).toHaveLength(1);
        expect(result[0].taskName).toBe('今日');
    });

    test('week - 過去7日間のログを返す', () => {
        const result = filterLogsByPeriod(allLogs, 'week');
        expect(result).toHaveLength(2);
        expect(result.map(l => l.taskName)).toContain('今日');
        expect(result.map(l => l.taskName)).toContain('3日前');
    });

    test('month - 過去1ヶ月のログを返す', () => {
        const result = filterLogsByPeriod(allLogs, 'month');
        expect(result).toHaveLength(3);
        expect(result.map(l => l.taskName)).not.toContain('2ヶ月前');
    });

    test('all - 全てのログを返す', () => {
        const result = filterLogsByPeriod(allLogs, 'all');
        expect(result).toHaveLength(4);
    });
});

// ============================================
// タスク別合計時間のテスト
// ============================================
describe('タスク別合計時間', () => {
    function calculateTaskTotals(logs) {
        const totals = {};
        logs.forEach(log => {
            const taskName = log.taskName || '不明';
            if (!totals[taskName]) {
                totals[taskName] = 0;
            }
            totals[taskName] += log.duration;
        });
        return totals;
    }

    test('空のログ配列は空のオブジェクトを返す', () => {
        expect(calculateTaskTotals([])).toEqual({});
    });

    test('単一タスクの合計を計算する', () => {
        const logs = [
            { taskName: 'タスクA', duration: 30 },
            { taskName: 'タスクA', duration: 20 },
        ];
        const result = calculateTaskTotals(logs);
        expect(result['タスクA']).toBe(50);
    });

    test('複数タスクの合計を個別に計算する', () => {
        const logs = [
            { taskName: 'タスクA', duration: 30 },
            { taskName: 'タスクB', duration: 15 },
            { taskName: 'タスクA', duration: 20 },
            { taskName: 'タスクB', duration: 25 },
        ];
        const result = calculateTaskTotals(logs);
        expect(result['タスクA']).toBe(50);
        expect(result['タスクB']).toBe(40);
    });

    test('タスク名がない場合は"不明"として集計する', () => {
        const logs = [
            { taskName: '', duration: 10 },
            { taskName: null, duration: 20 },
            { duration: 15 },
        ];
        const result = calculateTaskTotals(logs);
        expect(result['不明']).toBe(45);
    });
});

// ============================================
// ログ編集時の実行時間再計算のテスト
// ============================================
describe('ログ編集時の実行時間再計算', () => {
    function parseDateTime(dateTimeStr) {
        if (!dateTimeStr) return null;
        const [datePart, timePart] = dateTimeStr.split(' ');
        if (!datePart || !timePart) return null;
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute, second || 0);
    }

    function calculateDurationFromDateTime(startDateTime, endDateTime) {
        const startDate = parseDateTime(startDateTime);
        const endDate = parseDateTime(endDateTime);

        if (!startDate || !endDate || endDate <= startDate) {
            return null;
        }

        const durationMs = endDate.getTime() - startDate.getTime();
        return parseFloat((durationMs / 1000 / 60).toFixed(1));
    }

    test('正常な日時から実行時間を計算する', () => {
        const result = calculateDurationFromDateTime('2025-01-15 10:00:00', '2025-01-15 10:30:00');
        expect(result).toBe(30);
    });

    test('秒単位の差も計算する', () => {
        const result = calculateDurationFromDateTime('2025-01-15 10:00:00', '2025-01-15 10:15:30');
        expect(result).toBe(15.5);
    });

    test('終了時刻が開始時刻より前の場合はnullを返す', () => {
        const result = calculateDurationFromDateTime('2025-01-15 10:30:00', '2025-01-15 10:00:00');
        expect(result).toBe(null);
    });

    test('同じ時刻の場合はnullを返す', () => {
        const result = calculateDurationFromDateTime('2025-01-15 10:00:00', '2025-01-15 10:00:00');
        expect(result).toBe(null);
    });

    test('不正な日時形式の場合はnullを返す', () => {
        expect(calculateDurationFromDateTime('invalid', '2025-01-15 10:00:00')).toBe(null);
        expect(calculateDurationFromDateTime('2025-01-15 10:00:00', 'invalid')).toBe(null);
        expect(calculateDurationFromDateTime(null, '2025-01-15 10:00:00')).toBe(null);
    });
});

// ============================================
// ログ全削除のテスト
// ============================================
describe('ログ全削除', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('全てのログを削除できる', () => {
        const logs = [
            { id: 1, taskName: 'タスク1', duration: 30 },
            { id: 2, taskName: 'タスク2', duration: 20 },
        ];
        localStorage.setItem('taskManager_logs', JSON.stringify(logs));

        // 削除処理
        localStorage.setItem('taskManager_logs', JSON.stringify([]));

        const result = JSON.parse(localStorage.getItem('taskManager_logs'));
        expect(result).toEqual([]);
    });

    test('空のログに対して削除しても問題ない', () => {
        localStorage.setItem('taskManager_logs', JSON.stringify([]));

        // 削除処理
        localStorage.setItem('taskManager_logs', JSON.stringify([]));

        const result = JSON.parse(localStorage.getItem('taskManager_logs'));
        expect(result).toEqual([]);
    });
});

// ============================================
// メモ帳機能のテスト
// ============================================
describe('メモ帳機能', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    const STORAGE_KEY_MEMOS = 'taskManager_memos';

    function getMemoData() {
        const data = localStorage.getItem(STORAGE_KEY_MEMOS);
        if (!data) {
            return {
                memos: [{ id: 1, name: 'メモ1', content: '' }],
                activeTabId: 1,
                isCollapsed: false,
            };
        }
        return JSON.parse(data);
    }

    function saveMemoData(data) {
        localStorage.setItem(STORAGE_KEY_MEMOS, JSON.stringify(data));
    }

    describe('getMemoData / saveMemoData', () => {
        test('初回アクセス時はデフォルト値を返す', () => {
            const data = getMemoData();
            expect(data.memos).toHaveLength(1);
            expect(data.memos[0].name).toBe('メモ1');
            expect(data.memos[0].content).toBe('');
            expect(data.activeTabId).toBe(1);
            expect(data.isCollapsed).toBe(false);
        });

        test('保存したデータを取得できる', () => {
            const testData = {
                memos: [
                    { id: 1, name: 'メモA', content: 'テスト内容' },
                    { id: 2, name: 'メモB', content: '別の内容' },
                ],
                activeTabId: 2,
                isCollapsed: true,
            };
            saveMemoData(testData);

            const result = getMemoData();
            expect(result.memos).toHaveLength(2);
            expect(result.memos[0].content).toBe('テスト内容');
            expect(result.activeTabId).toBe(2);
            expect(result.isCollapsed).toBe(true);
        });
    });

    describe('タブ追加', () => {
        test('新しいタブを追加できる', () => {
            const data = getMemoData();
            const newId = Date.now();
            const newMemo = { id: newId, name: 'メモ2', content: '' };
            data.memos.push(newMemo);
            data.activeTabId = newId;
            saveMemoData(data);

            const result = getMemoData();
            expect(result.memos).toHaveLength(2);
            expect(result.memos[1].name).toBe('メモ2');
        });

        test('最大10個まで追加できる', () => {
            const data = getMemoData();
            for (let i = 2; i <= 10; i++) {
                data.memos.push({ id: i, name: `メモ${i}`, content: '' });
            }
            saveMemoData(data);

            const result = getMemoData();
            expect(result.memos).toHaveLength(10);
        });

        test('10個を超える追加は制限される（ロジックテスト）', () => {
            const data = getMemoData();
            for (let i = 2; i <= 10; i++) {
                data.memos.push({ id: i, name: `メモ${i}`, content: '' });
            }

            // 11個目の追加を試みる
            const canAdd = data.memos.length < 10;
            expect(canAdd).toBe(false);
        });
    });

    describe('タブ削除', () => {
        test('指定したタブを削除できる', () => {
            const data = {
                memos: [
                    { id: 1, name: 'メモ1', content: '' },
                    { id: 2, name: 'メモ2', content: '' },
                    { id: 3, name: 'メモ3', content: '' },
                ],
                activeTabId: 2,
                isCollapsed: false,
            };
            saveMemoData(data);

            // タブ2を削除
            const updated = getMemoData();
            updated.memos = updated.memos.filter(m => m.id !== 2);
            if (updated.activeTabId === 2) {
                updated.activeTabId = updated.memos[0]?.id || null;
            }
            saveMemoData(updated);

            const result = getMemoData();
            expect(result.memos).toHaveLength(2);
            expect(result.memos.find(m => m.id === 2)).toBeUndefined();
            expect(result.activeTabId).toBe(1);
        });

        test('最後の1つは削除できない（ロジックテスト）', () => {
            const data = getMemoData();
            const canDelete = data.memos.length > 1;
            expect(canDelete).toBe(false);
        });

        test('アクティブなタブを削除すると別のタブがアクティブになる', () => {
            const data = {
                memos: [
                    { id: 1, name: 'メモ1', content: '' },
                    { id: 2, name: 'メモ2', content: '' },
                ],
                activeTabId: 1,
                isCollapsed: false,
            };
            saveMemoData(data);

            // アクティブなタブ1を削除
            const updated = getMemoData();
            updated.memos = updated.memos.filter(m => m.id !== 1);
            updated.activeTabId = updated.memos[0]?.id || null;
            saveMemoData(updated);

            const result = getMemoData();
            expect(result.activeTabId).toBe(2);
        });
    });
});

// ============================================
// 時間軸ラベル生成のテスト
// ============================================
describe('時間軸ラベル生成', () => {
    function generateAxisLabels(timeRange) {
        const labels = [];
        const durationMs = timeRange.duration;
        const durationHours = durationMs / (1000 * 60 * 60);

        let intervalMinutes;
        if (durationHours <= 1) {
            intervalMinutes = 10;
        } else if (durationHours <= 2) {
            intervalMinutes = 15;
        } else if (durationHours <= 4) {
            intervalMinutes = 30;
        } else if (durationHours <= 8) {
            intervalMinutes = 60;
        } else {
            intervalMinutes = 120;
        }

        const startDate = new Date(timeRange.minTime);
        const endDate = new Date(timeRange.maxTime);

        const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
        const roundedStartMinutes = Math.ceil(startMinutes / intervalMinutes) * intervalMinutes;

        const labelDate = new Date(startDate);
        labelDate.setHours(Math.floor(roundedStartMinutes / 60), roundedStartMinutes % 60, 0, 0);

        while (labelDate.getTime() <= endDate.getTime()) {
            const position = ((labelDate.getTime() - timeRange.minTime) / timeRange.duration) * 100;
            const hours = String(labelDate.getHours()).padStart(2, '0');
            const minutes = String(labelDate.getMinutes()).padStart(2, '0');

            labels.push({
                text: `${hours}:${minutes}`,
                position: position,
            });

            labelDate.setMinutes(labelDate.getMinutes() + intervalMinutes);
        }

        return labels;
    }

    test('1時間以内は10分間隔でラベルを生成', () => {
        const now = new Date();
        now.setHours(10, 0, 0, 0);
        const end = new Date(now);
        end.setMinutes(end.getMinutes() + 50);

        const timeRange = {
            minTime: now.getTime(),
            maxTime: end.getTime(),
            duration: end.getTime() - now.getTime(),
        };

        const labels = generateAxisLabels(timeRange);
        expect(labels.length).toBeGreaterThan(0);
        expect(labels[0].text).toMatch(/^\d{2}:\d{2}$/);
    });

    test('2時間以内は15分間隔でラベルを生成', () => {
        const now = new Date();
        now.setHours(10, 0, 0, 0);
        const end = new Date(now);
        end.setHours(end.getHours() + 1, 30);

        const timeRange = {
            minTime: now.getTime(),
            maxTime: end.getTime(),
            duration: end.getTime() - now.getTime(),
        };

        const labels = generateAxisLabels(timeRange);
        expect(labels.length).toBeGreaterThan(0);
    });

    test('4時間以内は30分間隔でラベルを生成', () => {
        const now = new Date();
        now.setHours(10, 0, 0, 0);
        const end = new Date(now);
        end.setHours(end.getHours() + 3);

        const timeRange = {
            minTime: now.getTime(),
            maxTime: end.getTime(),
            duration: end.getTime() - now.getTime(),
        };

        const labels = generateAxisLabels(timeRange);
        expect(labels.length).toBeGreaterThan(0);
    });

    test('8時間以内は60分間隔でラベルを生成', () => {
        const now = new Date();
        now.setHours(9, 0, 0, 0);
        const end = new Date(now);
        end.setHours(end.getHours() + 6);

        const timeRange = {
            minTime: now.getTime(),
            maxTime: end.getTime(),
            duration: end.getTime() - now.getTime(),
        };

        const labels = generateAxisLabels(timeRange);
        expect(labels.length).toBeGreaterThan(0);
    });

    test('ラベルにはpositionプロパティが含まれる', () => {
        const now = new Date();
        now.setHours(10, 0, 0, 0);
        const end = new Date(now);
        end.setMinutes(end.getMinutes() + 30);

        const timeRange = {
            minTime: now.getTime(),
            maxTime: end.getTime(),
            duration: end.getTime() - now.getTime(),
        };

        const labels = generateAxisLabels(timeRange);
        labels.forEach(label => {
            expect(label).toHaveProperty('text');
            expect(label).toHaveProperty('position');
            expect(typeof label.position).toBe('number');
            expect(label.position).toBeGreaterThanOrEqual(0);
            expect(label.position).toBeLessThanOrEqual(100);
        });
    });
});

// ============================================
// バー配置計算（重複回避）のテスト
// ============================================
describe('バー配置計算（重複回避）', () => {
    function parseDateTime(dateTimeStr) {
        if (!dateTimeStr) return null;
        const [datePart, timePart] = dateTimeStr.split(' ');
        if (!datePart || !timePart) return null;
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute, second || 0);
    }

    function assignRows(logs, _timeRange) {
        const rows = [];
        const rowEndTimes = [];

        logs.forEach(log => {
            const startTime = parseDateTime(log.startDateTime).getTime();
            const endTime = parseDateTime(log.endDateTime).getTime();

            let assignedRow = -1;
            for (let i = 0; i < rowEndTimes.length; i++) {
                if (startTime >= rowEndTimes[i]) {
                    assignedRow = i;
                    rowEndTimes[i] = endTime;
                    break;
                }
            }

            if (assignedRow === -1) {
                assignedRow = rowEndTimes.length;
                rowEndTimes.push(endTime);
            }

            rows.push(assignedRow);
        });

        return rows;
    }

    test('重複しないログは同じ行に配置される', () => {
        const logs = [
            { startDateTime: '2025-01-15 10:00:00', endDateTime: '2025-01-15 10:30:00' },
            { startDateTime: '2025-01-15 10:30:00', endDateTime: '2025-01-15 11:00:00' },
            { startDateTime: '2025-01-15 11:00:00', endDateTime: '2025-01-15 11:30:00' },
        ];

        const timeRange = { minTime: 0, maxTime: 0, duration: 0 };
        const rows = assignRows(logs, timeRange);

        expect(rows[0]).toBe(0);
        expect(rows[1]).toBe(0);
        expect(rows[2]).toBe(0);
    });

    test('重複するログは異なる行に配置される', () => {
        const logs = [
            { startDateTime: '2025-01-15 10:00:00', endDateTime: '2025-01-15 11:00:00' },
            { startDateTime: '2025-01-15 10:30:00', endDateTime: '2025-01-15 11:30:00' },
        ];

        const timeRange = { minTime: 0, maxTime: 0, duration: 0 };
        const rows = assignRows(logs, timeRange);

        expect(rows[0]).toBe(0);
        expect(rows[1]).toBe(1);
    });

    test('3つのログが全て重複する場合は3行になる', () => {
        const logs = [
            { startDateTime: '2025-01-15 10:00:00', endDateTime: '2025-01-15 12:00:00' },
            { startDateTime: '2025-01-15 10:30:00', endDateTime: '2025-01-15 12:30:00' },
            { startDateTime: '2025-01-15 11:00:00', endDateTime: '2025-01-15 13:00:00' },
        ];

        const timeRange = { minTime: 0, maxTime: 0, duration: 0 };
        const rows = assignRows(logs, timeRange);

        expect(rows[0]).toBe(0);
        expect(rows[1]).toBe(1);
        expect(rows[2]).toBe(2);
    });

    test('部分的に重複する場合は適切に行を再利用する', () => {
        const logs = [
            { startDateTime: '2025-01-15 10:00:00', endDateTime: '2025-01-15 10:30:00' },
            { startDateTime: '2025-01-15 10:15:00', endDateTime: '2025-01-15 10:45:00' },
            { startDateTime: '2025-01-15 10:30:00', endDateTime: '2025-01-15 11:00:00' },
        ];

        const timeRange = { minTime: 0, maxTime: 0, duration: 0 };
        const rows = assignRows(logs, timeRange);

        expect(rows[0]).toBe(0);
        expect(rows[1]).toBe(1);
        expect(rows[2]).toBe(0); // 1番目が終わった後なので再利用
    });

    test('空のログ配列は空の配列を返す', () => {
        const timeRange = { minTime: 0, maxTime: 0, duration: 0 };
        const rows = assignRows([], timeRange);
        expect(rows).toEqual([]);
    });
});

// ============================================
// ログ全削除の追加テスト
// ============================================
describe('ログ全削除（追加テスト）', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    const STORAGE_KEY_LOGS = 'taskManager_logs';

    function getLogs() {
        const data = localStorage.getItem(STORAGE_KEY_LOGS);
        return data ? JSON.parse(data) : [];
    }

    function saveLogs(logs) {
        localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
    }

    function deleteAllLogs() {
        saveLogs([]);
        return getLogs();
    }

    test('複数のログを一括削除できる', () => {
        const logs = [
            { id: 1, taskName: 'タスク1', duration: 30 },
            { id: 2, taskName: 'タスク2', duration: 20 },
            { id: 3, taskName: 'タスク3', duration: 15 },
        ];
        saveLogs(logs);
        expect(getLogs()).toHaveLength(3);

        const result = deleteAllLogs();
        expect(result).toEqual([]);
        expect(getLogs()).toHaveLength(0);
    });

    test('削除後もLocalStorageキーは存在する', () => {
        const logs = [{ id: 1, taskName: 'タスク1', duration: 30 }];
        saveLogs(logs);
        deleteAllLogs();

        const data = localStorage.getItem(STORAGE_KEY_LOGS);
        expect(data).not.toBeNull();
        expect(JSON.parse(data)).toEqual([]);
    });
});

// ==================== ドラッグ&ドロップ（挿入方式）のテスト ====================
describe('handleDrop - 挿入方式', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('上に移動：タスクを上位に挿入し、間のタスクを繰り下げる', () => {
        // 初期状態: タスクA(優先順位1), タスクB(2), タスクC(3), タスクD(4)
        const tasks = [
            { id: 1, name: 'タスクA', priority: 1, completed: false },
            { id: 2, name: 'タスクB', priority: 2, completed: false },
            { id: 3, name: 'タスクC', priority: 3, completed: false },
            { id: 4, name: 'タスクD', priority: 4, completed: false },
        ];
        localStorage.setItem('taskManager_tasks', JSON.stringify(tasks));

        // タスクD(優先順位4)をタスクB(優先順位2)の位置にドロップ
        const draggedTaskId = 4;
        const targetTaskId = 2;

        const draggedTask = tasks.find(t => t.id === draggedTaskId);
        const targetTask = tasks.find(t => t.id === targetTaskId);
        const oldPriority = draggedTask.priority; // 4
        const newPriority = targetTask.priority; // 2

        // 上に移動：newPriority以上、oldPriority未満のタスクを+1
        tasks.forEach(task => {
            if (!task.completed && task.priority >= newPriority && task.priority < oldPriority) {
                task.priority += 1;
            }
        });
        draggedTask.priority = newPriority;

        // 期待結果: タスクA(1), タスクD(2), タスクB(3), タスクC(4)
        expect(tasks.find(t => t.id === 1).priority).toBe(1); // タスクA: 変更なし
        expect(tasks.find(t => t.id === 4).priority).toBe(2); // タスクD: 4→2
        expect(tasks.find(t => t.id === 2).priority).toBe(3); // タスクB: 2→3
        expect(tasks.find(t => t.id === 3).priority).toBe(4); // タスクC: 3→4
    });

    test('下に移動：タスクを下位に挿入し、間のタスクを繰り上げる', () => {
        // 初期状態: タスクA(優先順位1), タスクB(2), タスクC(3), タスクD(4)
        const tasks = [
            { id: 1, name: 'タスクA', priority: 1, completed: false },
            { id: 2, name: 'タスクB', priority: 2, completed: false },
            { id: 3, name: 'タスクC', priority: 3, completed: false },
            { id: 4, name: 'タスクD', priority: 4, completed: false },
        ];
        localStorage.setItem('taskManager_tasks', JSON.stringify(tasks));

        // タスクA(優先順位1)をタスクC(優先順位3)の位置にドロップ
        const draggedTaskId = 1;
        const targetTaskId = 3;

        const draggedTask = tasks.find(t => t.id === draggedTaskId);
        const targetTask = tasks.find(t => t.id === targetTaskId);
        const oldPriority = draggedTask.priority; // 1
        const newPriority = targetTask.priority; // 3

        // 下に移動：oldPriorityより大きく、newPriority以下のタスクを-1
        tasks.forEach(task => {
            if (!task.completed && task.priority > oldPriority && task.priority <= newPriority) {
                task.priority -= 1;
            }
        });
        draggedTask.priority = newPriority;

        // 期待結果: タスクB(1), タスクC(2), タスクA(3), タスクD(4)
        expect(tasks.find(t => t.id === 2).priority).toBe(1); // タスクB: 2→1
        expect(tasks.find(t => t.id === 3).priority).toBe(2); // タスクC: 3→2
        expect(tasks.find(t => t.id === 1).priority).toBe(3); // タスクA: 1→3
        expect(tasks.find(t => t.id === 4).priority).toBe(4); // タスクD: 変更なし
    });

    test('同じ位置へのドロップは何も変更しない', () => {
        const tasks = [
            { id: 1, name: 'タスクA', priority: 1, completed: false },
            { id: 2, name: 'タスクB', priority: 2, completed: false },
        ];
        localStorage.setItem('taskManager_tasks', JSON.stringify(tasks));

        // タスクAを自分自身にドロップ（同じタスク）
        const draggedTaskId = 1;
        const targetTaskId = 1;

        // 同じタスクの場合は早期リターン
        if (draggedTaskId === targetTaskId) {
            // 変更なし
            expect(tasks.find(t => t.id === 1).priority).toBe(1);
            expect(tasks.find(t => t.id === 2).priority).toBe(2);
        }
    });

    test('完了済みタスクはドラッグ対象外', () => {
        const tasks = [
            { id: 1, name: 'タスクA', priority: 1, completed: true },
            { id: 2, name: 'タスクB', priority: 2, completed: false },
            { id: 3, name: 'タスクC', priority: 3, completed: false },
        ];
        localStorage.setItem('taskManager_tasks', JSON.stringify(tasks));

        const draggedTask = tasks.find(t => t.id === 1);
        const targetTask = tasks.find(t => t.id === 3);

        // 完了済みタスクは処理しない
        if (draggedTask.completed || targetTask.completed) {
            expect(tasks.find(t => t.id === 1).priority).toBe(1);
            expect(tasks.find(t => t.id === 2).priority).toBe(2);
            expect(tasks.find(t => t.id === 3).priority).toBe(3);
        }
    });

    test('隣接するタスク間の移動', () => {
        // 初期状態: タスクA(1), タスクB(2)
        const tasks = [
            { id: 1, name: 'タスクA', priority: 1, completed: false },
            { id: 2, name: 'タスクB', priority: 2, completed: false },
        ];
        localStorage.setItem('taskManager_tasks', JSON.stringify(tasks));

        // タスクB(優先順位2)をタスクA(優先順位1)の位置にドロップ
        const draggedTask = tasks.find(t => t.id === 2);
        const targetTask = tasks.find(t => t.id === 1);
        const oldPriority = draggedTask.priority; // 2
        const newPriority = targetTask.priority; // 1

        // 上に移動
        tasks.forEach(task => {
            if (!task.completed && task.priority >= newPriority && task.priority < oldPriority) {
                task.priority += 1;
            }
        });
        draggedTask.priority = newPriority;

        // 期待結果: タスクB(1), タスクA(2)
        expect(tasks.find(t => t.id === 2).priority).toBe(1); // タスクB: 2→1
        expect(tasks.find(t => t.id === 1).priority).toBe(2); // タスクA: 1→2
    });
});

// ==================== タイマー機能のテスト ====================
describe('タイマー機能', () => {
    const STORAGE_KEY_TIMER = 'taskManager_timer';

    beforeEach(() => {
        localStorage.clear();
    });

    describe('タイマー状態の保存と読み込み', () => {
        test('saveTimerState: タイマー状態をLocalStorageに保存できる', () => {
            const timerState = {
                isRunning: true,
                startTime: '2025-12-30T10:00:00.000Z',
                endTime: '2025-12-30T10:05:00.000Z',
                totalSeconds: 300,
                taskId: 'interrupt',
                taskName: '割り込みタスク',
                taskDetail: 'テスト詳細',
                achievement: 80,
                estimatedTime: 5,
            };

            localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(timerState));

            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_TIMER));
            expect(saved.isRunning).toBe(true);
            expect(saved.totalSeconds).toBe(300);
            expect(saved.taskName).toBe('割り込みタスク');
        });

        test('loadTimerState: 保存されたタイマー状態を読み込める', () => {
            const timerState = {
                isRunning: true,
                startTime: '2025-12-30T10:00:00.000Z',
                endTime: '2025-12-30T10:05:00.000Z',
                totalSeconds: 300,
                taskId: 1,
                taskName: 'テストタスク',
                taskDetail: '',
                achievement: null,
                estimatedTime: 10,
            };

            localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(timerState));

            const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY_TIMER));
            expect(loaded).not.toBeNull();
            expect(loaded.isRunning).toBe(true);
            expect(loaded.taskId).toBe(1);
        });

        test('loadTimerState: 保存データがない場合はnullを返す', () => {
            const loaded = localStorage.getItem(STORAGE_KEY_TIMER);
            expect(loaded).toBeNull();
        });

        test('clearTimerState: タイマー状態をLocalStorageから削除できる', () => {
            const timerState = {
                isRunning: true,
                startTime: '2025-12-30T10:00:00.000Z',
                endTime: '2025-12-30T10:05:00.000Z',
                totalSeconds: 300,
            };

            localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(timerState));
            expect(localStorage.getItem(STORAGE_KEY_TIMER)).not.toBeNull();

            localStorage.removeItem(STORAGE_KEY_TIMER);
            expect(localStorage.getItem(STORAGE_KEY_TIMER)).toBeNull();
        });
    });

    describe('タイマー復元ロジック', () => {
        test('restoreTimer: 有効な残り時間がある場合は復元可能', () => {
            const now = new Date();
            const endTime = new Date(now.getTime() + 60000); // 1分後

            const timerState = {
                isRunning: true,
                startTime: now.toISOString(),
                endTime: endTime.toISOString(),
                totalSeconds: 300,
                taskId: 'interrupt',
                taskName: '割り込みタスク',
            };

            localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(timerState));

            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_TIMER));
            const savedEndTime = new Date(saved.endTime);
            const remainingMs = savedEndTime.getTime() - now.getTime();

            expect(saved.isRunning).toBe(true);
            expect(remainingMs).toBeGreaterThan(0);
        });

        test('restoreTimer: 既に終了している場合は復元しない', () => {
            const now = new Date();
            const endTime = new Date(now.getTime() - 60000); // 1分前（既に終了）

            const timerState = {
                isRunning: true,
                startTime: new Date(now.getTime() - 360000).toISOString(),
                endTime: endTime.toISOString(),
                totalSeconds: 300,
                taskId: 'interrupt',
                taskName: '割り込みタスク',
            };

            localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(timerState));

            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_TIMER));
            const savedEndTime = new Date(saved.endTime);
            const remainingMs = savedEndTime.getTime() - now.getTime();

            // 残り時間が0以下なので復元不可
            expect(remainingMs).toBeLessThanOrEqual(0);
        });

        test('restoreTimer: isRunningがfalseの場合は復元しない', () => {
            const timerState = {
                isRunning: false,
                startTime: null,
                endTime: null,
                totalSeconds: 0,
            };

            localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(timerState));

            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_TIMER));
            expect(saved.isRunning).toBe(false);
            // isRunningがfalseなので復元対象外
        });

        test('restoreTimer: endTimeがない場合は復元しない', () => {
            const timerState = {
                isRunning: true,
                startTime: new Date().toISOString(),
                endTime: null,
                totalSeconds: 300,
            };

            localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(timerState));

            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_TIMER));
            expect(saved.endTime).toBeNull();
            // endTimeがないので復元対象外
        });
    });

    describe('clearTimer動作', () => {
        test('clearTimer: LocalStorageからタイマー状態が削除される', () => {
            const timerState = {
                isRunning: true,
                startTime: '2025-12-30T10:00:00.000Z',
                endTime: '2025-12-30T10:05:00.000Z',
                totalSeconds: 300,
            };

            localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(timerState));
            expect(localStorage.getItem(STORAGE_KEY_TIMER)).not.toBeNull();

            // clearTimerの動作をシミュレート
            localStorage.removeItem(STORAGE_KEY_TIMER);

            expect(localStorage.getItem(STORAGE_KEY_TIMER)).toBeNull();
        });

        test('clearTimer: タイマー状態がリセットされる', () => {
            // clearTimer後の期待される状態
            const resetState = {
                isRunning: false,
                isPaused: false,
                intervalId: null,
                startTime: null,
                endTime: null,
                remainingSeconds: 0,
                totalSeconds: 0,
                taskId: null,
                taskName: '',
                taskDetail: '',
                achievement: null,
                estimatedTime: 0,
            };

            expect(resetState.isRunning).toBe(false);
            expect(resetState.isPaused).toBe(false);
            expect(resetState.remainingSeconds).toBe(0);
            expect(resetState.taskId).toBeNull();
        });
    });

    describe('stopTimer動作', () => {
        test('stopTimer: 実行中のタイマーを停止できる', () => {
            const timerState = {
                isRunning: true,
                startTime: '2025-12-30T10:00:00.000Z',
                endTime: '2025-12-30T10:05:00.000Z',
                totalSeconds: 300,
            };

            localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(timerState));

            // stopTimerの動作をシミュレート
            timerState.isRunning = false;
            localStorage.removeItem(STORAGE_KEY_TIMER);

            expect(timerState.isRunning).toBe(false);
            expect(localStorage.getItem(STORAGE_KEY_TIMER)).toBeNull();
        });

        test('stopTimer: 実行中でない場合は何もしない', () => {
            const timerState = {
                isRunning: false,
            };

            // isRunningがfalseの場合は早期リターン
            if (!timerState.isRunning) {
                expect(timerState.isRunning).toBe(false);
            }
        });
    });

    describe('タイマー残り時間計算', () => {
        test('残り時間の計算が正しい', () => {
            const now = new Date();
            const endTime = new Date(now.getTime() + 300000); // 5分後

            const remainingMs = endTime.getTime() - now.getTime();
            const remainingSeconds = Math.ceil(remainingMs / 1000);

            expect(remainingSeconds).toBe(300);
        });

        test('経過後の残り時間計算', () => {
            const now = new Date();
            const startTime = new Date(now.getTime() - 120000); // 2分前に開始
            const endTime = new Date(startTime.getTime() + 300000); // 開始から5分後

            const remainingMs = endTime.getTime() - now.getTime();
            const remainingSeconds = Math.ceil(remainingMs / 1000);

            // 5分 - 2分 = 3分 = 180秒
            expect(remainingSeconds).toBe(180);
        });
    });
});

// ==================== タスク選択時の想定時間自動設定テスト ====================
describe('handleTaskSelect - 想定時間自動設定', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('想定時間が設定されているタスクを選択すると、カスタム時間が更新される', () => {
        // タスクの想定時間
        const task = {
            id: 1,
            name: 'テストタスク',
            estimatedTime: 30,
        };

        // 選択されたオプションのdata-estimatedから値を取得するシミュレーション
        const estimatedTime = task.estimatedTime;
        let timerMinutesValue = 5; // デフォルト値

        if (estimatedTime > 0) {
            timerMinutesValue = estimatedTime;
        }

        expect(timerMinutesValue).toBe(30);
    });

    test('想定時間が0のタスク（割り込みタスク）を選択しても、カスタム時間は変更されない', () => {
        const task = {
            id: 'interrupt',
            name: '割り込みタスク',
            estimatedTime: 0,
        };

        const estimatedTime = task.estimatedTime;
        let timerMinutesValue = 5; // デフォルト値

        // 想定時間が0以下の場合は変更しない
        if (estimatedTime > 0) {
            timerMinutesValue = estimatedTime;
        }

        expect(timerMinutesValue).toBe(5); // デフォルト値のまま
    });

    test('想定時間がnullのタスクを選択しても、カスタム時間は変更されない', () => {
        const task = {
            id: 2,
            name: 'タスク2',
            estimatedTime: null,
        };

        const estimatedTime = parseInt(task.estimatedTime) || 0;
        let timerMinutesValue = 10;

        if (estimatedTime > 0) {
            timerMinutesValue = estimatedTime;
        }

        expect(timerMinutesValue).toBe(10); // 変更されない
    });
});
