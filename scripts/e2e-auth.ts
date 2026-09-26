// End to end sign-in checks against a running dev server (npm run dev), by
// posting the real server action forms over HTTP. Creates a scratch
// organization with a resident and a staff member, and deletes it afterwards.
// Usage: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD='...' npx tsx scripts/e2e-auth.ts
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { db } from '../src/prisma/db';
import { orgScope } from '../src/lib/tenant/scope';
import { hashPassword } from '../src/lib/auth/password';
import { actionIn } from './lib/http';

const BASE = { hostname: '127.0.0.1', port: 3000 };
const adminEmail = process.env['E2E_ADMIN_EMAIL'] ?? '';
const adminPassword = process.env['E2E_ADMIN_PASSWORD'] ?? '';

type Res = { status: number; location: string; cookie: string | null; body: string };

function http(method: 'GET' | 'POST', host: string, path: string, opts: { cookie?: string; form?: Record<string, string> } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    let body: Buffer | undefined;
    const headers: Record<string, string> = { Host: `${host}:3000` };
    if (opts.cookie) headers['Cookie'] = opts.cookie;
    if (opts.form) {
      const boundary = `----kellona${randomUUID()}`;
      body = Buffer.from(
        Object.entries(opts.form)
          .map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
          .join('') + `--${boundary}--\r\n`,
      );
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      headers['Content-Length'] = String(body.length);
    }
    const req = request({ ...BASE, method, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const set = res.headers['set-cookie'] ?? [];
        const session = set.find((c) => c.startsWith('kellona_session='));
        resolve({
          status: res.statusCode ?? 0,
          location: String(res.headers['location'] ?? ''),
          cookie: session ? session.split(';')[0]! : null,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// The page renders one $ACTION_ID_ field per action; pick the nth on the page.
function actionIds(html: string): string[] {
  return [...html.matchAll(/name="(\$ACTION_ID_[0-9a-f]+)"/g)].map((m) => m[1]!);
}

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : `: ${detail}`}`);
  if (!ok) failures += 1;
}

const tag = randomUUID().slice(0, 8);
const scratchSlug = `scratch-e2e-${tag}`;
const scratchHost = `${scratchSlug}.localhost`;
const residentEmail = `resident-${tag}@example.test`;
const linkEmail = `link-${tag}@example.test`;
const residentPassword = `Pw-${randomUUID()}`;

const org = await db.orm.public.Organization.create({ slug: scratchSlug, name: 'Scratch E2E', shortName: 'Scratch' });
try {
  const s = orgScope(org.id);
  const resident = await s.residents.create({ name: 'Scratch Resident', email: residentEmail });
  await s.identities.create({ provider: 'password', subject: residentEmail, residentId: resident.id, secretHash: await hashPassword(residentPassword) });
  await s.residents.create({ name: 'Link Resident', email: linkEmail });

  // Sign-in page and its two actions: [password, link, language].
  const page = await http('GET', 'demo-north.localhost', '/');
  const [passwordAction, linkAction] = actionIds(page.body);
  check('sign-in page renders with actions', page.status === 200 && Boolean(passwordAction && linkAction));

  // 1. Super-admin with password.
  if (adminEmail && adminPassword) {
    const res = await http('POST', 'demo-north.localhost', '/', { form: { [passwordAction!]: '', email: adminEmail, password: adminPassword } });
    check('admin password sign-in lands on /manage', res.status === 303 && res.location.endsWith('/manage') && Boolean(res.cookie), `${res.status} ${res.location}`);
    const account = await http('GET', 'demo-north.localhost', '/account', { cookie: res.cookie! });
    check('admin account page shows super-admin role', account.status === 200 && (account.body.includes('super-admin') || account.body.includes('pääkäyttäjä')));
    const platform = await http('GET', 'demo-north.localhost', '/platform', { cookie: res.cookie! });
    check('admin sees organization list', platform.status === 200 && platform.body.includes('demo-lakeside'));
    const elsewhere = await http('GET', 'demo-lakeside.localhost', '/account', { cookie: res.cookie! });
    check('admin session also valid on another organization host', elsewhere.status === 200);
  } else {
    console.log('SKIP admin checks (set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD)');
  }

  // 2. Wrong password.
  const wrong = await http('POST', 'demo-north.localhost', '/', { form: { [passwordAction!]: '', email: residentEmail, password: 'wrong-password' } });
  check('wrong password is rejected', wrong.status === 303 && wrong.location.includes('error=invalid') && !wrong.cookie, wrong.location);

  // 3. Resident password on its own host, then the same cookie on another host.
  const scratchPage = await http('GET', scratchHost, '/');
  const [scratchPassword, scratchLink] = actionIds(scratchPage.body);
  const signedIn = await http('POST', scratchHost, '/', { form: { [scratchPassword!]: '', email: residentEmail, password: residentPassword } });
  check('resident password sign-in', signedIn.status === 303 && Boolean(signedIn.cookie), `${signedIn.status} ${signedIn.location}`);
  const mine = await http('GET', scratchHost, '/account', { cookie: signedIn.cookie ?? '' });
  check('resident account page on own host', mine.status === 200 && mine.body.includes(residentEmail));
  const cross = await http('GET', 'demo-north.localhost', '/account', { cookie: signedIn.cookie ?? '' });
  check('resident session rejected on another organization', cross.status === 307 && cross.location.endsWith('/'), `${cross.status} ${cross.location}`);
  const noPlatform = await http('GET', scratchHost, '/platform', { cookie: signedIn.cookie ?? '' });
  check('resident cannot open super-admin', noPlatform.status === 307, String(noPlatform.status));
  const residentOnOtherOrg = await http('POST', 'demo-north.localhost', '/', { form: { [passwordAction!]: '', email: residentEmail, password: residentPassword } });
  check('resident password does not work on another organization', residentOnOtherOrg.location.includes('error=invalid'), residentOnOtherOrg.location);

  // 4. Email link.
  const asked = await http('POST', scratchHost, '/', { form: { [scratchLink!]: '', email: linkEmail } });
  const dev = new URL(asked.location, 'http://x').searchParams.get('dev') ?? '';
  const token = new URL(dev || 'http://x/').searchParams.get('token') ?? '';
  check('link request returns a dev link', asked.status === 303 && Boolean(token), asked.location);
  const verify = await http('GET', scratchHost, `/auth/verify?token=${token}`);
  const [consume] = actionIds(verify.body);
  const used = await http('POST', scratchHost, '/auth/verify', { form: { [consume!]: '', token } });
  check('link signs the resident in and lands on /book', used.status === 303 && used.location.endsWith('/book') && Boolean(used.cookie), `${used.status} ${used.location}`);
  const again = await http('POST', scratchHost, '/auth/verify', { form: { [consume!]: '', token } });
  check('link works only once', again.location.includes('error=link'), again.location);

  // 5. A link made for one organization does not work on another host.
  const asked2 = await http('POST', scratchHost, '/', { form: { [scratchLink!]: '', email: linkEmail } });
  const token2 = new URL(new URL(asked2.location, 'http://x').searchParams.get('dev') ?? 'http://x/').searchParams.get('token') ?? '';
  const northVerify = await http('GET', 'demo-north.localhost', `/auth/verify?token=${token2}`);
  const [northConsume] = actionIds(northVerify.body);
  const wrongHost = await http('POST', 'demo-north.localhost', '/auth/verify', { form: { [northConsume!]: '', token: token2 } });
  check('link rejected on another organization host', wrongHost.location.includes('error=link') && !wrongHost.cookie, wrongHost.location);

  // 6. Unknown email gets the same answer and no link.
  const unknown = await http('POST', scratchHost, '/', { form: { [scratchLink!]: '', email: `nobody-${tag}@example.test` } });
  check('unknown email does not reveal anything', unknown.location.includes('sent=1') && !unknown.location.includes('dev='), unknown.location);

  // 7. Sign out.
  const acct = await http('GET', scratchHost, '/account', { cookie: used.cookie ?? '' });
  const signOut = acct.body.includes('Kirjaudu ulos') ? actionIn(acct.body, 'Kirjaudu ulos') : actionIn(acct.body, 'Sign out');
  const out = await http('POST', scratchHost, '/account', { cookie: used.cookie ?? '', form: { [signOut!]: '' } });
  check('sign out clears the session cookie', out.status === 303 && out.location.endsWith('/'));
} finally {
  await db.orm.public.Organization.where({ id: org.id }).delete();
  for (const email of [residentEmail, linkEmail]) {
    const rows = await db.orm.public.LoginToken.where({ email }).all();
    for (const row of rows) await db.orm.public.LoginToken.where({ id: row.id }).delete();
  }
  const left = await db.orm.public.Organization.where({ slug: scratchSlug }).first();
  check('scratch data deleted', !left);
  await db.close();
}

console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
