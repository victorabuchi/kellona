import { randomUUID } from 'node:crypto';
import type { OrgScope } from '../tenant/scope';
import { AMENITY_KINDS, isAmenityKind, limitIsPerKind, type AmenityKind, type Rules } from './kinds';
import { checkSlot, hoursInWeek, overlaps, type Busy, type RuleError } from './rules';
import { weeklyStarts } from './time';

export type ResidentContext = {
  residentId: string;
  name: string;
  email: string;
  unitId: string;
  unitCode: string;
  buildingId: string;
  buildingName: string;
};

export async function residentContext(scope: OrgScope, residentId: string): Promise<ResidentContext | null> {
  const resident = await scope.residents.q().where({ id: residentId, status: 'active' }).first();
  if (!resident?.unitId) return null;
  const unit = await scope.units.q().where({ id: resident.unitId }).first();
  if (!unit) return null;
  const building = await scope.buildings.q().where({ id: unit.buildingId }).first();
  if (!building) return null;
  return {
    residentId: resident.id,
    name: resident.name,
    email: resident.email,
    unitId: unit.id,
    unitCode: unit.code,
    buildingId: building.id,
    buildingName: building.name,
  };
}

export type AmenityState = 'auto' | 'yes' | 'no';
export type AmenityStatus = { kind: AmenityKind; count: number; available: boolean; source: 'unit' | 'building' | 'auto' };

// A kind is available to an apartment when the building has one, and staff
// have not switched it off for the building or, more specifically, the apartment.
export function resolveAmenities(
  counts: Partial<Record<AmenityKind, number>>,
  buildingRows: Array<{ kind: string; enabled: boolean }>,
  unitRows: Array<{ kind: string; enabled: boolean }>,
): AmenityStatus[] {
  return AMENITY_KINDS.map((kind) => {
    const unitRow = unitRows.find((r) => r.kind === kind);
    const buildingRow = buildingRows.find((r) => r.kind === kind);
    const override = unitRow ?? buildingRow;
    const count = counts[kind] ?? 0;
    return { kind, count, available: (override ? override.enabled : true) && count > 0, source: unitRow ? 'unit' : buildingRow ? 'building' : 'auto' };
  });
}

export async function loadAmenities(scope: OrgScope, buildingId: string, unitId: string): Promise<AmenityStatus[]> {
  const [buildingRows, unitRows, facilities] = await Promise.all([
    scope.buildingAmenities.q().where({ buildingId }).all(),
    scope.unitAmenities.q().where({ unitId }).all(),
    scope.facilities.q().where({ buildingId }).all(),
  ]);
  const counts: Partial<Record<AmenityKind, number>> = {};
  for (const f of facilities) if (isAmenityKind(f.kind)) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
  return resolveAmenities(counts, buildingRows, unitRows);
}

export type Neighbour = { id: string; name: string; unitCode: string };

// Everyone else in the booker's building, split into their own apartment and the rest.
export async function loadNeighbours(scope: OrgScope, ctx: ResidentContext): Promise<{ roommates: Neighbour[]; others: Neighbour[] }> {
  const units = await scope.units.q().where({ buildingId: ctx.buildingId }).all();
  if (!units.length) return { roommates: [], others: [] };
  const byId = new Map(units.map((u) => [u.id, u]));
  const residents = await scope.residents
    .q()
    .where({ status: 'active' })
    .where((r) => r.unitId.in(units.map((u) => u.id)))
    .all();
  const roommates: Neighbour[] = [];
  const others: Neighbour[] = [];
  for (const r of residents) {
    if (r.id === ctx.residentId || !r.unitId) continue;
    const entry = { id: r.id, name: r.name, unitCode: byId.get(r.unitId)?.code ?? '' };
    (r.unitId === ctx.unitId ? roommates : others).push(entry);
  }
  const byName = (a: Neighbour, b: Neighbour) => a.name.localeCompare(b.name);
  return { roommates: roommates.sort(byName), others: others.sort(byName) };
}

// Only people in the same building can be invited, and the group (booker
// included) must fit the capacity.
export async function resolveParticipants(
  scope: OrgScope,
  ctx: ResidentContext,
  input: { ids: string[]; wholeApartment: boolean },
  capacity: number,
): Promise<{ ok: true; ids: string[] } | { ok: false; reason: 'capacity' | 'outsider' }> {
  const { roommates, others } = await loadNeighbours(scope, ctx);
  const allowed = new Set([...roommates, ...others].map((r) => r.id));
  const wanted = new Set(input.ids);
  if (input.wholeApartment) for (const r of roommates) wanted.add(r.id);
  wanted.delete(ctx.residentId);
  for (const id of wanted) if (!allowed.has(id)) return { ok: false, reason: 'outsider' };
  if (wanted.size + 1 > capacity) return { ok: false, reason: 'capacity' };
  return { ok: true, ids: [...wanted] };
}

export type FacilityRow = Rules & { id: string; kind: string; name: string; buildingId: string; description: string | null };

export type CreateResult = { created: string[]; skipped: number; error: RuleError | null };

// Books one slot, or a standing weekly turn. The first week follows every rule;
// later weeks may lie beyond the booking window but still respect clashes and
// the weekly limit, and clashing weeks are skipped and counted.
export async function createBookings(args: {
  scope: OrgScope;
  ctx: ResidentContext;
  facility: FacilityRow;
  start: Date;
  hours: number;
  repeatWeeks: number;
  participantIds: string[];
  note: string | null;
  now: number;
}): Promise<CreateResult> {
  const { scope, ctx, facility, start, hours, repeatWeeks, participantIds, note, now } = args;
  const first = checkSlot(facility, start, hours, now);
  if (first) return { created: [], skipped: 0, error: first };

  // Everything that can clash (this facility) and count toward the limit.
  const limitFacilityIds = limitIsPerKind(facility.kind)
    ? (await scope.facilities.q().where({ buildingId: facility.buildingId, kind: facility.kind }).all()).map((f) => f.id)
    : [facility.id];
  const nowIso = new Date(now - 7 * 86_400_000).toISOString();
  const rows = await scope.bookings
    .q()
    .where((b) => b.facilityId.in([...new Set([...limitFacilityIds, facility.id])]))
    .where((b) => b.endsAt.gte(nowIso))
    .all();
  const onFacility: Busy[] = rows.filter((r) => r.facilityId === facility.id).map(toBusy);
  // The resident's own bookings of this kind anywhere: nobody does two loads of
  // laundry (or two saunas) at the same time.
  const sameKindIds = (await scope.facilities.q().where({ kind: facility.kind }).all()).map((f) => f.id);
  const own: Busy[] = (
    await scope.bookings
      .q()
      .where({ residentId: ctx.residentId })
      .where((b) => b.facilityId.in(sameKindIds))
      .where((b) => b.endsAt.gte(nowIso))
      .all()
  ).map(toBusy);
  const forLimit: Busy[] = rows.map(toBusy);

  const seriesId = repeatWeeks > 1 ? randomUUID() : null;
  const created: string[] = [];
  let skipped = 0;
  let error: RuleError | null = null;
  for (const [index, s] of weeklyStarts(start, repeatWeeks).entries()) {
    const e = new Date(s);
    e.setHours(e.getHours() + hours);
    let problem: RuleError | null = index === 0 ? null : checkSlot(facility, s, hours, now, true);
    if (!problem && own.some((b) => overlaps(s.getTime(), e.getTime(), b.start, b.end))) problem = 'mine';
    if (!problem && onFacility.some((b) => overlaps(s.getTime(), e.getTime(), b.start, b.end))) problem = 'taken';
    if (!problem && hoursInWeek(forLimit, ctx.residentId, s) + hours > facility.maxHoursPerWeek) problem = 'weekly';
    if (problem) {
      if (index === 0) error = problem;
      skipped += 1;
      continue;
    }
    try {
      const row = await scope.bookings.create({
        facilityId: facility.id,
        residentId: ctx.residentId,
        startsAt: s.toISOString(),
        endsAt: e.toISOString(),
        note,
        seriesId,
      });
      created.push(row.id);
      const busy = { start: s.getTime(), end: e.getTime(), residentId: ctx.residentId };
      onFacility.push(busy);
      forLimit.push(busy);
      own.push(busy);
      for (const residentId of participantIds) await scope.participants.create({ bookingId: row.id, residentId, status: 'invited' });
    } catch {
      // Unique (facility, start) lost a race with another booker.
      if (index === 0) error = 'taken';
      skipped += 1;
    }
  }
  return { created, skipped, error: created.length ? null : error };
}

function toBusy(r: { startsAt: string; endsAt: string; residentId: string }): Busy {
  return { start: new Date(r.startsAt).getTime(), end: new Date(r.endsAt).getTime(), residentId: r.residentId };
}

export async function deleteBooking(scope: OrgScope, bookingId: string): Promise<void> {
  // ORM mutations change one row, so delete participants one by one.
  for (const p of await scope.participants.q().where({ bookingId }).all()) await scope.participants.q().where({ id: p.id }).delete();
  await scope.bookings.q().where({ id: bookingId }).delete();
}
