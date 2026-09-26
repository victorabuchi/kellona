'use server';

import { redirect } from 'next/navigation';
import { getViewer } from './viewer';
import { destroySession } from './session';
import { deleteBlock, deleteOwnAccount } from './account-deletion';
import { db } from '../../prisma/db';
import { orgScope } from '../tenant/scope';

// Deletes the signed-in account after the person typed their email to confirm.
export async function deleteAccountAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect('/');
  const typed = String(formData.get('confirm') ?? '').trim().toLowerCase();
  if (typed !== viewer.email.toLowerCase()) redirect('/account?error=confirm');
  const block = await deleteBlock(viewer);
  if (block) redirect(`/account?error=${block}`);
  await deleteOwnAccount(viewer);
  await destroySession();
  redirect('/');
}

// Changes the signed-in person's display name.
export async function updateNameAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect('/');
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  if (!name || (viewer.kind === 'resident' && viewer.actingAdminId)) redirect('/account?error=name');
  if (viewer.kind === 'resident') await orgScope(viewer.orgId).residents.q().where({ id: viewer.id }).update({ name });
  else if (viewer.kind === 'staff') await orgScope(viewer.orgId).staff.q().where({ id: viewer.id }).update({ name });
  else await db.orm.public.PlatformAdmin.where({ id: viewer.id }).update({ name });
  redirect('/account?saved=1');
}
