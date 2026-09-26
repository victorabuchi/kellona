'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireManager, requireStaff, canSeeBuilding } from '../auth/access';
import { REPORT_STATUSES } from '../support/constants';
import { notifyResident } from '../booking/notify';
import { MESSAGES } from '../i18n/messages';

const str = (formData: FormData, name: string, max = 200) => String(formData.get(name) ?? '').trim().slice(0, max);

export async function updateReportAction(formData: FormData) {
  const access = await requireStaff();
  const { scope, org } = access;
  const id = str(formData, 'id', 40);
  const report = await scope.reports.q().where({ id }).first();
  if (!report || (report.buildingId && !canSeeBuilding(access, report.buildingId))) redirect('/manage/reports');
  const status = str(formData, 'status', 20);
  const next = (REPORT_STATUSES as readonly string[]).includes(status) ? status : report.status;
  const note = str(formData, 'staffNote', 2000) || null;
  const now = new Date().toISOString();
  await scope.reports.q().where({ id }).update({ status: next, staffNote: note, updatedAt: now, resolvedAt: next === 'done' ? (report.resolvedAt ?? now) : null });
  if (formData.get('markOutOfOrder') === '1' && report.facilityId) {
    await scope.facilities.q().where({ id: report.facilityId }).update({ outOfOrder: true, outOfOrderNote: note });
  }
  if (next !== report.status || (note && note !== report.staffNote)) {
    const resident = await scope.residents.q().where({ id: report.residentId }).first();
    const m = MESSAGES[resident?.locale === 'en' || (!resident?.locale && org.defaultLocale === 'en') ? 'en' : 'fi'];
    await notifyResident(org, scope, report.residentId, {
      title: m['nav.report'],
      body: `${m[`report.status.${next}` as 'report.status.new']}${note ? `: ${note}` : ''}`,
      url: '/booking/report',
    }).catch(() => 'none');
  }
  revalidatePath('/manage/reports');
  redirect(`/manage/reports?${new URLSearchParams({ show: str(formData, 'show', 10) || 'open' }).toString()}`);
}

export async function setOutOfOrderAction(formData: FormData) {
  const access = await requireStaff();
  const buildingId = str(formData, 'buildingId', 40);
  const id = str(formData, 'id', 40);
  if (!canSeeBuilding(access, buildingId)) redirect('/manage');
  const on = formData.get('on') === '1';
  await access.scope.facilities.q().where({ id, buildingId }).update({ outOfOrder: on, outOfOrderNote: on ? str(formData, 'note', 240) || null : null });
  revalidatePath('/booking');
  redirect(`/manage/b/${buildingId}#facilities`);
}

export async function saveContactAction(formData: FormData) {
  const { scope } = await requireManager();
  const id = str(formData, 'id', 40);
  const values = {
    title: str(formData, 'title', 120),
    description: str(formData, 'description', 240) || null,
    phone: str(formData, 'phone', 40) || null,
    email: str(formData, 'email', 254) || null,
    url: str(formData, 'url', 300) || null,
    hours: str(formData, 'hours', 160) || null,
    emergency: formData.get('emergency') === '1',
    sortOrder: Number.parseInt(str(formData, 'sortOrder', 4), 10) || 0,
  };
  if (!values.title) redirect('/manage/settings#contacts');
  if (id) await scope.contacts.q().where({ id }).update(values);
  else await scope.contacts.create(values);
  redirect('/manage/settings?saved=1#contacts');
}

export async function removeContactAction(formData: FormData) {
  const { scope } = await requireManager();
  await scope.contacts.q().where({ id: str(formData, 'id', 40) }).delete();
  redirect('/manage/settings#contacts');
}

export async function saveArticleAction(formData: FormData) {
  const { scope } = await requireManager();
  const id = str(formData, 'id', 40);
  const values = {
    title: str(formData, 'title', 160),
    body: str(formData, 'body', 8000),
    locale: str(formData, 'locale', 2) === 'en' ? 'en' : 'fi',
    sortOrder: Number.parseInt(str(formData, 'sortOrder', 4), 10) || 0,
    updatedAt: new Date().toISOString(),
  };
  if (!values.title || !values.body) redirect('/manage/settings#help');
  if (id) await scope.help.q().where({ id }).update(values);
  else await scope.help.create(values);
  redirect('/manage/settings?saved=1#help');
}

export async function removeArticleAction(formData: FormData) {
  const { scope } = await requireManager();
  await scope.help.q().where({ id: str(formData, 'id', 40) }).delete();
  redirect('/manage/settings#help');
}
