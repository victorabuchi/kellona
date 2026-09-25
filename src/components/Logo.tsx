import type { BrandInput } from '../lib/brand/defaults';

// Logo URLs come from organization data (storage or /public), so a plain img
// is used rather than next/image, which would need every host allow listed.
export default function Logo({ brand, name, height = 60, className }: { brand: BrandInput; name: string; height?: number; className?: string }) {
  const light = brand.logoLightUrl ?? brand.appIconUrl ?? brand.faviconUrl;
  if (!light) return <span className={className}>{name}</span>;
  return (
    <picture className={className}>
      {brand.logoDarkUrl && <source srcSet={brand.logoDarkUrl} media="(prefers-color-scheme: dark)" />}
      <img src={light} alt={name} style={{ height, width: 'auto', maxWidth: '100%', display: 'block' }} />
    </picture>
  );
}
