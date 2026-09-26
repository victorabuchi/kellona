'use server';

import { redirect } from 'next/navigation';
import { requestHost } from '../tenant/request-host';
import { db } from '../../prisma/db';
import { orgScope } from '../tenant/scope';
import { getCurrentOrg } from '../tenant/org';
import { getT } from '../i18n';
import { sendEmail, emailConfigured } from '../email';
import { burnPasswordCheck, verifyPassword } from './password';
import { createSession, destroySession } from './session';
import { hashLoginToken, newLoginToken } from './token';
import { clearFailures, isThrottled, recordFailure } from './throttle';
import { requestOrigin } from './origin';
import { LOGIN_LINK_MINUTES } from './constants';
import { homeFor } from './home';
import { findOrgAccountsByEmail } from '../tenant/load';
import { orgBaseUrl } from '../tenant/urls';

function readEmail(formData: FormData): string {
  return String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 254);
}

// The sign-in page is / on an organization's address and /login on Kellona's own.
function back(params: Record<string, string | string[]>, org: unknown): never {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const value of Array.isArray(v) ? v : [v]) search.append(k, value);
  redirect(`${org ? '/' : '/login'}?${search.toString()}`);
}

export async function passwordSignInAction(formData: FormData) {
  const email = readEmail(formData);
  const password = String(formData.get('password') ?? '');
  const org = await getCurrentOrg();
  if (!email || !password) back({ error: 'missing', email }, org);
  if (isThrottled(email)) back({ error: 'throttled', email }, org);

  const now = new Date().toISOString();
  const admin = await db.orm.public.PlatformAdmin.where({ email }).first();
  if (admin?.passwordHash && (await verifyPassword(password, admin.passwordHash))) {
    clearFailures(email);
    await db.orm.public.PlatformAdmin.where({ id: admin.id }).update({ lastSignInAt: now });
    await createSession({ kind: 'admin', adminId: admin.id });
    redirect(homeFor('admin', Boolean(org)));
  }

  const identity = org ? await orgScope(org.id).identities.q().where({ provider: 'password', subject: email }).first() : null;
  if (!identity) await burnPasswordCheck(password);
  if (org && identity && (await verifyPassword(password, identity.secretHash))) {
    clearFailures(email);
    await orgScope(org.id).identities.q().where({ id: identity.id }).update({ lastUsedAt: now });
    if (identity.residentId) await createSession({ kind: 'resident', orgId: org.id, residentId: identity.residentId });
    else if (identity.staffId) await createSession({ kind: 'staff', orgId: org.id, staffId: identity.staffId });
    else back({ error: 'invalid', email }, org);
    redirect(homeFor(identity.residentId ? 'resident' : 'staff', true));
  }

  recordFailure(email);
  back({ error: 'invalid', email }, org);
}

type Target = { organizationId: string | null; origin: string; senderName: string };

// Always answers "sent" so the form does not reveal who has an account. On
// Kellona's own address the link goes to each organization the email belongs
// to, since sessions live on the organization's address.
export async function requestLinkAction(formData: FormData) {
  const email = readEmail(formData);
  const org = await getCurrentOrg();
  if (!email || !email.includes('@')) back({ error: 'missing', email }, org);

  const origin = await requestOrigin();
  const targets: Target[] = [];
  if (org) {
    const scope = orgScope(org.id);
    const known = (await scope.residents.q().where({ email, status: 'active' }).first()) ?? (await scope.staff.q().where({ email }).first());
    if (known) targets.push({ organizationId: org.id, origin, senderName: org.senderName });
  } else {
    const host = await requestHost();
    for (const account of await findOrgAccountsByEmail(email)) {
      targets.push({ organizationId: account.organizationId, origin: orgBaseUrl({ slug: account.slug, primaryHost: account.primaryHost }, host), senderName: account.name });
    }
  }
  if (!targets.length && (await db.orm.public.PlatformAdmin.where({ email }).first())) targets.push({ organizationId: null, origin, senderName: 'Kellona' });
  if (!targets.length) back({ sent: '1' }, org);

  const links: string[] = [];
  for (const target of targets) {
    const { token, hash } = newLoginToken();
    await db.orm.public.LoginToken.create({
      tokenHash: hash,
      email,
      organizationId: target.organizationId,
      expiresAt: new Date(Date.now() + LOGIN_LINK_MINUTES * 60_000).toISOString(),
    });
    links.push(`${target.origin}/auth/verify?token=${token}`);
  }

  if (emailConfigured()) {
    const { t } = await getT(org);
    for (const [i, link] of links.entries()) {
      const ok = await sendEmail({
        to: email,
        senderName: targets[i]!.senderName,
        subject: t('email.linkSubject'),
        text: t('email.linkBody', { link, minutes: LOGIN_LINK_MINUTES }),
      });
      if (!ok) back({ error: 'email', email }, org);
    }
    back({ sent: '1' }, org);
  }
  // Development without an email provider: show the links on the page.
  if (process.env.NODE_ENV !== 'production') back({ sent: '1', dev: links }, org);
  back({ error: 'email', email }, org);
}

export async function consumeLinkAction(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const here = await getCurrentOrg();
  const row = token ? await db.orm.public.LoginToken.where({ tokenHash: hashLoginToken(token) }).first() : null;
  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) back({ error: 'link' }, here);
  await db.orm.public.LoginToken.where({ id: row.id }).update({ usedAt: new Date().toISOString() });

  if (!row.organizationId) {
    const admin = await db.orm.public.PlatformAdmin.where({ email: row.email }).first();
    if (!admin) back({ error: 'link' }, here);
    await db.orm.public.PlatformAdmin.where({ id: admin.id }).update({ lastSignInAt: new Date().toISOString() });
    await createSession({ kind: 'admin', adminId: admin.id });
    redirect(homeFor('admin', Boolean(here)));
  }

  // A link only works on the address of the organization it was made for.
  const org = here;
  if (!org || org.id !== row.organizationId) back({ error: 'link' }, here);
  const scope = orgScope(org.id);
  const resident = await scope.residents.q().where({ email: row.email, status: 'active' }).first();
  if (resident) {
    await createSession({ kind: 'resident', orgId: org.id, residentId: resident.id });
    redirect('/book');
  }
  const staff = await scope.staff.q().where({ email: row.email }).first();
  if (!staff) back({ error: 'link' }, org);
  await createSession({ kind: 'staff', orgId: org.id, staffId: staff.id });
  redirect('/manage/overview');
}

export async function signOutAction() {
  await destroySession();
  redirect((await getCurrentOrg()) ? '/' : '/login');
}
