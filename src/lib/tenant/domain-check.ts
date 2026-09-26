// Custom domain verification. Pure apart from the resolver passed in, so it is
// unit tested with a fake DNS.

export type Resolver = {
  txt(name: string): Promise<string[][]>;
  cname(name: string): Promise<string[]>;
  a(name: string): Promise<string[]>;
};

export type DomainCheck = {
  // The TXT record proves the organization controls the domain.
  ownership: boolean;
  // The domain points at Kellona (CNAME to the target, or the same A records).
  pointing: boolean;
  verified: boolean;
  error: 'txt_missing' | 'txt_mismatch' | 'not_pointing' | null;
};

export const TXT_PREFIX = '_kellona';
export const TXT_VALUE_PREFIX = 'kellona-verification=';

export function txtName(host: string): string {
  return `${TXT_PREFIX}.${host}`;
}

export function txtValue(token: string): string {
  return `${TXT_VALUE_PREFIX}${token}`;
}

function bare(name: string): string {
  return name.toLowerCase().replace(/\.$/, '');
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// Verified means ownership is proven. Whether traffic reaches Kellona yet is
// reported separately, since DNS for the CNAME can lag behind the TXT record.
export async function checkDomain(host: string, token: string, target: string, dns: Resolver, opts: { allowLocal: boolean }): Promise<DomainCheck> {
  if (opts.allowLocal && (host === 'localhost' || host.endsWith('.localhost'))) {
    return { ownership: true, pointing: true, verified: true, error: null };
  }
  const records = (await safe(() => dns.txt(txtName(host)), [])).map((chunks) => chunks.join(''));
  const ownership = records.includes(txtValue(token));
  const cnames = (await safe(() => dns.cname(host), [])).map(bare);
  let pointing = cnames.includes(bare(target));
  if (!pointing) {
    const [mine, theirs] = await Promise.all([safe(() => dns.a(host), []), safe(() => dns.a(target), [])]);
    pointing = mine.length > 0 && mine.some((ip) => theirs.includes(ip));
  }
  const error = !records.length ? 'txt_missing' : !ownership ? 'txt_mismatch' : !pointing ? 'not_pointing' : null;
  return { ownership, pointing, verified: ownership, error };
}
