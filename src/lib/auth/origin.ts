import { headers } from 'next/headers';
import { requestHost } from '../tenant/request-host';

// Absolute origin of the current request, for links sent by email.
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = (await requestHost()) ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  return `${proto}://${host}`;
}
