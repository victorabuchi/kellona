'use client';

import { useState } from 'react';
import styles from './shell.module.css';
import { THEME_COOKIE, type Theme } from '../lib/theme-constants';

const ICONS: Record<Theme, string> = {
  light: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  dark: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  system: 'M3 4h18v12H3zM8 20h8M12 16v4',
};

// Applies the theme at once and remembers it for a year.
export default function ThemeSwitcher({ initial, labels }: { initial: Theme; labels: Record<Theme, string> }) {
  const [theme, setTheme] = useState<Theme>(initial);
  return (
    <div className={styles.segmented} role="radiogroup">
      {(['light', 'dark', 'system'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          className={styles.segment}
          title={labels[t]}
          onClick={() => {
            setTheme(t);
            document.documentElement.dataset['theme'] = t;
            document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICONS[t]} />
          </svg>
          <span>{labels[t]}</span>
        </button>
      ))}
    </div>
  );
}
