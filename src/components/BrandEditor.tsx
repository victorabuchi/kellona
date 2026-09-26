'use client';

import { useState } from 'react';
import styles from './app.module.css';
import { derivePalette } from '../lib/brand/color';

type Labels = { primary: string; accent: string; logoLight: string; logoDark: string; icon: string; hint: string; suggest: string; preview: string; save: string };

// Picks the most common strongly colored pixel group in the logo.
async function suggestFrom(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    const size = 96;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (a < 200 || max - min < 40 || max < 40 || min > 230) continue;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      buckets.set(key, { n: e.n + 1, r: e.r + r, g: e.g + g, b: e.b + b });
    }
    const best = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
    if (!best) return null;
    const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, '0');
    return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function BrandEditor({
  action,
  orgId,
  initial,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  orgId: string;
  initial: { primary: string; accent: string; logoLight: string | null; logoDark: string | null; name: string };
  labels: Labels;
}) {
  const [primary, setPrimary] = useState(initial.primary);
  const [accent, setAccent] = useState(initial.accent);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoLight);
  const p = derivePalette(primary, accent);

  return (
    <form action={action} className={styles.section}>
      <input type="hidden" name="id" value={orgId} />
      <div className={styles.form}>
        <label className={styles.field}>
          {labels.logoLight}
          <input
            type="file"
            name="logoLight"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setLogo(f);
              setLogoPreview(f ? URL.createObjectURL(f) : initial.logoLight);
            }}
          />
        </label>
        <label className={styles.field}>
          {labels.logoDark}
          <input type="file" name="logoDark" accept="image/png,image/svg+xml,image/jpeg,image/webp" />
        </label>
        <label className={styles.field}>
          {labels.icon}
          <input type="file" name="icon" accept="image/png,image/svg+xml,image/jpeg,image/webp" />
        </label>
        <span className={`${styles.hint} ${styles.full}`}>{labels.hint}</span>
        <label className={styles.field}>
          {labels.primary}
          <input className={styles.swatch} type="color" name="primaryColor" value={primary} onChange={(e) => setPrimary(e.target.value)} />
        </label>
        <label className={styles.field}>
          {labels.accent}
          <input className={styles.swatch} type="color" name="accentColor" value={accent} onChange={(e) => setAccent(e.target.value)} />
        </label>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={!logo}
          onClick={async () => {
            if (!logo) return;
            const c = await suggestFrom(logo);
            if (c) setPrimary(c);
          }}
        >
          {labels.suggest}
        </button>
      </div>

      <div className={styles.preview} aria-label={labels.preview}>
        <span className={styles.hint}>{labels.preview}</span>
        {logoPreview && (
          <span className={styles.logoBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoPreview} alt={initial.name} style={{ height: 48, width: 'auto', maxWidth: '100%' }} />
          </span>
        )}
        {initial.logoDark && (
          <span className={styles.logoBoxDark}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={initial.logoDark} alt={initial.name} style={{ height: 48, width: 'auto', maxWidth: '100%' }} />
          </span>
        )}
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={styles.btn} style={{ background: p.primary, borderColor: p.primary, color: p.onPrimary }}>
            {initial.name}
          </span>
          <span className={styles.btn} style={{ background: p.primaryHover, borderColor: p.primaryHover, color: p.onPrimary }}>
            hover
          </span>
          <span className={styles.chip} style={{ background: p.accent, color: p.onAccent, borderColor: p.accent }}>
            {labels.accent}
          </span>
          <span className={styles.chip} style={{ background: p.primaryTint, color: p.primaryText }}>
            {labels.primary}
          </span>
        </span>
      </div>
      <div>
        <button className={styles.btn}>{labels.save}</button>
      </div>
    </form>
  );
}
