import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { orgScope } from '../tenant/scope';
import type { OrgContext } from '../tenant/load';
import { isLocale, MESSAGES, type Locale, type MessageKey } from './messages';
import { LOCALE_COOKIE } from './constants';

export type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

// Cookie choice if the organization offers it, then the browser language, then
// the organization default.
export async function getLocale(org: OrgContext | null): Promise<Locale> {
  const offered = (org?.locales ?? ['fi', 'en']).filter(isLocale);
  const orgDefault = org?.defaultLocale;
  const fallback: Locale = isLocale(orgDefault) ? orgDefault : 'fi';
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen) && offered.includes(chosen)) return chosen;
  const accept = (await headers()).get('accept-language') ?? '';
  for (const part of accept.split(',')) {
    const tag = part.split(';')[0]!.trim().slice(0, 2).toLowerCase();
    if (isLocale(tag) && offered.includes(tag)) return tag;
  }
  return offered.includes(fallback) ? fallback : (offered[0] ?? 'fi');
}

const loadOverrides = cache(async (orgId: string, locale: Locale): Promise<Map<string, string>> => {
  const rows = await orgScope(orgId).texts.q().where({ locale }).all();
  return new Map(rows.map((r) => [r.key, r.value]));
});

export function makeT(locale: Locale, overrides: Map<string, string>, orgName: string): T {
  return (key, vars) => {
    let text = overrides.get(key) ?? MESSAGES[locale][key] ?? key;
    text = text.replaceAll('{org}', orgName);
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
    return text;
  };
}

export async function getT(org: OrgContext | null): Promise<{ t: T; locale: Locale }> {
  const locale = await getLocale(org);
  const overrides = org ? await loadOverrides(org.id, locale) : new Map<string, string>();
  return { t: makeT(locale, overrides, org?.shortName ?? 'Kellona'), locale };
}
