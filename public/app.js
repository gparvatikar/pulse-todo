(() => {
  'use strict';

  // Application State
  const state = {
    tasks: [],
    categories: [],
    activeView: 'all',          // 'all' | 'today' | 'overdue' | 'upcoming' | 'recurring' | 'completed'
    activeCategory: null,       // category name or null
    searchQuery: '',
    priorityFilter: 'all',      // 'all' | 'high' | 'medium' | 'low'
    sortBy: 'due_date',         // 'due_date' | 'priority' | 'newest' | 'title'
    showCompletedInViews: true,
    modalPriority: 'medium',
    newCategoryColor: '#6366f1'
  };

  const VIEW_TITLES = {
    all: 'All Tasks',
    today: 'Today',
    overdue: 'Overdue',
    upcoming: 'Upcoming',
    recurring: 'Recurring Tasks',
    completed: 'Completed'
  };

  const RECURRENCE_LABELS = {
    none: 'No Repeat',
    daily: 'Daily',
    weekly: 'Weekly',
    weekdays: 'Weekdays (Mon–Fri)',
    monthly: 'Monthly',
    yearly: 'Yearly'
  };

  const PRIORITY_WEIGHT = {
    high: 3,
    medium: 2,
    low: 1
  };

  const TITLE_CHAR_LIMIT = 50;

  // DOM Elements
  const dom = {
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    openSidebarBtn: document.getElementById('openSidebarBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    openNewTaskModalBtn: document.getElementById('openNewTaskModalBtn'),
    viewNav: document.getElementById('viewNav'),
    categoryNav: document.getElementById('categoryNav'),
    toggleAddCategoryBtn: document.getElementById('toggleAddCategoryBtn'),
    addCategoryForm: document.getElementById('addCategoryForm'),
    newCategoryName: document.getElementById('newCategoryName'),
    colorSwatches: document.getElementById('colorSwatches'),
    progressPercent: document.getElementById('progressPercent'),
    progressBar: document.getElementById('progressBar'),
    progressSubtext: document.getElementById('progressSubtext'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeToggleText: document.getElementById('themeToggleText'),
    sunIcon: document.getElementById('sunIcon'),
    moonIcon: document.getElementById('moonIcon'),
    storageModeBadge: document.getElementById('storageModeBadge'),
    currentViewTitle: document.getElementById('currentViewTitle'),
    activeCategoryPill: document.getElementById('activeCategoryPill'),
    currentDateDisplay: document.getElementById('currentDateDisplay'),
    mobileSearchToggleBtn: document.getElementById('mobileSearchToggleBtn'),
    mobileThemeToggleBtn: document.getElementById('mobileThemeToggleBtn'),
    headerControls: document.getElementById('headerControls'),
    mobileChipStrip: document.getElementById('mobileChipStrip'),
    searchInput: document.getElementById('searchInput'),
    priorityFilter: document.getElementById('priorityFilter'),
    sortSelect: document.getElementById('sortSelect'),
    quickAddForm: document.getElementById('quickAddForm'),
    quickTitleInput: document.getElementById('quickTitleInput'),
    quickTitleCharCount: document.getElementById('quickTitleCharCount'),
    quickDueDateInput: document.getElementById('quickDueDateInput'),
    quickRecurrenceInput: document.getElementById('quickRecurrenceInput'),
    quickPriorityInput: document.getElementById('quickPriorityInput'),
    quickCategoryInput: document.getElementById('quickCategoryInput'),
    taskCountSummary: document.getElementById('taskCountSummary'),
    toggleShowCompletedBtn: document.getElementById('toggleShowCompletedBtn'),
    toggleShowCompletedText: document.getElementById('toggleShowCompletedText'),
    clearCompletedBtn: document.getElementById('clearCompletedBtn'),
    taskListContainer: document.getElementById('taskListContainer'),
    taskModalBackdrop: document.getElementById('taskModalBackdrop'),
    modalCard: document.getElementById('modalCard'),
    modalGrabber: document.getElementById('modalGrabber'),
    modalTitle: document.getElementById('modalTitle'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    taskModalForm: document.getElementById('taskModalForm'),
    modalTaskId: document.getElementById('modalTaskId'),
    modalTaskTitle: document.getElementById('modalTaskTitle'),
    modalTitleCharCount: document.getElementById('modalTitleCharCount'),
    modalTaskNotes: document.getElementById('modalTaskNotes'),
    modalTaskDueDate: document.getElementById('modalTaskDueDate'),
    modalTaskRecurrence: document.getElementById('modalTaskRecurrence'),
    recurrencePreviewBox: document.getElementById('recurrencePreviewBox'),
    recurrencePreviewText: document.getElementById('recurrencePreviewText'),
    modalPrioritySelector: document.getElementById('modalPrioritySelector'),
    modalTaskCategory: document.getElementById('modalTaskCategory'),
    modalDeleteBtn: document.getElementById('modalDeleteBtn'),
    mobileBottomNav: document.getElementById('mobileBottomNav'),
    mobileFabBtn: document.getElementById('mobileFabBtn'),
    mobileBadgeAll: document.getElementById('mobile-badge-all'),
    mobileBadgeToday: document.getElementById('mobile-badge-today'),
    mobileBadgeRecurring: document.getElementById('mobile-badge-recurring'),
    mobileBadgeCompleted: document.getElementById('mobile-badge-completed'),
    toastContainer: document.getElementById('toastContainer')
  };

  // Date Helpers
  function getLocalTodayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDaysToDateStr(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    const ny = dt.getUTCFullYear();
    const nm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const nd = String(dt.getUTCDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  }

  function formatReadableDate(dateStr) {
    if (!dateStr) return '';
    const today = getLocalTodayStr();
    const tomorrow = addDaysToDateStr(today, 1);
    const yesterday = addDaysToDateStr(today, -1);

    if (dateStr === today) return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    if (dateStr === yesterday) return 'Yesterday';

    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const currentYear = new Date().getFullYear();
    const options = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(y !== currentYear ? { year: 'numeric' } : {})
    };
    return dt.toLocaleDateString(undefined, options);
  }

  function getDueDateStatus(dueDateStr, completed) {
    if (!dueDateStr || completed) return 'neutral';
    const today = getLocalTodayStr();
    if (dueDateStr < today) return 'overdue';
    if (dueDateStr === today) return 'today';
    return 'upcoming';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Toast Notifications (supports optional interactive action button such as "Undo")
  function showToast(message, type = 'default', action = null) {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'danger' ? 'toast-danger' : ''}`;
    toast.innerHTML = `
      <span>${escapeHtml(message)}</span>
      ${action && action.label ? `<button type="button" class="toast-action-btn">${escapeHtml(action.label)}</button>` : ''}
    `;

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 220);
    };

    if (action && typeof action.onClick === 'function') {
      const actionBtn = toast.querySelector('.toast-action-btn');
      if (actionBtn) {
        actionBtn.addEventListener('click', () => {
          dismiss();
          action.onClick();
        });
      }
    }

    dom.toastContainer.appendChild(toast);
    setTimeout(dismiss, action ? 5000 : 3600);
  }

  // On-Device Local Storage Engine (for iOS/Android Capacitor & Offline PWA mode)
  const LocalStore = (() => {
    const TASKS_KEY = 'pulse_tasks_v1';
    const CATS_KEY = 'pulse_categories_v1';

    function parseDateUTC(dateStr) {
      const [y, m, d] = String(dateStr).split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    }

    function formatDateUTC(dt) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    function addMonthsClamped(dt, months) {
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth();
      const d = dt.getUTCDate();
      const targetMonth = m + months;
      const firstOfTarget = new Date(Date.UTC(y, targetMonth, 1));
      const daysInTargetMonth = new Date(
        Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)
      ).getUTCDate();
      return new Date(
        Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth(), Math.min(d, daysInTargetMonth))
      );
    }

    function stepRecurrenceOnce(dt, recurrence) {
      switch (recurrence) {
        case 'daily': {
          const next = new Date(dt.getTime());
          next.setUTCDate(next.getUTCDate() + 1);
          return next;
        }
        case 'weekly': {
          const next = new Date(dt.getTime());
          next.setUTCDate(next.getUTCDate() + 7);
          return next;
        }
        case 'weekdays': {
          const next = new Date(dt.getTime());
          do {
            next.setUTCDate(next.getUTCDate() + 1);
          } while (next.getUTCDay() === 0 || next.getUTCDay() === 6);
          return next;
        }
        case 'monthly':
          return addMonthsClamped(dt, 1);
        case 'yearly':
          return addMonthsClamped(dt, 12);
        default:
          return null;
      }
    }

    function calculateNextDueDate(currentDueDateStr, recurrence, referenceTodayStr) {
      if (!recurrence || recurrence === 'none') return null;
      const todayStr = referenceTodayStr || getLocalTodayStr();
      const todayDt = parseDateUTC(todayStr);
      let cursor = currentDueDateStr ? parseDateUTC(currentDueDateStr) : new Date(todayDt.getTime());

      let next = stepRecurrenceOnce(cursor, recurrence);
      if (!next) return null;

      let safety = 0;
      while (next <= todayDt && safety < 1000) {
        const stepped = stepRecurrenceOnce(next, recurrence);
        if (!stepped) break;
        next = stepped;
        safety++;
      }
      return formatDateUTC(next);
    }

    function ensureSeeded() {
      let categories = null;
      let tasks = null;
      try {
        categories = JSON.parse(localStorage.getItem(CATS_KEY));
        tasks = JSON.parse(localStorage.getItem(TASKS_KEY));
      } catch {
        categories = null;
        tasks = null;
      }

      if (!Array.isArray(categories) || categories.length === 0) {
        categories = [
          { id: 1, name: 'Personal', color: '#6366f1' },
          { id: 2, name: 'Work', color: '#0ea5e9' },
          { id: 3, name: 'Errands', color: '#f59e0b' },
          { id: 4, name: 'Health', color: '#10b981' },
          { id: 5, name: 'Finance', color: '#ec4899' }
        ];
        localStorage.setItem(CATS_KEY, JSON.stringify(categories));
      }

      if (!Array.isArray(tasks)) {
        const today = getLocalTodayStr();
        const tomorrow = addDaysToDateStr(today, 1);
        const nowIso = new Date().toISOString();
        tasks = [
          {
            id: 1,
            title: 'Review today’s priorities & schedule',
            description: 'Check upcoming deadlines and focus blocks for the day.',
            due_date: today,
            recurrence: 'weekdays',
            priority: 'high',
            category: 'Work',
            completed: false,
            completed_at: null,
            spawned_next_id: null,
            created_at: nowIso,
            updated_at: nowIso
          },
          {
            id: 2,
            title: '30-minute evening walk & hydration',
            description: 'Step outside and disconnect from screens.',
            due_date: today,
            recurrence: 'daily',
            priority: 'medium',
            category: 'Health',
            completed: false,
            completed_at: null,
            spawned_next_id: null,
            created_at: nowIso,
            updated_at: nowIso
          },
          {
            id: 3,
            title: 'Pick up groceries & fresh produce',
            description: 'Oat milk, berries, spinach, sourdough bread, coffee beans.',
            due_date: tomorrow,
            recurrence: 'weekly',
            priority: 'medium',
            category: 'Errands',
            completed: false,
            completed_at: null,
            spawned_next_id: null,
            created_at: nowIso,
            updated_at: nowIso
          }
        ];
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      }

      return { tasks, categories };
    }

    function saveSnapshot(tasks, categories) {
      if (Array.isArray(tasks)) localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      if (Array.isArray(categories)) localStorage.setItem(CATS_KEY, JSON.stringify(categories));
    }

    function handleRequest(url, options = {}) {
      const method = (options.method || 'GET').toUpperCase();
      const body = options.body ? JSON.parse(options.body) : {};
      const parsedUrl = new URL(url, window.location.origin);
      const pathname = parsedUrl.pathname;
      const { tasks, categories } = ensureSeeded();

      if (pathname === '/api/bootstrap' && method === 'GET') {
        return { tasks, categories };
      }

      if (pathname === '/api/recurrence-preview' && method === 'GET') {
        const dueDate = parsedUrl.searchParams.get('due_date') || null;
        const recurrence = parsedUrl.searchParams.get('recurrence') || 'none';
        const today = parsedUrl.searchParams.get('today') || getLocalTodayStr();
        return { next_due_date: calculateNextDueDate(dueDate, recurrence, today) };
      }

      if (pathname === '/api/tasks' && method === 'POST') {
        const title = String(body.title || '').trim();
        if (!title) throw new Error('Task title is required');
        if (title.length > 200) throw new Error('Task title cannot exceed 200 characters');
        const description = String(body.description || '').trim();
        if (description.length > 5000) throw new Error('Task description cannot exceed 5000 characters');
        const recurrence = body.recurrence || 'none';
        const dueDate = body.due_date || (recurrence !== 'none' ? (body.client_today || getLocalTodayStr()) : null);
        const nextId = tasks.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) + 1;
        const nowIso = new Date().toISOString();
        const newTask = {
          id: nextId,
          title,
          description,
          due_date: dueDate,
          recurrence,
          priority: body.priority || 'medium',
          category: String(body.category || 'Personal').trim().slice(0, 50) || 'Personal',
          completed: false,
          completed_at: null,
          spawned_next_id: null,
          created_at: nowIso,
          updated_at: nowIso
        };
        tasks.unshift(newTask);
        saveSnapshot(tasks, categories);
        return { task: newTask };
      }

      if (pathname === '/api/tasks/completed' && method === 'DELETE') {
        const before = tasks.length;
        const remaining = tasks.filter(t => !t.completed);
        saveSnapshot(remaining, categories);
        return { removedCount: before - remaining.length };
      }

      const toggleMatch = pathname.match(/^\/api\/tasks\/(\d+)\/toggle$/);
      if (toggleMatch && method === 'PATCH') {
        const id = Number(toggleMatch[1]);
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) throw new Error('Task not found');
        const existing = tasks[idx];
        const newCompleted = !existing.completed;
        const nowIso = new Date().toISOString();
        let spawnedTask = null;
        let removedSpawnedTaskId = null;

        if (newCompleted) {
          let spawnedId = null;
          if (existing.recurrence && existing.recurrence !== 'none') {
            const nextDueDate = calculateNextDueDate(existing.due_date, existing.recurrence, body.client_today);
            const nextId = tasks.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) + 1;
            spawnedTask = {
              id: nextId,
              title: existing.title,
              description: existing.description || '',
              due_date: nextDueDate,
              recurrence: existing.recurrence,
              priority: existing.priority,
              category: existing.category,
              completed: false,
              completed_at: null,
              spawned_next_id: null,
              created_at: nowIso,
              updated_at: nowIso
            };
            spawnedId = nextId;
            tasks.unshift(spawnedTask);
          }
          existing.completed = true;
          existing.completed_at = nowIso;
          existing.spawned_next_id = spawnedId;
          existing.updated_at = nowIso;
        } else {
          if (existing.spawned_next_id) {
            const spawnedIdx = tasks.findIndex(t => t.id === existing.spawned_next_id && !t.completed);
            if (spawnedIdx !== -1) {
              removedSpawnedTaskId = tasks[spawnedIdx].id;
              tasks.splice(spawnedIdx, 1);
            }
          }
          existing.completed = false;
          existing.completed_at = null;
          existing.spawned_next_id = null;
          existing.updated_at = nowIso;
        }

        saveSnapshot(tasks, categories);
        return { task: { ...existing }, spawnedTask, removedSpawnedTaskId };
      }

      const taskMatch = pathname.match(/^\/api\/tasks\/(\d+)$/);
      if (taskMatch) {
        const id = Number(taskMatch[1]);
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) throw new Error('Task not found');
        if (method === 'PUT') {
          const existing = tasks[idx];
          const nextTitle = body.title !== undefined ? String(body.title).trim() : existing.title;
          if (!nextTitle) throw new Error('Task title cannot be empty');
          if (nextTitle.length > 200) throw new Error('Task title cannot exceed 200 characters');
          const nextDesc = body.description !== undefined ? String(body.description).trim() : existing.description;
          if (nextDesc.length > 5000) throw new Error('Task description cannot exceed 5000 characters');
          const updated = {
            ...existing,
            title: nextTitle,
            description: nextDesc,
            due_date: body.due_date !== undefined ? (body.due_date || null) : existing.due_date,
            recurrence: body.recurrence !== undefined ? body.recurrence : existing.recurrence,
            priority: body.priority !== undefined ? body.priority : existing.priority,
            category: body.category !== undefined ? String(body.category).trim().slice(0, 50) : existing.category,
            updated_at: new Date().toISOString()
          };
          tasks[idx] = updated;
          saveSnapshot(tasks, categories);
          return { task: updated };
        }
        if (method === 'DELETE') {
          tasks.splice(idx, 1);
          saveSnapshot(tasks, categories);
          return { success: true };
        }
      }

      if (pathname === '/api/categories' && method === 'POST') {
        const cleanName = String(body.name || '').trim();
        if (!cleanName) throw new Error('Category name is required');
        if (cleanName.length > 50) throw new Error('Category name cannot exceed 50 characters');
        if (categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
          throw new Error('Category already exists');
        }
        const cleanColor = /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : '#6366f1';
        const nextId = categories.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;
        const category = { id: nextId, name: cleanName, color: cleanColor };
        categories.push(category);
        saveSnapshot(tasks, categories);
        return { category };
      }

      const catMatch = pathname.match(/^\/api\/categories\/(\d+)$/);
      if (catMatch && method === 'DELETE') {
        const id = Number(catMatch[1]);
        const cat = categories.find(c => c.id === id);
        if (!cat) throw new Error('Category not found');
        if (cat.name.toLowerCase() === 'personal') {
          throw new Error('Cannot delete the default Personal category');
        }
        const nextCats = categories.filter(c => c.id !== id);
        const nextTasks = tasks.map(t => (t.category === cat.name ? { ...t, category: 'Personal' } : t));
        saveSnapshot(nextTasks, nextCats);
        return { categories: nextCats, tasks: nextTasks };
      }

      throw new Error(`Unsupported offline action: ${method} ${pathname}`);
    }

    return { handleRequest, saveSnapshot };
  })();

  function updateStorageBadge(isLocalMode) {
    if (!dom.storageModeBadge) return;
    dom.storageModeBadge.textContent = isLocalMode ? 'On-Device Storage' : 'SQLite Synced';
    dom.storageModeBadge.classList.toggle('is-local', isLocalMode);
  }

  // API Helper (uses SQLite server when reachable, and seamlessly falls back to on-device storage on mobile/offline)
  async function apiRequest(url, options = {}) {
    const forceOffline = Boolean(
      window.__FORCE_LOCAL_STORAGE__ ||
      new URLSearchParams(window.location.search).get('offline') === '1'
    );
    const isNativeCapacitor = Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (!forceOffline && !isNativeCapacitor && window.location.protocol.startsWith('http')) {
      try {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        const response = await fetch(url, { ...options, headers });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || `Request failed (${response.status})`);
          }
          updateStorageBadge(false);
          return data;
        }
      } catch (err) {
        if (err && err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError') && !err.message.includes('Load failed')) {
          throw err;
        }
      }
    }

    updateStorageBadge(true);
    return LocalStore.handleRequest(url, options);
  }

  // Theme Management
  function initTheme() {
    const saved = localStorage.getItem('pulse_theme') || 'light';
    applyTheme(saved);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pulse_theme', theme);
    if (theme === 'dark') {
      dom.sunIcon.classList.remove('hidden');
      dom.moonIcon.classList.add('hidden');
      dom.themeToggleText.textContent = 'Light Mode';
    } else {
      dom.sunIcon.classList.add('hidden');
      dom.moonIcon.classList.remove('hidden');
      dom.themeToggleText.textContent = 'Dark Mode';
    }
  }

  // Header Date Display
  function updateHeaderDate() {
    const now = new Date();
    dom.currentDateDisplay.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Category Helpers
  function sanitizeHexColor(color) {
    return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? color : '#6366f1';
  }

  function getCategoryColor(catName) {
    const found = state.categories.find(c => c.name.toLowerCase() === String(catName || '').toLowerCase());
    return found ? sanitizeHexColor(found.color) : '#6366f1';
  }

  function renderCategories() {
    // Sidebar list
    const activeTasksByCat = {};
    for (const t of state.tasks) {
      if (!t.completed) {
        const key = (t.category || 'Personal').toLowerCase();
        activeTasksByCat[key] = (activeTasksByCat[key] || 0) + 1;
      }
    }

    dom.categoryNav.innerHTML = state.categories.map(cat => {
      const isSelected = state.activeCategory && state.activeCategory.toLowerCase() === cat.name.toLowerCase();
      const count = activeTasksByCat[cat.name.toLowerCase()] || 0;
      const canDelete = cat.name.toLowerCase() !== 'personal';
      return `
        <div class="nav-item ${isSelected ? 'active' : ''}" data-category="${escapeHtml(cat.name)}">
          <span class="nav-item-left">
            <span class="cat-dot" style="background-color: ${escapeHtml(cat.color)}"></span>
            <span>${escapeHtml(cat.name)}</span>
          </span>
          <span class="cat-item-right">
            ${canDelete ? `
              <button type="button" class="delete-cat-btn" data-delete-cat-id="${cat.id}" data-delete-cat-name="${escapeHtml(cat.name)}" title="Delete category">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            ` : ''}
            <span class="badge">${count}</span>
          </span>
        </div>
      `;
    }).join('');

    // Populate Category Selects (Quick Add + Modal)
    const optionsHtml = state.categories.map(cat =>
      `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`
    ).join('');

    const prevQuick = dom.quickCategoryInput.value;
    const prevModal = dom.modalTaskCategory.value;

    dom.quickCategoryInput.innerHTML = optionsHtml;
    dom.modalTaskCategory.innerHTML = optionsHtml;

    if (prevQuick && state.categories.some(c => c.name === prevQuick)) {
      dom.quickCategoryInput.value = prevQuick;
    }
    if (prevModal && state.categories.some(c => c.name === prevModal)) {
      dom.modalTaskCategory.value = prevModal;
    }
  }

  // Mobile Horizontal Chip Strip (One-Handed Category & Status Filters)
  function renderMobileChipStrip({ countOverdue, countUpcoming }) {
    if (!dom.mobileChipStrip) return;

    const chips = [];

    if (countOverdue > 0 || state.activeView === 'overdue') {
      const isOverdueActive = state.activeView === 'overdue';
      chips.push(`
        <button type="button" class="mobile-chip chip-alert ${isOverdueActive ? 'active' : ''}" data-chip-view="overdue">
          <span>Overdue (${countOverdue})</span>
        </button>
      `);
    }

    const isUpcomingActive = state.activeView === 'upcoming';
    chips.push(`
      <button type="button" class="mobile-chip ${isUpcomingActive ? 'active' : ''}" data-chip-view="upcoming">
        <span>Upcoming (${countUpcoming})</span>
      </button>
    `);

    const isAllCatsActive = !state.activeCategory && state.activeView !== 'overdue' && state.activeView !== 'upcoming';
    chips.push(`
      <button type="button" class="mobile-chip ${isAllCatsActive ? 'active' : ''}" data-chip-category="">
        <span>All Categories</span>
      </button>
    `);

    for (const cat of state.categories) {
      const isCatSelected = state.activeCategory && state.activeCategory.toLowerCase() === cat.name.toLowerCase();
      chips.push(`
        <button type="button" class="mobile-chip ${isCatSelected ? 'active' : ''}" data-chip-category="${escapeHtml(cat.name)}">
          <span class="cat-dot" style="background-color: ${escapeHtml(cat.color)}"></span>
          <span>${escapeHtml(cat.name)}</span>
        </button>
      `);
    }

    dom.mobileChipStrip.innerHTML = chips.join('');
  }

  // Counts & Progress Bar
  function updateCountsAndProgress() {
    const today = getLocalTodayStr();
    const uncompleted = state.tasks.filter(t => !t.completed);
    const completed = state.tasks.filter(t => t.completed);

    const countAll = uncompleted.length;
    const countToday = uncompleted.filter(t => t.due_date === today).length;
    const countOverdue = uncompleted.filter(t => t.due_date && t.due_date < today).length;
    const countUpcoming = uncompleted.filter(t => t.due_date && t.due_date > today).length;
    const countRecurring = uncompleted.filter(t => t.recurrence && t.recurrence !== 'none').length;
    const countCompleted = completed.length;

    document.getElementById('count-all').textContent = countAll;
    document.getElementById('count-today').textContent = countToday;
    document.getElementById('count-overdue').textContent = countOverdue;
    document.getElementById('count-upcoming').textContent = countUpcoming;
    document.getElementById('count-recurring').textContent = countRecurring;
    document.getElementById('count-completed').textContent = countCompleted;

    // Mobile Bottom Navigation Badges
    const updateMobileBadge = (el, val, isAlert = false) => {
      if (!el) return;
      el.textContent = val;
      el.classList.toggle('hidden', val <= 0);
      el.classList.toggle('is-alert', Boolean(isAlert && val > 0));
    };

    updateMobileBadge(dom.mobileBadgeAll, countAll);
    updateMobileBadge(dom.mobileBadgeToday, countToday + countOverdue, countOverdue > 0);
    updateMobileBadge(dom.mobileBadgeRecurring, countRecurring);
    updateMobileBadge(dom.mobileBadgeCompleted, countCompleted);

    // Sync Mobile Horizontal Chip Strip
    renderMobileChipStrip({ countOverdue, countUpcoming });

    const total = state.tasks.length;
    const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    dom.progressPercent.textContent = `${pct}%`;
    dom.progressBar.style.width = `${pct}%`;
    dom.progressSubtext.textContent = `${completed.length} of ${total} total tasks completed`;

    // Show/hide "Clear Completed" button when there are completed tasks
    if (completed.length > 0) {
      dom.clearCompletedBtn.classList.remove('hidden');
      dom.clearCompletedBtn.textContent = `Clear Completed (${completed.length})`;
    } else {
      dom.clearCompletedBtn.classList.add('hidden');
    }
  }

  // Filter & Sort Tasks
  function getFilteredAndSortedTasks() {
    const today = getLocalTodayStr();

    let list = state.tasks.filter(task => {
      // View filter
      switch (state.activeView) {
        case 'today':
          if (task.due_date !== today) return false;
          if (!state.showCompletedInViews && task.completed) return false;
          break;
        case 'overdue':
          if (task.completed || !task.due_date || task.due_date >= today) return false;
          break;
        case 'upcoming':
          if (!task.due_date || task.due_date <= today) return false;
          if (!state.showCompletedInViews && task.completed) return false;
          break;
        case 'recurring':
          if (!task.recurrence || task.recurrence === 'none') return false;
          if (!state.showCompletedInViews && task.completed) return false;
          break;
        case 'completed':
          if (!task.completed) return false;
          break;
        case 'all':
        default:
          if (!state.showCompletedInViews && task.completed) return false;
          break;
      }

      // Category filter
      if (state.activeCategory) {
        if ((task.category || '').toLowerCase() !== state.activeCategory.toLowerCase()) {
          return false;
        }
      }

      // Priority filter
      if (state.priorityFilter !== 'all' && task.priority !== state.priorityFilter) {
        return false;
      }

      // Search query
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const inTitle = (task.title || '').toLowerCase().includes(q);
        const inDesc = (task.description || '').toLowerCase().includes(q);
        const inCat = (task.category || '').toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inCat) return false;
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      // Keep uncompleted tasks above completed tasks unless in 'completed' view
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      if (state.sortBy === 'priority') {
        const diff = (PRIORITY_WEIGHT[b.priority] || 2) - (PRIORITY_WEIGHT[a.priority] || 2);
        if (diff !== 0) return diff;
      } else if (state.sortBy === 'newest') {
        return b.id - a.id;
      } else if (state.sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }

      // Default / fallback: sort by due_date ascending (nulls last), then priority desc
      if (a.due_date && b.due_date) {
        if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
      } else if (a.due_date && !b.due_date) {
        return -1;
      } else if (!a.due_date && b.due_date) {
        return 1;
      }

      const pDiff = (PRIORITY_WEIGHT[b.priority] || 2) - (PRIORITY_WEIGHT[a.priority] || 2);
      if (pDiff !== 0) return pDiff;
      return b.id - a.id;
    });

    return list;
  }

  function renderTaskCardHtml(task) {
    const dueStatus = getDueDateStatus(task.due_date, task.completed);
    const dueClass = dueStatus === 'overdue'
      ? 'due-overdue'
      : dueStatus === 'today'
        ? 'due-today'
        : dueStatus === 'upcoming'
          ? 'due-upcoming'
          : '';

    const dueLabel = task.due_date
      ? (dueStatus === 'overdue' ? `Overdue · ${formatReadableDate(task.due_date)}` : formatReadableDate(task.due_date))
      : '';

    const catColor = getCategoryColor(task.category);
    const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

    return `
      <article class="task-card ${task.completed ? 'is-completed' : ''}" data-task-id="${task.id}">
        <button
          type="button"
          class="task-checkbox-btn priority-${escapeHtml(task.priority)}"
          data-action="toggle"
          data-id="${task.id}"
          aria-label="${task.completed ? 'Mark task incomplete' : 'Mark task complete'}"
          title="${task.completed ? 'Mark incomplete' : 'Complete task'}"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>

        <div class="task-body" data-action="edit" data-id="${task.id}">
          <div class="task-title-row">
            <span class="task-title">${escapeHtml(task.title)}</span>
          </div>
          ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}

          <div class="task-meta">
            ${task.due_date ? `
              <span class="meta-pill ${dueClass}" title="Due date: ${escapeHtml(task.due_date)}">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>${escapeHtml(dueLabel)}</span>
              </span>
            ` : ''}

            ${task.recurrence && task.recurrence !== 'none' ? `
              <span class="meta-pill recurrence-pill" title="Repeats ${escapeHtml(RECURRENCE_LABELS[task.recurrence] || task.recurrence)}">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>${escapeHtml(RECURRENCE_LABELS[task.recurrence] || task.recurrence)}</span>
              </span>
            ` : ''}

            <span class="meta-pill priority-pill-${escapeHtml(task.priority)}">
              <span class="priority-dot dot-${escapeHtml(task.priority)}"></span>
              <span>${escapeHtml(priorityLabel)}</span>
            </span>

            <span class="meta-pill">
              <span class="cat-dot" style="background-color: ${escapeHtml(catColor)}"></span>
              <span>${escapeHtml(task.category || 'Personal')}</span>
            </span>
          </div>
        </div>

        <div class="task-actions">
          <button type="button" class="icon-btn" data-action="edit" data-id="${task.id}" title="Edit task" aria-label="Edit task">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button type="button" class="icon-btn danger" data-action="delete" data-id="${task.id}" title="Delete task" aria-label="Delete task">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </article>
    `;
  }

  // Render Task List
  function renderTasks() {
    updateCountsAndProgress();

    // Update header title & active category pill
    dom.currentViewTitle.textContent = VIEW_TITLES[state.activeView] || 'Tasks';
    if (state.activeCategory) {
      dom.activeCategoryPill.classList.remove('hidden');
      dom.activeCategoryPill.innerHTML = `
        <span class="cat-dot" style="background:${escapeHtml(getCategoryColor(state.activeCategory))}"></span>
        <span>${escapeHtml(state.activeCategory)}</span>
        <span>&times;</span>
      `;
    } else {
      dom.activeCategoryPill.classList.add('hidden');
    }

    // Update show/hide completed button visibility
    if (state.activeView === 'completed' || state.activeView === 'overdue') {
      dom.toggleShowCompletedBtn.classList.add('hidden');
    } else {
      dom.toggleShowCompletedBtn.classList.remove('hidden');
      dom.toggleShowCompletedText.textContent = state.showCompletedInViews ? 'Hide Completed' : 'Show Completed';
    }

    const filtered = getFilteredAndSortedTasks();
    dom.taskCountSummary.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'task' : 'tasks'}`;

    if (filtered.length === 0) {
      dom.taskListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h3>No tasks match this view</h3>
          <p>Add a new task above or adjust your filters to see more items.</p>
        </div>
      `;
      return;
    }

    // Group tasks under section headers when viewing All Tasks sorted by due_date
    if (state.activeView === 'all' && state.sortBy === 'due_date' && !state.searchQuery) {
      const today = getLocalTodayStr();
      const groups = [
        { key: 'overdue', label: 'Overdue', items: [] },
        { key: 'today', label: 'Today', items: [] },
        { key: 'upcoming', label: 'Upcoming', items: [] },
        { key: 'nodate', label: 'No Due Date', items: [] },
        { key: 'completed', label: 'Completed', items: [] }
      ];

      for (const task of filtered) {
        if (task.completed) {
          groups[4].items.push(task);
        } else if (!task.due_date) {
          groups[3].items.push(task);
        } else if (task.due_date < today) {
          groups[0].items.push(task);
        } else if (task.due_date === today) {
          groups[1].items.push(task);
        } else {
          groups[2].items.push(task);
        }
      }

      const nonEmptyGroups = groups.filter(g => g.items.length > 0);
      if (nonEmptyGroups.length > 1 || (nonEmptyGroups.length === 1 && nonEmptyGroups[0].key === 'overdue')) {
        dom.taskListContainer.innerHTML = nonEmptyGroups.map(group => `
          <div class="task-group-header group-${group.key}">
            <span>${escapeHtml(group.label)}</span>
            <span class="task-group-count">${group.items.length}</span>
          </div>
          ${group.items.map(renderTaskCardHtml).join('')}
        `).join('');
        return;
      }
    }

    dom.taskListContainer.innerHTML = filtered.map(renderTaskCardHtml).join('');
  }

  // Modal Controls & Character Counter
  function updateTitleCharCounter(inputEl, counterEl, containerEl = null, hideWhenEmpty = false) {
    const len = inputEl.value.length;
    const isExceeded = len > TITLE_CHAR_LIMIT;
    counterEl.textContent = isExceeded
      ? `${len} / ${TITLE_CHAR_LIMIT} (Exceeds ${TITLE_CHAR_LIMIT})`
      : `${len} / ${TITLE_CHAR_LIMIT}`;
    counterEl.classList.toggle('is-exceeded', isExceeded);
    inputEl.classList.toggle('is-exceeded', isExceeded);
    if (containerEl) {
      containerEl.classList.toggle('is-exceeded', isExceeded);
    }
    if (hideWhenEmpty) {
      counterEl.classList.toggle('hidden', len === 0);
    }
  }

  function setModalPriority(priority) {
    state.modalPriority = priority;
    dom.modalPrioritySelector.querySelectorAll('.segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.priority === priority);
    });
  }

  async function updateRecurrencePreview() {
    const recurrence = dom.modalTaskRecurrence.value;
    if (!recurrence || recurrence === 'none') {
      dom.recurrencePreviewBox.classList.add('hidden');
      return;
    }

    const today = getLocalTodayStr();
    // If recurrence is chosen and due date is empty, default to Today
    if (!dom.modalTaskDueDate.value) {
      dom.modalTaskDueDate.value = today;
    }

    const dueDate = dom.modalTaskDueDate.value || today;
    try {
      const res = await apiRequest(`/api/recurrence-preview?due_date=${encodeURIComponent(dueDate)}&recurrence=${encodeURIComponent(recurrence)}&today=${encodeURIComponent(today)}`);
      if (res.next_due_date) {
        dom.recurrencePreviewBox.classList.remove('hidden');
        dom.recurrencePreviewText.textContent = `When completed, next occurrence schedules for ${formatReadableDate(res.next_due_date)} (${res.next_due_date}).`;
      }
    } catch {
      dom.recurrencePreviewBox.classList.add('hidden');
    }
  }

  function openNewTaskModal() {
    dom.modalTitle.textContent = 'New Task';
    dom.modalTaskId.value = '';
    dom.modalTaskTitle.value = '';
    dom.modalTaskNotes.value = '';
    dom.modalTaskDueDate.value = state.activeView === 'today' ? getLocalTodayStr() : '';
    dom.modalTaskRecurrence.value = state.activeView === 'recurring' ? 'daily' : 'none';
    setModalPriority('medium');

    if (state.activeCategory) {
      dom.modalTaskCategory.value = state.activeCategory;
    } else if (state.categories.length > 0) {
      dom.modalTaskCategory.value = state.categories[0].name;
    }

    dom.modalDeleteBtn.classList.add('hidden');
    dom.taskModalBackdrop.classList.remove('hidden');
    updateTitleCharCounter(dom.modalTaskTitle, dom.modalTitleCharCount);
    updateRecurrencePreview();
    setTimeout(() => dom.modalTaskTitle.focus(), 40);
  }

  function openEditTaskModal(taskId) {
    const task = state.tasks.find(t => t.id === Number(taskId));
    if (!task) return;

    dom.modalTitle.textContent = 'Edit Task';
    dom.modalTaskId.value = String(task.id);
    dom.modalTaskTitle.value = task.title;
    dom.modalTaskNotes.value = task.description || '';
    dom.modalTaskDueDate.value = task.due_date || '';
    dom.modalTaskRecurrence.value = task.recurrence || 'none';
    setModalPriority(task.priority || 'medium');
    dom.modalTaskCategory.value = task.category || 'Personal';

    dom.modalDeleteBtn.classList.remove('hidden');
    dom.taskModalBackdrop.classList.remove('hidden');
    updateTitleCharCounter(dom.modalTaskTitle, dom.modalTitleCharCount);
    updateRecurrencePreview();
    setTimeout(() => dom.modalTaskTitle.focus(), 40);
  }

  function closeTaskModal() {
    dom.taskModalBackdrop.classList.add('hidden');
  }

  // CRUD Operations
  async function loadBootstrap() {
    try {
      const data = await apiRequest('/api/bootstrap');
      state.tasks = data.tasks || [];
      state.categories = data.categories || [];
      LocalStore.saveSnapshot(state.tasks, state.categories);
      renderCategories();
      renderTasks();
    } catch (err) {
      showToast(err.message || 'Failed to load tasks', 'danger');
    }
  }

  async function handleQuickAdd(e) {
    e.preventDefault();
    const title = dom.quickTitleInput.value.trim();
    if (!title) return;

    try {
      const payload = {
        title,
        due_date: dom.quickDueDateInput.value || null,
        recurrence: dom.quickRecurrenceInput.value || 'none',
        priority: dom.quickPriorityInput.value || 'medium',
        category: dom.quickCategoryInput.value || state.activeCategory || 'Personal',
        client_today: getLocalTodayStr()
      };

      const { task } = await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      state.tasks.unshift(task);
      LocalStore.saveSnapshot(state.tasks, state.categories);
      dom.quickTitleInput.value = '';
      dom.quickDueDateInput.value = '';
      dom.quickRecurrenceInput.value = 'none';
      dom.quickAddForm.classList.remove('is-expanded');
      updateTitleCharCounter(dom.quickTitleInput, dom.quickTitleCharCount, dom.quickAddForm, true);
      renderCategories();
      renderTasks();
      showToast(`Added "${task.title}"`, 'success');
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  async function handleModalSubmit(e) {
    e.preventDefault();
    const id = dom.modalTaskId.value ? Number(dom.modalTaskId.value) : null;
    const payload = {
      title: dom.modalTaskTitle.value.trim(),
      description: dom.modalTaskNotes.value.trim(),
      due_date: dom.modalTaskDueDate.value || null,
      recurrence: dom.modalTaskRecurrence.value || 'none',
      priority: state.modalPriority,
      category: dom.modalTaskCategory.value || 'Personal',
      client_today: getLocalTodayStr()
    };

    if (!payload.title) return;

    try {
      if (id) {
        const { task } = await apiRequest(`/api/tasks/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        state.tasks = state.tasks.map(t => (t.id === id ? task : t));
        showToast('Task updated', 'success');
      } else {
        const { task } = await apiRequest('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        state.tasks.unshift(task);
        showToast(`Created "${task.title}"`, 'success');
      }
      LocalStore.saveSnapshot(state.tasks, state.categories);
      closeTaskModal();
      renderCategories();
      renderTasks();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  async function handleToggleTask(taskId) {
    try {
      const res = await apiRequest(`/api/tasks/${taskId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ client_today: getLocalTodayStr() })
      });

      state.tasks = state.tasks.map(t => (t.id === res.task.id ? res.task : t));

      if (res.spawnedTask) {
        state.tasks.unshift(res.spawnedTask);
        showToast(
          `Completed! Next "${res.spawnedTask.title}" scheduled for ${formatReadableDate(res.spawnedTask.due_date)}.`,
          'success'
        );
      } else if (res.removedSpawnedTaskId) {
        state.tasks = state.tasks.filter(t => t.id !== res.removedSpawnedTaskId);
        showToast('Task marked incomplete (removed auto-scheduled next occurrence).');
      }

      LocalStore.saveSnapshot(state.tasks, state.categories);
      renderCategories();
      renderTasks();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  async function handleDeleteTask(taskId) {
    const task = state.tasks.find(t => t.id === Number(taskId));
    if (!task) return;
    const deletedSnapshot = { ...task };

    try {
      await apiRequest(`/api/tasks/${taskId}`, { method: 'DELETE' });
      state.tasks = state.tasks.filter(t => t.id !== Number(taskId));
      LocalStore.saveSnapshot(state.tasks, state.categories);
      closeTaskModal();
      renderCategories();
      renderTasks();
      showToast(`Deleted "${deletedSnapshot.title}"`, 'default', {
        label: 'Undo',
        onClick: async () => {
          try {
            const { task: restored } = await apiRequest('/api/tasks', {
              method: 'POST',
              body: JSON.stringify({
                title: deletedSnapshot.title,
                description: deletedSnapshot.description || '',
                due_date: deletedSnapshot.due_date || null,
                recurrence: deletedSnapshot.recurrence || 'none',
                priority: deletedSnapshot.priority || 'medium',
                category: deletedSnapshot.category || 'Personal',
                client_today: getLocalTodayStr()
              })
            });
            state.tasks.unshift(restored);
            LocalStore.saveSnapshot(state.tasks, state.categories);
            renderCategories();
            renderTasks();
            showToast(`Restored "${restored.title}"`, 'success');
          } catch (restoreErr) {
            showToast(restoreErr.message || 'Could not restore task', 'danger');
          }
        }
      });
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  async function handleClearCompleted() {
    try {
      const { removedCount } = await apiRequest('/api/tasks/completed', { method: 'DELETE' });
      state.tasks = state.tasks.filter(t => !t.completed);
      LocalStore.saveSnapshot(state.tasks, state.categories);
      renderCategories();
      renderTasks();
      showToast(`Cleared ${removedCount} completed ${removedCount === 1 ? 'task' : 'tasks'}`);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  function syncActiveViewSelection(viewName) {
    state.activeView = viewName;
    dom.viewNav.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewName);
    });
    if (dom.mobileBottomNav) {
      dom.mobileBottomNav.querySelectorAll('.mobile-tab-btn').forEach(el => {
        el.classList.toggle('active', el.dataset.view === viewName);
      });
    }
  }

  // Event Listeners
  function bindEvents() {
    // Theme toggle (Sidebar + Mobile Header)
    const toggleTheme = () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    };
    dom.themeToggleBtn.addEventListener('click', toggleTheme);
    if (dom.mobileThemeToggleBtn) {
      dom.mobileThemeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Mobile Search & Filter Tray Toggle
    if (dom.mobileSearchToggleBtn && dom.headerControls) {
      dom.mobileSearchToggleBtn.addEventListener('click', () => {
        const isOpen = dom.headerControls.classList.toggle('is-open');
        dom.mobileSearchToggleBtn.classList.toggle('is-active', isOpen);
        if (isOpen) {
          setTimeout(() => dom.searchInput.focus(), 40);
        }
      });
    }

    // Mobile Horizontal Chip Strip (One-Tap Category & Status Filters)
    if (dom.mobileChipStrip) {
      dom.mobileChipStrip.addEventListener('click', e => {
        const chip = e.target.closest('.mobile-chip');
        if (!chip) return;

        if (chip.hasAttribute('data-chip-view')) {
          const targetView = chip.dataset.chipView;
          if (state.activeView === targetView) {
            syncActiveViewSelection('all');
          } else {
            syncActiveViewSelection(targetView);
          }
          renderCategories();
          renderTasks();
          return;
        }

        if (chip.hasAttribute('data-chip-category')) {
          const catName = chip.dataset.chipCategory;
          if (!catName) {
            state.activeCategory = null;
            if (state.activeView === 'overdue' || state.activeView === 'upcoming') {
              syncActiveViewSelection('all');
            }
          } else if (state.activeCategory && state.activeCategory.toLowerCase() === catName.toLowerCase()) {
            state.activeCategory = null;
          } else {
            state.activeCategory = catName;
            dom.quickCategoryInput.value = catName;
          }
          renderCategories();
          renderTasks();
        }
      });
    }

    // Mobile sidebar
    const closeMobileSidebar = () => {
      dom.sidebar.classList.remove('open');
      dom.sidebarBackdrop.classList.add('hidden');
    };
    dom.openSidebarBtn.addEventListener('click', () => {
      dom.sidebar.classList.add('open');
      dom.sidebarBackdrop.classList.remove('hidden');
    });
    dom.closeSidebarBtn.addEventListener('click', closeMobileSidebar);
    dom.sidebarBackdrop.addEventListener('click', closeMobileSidebar);

    // View Navigation (Sidebar + Mobile Bottom Tab Bar)
    dom.viewNav.addEventListener('click', e => {
      const btn = e.target.closest('.nav-item');
      if (!btn) return;
      syncActiveViewSelection(btn.dataset.view);
      closeMobileSidebar();
      renderTasks();
    });

    if (dom.mobileBottomNav) {
      dom.mobileBottomNav.addEventListener('click', e => {
        const tab = e.target.closest('.mobile-tab-btn');
        if (!tab) return;
        syncActiveViewSelection(tab.dataset.view);
        closeMobileSidebar();
        renderTasks();
      });
    }

    if (dom.mobileFabBtn) {
      dom.mobileFabBtn.addEventListener('click', openNewTaskModal);
    }

    // Category Navigation & Delete
    dom.categoryNav.addEventListener('click', async e => {
      const deleteBtn = e.target.closest('[data-delete-cat-id]');
      if (deleteBtn) {
        e.stopPropagation();
        const catId = Number(deleteBtn.dataset.deleteCatId);
        const catName = deleteBtn.dataset.deleteCatName;
        try {
          const res = await apiRequest(`/api/categories/${catId}`, { method: 'DELETE' });
          state.categories = res.categories;
          state.tasks = res.tasks;
          if (state.activeCategory && state.activeCategory.toLowerCase() === catName.toLowerCase()) {
            state.activeCategory = null;
          }
          renderCategories();
          renderTasks();
          showToast(`Removed category "${catName}"`);
        } catch (err) {
          showToast(err.message, 'danger');
        }
        return;
      }

      const item = e.target.closest('.nav-item');
      if (!item) return;
      const clickedCat = item.dataset.category;
      if (state.activeCategory && state.activeCategory.toLowerCase() === clickedCat.toLowerCase()) {
        state.activeCategory = null;
      } else {
        state.activeCategory = clickedCat;
      }
      if (state.activeCategory) {
        dom.quickCategoryInput.value = state.activeCategory;
      }
      closeMobileSidebar();
      renderCategories();
      renderTasks();
    });

    dom.activeCategoryPill.addEventListener('click', () => {
      state.activeCategory = null;
      renderCategories();
      renderTasks();
    });

    // Add Category Form
    dom.toggleAddCategoryBtn.addEventListener('click', () => {
      dom.addCategoryForm.classList.toggle('hidden');
      if (!dom.addCategoryForm.classList.contains('hidden')) {
        dom.newCategoryName.focus();
      }
    });

    dom.colorSwatches.addEventListener('click', e => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;
      state.newCategoryColor = swatch.dataset.color;
      dom.colorSwatches.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('selected', s === swatch));
    });

    dom.addCategoryForm.addEventListener('submit', async e => {
      e.preventDefault();
      const name = dom.newCategoryName.value.trim();
      if (!name) return;
      try {
        const { category } = await apiRequest('/api/categories', {
          method: 'POST',
          body: JSON.stringify({ name, color: state.newCategoryColor })
        });
        state.categories.push(category);
        dom.newCategoryName.value = '';
        dom.addCategoryForm.classList.add('hidden');
        renderCategories();
        showToast(`Category "${category.name}" created`, 'success');
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });

    // Search, Filter, Sort
    dom.searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value.trim();
      renderTasks();
    });

    dom.priorityFilter.addEventListener('change', e => {
      state.priorityFilter = e.target.value;
      renderTasks();
    });

    dom.sortSelect.addEventListener('change', e => {
      state.sortBy = e.target.value;
      renderTasks();
    });

    // Quick Add Form (with mobile progressive disclosure)
    dom.quickTitleInput.addEventListener('focus', () => {
      dom.quickAddForm.classList.add('is-expanded');
    });
    dom.quickTitleInput.addEventListener('input', () => {
      if (dom.quickTitleInput.value.trim().length > 0) {
        dom.quickAddForm.classList.add('is-expanded');
      }
      updateTitleCharCounter(dom.quickTitleInput, dom.quickTitleCharCount, dom.quickAddForm, true);
    });
    dom.quickRecurrenceInput.addEventListener('change', () => {
      if (dom.quickRecurrenceInput.value !== 'none' && !dom.quickDueDateInput.value) {
        dom.quickDueDateInput.value = getLocalTodayStr();
      }
    });
    dom.quickAddForm.addEventListener('submit', handleQuickAdd);

    // Show/Hide Completed & Clear Completed
    dom.toggleShowCompletedBtn.addEventListener('click', () => {
      state.showCompletedInViews = !state.showCompletedInViews;
      renderTasks();
    });
    dom.clearCompletedBtn.addEventListener('click', handleClearCompleted);

    // Task Card Actions (Toggle, Edit, Delete)
    dom.taskListContainer.addEventListener('click', e => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      const id = Number(actionEl.dataset.id);
      if (action === 'toggle') {
        handleToggleTask(id);
      } else if (action === 'edit') {
        openEditTaskModal(id);
      } else if (action === 'delete') {
        handleDeleteTask(id);
      }
    });

    // Modal Events & Bottom-Sheet Grabber Gesture
    dom.openNewTaskModalBtn.addEventListener('click', openNewTaskModal);
    dom.closeModalBtn.addEventListener('click', closeTaskModal);
    dom.cancelModalBtn.addEventListener('click', closeTaskModal);
    dom.taskModalBackdrop.addEventListener('click', e => {
      if (e.target === dom.taskModalBackdrop) closeTaskModal();
    });

    if (dom.modalGrabber && dom.modalCard) {
      let startY = 0;
      let currentY = 0;
      dom.modalGrabber.addEventListener('click', closeTaskModal);
      dom.modalGrabber.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY;
        currentY = startY;
        dom.modalCard.style.transition = 'none';
      }, { passive: true });
      dom.modalGrabber.addEventListener('touchmove', e => {
        currentY = e.touches[0].clientY;
        const delta = Math.max(0, currentY - startY);
        dom.modalCard.style.transform = `translateY(${delta}px)`;
      }, { passive: true });
      dom.modalGrabber.addEventListener('touchend', () => {
        dom.modalCard.style.transition = '';
        const delta = currentY - startY;
        dom.modalCard.style.transform = '';
        if (delta > 65) {
          closeTaskModal();
        }
      });
    }

    dom.modalTaskTitle.addEventListener('input', () => {
      updateTitleCharCounter(dom.modalTaskTitle, dom.modalTitleCharCount);
    });

    dom.modalPrioritySelector.addEventListener('click', e => {
      const btn = e.target.closest('.segment-btn');
      if (!btn) return;
      setModalPriority(btn.dataset.priority);
    });

    // Date quick chips in Modal
    document.querySelectorAll('[data-date-preset]').forEach(chip => {
      chip.addEventListener('click', () => {
        const preset = chip.dataset.datePreset;
        const today = getLocalTodayStr();
        if (preset === 'today') {
          dom.modalTaskDueDate.value = today;
        } else if (preset === 'tomorrow') {
          dom.modalTaskDueDate.value = addDaysToDateStr(today, 1);
        } else if (preset === 'next_week') {
          dom.modalTaskDueDate.value = addDaysToDateStr(today, 7);
        } else if (preset === 'clear') {
          dom.modalTaskDueDate.value = '';
        }
        updateRecurrencePreview();
      });
    });

    dom.modalTaskDueDate.addEventListener('change', updateRecurrencePreview);
    dom.modalTaskRecurrence.addEventListener('change', updateRecurrencePreview);

    dom.taskModalForm.addEventListener('submit', handleModalSubmit);
    dom.modalDeleteBtn.addEventListener('click', () => {
      const id = Number(dom.modalTaskId.value);
      if (id) handleDeleteTask(id);
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!dom.taskModalBackdrop.classList.contains('hidden')) {
          closeTaskModal();
        }
        return;
      }

      const tag = (e.target.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (isTyping) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openNewTaskModal();
      } else if (e.key === '/') {
        e.preventDefault();
        dom.searchInput.focus();
      }
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }
  }

  // Initialize App
  initTheme();
  updateHeaderDate();
  bindEvents();
  loadBootstrap();
  registerServiceWorker();
})();
