import { promises as dns } from 'node:dns';
import type { Resolver } from './domain-check';

// Public resolvers, so a fresh record is seen without waiting on a local cache.
const resolver = new dns.Resolver({ timeout: 4000, tries: 2 });
resolver.setServers(['1.1.1.1', '8.8.8.8']);

export const liveDns: Resolver = {
  txt: (name) => resolver.resolveTxt(name),
  cname: (name) => resolver.resolveCname(name),
  a: (name) => resolver.resolve4(name),
};

// Where customer domains point. On Render this is the service's onrender.com host.
export function cnameTarget(): string {
  return process.env['KELLONA_CNAME_TARGET'] || 'cname.kellona.fi';
}
