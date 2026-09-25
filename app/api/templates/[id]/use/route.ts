import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';

interface RouteContext { params: Promise<{ id: string }> }
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  const todo = templateDB.use(id, session.userId);
  return todo ? NextResponse.json(todo, { status: 201 }) : NextResponse.json({ error: 'Template not found' }, { status: 404 });
}
