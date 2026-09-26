import { redirect } from 'next/navigation';
import { db } from '../../../prisma/db';
import { hashLoginToken } from '../../../lib/auth/token';
import { createSession } from '../../../lib/auth/session';
import { getCurrentOrg } from '../../../lib/tenant/org';

// Receives a super-admin handoff, in either direction: from Kellona to an
// organization (/platform/open) or back (/platform/home). Tokens live one minute.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const nextParam = url.searchParams.get('next') ?? '';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
  const row = token ? await db.orm.public.LoginToken.where({ tokenHash: hashLoginToken(token) }).first() : null;
  const valid = row && !row.usedAt && !row.organizationId && new Date(row.expiresAt).getTime() > Date.now();
  if (!valid) redirect('/?error=link');
  await db.orm.public.LoginToken.where({ id: row.id }).update({ usedAt: new Date().toISOString() });
  const admin = await db.orm.public.PlatformAdmin.where({ email: row.email }).first();
  if (!admin) redirect('/?error=link');
  await createSession({ kind: 'admin', adminId: admin.id });
  redirect(next ?? ((await getCurrentOrg()) ? '/manage/overview' : '/platform'));
}
