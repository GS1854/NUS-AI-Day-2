import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';
import { tagInputSchema } from '@/lib/validation/tag';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(tagDB.listByUser(session.userId));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const result = tagInputSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid tag' }, { status: 400 });
  try { return NextResponse.json(tagDB.create({ user_id: session.userId, ...result.data }), { status: 201 }); } catch { return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 }); }
}
