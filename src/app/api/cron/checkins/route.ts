import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '../../../../prisma/db';
import { orgScope } from '../../../../lib/tenant/scope';
import { loadOrgBySlug } from '../../../../lib/tenant/load';
import { releaseMissed, remindCheckIns } from '../../../../lib/booking/release';

function authorized(request: Request): boolean {
  const secret = process.env['CRON_SECRET'];
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return Boolean(secret) && given.length === expected.length && timingSafeEqual(given, expected);
}

// Run every 5 minutes with `Authorization: Bearer $CRON_SECRET`: reminds
// bookers when check-in opens and releases bookings nobody checked in to.
export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse('Not authorized', { status: 401 });
  const now = Date.now();
  let reminded = 0;
  let released = 0;
  for (const row of await db.orm.public.Organization.where((o) => o.status.neq('suspended')).all()) {
    const org = await loadOrgBySlug(row.slug);
    if (!org) continue;
    const scope = orgScope(org.id);
    const facilities = await scope.facilities.q().where((f) => f.checkInOpensMinutes.gt(0)).all();
    if (!facilities.length) continue;
    reminded += await remindCheckIns(org, scope, facilities, now);
    released += await releaseMissed(org, scope, facilities, now);
  }
  return NextResponse.json({ reminded, released });
}
