import Link from 'next/link';
import Logo from './Logo';
import LanguageSwitcher from './LanguageSwitcher';
import styles from './auth.module.css';
import type { OrgContext } from '../lib/tenant/load';
import type { T } from '../lib/i18n';
import type { Locale } from '../lib/i18n/messages';
import { DEFAULT_BRAND } from '../lib/brand/defaults';

// Frame for sign-in and public pages: centered logo, one card, quiet footer.
export default function AuthShell({
  org,
  t,
  locale,
  back,
  wide = false,
  title,
  aside,
  children,
}: {
  org: OrgContext | null;
  t: T;
  locale: Locale;
  back: string;
  wide?: boolean;
  // Short heading under the logo, and a second small card under the main one.
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.logoWrap}>
        <Link href="/" aria-label={org?.name ?? 'Kellona'}>
          <Logo brand={org?.brand ?? DEFAULT_BRAND} name={org?.name ?? 'Kellona'} />
        </Link>
        {org?.isDemo && <span className={styles.demo}>{t('common.demoBadge')}</span>}
        {title && <h1 className={styles.logoTitle}>{title}</h1>}
      </header>
      <main className={`${styles.card} ${wide ? styles.cardWide : ''}`}>{children}</main>
      {aside && <div className={`${styles.switchBox} ${wide ? styles.cardWide : ''}`}>{aside}</div>}
      <footer className={styles.footer}>
        <nav className={styles.links}>
          <Link href="/privacy">{t('common.privacy')}</Link>
          <Link href="/terms">{t('common.terms')}</Link>
          {org?.supportEmail && <a href={`mailto:${org.supportEmail}`}>{t('common.support')}</a>}
        </nav>
        <LanguageSwitcher locales={org?.locales ?? ['fi', 'en']} current={locale} back={back} label={t('common.language')} />
      </footer>
    </div>
  );
}
