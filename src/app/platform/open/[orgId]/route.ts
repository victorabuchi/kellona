import { requestHost } from '../../../../lib/tenant/request-host';
import { redirect } from 'next/navigation';
import { db } from '../../../../prisma/db';
import { getViewer } from '../../../../lib/auth/viewer';
import { newLoginToken } from '../../../../lib/auth/token';
import { orgBaseUrl } from '../../../../lib/tenant/urls';

// Sessions are per address, so opening another organization hands the
// super-admin over with a one-minute, single use token.
export async function GET(_request: Request, ctx: RouteContext<'/platform/open/[orgId]'>) {
  const { orgId } = await ctx.params;
  const viewer = await getViewer();
  if (viewer?.kind !== 'admin') redirect('/');
  const org = await db.orm.public.Organization.where({ id: orgId }).include('domains', (d) => d).first();
  if (!org) redirect('/platform');

  const { token, hash } = newLoginToken();
  await db.orm.public.LoginToken.create({ tokenHash: hash, email: viewer.email, organizationId: null, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  const primaryHost = org.domains.find((d) => d.isPrimary && d.verifiedAt)?.host ?? null;
  const base = orgBaseUrl({ slug: org.slug, primaryHost }, await requestHost());
  redirect(`${base}/auth/handoff?token=${token}`);
}
