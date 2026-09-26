import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '../../../../prisma/db';
import { orgScope } from '../../../../lib/tenant/scope';
import { loadOrgBySlug } from '../../../../lib/tenant/load';
import { MESSAGES } from '../../../../lib/i18n/messages';
import { fmtTime } from '../../../../lib/booking/format';
import { notifyResident } from '../../../../lib/booking/notify';

// Earliest reminder lead time. Run hourly, so each booking is reminded 30 to
// 90 minutes before it starts.
const LEAD_MS = 90 * 60 * 1000;
const MIN_MS = 30 * 60 * 1000;

function authorized(request: Request): boolean {
  const secret = process.env['CRON_SECRET'];
  const given = request.headers.get('authorization') ?? '';
  if (!secret) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Call hourly with `Authorization: Bearer $CRON_SECRET` (Render cron job).
// Sends to the booker and accepted guests, once per booking.
export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse('Not authorized', { status: 401 });
  const now = Date.now();
  const from = new Date(now + MIN_MS - 60 * 60 * 1000).toISOString();
  const to = new Date(now + LEAD_MS).toISOString();
  let reminded = 0;

  // Organizations are platform level; each one's bookings go through its scope.
  for (const row of await db.orm.public.Organization.where((o) => o.status.neq('suspended')).all()) {
    const org = await loadOrgBySlug(row.slug);
    if (!org) continue;
    const scope = orgScope(org.id);
    const due = await scope.bookings
      .q()
      .where((b) => b.startsAt.gte(from))
      .where((b) => b.startsAt.lte(to))
      .where((b) => b.reminderSentAt.isNull())
      .include('facility', (f) => f)
      .all();
    for (const b of due) {
      if (new Date(b.startsAt).getTime() < now) continue;
      // Claim first, so an overlapping run cannot send twice.
      await scope.bookings.q().where({ id: b.id }).update({ reminderSentAt: new Date().toISOString() });
      const guests = await scope.participants.q().where({ bookingId: b.id, status: 'accepted' }).all();
      for (const residentId of [b.residentId, ...guests.map((g) => g.residentId)]) {
        const resident = await scope.residents.q().where({ id: residentId }).first();
        const locale = resident?.locale === 'en' || (!resident?.locale && org.defaultLocale === 'en') ? 'en' : 'fi';
        const body = MESSAGES[locale]['reminder.body'].replace('{name}', b.facility!.name).replace('{time}', fmtTime(b.startsAt, locale, org.timezone));
        await notifyResident(org, scope, residentId, { title: b.facility!.name, body, url: '/book' }).catch(() => 'none');
      }
      reminded += 1;
    }
  }
  return NextResponse.json({ reminded });
}
