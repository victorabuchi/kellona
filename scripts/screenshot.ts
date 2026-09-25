// Usage: tsx scripts/screenshot.ts <url> <out.png> [width=390] [dark]
import { writeFileSync } from 'node:fs';
import { Browser } from './lib/chrome';

const [url, out, width = '390', scheme] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: tsx scripts/screenshot.ts <url> <out.png> [width] [dark]');
  process.exit(1);
}
const browser = await Browser.launch();
try {
  await browser.viewport(Number(width), 844, scheme === 'dark');
  await browser.goto(url);
  writeFileSync(out, await browser.screenshot());
  console.log(out);
} finally {
  await browser.close();
}
