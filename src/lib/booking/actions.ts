'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireResident } from '../auth/access';
import { deleteBooking, loadAmenities, residentContext } from './engine';
import { canCancel } from './rules';
import { performBook, performCancel, performCheckIn, performWatch, type Outcome } from './perform';

function facilityUrl(facilityId: string, params: Record<string, string>): string {
  return `/book/f/${facilityId}?${new URLSearchParams(params).toString()}`;
}


export async function bookAction(formData: FormData) {
  const facilityId = String(formData.get('facilityId') ?? '');
  const day = String(formData.get('day') ?? '');
  const result = await performBook(formData);
  if (!result.ok) redirect(facilityUrl(facilityId, { day, error: result.code }));
  revalidatePath('/book');
  const params: Record<string, string> = { day, ok: 'booked' };
  if (result.skipped) params['skipped'] = String(result.skipped);
  redirect(facilityUrl(facilityId, params));
}

// The live board calls these and stays on the page; they report what happened.
export async function boardBookAction(formData: FormData): Promise<Outcome> {
  const result = await performBook(formData);
  if (result.ok) revalidatePath('/book', 'layout');
  return result;
}

export async function boardCancelAction(bookingId: string): Promise<Outcome> {
  const result = await performCancel(bookingId);
  if (result.ok) revalidatePath('/book', 'layout');
  return result;
}

export async function boardCheckInAction(bookingId: string): Promise<Outcome> {
  const result = await performCheckIn(bookingId);
  if (result.ok) revalidatePath('/book', 'layout');
  return result;
}

export async function boardWatchAction(facilityId: string, startsAt: string): Promise<Outcome> {
  return performWatch(facilityId, startsAt);
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
  const result = await performCancel(String(formData.get('bookingId') ?? ''));
  if (!result.ok && result.code === 'tooLate') redirect(withParam(backTo(formData), 'error', 'tooLate'));
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

// The booker confirms they are using the facility, inside the check-in window.
export async function checkInAction(formData: FormData) {
  const result = await performCheckIn(String(formData.get('bookingId') ?? ''));
  const back = backTo(formData);
  if (!result.ok) redirect(withParam(back, 'error', result.code));
  revalidatePath('/book');
  redirect(withParam(back, 'ok', 'checkedin'));
}

// "Notify me if it frees up" on a slot someone else booked.
export async function watchSlotAction(formData: FormData) {
  await performWatch(String(formData.get('facilityId') ?? ''), String(formData.get('startsAt') ?? ''));
  redirect(withParam(backTo(formData), 'ok', 'watching'));
}

export async function unwatchSlotAction(formData: FormData) {
  const { scope, viewer } = await requireResident();
  const id = String(formData.get('watchId') ?? '');
  await scope.watches.q().where({ id, residentId: viewer.id }).delete();
  redirect(backTo(formData));
}
