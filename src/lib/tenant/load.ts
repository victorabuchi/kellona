import { db } from '../../prisma/db';
import { DEFAULT_BRAND, type BrandInput } from '../brand/defaults';

export type OrgContext = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  status: string;
  isDemo: boolean;
  defaultLocale: string;
  locales: string[];
  timezone: string;
  supportEmail: string | null;
  supportPhone: string | null;
  supportUrl: string | null;
  legalName: string | null;
  businessId: string | null;
  address: string | null;
  privacyEmail: string | null;
  senderName: string;
  brand: BrandInput;
};

type OrgRow = Awaited<ReturnType<typeof findBySlug>>;

function findBySlug(slug: string) {
  return db.orm.public.Organization.where({ slug }).include('brand', (b) => b).first();
}

function toContext(row: NonNullable<OrgRow>): OrgContext {
  const locales = row.locales
    .split(',')
    .map((l) => l.trim())
    .filter((l): l is 'fi' | 'en' => l === 'fi' || l === 'en');
  const brand = row.brand;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    status: row.status,
    isDemo: row.isDemo,
    defaultLocale: (locales as string[]).includes(row.defaultLocale) ? row.defaultLocale : (locales[0] ?? 'fi'),
    locales: locales.length ? locales : ['fi', 'en'],
    timezone: row.timezone,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone,
    supportUrl: row.supportUrl,
    legalName: row.legalName,
    businessId: row.businessId,
    address: row.address,
    privacyEmail: row.privacyEmail,
    senderName: row.senderName || row.shortName,
    brand: brand
      ? {
          logoLightUrl: brand.logoLightUrl,
          logoDarkUrl: brand.logoDarkUrl,
          faviconUrl: brand.faviconUrl,
          appIconUrl: brand.appIconUrl,
          primaryColor: brand.primaryColor,
          accentColor: brand.accentColor,
        }
      : DEFAULT_BRAND,
  };
}

export async function loadOrgBySlug(slug: string): Promise<OrgContext | null> {
  const row = await findBySlug(slug);
  return row ? toContext(row) : null;
}

export async function loadOrgByHost(host: string): Promise<OrgContext | null> {
  const domain = await db.orm.public.OrgDomain.where({ host }).first();
  if (!domain) return null;
  const row = await db.orm.public.Organization.where({ id: domain.organizationId }).include('brand', (b) => b).first();
  return row ? toContext(row) : null;
}

// Web addresses are unique across all organizations.
export async function isHostTaken(host: string): Promise<boolean> {
  return Boolean(await db.orm.public.OrgDomain.where({ host }).first());
}

export type OrgAccount = { organizationId: string; slug: string; name: string; primaryHost: string | null };

// Which organizations an email belongs to, as a resident or staff member. Used
// only on the platform sign-in page, to send people to their own address.
export async function findOrgAccountsByEmail(email: string): Promise<OrgAccount[]> {
  const [residents, staff] = await Promise.all([
    db.orm.public.Resident.where({ email, status: 'active' }).all(),
    db.orm.public.Staff.where({ email }).all(),
  ]);
  const ids = [...new Set([...residents, ...staff].map((r) => r.organizationId))];
  if (!ids.length) return [];
  const orgs = await db.orm.public.Organization.where((o) => o.id.in(ids)).where((o) => o.status.neq('suspended')).include('domains', (d) => d).all();
  return orgs.map((o) => ({ organizationId: o.id, slug: o.slug, name: o.name, primaryHost: o.domains.find((d) => d.isPrimary)?.host ?? null }));
}
