// ローカルストレージのキー
const STORAGE_KEY = 'taskManager_tasks';

// DOM要素
const taskNameInput = document.getElementById('taskName');
const priorityInput = document.getElementById('priority');
const estimatedTimeInput = document.getElementById('estimatedTime');
const targetDateInput = document.getElementById('targetDate');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskContainer = document.getElementById('taskContainer');
const taskToolbar = document.getElementById('taskToolbar');
const selectAllCheckbox = document.getElementById('selectAll');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const deleteAllBtn = document.getElementById('deleteAllBtn');

// 選択中のタスクIDセット
let selectedTaskIds = new Set();

// 編集中のタスクID
let editingTaskId = null;

// ドラッグ中のタスクID
let draggedTaskId = null;

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    setDefaultTargetDate();
    renderTasks();
    setupEventListeners();
});

// デフォルトの対象日を設定（今日）
function setDefaultTargetDate() {
    const today = new Date();
    targetDateInput.value = formatDateForInput(today);
}

// イベントリスナーの設定
function setupEventListeners() {
    addTaskBtn.addEventListener('click', addTask);
    
    taskNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    priorityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    estimatedTimeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    targetDateInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // 全選択チェックボックス
    selectAllCheckbox.addEventListener('change', handleSelectAll);

    // ツールバーボタン
    exportCsvBtn.addEventListener('click', exportToCsv);
    deleteSelectedBtn.addEventListener('click', deleteSelected);
    deleteAllBtn.addEventListener('click', deleteAll);
}

// タスクを取得
function getTasks() {
    const tasks = localStorage.getItem(STORAGE_KEY);
    return tasks ? JSON.parse(tasks) : [];
}

// タスクを保存
function saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// 優先順位を正規化（1から連番に再採番）
function normalizePriorities(tasks) {
    // 未完了タスクを優先順位順にソート
    const incompleteTasks = tasks.filter(t => !t.completed).sort((a, b) => a.priority - b.priority);
    const completedTasks = tasks.filter(t => t.completed).sort((a, b) => a.priority - b.priority);
    
    // 未完了タスクに1から連番を振る
    incompleteTasks.forEach((task, index) => {
        task.priority = index + 1;
    });
    
    // 完了タスクにも続きの連番を振る
    completedTasks.forEach((task, index) => {
        task.priority = incompleteTasks.length + index + 1;
    });
    
    return [...incompleteTasks, ...completedTasks];
}

// 新しいタスクの優先順位を決定
function getNewPriority(tasks, requestedPriority) {
    const incompleteTasks = tasks.filter(t => !t.completed);
    const maxPriority = incompleteTasks.length;
    
    if (requestedPriority === null || requestedPriority === undefined || isNaN(requestedPriority)) {
        // 未指定の場合は最下位
        return maxPriority + 1;
    }
    
    // 指定された優先順位を1以上、最大+1以下に制限
    return Math.max(1, Math.min(requestedPriority, maxPriority + 1));
}

// 指定位置にタスクを挿入し、優先順位を調整
function insertTaskAtPriority(tasks, newTask, priority) {
    const incompleteTasks = tasks.filter(t => !t.completed).sort((a, b) => a.priority - b.priority);
    const completedTasks = tasks.filter(t => t.completed);
    
    // 挿入位置のインデックス（0ベース）
    const insertIndex = priority - 1;
    
    // 新しいタスクを挿入
    incompleteTasks.splice(insertIndex, 0, newTask);
    
    // 優先順位を再採番
    incompleteTasks.forEach((task, index) => {
        task.priority = index + 1;
    });
    
    completedTasks.forEach((task, index) => {
        task.priority = incompleteTasks.length + index + 1;
    });
    
    return [...incompleteTasks, ...completedTasks];
}

// タスクを追加
function addTask() {
    const name = taskNameInput.value.trim();
    const priorityValue = priorityInput.value.trim();
    const requestedPriority = priorityValue === '' ? null : parseInt(priorityValue);
    const estimatedTime = parseInt(estimatedTimeInput.value) || 30;
    const targetDate = targetDateInput.value || formatDateForInput(new Date());

    if (!name) {
        taskNameInput.classList.add('error');
        taskNameInput.focus();
        setTimeout(() => taskNameInput.classList.remove('error'), 2000);
        return;
    }

    const validTime = Math.max(1, estimatedTime);

    let tasks = getTasks();
    const priority = getNewPriority(tasks, requestedPriority);

    const task = {
        id: Date.now(),
        name: name,
        priority: priority,
        estimatedTime: validTime,
        targetDate: targetDate,
        completed: false,
        createdAt: new Date().toISOString()
    };

    tasks = insertTaskAtPriority(tasks, task, priority);
    saveTasks(tasks);

    taskNameInput.value = '';
    priorityInput.value = '';
    estimatedTimeInput.value = '30';
    setDefaultTargetDate();
    taskNameInput.focus();

    editingTaskId = null;
    renderTasks();
}

// タスクを完了/未完了に切り替え
function toggleComplete(id) {
    let tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        tasks = normalizePriorities(tasks);
        saveTasks(tasks);
        editingTaskId = null;
        renderTasks();
    }
}

// タスクを削除
function deleteTask(id) {
    let tasks = getTasks();
    tasks = tasks.filter(t => t.id !== id);
    tasks = normalizePriorities(tasks);
    saveTasks(tasks);
    selectedTaskIds.delete(id);
    if (editingTaskId === id) {
        editingTaskId = null;
    }
    renderTasks();
}

// 編集モード開始
function startEdit(id) {
    editingTaskId = id;
    renderTasks();
}

// 編集キャンセル
function cancelEdit() {
    editingTaskId = null;
    renderTasks();
}

// 編集保存
function saveEdit(id) {
    const nameInput = document.getElementById(`edit-name-${id}`);
    const priorityInputEl = document.getElementById(`edit-priority-${id}`);
    const timeInput = document.getElementById(`edit-time-${id}`);
    const dateInput = document.getElementById(`edit-date-${id}`);

    const name = nameInput.value.trim();
    const newPriority = parseInt(priorityInputEl.value) || 1;
    const estimatedTime = parseInt(timeInput.value) || 30;
    const targetDate = dateInput.value;

    if (!name) {
        nameInput.classList.add('error');
        nameInput.focus();
        setTimeout(() => nameInput.classList.remove('error'), 2000);
        return;
    }

    let tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    
    if (task) {
        const oldPriority = task.priority;
        task.name = name;
        task.estimatedTime = Math.max(1, estimatedTime);
        task.targetDate = targetDate;
        
        // 優先順位が変更された場合
        if (newPriority !== oldPriority) {
            // タスクを一旦削除
            tasks = tasks.filter(t => t.id !== id);
            
            // 新しい優先順位を計算（範囲内に制限）
            const incompleteTasks = tasks.filter(t => !t.completed);
            const maxPriority = incompleteTasks.length + 1;
            const validPriority = Math.max(1, Math.min(newPriority, maxPriority));
            task.priority = validPriority;
            
            // 再挿入
            tasks = insertTaskAtPriority(tasks, task, validPriority);
        }
        
        saveTasks(tasks);
    }

    editingTaskId = null;
    renderTasks();
}

// 編集中のEnterキー処理
function handleEditKeypress(e, id) {
    if (e.key === 'Enter') {
        saveEdit(id);
    } else if (e.key === 'Escape') {
        cancelEdit();
    }
}

// ドラッグ開始
function handleDragStart(e, id) {
    draggedTaskId = id;
    e.target.closest('.task-item').classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
}

// ドラッグ終了
function handleDragEnd(e) {
    draggedTaskId = null;
    document.querySelectorAll('.task-item').forEach(item => {
        item.classList.remove('dragging', 'drag-over');
    });
}

// ドラッグオーバー
function handleDragOver(e, id) {
    e.preventDefault();
    if (draggedTaskId === null || draggedTaskId === id) return;
    
    const taskItem = e.target.closest('.task-item');
    if (taskItem && !taskItem.classList.contains('dragging')) {
        document.querySelectorAll('.task-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        taskItem.classList.add('drag-over');
    }
}

// ドロップ
function handleDrop(e, targetId) {
    e.preventDefault();
    
    if (draggedTaskId === null || draggedTaskId === targetId) return;
    
    let tasks = getTasks();
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetId);
    
    if (!draggedTask || !targetTask) return;
    
    // 完了タスクはドラッグ対象外
    if (draggedTask.completed || targetTask.completed) return;
    
    // ドラッグしたタスクを削除
    tasks = tasks.filter(t => t.id !== draggedTaskId);
    
    // ターゲットの位置に挿入
    const targetPriority = targetTask.priority;
    draggedTask.priority = targetPriority;
    tasks = insertTaskAtPriority(tasks, draggedTask, targetPriority);
    
    saveTasks(tasks);
    draggedTaskId = null;
    renderTasks();
}

// 全選択/全解除
function handleSelectAll() {
    const tasks = getTasks();
    if (selectAllCheckbox.checked) {
        tasks.forEach(t => selectedTaskIds.add(t.id));
    } else {
        selectedTaskIds.clear();
    }
    renderTasks();
}

// 個別チェックボックスの変更
function handleTaskSelect(id, checked) {
    if (checked) {
        selectedTaskIds.add(id);
    } else {
        selectedTaskIds.delete(id);
    }
    updateSelectAllState();
    updateDeleteSelectedBtn();
    updateSelectedStyle();
}

// 選択スタイルの更新
function updateSelectedStyle() {
    const items = document.querySelectorAll('.task-item');
    items.forEach(item => {
        const checkbox = item.querySelector('.task-checkbox input');
        if (checkbox && checkbox.checked) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// 全選択チェックボックスの状態更新
function updateSelectAllState() {
    const tasks = getTasks();
    if (tasks.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedTaskIds.size === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedTaskIds.size === tasks.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

// 選択削除ボタンの状態更新
function updateDeleteSelectedBtn() {
    deleteSelectedBtn.disabled = selectedTaskIds.size === 0;
}

// 選択したタスクを削除
function deleteSelected() {
    if (selectedTaskIds.size === 0) return;

    const count = selectedTaskIds.size;
    if (!confirm(`選択した${count}件のタスクを削除しますか？`)) return;

    let tasks = getTasks();
    tasks = tasks.filter(t => !selectedTaskIds.has(t.id));
    tasks = normalizePriorities(tasks);
    saveTasks(tasks);
    selectedTaskIds.clear();
    editingTaskId = null;
    renderTasks();
}

// 全削除
function deleteAll() {
    const tasks = getTasks();
    if (tasks.length === 0) return;

    if (!confirm(`全${tasks.length}件のタスクを削除しますか？\nこの操作は取り消せません。`)) return;

    saveTasks([]);
    selectedTaskIds.clear();
    editingTaskId = null;
    renderTasks();
}

// CSVエクスポート
function exportToCsv() {
    const tasks = getTasks();
    if (tasks.length === 0) {
        alert('エクスポートするタスクがありません。');
        return;
    }

    // ソート（表示と同じ順序）
    tasks.sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        return a.priority - b.priority;
    });

    // CSVヘッダー
    const headers = ['タスク名', '優先順位', '想定時間(分)', '対象日', '完了', '作成日'];
    
    // CSVデータ作成
    const rows = tasks.map(task => {
        const completed = task.completed ? '完了' : '未完了';
        const createdAt = formatDateForCsv(task.createdAt);
        const targetDate = formatTargetDateForCsv(task.targetDate);
        return [
            escapeCsvField(task.name),
            task.priority,
            task.estimatedTime,
            targetDate,
            completed,
            createdAt
        ].join(',');
    });

    // BOM付きUTF-8でCSV作成
    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    
    // ダウンロード
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateCsvFilename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// CSVフィールドのエスケープ
function escapeCsvField(field) {
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// CSV用日付フォーマット（作成日）
function formatDateForCsv(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

// CSV用日付フォーマット（対象日）
function formatTargetDateForCsv(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

// CSVファイル名生成
function generateCsvFilename() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `tasks_${year}${month}${day}_${hours}${minutes}${seconds}.csv`;
}

// input[type="date"]用フォーマット
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 対象日の表示フォーマット
function formatTargetDate(dateString) {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

// 対象日のクラスを取得（過去・今日判定）
function getTargetDateClass(dateString) {
    if (!dateString) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    
    if (target.getTime() === today.getTime()) {
        return 'today';
    } else if (target < today) {
        return 'past';
    }
    return '';
}

// 時間をフォーマット
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

// 優先順位に応じたクラスを取得
function getPriorityClass(priority, totalIncompleteTasks) {
    const ratio = priority / totalIncompleteTasks;
    if (ratio <= 0.33) {
        return 'priority-high';
    } else if (ratio <= 0.66) {
        return 'priority-medium';
    } else {
        return 'priority-low';
    }
}

// 統計を更新
function updateStats(tasks) {
    const total = tasks.length;
    const remaining = tasks.filter(t => !t.completed).length;
    const totalMinutes = tasks
        .filter(t => !t.completed)
        .reduce((sum, t) => sum + t.estimatedTime, 0);

    document.getElementById('totalTasks').textContent = total;
    document.getElementById('remainingTasks').textContent = remaining;
    document.getElementById('totalTime').textContent = formatTime(totalMinutes);
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 通常表示のタスク行を生成
function renderTaskRow(task, totalIncompleteTasks) {
    const isSelected = selectedTaskIds.has(task.id);
    const dateClass = task.completed ? '' : getTargetDateClass(task.targetDate);
    const priorityClass = task.completed ? 'priority-low' : getPriorityClass(task.priority, totalIncompleteTasks);
    const draggable = !task.completed;
    
    return `
        <div class="task-item ${task.completed ? 'completed' : ''} ${isSelected ? 'selected' : ''}"
             data-id="${task.id}"
             draggable="${draggable}"
             ondragstart="handleDragStart(event, ${task.id})"
             ondragend="handleDragEnd(event)"
             ondragover="handleDragOver(event, ${task.id})"
             ondrop="handleDrop(event, ${task.id})">
            <div class="drag-handle" title="${draggable ? 'ドラッグで並び替え' : ''}">
                ${draggable ? '⋮⋮' : ''}
            </div>
            <div class="task-checkbox">
                <input type="checkbox" 
                       ${isSelected ? 'checked' : ''} 
                       onchange="handleTaskSelect(${task.id}, this.checked)">
            </div>
            <div>
                <span class="priority-badge ${priorityClass}">${task.priority}</span>
            </div>
            <div class="task-name-text">${escapeHtml(task.name)}</div>
            <div class="task-time">${formatTime(task.estimatedTime)}</div>
            <div class="task-target-date ${dateClass}">${formatTargetDate(task.targetDate)}</div>
            <div class="task-actions">
                <button class="btn-icon btn-complete" onclick="toggleComplete(${task.id})" title="${task.completed ? '未完了に戻す' : '完了にする'}">
                    ${task.completed ? '↩️' : '✓'}
                </button>
                <button class="btn-icon btn-edit" onclick="startEdit(${task.id})" title="編集">
                    ✏️
                </button>
                <button class="btn-icon btn-delete" onclick="deleteTask(${task.id})" title="削除">
                    ✕
                </button>
            </div>
        </div>
    `;
}

// 編集中のタスク行を生成
function renderEditingTaskRow(task, totalIncompleteTasks) {
    const isSelected = selectedTaskIds.has(task.id);
    const maxPriority = totalIncompleteTasks;
    
    return `
        <div class="task-item editing ${isSelected ? 'selected' : ''}" data-id="${task.id}">
            <div class="drag-handle"></div>
            <div class="task-checkbox">
                <input type="checkbox" 
                       ${isSelected ? 'checked' : ''} 
                       onchange="handleTaskSelect(${task.id}, this.checked)">
            </div>
            <div>
                <input type="number" 
                       id="edit-priority-${task.id}" 
                       class="inline-input inline-input-priority" 
                       value="${task.priority}" 
                       min="1"
                       max="${maxPriority}"
                       onkeydown="handleEditKeypress(event, ${task.id})">
            </div>
            <div>
                <input type="text" 
                       id="edit-name-${task.id}" 
                       class="inline-input inline-input-name" 
                       value="${escapeHtml(task.name)}"
                       onkeydown="handleEditKeypress(event, ${task.id})">
            </div>
            <div>
                <input type="number" 
                       id="edit-time-${task.id}" 
                       class="inline-input inline-input-time" 
                       value="${task.estimatedTime}" 
                       min="1"
                       onkeydown="handleEditKeypress(event, ${task.id})">
            </div>
            <div>
                <input type="date" 
                       id="edit-date-${task.id}" 
                       class="inline-input inline-input-date" 
                       value="${task.targetDate}"
                       onkeydown="handleEditKeypress(event, ${task.id})">
            </div>
            <div class="task-actions">
                <button class="btn-icon btn-save" onclick="saveEdit(${task.id})" title="保存">
                    ✓
                </button>
                <button class="btn-icon btn-cancel" onclick="cancelEdit()" title="キャンセル">
                    ✕
                </button>
            </div>
        </div>
    `;
}

// タスクをレンダリング
function renderTasks() {
    let tasks = getTasks();

    updateStats(tasks);

    // ツールバーの表示/非表示
    if (tasks.length === 0) {
        taskToolbar.classList.add('hidden');
        taskContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>タスクがありません<br>新しいタスクを追加してください</p>
            </div>
        `;
        selectAllCheckbox.checked = false;
        selectedTaskIds.clear();
        return;
    }

    taskToolbar.classList.remove('hidden');

    // 存在しないタスクIDを選択から削除
    const taskIds = new Set(tasks.map(t => t.id));
    selectedTaskIds.forEach(id => {
        if (!taskIds.has(id)) {
            selectedTaskIds.delete(id);
        }
    });

    // 編集中のタスクが存在しない場合はリセット
    if (editingTaskId && !taskIds.has(editingTaskId)) {
        editingTaskId = null;
    }

    // 優先順位でソート（完了タスクは後ろに）
    tasks.sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        return a.priority - b.priority;
    });

    const totalIncompleteTasks = tasks.filter(t => !t.completed).length;

    taskContainer.innerHTML = tasks.map(task => {
        if (task.id === editingTaskId) {
            return renderEditingTaskRow(task, totalIncompleteTasks);
        }
        return renderTaskRow(task, totalIncompleteTasks);
    }).join('');

    updateSelectAllState();
    updateDeleteSelectedBtn();

    // 編集中の場合、タスク名入力欄にフォーカス
    if (editingTaskId) {
        const nameInput = document.getElementById(`edit-name-${editingTaskId}`);
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }
}
