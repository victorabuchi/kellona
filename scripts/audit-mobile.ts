// Opens every route at phone widths in headless Chrome and fails on horizontal
// overflow. Signs in as the super-admin and views a demo resident, so signed-in
// pages are covered. Needs the dev server and the demo seed.
// Usage: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD='...' npx tsx scripts/audit-mobile.ts [screenshot-dir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../src/prisma/db';
import { orgScope } from '../src/lib/tenant/scope';
import { Browser } from './lib/chrome';
import { actionIn, http } from './lib/http';

const WIDTHS = [390, 360];
const HOST = 'demo-north.localhost';
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });

const org = await db.orm.public.Organization.where({ slug: 'demo-north' }).first();
if (!org) throw new Error('Run npm run seed:demo first');
const s = orgScope(org.id);
const building = (await s.buildings.q().first())!;
const facilities = await s.facilities.q().where({ buildingId: building.id }).all();
const resident = (await s.residents.q().where({ email: 'aino@demo-north.example.test' }).first())!;
await db.close();

// Sessions: admin via password + Open, resident via "view as".
const page = await http('GET', 'localhost', '/login');
const login = await http('POST', 'localhost', '/login', { form: { [actionIn(page.body, 'name="password"')]: '', email: process.env['E2E_ADMIN_EMAIL']!, password: process.env['E2E_ADMIN_PASSWORD']! } });
const open = new URL((await http('GET', 'localhost', `/platform/open/${org.id}`, { cookie: login.cookie })).location);
const admin = (await http('GET', HOST, open.pathname + open.search)).cookie!;
const residents = await http('GET', HOST, '/manage/residents', { cookie: admin });
const asResident = (await http('POST', HOST, '/manage/residents', { cookie: admin, form: { [actionIn(residents.body, `name="residentId" value="${resident.id}"`)]: '', residentId: resident.id } })).cookie!;

const byKind = (k: string) => facilities.find((f) => f.kind === k)!;
const routes: Array<{ path: string; cookie: string | null; host?: string }> = [
  { path: '/', cookie: null, host: 'localhost' },
  { path: '/login', cookie: null, host: 'localhost' },
  { path: '/login?error=invalid&sent=1&dev=http%3A%2F%2Fdemo-north.localhost%3A3000%2Fauth%2Fverify%3Ftoken%3Dabcdefghijklmnopqrstuvwxyz0123456789', cookie: null, host: 'localhost' },
  { path: '/signup', cookie: null, host: 'localhost' },
  { path: '/signup?sent=1', cookie: null, host: 'localhost' },
  { path: '/privacy', cookie: null, host: 'localhost' },
  { path: '/terms', cookie: null, host: 'localhost' },
  { path: '/platform', cookie: login.cookie!, host: 'localhost' },
  { path: '/account', cookie: login.cookie!, host: 'localhost' },
  { path: '/', cookie: null },
  { path: '/?error=invalid&sent=1&dev=http%3A%2F%2Fdemo-north.localhost%3A3000%2Fauth%2Fverify%3Ftoken%3Dabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ', cookie: null },
  { path: '/', cookie: null, host: 'unknown-org.localhost' },
  { path: '/privacy', cookie: null },
  { path: '/auth/verify?token=x', cookie: null },
  { path: '/book', cookie: asResident },
  { path: `/book/f/${byKind('laundry').id}`, cookie: asResident },
  { path: `/book/f/${byKind('sauna').id}`, cookie: asResident },
  { path: `/book/f/${byKind('common_room').id}?error=weekly&skipped=2`, cookie: asResident },
  { path: '/book/parking', cookie: asResident },
  { path: '/account', cookie: asResident },
  { path: '/manage/overview', cookie: admin },
  { path: '/manage', cookie: admin },
  { path: `/manage/b/${building.id}`, cookie: admin },
  { path: '/manage/residents?imported=1,2,3&errors=4%3A%20invalid%20email', cookie: admin },
  { path: '/platform', cookie: admin },
  { path: `/platform/o/${org.id}`, cookie: admin },
  { path: '/account', cookie: admin },
];

// The picked-slot panel: first free laundry slot tomorrow.
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(12, 0, 0, 0);
const d = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
routes.push({ path: `/book/f/${byKind('common_room').id}?day=${d}&pick=${encodeURIComponent(tomorrow.toISOString())}`, cookie: asResident });

const browser = await Browser.launch();
let failures = 0;
try {
  await browser.send('Network.enable');
  for (const route of routes) {
    const host = route.host ?? HOST;
    await browser.send('Network.clearBrowserCookies');
    if (route.cookie) {
      const [name, value] = route.cookie.split('=');
      await browser.send('Network.setCookie', { name, value: route.cookie.slice(name!.length + 1), domain: host, path: '/', httpOnly: true });
      void value;
    }
    for (const width of WIDTHS) {
      await browser.viewport(width, 800);
      await browser.goto(`http://${host}:3000${route.path}`);
      const result = await browser.eval<{ scroll: number; inner: number; offenders: string[]; url: string }>(`(() => {
        const inner = window.innerWidth;
        const offenders = [];
        for (const el of document.querySelectorAll('body *')) {
          // Decorative, clipped glows are allowed past the edge; the page scroll check still applies.
          if (el.closest('[aria-hidden="true"]')) continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > inner + 1) {
            offenders.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ' right=' + Math.round(r.right));
          }
        }
        return { scroll: document.documentElement.scrollWidth, inner, offenders: offenders.slice(0, 5), url: location.pathname };
      })()`);
      const ok = result.scroll <= result.inner && result.offenders.length === 0;
      const redirected = result.url !== route.path.split('?')[0];
      if (!ok || redirected) failures += 1;
      console.log(`${ok && !redirected ? 'PASS' : 'FAIL'} ${width}px ${host}${route.path.slice(0, 70)}${redirected ? ` (ended at ${result.url})` : ''}${ok ? '' : ` scroll=${result.scroll} ${result.offenders.join(', ')}`}`);
      if (shots) writeFileSync(join(shots, `${width}-${route.path.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.png`), await browser.screenshot());
    }
  }
} finally {
  await browser.close();
}
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
