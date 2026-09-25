import type { Priority, Todo } from '@/lib/db';
import { isDueDatePast } from '@/lib/timezone';

const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((left, right) => {
    const priorityDifference = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityDifference !== 0) return priorityDifference;
    const leftDue = left.due_date ? Date.parse(`${left.due_date}:00+08:00`) : Number.POSITIVE_INFINITY;
    const rightDue = right.due_date ? Date.parse(`${right.due_date}:00+08:00`) : Number.POSITIVE_INFINITY;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return Date.parse(right.created_at) - Date.parse(left.created_at);
  });
}

export function sectionTodos(todos: Todo[], now = new Date()): { overdue: Todo[]; pending: Todo[]; completed: Todo[] } {
  return {
    overdue: sortTodos(todos.filter((todo) => !todo.completed && todo.due_date !== null && isDueDatePast(todo.due_date, now))),
    pending: sortTodos(todos.filter((todo) => !todo.completed && (todo.due_date === null || !isDueDatePast(todo.due_date, now)))),
    completed: [...todos.filter((todo) => todo.completed)].sort((left, right) => Date.parse(right.updated_at ?? right.created_at) - Date.parse(left.updated_at ?? left.created_at)),
  };
}
