import Database from 'better-sqlite3';
import path from 'node:path';

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
  tags?: Tag[];
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateTagInput { user_id: number; name: string; color: string }
export type UpdateTagInput = Partial<Pick<Tag, 'name' | 'color'>>;

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string;
  category: string;
  title: string;
  priority: Priority;
  recurrence_pattern: RecurrencePattern | null;
  subtasks: Array<{ title: string; position: number }>;
  created_at: string;
  updated_at: string | null;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSubtaskInput {
  todo_id: number;
  user_id: number;
  title: string;
  completed?: boolean;
  position?: number;
}

export type UpdateSubtaskInput = Partial<Pick<Subtask, 'title' | 'completed' | 'position'>>;

export interface CreateTodoInput {
  user_id: number;
  title: string;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
}

export type UpdateTodoInput = Partial<Omit<CreateTodoInput, 'user_id'>> & { completed?: boolean };

const databasePath = process.env.TODO_DB_PATH ?? path.join(process.cwd(), 'todos.db');
const database = new Database(databasePath);
database.pragma('foreign_keys = ON');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    reminder_minutes INTEGER,
    last_notification_sent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    UNIQUE(user_id, name)
  );
  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (todo_id, tag_id)
  );
  CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
  CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'General',
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    recurrence_pattern TEXT,
    subtasks_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    UNIQUE(user_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
`);

type TodoRow = Omit<Todo, 'completed' | 'is_recurring'> & { completed: number; is_recurring: number };

function mapTodo(row: TodoRow | undefined): Todo | null {
  if (!row) return null;
  return { ...row, completed: Boolean(row.completed), is_recurring: Boolean(row.is_recurring) };
}

function ensureUser(userId: number): void {
  database.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)').run(userId, `user-${userId}`);
}

function mapTag(row: Tag | undefined): Tag | null {
  return row ? { ...row } : null;
}

function attachTags(todo: Todo | null, userId: number): Todo | null {
  if (!todo) return null;
  const tags = database.prepare(`
    SELECT tags.* FROM tags
    INNER JOIN todo_tags ON todo_tags.tag_id = tags.id
    WHERE todo_tags.todo_id = ? AND tags.user_id = ?
    ORDER BY tags.name ASC
  `).all(todo.id, userId) as Tag[];
  return { ...todo, tags };
}

export const todoDB = {
  health(): void {
    database.prepare('SELECT 1').get();
  },

  findDueReminders(userId: number, now = new Date()): Todo[] {
    const candidates = this.findAllByUser(userId).filter((todo) => !todo.completed && todo.due_date && todo.reminder_minutes !== null);
    const due = candidates.filter((todo) => Date.parse(`${todo.due_date}:00+08:00`) - (todo.reminder_minutes ?? 0) * 60_000 <= now.getTime() && (!todo.last_notification_sent || Date.parse(todo.last_notification_sent) < Date.parse(`${todo.due_date}:00+08:00`)));
    const mark = database.prepare("UPDATE todos SET last_notification_sent = datetime('now') WHERE id = ? AND user_id = ?");
    for (const todo of due) mark.run(todo.id, userId);
    return due;
  },

  create(input: CreateTodoInput): Todo {
    ensureUser(input.user_id);
    const result = database.prepare(`
      INSERT INTO todos (user_id, title, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes)
      VALUES (@user_id, @title, @due_date, @priority, @is_recurring, @recurrence_pattern, @reminder_minutes)
    `).run({
      user_id: input.user_id,
      title: input.title,
      due_date: input.due_date ?? null,
      priority: input.priority ?? 'medium',
      is_recurring: input.is_recurring ? 1 : 0,
      recurrence_pattern: input.recurrence_pattern ?? null,
      reminder_minutes: input.reminder_minutes ?? null,
    });
    return mapTodo(database.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid) as TodoRow)!;
  },

  findAllByUser(userId: number): Todo[] {
    return (database.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(userId) as TodoRow[])
      .map((row) => attachTags(mapTodo(row), userId)!);
  },

  findById(id: number, userId?: number): Todo | null {
    const row = userId === undefined
      ? database.prepare('SELECT * FROM todos WHERE id = ?').get(id)
      : database.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId);
    return attachTags(mapTodo(row as TodoRow | undefined), userId ?? 0);
  },

  update(id: number, userId: number, input: UpdateTodoInput): Todo | null {
    const entries = Object.entries(input).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return this.findById(id, userId);
    const columnMap: Record<string, string> = { title: 'title', due_date: 'due_date', priority: 'priority', is_recurring: 'is_recurring', recurrence_pattern: 'recurrence_pattern', reminder_minutes: 'reminder_minutes', completed: 'completed' };
    const assignments = entries.map(([key]) => `${columnMap[key]} = @${key}`).join(', ');
    const values = Object.fromEntries(entries.map(([key, value]) => [key, typeof value === 'boolean' ? (value ? 1 : 0) : value ?? null]));
    database.prepare(`UPDATE todos SET ${assignments}, updated_at = datetime('now') WHERE id = @id AND user_id = @userId`).run({ ...values, id, userId });
    return this.findById(id, userId);
  },

  delete(id: number, userId: number): boolean {
    return database.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};

type SubtaskRow = Omit<Subtask, 'completed'> & { completed: number };

function mapSubtask(row: SubtaskRow | undefined): Subtask | null {
  if (!row) return null;
  return { ...row, completed: Boolean(row.completed) };
}

export const subtaskDB = {
  create(input: CreateSubtaskInput): Subtask | null {
    const parent = todoDB.findById(input.todo_id, input.user_id);
    if (!parent) return null;
    const result = database.prepare(`
      INSERT INTO subtasks (todo_id, title, completed, position)
      VALUES (@todo_id, @title, @completed, @position)
    `).run({
      todo_id: input.todo_id,
      title: input.title,
      completed: input.completed ? 1 : 0,
      position: input.position ?? 0,
    });
    return mapSubtask(database.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid) as SubtaskRow);
  },

  findAllByTodo(todoId: number, userId: number): Subtask[] {
    return (database.prepare(`
      SELECT subtasks.* FROM subtasks
      INNER JOIN todos ON todos.id = subtasks.todo_id
      WHERE subtasks.todo_id = ? AND todos.user_id = ?
      ORDER BY subtasks.position ASC, subtasks.id ASC
    `).all(todoId, userId) as SubtaskRow[]).map((row) => mapSubtask(row)!);
  },

  findById(id: number, userId: number): Subtask | null {
    return mapSubtask(database.prepare(`
      SELECT subtasks.* FROM subtasks
      INNER JOIN todos ON todos.id = subtasks.todo_id
      WHERE subtasks.id = ? AND todos.user_id = ?
    `).get(id, userId) as SubtaskRow | undefined);
  },

  update(id: number, userId: number, input: UpdateSubtaskInput): Subtask | null {
    const entries = Object.entries(input).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return this.findById(id, userId);
    const columnMap: Record<string, string> = { title: 'title', completed: 'completed', position: 'position' };
    const assignments = entries.map(([key]) => `${columnMap[key]} = @${key}`).join(', ');
    const values = Object.fromEntries(entries.map(([key, value]) => [key, typeof value === 'boolean' ? (value ? 1 : 0) : value]));
    database.prepare(`
      UPDATE subtasks SET ${assignments}, updated_at = datetime('now')
      WHERE id = @id AND todo_id IN (SELECT id FROM todos WHERE user_id = @userId)
    `).run({ ...values, id, userId });
    return this.findById(id, userId);
  },

  delete(id: number, userId: number): boolean {
    return database.prepare(`
      DELETE FROM subtasks
      WHERE id = ? AND todo_id IN (SELECT id FROM todos WHERE user_id = ?)
    `).run(id, userId).changes > 0;
  },
};

export const tagDB = {
  listByUser(userId: number): Tag[] {
    return (database.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC').all(userId) as Tag[]).map((tag) => mapTag(tag)!);
  },

  create(input: CreateTagInput): Tag {
    ensureUser(input.user_id);
    const result = database.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(input.user_id, input.name, input.color);
    return mapTag(database.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag)!;
  },

  findById(id: number, userId: number): Tag | null {
    return mapTag(database.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, userId) as Tag | undefined);
  },

  update(id: number, userId: number, input: UpdateTagInput): Tag | null {
    const entries = Object.entries(input).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return this.findById(id, userId);
    const columnMap: Record<string, string> = { name: 'name', color: 'color' };
    const assignments = entries.map(([key]) => `${columnMap[key]} = @${key}`).join(', ');
    const values = Object.fromEntries(entries);
    database.prepare(`UPDATE tags SET ${assignments}, updated_at = datetime('now') WHERE id = @id AND user_id = @userId`).run({ ...values, id, userId });
    return this.findById(id, userId);
  },

  delete(id: number, userId: number): boolean {
    return database.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },

  assign(todoId: number, tagId: number, userId: number): boolean {
    const valid = database.prepare(`
      SELECT 1 FROM todos INNER JOIN tags ON tags.user_id = todos.user_id
      WHERE todos.id = ? AND todos.user_id = ? AND tags.id = ?
    `).get(todoId, userId, tagId);
    if (!valid) return false;
    database.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
    return true;
  },

  unassign(todoId: number, tagId: number, userId: number): boolean {
    return database.prepare(`
      DELETE FROM todo_tags WHERE todo_id = ? AND tag_id IN (SELECT id FROM tags WHERE id = ? AND user_id = ?)
    `).run(todoId, tagId, userId).changes > 0;
  },
};

export interface TodoExport {
  version: 1;
  todos: Array<Pick<Todo, 'title' | 'completed' | 'due_date' | 'priority' | 'is_recurring' | 'recurrence_pattern' | 'reminder_minutes'> & { subtasks: Array<Pick<Subtask, 'title' | 'completed' | 'position'>>; tags: Array<Pick<Tag, 'name' | 'color'>> }>;
}

export function exportUserData(userId: number): TodoExport {
  const todos = todoDB.findAllByUser(userId).map((todo) => ({
    title: todo.title,
    completed: todo.completed,
    due_date: todo.due_date,
    priority: todo.priority,
    is_recurring: todo.is_recurring,
    recurrence_pattern: todo.recurrence_pattern,
    reminder_minutes: todo.reminder_minutes,
    subtasks: subtaskDB.findAllByTodo(todo.id, userId).map(({ title, completed, position }) => ({ title, completed, position })),
    tags: (todo.tags ?? []).map(({ name, color }) => ({ name, color })),
  }));
  return { version: 1, todos };
}

export function importUserData(userId: number, data: TodoExport): { todos: number; subtasks: number; tags: number } {
  let todoCount = 0;
  let subtaskCount = 0;
  let tagCount = 0;
  const transaction = database.transaction(() => {
    const knownTags = new Map(tagDB.listByUser(userId).map((tag) => [tag.name.toLowerCase(), tag]));
    for (const item of data.todos) {
      const todo = todoDB.create({ user_id: userId, title: item.title, due_date: item.due_date, priority: item.priority, is_recurring: item.is_recurring, recurrence_pattern: item.recurrence_pattern, reminder_minutes: item.reminder_minutes });
      if (item.completed) todoDB.update(todo.id, userId, { completed: true });
      todoCount += 1;
      for (const tagInput of item.tags) {
        let tag = knownTags.get(tagInput.name.toLowerCase());
        if (!tag) {
          tag = tagDB.create({ user_id: userId, name: tagInput.name, color: tagInput.color });
          knownTags.set(tag.name.toLowerCase(), tag);
          tagCount += 1;
        }
        tagDB.assign(todo.id, tag.id, userId);
      }
      for (const subtask of item.subtasks) {
        subtaskDB.create({ todo_id: todo.id, user_id: userId, title: subtask.title, completed: subtask.completed, position: subtask.position });
        subtaskCount += 1;
      }
    }
  });
  transaction();
  return { todos: todoCount, subtasks: subtaskCount, tags: tagCount };
}

type TemplateInput = Omit<Template, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subtasks'> & { user_id: number; subtasks: Array<{ title: string; position: number }> };
type TemplateRow = Omit<Template, 'subtasks'> & { subtasks_json: string };

function mapTemplate(row: TemplateRow | undefined): Template | null {
  if (!row) return null;
  return { ...row, subtasks: JSON.parse(row.subtasks_json) as Array<{ title: string; position: number }> };
}

export const templateDB = {
  listByUser(userId: number): Template[] {
    return (database.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY name ASC').all(userId) as TemplateRow[]).map((row) => mapTemplate(row)!);
  },
  create(input: TemplateInput): Template {
    ensureUser(input.user_id);
    const result = database.prepare(`INSERT INTO templates (user_id, name, description, category, title, priority, recurrence_pattern, subtasks_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(input.user_id, input.name, input.description, input.category, input.title, input.priority, input.recurrence_pattern, JSON.stringify(input.subtasks));
    return mapTemplate(database.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid) as TemplateRow)!;
  },
  findById(id: number, userId: number): Template | null {
    return mapTemplate(database.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, userId) as TemplateRow | undefined);
  },
  update(id: number, userId: number, input: Partial<TemplateInput>): Template | null {
    const values = Object.entries(input).filter(([, value]) => value !== undefined);
    if (!values.length) return this.findById(id, userId);
    const allowed: Record<string, string> = { name: 'name', description: 'description', category: 'category', title: 'title', priority: 'priority', recurrence_pattern: 'recurrence_pattern', subtasks: 'subtasks_json' };
    const assignments = values.map(([key]) => `${allowed[key]} = @${key}`).join(', ');
    const mapped = Object.fromEntries(values.map(([key, value]) => [key, key === 'subtasks' ? JSON.stringify(value) : value]));
    database.prepare(`UPDATE templates SET ${assignments}, updated_at = datetime('now') WHERE id = @id AND user_id = @userId`).run({ ...mapped, id, userId });
    return this.findById(id, userId);
  },
  delete(id: number, userId: number): boolean {
    return database.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
  use(id: number, userId: number): Todo | null {
    const template = this.findById(id, userId);
    if (!template) return null;
    const todo = todoDB.create({ user_id: userId, title: template.title, priority: template.priority, is_recurring: Boolean(template.recurrence_pattern), recurrence_pattern: template.recurrence_pattern });
    for (const subtask of template.subtasks) subtaskDB.create({ todo_id: todo.id, user_id: userId, title: subtask.title, position: subtask.position });
    return todo;
  },
};

export function closeDatabase(): void {
  database.close();
}
