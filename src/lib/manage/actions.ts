'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff, requireStaffBuilding, canSeeBuilding } from '../auth/access';
import { AMENITY_KINDS, isAmenityKind } from '../booking/kinds';
import { deleteBooking, type FacilityRow } from '../booking/engine';
import { readRules } from './rules-input';
import { parseResidentsCsv } from './csv';
import { importResidents } from './import';

const str = (formData: FormData, name: string, max = 120) => String(formData.get(name) ?? '').trim().slice(0, max);

function toBuilding(buildingId: string, anchor = ''): never {
  revalidatePath('/manage');
  revalidatePath('/booking');
  redirect(`/manage/b/${buildingId}${anchor}`);
}

export async function addBuildingAction(formData: FormData) {
  const access = await requireStaff();
  const name = str(formData, 'name');
  if (!name || access.buildingIds !== null) redirect('/manage');
  const existing = await access.scope.buildings.q().where({ name }).first();
  const building = existing ?? (await access.scope.buildings.create({ name, address: str(formData, 'address', 200) || null, area: str(formData, 'area', 80) || null }));
  toBuilding(building.id);
}

export async function addUnitAction(formData: FormData) {
  const buildingId = str(formData, 'buildingId', 40);
  const { scope } = await requireStaffBuilding(buildingId);
  const code = str(formData, 'code', 40);
  const floor = Number.parseInt(str(formData, 'floor', 4), 10);
  if (code && !(await scope.units.q().where({ buildingId, code }).first())) {
    await scope.units.create({ buildingId, code, floor: Number.isFinite(floor) ? floor : null });
  }
  toBuilding(buildingId, '#apartments');
}

// One form sets every kind for a building or one apartment. 'auto' removes the
// explicit row so the default applies again.
export async function saveAmenitiesAction(formData: FormData) {
  const buildingId = str(formData, 'buildingId', 40);
  const { scope } = await requireStaffBuilding(buildingId);
  const unitId = str(formData, 'unitId', 40);
  if (unitId && !(await scope.units.q().where({ id: unitId, buildingId }).first())) toBuilding(buildingId);

  for (const kind of AMENITY_KINDS) {
    const raw = str(formData, `state_${kind}`, 8);
    const state = raw === 'yes' || raw === 'no' ? raw : 'auto';
    const enabled = state === 'yes';
    if (unitId) {
      const row = await scope.unitAmenities.q().where({ unitId, kind }).first();
      if (state === 'auto') {
        if (row) await scope.unitAmenities.q().where({ id: row.id }).delete();
      } else if (row) await scope.unitAmenities.q().where({ id: row.id }).update({ enabled });
      else await scope.unitAmenities.create({ unitId, kind, enabled });
    } else {
      const row = await scope.buildingAmenities.q().where({ buildingId, kind }).first();
      if (state === 'auto') {
        if (row) await scope.buildingAmenities.q().where({ id: row.id }).delete();
      } else if (row) await scope.buildingAmenities.q().where({ id: row.id }).update({ enabled });
      else await scope.buildingAmenities.create({ buildingId, kind, enabled });
    }
  }
  toBuilding(buildingId, unitId ? '#apartments' : '#amenities');
}

export async function addFacilityAction(formData: FormData) {
  const buildingId = str(formData, 'buildingId', 40);
  const { scope } = await requireStaffBuilding(buildingId);
  const kind = str(formData, 'kind', 20);
  const name = str(formData, 'name', 80);
  if (!name || !isAmenityKind(kind)) toBuilding(buildingId, '#facilities');
  if (!(await scope.facilities.q().where({ buildingId, name }).first())) {
    await scope.facilities.create({ buildingId, kind, name, description: str(formData, 'description', 240) || null, ...readRules(formData, kind) });
  }
  toBuilding(buildingId, '#facilities');
}

export async function saveFacilityAction(formData: FormData) {
  const buildingId = str(formData, 'buildingId', 40);
  const { scope } = await requireStaffBuilding(buildingId);
  const id = str(formData, 'id', 40);
  const facility = (await scope.facilities.q().where({ id, buildingId }).first()) as FacilityRow | null;
  if (facility) {
    await scope.facilities.q().where({ id }).update({
      name: str(formData, 'name', 80) || facility.name,
      description: str(formData, 'description', 240) || null,
      ...readRules(formData, facility.kind, facility),
    });
  }
  toBuilding(buildingId, '#facilities');
}

// Deleting a facility removes its bookings and parking claim by cascade.
export async function removeFacilityAction(formData: FormData) {
  const buildingId = str(formData, 'buildingId', 40);
  const { scope } = await requireStaffBuilding(buildingId);
  const id = str(formData, 'id', 40);
  await scope.facilities.q().where({ id, buildingId }).delete();
  toBuilding(buildingId, '#facilities');
}

export async function staffCancelBookingAction(formData: FormData) {
  const buildingId = str(formData, 'buildingId', 40);
  const { scope } = await requireStaffBuilding(buildingId);
  const id = str(formData, 'id', 40);
  const booking = await scope.bookings.q().where({ id }).include('facility', (f) => f).first();
  if (booking?.facility?.buildingId === buildingId) await deleteBooking(scope, booking.id);
  toBuilding(buildingId, '#bookings');
}

export async function addResidentAction(formData: FormData) {
  const access = await requireStaff();
  const { scope } = access;
  const name = str(formData, 'name');
  const email = str(formData, 'email', 254).toLowerCase();
  const buildingId = str(formData, 'buildingId', 40);
  const code = str(formData, 'unit', 40);
  const building = buildingId ? await scope.buildings.q().where({ id: buildingId }).first() : null;
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !building || !code || !canSeeBuilding(access, building.id)) redirect('/manage/residents?error=1');
  const unit = (await scope.units.q().where({ buildingId: building.id, code }).first()) ?? (await scope.units.create({ buildingId: building.id, code }));
  const existing = await scope.residents.q().where({ email }).first();
  if (existing) await scope.residents.q().where({ id: existing.id }).update({ name, unitId: unit.id, status: 'active' });
  else await scope.residents.create({ name, email, unitId: unit.id });
  revalidatePath('/manage/residents');
  redirect('/manage/residents?ok=1');
}

// Removes the resident and everything they own (bookings, invitations,
// parking claim, devices, sign-in methods) by cascade.
export async function removeResidentAction(formData: FormData) {
  const access = await requireStaff();
  const id = str(formData, 'id', 40);
  const resident = await access.scope.residents.q().where({ id }).first();
  if (resident) {
    const unit = resident.unitId ? await access.scope.units.q().where({ id: resident.unitId }).first() : null;
    if (access.buildingIds === null || (unit && canSeeBuilding(access, unit.buildingId))) await access.scope.residents.q().where({ id }).delete();
  }
  revalidatePath('/manage/residents');
  redirect('/manage/residents');
}

export async function importCsvAction(formData: FormData) {
  const access = await requireStaff();
  const file = formData.get('file');
  let text = str(formData, 'csv', 2_000_000);
  if (file instanceof File && file.size > 0) text = (await file.text()).slice(0, 2_000_000);
  const parsed = parseResidentsCsv(text);
  const result = await importResidents(access.scope, parsed.rows, access.buildingIds);
  const params = new URLSearchParams({
    imported: `${result.created},${result.updated},${result.skipped + parsed.errors.length}`,
  });
  if (parsed.errors.length) params.set('errors', parsed.errors.slice(0, 10).map((e) => `${e.line}: ${e.reason}`).join(' | '));
  revalidatePath('/manage/residents');
  redirect(`/manage/residents?${params.toString()}`);
}
