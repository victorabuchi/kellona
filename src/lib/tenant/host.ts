// Pure host parsing, kept free of Next and database imports so it is unit tested.

export type OrgRef = { by: 'domain'; host: string } | { by: 'slug'; slug: string; host: string };

export type HostConfig = {
  // Domains that serve organizations as <slug>.<domain>, for example kellona.fi.
  platformDomains: string[];
  production: boolean;
};

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
// Subdomains of the platform that never belong to an organization.
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'platform', 'mail', 'static']);

export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(',')[0]!.trim().toLowerCase();
  const host = first.startsWith('[') ? first : first.replace(/:\d+$/, '');
  return host.replace(/\.$/, '') || null;
}

export function isValidSlug(slug: string): boolean {
  return SLUG.test(slug) && !RESERVED.has(slug);
}

// Decides how to look the organization up. A custom domain is always tried by
// exact host first (the caller does that); this returns the fallback path.
export function resolveOrgRef(rawHost: string | null | undefined, config: HostConfig): OrgRef | null {
  const host = normalizeHost(rawHost);
  if (!host) return null;

  const platforms = config.production ? config.platformDomains : [...config.platformDomains, 'localhost', '127.0.0.1'];
  for (const domain of platforms) {
    // The bare platform host is Kellona's own site, not an organization.
    if (host === domain) return null;
    if (host.endsWith(`.${domain}`)) {
      const label = host.slice(0, -(domain.length + 1));
      if (label.includes('.') || !isValidSlug(label)) return null;
      return { by: 'slug', slug: label, host };
    }
  }
  return { by: 'domain', host };
}

export function hostConfigFromEnv(env: Record<string, string | undefined> = process.env): HostConfig {
  return {
    platformDomains: (env['PLATFORM_DOMAINS'] ?? 'kellona.fi,kellona.com')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    production: env['NODE_ENV'] === 'production',
  };
}

// kellona.fi, kellona.com, and in development plain localhost: Kellona's own
// landing, login and sign-up pages.
export function isPlatformHost(rawHost: string | null | undefined, config: HostConfig): boolean {
  const host = normalizeHost(rawHost);
  if (!host) return false;
  const platforms = config.production ? config.platformDomains : [...config.platformDomains, 'localhost', '127.0.0.1'];
  return platforms.includes(host);
}
