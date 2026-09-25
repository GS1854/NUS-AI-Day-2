import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';

interface RouteContext { params: Promise<{ id: string }> }
function parseId(value: string): number | null { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }

export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const todoId = parseId((await params).id);
  if (todoId === null || !todoDB.findById(todoId, session.userId)) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const tagId = typeof body === 'object' && body !== null && 'tag_id' in body ? Number((body as { tag_id: unknown }).tag_id) : NaN;
  if (!Number.isInteger(tagId) || tagId < 1 || !tagDB.assign(todoId, tagId, session.userId)) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  return NextResponse.json(todoDB.findById(todoId, session.userId));
}

export async function DELETE(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const todoId = parseId((await params).id);
  const tagId = Number(request.nextUrl.searchParams.get('tag_id'));
  if (todoId === null || !tagDB.unassign(todoId, tagId, session.userId)) return NextResponse.json({ error: 'Tag assignment not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
