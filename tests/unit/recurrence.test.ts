import { describe, expect, it } from 'vitest';
import { calculateNextDueDate } from '@/lib/recurrence';

describe('recurrence calculations', () => {
  it('calculates daily and weekly dates', () => {
    expect(calculateNextDueDate('2026-09-25T10:30', 'daily')).toBe('2026-09-26T10:30');
    expect(calculateNextDueDate('2026-09-25T10:30', 'weekly')).toBe('2026-10-02T10:30');
  });

  it('clamps month-end dates', () => {
    expect(calculateNextDueDate('2026-01-31T10:30', 'monthly')).toBe('2026-02-28T10:30');
  });

  it('rejects malformed dates', () => {
    expect(calculateNextDueDate('not-a-date', 'daily')).toBeNull();
  });
});