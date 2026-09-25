import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';
import { templateInputSchema } from '@/lib/validation/template';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(templateDB.listByUser(session.userId));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const result = templateInputSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid template' }, { status: 400 });
  try { return NextResponse.json(templateDB.create({ user_id: session.userId, ...result.data }), { status: 201 }); } catch { return NextResponse.json({ error: 'Template name already exists' }, { status: 409 }); }
}
