'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireManager } from '../auth/access';
import type { OrgScope } from '../tenant/scope';

const str = (formData: FormData, name: string, max = 120) => String(formData.get(name) ?? '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function setBuildings(scope: OrgScope, staffId: string, wanted: string[]) {
  const valid = new Set((await scope.buildings.q().all()).map((b) => b.id));
  const current = await scope.staffBuildings.q().where({ staffId }).all();
  for (const link of current) if (!wanted.includes(link.buildingId)) await scope.staffBuildings.q().where({ id: link.id }).delete();
  for (const buildingId of wanted) {
    if (valid.has(buildingId) && !current.some((c) => c.buildingId === buildingId)) await scope.staffBuildings.create({ staffId, buildingId });
  }
}

export async function addStaffAction(formData: FormData) {
  const { scope } = await requireManager();
  const name = str(formData, 'name');
  const email = str(formData, 'email', 254).toLowerCase();
  const role = str(formData, 'role', 10) === 'manager' ? 'manager' : 'staff';
  if (!name || !EMAIL.test(email) || (await scope.staff.q().where({ email }).first())) redirect('/manage/staff?error=1');
  const staff = await scope.staff.create({ name, email, role });
  if (role === 'staff') await setBuildings(scope, staff.id, formData.getAll('buildings').map(String));
  revalidatePath('/manage/staff');
  redirect('/manage/staff?saved=1');
}

export async function updateStaffAction(formData: FormData) {
  const { scope } = await requireManager();
  const id = str(formData, 'id', 40);
  const staff = await scope.staff.q().where({ id }).first();
  if (!staff) redirect('/manage/staff');
  const role = str(formData, 'role', 10) === 'manager' ? 'manager' : 'staff';
  await scope.staff.q().where({ id }).update({ role, name: str(formData, 'name') || staff.name });
  await setBuildings(scope, id, role === 'staff' ? formData.getAll('buildings').map(String) : []);
  revalidatePath('/manage/staff');
  redirect('/manage/staff?saved=1');
}

// A manager cannot remove themselves, so an organization never locks itself out by accident.
export async function removeStaffAction(formData: FormData) {
  const { scope, viewer } = await requireManager();
  const id = str(formData, 'id', 40);
  if (viewer.kind === 'staff' && viewer.id === id) redirect('/manage/staff');
  await scope.staff.q().where({ id }).delete();
  revalidatePath('/manage/staff');
  redirect('/manage/staff');
}
