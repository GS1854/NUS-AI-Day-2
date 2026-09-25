import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  return session ? NextResponse.json(session) : NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}
