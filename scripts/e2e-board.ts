// Real-browser checks of the live booking board (tap, sheet, long press,
// refresh, cancel, language) on a demo organization. Books as a demo resident
// through "view as" and removes the bookings it made.
// Usage: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD='...' TZ=Europe/Helsinki npx tsx scripts/e2e-board.ts
import { writeFileSync } from 'node:fs';
import { Browser } from './lib/browser';
import { actionIn, http } from './lib/http';
import { db } from '../src/prisma/db';
import { orgScope } from '../src/lib/tenant/scope';

const H = 'demo-north.localhost';
const shots = process.argv[2];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`);
  if (!ok) failures += 1;
}

const org = (await db.orm.public.Organization.where({ slug: 'demo-north' }).first())!;
const s = orgScope(org.id);
const resident = (await s.residents.q().where({ email: 'aino@demo-north.example.test' }).first())!;
const machine = (await s.facilities.q().where({ name: 'Machine 2' }).first())!;
const other = (await s.facilities.q().where({ name: 'Machine 1', buildingId: machine.buildingId }).first())!;
const otherTaken = (await s.bookings.q().where({ facilityId: other.id }).all()).map((x) => new Date(x.startsAt).toISOString());
const before = new Set((await s.bookings.q().where({ residentId: resident.id }).all()).map((b) => b.id));

const page = await http('GET', 'localhost', '/login');
const login = await http('POST', 'localhost', '/login', { form: { [actionIn(page.body, 'name="password"')]: '', email: process.env['E2E_ADMIN_EMAIL']!, password: process.env['E2E_ADMIN_PASSWORD']! } });
const open = new URL((await http('GET', 'localhost', `/platform/open/${org.id}`, { cookie: login.cookie })).location);
const admin = (await http('GET', H, open.pathname + open.search)).cookie!;
const residents = await http('GET', H, '/manage/residents', { cookie: admin });
const asResident = (await http('POST', H, '/manage/residents', { cookie: admin, form: { [actionIn(residents.body, `name="residentId" value="${resident.id}"`)]: '', residentId: resident.id } })).cookie!;

const b = await Browser.launch();
const freeCells = `[...document.querySelectorAll('[role=grid] button')].filter(e => e.className.includes('free'))`;
const center = async (expr: string) =>
  b.eval<{ x: number; y: number } | null>(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
const click = (p: { x: number; y: number }, holdMs = 40) => b.press(p, holdMs);
const created = async () => (await s.bookings.q().where({ residentId: resident.id }).all()).filter((x) => !before.has(x.id));

try {
  await b.setCookie({ name: 'kellona_session', value: asResident.slice('kellona_session='.length), domain: H });
  await b.setCookie({ name: 'kellona_locale', value: 'en', domain: H });
  await b.viewport(1280, 860);
  await b.goto(`http://${H}:3000/book/f/${machine.id}`);
  await wait(1500);

  // Tap a free time, reserve in the sheet: stays on the page, no reload.
  // A time that is free on this machine and on Machine 1, so the double booking
  // check below is about the resident and not about Machine 1 being busy.
  const target = await center(`${freeCells}.filter(e => !${JSON.stringify(otherTaken)}.includes(e.dataset.start))[4]`);
  const targetStart = await b.eval<string>(`${freeCells}.filter(e => !${JSON.stringify(otherTaken)}.includes(e.dataset.start))[4].dataset.start`);
  check('the board has free times', Boolean(target));
  await b.eval(`window.__marker = 'same-page'`);
  const scrollBefore = await b.eval<number>('window.scrollY');
  await click(target!);
  await wait(500);
  check('tapping a free time opens the confirm sheet', await b.eval<boolean>(`Boolean(document.querySelector('dialog[open]'))`));
  if (shots) writeFileSync(`${shots}/board-sheet.png`, await b.screenshot());
  await b.eval(`[...document.querySelectorAll('dialog[open] button')].find(x => x.textContent.trim() === 'Reserve').click()`);
  await wait(3500);
  const afterBook = await created();
  check('reserve books the time', afterBook.length === 1, String(afterBook.length));
  check('the page did not reload', (await b.eval<string>('String(window.__marker)')) === 'same-page');
  check('the scroll position stayed', Math.abs((await b.eval<number>('window.scrollY')) - scrollBefore) < 80, `${scrollBefore}`);
  check('a confirmation shows', (await b.eval<string>('document.body.innerText')).includes('Booked'));
  check('the slot now shows Yours', await b.eval<boolean>(`[...document.querySelectorAll('[role=grid] button')].some(e => e.className.includes('mine'))`));
  if (shots) writeFileSync(`${shots}/board-booked.png`, await b.screenshot());

  await wait(1500);
  check('the confirmation hides again after a moment', !(await b.eval<string>('document.body.innerText')).includes('See you then'));

  // Long press another free time books it straight away.
  await wait(500);
  const second = await center(`${freeCells}[8]`);
  await click(second!, 800);
  await wait(3500);
  check('long press books a free time instantly', (await created()).length === 2, String((await created()).length));

  // Refresh button re-renders without reloading.
  await b.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('Refresh')).click()`);
  await wait(2500);
  check('refresh keeps the page and updates', (await b.eval<string>('String(window.__marker)')) === 'same-page' && (await b.eval<string>('document.body.innerText')).includes('updated'));

  // Cancel from the sheet of an own booking.
  const mine = await center(`[...document.querySelectorAll('[role=grid] button')].find(e => e.className.includes('mine') && e.dataset.start !== '${targetStart}')`);
  await click(mine!);
  await wait(500);
  await b.eval(`[...document.querySelectorAll('dialog[open] button')].find(x => x.textContent.trim() === 'Cancel booking').click()`);
  await wait(600);
  check('cancel asks to confirm first', (await created()).length === 2 && (await b.eval<boolean>(`Boolean(document.querySelector('dialog[open] [role=alertdialog]'))`)));
  if (shots) writeFileSync(`${shots}/board-cancel-confirm.png`, await b.screenshot());
  await b.eval(`[...document.querySelectorAll('dialog[open] button')].find(x => x.textContent.trim() === 'Yes, cancel').click()`);
  await wait(3500);
  check('confirming cancels the booking in place', (await created()).length === 1 && (await b.eval<string>('String(window.__marker)')) === 'same-page');

  // The same time on the other machine: told it is already booked.
  await b.goto(`http://${H}:3000/book/f/${other.id}`);
  await wait(1500);
  const sameTime = await center(`document.querySelector('[role=grid] button[data-start="${targetStart}"]')`);
  await click(sameTime!);
  await wait(500);
  await b.eval(`[...document.querySelectorAll('dialog[open] button')].find(x => x.textContent.trim() === 'Reserve').click()`);
  await wait(2500);
  check('booking the same time twice says it is already booked', (await b.eval<string>('document.body.innerText')).includes('You have already booked this time'), targetStart);
  check('the message is not hidden behind the sheet', !(await b.eval<boolean>(`Boolean(document.querySelector('dialog[open]'))`)));
  if (shots) writeFileSync(`${shots}/board-mine.png`, await b.screenshot());
  check('and no second booking was made', (await created()).length === 1, String((await created()).length));

  // Language switch in the top bar.
  const pickLang = (from: string, to: string) =>
    b.eval(`(() => { const s = document.querySelector('select[aria-label=${from}]'); s.value = '${to}'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  check('the language switch is a select with full names', await b.eval<boolean>(`[...document.querySelectorAll('select[aria-label=Language] option')].map(o => o.textContent).join() === 'Suomi,English'`));
  await pickLang('Language', 'fi');
  await wait(3000);
  check('FI switch shows the board in Finnish', (await b.eval<string>('document.body.innerText')).includes('Päivitä'));
  await pickLang('Kieli', 'en');
  await wait(3000);
  check('EN switch shows it in English again', (await b.eval<string>('document.body.innerText')).includes('Refresh'));

  // Phone: day chips and slot pills.
  await b.viewport(390, 844);
  await b.goto(`http://${H}:3000/book/f/${machine.id}`);
  await wait(1500);
  check('phone view shows day chips and slots', await b.eval<boolean>(`document.querySelectorAll('[aria-pressed]').length >= 7`));
  if (shots) writeFileSync(`${shots}/board-phone.png`, await b.screenshot());
} finally {
  await b.close();
  for (const x of await created()) await s.bookings.q().where({ id: x.id }).delete();
  await db.close();
}
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
