import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB } from '@/lib/db';
import { subtaskUpdateSchema } from '@/lib/validation/subtask';

interface RouteContext { params: Promise<{ id: string }> }

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null || !subtaskDB.findById(id, session.userId)) return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const result = subtaskUpdateSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid subtask' }, { status: 400 });
  const updated = subtaskDB.update(id, session.userId, result.data);
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null || !subtaskDB.delete(id, session.userId)) return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}