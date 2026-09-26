import type { Locale } from '../i18n/messages';

const tag = (locale: Locale) => (locale === 'fi' ? 'fi-FI' : 'en-GB');

export function fmtWhen(iso: string, locale: Locale, timeZone: string): string {
  return new Date(iso).toLocaleString(tag(locale), { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtTime(iso: string, locale: Locale, timeZone: string): string {
  return new Date(iso).toLocaleTimeString(tag(locale), { timeZone, hour: '2-digit', minute: '2-digit' });
}

export function fmtDayLong(date: Date, locale: Locale): string {
  return date.toLocaleDateString(tag(locale), { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtWeekday(date: Date, locale: Locale): string {
  return date.toLocaleDateString(tag(locale), { weekday: 'short' });
}
