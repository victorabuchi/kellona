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
  // Apartment B 3 has no sauna, to show an apartment exception.
  const b3 = units[5]!;
  if (!(await scope.unitAmenities.q().where({ unitId: b3.id, kind: 'sauna' }).first())) await scope.unitAmenities.create({ unitId: b3.id, kind: 'sauna', enabled: false });
}
