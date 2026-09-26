import type { BrandInput } from '../lib/brand/defaults';

// Logo URLs come from organization data (storage or /public), so a plain img
// is used rather than next/image, which would need every host allow listed.
// Light and dark versions follow the app theme (data-theme), not the device,
// so a light page never shows the white logo.
export default function Logo({ brand, name, height = 60, className }: { brand: BrandInput; name: string; height?: number; className?: string }) {
  const light = brand.logoLightUrl ?? brand.appIconUrl ?? brand.faviconUrl;
  if (!light) return <span className={className}>{name}</span>;
  const style = { height, width: 'auto', maxWidth: '100%' } as const;
  return (
    <span className={className} style={{ display: 'inline-block', maxWidth: '100%' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light} alt={name} style={style} className={brand.logoDarkUrl ? 'kl-logo-light' : undefined} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {brand.logoDarkUrl && <img src={brand.logoDarkUrl} alt={name} style={style} className="kl-logo-dark" />}
    </span>
  );
}
