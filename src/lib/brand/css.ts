import { derivePalette, isHexColor, type Palette } from './color';
import type { BrandInput } from './defaults';

function vars(p: Palette): string {
  return [
    `--brand:${p.primary}`,
    `--brand-hover:${p.primaryHover}`,
    `--brand-tint:${p.primaryTint}`,
    `--brand-tint-strong:${p.primaryTintStrong}`,
    `--on-brand:${p.onPrimary}`,
    `--brand-text:${p.primaryText}`,
    `--accent:${p.accent}`,
    `--accent-hover:${p.accentHover}`,
    `--on-accent:${p.onAccent}`,
    `--accent-tint:${p.accentTint}`,
  ].join(';');
}

// CSS for the <style> tag in the root layout. Colors are validated hex values,
// so nothing an admin types can break out of the declaration.
export function brandCss(brand: Pick<BrandInput, 'primaryColor' | 'accentColor'>): string {
  const primary = isHexColor(brand.primaryColor) ? brand.primaryColor : '#2f5d8a';
  const accent = isHexColor(brand.accentColor) ? brand.accentColor : '#e0a526';
  const light = vars(derivePalette(primary, accent, 'light'));
  const dark = vars(derivePalette(primary, accent, 'dark'));
  return `:root{${light}}@media (prefers-color-scheme: dark){:root{${dark}}}`;
}
