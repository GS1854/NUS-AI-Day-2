import { NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth';

export async function POST(): Promise<NextResponse> {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
  const response = NextResponse.json({ success: true, username: 'Local user' });
  response.cookies.set('todo_session', createSessionToken({ userId: 1, username: 'Local user' }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
