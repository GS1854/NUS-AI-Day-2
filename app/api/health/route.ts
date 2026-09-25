import { NextResponse } from 'next/server';
import { assertAuthConfiguration } from '@/lib/auth';
import { todoDB } from '@/lib/db';

export function GET(): NextResponse {
  try {
    assertAuthConfiguration();
    todoDB.health();
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503 });
  }
}