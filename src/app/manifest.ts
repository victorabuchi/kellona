import type { MetadataRoute } from 'next';
import { getCurrentOrg } from '../lib/tenant/org';
import { derivePalette } from '../lib/brand/color';
import { DEFAULT_BRAND } from '../lib/brand/defaults';

// Per organization, so the installed app carries the customer's name and icon.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const org = await getCurrentOrg();
  const brand = org?.brand ?? DEFAULT_BRAND;
  const icon = brand.appIconUrl ?? brand.faviconUrl ?? DEFAULT_BRAND.appIconUrl!;
  const type = icon.endsWith('.svg') ? 'image/svg+xml' : icon.endsWith('.png') ? 'image/png' : undefined;
  return {
    id: '/',
    name: org?.name ?? 'Kellona',
    short_name: org?.shortName ?? 'Kellona',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: derivePalette(brand.primaryColor, brand.accentColor).primary,
    lang: org?.defaultLocale ?? 'fi',
    icons: [
      { src: icon, sizes: 'any', type, purpose: 'any' },
      { src: icon, sizes: 'any', type, purpose: 'maskable' },
    ],
  };
}
