import { describe, expect, it } from 'vitest';
import { todoInputSchema } from '@/lib/validation/todo';

function futureDueDate(minutes: number): string {
  const date = new Date(Date.now() + minutes * 60_000);
  const singapore = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return singapore.toISOString().slice(0, 16);
}

describe('todo validation', () => {
  it('trims a valid title and applies medium priority', () => {
    const result = todoInputSchema.parse({ title: '  Plan the afternoon  ' });
    expect(result.title).toBe('Plan the afternoon');
    expect(result.priority).toBe('medium');
  });

  it('rejects blank titles', () => {
    expect(todoInputSchema.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('rejects due dates less than one minute away', () => {
    expect(todoInputSchema.safeParse({ title: 'Too soon', due_date: futureDueDate(0) }).success).toBe(false);
  });

  it('accepts due dates at least one minute away', () => {
    expect(todoInputSchema.safeParse({ title: 'Later', due_date: futureDueDate(2) }).success).toBe(true);
  });

  it('rejects oversized titles', () => {
    expect(todoInputSchema.safeParse({ title: 'x'.repeat(501) }).success).toBe(false);
  });

  it('rejects inconsistent recurring and reminder data', () => {
    expect(todoInputSchema.safeParse({ title: 'Recurring without metadata', is_recurring: true }).success).toBe(false);
    expect(todoInputSchema.safeParse({ title: 'Reminder without due date', reminder_minutes: 15 }).success).toBe(false);
  });
});
