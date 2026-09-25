// Creates the two demo organizations used to prove white labeling. Everything
// here is invented and marked isDemo. Real customers are created through the
// super-admin onboarding, never in code. Safe to run repeatedly.
import { db } from '../src/prisma/db';
import { orgScope } from '../src/lib/tenant/scope';

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
  console.log(`${d.slug}: ${org.id}`);
}

await db.close();
