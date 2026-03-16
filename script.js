// Google Apps Script API URL
const API_URL =
    'https://script.google.com/macros/s/AKfycby-TItXSiEJL9ixqddz-h0-FkuBKe7cmpSD9lmiuk7YhauovFZweiaB2qa8IF0i1QkU/exec';

// データ同期フラグ
let isSyncing = false;

// Google Sheets からデータを読み込む
async function loadFromGoogleSheets() {
    try {
        const response = await fetch(`${API_URL}?action=readAll`);
        const data = await response.json();

        if (data.error) {
            console.error('Google Sheets読み込みエラー:', data.error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Google Sheets接続エラー:', error);
        return null;
    }
}

// Google Sheets に追記する（既存データを消さない）
async function appendToGoogleSheets(sheetName, rows) {
    if (isSyncing) return;
    isSyncing = true;

    try {
        const params = new URLSearchParams();
        params.append('action', 'append');
        params.append('sheet', sheetName);
        params.append('data', JSON.stringify(rows));

        const response = await fetch(API_URL, {
            method: 'POST',
            body: params,
        });

        const result = await response.json();

        if (result.error) {
            console.error('Google Sheets追記エラー:', result.error);
        } else {
            console.log(`Google Sheets [${sheetName}] に追記完了`);
        }

        return result;
    } catch (error) {
        console.error('Google Sheets接続エラー:', error);
        return null;
    } finally {
        isSyncing = false;
    }
}

// Google Sheets にデータを保存する（上書き）
async function saveToGoogleSheets(sheetName, data) {
    if (isSyncing) return;
    isSyncing = true;

    try {
        const params = new URLSearchParams();
        params.append('action', 'write');
        params.append('sheet', sheetName);
        params.append('data', JSON.stringify(data));

        const response = await fetch(API_URL, {
            method: 'POST',
            body: params,
        });

        const result = await response.json();

        if (result.error) {
            console.error('Google Sheets保存エラー:', result.error);
        }

        return result;
    } catch (error) {
        console.error('Google Sheets接続エラー:', error);
        return null;
    } finally {
        isSyncing = false;
    }
}

// Google SheetsからLocalStorageに同期
async function syncFromGoogleSheets() {
    const data = await loadFromGoogleSheets();
    console.log('Google Sheetsからのデータ:', data);

    if (data && data.logs) {
        console.log('logs詳細:', JSON.stringify(data.logs, null, 2));
    }

    if (data) {
        if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
            localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(data.tasks));
        }
        if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(data.logs));
        }
        if (data.memos && Array.isArray(data.memos) && data.memos.length > 0) {
            const memos = data.memos.map(row => ({
                id: row.id || Date.now(),
                name: row.name || 'メモ',
                content: row.content || '',
            }));

            const existingData = getMemoData();

            const memoData = {
                memos: memos,
                activeTabId: existingData.activeTabId || memos[0]?.id || 1,
                isCollapsed: existingData.isCollapsed || false,
            };

            localStorage.setItem(STORAGE_KEY_MEMOS, JSON.stringify(memoData));
        }

        console.log('Google Sheetsから同期完了');
        return true;
    }

    return false;
}

// ==================== 定数 ====================
const STORAGE_KEY_TASKS = 'taskManager_tasks';
const STORAGE_KEY_LOGS = 'taskManager_logs';

// ==================== 状態管理 ====================
let editingTaskId = null;
let editingLogId = null;
let draggedTaskId = null;
let notificationAudio = null;
let logFilterStartDate = null;
let logFilterEndDate = null;

// タイマー状態
const timerState = {
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

// ==================== 初期化 ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    const today = getTodayString();
    const targetDateInput = document.getElementById('targetDate');
    if (targetDateInput) {
        targetDateInput.value = today;
    }

    const statusEl = document.createElement('div');
    statusEl.id = 'syncStatus';
    statusEl.textContent = '同期中...';
    statusEl.style.cssText =
        'position:fixed;top:10px;right:10px;background:#2563eb;color:white;padding:8px 16px;border-radius:4px;z-index:9999;';
    document.body.appendChild(statusEl);

    const synced = await syncFromGoogleSheets();

    if (synced) {
        statusEl.textContent = '同期完了';
        statusEl.style.background = '#059669';
    } else {
        statusEl.textContent = 'オフラインモード';
        statusEl.style.background = '#f59e0b';
    }

    setTimeout(() => statusEl.remove(), 2000);

    const timerMinutesInput = document.getElementById('timerMinutes');
    if (timerMinutesInput) {
        timerMinutesInput.addEventListener('change', updateTimerDisplay);
        timerMinutesInput.addEventListener('input', updateTimerDisplay);
    }

    renderTasks();
    updateTaskSelect();
    initializeLogFilter();
    renderLogs();
    initializeMemo();
    updateStats();
    initializeChart();
    updateTaskSummary();
    restoreTimer();
}

// ==================== ユーティリティ関数 ====================
function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

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

function formatDateTimeForFileName(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function formatDateForCsv(isoString) {
    const d = new Date(isoString);
    return formatDateTimeWithSeconds(d);
}

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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeCsvField(text) {
    if (!text) return '';
    return text.replace(/"/g, '""');
}

// ==================== LocalStorage 操作 ====================
function getTasks() {
    const data = localStorage.getItem(STORAGE_KEY_TASKS);
    return data ? JSON.parse(data) : [];
}

function saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    saveToGoogleSheets('tasks', tasks);
}

function getLogs() {
    const data = localStorage.getItem(STORAGE_KEY_LOGS);
    return data ? JSON.parse(data) : [];
}

function saveLogs(logs) {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
}

function updateTaskSummary() {
    const logs = getFilteredLogs();
    const totalDuration = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const logCount = logs.length;

    const totalElapsedTimeEl = document.getElementById('totalElapsedTime');
    const totalLogCountEl = document.getElementById('totalLogCount');

    if (totalElapsedTimeEl) {
        totalElapsedTimeEl.textContent = `合計経過時間: ${totalDuration.toFixed(1)}分`;
    }

    if (totalLogCountEl) {
        totalLogCountEl.textContent = `件数: ${logCount}件`;
    }
}

// ==================== タスク操作 ====================
function addTask(event) {
    event.preventDefault();

    const nameInput = document.getElementById('taskName');
    const priorityInput = document.getElementById('taskPriority');
    const timeInput = document.getElementById('taskTime');
    const dateInput = document.getElementById('taskDate');

    const name = nameInput.value.trim();
    if (!name) return;

    const tasks = getTasks();

    let priority = priorityInput.value ? parseInt(priorityInput.value) : null;
    if (priority === null) {
        const incompleteTasks = tasks.filter(t => !t.completed);
        if (incompleteTasks.length === 0) {
            priority = 1;
        } else {
            const maxPriority = Math.max(...incompleteTasks.map(t => t.priority));
            priority = maxPriority + 1;
        }
    } else {
        tasks.forEach(task => {
            if (!task.completed && task.priority >= priority) {
                task.priority++;
            }
        });
    }

    const newTask = {
        id: Date.now(),
        name: name,
        priority: priority,
        estimatedTime: parseInt(timeInput.value) || 30,
        targetDate: dateInput.value || getTodayString(),
        completed: false,
        createdAt: new Date().toISOString(),
    };

    tasks.push(newTask);
    saveTasks(tasks);

    nameInput.value = '';
    priorityInput.value = '';
    timeInput.value = '30';
    dateInput.value = getTodayString();
    nameInput.focus();

    renderTasks();
    updateStats();
    updateTaskSelect();
}

function toggleComplete(taskId) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;

        if (task.completed) {
            renumberPriorities(tasks);
        }

        saveTasks(tasks);
        renderTasks();
        updateStats();
        updateTaskSelect();
    }
}

function deleteTask(taskId) {
    const tasks = getTasks().filter(t => t.id !== taskId);
    renumberPriorities(tasks);
    saveTasks(tasks);
    renderTasks();
    updateStats();
    updateTaskSelect();
}

function deleteSelectedTasks() {
    const checkboxes = document.querySelectorAll('.task-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('削除するタスクを選択してください');
        return;
    }

    const idsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.taskId));
    const tasks = getTasks().filter(t => !idsToDelete.includes(t.id));
    renumberPriorities(tasks);
    saveTasks(tasks);
    renderTasks();
    updateStats();
    updateTaskSelect();
}

function deleteAllTasks() {
    if (!confirm('本当に全てのタスクを削除しますか？\nこの操作は取り消せません。')) {
        return;
    }

    saveTasks([]);
    renderTasks();
    updateStats();
    updateTaskSelect();
}

function renumberPriorities(tasks) {
    const incompleteTasks = tasks.filter(t => !t.completed).sort((a, b) => a.priority - b.priority);
    incompleteTasks.forEach((task, index) => {
        task.priority = index + 1;
    });
}

// ==================== タスク編集 ====================
function startEdit(taskId) {
    if (editingTaskId !== null) {
        cancelEdit();
    }
    editingTaskId = taskId;
    renderTasks();
}

function cancelEdit() {
    editingTaskId = null;
    renderTasks();
}

function saveEdit(taskId) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const nameInput = document.getElementById(`edit-name-${taskId}`);
    const priorityInput = document.getElementById(`edit-priority-${taskId}`);
    const timeInput = document.getElementById(`edit-time-${taskId}`);
    const dateInput = document.getElementById(`edit-date-${taskId}`);

    const newName = nameInput.value.trim();
    if (!newName) {
        alert('タスク名は必須です');
        return;
    }

    const newPriority = parseInt(priorityInput.value) || 1;

    if (newPriority !== task.priority) {
        tasks.forEach(t => {
            if (t.id !== taskId && !t.completed) {
                if (newPriority <= t.priority && t.priority < task.priority) {
                    t.priority++;
                } else if (newPriority >= t.priority && t.priority > task.priority) {
                    t.priority--;
                }
            }
        });
    }

    task.name = newName;
    task.priority = newPriority;
    task.estimatedTime = parseInt(timeInput.value) || 30;
    task.targetDate = dateInput.value || getTodayString();

    renumberPriorities(tasks);
    saveTasks(tasks);
    editingTaskId = null;
    renderTasks();
    updateStats();
    updateTaskSelect();
}

function handleEditKeypress(event, taskId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        saveEdit(taskId);
    } else if (event.key === 'Escape') {
        cancelEdit();
    }
}

// ==================== ドラッグ&ドロップ ====================
function handleDragStart(event, taskId) {
    draggedTaskId = taskId;
    event.dataTransfer.effectAllowed = 'move';
    event.target.closest('tr').classList.add('dragging');
}

function handleDragEnd(event) {
    draggedTaskId = null;
    event.target.closest('tr')?.classList.remove('dragging');
    document
        .querySelectorAll('.drop-indicator-above, .drop-indicator-below, .drag-over')
        .forEach(el => {
            el.classList.remove('drop-indicator-above', 'drop-indicator-below', 'drag-over');
        });
}

function handleDragOver(event, targetTaskId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (draggedTaskId === null || draggedTaskId === targetTaskId) return;

    const targetRow = event.target.closest('tr');
    if (!targetRow) return;

    const rect = targetRow.getBoundingClientRect();
    const mouseY = event.clientY;
    const threshold = rect.top + rect.height / 2;

    const isAbove = mouseY < threshold;
    const hasAbove = targetRow.classList.contains('drop-indicator-above');
    const hasBelow = targetRow.classList.contains('drop-indicator-below');

    if (isAbove && !hasAbove) {
        document
            .querySelectorAll('.drop-indicator-above, .drop-indicator-below, .drag-over')
            .forEach(el => {
                if (el !== targetRow) {
                    el.classList.remove(
                        'drop-indicator-above',
                        'drop-indicator-below',
                        'drag-over'
                    );
                }
            });
        targetRow.classList.add('drag-over', 'drop-indicator-above');
        targetRow.classList.remove('drop-indicator-below');
    } else if (!isAbove && !hasBelow) {
        document
            .querySelectorAll('.drop-indicator-above, .drop-indicator-below, .drag-over')
            .forEach(el => {
                if (el !== targetRow) {
                    el.classList.remove(
                        'drop-indicator-above',
                        'drop-indicator-below',
                        'drag-over'
                    );
                }
            });
        targetRow.classList.add('drag-over', 'drop-indicator-below');
        targetRow.classList.remove('drop-indicator-above');
    }
}

function handleDragLeave(event) {
    const targetRow = event.target.closest('tr');
    if (targetRow) {
        targetRow.classList.remove('drop-indicator-above', 'drop-indicator-below', 'drag-over');
    }
}

function handleDrop(event, targetTaskId) {
    event.preventDefault();

    document
        .querySelectorAll('.drop-indicator-above, .drop-indicator-below, .drag-over, .dragging')
        .forEach(el => {
            el.classList.remove(
                'drop-indicator-above',
                'drop-indicator-below',
                'drag-over',
                'dragging'
            );
        });

    if (draggedTaskId === null || draggedTaskId === targetTaskId) return;

    const tasks = getTasks();
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);

    if (!draggedTask || !targetTask || draggedTask.completed || targetTask.completed) return;

    const oldPriority = draggedTask.priority;
    const newPriority = targetTask.priority;

    if (oldPriority === newPriority) return;

    if (oldPriority > newPriority) {
        tasks.forEach(task => {
            if (!task.completed && task.priority >= newPriority && task.priority < oldPriority) {
                task.priority += 1;
            }
        });
    } else {
        tasks.forEach(task => {
            if (!task.completed && task.priority > oldPriority && task.priority <= newPriority) {
                task.priority -= 1;
            }
        });
    }

    draggedTask.priority = newPriority;

    renumberPriorities(tasks);
    saveTasks(tasks);
    renderTasks();
    updateTaskSelect();
}

// ==================== タスク表示 ====================
function renderTasks() {
    const tasks = getTasks();
    const taskList = document.getElementById('taskList');

    if (!taskList) return;

    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="no-tasks">タスクがありません</p>';
        return;
    }

    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        return a.priority - b.priority;
    });

    let html = `
        <table class="task-table">
            <thead>
                <tr>
                    <th></th>
                    <th>選択</th>
                    <th>優先</th>
                    <th>タスク名</th>
                    <th>想定時間</th>
                    <th>対象日</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;

    sortedTasks.forEach(task => {
        const isEditing = editingTaskId === task.id;
        const priorityClass = getPriorityClass(task.priority);
        const rowClass = task.completed ? 'completed' : '';

        if (isEditing) {
            html += `
                <tr class="editing">
                    <td></td>
                    <td></td>
                    <td>
                        <input type="number" class="inline-edit" id="edit-priority-${task.id}" 
                            value="${task.priority}" min="1" 
                            onkeydown="handleEditKeypress(event, ${task.id})">
                    </td>
                    <td>
                        <input type="text" class="inline-edit" id="edit-name-${task.id}" 
                            value="${escapeHtml(task.name)}" 
                            onkeydown="handleEditKeypress(event, ${task.id})">
                    </td>
                    <td>
                        <input type="number" class="inline-edit" id="edit-time-${task.id}" 
                            value="${task.estimatedTime}" min="1"
                            onkeydown="handleEditKeypress(event, ${task.id})">
                    </td>
                    <td>
                        <input type="date" class="inline-edit" id="edit-date-${task.id}" 
                            value="${task.targetDate}"
                            onkeydown="handleEditKeypress(event, ${task.id})">
                    </td>
                    <td class="edit-actions">
                        <button class="task-btn btn-save" onclick="saveEdit(${task.id})">保存</button>
                        <button class="task-btn btn-cancel" onclick="cancelEdit()">取消</button>
                    </td>
                </tr>
            `;
        } else {
            const draggable = !task.completed ? 'draggable="true"' : '';
            const dragEvents = !task.completed
                ? `
                ondragstart="handleDragStart(event, ${task.id})"
                ondragend="handleDragEnd(event)"
                ondragover="handleDragOver(event)"
                ondragleave="handleDragLeave(event)"
                ondrop="handleDrop(event, ${task.id})"
            `
                : '';

            html += `
                <tr class="${rowClass}" ${draggable} ${dragEvents}>
                    <td>
                        ${!task.completed ? '<span class="drag-handle">⋮⋮</span>' : ''}
                    </td>
                    <td>
                        <input type="checkbox" class="task-checkbox" data-task-id="${task.id}">
                    </td>
                    <td>
                        <span class="priority-badge ${priorityClass}">${task.priority}</span>
                    </td>
                    <td><span class="task-name-text" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" ondragstart="return false">${escapeHtml(task.name)}</span></td>
                    <td>${formatTime(task.estimatedTime)}</td>
                    <td>${task.targetDate}</td>
                    <td>
                        <button class="task-btn btn-complete" onclick="toggleComplete(${task.id})">
                            ${task.completed ? '戻す' : '完了'}
                        </button>
                        <button class="task-btn btn-edit" onclick="startEdit(${task.id})">編集</button>
                        <button class="task-btn btn-delete" onclick="deleteTask(${task.id})">削除</button>
                    </td>
                </tr>
            `;
        }
    });

    html += '</tbody></table>';
    taskList.innerHTML = html;
}

function getPriorityClass(priority) {
    if (priority <= 3) return 'priority-high';
    if (priority <= 6) return 'priority-medium';
    return 'priority-low';
}

// ==================== 統計更新 ====================
function updateStats() {
    const tasks = getTasks();
    const incompleteTasks = tasks.filter(t => !t.completed);
    const totalTime = incompleteTasks.reduce((sum, t) => sum + t.estimatedTime, 0);

    document.getElementById('totalTasks').textContent = tasks.length;
    document.getElementById('incompleteTasks').textContent = incompleteTasks.length;
    document.getElementById('totalTime').textContent = formatTime(totalTime);
}

// ==================== タイマー機能 ====================
function updateTaskSelect() {
    const tasks = getTasks();
    const select = document.getElementById('taskSelect');
    if (!select) return;

    const incompleteTasks = tasks.filter(t => !t.completed).sort((a, b) => a.priority - b.priority);

    let html = '<option value="interrupt" data-estimated="0">割り込みタスク</option>';
    incompleteTasks.forEach(task => {
        html += `<option value="${task.id}" data-estimated="${task.estimatedTime}">${escapeHtml(task.name)}</option>`;
    });

    select.innerHTML = html;
}

function handleTaskSelect() {
    const taskSelect = document.getElementById('taskSelect');
    const timerMinutes = document.getElementById('timerMinutes');

    if (!taskSelect || !timerMinutes) return;

    const selectedOption = taskSelect.options[taskSelect.selectedIndex];
    const estimatedTime = parseInt(selectedOption.dataset.estimated) || 0;

    if (estimatedTime > 0) {
        timerMinutes.value = estimatedTime;
        updateTimerDisplay();
    }
}

function setPresetTime(minutes) {
    const input = document.getElementById('timerMinutes');
    if (input) {
        input.value = minutes;
        updateTimerDisplay();
    }
}

function updateTimerDisplay() {
    if (timerState.isRunning) return;

    const input = document.getElementById('timerMinutes');
    const display = document.getElementById('timerDisplay');

    if (input && display) {
        const minutes = parseInt(input.value) || 0;
        const displayMinutes = String(minutes).padStart(2, '0');
        display.textContent = `${displayMinutes}:00`;
    }
}

function formatTimerDisplay(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTimer() {
    const taskSelect = document.getElementById('taskSelect');
    const timeInput = document.getElementById('timerMinutes');
    const taskDetailInput = document.getElementById('taskDetail');
    const achievementInput = document.getElementById('achievement');

    const minutes = parseInt(timeInput.value);
    if (!minutes || minutes < 1) {
        showTimerMessage('1分以上を入力してください', 'error');
        return;
    }

    if (timerState.isPaused) {
        timerState.isPaused = false;
        timerState.isRunning = true;
        timerState.intervalId = setInterval(timerTick, 1000);

        document.getElementById('timerStartBtn').disabled = true;
        document.getElementById('timerStopBtn').disabled = false;
        showTimerMessage('再開しました', 'success');
        return;
    }

    const selectedOption = taskSelect.options[taskSelect.selectedIndex];
    const taskId = taskSelect.value === 'interrupt' ? 'interrupt' : parseInt(taskSelect.value);
    const taskName = selectedOption.text;
    const estimatedTime = parseInt(selectedOption.dataset.estimated) || 0;

    let achievement = achievementInput.value ? parseInt(achievementInput.value) : null;
    if (achievement !== null) {
        achievement = Math.max(0, Math.min(100, achievement));
    }

    timerState.isRunning = true;
    timerState.isPaused = false;
    timerState.startTime = new Date();
    timerState.totalSeconds = minutes * 60;
    timerState.remainingSeconds = timerState.totalSeconds;
    timerState.taskId = taskId;
    timerState.taskName = taskName;
    timerState.taskDetail = taskDetailInput.value || '';
    timerState.achievement = achievement;
    timerState.estimatedTime = estimatedTime;

    timerState.endTime = new Date(timerState.startTime.getTime() + timerState.totalSeconds * 1000);

    document.getElementById('startTimeDisplay').textContent =
        `開始: ${formatTimeHHMM(timerState.startTime)}`;
    document.getElementById('endTimeDisplay').textContent =
        `終了予定: ${formatTimeHHMM(timerState.endTime)}`;

    document.getElementById('timerStartBtn').disabled = true;
    document.getElementById('timerStopBtn').disabled = false;

    timerState.intervalId = setInterval(timerTick, 1000);
    showTimerMessage('タイマー開始', 'success');
    saveTimerState();
}

function formatTimeHHMM(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function timerTick() {
    const now = new Date();
    const remainingMs = timerState.endTime.getTime() - now.getTime();
    timerState.remainingSeconds = Math.ceil(remainingMs / 1000);

    if (timerState.remainingSeconds <= 0) {
        timerState.remainingSeconds = 0;
        const display = document.getElementById('timerDisplay');
        if (display) {
            display.textContent = '00:00';
        }
        completeTimer();
        return;
    }

    const display = document.getElementById('timerDisplay');
    if (display) {
        display.textContent = formatTimerDisplay(timerState.remainingSeconds);
    }
}

function completeTimer() {
    clearInterval(timerState.intervalId);

    saveTimerLog(true);

    playNotificationSound();
    showTimerMessage('🎉 タイマー完了！', 'success');

    if (Notification.permission === 'granted') {
        new Notification('タイマー完了', {
            body: `${timerState.taskName} のタイマーが完了しました`,
            icon: '📋',
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
    }

    resetTimerState();
    clearTimerState();
}

function stopTimer() {
    if (!timerState.isRunning) return;

    clearInterval(timerState.intervalId);
    timerState.isRunning = false;

    stopNotificationSound();

    document.getElementById('timerStartBtn').disabled = false;
    document.getElementById('timerStopBtn').disabled = true;

    saveTimerLog(false);
    clearTimerState();
}

function clearTimer() {
    if (timerState.intervalId) {
        clearInterval(timerState.intervalId);
        timerState.intervalId = null;
    }

    timerState.isRunning = false;
    timerState.isPaused = false;
    timerState.remainingSeconds = 0;

    stopNotificationSound();

    const timerDisplay = document.getElementById('timerDisplay');
    const timerSchedule = document.getElementById('timerSchedule');
    const timerMessage = document.getElementById('timerMessage');

    if (timerDisplay) timerDisplay.textContent = '00:00';
    if (timerSchedule) timerSchedule.textContent = '';
    if (timerMessage) timerMessage.textContent = '';

    document.getElementById('timerStartBtn').disabled = false;
    document.getElementById('timerStopBtn').disabled = true;

    clearTimerState();
    resetTimerState();
}

function resetTimerState() {
    timerState.isRunning = false;
    timerState.isPaused = false;
    timerState.intervalId = null;
    timerState.startTime = null;
    timerState.endTime = null;
    timerState.remainingSeconds = 0;
    timerState.totalSeconds = 0;
    timerState.taskId = null;
    timerState.taskName = '';
    timerState.taskDetail = '';
    timerState.achievement = null;
    timerState.estimatedTime = 0;

    document.getElementById('timerStartBtn').disabled = false;
    document.getElementById('timerStopBtn').disabled = true;

    updateTimerDisplay();
}

function saveTimerLog(completed) {
    const logs = getLogs();

    const taskSelect = document.getElementById('taskSelect');
    const taskDetailInput = document.getElementById('taskDetail');
    const achievementInput = document.getElementById('achievement');

    const selectedOption = taskSelect.options[taskSelect.selectedIndex];
    const taskId = taskSelect.value === 'interrupt' ? 'interrupt' : parseInt(taskSelect.value);
    const taskName = selectedOption.text;
    const estimatedTime = parseInt(selectedOption.dataset.estimated) || 0;
    const taskDetail = taskDetailInput.value || '';

    let achievement = achievementInput.value ? parseInt(achievementInput.value) : null;
    if (achievement !== null) {
        achievement = Math.max(0, Math.min(100, achievement));
    }

    const durationMs = Date.now() - timerState.startTime.getTime();
    const durationMinutes = parseFloat((durationMs / 1000 / 60).toFixed(1));

    const log = {
        id: Date.now(),
        taskId: taskId,
        taskName: taskName,
        taskDetail: taskDetail,
        achievement: achievement,
        estimatedTime: estimatedTime,
        startDateTime: formatDateTimeWithSeconds(timerState.startTime),
        endDateTime: formatDateTimeWithSeconds(new Date()),
        duration: durationMinutes < 0.1 ? 0.1 : durationMinutes,
        completed: completed,
    };

    logs.push(log);
    saveLogs(logs);

    // Google Sheets には新規ログだけ追記
    appendToGoogleSheets('logs', [log]);

    renderLogs();
}

function showTimerMessage(message, type) {
    const messageEl = document.getElementById('timerMessage');
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = 'timer-message';
        if (type) {
            messageEl.classList.add(type);
        }
    }
}

function playNotificationSound() {
    try {
        stopNotificationSound();
        notificationAudio = new Audio('成功音.mp3');
        notificationAudio.volume = 0.5;
        notificationAudio.loop = true;
        notificationAudio.play().catch(e => {
            console.log('通知音の再生に失敗しました:', e);
        });
    } catch (e) {
        console.log('通知音の読み込みに失敗しました:', e);
    }
}

function stopNotificationSound() {
    if (notificationAudio) {
        notificationAudio.pause();
        notificationAudio.currentTime = 0;
        notificationAudio = null;
    }
}

// ==================== ログ機能 ====================
function calculateTaskTotal(logs, taskId, upToIndex) {
    let total = 0;
    for (let i = 0; i <= upToIndex; i++) {
        if (logs[i].taskId === taskId) {
            total += logs[i].duration;
        }
    }
    return parseFloat(total.toFixed(1));
}

function renderLogs() {
    const container = document.getElementById('logContainer');
    if (!container) return;

    const logs = getFilteredLogs();

    if (logs.length === 0) {
        container.innerHTML = '<p class="no-logs">実行ログがありません</p>';
        updateTaskSummary();
        return;
    }

    const sortedLogs = [...logs].sort((a, b) => {
        return parseDateTime(b.startDateTime).getTime() - parseDateTime(a.startDateTime).getTime();
    });

    let html = `
        <table class="log-table">
            <thead>
                <tr>
                    <th>開始日時</th>
                    <th>終了日時</th>
                    <th>タスク名</th>
                    <th>詳細</th>
                    <th>想定時間</th>
                    <th>実行時間</th>
                    <th>合計</th>
                    <th>達成度</th>
                    <th>超過時間</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;

    sortedLogs.forEach((log, _index) => {
        const taskTotal = calculateTaskTotal(logs, log.taskId, logs.indexOf(log));
        const overrunTime = calculateOverrunTime(log.estimatedTime, taskTotal);
        const overrunDisplay = formatOverrunTime(overrunTime);
        const overrunClass = overrunTime !== null && overrunTime > 0 ? 'overrun-positive' : '';

        if (editingLogId === log.id) {
            const tasks = getTasks();
            let taskOptions = '<option value="interrupt">割り込みタスク</option>';

            tasks.forEach(task => {
                const selected = log.taskId === task.id ? 'selected' : '';
                taskOptions += `<option value="${task.id}" data-estimated="${task.estimatedTime}" ${selected}>${escapeHtml(task.name)}</option>`;
            });

            const taskExists = log.taskId === 'interrupt' || tasks.some(t => t.id === log.taskId);
            if (!taskExists) {
                taskOptions += `<option value="${log.taskId}" selected>${escapeHtml(log.taskName)}（削除済み）</option>`;
            }

            html += `
                <tr class="editing">
                    <td><input type="text" id="edit-start-${log.id}" value="${log.startDateTime}" class="inline-edit"></td>
                    <td><input type="text" id="edit-end-${log.id}" value="${log.endDateTime}" class="inline-edit"></td>
                    <td>
                        <select id="edit-log-task-${log.id}" class="inline-edit" onchange="onLogTaskChange(${log.id})">
                            ${taskOptions}
                        </select>
                    </td>
                    <td><input type="text" id="edit-log-detail-${log.id}" value="${escapeHtml(log.taskDetail || '')}" class="inline-edit"></td>
                    <td><input type="number" id="edit-log-estimated-${log.id}" value="${log.estimatedTime}" class="inline-edit" min="0"></td>
                    <td><input type="number" id="edit-log-duration-${log.id}" value="${log.duration}" class="inline-edit" min="0" step="0.1" readonly></td>
                    <td>${taskTotal.toFixed(1)}分</td>
                    <td><input type="number" id="edit-log-achievement-${log.id}" value="${log.achievement !== null ? log.achievement : ''}" class="inline-edit" min="0" max="100"></td>
                    <td class="${overrunClass}">${overrunDisplay}</td>
                    <td>
                        <button class="btn-save" onclick="saveLogEdit(${log.id})">保存</button>
                        <button class="btn-cancel" onclick="cancelLogEdit()">キャンセル</button>
                    </td>
                </tr>
            `;
        } else {
            html += `
                <tr>
                    <td class="log-datetime">${log.startDateTime}</td>
                    <td class="log-datetime">${log.endDateTime}</td>
                    <td>${escapeHtml(log.taskName)}</td>
                    <td>${escapeHtml(log.taskDetail || '')}</td>
                    <td>${log.estimatedTime}分</td>
                    <td>${log.duration}分</td>
                    <td>${taskTotal.toFixed(1)}分</td>
                    <td>${log.achievement !== null ? log.achievement + '%' : '-'}</td>
                    <td class="${overrunClass}">${overrunDisplay}</td>
                    <td>
                        <button class="btn-edit" onclick="startLogEdit(${log.id})">編集</button>
                        <button class="btn-delete" onclick="deleteLog(${log.id})">削除</button>
                    </td>
                </tr>
            `;
        }
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

function startLogEdit(logId) {
    if (editingLogId !== null) {
        cancelLogEdit();
    }
    editingLogId = logId;
    renderLogs();
}

function cancelLogEdit() {
    editingLogId = null;
    renderLogs();
}

function saveLogEdit(logId) {
    const logs = getLogs();
    const logIndex = logs.findIndex(l => l.id === logId);
    if (logIndex === -1) return;

    const startDateTimeEl = document.getElementById(`edit-start-${logId}`);
    const endDateTimeEl = document.getElementById(`edit-end-${logId}`);
    const taskSelectEl = document.getElementById(`edit-log-task-${logId}`);
    const taskDetailEl = document.getElementById(`edit-log-detail-${logId}`);
    const estimatedTimeEl = document.getElementById(`edit-log-estimated-${logId}`);
    const achievementEl = document.getElementById(`edit-log-achievement-${logId}`);

    if (!startDateTimeEl || !endDateTimeEl || !taskSelectEl) {
        console.error('Required elements not found');
        return;
    }

    const startDateTime = startDateTimeEl.value;
    const endDateTime = endDateTimeEl.value;

    const startDate = parseDateTime(startDateTime);
    const endDate = parseDateTime(endDateTime);
    let duration = 0;

    if (startDate && endDate && endDate > startDate) {
        const durationMs = endDate.getTime() - startDate.getTime();
        duration = parseFloat((durationMs / 1000 / 60).toFixed(1));
    } else {
        const durationEl = document.getElementById(`edit-log-duration-${logId}`);
        duration = durationEl ? parseFloat(durationEl.value) || 0 : logs[logIndex].duration;
    }

    const selectedOption = taskSelectEl.options[taskSelectEl.selectedIndex];
    const taskId = taskSelectEl.value === 'interrupt' ? 'interrupt' : parseInt(taskSelectEl.value);
    const taskName = selectedOption.text.replace('（削除済み）', '').trim();

    if (!taskName) {
        alert('タスク名を選択してください');
        return;
    }

    const taskDetail = taskDetailEl ? taskDetailEl.value : '';
    const estimatedTime = estimatedTimeEl ? parseInt(estimatedTimeEl.value) || 0 : 0;
    let achievement =
        achievementEl && achievementEl.value !== '' ? parseInt(achievementEl.value) : null;

    if (achievement !== null) {
        achievement = Math.max(0, Math.min(100, achievement));
    }

    logs[logIndex] = {
        ...logs[logIndex],
        taskId: taskId,
        taskName: taskName,
        startDateTime: startDateTime,
        endDateTime: endDateTime,
        taskDetail: taskDetail,
        estimatedTime: estimatedTime,
        duration: duration,
        achievement: achievement,
    };

    saveLogs(logs);
    editingLogId = null;
    renderLogs();
    updateChart();
    updateTimeline();
    updateTaskSummary();
}

function handleLogEditKeypress(event, logId) {
    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        saveLogEdit(logId);
    } else if (event.key === 'Escape') {
        cancelLogEdit();
    }
}

function deleteLog(logId) {
    if (!confirm('このログを削除しますか？')) return;

    const logs = getLogs().filter(l => l.id !== logId);
    saveLogs(logs);
    updateTaskSummary();
    renderLogs();
}

// ==================== CSV出力 ====================
function exportToCsv() {
    const tasks = getTasks();
    const logs = getLogs();

    let csv = '\uFEFF';

    csv += '=== タスク一覧 ===\n';
    csv += 'タスク名,優先順位,想定時間(分),対象日,完了,作成日\n';

    tasks.forEach(task => {
        csv += `"${escapeCsvField(task.name)}",${task.priority},${task.estimatedTime},${task.targetDate},${task.completed ? '完了' : '未完了'},${formatDateForCsv(task.createdAt)}\n`;
    });

    csv += '\n';

    csv += '=== 実行ログ ===\n';
    csv += '開始日時,終了日時,タスク名,詳細,想定時間(分),実行時間(分),タスク合計(分),達成度(%)\n';

    logs.forEach((log, index) => {
        const taskTotal = calculateTaskTotal(logs, log.taskId, index);
        csv += `${log.startDateTime},${log.endDateTime},"${escapeCsvField(log.taskName)}","${escapeCsvField(log.taskDetail || '')}",${log.estimatedTime},${log.duration},${taskTotal.toFixed(1)},${log.achievement !== null ? log.achievement : ''}\n`;
    });

    const now = new Date();
    const fileName = `tasks_${formatDateTimeForFileName(now)}.csv`;
    downloadCsv(csv, fileName);
}

function downloadCsv(csv, fileName) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
}

function adjustTime(minutes) {
    const input = document.getElementById('timerMinutes');
    if (!input) return;

    const currentValue = parseInt(input.value) || 0;
    let newValue = currentValue + minutes;

    newValue = Math.max(1, Math.min(999, newValue));

    input.value = newValue;
    updateTimerDisplay();
}

function exportLogsToCsv() {
    const logs = getLogs();

    if (logs.length === 0) {
        alert('出力するログがありません');
        return;
    }

    const now = new Date();
    const fileName = `logs_${formatDateTimeForFileName(now)}.csv`;

    let csv = '\uFEFF';

    csv +=
        '開始日時,終了日時,タスク名,詳細,想定時間(分),実行時間(分),タスク合計(分),達成度(%),超過時間(分)\n';

    logs.forEach((log, index) => {
        const taskTotal = calculateTaskTotal(logs, log.taskId, index);
        const overrunTime = calculateOverrunTime(log.estimatedTime, taskTotal);
        const overrunDisplay = overrunTime === null ? '' : overrunTime;

        csv += `${log.startDateTime},`;
        csv += `${log.endDateTime},`;
        csv += `${escapeCsvField(log.taskName)},`;
        csv += `${escapeCsvField(log.taskDetail || '')},`;
        csv += `${log.estimatedTime},`;
        csv += `${log.duration},`;
        csv += `${taskTotal.toFixed(1)},`;
        csv += `${log.achievement !== null ? log.achievement : ''},`;
        csv += `${overrunDisplay}\n`;
    });

    downloadCsv(csv, fileName);
}

// ==================== メモ帳機能 ====================
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
    const parsed = JSON.parse(data);

    if (!parsed.memos || !Array.isArray(parsed.memos) || parsed.memos.length === 0) {
        return {
            memos: [{ id: 1, name: 'メモ1', content: '' }],
            activeTabId: 1,
            isCollapsed: false,
        };
    }

    return parsed;
}

function saveMemoData(data) {
    localStorage.setItem(STORAGE_KEY_MEMOS, JSON.stringify(data));
}

function initializeMemo() {
    const data = getMemoData();

    if (data.isCollapsed) {
        const content = document.getElementById('memoContent');
        const toggle = document.getElementById('memoToggle');
        if (content) content.classList.add('collapsed');
        if (toggle) toggle.textContent = '▼';
    }

    renderMemoTabs();
    loadActiveMemoContent();
}

function renderMemoTabs() {
    const data = getMemoData();
    const tabsContainer = document.getElementById('memoTabs');
    if (!tabsContainer) return;

    let html = '';

    data.memos.forEach(memo => {
        const isActive = memo.id === data.activeTabId;
        html += `
            <div class="memo-tab ${isActive ? 'active' : ''}" data-memo-id="${memo.id}">
                <span class="memo-tab-name" 
                    onclick="selectMemoTab(${memo.id})"
                    ondblclick="startEditTabName(${memo.id})">${escapeHtml(memo.name)}</span>
                <span class="memo-tab-close" onclick="deleteMemoTab(${memo.id}, event)">×</span>
            </div>
        `;
    });

    html += `<button class="memo-tab-add" onclick="addMemoTab()">+</button>`;

    tabsContainer.innerHTML = html;
}

function selectMemoTab(tabId) {
    const data = getMemoData();

    saveMemoContent();

    data.activeTabId = tabId;
    saveMemoData(data);

    renderMemoTabs();
    loadActiveMemoContent();
}

function loadActiveMemoContent() {
    const data = getMemoData();
    const textarea = document.getElementById('memoTextarea');
    if (!textarea) return;

    const activeMemo = data.memos.find(m => m.id === data.activeTabId);
    textarea.value = activeMemo ? activeMemo.content : '';
}

function saveMemoContent() {
    const data = getMemoData();
    const textarea = document.getElementById('memoTextarea');
    if (!textarea) return;

    const activeMemo = data.memos.find(m => m.id === data.activeTabId);
    if (activeMemo) {
        const newContent = textarea.value;
        const oldContent = activeMemo.content;

        activeMemo.content = newContent;
        localStorage.setItem(STORAGE_KEY_MEMOS, JSON.stringify(data));

        // 内容が変わった場合のみ Google Sheets に追記
        if (newContent !== oldContent) {
            appendToGoogleSheets('memos', [{
                id: activeMemo.id,
                name: activeMemo.name,
                content: activeMemo.content,
                updatedAt: new Date().toISOString(),
            }]);
        }
    }
}

function addMemoTab() {
    const data = getMemoData();

    if (data.memos.length >= 10) {
        alert('メモは最大10個までです');
        return;
    }

    saveMemoContent();

    const maxId = data.memos.length > 0 ? Math.max(...data.memos.map(m => m.id)) : 0;
    const newId = maxId + 1;

    const newMemo = {
        id: newId,
        name: `メモ${newId}`,
        content: '',
    };

    data.memos.push(newMemo);
    data.activeTabId = newId;
    localStorage.setItem(STORAGE_KEY_MEMOS, JSON.stringify(data));

    // Google Sheets に新規メモだけ追記
    appendToGoogleSheets('memos', [newMemo]);

    renderMemoTabs();
    loadActiveMemoContent();
}

function deleteMemoTab(tabId, event) {
    event.stopPropagation();

    const data = getMemoData();

    if (data.memos.length <= 1) {
        alert('最後のメモは削除できません');
        return;
    }

    if (!confirm('このメモを削除しますか？')) {
        return;
    }

    const index = data.memos.findIndex(m => m.id === tabId);
    if (index === -1) return;

    data.memos.splice(index, 1);

    if (data.activeTabId === tabId) {
        data.activeTabId = data.memos[0].id;
    }

    saveMemoData(data);
    renderMemoTabs();
    loadActiveMemoContent();
}

function startEditTabName(tabId) {
    const data = getMemoData();
    const memo = data.memos.find(m => m.id === tabId);
    if (!memo) return;

    const tabElement = document.querySelector(`.memo-tab[data-memo-id="${tabId}"] .memo-tab-name`);
    if (!tabElement) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'memo-tab-name editing';
    input.value = memo.name;
    input.maxLength = 20;

    input.onblur = () => saveTabName(tabId, input.value);
    input.onkeydown = e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveTabName(tabId, input.value);
        } else if (e.key === 'Escape') {
            renderMemoTabs();
        }
    };

    tabElement.replaceWith(input);
    input.focus();
    input.select();
}

function saveTabName(tabId, newName) {
    const data = getMemoData();
    const memo = data.memos.find(m => m.id === tabId);
    if (!memo) return;

    memo.name = newName.trim() || `メモ${tabId}`;
    saveMemoData(data);
    renderMemoTabs();
}

function toggleMemoCollapse() {
    const data = getMemoData();
    const content = document.getElementById('memoContent');
    const toggle = document.getElementById('memoToggle');

    data.isCollapsed = !data.isCollapsed;
    saveMemoData(data);

    if (content) {
        content.classList.toggle('collapsed', data.isCollapsed);
    }
    if (toggle) {
        toggle.textContent = data.isCollapsed ? '▼' : '▲';
    }
}

// ==================== グラフ機能 ====================
let taskPieChart = null;

const chartColors = [
    '#FF6384',
    '#36A2EB',
    '#FFCE56',
    '#4BC0C0',
    '#c9171e',
    '#FF9F40',
    '#c9171e',
    '#00E676',
    '#FF5252',
    '#448AFF',
    '#69F0AE',
    '#FFD740',
    '#c9171e',
    '#18FFFF',
    '#FF6E40',
];

function filterLogsByPeriod(logs, period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
        case 'today': {
            return logs.filter(log => {
                const logDate = new Date(log.startDateTime.split(' ')[0]);
                return logDate >= today;
            });
        }

        case 'week': {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return logs.filter(log => {
                const logDate = new Date(log.startDateTime.split(' ')[0]);
                return logDate >= weekAgo;
            });
        }

        case 'month': {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return logs.filter(log => {
                const logDate = new Date(log.startDateTime.split(' ')[0]);
                return logDate >= monthAgo;
            });
        }

        case 'all':
        default:
            return logs;
    }
}

function calculateTaskTotals(logs) {
    const taskTotals = {};

    logs.forEach(log => {
        const taskName = log.taskName || '不明';
        if (!taskTotals[taskName]) {
            taskTotals[taskName] = 0;
        }
        taskTotals[taskName] += log.duration;
    });

    return taskTotals;
}

function groupSmallTasks(taskTotals) {
    const totalTime = Object.values(taskTotals).reduce((sum, time) => sum + time, 0);
    if (totalTime === 0) return { labels: [], data: [], totalTime: 0 };

    const threshold = totalTime * 0.01;
    const result = {};
    let otherTime = 0;

    Object.entries(taskTotals).forEach(([taskName, time]) => {
        if (time < threshold) {
            otherTime += time;
        } else {
            result[taskName] = time;
        }
    });

    if (otherTime > 0) {
        result['その他'] = otherTime;
    }

    const sorted = Object.entries(result).sort((a, b) => b[1] - a[1]);

    return {
        labels: sorted.map(([name]) => name),
        data: sorted.map(([, time]) => parseFloat(time.toFixed(1))),
        totalTime: totalTime,
    };
}

function updateChart() {
    const logs = getLogs();
    const periodSelect = document.getElementById('chartPeriod');
    const period = periodSelect ? periodSelect.value : 'all';

    const filteredLogs = filterLogsByPeriod(logs, period);
    const taskTotals = calculateTaskTotals(filteredLogs);
    const { labels, data, totalTime } = groupSmallTasks(taskTotals);

    const canvas = document.getElementById('taskPieChart');
    const noDataEl = document.getElementById('chartNoData');

    if (!canvas) return;

    if (data.length === 0) {
        canvas.style.display = 'none';
        if (noDataEl) noDataEl.style.display = 'block';

        if (taskPieChart) {
            taskPieChart.destroy();
            taskPieChart = null;
        }
        return;
    }

    canvas.style.display = 'block';
    if (noDataEl) noDataEl.style.display = 'none';

    if (taskPieChart) {
        taskPieChart.destroy();
    }

    const percentages = data.map(time => ((time / totalTime) * 100).toFixed(1));

    const ctx = canvas.getContext('2d');
    taskPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [
                {
                    data: data,
                    backgroundColor: chartColors.slice(0, labels.length),
                    borderColor: '#fff',
                    borderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12,
                        },
                    },
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const percentage = percentages[context.dataIndex];
                            return `${label}: ${percentage}% (${value}分)`;
                        },
                    },
                },
            },
        },
        plugins: [
            {
                id: 'datalabels',
                afterDatasetsDraw: function (chart) {
                    const ctx = chart.ctx;
                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach((element, index) => {
                            const percentage = parseFloat(percentages[index]);

                            if (percentage < 5) return;

                            const { x, y } = element.tooltipPosition();

                            ctx.fillStyle = '#fff';
                            ctx.font = 'bold 12px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';

                            ctx.fillText(`${percentage}%`, x, y - 8);
                            ctx.fillText(`(${data[index]}分)`, x, y + 8);
                        });
                    });
                },
            },
        ],
    });
}

function initializeChart() {
    updateChart();
}

// ==================== タイムライン機能 ====================
let timelineVisible = false;

function toggleTimeline() {
    timelineVisible = !timelineVisible;
    const content = document.getElementById('timelineContent');
    const btn = document.getElementById('timelineToggleBtn');

    if (content) {
        content.style.display = timelineVisible ? 'block' : 'none';
    }

    if (btn) {
        btn.textContent = timelineVisible ? '活動タイムライン非表示' : '活動タイムライン表示';
        btn.classList.toggle('active', timelineVisible);
    }

    if (timelineVisible) {
        updateTimeline();
    }
}

function updateTimeline() {
    const logs = getLogs();
    const periodSelect = document.getElementById('timelinePeriod');
    const period = periodSelect ? periodSelect.value : 'today';

    const filteredLogs = filterLogsByPeriod(logs, period);

    renderTimeline(filteredLogs, 'timelineContainer', false);
}

function renderTimeline(logs, containerId, isModal) {
    const container = document.getElementById(containerId);
    const noDataEl = document.getElementById('timelineNoData');

    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = '';
        if (noDataEl) noDataEl.style.display = 'block';
        return;
    }

    if (noDataEl) noDataEl.style.display = 'none';

    const sortedLogs = [...logs].sort((a, b) => {
        return parseDateTime(a.startDateTime).getTime() - parseDateTime(b.startDateTime).getTime();
    });

    const timeRange = calculateTimeRange(sortedLogs);

    const rows = assignRows(sortedLogs, timeRange);
    const rowCount = Math.max(...rows) + 1;

    const axisLabels = generateAxisLabels(timeRange);

    const rowHeight = isModal ? 44 : 40;
    const containerHeight = rowCount * rowHeight + 20;

    let html = `
        <div class="timeline-wrapper" ${!isModal ? 'onclick="openTimelineModal()"' : ''}>
            <div class="timeline-chart">
                <div class="timeline-bars-container" style="height: ${containerHeight}px;">
    `;

    sortedLogs.forEach((log, index) => {
        const { left, width } = calculateBarPosition(log, timeRange);
        const row = rows[index];
        const top = row * rowHeight + 10;
        const color = getTaskColor(log.taskName);

        const displayText =
            log.taskDetail && log.taskDetail.trim()
                ? log.taskDetail
                : log.taskName || 'コメントなし';

        const shortText = displayText.length > 10 ? displayText.substring(0, 8) + '…' : displayText;
        const showText = width > 5 ? displayText : shortText;

        const tooltipData = JSON.stringify({
            taskName: log.taskName,
            detail: log.taskDetail || '',
            start: log.startDateTime,
            end: log.endDateTime,
            duration: log.duration,
        }).replace(/"/g, '&quot;');

        html += `
                    <div class="timeline-bar"
                        style="left: ${left}%; width: ${Math.max(width, 8)}%; top: ${top}px; background-color: ${color};"
                        data-tooltip="${tooltipData}"
                        onmouseenter="showTimelineTooltip(event, this.dataset.tooltip)"
                        onmouseleave="hideTimelineTooltip()"
                        onclick="event.stopPropagation()">
                        <span class="timeline-bar-text">${escapeHtml(showText)}</span>
                    </div>
        `;
    });

    html += `
                </div>
                <div class="timeline-axis">
    `;

    axisLabels.forEach(label => {
        html += `<span class="timeline-axis-label" style="left: ${label.position}%;">${label.text}</span>`;
    });

    html += `
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function assignRows(logs, _timeRange) {
    const rows = [];
    const rowEndTimes = [];

    logs.forEach(log => {
        const startTime = parseDateTime(log.startDateTime).getTime();
        const endTime = parseDateTime(log.endDateTime).getTime();

        let assignedRow = -1;
        for (let i = 0; i < rowEndTimes.length; i++) {
            if (rowEndTimes[i] <= startTime) {
                assignedRow = i;
                break;
            }
        }

        if (assignedRow === -1) {
            assignedRow = rowEndTimes.length;
            rowEndTimes.push(0);
        }

        rowEndTimes[assignedRow] = endTime;
        rows.push(assignedRow);
    });

    return rows;
}

function calculateTimeRange(logs) {
    let minTime = Infinity;
    let maxTime = -Infinity;

    logs.forEach(log => {
        const startTime = parseDateTime(log.startDateTime).getTime();
        const endTime = parseDateTime(log.endDateTime).getTime();

        minTime = Math.min(minTime, startTime);
        maxTime = Math.max(maxTime, endTime);
    });

    const padding = 10 * 60 * 1000;
    minTime -= padding;
    maxTime += padding;

    return { minTime, maxTime, duration: maxTime - minTime };
}

// 日時文字列をDateオブジェクトに変換
function parseDateTime(dateTimeStr) {
    if (!dateTimeStr || typeof dateTimeStr !== 'string') {
        console.error('parseDateTime: 無効な日時文字列:', dateTimeStr);
        return new Date();
    }

    const parts = dateTimeStr.split(' ');
    if (parts.length < 2) {
        console.error('parseDateTime: 不正なフォーマット:', dateTimeStr);
        return new Date();
    }

    const [datePart, timePart] = parts;
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, second || 0);
}

// バーの位置とサイズを計算
function calculateBarPosition(log, timeRange) {
    const startTime = parseDateTime(log.startDateTime).getTime();
    const endTime = parseDateTime(log.endDateTime).getTime();

    const left = ((startTime - timeRange.minTime) / timeRange.duration) * 100;
    const width = ((endTime - startTime) / timeRange.duration) * 100;

    return {
        left: Math.max(0, left),
        width: Math.max(2, Math.min(width, 100 - left)), // 最小幅2%
    };
}

// タスク名から色を取得
const taskColorMap = {};
function getTaskColor(taskName) {
    if (!taskColorMap[taskName]) {
        const index = Object.keys(taskColorMap).length;
        taskColorMap[taskName] = chartColors[index % chartColors.length];
    }
    return taskColorMap[taskName];
}

// 時間軸ラベルを生成
function generateAxisLabels(timeRange) {
    const labels = [];
    const durationMs = timeRange.duration;
    const durationHours = durationMs / (1000 * 60 * 60);

    // 表示間隔を決定
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

    // 開始時刻を間隔に合わせて丸める
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

// ツールチップ表示
function showTimelineTooltip(event, data) {
    hideTimelineTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'timeline-tooltip';
    tooltip.id = 'timelineTooltip';

    const detailHtml = data.detail
        ? `<div class="timeline-tooltip-detail">${escapeHtml(data.detail)}</div>`
        : '';

    tooltip.innerHTML = `
        <div class="timeline-tooltip-title">${escapeHtml(data.taskName)}</div>
        ${detailHtml}
        <div class="timeline-tooltip-time">${data.start} 〜 ${data.end}</div>
        <div class="timeline-tooltip-time">実行時間: ${data.duration}分</div>
    `;

    document.body.appendChild(tooltip);

    // 位置調整
    const rect = tooltip.getBoundingClientRect();
    let x = event.pageX + 10;
    let y = event.pageY + 10;

    if (x + rect.width > window.innerWidth) {
        x = event.pageX - rect.width - 10;
    }

    if (y + rect.height > window.innerHeight + window.scrollY) {
        y = event.pageY - rect.height - 10;
    }

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

// ツールチップ非表示
function hideTimelineTooltip() {
    const tooltip = document.getElementById('timelineTooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// モーダルを開く
function openTimelineModal() {
    const modal = document.getElementById('timelineModal');
    if (!modal) return;

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // モーダル用にタイムラインを再描画
    const logs = getLogs();
    const periodSelect = document.getElementById('timelinePeriod');
    const period = periodSelect ? periodSelect.value : 'today';
    const filteredLogs = filterLogsByPeriod(logs, period);

    renderTimeline(filteredLogs, 'timelineModalContainer', true);
}

// モーダルを閉じる
function closeTimelineModal(event) {
    if (event && event.target !== event.currentTarget) return;

    const modal = document.getElementById('timelineModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

// ESCキーでモーダルを閉じる
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeTimelineModal();
    }
});

// ログ全削除
function deleteAllLogs() {
    const logs = getLogs();
    if (logs.length === 0) {
        alert('削除するログがありません');
        return;
    }

    if (confirm(`すべてのログ（${logs.length}件）を削除しますか？\nこの操作は取り消せません。`)) {
        saveLogs([]);
        renderLogs();
        updateChart();
        updateTimeline();
        alert('すべてのログを削除しました');
    }
    updateTaskSummary();
}

// 超過時間を計算（合計が想定時間を超えた時間）
function calculateOverrunTime(estimatedTime, taskTotal) {
    if (!estimatedTime || estimatedTime <= 0) {
        return null; // 想定時間がない場合は計算不可
    }

    const overrun = taskTotal - estimatedTime;
    return parseFloat(overrun.toFixed(1));
}

// 超過時間の表示フォーマット
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

const STORAGE_KEY_TIMER = 'taskManager_timer';

// タイマー状態を保存
function saveTimerState() {
    const state = {
        isRunning: timerState.isRunning,
        startTime: timerState.startTime ? timerState.startTime.toISOString() : null,
        endTime: timerState.endTime ? timerState.endTime.toISOString() : null,
        totalSeconds: timerState.totalSeconds,
        taskId: timerState.taskId,
        taskName: timerState.taskName,
        taskDetail: timerState.taskDetail,
        achievement: timerState.achievement,
        estimatedTime: timerState.estimatedTime,
    };
    localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(state));
}

// タイマー状態を読み込み
function loadTimerState() {
    const data = localStorage.getItem(STORAGE_KEY_TIMER);
    return data ? JSON.parse(data) : null;
}

// タイマー状態をクリア
function clearTimerState() {
    localStorage.removeItem(STORAGE_KEY_TIMER);
}

// タイマーを復元
function restoreTimer() {
    const saved = loadTimerState();
    console.log('タイマー復元データ:', saved);
    if (!saved || !saved.isRunning || !saved.endTime) {
        console.log('復元データなし、または実行中でない');
        return false;
    }

    const endTime = new Date(saved.endTime);
    const now = new Date();
    const remainingMs = endTime.getTime() - now.getTime();
    console.log('残り時間(ms):', remainingMs);

    if (remainingMs <= 0) {
        console.log('タイマー既に終了');
        clearTimerState();
        return false;
    }

    // タイマー状態を復元
    timerState.isRunning = true;
    timerState.startTime = new Date(saved.startTime);
    timerState.endTime = endTime;
    timerState.totalSeconds = saved.totalSeconds;
    timerState.remainingSeconds = Math.ceil(remainingMs / 1000);
    timerState.taskId = saved.taskId;
    timerState.taskName = saved.taskName;
    timerState.taskDetail = saved.taskDetail;
    timerState.achievement = saved.achievement;
    timerState.estimatedTime = saved.estimatedTime;

    // UI更新
    document.getElementById('startTimeDisplay').textContent =
        `開始: ${formatTimeHHMM(timerState.startTime)}`;
    document.getElementById('endTimeDisplay').textContent =
        `終了予定: ${formatTimeHHMM(timerState.endTime)}`;

    document.getElementById('timerStartBtn').disabled = true;
    document.getElementById('timerStopBtn').disabled = false;

    // タイマー再開
    timerState.intervalId = setInterval(timerTick, 1000);
    updateTimerDisplay();
    showTimerMessage('タイマー再開', 'success');

    return true;
}

// ログフィルターを初期化（今日の日付をデフォルトに）
function initializeLogFilter() {
    const today = getTodayString();
    const startDateInput = document.getElementById('logStartDate');
    const endDateInput = document.getElementById('logEndDate');

    if (startDateInput) startDateInput.value = today;
    if (endDateInput) endDateInput.value = today;

    logFilterStartDate = today;
    logFilterEndDate = today;
}

// ログをフィルタリング
function filterLogs() {
    const startDateInput = document.getElementById('logStartDate');
    const endDateInput = document.getElementById('logEndDate');

    logFilterStartDate = startDateInput.value || null;
    logFilterEndDate = endDateInput.value || null;

    renderLogs();
    updateTaskSummary();
}

// フィルターをクリア（全期間表示）
function clearLogFilter() {
    const startDateInput = document.getElementById('logStartDate');
    const endDateInput = document.getElementById('logEndDate');

    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';

    logFilterStartDate = null;
    logFilterEndDate = null;

    renderLogs();
    updateTaskSummary();
}

// 日付を調整
function adjustLogFilterDate(days) {
    const startDateInput = document.getElementById('logStartDate');
    const endDateInput = document.getElementById('logEndDate');

    // 現在の開始日を基準に調整（未設定なら今日）
    let baseDate;
    if (startDateInput.value) {
        baseDate = new Date(startDateInput.value);
    } else {
        baseDate = new Date();
    }

    baseDate.setDate(baseDate.getDate() + days);
    const newDate = baseDate.toISOString().split('T')[0];

    if (startDateInput) startDateInput.value = newDate;
    if (endDateInput) endDateInput.value = newDate;

    logFilterStartDate = newDate;
    logFilterEndDate = newDate;

    renderLogs();
    updateTaskSummary();
}

// フィルター済みログを取得
function getFilteredLogs() {
    const logs = getLogs();

    if (!logFilterStartDate && !logFilterEndDate) {
        return logs;
    }

    return logs.filter(log => {
        const logDate = log.startDateTime.split(' ')[0];

        if (logFilterStartDate && logDate < logFilterStartDate) {
            return false;
        }
        if (logFilterEndDate && logDate > logFilterEndDate) {
            return false;
        }
        return true;
    });
}
