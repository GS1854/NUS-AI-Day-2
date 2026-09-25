import { describe, expect, it } from 'vitest';
import { sectionTodos } from '@/lib/todoSort';
import type { Todo } from '@/lib/db';

const baseTodo: Todo = { id: 1, user_id: 1, title: 'Task', completed: false, due_date: null, priority: 'medium', is_recurring: false, recurrence_pattern: null, reminder_minutes: null, last_notification_sent: null, created_at: '2026-09-25T08:00:00.000Z', updated_at: null };
const now = new Date('2026-09-25T04:00:00.000Z');

function todo(overrides: Partial<Todo>): Todo { return { ...baseTodo, ...overrides }; }

describe('todo sections', () => {
  it('separates overdue, pending, and completed todos', () => {
    const result = sectionTodos([
      todo({ id: 1, due_date: '2026-09-25T11:00' }),
      todo({ id: 2, due_date: '2026-09-25T13:00' }),
      todo({ id: 3, completed: true }),
    ], now);
    expect(result.overdue.map((item) => item.id)).toEqual([1]);
    expect(result.pending.map((item) => item.id)).toEqual([2]);
    expect(result.completed.map((item) => item.id)).toEqual([3]);
  });

  it('sorts incomplete tasks by priority before due date', () => {
    const result = sectionTodos([
      todo({ id: 1, priority: 'low', due_date: '2026-09-25T13:00' }),
      todo({ id: 2, priority: 'high', due_date: '2026-09-25T14:00' }),
    ], now);
    expect(result.pending.map((item) => item.id)).toEqual([2, 1]);
  });
});
