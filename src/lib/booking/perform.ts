import { requireResident } from '../auth/access';
import { getT } from '../i18n';
import { createBookings, deleteBooking, loadAmenities, residentContext, resolveParticipants, type FacilityRow } from './engine';
import { isAmenityKind, MAX_REPEAT_WEEKS } from './kinds';
import { notifyInvitees } from './notify';
import { canCancel } from './rules';
import { checkInPhase } from './checkin';
import { fmtWhen } from './format';

// Booking operations that return a result instead of redirecting, shared by
// the plain form actions (which redirect) and the live board (which stays put).

export type Outcome = { ok: true; code: string; skipped?: number; bookingId?: string } | { ok: false; code: string };

function intIn(formData: FormData, name: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(String(formData.get(name) ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function performBook(formData: FormData): Promise<Outcome> {
  const { org, scope, viewer } = await requireResident();
  const facilityId = String(formData.get('facilityId') ?? '');
  const ctx = await residentContext(scope, viewer.id);
  if (!ctx) return { ok: false, code: 'notFound' };
  const facility = (await scope.facilities.q().where({ id: facilityId }).first()) as (FacilityRow & { outOfOrder?: boolean; maxRepeatWeeks?: number }) | null;
  if (!facility || facility.buildingId !== ctx.buildingId || !isAmenityKind(facility.kind) || facility.kind === 'parking') return { ok: false, code: 'notFound' };
  const amenities = await loadAmenities(scope, ctx.buildingId, ctx.unitId);
  if (!amenities.find((a) => a.kind === facility.kind)?.available) return { ok: false, code: 'notAvailable' };
  if (facility.outOfOrder) return { ok: false, code: 'outOfOrder' };

  let participantIds: string[] = [];
  if (facility.capacity > 1) {
    const ids = formData.getAll('participants').map(String).filter(Boolean);
    const people = await resolveParticipants(scope, ctx, { ids, wholeApartment: formData.get('inviteApartment') === '1' }, facility.capacity);
    if (!people.ok) return { ok: false, code: people.reason };
    participantIds = people.ids;
  }
  const start = new Date(String(formData.get('startsAt') ?? ''));
  const result = await createBookings({
    scope,
    ctx,
    facility,
    start,
    hours: intIn(formData, 'hours', 1, 24, facility.slotHours),
    // Never more weeks than this facility allows.
    repeatWeeks: intIn(formData, 'repeatWeeks', 1, Math.max(1, Math.min(MAX_REPEAT_WEEKS, facility.maxRepeatWeeks ?? 1)), 1),
    participantIds,
    note: String(formData.get('note') ?? '').trim().slice(0, 200) || null,
    now: Date.now(),
  });
  if (result.error) return { ok: false, code: result.error };
  if (participantIds.length && result.created[0]) {
    const { t } = await getT(org);
    await notifyInvitees(org, scope, participantIds, `${ctx.name}: ${facility.name}, ${fmtWhen(start.toISOString(), org.defaultLocale === 'en' ? 'en' : 'fi', org.timezone)}`, t('book.invites'));
  }
  return { ok: true, code: 'booked', skipped: result.skipped, bookingId: result.created[0] };
}

// Residents cancel until the facility's cutoff, or just after booking.
export async function performCancel(bookingId: string): Promise<Outcome> {
  const { scope, viewer } = await requireResident();
  const booking = await scope.bookings.q().where({ id: bookingId, residentId: viewer.id }).include('facility', (f) => f).first();
  if (!booking) return { ok: false, code: 'notFound' };
  if (!canCancel(booking.startsAt, booking.facility?.cancelCutoffMinutes ?? 0, Date.now(), booking.createdAt)) return { ok: false, code: 'tooLate' };
  await deleteBooking(scope, booking.id);
  return { ok: true, code: 'cancelled' };
}

export async function performCheckIn(bookingId: string): Promise<Outcome> {
  const { scope, viewer } = await requireResident();
  const booking = await scope.bookings.q().where({ id: bookingId, residentId: viewer.id }).include('facility', (f) => f).first();
  if (!booking?.facility) return { ok: false, code: 'notFound' };
  const phase = checkInPhase(booking, booking.facility, Date.now());
  if (phase === 'notYet') return { ok: false, code: 'checkinEarly' };
  if (phase === 'missed' || phase === 'over') return { ok: false, code: 'checkinLate' };
  if (phase === 'open') await scope.bookings.q().where({ id: booking.id }).update({ checkedInAt: new Date().toISOString() });
  return { ok: true, code: 'checkedin' };
}

export async function performWatch(facilityId: string, startsAtRaw: string): Promise<Outcome> {
  const { scope, viewer } = await requireResident();
  const startsAt = new Date(startsAtRaw);
  const ctx = await residentContext(scope, viewer.id);
  const facility = ctx ? await scope.facilities.q().where({ id: facilityId, buildingId: ctx.buildingId }).first() : null;
  if (!facility || Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) return { ok: false, code: 'notFound' };
  const iso = startsAt.toISOString();
  if (!(await scope.watches.q().where({ facilityId, startsAt: iso, residentId: viewer.id }).first())) {
    await scope.watches.create({ facilityId, startsAt: iso, residentId: viewer.id });
  }
  return { ok: true, code: 'watching' };
}
