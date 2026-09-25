import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';
import { calculateNextDueDate } from '@/lib/recurrence';
import { todoConsistencySchema, todoUpdateSchema } from '@/lib/validation/todo';

interface RouteContext { params: Promise<{ id: string }> }

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const id = parseId((await params).id);
  const todo = id === null ? null : todoDB.findById(id, session.userId);
  return todo ? NextResponse.json(todo) : NextResponse.json({ error: 'Todo not found' }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const id = parseId((await params).id);
  const todo = id === null ? null : todoDB.findById(id, session.userId);
  if (id === null || !todo) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const result = todoUpdateSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid todo' }, { status: 400 });
  const changes = result.data.is_recurring === false
    ? { ...result.data, recurrence_pattern: null }
    : result.data;
  const consistency = todoConsistencySchema.safeParse({
    title: changes.title ?? todo.title,
    due_date: changes.due_date !== undefined ? changes.due_date : todo.due_date,
    priority: changes.priority ?? todo.priority,
    is_recurring: changes.is_recurring ?? todo.is_recurring,
    recurrence_pattern: changes.recurrence_pattern !== undefined ? changes.recurrence_pattern : todo.recurrence_pattern,
    reminder_minutes: changes.reminder_minutes !== undefined ? changes.reminder_minutes : todo.reminder_minutes,
  });
  if (!consistency.success) return NextResponse.json({ error: consistency.error.issues[0]?.message ?? 'Inconsistent todo state' }, { status: 400 });
  const updated = todoDB.update(id, session.userId, changes);
  if (updated && changes.completed === true && !todo.completed && todo.is_recurring && todo.due_date && todo.recurrence_pattern) {
    const nextDueDate = calculateNextDueDate(todo.due_date, todo.recurrence_pattern);
    if (nextDueDate) {
      const nextTodo = todoDB.create({
        user_id: session.userId,
      title: todo.title,
      due_date: nextDueDate,
      priority: todo.priority,
      is_recurring: true,
      recurrence_pattern: todo.recurrence_pattern,
      reminder_minutes: todo.reminder_minutes,
      });
      for (const tag of todo.tags ?? []) tagDB.assign(nextTodo.id, tag.id, session.userId);
    }
  }
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: 'Todo not found' }, { status: 404 });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null || !todoDB.findById(id, session.userId)) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  todoDB.delete(id, session.userId);
  return NextResponse.json({ success: true });
}
