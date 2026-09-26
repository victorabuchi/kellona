import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Signed session values, independent of Next so they can be unit tested.

export type SessionPayload =
  | { kind: 'admin'; adminId: string; exp: number }
  // `by` is set when a super-admin views the app as this resident.
  | { kind: 'resident'; orgId: string; residentId: string; exp: number; by?: string }
  | { kind: 'staff'; orgId: string; staffId: string; exp: number };

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function encodeSession(payload: SessionPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data, secret)}`;
}

export function decodeSession(value: string | undefined, secret: string, nowMs: number): SessionPayload | null {
  if (!value) return null;
  const [data, signature] = value.split('.');
  if (!data || !signature) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(data, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < nowMs) return null;
    if (payload.kind === 'admin' && typeof payload.adminId === 'string') return payload;
    if (payload.kind === 'resident' && typeof payload.orgId === 'string' && typeof payload.residentId === 'string') {
      if (payload.by !== undefined && typeof payload.by !== 'string') return null;
      return payload;
    }
    if (payload.kind === 'staff' && typeof payload.orgId === 'string' && typeof payload.staffId === 'string') return payload;
    return null;
  } catch {
    return null;
  }
}

export function newLoginToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashLoginToken(token) };
}

export function hashLoginToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
