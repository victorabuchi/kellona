'use server';

import { redirect } from 'next/navigation';
import { getViewer } from './viewer';
import { destroySession } from './session';
import { deleteBlock, deleteOwnAccount } from './account-deletion';

// Deletes the signed-in account after the person typed their email to confirm.
export async function deleteAccountAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect('/');
  const typed = String(formData.get('confirm') ?? '').trim().toLowerCase();
  if (typed !== viewer.email.toLowerCase()) redirect('/account?error=confirm');
  const block = await deleteBlock(viewer);
  if (block) redirect(`/account?error=${block}`);
  await deleteOwnAccount(viewer);
  await destroySession();
  redirect('/');
}
