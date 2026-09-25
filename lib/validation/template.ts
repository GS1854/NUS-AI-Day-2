import { z } from 'zod';

export const templateInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(''),
  category: z.string().trim().max(50).default('General'),
  title: z.string().trim().min(1).max(500),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().default(null),
  subtasks: z.array(z.object({ title: z.string().trim().min(1).max(500), position: z.number().int().min(0) })).default([]),
}).strict();

export const templateUpdateSchema = templateInputSchema.partial().strict();
