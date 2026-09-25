// Color math for runtime branding. Everything derives from the two colors an
// organization picks, so a new customer never needs hand tuned CSS.

export type Rgb = { r: number; g: number; b: number };

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

export function parseHex(value: string): Rgb | null {
  const m = HEX.exec(value.trim());
  if (!m) return null;
  let hex = m[1]!;
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = Number.parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

// Linear blend: weight 0 keeps a, weight 1 gives b.
export function mix(a: Rgb, b: Rgb, weight: number): Rgb {
  return { r: a.r + (b.r - a.r) * weight, g: a.g + (b.g - a.g) * weight, b: a.b + (b.b - a.b) * weight };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const INK: Rgb = { r: 23, g: 26, b: 31 };
const DARK_SURFACE: Rgb = { r: 22, g: 25, b: 30 };

export function luminance({ r, g, b }: Rgb): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// White or near black text, whichever reads better on the background.
export function textOn(bg: Rgb): Rgb {
  return contrast(bg, WHITE) >= contrast(bg, INK) ? WHITE : INK;
}

// Moves a color toward black (or white) until it reaches the contrast target
// against the given background, so brand colored text and links stay readable.
export function ensureContrast(color: Rgb, bg: Rgb, target = 4.5): Rgb {
  if (contrast(color, bg) >= target) return color;
  const toward = luminance(bg) > 0.5 ? BLACK : WHITE;
  for (let w = 0.05; w <= 1; w += 0.05) {
    const next = mix(color, toward, w);
    if (contrast(next, bg) >= target) return next;
  }
  return toward;
}

export type Palette = {
  primary: string;
  primaryHover: string;
  primaryTint: string;
  primaryTintStrong: string;
  onPrimary: string;
  primaryText: string;
  accent: string;
  accentHover: string;
  onAccent: string;
  accentTint: string;
};

function hover(c: Rgb): Rgb {
  // Darken light colors and lighten very dark ones so hover is always visible.
  return luminance(c) < 0.06 ? mix(c, WHITE, 0.18) : mix(c, BLACK, 0.14);
}

export function derivePalette(primaryHex: string, accentHex: string, scheme: 'light' | 'dark' = 'light'): Palette {
  const primary = parseHex(primaryHex) ?? parseHex('#2f5d8a')!;
  const accent = parseHex(accentHex) ?? parseHex('#e0a526')!;
  const surface = scheme === 'light' ? WHITE : DARK_SURFACE;
  // In dark mode a deep brand color is lifted so buttons do not vanish.
  const base = scheme === 'dark' && contrast(primary, surface) < 3 ? ensureContrast(primary, surface, 3) : primary;
  return {
    primary: toHex(base),
    primaryHover: toHex(hover(base)),
    primaryTint: toHex(mix(surface, base, scheme === 'light' ? 0.09 : 0.18)),
    primaryTintStrong: toHex(mix(surface, base, scheme === 'light' ? 0.2 : 0.32)),
    onPrimary: toHex(textOn(base)),
    primaryText: toHex(ensureContrast(base, surface, 4.5)),
    accent: toHex(accent),
    accentHover: toHex(hover(accent)),
    onAccent: toHex(textOn(accent)),
    accentTint: toHex(mix(surface, accent, scheme === 'light' ? 0.14 : 0.22)),
  };
}
