import { db } from '../../prisma/db';
import { orgScope } from '../tenant/scope';
import type { Viewer } from './viewer';

// Why an account cannot delete itself right now, or null when it can.
// - acting: a super-admin viewing the app as a resident
// - lastManager: the organization would be left without a manager
// - lastAdmin: the platform would be left without a super-admin
export type DeleteBlock = 'acting' | 'lastManager' | 'lastAdmin';

export async function deleteBlock(viewer: Viewer): Promise<DeleteBlock | null> {
  if (viewer.kind === 'resident') return viewer.actingAdminId ? 'acting' : null;
  if (viewer.kind === 'staff') {
    if (viewer.role !== 'manager') return null;
    const managers = await orgScope(viewer.orgId).staff.q().where({ role: 'manager' }).all();
    return managers.length <= 1 ? 'lastManager' : null;
  }
  const admins = await db.orm.public.PlatformAdmin.all();
  return admins.length <= 1 ? 'lastAdmin' : null;
}

// Deletes the signed-in person's own account. A resident's bookings, sign-in
// identities, reminders, watches and reports go with it (database cascades);
// staff lose their access; the organization and its data stay.
export async function deleteOwnAccount(viewer: Viewer): Promise<void> {
  if (viewer.kind === 'resident') {
    await orgScope(viewer.orgId).residents.q().where({ id: viewer.id }).delete();
  } else if (viewer.kind === 'staff') {
    await orgScope(viewer.orgId).staff.q().where({ id: viewer.id }).delete();
  } else {
    await db.orm.public.PlatformAdmin.where({ id: viewer.id }).delete();
  }
  // Unused sign-in links for the address, one row at a time.
  const orgId = viewer.kind === 'admin' ? null : viewer.orgId;
  for (const token of await db.orm.public.LoginToken.where({ email: viewer.email.toLowerCase() }).all()) {
    if (token.organizationId === orgId) await db.orm.public.LoginToken.where({ id: token.id }).delete();
  }
}
