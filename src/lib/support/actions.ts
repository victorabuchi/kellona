'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireResident } from '../auth/access';
import { residentContext } from '../booking/engine';
import { REPORT_CATEGORIES } from './constants';

// A resident reports a problem with a facility in their building, or the building itself.
export async function sendReportAction(formData: FormData) {
  const { scope, viewer } = await requireResident();
  const ctx = await residentContext(scope, viewer.id);
  const message = String(formData.get('message') ?? '').trim().slice(0, 2000);
  const rawCategory = String(formData.get('category') ?? 'broken');
  const category = (REPORT_CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : 'other';
  const facilityId = String(formData.get('facilityId') ?? '');
  if (message.length < 3) redirect('/booking/report?error=1');
  const facility = facilityId && ctx ? await scope.facilities.q().where({ id: facilityId, buildingId: ctx.buildingId }).first() : null;
  await scope.reports.create({ residentId: viewer.id, facilityId: facility?.id ?? null, buildingId: ctx?.buildingId ?? null, category, message });
  revalidatePath('/booking/report');
  redirect('/booking/report?sent=1');
}
