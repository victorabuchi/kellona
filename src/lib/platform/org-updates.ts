import { db } from '../../prisma/db';
import { orgScope } from '../tenant/scope';
import { isHostTaken } from '../tenant/load';
import { normalizeHost } from '../tenant/host';
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

export async function addDomain(id: string, rawHost: string): Promise<boolean> {
  const host = normalizeHost(rawHost);
  if (!host || !/^[a-z0-9.-]+$/.test(host) || (await isHostTaken(host))) return false;
  const scope = orgScope(id);
  const hasPrimary = await scope.domains.q().where({ isPrimary: true }).first();
  await scope.domains.create({ host, isPrimary: !hasPrimary });
  return true;
}

export async function removeDomain(id: string, domainId: string): Promise<void> {
  await orgScope(id).domains.q().where({ id: domainId }).delete();
}
