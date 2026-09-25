export type BrandInput = {
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  appIconUrl: string | null;
  primaryColor: string;
  accentColor: string;
};

// Kellona's own look, used on hosts without an organization.
export const DEFAULT_BRAND: BrandInput = {
  logoLightUrl: '/kellona/logo.svg',
  logoDarkUrl: '/kellona/logo-dark.svg',
  faviconUrl: '/kellona/icon.svg',
  appIconUrl: '/kellona/icon.svg',
  primaryColor: '#2f5d8a',
  accentColor: '#e0a526',
};
