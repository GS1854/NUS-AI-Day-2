import type { RecurrencePattern } from '@/lib/db';

function parseLocalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalDate(date: Date): string {
  const singapore = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return singapore.toISOString().slice(0, 16);
}

export function calculateNextDueDate(value: string, pattern: RecurrencePattern): string | null {
  const parsed = parseLocalDate(value);
  if (!parsed) return null;
  const next = new Date(parsed);
  if (pattern === 'daily') next.setUTCDate(next.getUTCDate() + 1);
  if (pattern === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  if (pattern === 'monthly') {
    const originalDay = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(originalDay, lastDay));
  }
  if (pattern === 'yearly') {
    const originalMonth = next.getUTCMonth();
    const originalDay = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    next.setUTCMonth(originalMonth);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), originalMonth + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(originalDay, lastDay));
  }
  return formatLocalDate(next);
}
