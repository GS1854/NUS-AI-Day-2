import { z } from 'zod';

export const tagInputSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(50, 'Tag name must be 50 characters or fewer'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value'),
}).strict();

export const tagUpdateSchema = tagInputSchema.partial().strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one tag field is required',
});
