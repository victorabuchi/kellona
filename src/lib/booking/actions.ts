'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireResident } from '../auth/access';
import { getT } from '../i18n';
import { createBookings, deleteBooking, loadAmenities, residentContext, resolveParticipants, type FacilityRow } from './engine';
import { isAmenityKind, MAX_REPEAT_WEEKS } from './kinds';
import { notifyInvitees } from './notify';
import { canCancel } from './rules';
import { fmtWhen } from './format';

function facilityUrl(facilityId: string, params: Record<string, string>): string {
  return `/book/f/${facilityId}?${new URLSearchParams(params).toString()}`;
}

function intIn(formData: FormData, name: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(String(formData.get(name) ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function bookAction(formData: FormData) {
  const { org, scope, viewer } = await requireResident();
  const facilityId = String(formData.get('facilityId') ?? '');
  const day = String(formData.get('day') ?? '');
  const ctx = await residentContext(scope, viewer.id);
  if (!ctx) redirect('/book');

  const facility = (await scope.facilities.q().where({ id: facilityId }).first()) as FacilityRow | null;
  if (!facility || facility.buildingId !== ctx.buildingId || !isAmenityKind(facility.kind) || facility.kind === 'parking') {
    redirect(facilityUrl(facilityId, { day, error: 'notFound' }));
  }
  const amenities = await loadAmenities(scope, ctx.buildingId, ctx.unitId);
  if (!amenities.find((a) => a.kind === facility.kind)?.available) redirect(facilityUrl(facilityId, { day, error: 'notAvailable' }));

  let participantIds: string[] = [];
  if (facility.capacity > 1) {
    const ids = formData.getAll('participants').map(String).filter(Boolean);
    const people = await resolveParticipants(scope, ctx, { ids, wholeApartment: formData.get('inviteApartment') === '1' }, facility.capacity);
    if (!people.ok) redirect(facilityUrl(facilityId, { day, error: people.reason }));
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
    repeatWeeks: intIn(formData, 'repeatWeeks', 1, Math.max(1, Math.min(MAX_REPEAT_WEEKS, (facility as { maxRepeatWeeks?: number }).maxRepeatWeeks ?? 1)), 1),
    participantIds,
    note: String(formData.get('note') ?? '').trim().slice(0, 200) || null,
    now: Date.now(),
  });
  if (result.error) redirect(facilityUrl(facilityId, { day, error: result.error }));

  if (participantIds.length && result.created[0]) {
    const { t } = await getT(org);
    await notifyInvitees(org, scope, participantIds, `${ctx.name}: ${facility.name}, ${fmtWhen(start.toISOString(), org.defaultLocale === 'en' ? 'en' : 'fi', org.timezone)}`, t('book.invites'));
  }
  revalidatePath('/book');
  const params: Record<string, string> = { day, ok: 'booked' };
  if (result.skipped) params['skipped'] = String(result.skipped);
  redirect(facilityUrl(facilityId, params));
}

function backTo(formData: FormData, fallback = '/book'): string {
  const to = String(formData.get('returnTo') ?? '');
  return to.startsWith('/book') ? to : fallback;
}

function withParam(url: string, key: string, value: string): string {
  const [path, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.set(key, value);
  return `${path}?${params.toString()}`;
}

// Residents cancel until the facility's cutoff; staff can always cancel.
export async function cancelBookingAction(formData: FormData) {
  const { scope, viewer } = await requireResident();
  const bookingId = String(formData.get('bookingId') ?? '');
  const booking = await scope.bookings.q().where({ id: bookingId, residentId: viewer.id }).include('facility', (f) => f).first();
  if (booking && !canCancel(booking.startsAt, booking.facility?.cancelCutoffMinutes ?? 0, Date.now())) {
    redirect(withParam(backTo(formData), 'error', 'tooLate'));
  }
  if (booking) await deleteBooking(scope, booking.id);
  revalidatePath('/book');
  redirect(backTo(formData));
}

// Cancels a standing weekly turn from this week onward. Weeks already inside
// the cancellation cutoff stay booked.
export async function cancelSeriesAction(formData: FormData) {
  const { scope, viewer } = await requireResident();
  const bookingId = String(formData.get('bookingId') ?? '');
  const first = await scope.bookings.q().where({ id: bookingId, residentId: viewer.id }).include('facility', (f) => f).first();
  if (first?.seriesId) {
    const from = new Date(first.startsAt).getTime();
    const cutoff = first.facility?.cancelCutoffMinutes ?? 0;
    const series = await scope.bookings.q().where({ seriesId: first.seriesId, residentId: viewer.id }).all();
    for (const row of series) {
      if (new Date(row.startsAt).getTime() >= from && canCancel(row.startsAt, cutoff, Date.now())) await deleteBooking(scope, row.id);
    }
  }
  revalidatePath('/book');
  redirect(backTo(formData));
}

// Accept or decline an invitation, or leave a group booking already accepted.
export async function respondInviteAction(formData: FormData) {
  const { scope, viewer } = await requireResident();
  const bookingId = String(formData.get('bookingId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const row = await scope.participants.q().where({ bookingId, residentId: viewer.id }).first();
  if (row && (decision === 'accept' || decision === 'decline')) {
    await scope.participants.q().where({ id: row.id }).update({ status: decision === 'accept' ? 'accepted' : 'declined' });
  }
  revalidatePath('/book');
  redirect('/book');
}

export async function claimParkingAction(formData: FormData) {
  const { scope, viewer } = await requireResident();
  const facilityId = String(formData.get('facilityId') ?? '');
  const ctx = await residentContext(scope, viewer.id);
  if (!ctx) redirect('/book');
  if (await scope.parkingClaims.q().where({ residentId: viewer.id }).first()) redirect('/book/parking?error=already');
  const spot = await scope.facilities.q().where({ id: facilityId, kind: 'parking', buildingId: ctx.buildingId }).first();
  const amenities = await loadAmenities(scope, ctx.buildingId, ctx.unitId);
  if (!spot || !amenities.find((a) => a.kind === 'parking')?.available) redirect('/book/parking?error=notAvailable');
  let taken = false;
  try {
    await scope.parkingClaims.create({ facilityId: spot.id, residentId: viewer.id });
  } catch {
    taken = true;
  }
  if (taken) redirect('/book/parking?error=gone');
  revalidatePath('/book');
  redirect('/book/parking');
}

export async function releaseParkingAction() {
  const { scope, viewer } = await requireResident();
  const claim = await scope.parkingClaims.q().where({ residentId: viewer.id }).first();
  if (claim) await scope.parkingClaims.q().where({ id: claim.id }).delete();
  revalidatePath('/book');
  redirect('/book/parking');
}
