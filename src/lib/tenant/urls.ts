import { hostConfigFromEnv, normalizeHost } from './host';

// Base URL where an organization is served. In development the current
// request's port is kept, so links work on whatever port the dev server uses.
export function orgBaseUrl(org: { slug: string; primaryHost: string | null }, currentHost: string | null): string {
  const config = hostConfigFromEnv();
  if (config.production) return `https://${org.primaryHost ?? `${org.slug}.${config.platformDomains[0]}`}`;
  const port = /:(\d+)$/.exec(currentHost ?? '')?.[1] ?? '3000';
  const host = normalizeHost(org.primaryHost) ?? `${org.slug}.localhost`;
  return `http://${host}:${port}`;
}

// Kellona's own address (the platform dashboard), from any organization's address.
export function platformBaseUrl(currentHost: string | null): string {
  const config = hostConfigFromEnv();
  if (config.production) return `https://${config.platformDomains[0]}`;
  const port = /:(\d+)$/.exec(currentHost ?? '')?.[1] ?? '3000';
  return `http://localhost:${port}`;
}
