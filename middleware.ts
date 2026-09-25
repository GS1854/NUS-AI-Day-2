import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname.startsWith('/api/') || request.nextUrl.pathname.startsWith('/_next')) return NextResponse.next();
  if (!request.cookies.has('todo_session')) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!favicon.ico).*)'] };
