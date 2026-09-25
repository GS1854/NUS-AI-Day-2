import { describe, expect, it } from 'vitest';
import { subtaskDB, todoDB } from '@/lib/db';
import { calculateProgress } from '@/lib/subtasks';
import { subtaskInputSchema, subtaskUpdateSchema } from '@/lib/validation/subtask';

describe('subtask validation and progress', () => {
  it('trims titles and applies defaults', () => {
    expect(subtaskInputSchema.parse({ title: '  Draft outline  ' })).toEqual({
      title: 'Draft outline',
      completed: false,
      position: 0,
    });
  });

  it('rejects blank, oversized, negative-position, and unknown input', () => {
    expect(subtaskInputSchema.safeParse({ title: '   ' }).success).toBe(false);
    expect(subtaskInputSchema.safeParse({ title: 'x'.repeat(501) }).success).toBe(false);
    expect(subtaskInputSchema.safeParse({ title: 'Valid', position: -1 }).success).toBe(false);
    expect(subtaskInputSchema.safeParse({ title: 'Valid', unexpected: true }).success).toBe(false);
  });

  it('allows partial updates while rejecting an empty update', () => {
    expect(subtaskUpdateSchema.safeParse({ completed: true }).success).toBe(true);
    expect(subtaskUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('calculates completed count, total count, and percentage', () => {
    expect(calculateProgress([{ completed: true }, { completed: false }, { completed: true }])).toEqual({
      completed: 2,
      total: 3,
      percentage: 67,
    });
    expect(calculateProgress([])).toEqual({ completed: 0, total: 0, percentage: 0 });
  });

  it('cascades subtask deletion when the parent todo is deleted', () => {
    const userId = 990001;
    const todo = todoDB.create({ user_id: userId, title: `Cascade test ${Date.now()}` });
    const subtask = subtaskDB.create({ todo_id: todo.id, user_id: userId, title: 'Child item' });

    expect(subtask).not.toBeNull();
    todoDB.delete(todo.id, userId);
    expect(subtaskDB.findById(subtask!.id, userId)).toBeNull();
  });
});
