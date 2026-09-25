import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';
import { tagUpdateSchema } from '@/lib/validation/tag';

interface RouteContext { params: Promise<{ id: string }> }
function parseId(value: string): number | null { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }

export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null || !tagDB.findById(id, session.userId)) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const result = tagUpdateSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid tag' }, { status: 400 });
  try { return NextResponse.json(tagDB.update(id, session.userId, result.data)); } catch { return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 }); }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null || !tagDB.delete(id, session.userId)) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
