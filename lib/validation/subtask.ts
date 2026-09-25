import { z } from 'zod';

const subtaskFields = z.object({
  title: z.string().trim().min(1, 'Subtask title is required').max(500, 'Subtask title must be 500 characters or fewer'),
  completed: z.boolean().optional().default(false),
  position: z.number().int().min(0).optional().default(0),
}).strict();

export const subtaskInputSchema = subtaskFields;
export const subtaskUpdateSchema = subtaskFields.partial().strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one subtask field is required',
});
