const SINGAPORE_TIME_ZONE = 'Asia/Singapore';

export function getSingaporeNow(): Date {
  return new Date();
}

export function formatSingaporeDate(date: Date): string {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: SINGAPORE_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function parseDueDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isDueDateAtLeastOneMinuteAway(value: string, now = getSingaporeNow()): boolean {
  const dueDate = parseDueDate(value);
  return dueDate !== null && dueDate.getTime() >= now.getTime() + 60_000;
}

export function isDueDatePast(value: string, now = getSingaporeNow()): boolean {
  const dueDate = parseDueDate(value);
  return dueDate !== null && dueDate.getTime() < now.getTime();
}
