import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHost, resolveOrgRef, type HostConfig } from '../src/lib/tenant/host';

const prod: HostConfig = { platformDomains: ['kellona.fi', 'kellona.com'], devSlug: null, production: true };
const dev: HostConfig = { platformDomains: ['kellona.fi'], devSlug: 'demo-north', production: false };

test('normalizes host headers', () => {
  assert.equal(normalizeHost('Varaukset.Example.FI:443'), 'varaukset.example.fi');
  assert.equal(normalizeHost('a.kellona.fi., b.kellona.fi'), 'a.kellona.fi');
  assert.equal(normalizeHost(''), null);
  assert.equal(normalizeHost(null), null);
});

test('platform subdomain resolves by slug', () => {
  assert.deepEqual(resolveOrgRef('acme.kellona.fi', prod), { by: 'slug', slug: 'acme', host: 'acme.kellona.fi' });
  assert.deepEqual(resolveOrgRef('acme.kellona.com:443', prod), { by: 'slug', slug: 'acme', host: 'acme.kellona.com' });
});

test('custom domains resolve by exact host', () => {
  assert.deepEqual(resolveOrgRef('varaukset.example.fi', prod), { by: 'domain', host: 'varaukset.example.fi' });
});

test('bare platform, nested and reserved subdomains resolve to nothing in production', () => {
  assert.equal(resolveOrgRef('kellona.fi', prod), null);
  assert.equal(resolveOrgRef('a.b.kellona.fi', prod), null);
  assert.equal(resolveOrgRef('www.kellona.fi', prod), null);
  assert.equal(resolveOrgRef('-bad.kellona.fi', prod), null);
});

test('localhost is only a platform domain in development', () => {
  assert.deepEqual(resolveOrgRef('localhost:3000', dev), { by: 'slug', slug: 'demo-north', host: 'localhost' });
  assert.deepEqual(resolveOrgRef('demo-lakeside.localhost:3000', dev), { by: 'slug', slug: 'demo-lakeside', host: 'demo-lakeside.localhost' });
  assert.deepEqual(resolveOrgRef('demo-lakeside.localhost', prod), { by: 'domain', host: 'demo-lakeside.localhost' });
  assert.equal(resolveOrgRef('kellona.fi', { ...prod, devSlug: 'demo-north' }), null);
});
