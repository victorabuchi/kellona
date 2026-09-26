// Creates the two demo organizations used to prove white labeling. Everything
// here is invented and marked isDemo. Real customers are created through the
// super-admin onboarding, never in code. Safe to run repeatedly.
import { db } from '../src/prisma/db';
import { orgScope, type OrgScope } from '../src/lib/tenant/scope';
import { DEFAULT_RULES, type AmenityKind } from '../src/lib/booking/kinds';

type Demo = {
  slug: string;
  name: string;
  shortName: string;
  defaultLocale: string;
  supportEmail: string;
  legalName: string;
  primaryColor: string;
  accentColor: string;
  assets: string;
  domains: string[];
};

const DEMOS: Demo[] = [
  {
    slug: 'demo-north',
    name: 'Northwind Student Homes (demo)',
    shortName: 'Northwind',
    defaultLocale: 'fi',
    supportEmail: 'support@northwind.example',
    legalName: 'Northwind Student Homes Ltd (demo)',
    primaryColor: '#1d3f6e',
    accentColor: '#f2a900',
    assets: '/demo/north',
    domains: [],
  },
  {
    slug: 'demo-lakeside',
    name: 'Lakeside Homes (demo)',
    shortName: 'Lakeside',
    defaultLocale: 'en',
    supportEmail: 'help@lakeside.example',
    legalName: 'Lakeside Homes Foundation (demo)',
    primaryColor: '#2e7d4f',
    accentColor: '#e76f51',
    assets: '/demo/lakeside',
    // A custom domain style host, to exercise domain lookup locally.
    domains: ['booking.lakeside.localhost'],
  },
];

for (const d of DEMOS) {
  const fields = {
    name: d.name,
    shortName: d.shortName,
    isDemo: true,
    status: 'active',
    defaultLocale: d.defaultLocale,
    locales: 'fi,en',
    supportEmail: d.supportEmail,
    legalName: d.legalName,
    privacyEmail: d.supportEmail,
    senderName: d.shortName,
  };
  const existing = await db.orm.public.Organization.where({ slug: d.slug }).first();
  const org = existing
    ? await db.orm.public.Organization.where({ id: existing.id }).update(fields)
    : await db.orm.public.Organization.create({ slug: d.slug, ...fields });
  if (!org) throw new Error(`Could not save ${d.slug}`);
  const scope = orgScope(org.id);

  const brand = {
    logoLightUrl: `${d.assets}/logo.svg`,
    logoDarkUrl: `${d.assets}/logo-dark.svg`,
    faviconUrl: `${d.assets}/icon.svg`,
    appIconUrl: `${d.assets}/icon.svg`,
    primaryColor: d.primaryColor,
    accentColor: d.accentColor,
    updatedAt: new Date().toISOString(),
  };
  const current = await scope.brand.q().first();
  if (current) await scope.brand.q().where({ id: current.id }).update(brand);
  else await scope.brand.create(brand);

  for (const host of d.domains) {
    if (!(await db.orm.public.OrgDomain.where({ host }).first())) {
      await scope.domains.create({ host, isPrimary: true });
    }
  }
  await seedBuilding(scope, d);
  console.log(`${d.slug}: ${org.id}`);
}

await db.close();

// Invented demo building so every feature can be tried. Idempotent.
async function seedBuilding(scope: OrgScope, d: Demo) {
  const name = `${d.shortName} Demo House`;
  const building = (await scope.buildings.q().where({ name }).first()) ?? (await scope.buildings.create({ name, address: 'Demo Street 1' }));
  const units = [];
  for (const code of ['A 1', 'A 2', 'A 3', 'B 1', 'B 2', 'B 3']) {
    units.push((await scope.units.q().where({ buildingId: building.id, code }).first()) ?? (await scope.units.create({ buildingId: building.id, code, floor: Number(code.slice(-1)) })));
  }
  const people = ['Aino Demo', 'Eero Demo', 'Liisa Demo', 'Mikko Demo', 'Sara Demo', 'Otto Demo', 'Noora Demo', 'Ville Demo'];
  for (const [i, person] of people.entries()) {
    const email = `${person.split(' ')[0]!.toLowerCase()}@${d.slug}.example.test`;
    if (!(await scope.residents.q().where({ email }).first())) await scope.residents.create({ name: person, email, unitId: units[i % units.length]!.id });
  }
  const facilities: Array<[AmenityKind, string, string | null]> = [
    ['laundry', 'Machine 1', null],
    ['laundry', 'Machine 2', null],
    ['sauna', 'Sauna', null],
    ['parking', 'P1', null],
    ['parking', 'P2', null],
    ['parking', 'P3', null],
    ['common_room', 'Common room', 'Sofa, TV and a big table.'],
    ['gym', 'Gym', null],
  ];
  for (const [i, [kind, fname, description]] of facilities.entries()) {
    if (!(await scope.facilities.q().where({ buildingId: building.id, name: fname }).first())) {
      await scope.facilities.create({ buildingId: building.id, kind, name: fname, description, sortOrder: i, ...DEFAULT_RULES[kind] });
    }
  }
  await seedBookings(scope, building.id);

  // A demo manager and a demo staff member limited to the demo house.
  const staffDomain = `${d.slug}.example.test`;
  for (const [staffName, local, role] of [['Maria Demo', 'maria', 'manager'], ['Jonas Demo', 'jonas', 'staff']] as const) {
    const email = `${local}@${staffDomain}`;
    if (await scope.staff.q().where({ email }).first()) continue;
    const member = await scope.staff.create({ name: staffName, email, role });
    if (role === 'staff') await scope.staffBuildings.create({ staffId: member.id, buildingId: building.id });
  }

  // Apartment B 3 has no sauna, to show an apartment exception.
  const b3 = units[5]!;
  if (!(await scope.unitAmenities.q().where({ unitId: b3.id, kind: 'sauna' }).first())) await scope.unitAmenities.create({ unitId: b3.id, kind: 'sauna', enabled: false });
}

// A spread of demo bookings around today so the overview charts show
// activity. Only added when the demo building has no bookings yet.
async function seedBookings(scope: OrgScope, buildingId: string) {
  const facilities = await scope.facilities.q().where({ buildingId }).all();
  const ids = facilities.map((f) => f.id);
  if (!ids.length || (await scope.bookings.q().where((b) => b.facilityId.in(ids)).first())) return;
  const residents = await scope.residents.q().all();
  const byName = (n: string) => facilities.find((f) => f.name === n);
  const plan: Array<[string, number, number, number]> = [
    // facility, day offset from today, hour, length
    ['Machine 1', -6, 9, 1], ['Machine 1', -5, 18, 1], ['Machine 2', -5, 19, 1], ['Machine 1', -3, 10, 1], ['Machine 2', -3, 11, 1],
    ['Machine 1', -2, 17, 1], ['Machine 2', -1, 20, 1], ['Machine 1', 1, 8, 1], ['Machine 2', 2, 18, 1], ['Machine 1', 3, 19, 1],
    ['Sauna', -4, 18, 2], ['Sauna', -1, 20, 2], ['Sauna', 2, 18, 2], ['Sauna', 4, 16, 2],
    ['Common room', -2, 18, 3], ['Common room', 3, 17, 2], ['Gym', -1, 7, 1], ['Gym', 1, 7, 1],
  ];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const [i, [name, offset, hour, hours]] of plan.entries()) {
    const facility = byName(name);
    if (!facility) continue;
    const start = new Date(today);
    start.setDate(start.getDate() + offset);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + hours);
    const booker = residents[i % residents.length]!;
    const row = await scope.bookings.create({ facilityId: facility.id, residentId: booker.id, startsAt: start.toISOString(), endsAt: end.toISOString(), seriesId: name === 'Gym' ? '00000000-0000-4000-8000-000000000001' : null });
    if (name === 'Sauna') {
      const guest = residents[(i + 1) % residents.length]!;
      if (guest.id !== booker.id) await scope.participants.create({ bookingId: row.id, residentId: guest.id, status: 'accepted' });
    }
  }
}
