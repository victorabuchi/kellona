'use client';

import { useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from './shell.module.css';
import { setLocaleAction } from '../lib/i18n/actions';

const NAMES: Record<string, string> = { fi: 'Suomi', en: 'English' };

// Language select for the top bar; switches on change and returns to the same page.
export default function LangToggle({ current, locales, label }: { current: string; locales: string[]; label: string }) {
  const path = usePathname();
  const search = useSearchParams();
  const form = useRef<HTMLFormElement>(null);
  if (locales.length < 2) return null;
  const back = `${path}${search.size ? `?${search.toString()}` : ''}`;
  return (
    <form ref={form} action={setLocaleAction} className={styles.langForm}>
      <input type="hidden" name="back" value={back} />
      <select name="locale" defaultValue={current} aria-label={label} className={styles.langSelect} onChange={() => form.current?.requestSubmit()}>
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {NAMES[l] ?? l.toUpperCase()}
          </option>
        ))}
      </select>
    </form>
  );
}
