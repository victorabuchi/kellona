'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isLocale } from './messages';
import { LOCALE_COOKIE } from './constants';

export async function setLocaleAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? '');
  const back = String(formData.get('back') ?? '/');
  if (isLocale(locale)) {
    (await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }
  redirect(back.startsWith('/') && !back.startsWith('//') ? back : '/');
}
