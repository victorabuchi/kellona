'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { requireAdmin } from '../auth/viewer';
import { orgScope } from '../tenant/scope';
import { isValidSlug } from '../tenant/host';
import { isHexColor } from '../brand/color';
import { addDomain, removeDomain, updateOrgBrand, updateOrgDetails } from './org-updates';

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

// Where to return: the platform settings page, or an organization's own
// settings page when a super-admin edits from inside the organization.
function backPath(formData: FormData, id: string): string {
  const back = String(formData.get('back') ?? '');
  return back === '/manage/settings' ? back : `/platform/o/${id}`;
}

export async function saveOrgDetailsAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, 'id', 40);
  await updateOrgDetails(id, formData, { allowStatus: true });
  redirect(`${backPath(formData, id)}?saved=1`);
}

export async function saveBrandAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, 'id', 40);
  const ok = await updateOrgBrand(id, formData);
  redirect(`${backPath(formData, id)}?${ok ? 'saved=1' : 'error=file'}`);
}

export async function addDomainAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, 'id', 40);
  const ok = await addDomain(id, str(formData, 'host', 253));
  redirect(`${backPath(formData, id)}?${ok ? 'saved=1' : 'error=domain'}`);
}

export async function removeDomainAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, 'id', 40);
  await removeDomain(id, str(formData, 'domainId', 40));
  redirect(backPath(formData, id));
}
