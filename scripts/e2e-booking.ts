// End to end booking checks against a running dev server (npm run dev), by
// posting the real forms. Builds a scratch organization with two buildings,
// signs in as the super-admin, uses "view as" for residents, and deletes
// everything afterwards.
// Usage: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD='...' TZ=Europe/Helsinki npx tsx scripts/e2e-booking.ts
import { randomUUID } from 'node:crypto';
import { db } from '../src/prisma/db';
import { orgScope } from '../src/lib/tenant/scope';
import { DEFAULT_RULES } from '../src/lib/booking/kinds';
import { addDays, at, dayStart, formatDay, weekStart } from '../src/lib/booking/time';
import { actionIn, http, param } from './lib/http';

const adminEmail = process.env['E2E_ADMIN_EMAIL'] ?? '';
const adminPassword = process.env['E2E_ADMIN_PASSWORD'] ?? '';
if (!adminEmail || !adminPassword) throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : `: ${detail}`}`);
  if (!ok) failures += 1;
}

const started = new Date().toISOString();
const tag = randomUUID().slice(0, 8);
const slug = `scratch-book-${tag}`;
const host = `${slug}.localhost`;
const org = await db.orm.public.Organization.create({ slug, name: 'Scratch Booking', shortName: 'Scratch', defaultLocale: 'en' });
const s = orgScope(org.id);

try {
  // Fixture: building A with two apartments, building B with one.
  const bA = await s.buildings.create({ name: 'A' });
  const bB = await s.buildings.create({ name: 'B' });
  const u1 = await s.units.create({ buildingId: bA.id, code: 'A1' });
  const u2 = await s.units.create({ buildingId: bA.id, code: 'A2' });
  const u3 = await s.units.create({ buildingId: bB.id, code: 'B1' });
  const mk = (name: string, unitId: string) => s.residents.create({ name, email: `${name.toLowerCase()}-${tag}@example.test`, unitId });
  const r1 = await mk('R1', u1.id);
  const r2 = await mk('R2', u1.id);
  const r3 = await mk('R3', u2.id);
  const r4 = await mk('R4', u3.id);
  const r5 = await mk('R5', u2.id);
  const far = { advanceDays: 40 };
  const laundry = await s.facilities.create({ buildingId: bA.id, kind: 'laundry', name: 'M1', ...DEFAULT_RULES.laundry });
  const sauna = await s.facilities.create({ buildingId: bA.id, kind: 'sauna', name: 'Sauna', ...DEFAULT_RULES.sauna, capacity: 3, ...far });
  const room = await s.facilities.create({ buildingId: bA.id, kind: 'common_room', name: 'Room', ...DEFAULT_RULES.common_room, capacity: 4, ...far });
  const p1 = await s.facilities.create({ buildingId: bA.id, kind: 'parking', name: 'P1', ...DEFAULT_RULES.parking });
  const p2 = await s.facilities.create({ buildingId: bA.id, kind: 'parking', name: 'P2', ...DEFAULT_RULES.parking });
  await s.unitAmenities.create({ unitId: u2.id, kind: 'sauna', enabled: false });

  // Super-admin: sign in on the platform host, then Open hands over to the scratch org.
  const signin = await http('GET', 'localhost', '/login');
  const login = await http('POST', 'localhost', '/login', { form: { [actionIn(signin.body, 'name="password"')]: '', email: adminEmail, password: adminPassword } });
  check('admin signs in on Kellona and lands on /platform', login.status === 303 && login.location.endsWith('/platform') && Boolean(login.cookie), `${login.status} ${login.location}`);
  const open = await http('GET', 'localhost', `/platform/open/${org.id}`, { cookie: login.cookie });
  const handoffUrl = new URL(open.location);
  check('Open redirects to the organization address', open.status === 307 && handoffUrl.hostname === host, open.location);
  const handoff = await http('GET', host, handoffUrl.pathname + handoffUrl.search);
  const admin = handoff.cookie!;
  check('handoff signs the admin in there and lands on /manage', handoff.status === 307 && handoff.location.endsWith('/manage') && Boolean(admin), `${handoff.status} ${handoff.location}`);
  const reuse = await http('GET', host, handoffUrl.pathname + handoffUrl.search);
  check('handoff token works once', reuse.location.includes('error=link'), reuse.location);

  for (const path of ['/manage', `/manage/b/${bA.id}`, '/manage/residents', '/account', `/platform/o/${org.id}`]) {
    const r = await http('GET', host, path, { cookie: admin });
    check(`staff page ${path} loads`, r.status === 200 && !r.body.includes('Application error'), String(r.status));
  }

  // View as a resident.
  const residentsPage = await http('GET', host, '/manage/residents', { cookie: admin });
  const viewAs = async (id: string) => {
    const r = await http('POST', host, '/manage/residents', { cookie: admin, form: { [actionIn(residentsPage.body, `name="residentId" value="${id}"`)]: '', residentId: id } });
    return r.cookie!;
  };
  const c1 = await viewAs(r1.id);
  const c2 = await viewAs(r2.id);
  const c3 = await viewAs(r3.id);
  check('view as resident gives resident sessions', Boolean(c1 && c2 && c3));

  const hub1 = await http('GET', host, '/book', { cookie: c1 });
  check('hub shows laundry, sauna, parking and the room', ['Laundry', 'Sauna', 'Parking', 'Room'].every((w) => hub1.body.includes(w)), hub1.body.slice(0, 200));
  check('hub shows the viewing-as banner', hub1.body.includes('You are viewing the app as R1'));
  const hub3 = await http('GET', host, '/book', { cookie: c3 });
  check('apartment exception hides the sauna for A2', !hub3.body.includes(`/book/f/${sauna.id}`));

  // Laundry: book, clash, past, too far.
  const tomorrow = addDays(dayStart(new Date()), 1);
  const t10 = at(tomorrow, 10);
  const laundryPage = await http('GET', host, `/book/f/${laundry.id}?day=${formatDay(tomorrow)}&pick=${encodeURIComponent(t10.toISOString())}`, { cookie: c1 });
  const bookId = actionIn(laundryPage.body, 'name="startsAt"');
  const book = (cookie: string, facilityId: string, start: Date, extra: Record<string, string | string[]> = {}) =>
    http('POST', host, `/book/f/${facilityId}`, { cookie, form: { [bookId]: '', facilityId, day: formatDay(start), startsAt: start.toISOString(), hours: '1', repeatWeeks: '1', ...extra } });

  const ok = await book(c1, laundry.id, t10);
  check('laundry slot booked', param(ok.location, 'ok') === 'booked', ok.location);
  const clash = await book(c2, laundry.id, t10);
  check('same slot is taken for someone else', param(clash.location, 'error') === 'taken', clash.location);
  const past = await book(c2, laundry.id, at(addDays(dayStart(new Date()), -1), 10));
  check('past time rejected', param(past.location, 'error') === 'past', past.location);
  const tooFar = await book(c2, laundry.id, at(addDays(dayStart(new Date()), 10), 10));
  check('beyond days ahead rejected', param(tooFar.location, 'error') === 'tooFar', tooFar.location);
  const closed = await book(c2, laundry.id, at(tomorrow, 23));
  check('outside opening hours rejected', param(closed.location, 'error') === 'closed', closed.location);

  // Sauna: weekly limit is 4 h (two turns) per week.
  const nextWeek = addDays(weekStart(new Date()), 7);
  const sa = await book(c1, sauna.id, at(nextWeek, 16), { hours: '2' });
  const sb = await book(c1, sauna.id, at(addDays(nextWeek, 1), 16), { hours: '2' });
  const sc = await book(c1, sauna.id, at(addDays(nextWeek, 2), 16), { hours: '2' });
  check('two sauna turns fit the week', param(sa.location, 'ok') === 'booked' && param(sb.location, 'ok') === 'booked', `${sa.location} ${sb.location}`);
  check('third turn hits the weekly limit', param(sc.location, 'error') === 'weekly', sc.location);
  const notTurn = await book(c2, sauna.id, at(addDays(nextWeek, 3), 17), { hours: '2' });
  check('sauna only at fixed turn hours', param(notTurn.location, 'error') === 'closed', notTurn.location);
  const excluded = await book(c3, sauna.id, at(addDays(nextWeek, 3), 18), { hours: '2' });
  check('apartment without sauna cannot book it', param(excluded.location, 'error') === 'notAvailable', excluded.location);

  // Group booking in the week after.
  const week2 = addDays(nextWeek, 7);
  const outsider = await book(c1, sauna.id, at(week2, 18), { hours: '2', participants: [r4.id] });
  check('residents of another building cannot be invited', param(outsider.location, 'error') === 'outsider', outsider.location);
  const tooMany = await book(c1, sauna.id, at(week2, 18), { hours: '2', inviteApartment: '1', participants: [r3.id, r5.id] });
  check('group larger than capacity rejected', param(tooMany.location, 'error') === 'capacity', tooMany.location);
  const group = await book(c1, sauna.id, at(week2, 18), { hours: '2', participants: [r2.id, r3.id] });
  check('group sauna booked', param(group.location, 'ok') === 'booked', group.location);
  const groupBooking = await s.bookings.q().where({ facilityId: sauna.id, startsAt: at(week2, 18).toISOString() }).first();
  const hub2 = await http('GET', host, '/book', { cookie: c2 });
  check('invitee sees the invitation', hub2.body.includes('R1 invited you'));
  await http('POST', host, '/book', { cookie: c2, form: { [actionIn(hub2.body, 'name="decision"')]: '', bookingId: groupBooking!.id, decision: 'accept' } });
  const accepted = await s.participants.q().where({ bookingId: groupBooking!.id, residentId: r2.id }).first();
  check('invitee accepts', accepted?.status === 'accepted', accepted?.status);

  // Weekly standing turn on the room, with one clashing week.
  const wed = addDays(nextWeek, 2);
  await book(c3, room.id, at(addDays(wed, 14), 18), { hours: '2' });
  const series = await book(c1, room.id, at(wed, 18), { hours: '2', repeatWeeks: '4' });
  check('weekly series books three weeks and skips the clash', param(series.location, 'ok') === 'booked' && param(series.location, 'skipped') === '1', series.location);
  const seriesRows = (await s.bookings.q().where({ facilityId: room.id, residentId: r1.id }).orderBy((b) => b.startsAt.asc()).all());
  check('series rows share a series id', seriesRows.length === 3 && new Set(seriesRows.map((r) => r.seriesId)).size === 1 && Boolean(seriesRows[0]!.seriesId));
  check('series keeps the same local hour', seriesRows.every((r) => new Date(r.startsAt).getHours() === 18));
  const hub1b = await http('GET', host, '/book', { cookie: c1 });
  await http('POST', host, '/book', { cookie: c1, form: { [actionIn(hub1b.body, 'Cancel this and later weeks')]: '', bookingId: seriesRows[1]!.id } });
  const left = await s.bookings.q().where({ facilityId: room.id, residentId: r1.id }).all();
  check('cancel series from week two keeps only week one', left.length === 1 && left[0]!.id === seriesRows[0]!.id, String(left.length));

  // Parking.
  const parking = await http('GET', host, '/book/parking', { cookie: c1 });
  const claimId = actionIn(parking.body, 'name="facilityId"');
  await http('POST', host, '/book/parking', { cookie: c1, form: { [claimId]: '', facilityId: p1.id } });
  const gone = await http('POST', host, '/book/parking', { cookie: c2, form: { [claimId]: '', facilityId: p1.id } });
  check('a claimed spot cannot be taken', param(gone.location, 'error') === 'gone', gone.location);
  const second = await http('POST', host, '/book/parking', { cookie: c1, form: { [claimId]: '', facilityId: p2.id } });
  check('one spot per resident', param(second.location, 'error') === 'already', second.location);
  const parking2 = await http('GET', host, '/book/parking', { cookie: c1 });
  await http('POST', host, '/book/parking', { cookie: c1, form: { [actionIn(parking2.body, 'Release')]: '' } });
  check('release frees the spot', !(await s.parkingClaims.q().where({ residentId: r1.id }).first()));

  // Calendar export.
  const laundryBooking = await s.bookings.q().where({ facilityId: laundry.id, residentId: r1.id }).first();
  const ics = await http('GET', host, `/book/ics/${laundryBooking!.id}`, { cookie: c1 });
  check('calendar file for own booking', ics.status === 200 && ics.type.startsWith('text/calendar') && ics.body.includes('BEGIN:VEVENT'));
  const icsOther = await http('GET', host, `/book/ics/${laundryBooking!.id}`, { cookie: c3 });
  check("no calendar file for someone else's booking", icsOther.status === 404);

  // Staff: cancel a booking, add a facility, switch a kind off for the building.
  const buildingPage = await http('GET', host, `/manage/b/${bA.id}`, { cookie: admin });
  await http('POST', host, `/manage/b/${bA.id}`, { cookie: admin, form: { [actionIn(buildingPage.body, `name="id" value="${laundryBooking!.id}"`)]: '', buildingId: bA.id, id: laundryBooking!.id } });
  check('staff cancels a booking', !(await s.bookings.q().where({ id: laundryBooking!.id }).first()));
  await http('POST', host, `/manage/b/${bA.id}`, { cookie: admin, form: { [actionIn(buildingPage.body, 'name="kind"')]: '', buildingId: bA.id, kind: 'grill', name: 'Grill' } });
  const grill = await s.facilities.q().where({ buildingId: bA.id, name: 'Grill' }).first();
  check('staff adds a facility with default rules', grill?.kind === 'grill' && grill.closeHour === DEFAULT_RULES.grill.closeHour);
  const hubGrill = await http('GET', host, '/book', { cookie: c1 });
  check('new facility appears for residents', hubGrill.body.includes('Grill'));
  await http('POST', host, `/manage/b/${bA.id}`, { cookie: admin, form: { [actionIn(buildingPage.body, 'name="state_grill"')]: '', buildingId: bA.id, state_grill: 'no' } });
  const hubNoGrill = await http('GET', host, '/book', { cookie: c1 });
  check('building switch hides it again', !hubNoGrill.body.includes(`/book/f/${grill!.id}`));

  // CSV import (semicolon, one bad row).
  const csv = `rakennus;asunto;nimi;sähköposti\nC;C 1;Import One;one-${tag}@example.test\nC;C 2;Import Two;two-${tag}@example.test\nC;C 3;No Email;not-an-email`;
  const imp = await http('POST', host, '/manage/residents', { cookie: admin, form: { [actionIn(residentsPage.body, 'name="csv"')]: '', csv } });
  check('CSV import creates two, skips one', param(imp.location, 'imported') === '2,0,1', imp.location);
  const importedBuilding = await s.buildings.q().where({ name: 'C' }).first();
  check('CSV import created the building', Boolean(importedBuilding));

  // Cross organization: a resident session does not work on another organization.
  const cross = await http('GET', 'demo-north.localhost', '/book', { cookie: c1 });
  check('resident session rejected on another organization', cross.status === 307, String(cross.status));

  // Reminders.
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  const due = await s.bookings.create({ facilityId: room.id, residentId: r2.id, startsAt: soon.toISOString(), endsAt: new Date(soon.getTime() + 3_600_000).toISOString() });
  const denied = await http('GET', host, '/api/cron/reminders');
  check('cron needs the secret', denied.status === 401);
  const cronAuth = { Authorization: `Bearer ${process.env['CRON_SECRET']}` };
  const run = await fetchCron(cronAuth);
  const after = await s.bookings.q().where({ id: due.id }).first();
  check('cron marks the due booking as reminded', run >= 1 && Boolean(after?.reminderSentAt), String(run));
  const again = await s.bookings.q().where({ id: due.id }).first();
  await fetchCron(cronAuth);
  const after2 = await s.bookings.q().where({ id: due.id }).first();
  check('reminder is sent once', after2?.reminderSentAt === again?.reminderSentAt);

  // Stop viewing as: back to admin.
  const stop = await http('POST', host, '/book', { cookie: c1, form: { [actionIn(hub1.body, 'Back to admin')]: '' } });
  check('stop viewing as returns to admin', stop.location.endsWith('/manage/residents') && Boolean(stop.cookie), stop.location);
} finally {
  await db.orm.public.Organization.where({ id: org.id }).delete();
  for (const row of await db.orm.public.LoginToken.where({ email: adminEmail }).where((t) => t.createdAt.gte(started)).all()) {
    await db.orm.public.LoginToken.where({ id: row.id }).delete();
  }
  check('scratch data deleted', !(await db.orm.public.Organization.where({ slug }).first()));
  await db.close();
}

async function fetchCron(headers: Record<string, string>): Promise<number> {
  const res = await fetch('http://127.0.0.1:3000/api/cron/reminders', { headers });
  const json = (await res.json()) as { reminded?: number };
  return json.reminded ?? -1;
}

console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
