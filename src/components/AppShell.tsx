import Link from 'next/link';
import Logo from './Logo';
import styles from './app.module.css';
import type { OrgContext } from '../lib/tenant/load';
import type { Viewer } from '../lib/auth/viewer';
import type { T } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n/messages';
import { stopActingAction } from '../lib/auth/acting-actions';
import { signOutAction } from '../lib/auth/actions';
import { DEFAULT_BRAND } from '../lib/brand/defaults';

type Tab = { href: string; label: MessageKey; icon: keyof typeof ICONS };

const ICONS = {
  book: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
};

function tabsFor(viewer: Viewer, hasOrg: boolean): Tab[] {
  if (viewer.kind === 'resident') {
    return [
      { href: '/book', label: 'nav.book', icon: 'book' },
      { href: '/account', label: 'nav.account', icon: 'user' },
    ];
  }
  // Super-admin on Kellona's own address: organizations and account only.
  if (!hasOrg) {
    return [
      { href: '/platform', label: 'nav.organizations', icon: 'grid' },
      { href: '/account', label: 'nav.account', icon: 'user' },
    ];
  }
  const tabs: Tab[] = [
    { href: '/manage', label: 'nav.buildings', icon: 'building' },
    { href: '/manage/residents', label: 'nav.residents', icon: 'people' },
    { href: '/account', label: 'nav.account', icon: 'user' },
  ];
  if (viewer.kind === 'admin') tabs.push({ href: '/platform', label: 'nav.platform', icon: 'grid' });
  return tabs;
}

export default function AppShell({
  org,
  viewer,
  t,
  active,
  title,
  children,
}: {
  org: OrgContext | null;
  viewer: Viewer;
  t: T;
  active: string;
  title: string;
  children: React.ReactNode;
}) {
  const tabs = tabsFor(viewer, Boolean(org));
  const brand = org?.brand ?? DEFAULT_BRAND;
  const name = org?.name ?? 'Kellona';
  return (
    <div className={styles.shell}>
      {viewer.kind === 'resident' && viewer.actingAdminId && (
        <form action={stopActingAction} className={styles.acting}>
          <span>{t('acting.banner', { name: viewer.name })}</span>
          <button type="submit">{t('acting.stop')}</button>
        </form>
      )}
      <header className={styles.top}>
        <Link href={tabs[0]!.href} className={styles.brand} aria-label={name}>
          <Logo brand={brand} name={name} height={32} />
        </Link>
        <div className={styles.topRight}>
          <nav className={styles.topNav}>
            {tabs.map((tab) => (
              <Link key={tab.href} href={tab.href} className={styles.topLink} aria-current={active === tab.href ? 'page' : undefined}>
                {t(tab.label)}
              </Link>
            ))}
          </nav>
          <form action={signOutAction}>
            <button type="submit" className={styles.signOut} aria-label={t('nav.signOut')} title={t('nav.signOut')}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              <span>{t('nav.signOut')}</span>
            </button>
          </form>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </main>
      <nav className={styles.tabs} aria-label={org?.shortName ?? name}>
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={styles.tab} aria-current={active === tab.href ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICONS[tab.icon]} />
            </svg>
            <span>{t(tab.label)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
