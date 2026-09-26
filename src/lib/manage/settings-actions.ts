'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireManager } from '../auth/access';
import { updateOrgBrand, updateOrgDetails } from '../platform/org-updates';

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
