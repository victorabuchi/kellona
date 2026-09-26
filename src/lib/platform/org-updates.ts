import { db } from '../../prisma/db';
import { orgScope } from '../tenant/scope';
import { isHostTaken } from '../tenant/load';
import { randomBytes } from 'node:crypto';
import { hostConfigFromEnv, normalizeHost } from '../tenant/host';
import { checkDomain } from '../tenant/domain-check';
import { cnameTarget, liveDns } from '../tenant/dns';
import { addToHosting, removeFromHosting } from '../tenant/hosting';
import { isHexColor } from '../brand/color';
import { readImage } from './image';

// Shared by the super-admin platform settings and an organization's own
// settings page. Callers check who may do what.

const str = (formData: FormData, name: string, max = 200) => String(formData.get(name) ?? '').trim().slice(0, max);
const orNull = (v: string) => v || null;

export async function updateOrgDetails(id: string, formData: FormData, opts: { allowStatus: boolean }): Promise<void> {
  const org = await db.orm.public.Organization.where({ id }).first();
  if (!org) return;
  const status = str(formData, 'status', 20);
  const locales = formData.getAll('locales').map(String).filter((l) => l === 'fi' || l === 'en');
  await db.orm.public.Organization.where({ id }).update({
    name: str(formData, 'name', 120) || org.name,
    shortName: str(formData, 'shortName', 40) || org.shortName,
    status: opts.allowStatus && ['pilot', 'active', 'suspended'].includes(status) ? status : org.status,
    defaultLocale: str(formData, 'defaultLocale', 2) === 'en' ? 'en' : 'fi',
    locales: locales.length ? locales.join(',') : 'fi,en',
    legalName: orNull(str(formData, 'legalName')),
    businessId: orNull(str(formData, 'businessId', 20)),
    address: orNull(str(formData, 'address')),
    supportEmail: orNull(str(formData, 'supportEmail', 254)),
    supportPhone: orNull(str(formData, 'supportPhone', 40)),
    privacyEmail: orNull(str(formData, 'privacyEmail', 254)),
    senderName: orNull(str(formData, 'senderName', 60)),
  });
}

// Logos are stored as data URLs on the brand row (up to 300 KB each) until
// Supabase Storage is connected. Returns false when a file was rejected.
export async function updateOrgBrand(id: string, formData: FormData): Promise<boolean> {
  const scope = orgScope(id);
  const current = await scope.brand.q().first();
  const primary = str(formData, 'primaryColor', 7);
  const accent = str(formData, 'accentColor', 7);
  const values: Record<string, string | null> = {
    primaryColor: isHexColor(primary) ? primary : (current?.primaryColor ?? '#2f5d8a'),
    accentColor: isHexColor(accent) ? accent : (current?.accentColor ?? '#e0a526'),
    updatedAt: new Date().toISOString(),
  };
  let ok = true;
  for (const [field, column] of [
    ['logoLight', 'logoLightUrl'],
    ['logoDark', 'logoDarkUrl'],
    ['icon', 'appIconUrl'],
  ] as const) {
    const file = formData.get(field);
    if (!(file instanceof File) || file.size === 0) continue;
    const url = await readImage(file);
    if (url) values[column] = url;
    else ok = false;
    if (url && column === 'appIconUrl') values['faviconUrl'] = url;
  }
  if (current) await scope.brand.q().where({ id: current.id }).update(values);
  else await scope.brand.create(values as never);
  return ok;
}

export type DomainResult = 'ok' | 'invalid' | 'taken';

// Adds a domain as pending, with a fresh ownership token. It serves nothing
// until verified.
export async function addDomain(id: string, rawHost: string): Promise<DomainResult> {
  const host = normalizeHost(rawHost);
  if (!host || !/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(host) || isPlatformDomain(host)) return 'invalid';
  if (await isHostTaken(host)) return 'taken';
  await orgScope(id).domains.create({ host, isPrimary: false, verificationToken: randomBytes(12).toString('hex') });
  await addToHosting(host);
  return 'ok';
}

export async function verifyDomain(id: string, domainId: string): Promise<boolean> {
  const scope = orgScope(id);
  const domain = await scope.domains.q().where({ id: domainId }).first();
  if (!domain) return false;
  const token = domain.verificationToken ?? randomBytes(12).toString('hex');
  const result = await checkDomain(domain.host, token, cnameTarget(), liveDns, { allowLocal: process.env.NODE_ENV !== 'production' });
  const now = new Date().toISOString();
  await scope.domains.q().where({ id: domainId }).update({
    verificationToken: token,
    lastCheckedAt: now,
    lastError: result.error,
    verifiedAt: result.verified ? (domain.verifiedAt ?? now) : null,
  });
  // The first verified domain becomes the primary address.
  if (result.verified && !(await scope.domains.q().where({ isPrimary: true }).first())) {
    await scope.domains.q().where({ id: domainId }).update({ isPrimary: true });
  }
  return result.verified;
}

export async function makePrimary(id: string, domainId: string): Promise<boolean> {
  const scope = orgScope(id);
  const domain = await scope.domains.q().where({ id: domainId }).first();
  if (!domain?.verifiedAt) return false;
  for (const d of await scope.domains.q().where({ isPrimary: true }).all()) await scope.domains.q().where({ id: d.id }).update({ isPrimary: false });
  await scope.domains.q().where({ id: domainId }).update({ isPrimary: true });
  return true;
}

// Removing the primary hands the role to another verified domain, if any.
export async function removeDomain(id: string, domainId: string): Promise<void> {
  const scope = orgScope(id);
  const domain = await scope.domains.q().where({ id: domainId }).first();
  if (!domain) return;
  await scope.domains.q().where({ id: domainId }).delete();
  await removeFromHosting(domain.host);
  if (domain.isPrimary) {
    const next = (await scope.domains.q().all()).find((d) => d.verifiedAt);
    if (next) await scope.domains.q().where({ id: next.id }).update({ isPrimary: true });
  }
}

function isPlatformDomain(host: string): boolean {
  return hostConfigFromEnv().platformDomains.some((p) => host === p || host.endsWith(`.${p}`));
}
