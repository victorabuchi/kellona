import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, derivePalette, parseHex } from '../src/lib/brand/color';
import { brandCss } from '../src/lib/brand/css';

const WHITE = { r: 255, g: 255, b: 255 };
const SAMPLES = ['#1d3f6e', '#2e7d4f', '#f2a900', '#ffeb3b', '#000000', '#ffffff', '#e76f51', '#7b1fa2', '#00bcd4'];

test('text on brand color is always readable', () => {
  for (const hex of SAMPLES) {
    for (const scheme of ['light', 'dark'] as const) {
      const p = derivePalette(hex, hex, scheme);
      const ratio = contrast(parseHex(p.primary)!, parseHex(p.onPrimary)!);
      assert.ok(ratio >= 3, `${hex} ${scheme}: on-brand contrast ${ratio.toFixed(2)}`);
    }
  }
});

test('brand colored text reaches 4.5:1 on white', () => {
  for (const hex of SAMPLES) {
    const p = derivePalette(hex, '#000000', 'light');
    const ratio = contrast(parseHex(p.primaryText)!, WHITE);
    assert.ok(ratio >= 4.5, `${hex}: text contrast ${ratio.toFixed(2)}`);
  }
});

test('hover differs from the base color', () => {
  for (const hex of SAMPLES) assert.notEqual(derivePalette(hex, hex).primaryHover, derivePalette(hex, hex).primary);
});

test('invalid colors fall back instead of leaking into CSS', () => {
  const css = brandCss({ primaryColor: 'red;}body{display:none', accentColor: '#abc' });
  assert.ok(!css.includes('display:none'));
  assert.ok(css.includes('--brand:#2f5d8a'));
});
