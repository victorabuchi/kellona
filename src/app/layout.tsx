import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';
import { getCurrentOrg } from '../lib/tenant/org';
import { getT } from '../lib/i18n';
import { brandCss } from '../lib/brand/css';
import { derivePalette } from '../lib/brand/color';
import { DEFAULT_BRAND } from '../lib/brand/defaults';

const figtree = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });

export async function generateMetadata(): Promise<Metadata> {
  const org = await getCurrentOrg();
  const { t } = await getT(org);
  const brand = org?.brand ?? DEFAULT_BRAND;
  const name = org?.name ?? 'Kellona';
  const icon = brand.faviconUrl ?? brand.appIconUrl ?? DEFAULT_BRAND.faviconUrl!;
  return {
    title: { default: name, template: `%s | ${org?.shortName ?? 'Kellona'}` },
    description: t('meta.description'),
    applicationName: org?.shortName ?? 'Kellona',
    icons: { icon, apple: brand.appIconUrl ?? icon },
    appleWebApp: { capable: true, title: org?.shortName ?? 'Kellona' },
    robots: { index: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const org = await getCurrentOrg();
  const brand = org?.brand ?? DEFAULT_BRAND;
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: derivePalette(brand.primaryColor, brand.accentColor).primary,
  };
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const org = await getCurrentOrg();
  const { locale } = await getT(org);
  const brand = org?.brand ?? DEFAULT_BRAND;
  return (
    <html lang={locale} className={figtree.variable}>
      <head>
        <style id="brand" dangerouslySetInnerHTML={{ __html: brandCss(brand) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
