// your code goes here
class TodoApp {
    constructor() {
        this.tasks = new Map();
        this.currentFilter = 'all';
        this.currentSort = 'newest';
        this.selectedTasks = new Set();
        this.draggedTask = null;
        this.undoStack = [];
        this.redoStack = [];
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadFromStorage();
        this.render();
        this.setupKeyboardShortcuts();
        this.initializeTheme();
    }

    initializeElements() {
        // Form elements
        this.taskForm = document.getElementById('taskForm');
        this.taskInput = document.getElementById('taskInput');
        this.prioritySelect = document.getElementById('prioritySelect');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        
        // Control elements
        this.filterButtons = document.querySelectorAll('[data-filter]');
        this.sortSelect = document.getElementById('sortSelect');
        this.bulkActions = document.getElementById('bulkActions');
        
        // Bulk action buttons
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.markAllDoneBtn = document.getElementById('markAllDoneBtn');
        this.deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        this.clearSelectionBtn = document.getElementById('clearSelectionBtn');
        
        // Display elements
        this.taskList = document.getElementById('taskList');
        this.emptyState = document.getElementById('emptyState');
        this.toastContainer = document.getElementById('toastContainer');
        
        // Stats elements
        this.statElements = {
            total: document.getElementById('statTotal'),
            completed: document.getElementById('statCompleted'),
            pending: document.getElementById('statPending'),
            productivity: document.getElementById('statProductivity')
        };
        
        // Count elements
        this.countElements = {
            all: document.getElementById('countAll'),
            pending: document.getElementById('countPending'),
            completed: document.getElementById('countCompleted')
        };
        
        // Modal elements
        this.confirmModal = document.getElementById('confirmModal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalDescription = document.getElementById('modal-description');
        this.modalCancel = document.getElementById('modalCancel');
        this.modalConfirm = document.getElementById('modalConfirm');
        
        // Theme and utility elements
        this.themeToggle = document.getElementById('themeToggle');
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.fileInput = document.getElementById('fileInput');
    }

    attachEventListeners() {
        // Form submission
        this.taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // Filter buttons
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => this.setFilter(btn.dataset.filter));
        });

        // Sort selection
        this.sortSelect.addEventListener('change', () => {
            this.currentSort = this.sortSelect.value;
            this.render();
        });

        // Bulk actions
        this.selectAllBtn.addEventListener('click', () => this.selectAllTasks());
        this.markAllDoneBtn.addEventListener('click', () => this.markSelectedDone());
        this.deleteSelectedBtn.addEventListener('click', () => this.deleteSelectedTasks());
        this.clearSelectionBtn.addEventListener('click', () => this.clearSelection());

        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Import/Export
        this.exportBtn.addEventListener('click', () => this.exportData());
        this.importBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.importData(e));

        // Modal
        this.modalCancel.addEventListener('click', () => this.hideModal());
        this.modalConfirm.addEventListener('click', () => this.confirmModalAction());
        this.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.confirmModal) this.hideModal();
        });

        // Auto-save on input
        this.taskInput.addEventListener('input', this.debounce(() => {
            this.saveToStorage();
        }, 500));
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter: Add task
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.addTask();
            }
            
            // Ctrl/Cmd + A: Select all (when not in input)
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' && 
                document.activeElement !== this.taskInput) {
                e.preventDefault();
                this.selectAllTasks();
            }
            
            // Delete: Delete selected tasks
            if (e.key === 'Delete' && this.selectedTasks.size > 0 && 
                document.activeElement !== this.taskInput) {
                e.preventDefault();
                this.deleteSelectedTasks();
            }
            
            // Escape: Clear selection or close modal
            if (e.key === 'Escape') {
                if (this.confirmModal.hasAttribute('hidden')) {
                    this.clearSelection();
                } else {
                    this.hideModal();
                }
            }
            
            // Ctrl/Cmd + Z: Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            
            // Ctrl/Cmd + Shift + Z: Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.redo();
            }
        });
    }

        addTask() {
        const text = this.taskInput.value.trim();
        const priority = this.prioritySelect.value;

        if (!text) {
            this.showToast('Enter a task first', 'warning');
            return;
        }

        const newTask = {
            id: this.generateId(),
            text,
            priority,
            completed: false,
            createdAt: Date.now()
        };

        this.tasks.set(newTask.id, newTask);
        this.taskInput.value = '';
        this.prioritySelect.value = 'medium'; // Reset priority
        this.taskInput.focus();
        this.saveToStorage();
        this.render();
        this.showToast('Task added successfully!', 'success');
    }

    generateId() {
        return Math.random().toString(36).substring(2, 15);
    }

    toggleComplete(id) {
        const task = this.tasks.get(id);
        if (task) {
            task.completed = !task.completed;
            if (task.completed) {
                task.completedAt = Date.now();
            } else {
                delete task.completedAt;
            }
            this.saveToStorage();
            this.render();
        }
    }
    
    removeTask(id) {
        this.pushToUndoStack({ action: 'remove', task: this.tasks.get(id) });
        this.tasks.delete(id);
        this.selectedTasks.delete(id);
        this.saveToStorage();
        this.render();
        this.showToast('Task removed successfully!', 'warning');
    }

    render() {
        const filteredTasks = this.filterTasks();
        const sortedTasks = this.sortTasks(filteredTasks);

        this.taskList.innerHTML = '';
        this.updateStats(sortedTasks);
        this.updateFilterCounts(sortedTasks);

        if (sortedTasks.length === 0) {
            this.emptyState.hidden = false;
            this.bulkActions.hidden = true;
        } else {
            this.emptyState.hidden = true;
            this.bulkActions.hidden = false;

            sortedTasks.forEach(task => {
                const listItem = this.createTaskListItem(task);
                this.taskList.appendChild(listItem);
            });
        }
    }

    createTaskListItem(task) {
        const listItem = document.createElement('li');
        listItem.classList.add('task-item');
        listItem.id = `task-${task.id}`;
        if (task.completed) {
            listItem.classList.add('task-item--completed');
        }
        if (this.selectedTasks.has(task.id)) {
            listItem.classList.add('task-item--selected');
        }

        listItem.innerHTML = `
            <div class="task-checkbox">
                <input type="checkbox" id="check-${task.id}" ${task.completed ? 'checked' : ''}
                    aria-label="Mark task as complete">
            </div>
            <div class="task-content">
                <span class="task-text ${task.completed ? 'task-text--completed' : ''}">${task.text}</span>
                <span class="task-meta">Created ${this.formatDate(task.createdAt)}</span>
            </div>
            <span class="task-priority task-priority--${task.priority}">${task.priority}</span>
            <div class="task-actions">
                <button class="task-action-btn" aria-label="Edit Task" title="Edit Task"
                    onclick="app.editTask('${task.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="task-action-btn task-action-btn--danger" aria-label="Delete Task" title="Delete Task"
                    onclick="app.confirmDelete('${task.id}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;

        const checkbox = listItem.querySelector(`#check-${task.id}`);
        checkbox.addEventListener('change', () => this.toggleComplete(task.id));

        // Drag and drop functionality
        listItem.draggable = true;
        listItem.addEventListener('dragstart', (e) => this.handleDragStart(e, task.id));
        listItem.addEventListener('dragover', (e) => this.handleDragOver(e));
        listItem.addEventListener('drop', (e) => this.handleDrop(e, task.id));
        listItem.addEventListener('dragend', () => this.handleDragEnd());

        return listItem;
    }

    filterTasks() {
        if (this.currentFilter === 'all') {
            return Array.from(this.tasks.values());
        } else if (this.currentFilter === 'pending') {
            return Array.from(this.tasks.values()).filter(task => !task.completed);
        } else if (this.currentFilter === 'completed') {
            return Array.from(this.tasks.values()).filter(task => task.completed);
        }
    }

    sortTasks(tasks) {
        switch (this.currentSort) {
            case 'newest':
                return tasks.sort((a, b) => b.createdAt - a.createdAt);
            case 'oldest':
                return tasks.sort((a, b) => a.createdAt - b.createdAt);
            case 'priority':
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
            case 'alphabetical':
                return tasks.sort((a, b) => a.text.localeCompare(b.text));
            default:
                return tasks;
        }
    }

    updateStats(tasks) {
        const total = tasks.length;
        const completed = tasks.filter(task => task.completed).length;
        const pending = total - completed;
        const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;

        this.statElements.total.textContent = total;
        this.statElements.completed.textContent = completed;
        this.statElements.pending.textContent = pending;
        this.statElements.productivity.textContent = `${productivity}%`;
    }

    updateFilterCounts(tasks) {
        this.countElements.all.textContent = tasks.length;
        this.countElements.pending.textContent = tasks.filter(task => !task.completed).length;
        this.countElements.completed.textContent = tasks.filter(task => task.completed).length;
    }


    setFilter(filter) {
        this.currentFilter = filter;
        this.filterButtons.forEach(btn => {
            btn.classList.toggle('btn--filter-active', btn.dataset.filter === filter);
            btn.setAttribute('aria-pressed', btn.dataset.filter === filter);
        });
        this.render();
    }

    selectAllTasks() {
        const filteredTasks = this.filterTasks();
        const allSelected = filteredTasks.every(task => this.selectedTasks.has(task.id));
        filteredTasks.forEach(task => {
            if (allSelected) {
                this.selectedTasks.delete(task.id);
            } else {
                this.selectedTasks.add(task.id);
            }
        });
        this.render();
    }

    markSelectedDone() {
        if (this.selectedTasks.size === 0) {
            this.showToast('No tasks selected', 'warning');
            return;
        }

        this.selectedTasks.forEach(id => {
            this.toggleComplete(id);
        });
        this.clearSelection();
    }

    deleteSelectedTasks() {
        if (this.selectedTasks.size === 0) {
            this.showToast('No tasks selected', 'warning');
            return;
        }

        this.showModal('Delete selected tasks?', 'Are you sure you want to delete the selected tasks? This action cannot be undone.', () => {
            this.selectedTasks.forEach(id => this.removeTask(id));
            this.clearSelection();
        });
    }

    clearSelection() {
        this.selectedTasks.clear();
        this.render();
    }


    formatDate(timestamp) {
        const date = new Date(timestamp);
        const options = { 
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit'
        };
        return date.toLocaleDateString(undefined, options);
    }

    saveToStorage() {
        localStorage.setItem('tasks', JSON.stringify([...this.tasks]));
    }

    loadFromStorage() {
        const storedTasks = localStorage.getItem('tasks');
        if (storedTasks) {
            const parsedTasks = JSON.parse(storedTasks);
            parsedTasks.forEach(taskData => {
                this.tasks.set(taskData.id, taskData);
            });
        }
    }

    showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.classList.add('toast', `toast--${type}`);
    
    // Create unique ID for this toast
    const toastId = 'toast-' + Date.now();
    toast.id = toastId;
    
    toast.innerHTML = `
        <span class="toast__icon" aria-hidden="true">${this.getToastIcon(type)}</span>
        <div class="toast__content">
            <div class="toast__title">${this.getToastTitle(type)}</div>
            <div class="toast__message">${message}</div>
        </div>
        <button class="toast__close" aria-label="Close notification" onclick="app.closeToast('${toastId}')">×</button>
    `;
    
    this.toastContainer.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        this.closeToast(toastId);
    }, 4000);
}

closeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.classList.add('toast--removing');
        toast.addEventListener('animationend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }
}

getToastIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'warning': return '⚠️';
        case 'error': return '❌';
        default: return 'ℹ️';
    }
}

getToastTitle(type) {
    switch (type) {
        case 'success': return 'Success';
        case 'warning': return 'Warning';
        case 'error': return 'Error';
        default: return 'Info';
    }
}


    initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.body.dataset.theme = savedTheme;
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.dataset.theme = 'dark';
        }
    }

    toggleTheme() {
        const currentTheme = document.body.dataset.theme;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.dataset.theme = newTheme;
        localStorage.setItem('theme', newTheme);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // In the TodoApp class:

showModal(title, description, confirmAction) {
    this.modalTitle.textContent = title;
    this.modalDescription.textContent = description;
    this.confirmModal.hidden = false;
    
    // Remove previous event listeners
    this.modalCancel.removeEventListener('click', this.handleModalCancel);
    this.modalConfirm.removeEventListener('click', this.handleModalConfirm);
    
    // Create bound event handlers
    this.handleModalCancel = this.hideModal.bind(this);
    this.handleModalConfirm = () => {
        confirmAction();
        this.hideModal();
    };
    
    // Add event listeners
    this.modalCancel.addEventListener('click', this.handleModalCancel);
    this.modalConfirm.addEventListener('click', this.handleModalConfirm);
    
    // Focus the confirm button
    this.modalConfirm.focus();
    
    // Prevent clicks on the modal from closing it
    this.confirmModal.addEventListener('click', (e) => {
        if (e.target === this.confirmModal) {
            this.hideModal();
        }
    });
}

hideModal() {
    this.confirmModal.hidden = true;
}


    confirmDelete(id) {
        this.showModal('Delete task?', 'Are you sure you want to delete this task?', () => this.removeTask(id));
    }

    editTask(id) {
        const task = this.tasks.get(id);
        if (task) {
            this.taskInput.value = task.text;
            this.prioritySelect.value = task.priority;
            this.removeTask(id); // Remove the old task
            this.taskInput.focus(); // Focus for immediate editing
        }
    }


    handleDragStart(e, taskId) {
        this.draggedTask = taskId;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskId); // Required for Firefox
        const draggedItem = document.getElementById(`task-${taskId}`);
        draggedItem.classList.add('task-item--dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.taskList.classList.add('task-list--drag-over');
    }

    handleDrop(e, targetTaskId) {
        e.preventDefault();
        if (this.draggedTask && this.draggedTask !== targetTaskId) {
            this.reorderTasks(this.draggedTask, targetTaskId);
        }
    }

    handleDragEnd() {
        this.draggedTask = null;
        this.taskList.classList.remove('task-list--drag-over');
        const draggedItem = document.getElementById(`task-${this.draggedTask}`);
        if (draggedItem) {
            draggedItem.classList.remove('task-item--dragging');
        }
    }

    reorderTasks(sourceTaskId, targetTaskId) {
        const sourceTask = this.tasks.get(sourceTaskId);
        const targetTask = this.tasks.get(targetTaskId);

        if (!sourceTask || !targetTask) return;

        const filteredTasks = this.filterTasks();
        const sourceIndex = filteredTasks.findIndex(task => task.id === sourceTaskId);
        const targetIndex = filteredTasks.findIndex(task => task.id === targetTaskId);

        if (sourceIndex !== -1 && targetIndex !== -1) {
            // Update the order in the filtered array
            filteredTasks.splice(targetIndex, 0, filteredTasks.splice(sourceIndex, 1)[0]);

            // Update the order in the original tasks Map
            this.tasks = new Map(filteredTasks.map(task => [task.id, task]));

            this.saveToStorage();
            this.render();
        }
    }

    pushToUndoStack(action) {
        this.undoStack.push(action);
        this.redoStack = []; // Clear redo stack when a new action is performed
    }

    undo() {
        if (this.undoStack.length === 0) return;

        const action = this.undoStack.pop();
        this.redoStack.push(action);

        switch (action.action) {
            case 'add':
                this.tasks.delete(action.task.id);
                break;
            case 'remove':
                this.tasks.set(action.task.id, action.task);
                break;
            case 'toggle':
                this.toggleComplete(action.taskId); // Toggle back to original state
                break;
            case 'edit':
                this.tasks.set(action.taskId, action.oldTask);
                break;
        }

        this.saveToStorage();
        this.render();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const action = this.redoStack.pop();
        this.undoStack.push(action);

        switch (action.action) {
            case 'add':
                this.tasks.set(action.task.id, action.task);
                break;
            case 'remove':
                this.tasks.delete(action.task.id);
                break;
            case 'toggle':
                this.toggleComplete(action.taskId); // Toggle back to the undone state
                break;
            case 'edit':
                this.tasks.set(action.taskId, action.newTask);
                break;
        }

        this.saveToStorage();
        this.render();
    }

    exportData() {
        const data = JSON.stringify([...this.tasks]);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'todo_data.json';
        link.click();
        URL.revokeObjectURL(url);
    }

        importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedTasks = JSON.parse(event.target.result);
                this.tasks = new Map(importedTasks.map(task => [task.id, task]));
                this.saveToStorage();
                this.render();
                this.showToast('Data imported successfully!', 'success');
            } catch (error) {
                this.showToast('Error importing data. Invalid JSON format.', 'error');
                console.error("Error importing data:", error);
            }
        };
        reader.readAsText(file);
        this.fileInput.value = ''; // Clear the file input
    }


}


const app = new TodoApp();


// Add event listeners for task selection
app.taskList.addEventListener('click', (event) => {
    if (event.target.closest('.task-item')) {
        const taskId = event.target.closest('.task-item').id.split('-')[1];
        if (event.ctrlKey || event.metaKey) {
            // Toggle selection with Ctrl/Cmd key
            if (app.selectedTasks.has(taskId)) {
                app.selectedTasks.delete(taskId);
            } else {
                app.selectedTasks.add(taskId);
            }
        } else if (event.shiftKey) {
            // Range selection with Shift key (Not implemented yet)
            // TODO: Implement range selection
        } else {
            // Single selection
            app.selectedTasks.clear();
            app.selectedTasks.add(taskId);
        }
        app.render(); // Re-render to update selection styles
    }
});

// Prevent default drag-and-drop behavior outside the list
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

