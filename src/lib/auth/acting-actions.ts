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
  redirect('/booking');
}

export async function stopActingAction() {
  const session = await readSession();
  const viewer = await getViewer();
  if (session?.kind === 'resident' && session.by && viewer?.kind === 'resident' && viewer.actingAdminId) {
    await createSession({ kind: 'admin', adminId: session.by });
    redirect('/manage/booking');
  }
  redirect('/');
}

// Opens the resident booking pages for a super-admin in the chosen building,
// using a personal test resident (the admin's own email, apartment "TEST").
// It is created on first use and moved when another building is chosen.
export async function openBookingAsAdminAction(formData: FormData) {
  const access = await requireStaff();
  if (access.viewer.kind !== 'admin') redirect('/manage/overview');
  const { scope, viewer, org } = access;
  const buildingId = String(formData.get('buildingId') ?? '');
  const building = await scope.buildings.q().where({ id: buildingId }).first();
  if (!building) redirect('/manage/booking');
  const unit = (await scope.units.q().where({ buildingId, code: 'TEST' }).first()) ?? (await scope.units.create({ buildingId, code: 'TEST', externalRef: 'kellona-admin-test' }));
  const existing = await scope.residents.q().where({ email: viewer.email }).first();
  const resident = existing
    ? ((await scope.residents.q().where({ id: existing.id }).update({ unitId: unit.id, status: 'active', name: viewer.name })) ?? existing)
    : await scope.residents.create({ name: viewer.name, email: viewer.email, unitId: unit.id, externalRef: 'kellona-admin-test' });
  await createSession({ kind: 'resident', orgId: org.id, residentId: resident.id, by: viewer.id });
  redirect('/booking');
}
