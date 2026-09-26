import { cookies } from 'next/headers';
import { decodeSession, encodeSession, type SessionPayload } from './token';
import { SESSION_COOKIE, SESSION_DAYS } from './constants';

type NewSession =
  | { kind: 'admin'; adminId: string }
  | { kind: 'resident'; orgId: string; residentId: string; by?: string }
  | { kind: 'staff'; orgId: string; staffId: string };

function secret(): string {
  const value = process.env['SESSION_SECRET'];
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters)');
  return value;
}

// Host-only cookie: a session made on one organization's address is never
// sent to another's, and the viewer check below also compares organization ids.
export async function createSession(session: NewSession): Promise<void> {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const payload = { ...session, exp: Date.now() + maxAge * 1000 } as SessionPayload;
  (await cookies()).set(SESSION_COOKIE, encodeSession(payload, secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value, secret(), Date.now());
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
