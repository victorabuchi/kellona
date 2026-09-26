// Clicks through the super-admin path in real headless Chrome, which plain
// HTTP checks cannot cover: pages rendered right after a server action run
// through Next's internal request (see src/lib/tenant/request-host.ts).
// Usage: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD='...' npx tsx scripts/e2e-browser.ts [org-slug]
import { Browser } from './lib/browser';

const slug = process.argv[2] ?? 'demo-north';
const email = process.env['E2E_ADMIN_EMAIL']!;
const password = process.env['E2E_ADMIN_PASSWORD']!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`);
  if (!ok) failures += 1;
}

const b = await Browser.launch();
try {
  await b.viewport(1280, 860);
  await b.goto('http://localhost:3000/login');
  await b.eval(`(() => {
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(document.querySelector('input[name=email]'), ${JSON.stringify(email)});
    set(document.querySelector('input[name=password]'), ${JSON.stringify(password)});
    document.querySelector('form button[type=submit]').click();
  })()`);
  await wait(4000);
  const afterLogin = await b.eval<string>('location.href');
  check('sign in lands on the organizations list', afterLogin.endsWith('/platform'), afterLogin);

  await b.goto(`http://localhost:3000/platform`);
  const open = await b.eval<string>(`[...document.querySelectorAll('a[href^="/platform/open/"]')].map(a => a.href).find(h => true) ?? ''`);
  const target = await b.eval<string>(`(() => { const card = [...document.querySelectorAll('a[href^="/platform/open/"]')].find(a => a.closest('div').parentElement.textContent.includes(${JSON.stringify(slug === 'demo-north' ? 'Northwind' : slug)})); return card ? card.href : ''; })()`);
  await b.goto(target || open);
  await wait(3000);
  const inOrg = await b.eval<string>('location.href');
  check('Open lands on the organization overview', inOrg.includes(`${slug}.localhost`) && inOrg.endsWith('/manage/overview'), inOrg);

  await b.goto(`http://${slug}.localhost:3000/manage/booking`);
  await wait(1500);
  await b.eval(`document.querySelector('form button').click()`);
  await wait(4000);
  const title = await b.eval<string>('document.title');
  const body = await b.eval<string>('document.body.innerText');
  check('Open booking shows the booking hub in the organization', (await b.eval<string>('location.href')).endsWith('/book') && !title.includes('Kellona') && !body.includes('404'), `${title} ${body.slice(0, 80)}`);

  const facility = await b.eval<string>(`document.querySelector('a[href^="/book/f/"]')?.href ?? ''`);
  await b.goto(facility);
  await wait(2000);
  check('facility board loads', (await b.eval<boolean>(`Boolean(document.querySelector('[role=grid]'))`)), facility);

  await b.eval(`[...document.querySelectorAll('form button')].find(x => x.textContent.includes('Back to admin') || x.textContent.includes('Takaisin')).click()`);
  await wait(4000);
  check('Back to admin returns to the booking list', (await b.eval<string>('location.href')).endsWith('/manage/booking'), await b.eval<string>('location.href'));
} finally {
  await b.close();
}
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
