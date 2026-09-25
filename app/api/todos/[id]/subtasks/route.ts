import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { calculateProgress } from '@/lib/subtasks';
import { subtaskDB, todoDB } from '@/lib/db';
import { subtaskInputSchema } from '@/lib/validation/subtask';

interface RouteContext { params: Promise<{ id: string }> }

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const todoId = parseId((await params).id);
  if (todoId === null || !todoDB.findById(todoId, session.userId)) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  const subtasks = subtaskDB.findAllByTodo(todoId, session.userId);
  return NextResponse.json({ subtasks, progress: calculateProgress(subtasks) });
}

export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const todoId = parseId((await params).id);
  if (todoId === null || !todoDB.findById(todoId, session.userId)) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const result = subtaskInputSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid subtask' }, { status: 400 });
  const subtask = subtaskDB.create({ todo_id: todoId, user_id: session.userId, ...result.data });
  return subtask ? NextResponse.json(subtask, { status: 201 }) : NextResponse.json({ error: 'Todo not found' }, { status: 404 });
}