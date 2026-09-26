// Usage: tsx scripts/screenshot.ts <url> <out.png> [width=390] [dark|light] [scrollY=0] [waitMs=0]
import { writeFileSync } from 'node:fs';
import { Browser } from './lib/browser';

const [url, out, width = '390', scheme, scroll = '0', wait = '0'] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: tsx scripts/screenshot.ts <url> <out.png> [width] [dark|light] [scrollY] [waitMs]');
  process.exit(1);
}
const browser = await Browser.launch();
try {
  await browser.viewport(Number(width), Number(width) >= 1000 ? 860 : 844, scheme === 'dark');
  await browser.goto(url);
  if (Number(scroll)) await browser.eval(`window.scrollTo(0, ${Number(scroll)})`);
  await new Promise((r) => setTimeout(r, 400 + Number(wait)));
  writeFileSync(out, await browser.screenshot());
  console.log(out);
} finally {
  await browser.close();
}
