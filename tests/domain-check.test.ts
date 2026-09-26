import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDomain, txtName, txtValue, type Resolver } from '../src/lib/tenant/domain-check';

function fakeDns(records: { txt?: Record<string, string[][]>; cname?: Record<string, string[]>; a?: Record<string, string[]> }): Resolver {
  const get = <T>(map: Record<string, T> | undefined, name: string): Promise<T> =>
    map && name in map ? Promise.resolve(map[name]!) : Promise.reject(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
  return { txt: (n) => get(records.txt, n), cname: (n) => get(records.cname, n), a: (n) => get(records.a, n) };
}

const host = 'booking.customer.test';
const target = 'kellona.onrender.com';

test('verified with TXT and CNAME', async () => {
  const dns = fakeDns({ txt: { [txtName(host)]: [[txtValue('abc')]] }, cname: { [host]: ['kellona.onrender.com.'] } });
  assert.deepEqual(await checkDomain(host, 'abc', target, dns, { allowLocal: false }), { ownership: true, pointing: true, verified: true, error: null });
});

test('long TXT values split into chunks are joined', async () => {
  const dns = fakeDns({ txt: { [txtName(host)]: [['kellona-verif', 'ication=abc']] }, cname: { [host]: [target] } });
  assert.equal((await checkDomain(host, 'abc', target, dns, { allowLocal: false })).verified, true);
});

test('apex domains may point with matching A records instead of a CNAME', async () => {
  const dns = fakeDns({ txt: { [txtName(host)]: [[txtValue('abc')]] }, a: { [host]: ['1.2.3.4'], [target]: ['1.2.3.4', '5.6.7.8'] } });
  const r = await checkDomain(host, 'abc', target, dns, { allowLocal: false });
  assert.equal(r.pointing, true);
});

test('missing or wrong TXT is not verified', async () => {
  assert.equal((await checkDomain(host, 'abc', target, fakeDns({ cname: { [host]: [target] } }), { allowLocal: false })).error, 'txt_missing');
  const wrong = await checkDomain(host, 'abc', target, fakeDns({ txt: { [txtName(host)]: [['kellona-verification=other']] } }), { allowLocal: false });
  assert.deepEqual([wrong.verified, wrong.error], [false, 'txt_mismatch']);
});

test('ownership proven but not pointing yet is verified with a warning', async () => {
  const r = await checkDomain(host, 'abc', target, fakeDns({ txt: { [txtName(host)]: [[txtValue('abc')]] } }), { allowLocal: false });
  assert.deepEqual([r.verified, r.pointing, r.error], [true, false, 'not_pointing']);
});

test('localhost names verify only when allowed (development)', async () => {
  assert.equal((await checkDomain('booking.x.localhost', 'abc', target, fakeDns({}), { allowLocal: true })).verified, true);
  assert.equal((await checkDomain('booking.x.localhost', 'abc', target, fakeDns({}), { allowLocal: false })).verified, false);
});
