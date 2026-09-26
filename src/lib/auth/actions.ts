'use server';

import { redirect } from 'next/navigation';
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

function readEmail(formData: FormData): string {
  return String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 254);
}

function back(params: Record<string, string>): never {
  redirect(`/?${new URLSearchParams(params).toString()}`);
}

export async function passwordSignInAction(formData: FormData) {
  const email = readEmail(formData);
  const password = String(formData.get('password') ?? '');
  if (!email || !password) back({ error: 'missing', email });
  if (isThrottled(email)) back({ error: 'throttled', email });

  const now = new Date().toISOString();
  const admin = await db.orm.public.PlatformAdmin.where({ email }).first();
  if (admin?.passwordHash && (await verifyPassword(password, admin.passwordHash))) {
    clearFailures(email);
    await db.orm.public.PlatformAdmin.where({ id: admin.id }).update({ lastSignInAt: now });
    await createSession({ kind: 'admin', adminId: admin.id });
    redirect('/account');
  }

  const org = await getCurrentOrg();
  const identity = org ? await orgScope(org.id).identities.q().where({ provider: 'password', subject: email }).first() : null;
  if (!identity) await burnPasswordCheck(password);
  if (org && identity && (await verifyPassword(password, identity.secretHash))) {
    clearFailures(email);
    await orgScope(org.id).identities.q().where({ id: identity.id }).update({ lastUsedAt: now });
    if (identity.residentId) await createSession({ kind: 'resident', orgId: org.id, residentId: identity.residentId });
    else if (identity.staffId) await createSession({ kind: 'staff', orgId: org.id, staffId: identity.staffId });
    else back({ error: 'invalid', email });
    redirect('/account');
  }

  recordFailure(email);
  back({ error: 'invalid', email });
}

// Always answers "sent" so the form does not reveal who has an account.
export async function requestLinkAction(formData: FormData) {
  const email = readEmail(formData);
  if (!email || !email.includes('@')) back({ error: 'missing', email });

  const org = await getCurrentOrg();
  let organizationId: string | null = null;
  let known = false;
  if (org) {
    const scope = orgScope(org.id);
    const resident = await scope.residents.q().where({ email, status: 'active' }).first();
    const staff = resident ? null : await scope.staff.q().where({ email }).first();
    if (resident || staff) {
      organizationId = org.id;
      known = true;
    }
  }
  if (!known && (await db.orm.public.PlatformAdmin.where({ email }).first())) known = true;
  if (!known) back({ sent: '1' });

  const { token, hash } = newLoginToken();
  await db.orm.public.LoginToken.create({
    tokenHash: hash,
    email,
    organizationId,
    expiresAt: new Date(Date.now() + LOGIN_LINK_MINUTES * 60_000).toISOString(),
  });
  const link = `${await requestOrigin()}/auth/verify?token=${token}`;

  if (emailConfigured()) {
    const { t } = await getT(org);
    const ok = await sendEmail({
      to: email,
      senderName: org?.senderName ?? 'Kellona',
      subject: t('email.linkSubject'),
      text: t('email.linkBody', { link, minutes: LOGIN_LINK_MINUTES }),
    });
    if (!ok) back({ error: 'email', email });
    back({ sent: '1' });
  }
  // Development without an email provider: show the link on the page.
  if (process.env.NODE_ENV !== 'production') back({ sent: '1', dev: link });
  back({ error: 'email', email });
}

export async function consumeLinkAction(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const row = token ? await db.orm.public.LoginToken.where({ tokenHash: hashLoginToken(token) }).first() : null;
  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) back({ error: 'link' });
  await db.orm.public.LoginToken.where({ id: row.id }).update({ usedAt: new Date().toISOString() });

  if (!row.organizationId) {
    const admin = await db.orm.public.PlatformAdmin.where({ email: row.email }).first();
    if (!admin) back({ error: 'link' });
    await db.orm.public.PlatformAdmin.where({ id: admin.id }).update({ lastSignInAt: new Date().toISOString() });
    await createSession({ kind: 'admin', adminId: admin.id });
    redirect('/account');
  }

  // A link only works on the address of the organization it was made for.
  const org = await getCurrentOrg();
  if (!org || org.id !== row.organizationId) back({ error: 'link' });
  const scope = orgScope(org.id);
  const resident = await scope.residents.q().where({ email: row.email, status: 'active' }).first();
  if (resident) {
    await createSession({ kind: 'resident', orgId: org.id, residentId: resident.id });
    redirect('/account');
  }
  const staff = await scope.staff.q().where({ email: row.email }).first();
  if (!staff) back({ error: 'link' });
  await createSession({ kind: 'staff', orgId: org.id, staffId: staff.id });
  redirect('/account');
}

export async function signOutAction() {
  await destroySession();
  redirect('/');
}
