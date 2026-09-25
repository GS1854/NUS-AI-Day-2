import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export interface Session { userId: number; username: string }

function getSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32 || value.startsWith('replace-with-')) throw new Error('SESSION_SECRET must be a configured random secret');
  return value;
}

export function assertAuthConfiguration(): void {
  getSecret();
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createSessionToken(session: Session): string {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token: string): Session | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session & { exp?: number };
    return Number.isInteger(session.userId) && typeof session.username === 'string' && typeof session.exp === 'number' && session.exp > Date.now()
      ? { userId: session.userId, username: session.username }
      : null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get('todo_session')?.value;
  return token ? verifySessionToken(token) : null;
}
