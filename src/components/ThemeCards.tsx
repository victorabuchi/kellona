'use client';

import { useState } from 'react';
import styles from './account.module.css';
import { THEME_COOKIE, type Theme } from '../lib/theme-constants';

// Theme choice as small previews of the app, applied at once.
export default function ThemeCards({ initial, labels }: { initial: Theme; labels: Record<Theme, string> }) {
  const [theme, setTheme] = useState<Theme>(initial);
  return (
    <div className={styles.themeCards} role="radiogroup">
      {(['system', 'light', 'dark'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          className={styles.themeCard}
          onClick={() => {
            setTheme(t);
            document.documentElement.dataset['theme'] = t;
            document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
          }}
        >
          <span className={`${styles.preview} ${styles[`preview_${t}`]}`} aria-hidden="true">
            <i className={styles.pvRail} />
            <i className={styles.pvTop} />
            <i className={styles.pvCard} />
            <i className={styles.pvCard2} />
          </span>
          <span className={styles.themeName}>
            <i className={styles.radio} />
            {labels[t]}
          </span>
        </button>
      ))}
    </div>
  );
}
