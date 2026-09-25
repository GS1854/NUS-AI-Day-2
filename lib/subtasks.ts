export interface ProgressItem { completed: boolean }

export interface Progress {
  completed: number;
  total: number;
  percentage: number;
}

export function calculateProgress(items: ProgressItem[]): Progress {
  const completed = items.filter((item) => item.completed).length;
  const total = items.length;
  return { completed, total, percentage: total === 0 ? 0 : Math.round((completed / total) * 100) };
}
