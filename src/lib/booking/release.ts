import type { OrgContext } from '../tenant/load';
import type { OrgScope } from '../tenant/scope';
import { MESSAGES } from '../i18n/messages';
import { fmtTime } from './format';
import { notifyResident } from './notify';
import { checkInPhase, checkInWindow } from './checkin';
import { deleteBooking } from './engine';

type Fac = { id: string; name: string; checkInOpensMinutes: number; checkInGraceMinutes: number };

function localeOf(org: OrgContext, resident: { locale: string | null } | null): 'fi' | 'en' {
  return resident?.locale === 'en' || (!resident?.locale && org.defaultLocale === 'en') ? 'en' : 'fi';
}

// Releases bookings nobody checked in to, logs them as no-shows, and tells
// the residents who asked to be notified that the time is free.
export async function releaseMissed(org: OrgContext, scope: OrgScope, facilities: Fac[], now: number): Promise<number> {
  let released = 0;
  const using = facilities.filter((f) => f.checkInOpensMinutes > 0);
  if (!using.length) return 0;
  const from = new Date(now - 24 * 3_600_000).toISOString();
  const rows = await scope.bookings
    .q()
    .where((b) => b.facilityId.in(using.map((f) => f.id)))
    .where((b) => b.startsAt.gte(from))
    .where((b) => b.startsAt.lte(new Date(now).toISOString()))
    .where((b) => b.checkedInAt.isNull())
    .all();
  for (const b of rows) {
    const f = using.find((x) => x.id === b.facilityId)!;
    const phase = checkInPhase(b, f, now);
    // Ended without a check-in (for example while the server was down) also counts.
    if (phase !== 'missed' && phase !== 'over') continue;
    await deleteBooking(scope, b.id);
    await scope.releases.create({ facilityId: b.facilityId, residentId: b.residentId, startsAt: b.startsAt, endsAt: b.endsAt });
    released += 1;
    const watchers = phase === 'missed' ? await scope.watches.q().where({ facilityId: b.facilityId, startsAt: b.startsAt }).all() : [];
    for (const w of watchers) {
      const resident = await scope.residents.q().where({ id: w.residentId }).first();
      const m = MESSAGES[localeOf(org, resident)];
      await notifyResident(org, scope, w.residentId, {
        title: m['checkin.freedTitle'],
        body: m['checkin.freedBody'].replace('{name}', f.name).replace('{time}', fmtTime(b.startsAt, localeOf(org, resident), org.timezone)),
        url: `/book/f/${b.facilityId}`,
      }).catch(() => 'none');
      await scope.watches.q().where({ id: w.id }).delete();
    }
  }
  return released;
}

// Reminds bookers when their check-in window opens, once per booking.
export async function remindCheckIns(org: OrgContext, scope: OrgScope, facilities: Fac[], now: number): Promise<number> {
  let sent = 0;
  const using = facilities.filter((f) => f.checkInOpensMinutes > 0);
  if (!using.length) return 0;
  const rows = await scope.bookings
    .q()
    .where((b) => b.facilityId.in(using.map((f) => f.id)))
    .where((b) => b.startsAt.gte(new Date(now - 3_600_000).toISOString()))
    .where((b) => b.startsAt.lte(new Date(now + 4 * 3_600_000).toISOString()))
    .where((b) => b.checkedInAt.isNull())
    .where((b) => b.checkInReminderSentAt.isNull())
    .all();
  for (const b of rows) {
    const f = using.find((x) => x.id === b.facilityId)!;
    if (checkInPhase(b, f, now) !== 'open') continue;
    await scope.bookings.q().where({ id: b.id }).update({ checkInReminderSentAt: new Date(now).toISOString() });
    const resident = await scope.residents.q().where({ id: b.residentId }).first();
    const locale = localeOf(org, resident);
    const m = MESSAGES[locale];
    const closes = checkInWindow(b.startsAt, f).closes.toISOString();
    await notifyResident(org, scope, b.residentId, {
      title: m['checkin.remindTitle'],
      body: m['checkin.remindBody'].replace('{name}', f.name).replace('{time}', fmtTime(b.startsAt, locale, org.timezone)).replace('{until}', fmtTime(closes, locale, org.timezone)),
      url: `/book/f/${b.facilityId}`,
    }).catch(() => 'none');
    sent += 1;
  }
  return sent;
}
