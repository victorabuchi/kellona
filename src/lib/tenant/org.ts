import { cache } from 'react';
import { requestHost } from './request-host';
import { notFound } from 'next/navigation';
import { hostConfigFromEnv, isPlatformHost, normalizeHost, resolveOrgRef } from './host';
import { loadOrgByHost, loadOrgBySlug, type OrgContext } from './load';

// The organization for the current request, resolved once per request from the
// Host header: a registered custom domain first, then <slug>.<platform domain>,
// and nothing on the bare platform host.
export const getCurrentOrg = cache(async (): Promise<OrgContext | null> => {
  const rawHost = await requestHost();
  const host = normalizeHost(rawHost);
  if (!host) return null;

  const byDomain = await loadOrgByHost(host);
  if (byDomain) return byDomain;

  const ref = resolveOrgRef(host, hostConfigFromEnv());
  if (ref?.by === 'slug') return loadOrgBySlug(ref.slug);
  return null;
});

export async function requireOrg(): Promise<OrgContext> {
  const org = await getCurrentOrg();
  if (!org || org.status === 'suspended') notFound();
  return org;
}

export async function onPlatformHost(): Promise<boolean> {
  return isPlatformHost(await requestHost(), hostConfigFromEnv());
}
