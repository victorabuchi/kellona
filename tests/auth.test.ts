import { test } from 'node:test';
import assert from 'node:assert/strict';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../src/lib/auth/password';
import { decodeSession, encodeSession, hashLoginToken, newLoginToken } from '../src/lib/auth/token';

const SECRET = 'x'.repeat(40);

test('passwords verify only with the right password', async () => {
  const hash = await hashPassword('correct horse battery');
  assert.ok(hash.startsWith('scrypt$'));
  assert.ok(await verifyPassword('correct horse battery', hash));
  assert.ok(!(await verifyPassword('correct horse batterx', hash)));
  assert.ok(!(await verifyPassword('anything', null)));
  assert.ok(!(await verifyPassword('anything', 'garbage')));
  await burnPasswordCheck('anything');
});

test('two hashes of the same password differ (salted)', async () => {
  assert.notEqual(await hashPassword('same password'), await hashPassword('same password'));
});

test('session round trip, tampering and expiry', () => {
  const now = Date.now();
  const value = encodeSession({ kind: 'resident', orgId: 'o1', residentId: 'r1', exp: now + 1000 }, SECRET);
  assert.deepEqual(decodeSession(value, SECRET, now), { kind: 'resident', orgId: 'o1', residentId: 'r1', exp: now + 1000 });
  assert.equal(decodeSession(value, 'y'.repeat(40), now), null);
  assert.equal(decodeSession(value, SECRET, now + 2000), null);
  const [data, sig] = value.split('.');
  const forged = Buffer.from(JSON.stringify({ kind: 'admin', adminId: 'a1', exp: now + 1000 })).toString('base64url');
  assert.equal(decodeSession(`${forged}.${sig}`, SECRET, now), null);
  assert.equal(decodeSession(`${data}`, SECRET, now), null);
  assert.equal(decodeSession(undefined, SECRET, now), null);
});

test('login tokens are random and stored only as a hash', () => {
  const a = newLoginToken();
  const b = newLoginToken();
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashLoginToken(a.token));
  assert.ok(!a.hash.includes(a.token));
});
