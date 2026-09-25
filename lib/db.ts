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
}

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
`);

type TodoRow = Omit<Todo, 'completed' | 'is_recurring'> & { completed: number; is_recurring: number };

function mapTodo(row: TodoRow | undefined): Todo | null {
  if (!row) return null;
  return { ...row, completed: Boolean(row.completed), is_recurring: Boolean(row.is_recurring) };
}

function ensureUser(userId: number): void {
  database.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)').run(userId, `user-${userId}`);
}

export const todoDB = {
  health(): void {
    database.prepare('SELECT 1').get();
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
      .map((row) => mapTodo(row)!);
  },

  findById(id: number, userId?: number): Todo | null {
    const row = userId === undefined
      ? database.prepare('SELECT * FROM todos WHERE id = ?').get(id)
      : database.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId);
    return mapTodo(row as TodoRow | undefined);
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

export function closeDatabase(): void {
  database.close();
}
