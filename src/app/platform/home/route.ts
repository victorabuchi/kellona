import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '../../../prisma/db';
import { getViewer } from '../../../lib/auth/viewer';
import { newLoginToken } from '../../../lib/auth/token';
import { platformBaseUrl } from '../../../lib/tenant/urls';
import { getCurrentOrg } from '../../../lib/tenant/org';

// Back from an organization's address to Kellona's own, carrying the
// super-admin session so the Kellona bar and sidebar take over at once.
export async function GET(request: Request) {
  const nextParam = new URL(request.url).searchParams.get('next') ?? '/platform';
  const next = nextParam.startsWith('/platform') ? nextParam : '/platform';
  if (!(await getCurrentOrg())) redirect(next);
  const viewer = await getViewer();
  const base = platformBaseUrl((await headers()).get('host'));
  if (viewer?.kind !== 'admin') redirect(`${base}/login`);
  const { token, hash } = newLoginToken();
  await db.orm.public.LoginToken.create({ tokenHash: hash, email: viewer.email, organizationId: null, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  redirect(`${base}/auth/handoff?token=${token}&next=${encodeURIComponent(next)}`);
}
