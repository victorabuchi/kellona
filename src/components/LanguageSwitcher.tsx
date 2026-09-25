import { setLocaleAction } from '../lib/i18n/actions';
import type { Locale } from '../lib/i18n/messages';
import styles from './auth.module.css';

const LABELS: Record<Locale, string> = { fi: 'Suomi', en: 'English' };

export default function LanguageSwitcher({ locales, current, back, label }: { locales: string[]; current: Locale; back: string; label: string }) {
  const offered = locales.filter((l): l is Locale => l === 'fi' || l === 'en');
  if (offered.length < 2) return null;
  return (
    <form action={setLocaleAction} className={styles.langs} aria-label={label}>
      <input type="hidden" name="back" value={back} />
      {offered.map((l) => (
        <button key={l} type="submit" name="locale" value={l} className={styles.lang} aria-pressed={l === current} lang={l}>
          {LABELS[l]}
        </button>
      ))}
    </form>
  );
}
