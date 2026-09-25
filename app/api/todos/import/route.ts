import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { importUserData } from '@/lib/db';
import { z } from 'zod';

const importSchema = z.object({
  version: z.literal(1),
  todos: z.array(z.object({
    title: z.string().trim().min(1).max(500),
    completed: z.boolean(),
    due_date: z.string().nullable(),
    priority: z.enum(['high', 'medium', 'low']),
    is_recurring: z.boolean(),
    recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable(),
    reminder_minutes: z.number().int().positive().nullable(),
    subtasks: z.array(z.object({ title: z.string().trim().min(1).max(500), completed: z.boolean(), position: z.number().int().min(0) })),
    tags: z.array(z.object({ name: z.string().trim().min(1).max(50), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })),
  })),
}).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const result = importSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: 'Invalid export format' }, { status: 400 });
  return NextResponse.json({ success: true, imported: importUserData(session.userId, result.data) }, { status: 201 });
}