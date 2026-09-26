'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { getCurrentOrg } from '../tenant/org';
import { getLocale } from '../i18n';
import { isThrottled, recordFailure } from '../auth/throttle';

const str = (formData: FormData, name: string, max: number) => String(formData.get(name) ?? '').trim().slice(0, max);

// Saves a pilot request from /signup. A hidden field catches simple bots, and
// each address can send a handful of requests per 15 minutes.
export async function requestPilotAction(formData: FormData) {
  if (await getCurrentOrg()) redirect('/');
  if (str(formData, 'website', 200)) redirect('/signup?sent=1');
  const ip = ((await headers()).get('x-forwarded-for') ?? 'local').split(',')[0]!.trim();
  const key = `signup:${ip}`;
  if (isThrottled(key)) redirect('/signup?error=1');

  const organizationName = str(formData, 'organizationName', 160);
  const contactName = str(formData, 'contactName', 120);
  const email = str(formData, 'email', 254).toLowerCase();
  const residents = Number.parseInt(str(formData, 'residents', 7), 10);
  if (!organizationName || !contactName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect('/signup?error=1');

  await db.orm.public.AccessRequest.create({
    organizationName,
    contactName,
    email,
    phone: str(formData, 'phone', 40) || null,
    residents: Number.isFinite(residents) && residents > 0 ? residents : null,
    message: str(formData, 'message', 2000) || null,
    locale: await getLocale(null),
  });
  recordFailure(key);
  redirect('/signup?sent=1');
}
