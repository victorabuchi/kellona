import { headers } from 'next/headers';

// The address the visitor used. Next.js renders the page after a server action
// redirect through an internal request whose Host is the bare server address,
// keeping the real one in X-Forwarded-Host (Render's proxy sets it too), so
// that header is preferred.
export async function requestHost(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-host')?.split(',')[0]?.trim();
  return forwarded || h.get('host');
}
