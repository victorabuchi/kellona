// Proves against the real database that orgScope(A) can never read, change or
// delete organization B's rows. Creates two scratch organizations and deletes
// them (and, by cascade, everything they own) at the end.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/prisma/db';
import { orgScope, ORG_MODELS, type OrgScope } from '../src/lib/tenant/scope';

type Seeded = { orgId: string; ids: Record<string, string> };

const tag = randomUUID().slice(0, 8);
let A: Seeded;
let B: Seeded;

async function seedOrg(label: string): Promise<Seeded> {
  const org = await db.orm.public.Organization.create({ slug: `scratch-${label}-${tag}`, name: `Scratch ${label}`, shortName: label });
  const s = orgScope(org.id);
  const building = await s.buildings.create({ name: `B ${label}` });
  const unit = await s.units.create({ buildingId: building.id, code: 'A1' });
  const resident = await s.residents.create({ name: `R ${label}`, email: `r-${label}-${tag}@example.test`, unitId: unit.id });
  const guest = await s.residents.create({ name: `G ${label}`, email: `g-${label}-${tag}@example.test`, unitId: unit.id });
  const staff = await s.staff.create({ name: `S ${label}`, email: `s-${label}-${tag}@example.test` });
  const staffBuilding = await s.staffBuildings.create({ staffId: staff.id, buildingId: building.id });
  const identity = await s.identities.create({ provider: 'email', subject: resident.email, residentId: resident.id });
  const facility = await s.facilities.create({ buildingId: building.id, kind: 'laundry', name: `M ${label}` });
  const parking = await s.facilities.create({ buildingId: building.id, kind: 'parking', name: `P ${label}` });
  const buildingAmenity = await s.buildingAmenities.create({ buildingId: building.id, kind: 'sauna', enabled: false });
  const unitAmenity = await s.unitAmenities.create({ unitId: unit.id, kind: 'laundry', enabled: true });
  const start = new Date(Date.now() + 86_400_000);
  start.setMinutes(0, 0, 0);
  const booking = await s.bookings.create({
    facilityId: facility.id,
    residentId: resident.id,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
  });
  const participant = await s.participants.create({ bookingId: booking.id, residentId: guest.id });
  const claim = await s.parkingClaims.create({ facilityId: parking.id, residentId: resident.id });
  const push = await s.pushSubscriptions.create({ residentId: resident.id, endpoint: `https://push.test/${label}-${tag}`, p256dh: 'x', auth: 'y' });
  const text = await s.texts.create({ locale: 'en', key: 'signin.title', value: `Hello ${label}` });
  const brand = await s.brand.create({ primaryColor: '#123456' });
  const domain = await s.domains.create({ host: `${label}-${tag}.scratch.test` });
  const release = await s.releases.create({ facilityId: facility.id, residentId: resident.id, startsAt: start.toISOString(), endsAt: start.toISOString() });
  const watch = await s.watches.create({ facilityId: facility.id, residentId: guest.id, startsAt: start.toISOString() });
  const contact = await s.contacts.create({ title: `Contact ${label}`, phone: '+358000' });
  const help = await s.help.create({ title: `Help ${label}`, body: 'Body' });
  const report = await s.reports.create({ residentId: resident.id, facilityId: facility.id, message: `Broken ${label}` });
  return {
    orgId: org.id,
    ids: {
      buildings: building.id,
      units: unit.id,
      residents: resident.id,
      staff: staff.id,
      staffBuildings: staffBuilding.id,
      identities: identity.id,
      facilities: facility.id,
      buildingAmenities: buildingAmenity.id,
      unitAmenities: unitAmenity.id,
      bookings: booking.id,
      participants: participant.id,
      parkingClaims: claim.id,
      pushSubscriptions: push.id,
      texts: text.id,
      brand: brand.id,
      domains: domain.id,
      releases: release.id,
      watches: watch.id,
      contacts: contact.id,
      help: help.id,
      reports: report.id,
    },
  };
}

type Accessor = { q: () => { all(): PromiseLike<Array<{ id: string; organizationId: string }>>; where(w: object): Chain } };
type Chain = {
  first(): Promise<{ id: string } | null>;
  update(d: object): Promise<unknown>;
  delete(): Promise<unknown>;
  where(w: object): Chain;
};
const accessor = (s: OrgScope, key: string) => (s as unknown as Record<string, Accessor>)[key]!;

before(async () => {
  A = await seedOrg('a');
  B = await seedOrg('b');
});

after(async () => {
  for (const id of [A?.orgId, B?.orgId]) if (id) await db.orm.public.Organization.where({ id }).delete();
  const left = await db.orm.public.Organization.where((o) => o.slug.like(`scratch-%-${tag}`)).all();
  assert.equal(left.length, 0, 'scratch organizations were not cleaned up');
  await db.close();
});

test('every organization owned model is covered by the fixture', () => {
  assert.equal(Object.keys(A.ids).length, ORG_MODELS.length);
});

test('listing through a scope returns only that organization', async () => {
  const scopeA = orgScope(A.orgId);
  for (const key of Object.keys(A.ids)) {
    const rows = await accessor(scopeA, key).q().all();
    assert.ok(rows.length > 0, `${key}: expected rows for A`);
    assert.ok(rows.every((r) => r.organizationId === A.orgId), `${key}: leaked rows from another organization`);
    assert.ok(!rows.some((r) => r.id === B.ids[key]), `${key}: B's row visible from A`);
  }
});

test("looking up another organization's id finds nothing", async () => {
  const scopeA = orgScope(A.orgId);
  for (const [key, id] of Object.entries(B.ids)) {
    assert.equal(await accessor(scopeA, key).q().where({ id }).first(), null, `${key}: B's row found through A`);
  }
});

test("update and delete through a scope cannot touch another organization's rows", async () => {
  const scopeA = orgScope(A.orgId);
  const scopeB = orgScope(B.orgId);
  await scopeA.buildings.q().where({ id: B.ids['buildings']! }).update({ name: 'hijacked' });
  await scopeA.residents.q().where({ id: B.ids['residents']! }).update({ email: 'hijacked@example.test' });
  for (const [key, id] of Object.entries(B.ids)) await accessor(scopeA, key).q().where({ id }).delete();

  const building = await scopeB.buildings.q().where({ id: B.ids['buildings']! }).first();
  assert.equal(building?.name, 'B b');
  const resident = await scopeB.residents.q().where({ id: B.ids['residents']! }).first();
  assert.equal(resident?.email, `r-b-${tag}@example.test`);
  for (const [key, id] of Object.entries(B.ids)) {
    assert.ok(await accessor(scopeB, key).q().where({ id }).first(), `${key}: B's row was deleted through A`);
  }
});

test('create always stamps the scope organization, even if data says otherwise', async () => {
  const scopeA = orgScope(A.orgId);
  const row = await scopeA.buildings.create({ name: `sneaky-${tag}`, organizationId: B.orgId } as never);
  assert.equal((row as { organizationId: string }).organizationId, A.orgId);
});

test('a scope needs an organization id', () => {
  assert.throws(() => orgScope(''));
});
