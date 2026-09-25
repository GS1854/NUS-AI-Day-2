import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const holidays = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-17', name: 'Chinese New Year' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-08-09', name: 'National Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

export async function GET(): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(holidays);
}
