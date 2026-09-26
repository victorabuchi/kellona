'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireManager } from '../auth/access';
import { addDomain, makePrimary, removeDomain, updateOrgBrand, updateOrgDetails, verifyDomain } from '../platform/org-updates';

// An organization's managers edit their own organization, found from the address.
export async function saveSettingsAction(formData: FormData) {
  const { org } = await requireManager();
  await updateOrgDetails(org.id, formData, { allowStatus: false });
  revalidatePath('/', 'layout');
  redirect('/manage/settings?saved=1');
}

export async function saveSettingsBrandAction(formData: FormData) {
  const { org } = await requireManager();
  const ok = await updateOrgBrand(org.id, formData);
  revalidatePath('/', 'layout');
  redirect(`/manage/settings?${ok ? 'saved=1' : 'error=file'}`);
}

// Managers connect their own domains; DNS verification proves they own them.
export async function addOwnDomainAction(formData: FormData) {
  const { org } = await requireManager();
  const result = await addDomain(org.id, String(formData.get('host') ?? '').slice(0, 253));
  redirect(`/manage/settings?${result === 'ok' ? 'domain=added' : `error=${result}`}#domains`);
}

export async function verifyOwnDomainAction(formData: FormData) {
  const { org } = await requireManager();
  const ok = await verifyDomain(org.id, String(formData.get('domainId') ?? ''));
  redirect(`/manage/settings?domain=${ok ? 'verified' : 'pending'}#domains`);
}

export async function makeOwnPrimaryAction(formData: FormData) {
  const { org } = await requireManager();
  await makePrimary(org.id, String(formData.get('domainId') ?? ''));
  redirect('/manage/settings?domain=primary#domains');
}

export async function removeOwnDomainAction(formData: FormData) {
  const { org } = await requireManager();
  await removeDomain(org.id, String(formData.get('domainId') ?? ''));
  redirect('/manage/settings#domains');
}
