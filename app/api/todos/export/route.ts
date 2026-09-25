import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { exportUserData } from '@/lib/db';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(exportUserData(session.userId), {
    headers: { 'Content-Disposition': 'attachment; filename="todos.json"' },
  });
}