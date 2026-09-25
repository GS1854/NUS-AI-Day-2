import { z } from 'zod';
import { isDueDateAtLeastOneMinuteAway } from '@/lib/timezone';

const priority = z.enum(['high', 'medium', 'low']);
const recurrencePattern = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

const todoFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500, 'Title must be 500 characters or fewer'),
  due_date: z.string().nullable().optional(),
  priority: priority.optional().default('medium'),
  is_recurring: z.boolean().optional().default(false),
  recurrence_pattern: recurrencePattern.nullable().optional(),
  reminder_minutes: z.number().int().positive().nullable().optional(),
}).strict();

function validateDueDate(value: { due_date?: string | null }, context: z.RefinementCtx): void {
  if (value.due_date !== undefined && value.due_date !== null && !isDueDateAtLeastOneMinuteAway(value.due_date)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['due_date'], message: 'Due date must be at least 1 minute in the future' });
  }
}

function validateRelationships(value: { is_recurring?: boolean; due_date?: string | null; recurrence_pattern?: string | null; reminder_minutes?: number | null }, context: z.RefinementCtx): void {
  if (value.is_recurring === true && (!value.due_date || !value.recurrence_pattern)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['is_recurring'], message: 'Recurring todos require a due date and recurrence pattern' });
  }
  if (value.is_recurring === false && value.recurrence_pattern) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['recurrence_pattern'], message: 'Non-recurring todos cannot have a recurrence pattern' });
  }
  if (value.reminder_minutes !== undefined && value.reminder_minutes !== null && !value.due_date) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['reminder_minutes'], message: 'Reminders require a due date' });
  }
}

export const todoConsistencySchema = todoFieldsSchema.superRefine(validateRelationships);
export const todoInputSchema = todoFieldsSchema.superRefine(validateDueDate).superRefine(validateRelationships);

export const todoUpdateSchema = todoFieldsSchema.partial().extend({ completed: z.boolean().optional() }).strict().superRefine(validateDueDate).superRefine(validateRelationships);
