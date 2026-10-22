const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'todo.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    due_date TEXT DEFAULT NULL,
    recurrence TEXT NOT NULL DEFAULT 'none',
    priority TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT 'Personal',
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT DEFAULT NULL,
    parent_task_id INTEGER DEFAULT NULL,
    spawned_task_id INTEGER DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const VALID_RECURRENCES = new Set(['none', 'daily', 'weekly', 'weekdays', 'monthly', 'yearly']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);

/**
 * Returns local today's date in YYYY-MM-DD format.
 */
function getLocalTodayStr(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDateUTC(dateObj) {
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysUTC(dateStr, days) {
  const dt = parseDateUTC(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatDateUTC(dt);
}

function addMonthsUTC(dateStr, monthsToAdd) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetMonthIndex = (m - 1) + monthsToAdd;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  return formatDateUTC(new Date(Date.UTC(targetYear, normalizedMonth, clampedDay)));
}

function advanceOnce(dateStr, recurrence, anchorDay = null) {
  switch (recurrence) {
    case 'daily':
      return addDaysUTC(dateStr, 1);
    case 'weekly':
      return addDaysUTC(dateStr, 7);
    case 'weekdays': {
      let dt = parseDateUTC(dateStr);
      do {
        dt.setUTCDate(dt.getUTCDate() + 1);
      } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6);
      return formatDateUTC(dt);
    }
    case 'monthly': {
      const next = addMonthsUTC(dateStr, 1);
      if (anchorDay) {
        const [ny, nm] = next.split('-').map(Number);
        const maxDays = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
        const d = String(Math.min(anchorDay, maxDays)).padStart(2, '0');
        return `${ny}-${String(nm).padStart(2, '0')}-${d}`;
      }
      return next;
    }
    case 'yearly':
      return addMonthsUTC(dateStr, 12);
    default:
      return dateStr;
  }
}

/**
 * Calculates the next due date anchored to the original due_date (or todayStr if blank).
 * If the task was overdue when completed, keeps advancing along the cadence until the next date is > todayStr.
 */
function calculateNextDueDate(originalDueDate, recurrence, todayStr = getLocalTodayStr()) {
  if (!recurrence || recurrence === 'none') {
    return originalDueDate || null;
  }
  const baseDate = (originalDueDate && /^\d{4}-\d{2}-\d{2}$/.test(originalDueDate))
    ? originalDueDate
    : todayStr;

  const anchorDay = Number(baseDate.split('-')[2]);
  let nextDate = advanceOnce(baseDate, recurrence, anchorDay);

  // Guard against infinite loops; advance until strictly after todayStr if baseDate was in the past
  let safety = 0;
  while (nextDate <= todayStr && safety < 1000) {
    nextDate = advanceOnce(nextDate, recurrence, anchorDay);
    safety++;
  }
  return nextDate;
}

function mapTaskRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description || '',
    due_date: row.due_date || null,
    recurrence: row.recurrence || 'none',
    priority: row.priority || 'medium',
    category: row.category || 'Personal',
    completed: Boolean(row.completed),
    completed_at: row.completed_at || null,
    parent_task_id: row.parent_task_id ? Number(row.parent_task_id) : null,
    spawned_task_id: row.spawned_task_id ? Number(row.spawned_task_id) : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Seed initial categories and sample tasks if empty
function seedDatabaseIfNeeded() {
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  const nowIso = new Date().toISOString();

  if (catCount === 0) {
    const defaultCategories = [
      { name: 'Personal', color: '#6366f1' },
      { name: 'Work', color: '#0ea5e9' },
      { name: 'Errands', color: '#f59e0b' },
      { name: 'Health', color: '#10b981' },
      { name: 'Finance', color: '#ec4899' }
    ];
    const insertCat = db.prepare('INSERT INTO categories (name, color, created_at) VALUES (?, ?, ?)');
    for (const c of defaultCategories) {
      insertCat.run(c.name, c.color, nowIso);
    }

    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    if (taskCount === 0) {
      const today = getLocalTodayStr();
      const tomorrow = addDaysUTC(today, 1);
      const nextWeek = addDaysUTC(today, 5);
      const yesterday = addDaysUTC(today, -1);

      const sampleTasks = [
        {
          title: 'Review team sprint backlog & priorities',
          description: 'Check blockers and confirm deliverables for the upcoming release.',
          due_date: today,
          recurrence: 'weekdays',
          priority: 'high',
          category: 'Work',
          completed: 0
        },
        {
          title: '30-minute morning workout & stretch',
          description: 'Mobility routine + cardio session.',
          due_date: today,
          recurrence: 'daily',
          priority: 'medium',
          category: 'Health',
          completed: 0
        },
        {
          title: 'Pay monthly utility & internet bills',
          description: 'Verify auto-pay statement in online banking portal.',
          due_date: tomorrow,
          recurrence: 'monthly',
          priority: 'high',
          category: 'Finance',
          completed: 0
        },
        {
          title: 'Pick up groceries for the week',
          description: 'Fresh produce, coffee beans, oat milk, and Olive oil.',
          due_date: yesterday,
          recurrence: 'weekly',
          priority: 'medium',
          category: 'Errands',
          completed: 0
        },
        {
          title: 'Plan weekend hike trail route',
          description: 'Download offline trail maps and check weather forecast.',
          due_date: nextWeek,
          recurrence: 'none',
          priority: 'low',
          category: 'Personal',
          completed: 0
        }
      ];

      const insertTask = db.prepare(`
        INSERT INTO tasks (title, description, due_date, recurrence, priority, category, completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of sampleTasks) {
        insertTask.run(t.title, t.description, t.due_date, t.recurrence, t.priority, t.category, t.completed, nowIso, nowIso);
      }
    }
  }
}

seedDatabaseIfNeeded();

function getAllCategories() {
  return db.prepare('SELECT id, name, color, created_at FROM categories ORDER BY id ASC').all().map(r => ({
    id: Number(r.id),
    name: r.name,
    color: r.color,
    created_at: r.created_at
  }));
}

function createCategory({ name, color }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    throw new Error('Category name is required');
  }
  const cleanColor = /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#6366f1';
  const nowIso = new Date().toISOString();

  const existing = db.prepare('SELECT id, name, color, created_at FROM categories WHERE name = ? COLLATE NOCASE').get(cleanName);
  if (existing) {
    throw new Error(`Category "${existing.name}" already exists`);
  }

  const result = db.prepare('INSERT INTO categories (name, color, created_at) VALUES (?, ?, ?)').run(cleanName, cleanColor, nowIso);
  return {
    id: Number(result.lastInsertRowid),
    name: cleanName,
    color: cleanColor,
    created_at: nowIso
  };
}

function deleteCategory(id) {
  const cat = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(id);
  if (!cat) return false;
  // Reassign tasks in this category to 'Personal'
  db.prepare('UPDATE tasks SET category = ? WHERE category = ? COLLATE NOCASE').run('Personal', cat.name);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return true;
}

function getAllTasks() {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY completed ASC, CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC, due_date ASC, id DESC').all();
  return rows.map(mapTaskRow);
}

function getTaskById(id) {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return mapTaskRow(row);
}

function createTask(payload, todayStr = getLocalTodayStr()) {
  const title = String(payload.title || '').trim();
  if (!title) {
    throw new Error('Task title is required');
  }
  const description = String(payload.description || '').trim();
  const recurrence = VALID_RECURRENCES.has(payload.recurrence) ? payload.recurrence : 'none';
  const priority = VALID_PRIORITIES.has(payload.priority) ? payload.priority : 'medium';
  const category = String(payload.category || 'Personal').trim() || 'Personal';

  let dueDate = payload.due_date ? String(payload.due_date).trim() : null;
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error('Invalid due_date format. Expected YYYY-MM-DD');
  }
  // If task is recurring and no due date was supplied, default to Today as agreed
  if (recurrence !== 'none' && !dueDate) {
    dueDate = todayStr;
  }

  const nowIso = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO tasks (title, description, due_date, recurrence, priority, category, completed, parent_task_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    title,
    description,
    dueDate,
    recurrence,
    priority,
    category,
    payload.parent_task_id || null,
    nowIso,
    nowIso
  );

  return getTaskById(Number(result.lastInsertRowid));
}

function updateTask(id, payload, todayStr = getLocalTodayStr()) {
  const existing = getTaskById(id);
  if (!existing) return null;

  const title = payload.title !== undefined ? String(payload.title).trim() : existing.title;
  if (!title) {
    throw new Error('Task title cannot be empty');
  }
  const description = payload.description !== undefined ? String(payload.description).trim() : existing.description;
  const recurrence = payload.recurrence !== undefined
    ? (VALID_RECURRENCES.has(payload.recurrence) ? payload.recurrence : 'none')
    : existing.recurrence;
  const priority = payload.priority !== undefined
    ? (VALID_PRIORITIES.has(payload.priority) ? payload.priority : existing.priority)
    : existing.priority;
  const category = payload.category !== undefined
    ? (String(payload.category).trim() || 'Personal')
    : existing.category;

  let dueDate = payload.due_date !== undefined
    ? (payload.due_date ? String(payload.due_date).trim() : null)
    : existing.due_date;

  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error('Invalid due_date format. Expected YYYY-MM-DD');
  }
  if (recurrence !== 'none' && !dueDate) {
    dueDate = todayStr;
  }

  const nowIso = new Date().toISOString();
  db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, due_date = ?, recurrence = ?, priority = ?, category = ?, updated_at = ?
    WHERE id = ?
  `).run(title, description, dueDate, recurrence, priority, category, nowIso, id);

  return getTaskById(id);
}

/**
 * Toggles a task's completion status.
 * - If completing a recurring task, automatically creates the next occurrence anchored to due_date (or today).
 * - If uncompleting a task that previously spawned an uncompleted next occurrence, removes that auto-spawned task to prevent duplicates.
 */
function toggleTaskCompletion(id, targetCompleted, todayStr = getLocalTodayStr()) {
  const existing = getTaskById(id);
  if (!existing) return null;

  const newCompleted = targetCompleted !== undefined ? Boolean(targetCompleted) : !existing.completed;
  const nowIso = new Date().toISOString();

  let spawnedTask = null;
  let removedSpawnedTaskId = null;

  if (newCompleted && !existing.completed) {
    // Marking as completed
    let spawnedId = existing.spawned_task_id;

    if (existing.recurrence && existing.recurrence !== 'none') {
      // Check if an already-spawned task still exists
      const alreadySpawned = spawnedId ? getTaskById(spawnedId) : null;
      if (!alreadySpawned) {
        const nextDueDate = calculateNextDueDate(existing.due_date, existing.recurrence, todayStr);
        spawnedTask = createTask({
          title: existing.title,
          description: existing.description,
          due_date: nextDueDate,
          recurrence: existing.recurrence,
          priority: existing.priority,
          category: existing.category,
          parent_task_id: existing.id
        }, todayStr);
        spawnedId = spawnedTask.id;
      }
    }

    db.prepare(`
      UPDATE tasks
      SET completed = 1, completed_at = ?, spawned_task_id = ?, updated_at = ?
      WHERE id = ?
    `).run(nowIso, spawnedId || null, nowIso, id);
  } else if (!newCompleted && existing.completed) {
    // Unchecking a completed task
    if (existing.spawned_task_id) {
      const spawned = getTaskById(existing.spawned_task_id);
      if (spawned && !spawned.completed) {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(spawned.id);
        removedSpawnedTaskId = spawned.id;
      }
    }

    db.prepare(`
      UPDATE tasks
      SET completed = 0, completed_at = NULL, spawned_task_id = NULL, updated_at = ?
      WHERE id = ?
    `).run(nowIso, id);
  }

  return {
    task: getTaskById(id),
    spawnedTask,
    removedSpawnedTaskId
  };
}

function deleteTask(id) {
  const existing = getTaskById(id);
  if (!existing) return false;
  // Unlink any references
  db.prepare('UPDATE tasks SET spawned_task_id = NULL WHERE spawned_task_id = ?').run(id);
  db.prepare('UPDATE tasks SET parent_task_id = NULL WHERE parent_task_id = ?').run(id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return true;
}

function clearCompletedTasks() {
  const info = db.prepare('DELETE FROM tasks WHERE completed = 1').run();
  return Number(info.changes || 0);
}

module.exports = {
  db,
  getLocalTodayStr,
  calculateNextDueDate,
  getAllCategories,
  createCategory,
  deleteCategory,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  toggleTaskCompletion,
  deleteTask,
  clearCompletedTasks
};
