'use server';

import { redirect } from 'next/navigation';
import { readSession, createSession } from './session';
import { getViewer } from './viewer';
import { requireStaff } from './access';

// Super-admins can view the app as a resident of the current organization, to
// test and to support. Returning restores the admin session.
export async function actAsResidentAction(formData: FormData) {
  const access = await requireStaff();
  if (access.viewer.kind !== 'admin') redirect('/manage/residents');
  const residentId = String(formData.get('residentId') ?? '');
  const resident = await access.scope.residents.q().where({ id: residentId, status: 'active' }).first();
  if (!resident) redirect('/manage/residents');
  await createSession({ kind: 'resident', orgId: access.org.id, residentId: resident.id, by: access.viewer.id });
  redirect('/book');
}

export async function stopActingAction() {
  const session = await readSession();
  const viewer = await getViewer();
  if (session?.kind === 'resident' && session.by && viewer?.kind === 'resident' && viewer.actingAdminId) {
    await createSession({ kind: 'admin', adminId: session.by });
    redirect('/manage/residents');
  }
  redirect('/');
}
