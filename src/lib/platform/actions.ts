'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { requireAdmin } from '../auth/viewer';
import { orgScope } from '../tenant/scope';
import { isValidSlug, normalizeHost } from '../tenant/host';
import { isHexColor } from '../brand/color';
import { readImage } from './image';
import { isHostTaken } from '../tenant/load';

const str = (formData: FormData, name: string, max = 200) => String(formData.get(name) ?? '').trim().slice(0, max);
const orNull = (v: string) => v || null;

export async function createOrgAction(formData: FormData) {
  await requireAdmin();
  const slug = str(formData, 'slug', 50).toLowerCase();
  const name = str(formData, 'name', 120);
  const shortName = str(formData, 'shortName', 40) || name;
  const locale = str(formData, 'defaultLocale', 2) === 'en' ? 'en' : 'fi';
  const primary = str(formData, 'primaryColor', 7);
  const accent = str(formData, 'accentColor', 7);
  if (!name || !isValidSlug(slug) || (await db.orm.public.Organization.where({ slug }).first())) redirect('/platform?error=1');

  const org = await db.orm.public.Organization.create({
    slug,
    name,
    shortName,
    defaultLocale: locale,
    status: 'pilot',
    legalName: orNull(str(formData, 'legalName')),
    supportEmail: orNull(str(formData, 'supportEmail', 254)),
    senderName: shortName,
  });
  await orgScope(org.id).brand.create({
    primaryColor: isHexColor(primary) ? primary : '#2f5d8a',
    accentColor: isHexColor(accent) ? accent : '#e0a526',
  });
  revalidatePath('/platform');
  redirect(`/platform/o/${org.id}`);
}

export async function saveOrgDetailsAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, 'id', 40);
  const status = str(formData, 'status', 20);
  const locales = formData.getAll('locales').map(String).filter((l) => l === 'fi' || l === 'en');
  const org = await db.orm.public.Organization.where({ id }).first();
  if (!org) redirect('/platform');
  await db.orm.public.Organization.where({ id }).update({
    name: str(formData, 'name', 120) || org.name,
    shortName: str(formData, 'shortName', 40) || org.shortName,
    status: ['pilot', 'active', 'suspended'].includes(status) ? status : 'pilot',
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
  redirect(`/platform/o/${id}?saved=1`);
}

// Logos are stored as data URLs on the brand row (up to 300 KB each) until
// Supabase Storage is connected.
export async function saveBrandAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, 'id', 40);
  const scope = orgScope(id);
  const current = await scope.brand.q().first();
  const primary = str(formData, 'primaryColor', 7);
  const accent = str(formData, 'accentColor', 7);
  const values: Record<string, string | null> = {
    primaryColor: isHexColor(primary) ? primary : (current?.primaryColor ?? '#2f5d8a'),
    accentColor: isHexColor(accent) ? accent : (current?.accentColor ?? '#e0a526'),
    updatedAt: new Date().toISOString(),
  };
  let bad = false;
  for (const [field, column] of [
    ['logoLight', 'logoLightUrl'],
    ['logoDark', 'logoDarkUrl'],
    ['icon', 'appIconUrl'],
  ] as const) {
    const file = formData.get(field);
    if (!(file instanceof File) || file.size === 0) continue;
    const url = await readImage(file);
    if (url) values[column] = url;
    else bad = true;
    if (url && column === 'appIconUrl') values['faviconUrl'] = url;
  }
  if (current) await scope.brand.q().where({ id: current.id }).update(values);
  else await scope.brand.create(values as never);
  redirect(`/platform/o/${id}?${bad ? 'error=file' : 'saved=1'}`);
}

export async function addDomainAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, 'id', 40);
  const host = normalizeHost(str(formData, 'host', 253));
  if (!host || !/^[a-z0-9.-]+$/.test(host) || (await isHostTaken(host))) redirect(`/platform/o/${id}?error=domain`);
  const scope = orgScope(id);
  const hasPrimary = await scope.domains.q().where({ isPrimary: true }).first();
  await scope.domains.create({ host, isPrimary: !hasPrimary });
  redirect(`/platform/o/${id}?saved=1`);
}

export async function removeDomainAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, 'id', 40);
  await orgScope(id).domains.q().where({ id: str(formData, 'domainId', 40) }).delete();
  redirect(`/platform/o/${id}`);
}
