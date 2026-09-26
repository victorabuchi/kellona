import Link from 'next/link';
import styles from './shell.module.css';
import Dropdown from './Dropdown';
import ThemeSwitcher from './ThemeSwitcher';
import { db } from '../prisma/db';
import type { OrgContext } from '../lib/tenant/load';
import type { Viewer } from '../lib/auth/viewer';
import type { T } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n/messages';
import { stopActingAction } from '../lib/auth/acting-actions';
import { signOutAction } from '../lib/auth/actions';
import { DEFAULT_BRAND } from '../lib/brand/defaults';
import { readTheme } from '../lib/theme';
import { headers } from 'next/headers';
import { platformBaseUrl } from '../lib/tenant/urls';

const ICONS = {
  book: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  palette: 'M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1 3.7A2 2 0 0 1 12 22ZM7.5 10.5h.01M10.5 7h.01M15 7.5h.01',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z',
  plus: 'M12 5v14M5 12h14',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  back: 'M19 12H5M12 19l-7-7 7-7',
};
type IconName = keyof typeof ICONS;
type Item = { href: string; label: MessageKey; icon: IconName; external?: boolean };
type Nav = { sections: Item[][]; bottom: Item[] };

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

// The sidebar changes with context, like a developer console: the platform
// level lists organizations; inside an organization it lists that
// organization's pages, with a way back to all organizations.
function navFor(viewer: Viewer, org: OrgContext | null, platformUrl: string): Nav {
  const account: Item = { href: '/account', label: 'nav.account', icon: 'user' };
  if (viewer.kind === 'resident') return { sections: [[{ href: '/book', label: 'nav.book', icon: 'book' }]], bottom: [account] };
  if (!org) {
    return {
      sections: [
        [
          { href: '/platform', label: 'nav.organizations', icon: 'grid' },
          { href: '/platform/requests', label: 'nav.requests', icon: 'inbox' },
        ],
      ],
      bottom: [account],
    };
  }
  const sections: Item[][] = [
    [{ href: '/manage/overview', label: 'nav.overview', icon: 'home' }],
    [
      { href: '/manage', label: 'nav.buildings', icon: 'building' },
      { href: '/manage/residents', label: 'nav.residents', icon: 'people' },
    ],
  ];
  if (viewer.kind === 'admin') sections.push([{ href: `/platform/o/${org.id}`, label: 'nav.settings', icon: 'gear' }]);
  void platformUrl;
  return { sections, bottom: [account] };
}


function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const CHEVRONS = (
  <svg className={styles.chevrons} viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 9 5-5 5 5M7 15l5 5 5-5" />
  </svg>
);

function SideItem({ item, active, t, className }: { item: Item; active: string; t: T; className: string }) {
  const current = !item.external && (active === item.href || (item.href !== '/manage' && active.startsWith(`${item.href}/`)));
  const body = (
    <>
      <Icon name={item.icon} />
      <span className={styles.sideLabel}>{t(item.label)}</span>
    </>
  );
  if (item.external) {
    return (
      <a href={item.href} className={className} title={t(item.label)}>
        {body}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} aria-current={current ? 'page' : undefined} title={t(item.label)}>
      {body}
    </Link>
  );
}

// Dashboard frame modeled on developer consoles: breadcrumb with an
// organization switcher, an icon rail that opens on hover, bottom tabs on phones.
export default async function AppShell({
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
  const platformUrl = platformBaseUrl((await headers()).get('host'));
  const nav = navFor(viewer, org, platformUrl);
  const brand = org?.brand ?? DEFAULT_BRAND;
  const isAdmin = viewer.kind === 'admin';
  // Kellona's mark on the platform level; inside an organization the bar
  // belongs to that organization and leads with its own logo.
  const mark = org ? (brand.appIconUrl ?? brand.faviconUrl ?? brand.logoLightUrl) : DEFAULT_BRAND.appIconUrl!;
  const home = nav.sections[0]![0]!.href;
  const theme = await readTheme();
  const orgs = isAdmin ? await db.orm.public.Organization.orderBy((o) => o.name.asc()).include('brand', (b) => b).all() : [];
  const tabs = [...nav.sections.flat(), ...nav.bottom.filter((i) => !i.external)].slice(0, 5);

  const role =
    viewer.kind === 'admin' ? t('account.role.admin') : viewer.kind === 'resident' ? t('account.role.resident') : viewer.role === 'manager' ? t('account.role.manager') : t('account.role.staff');

  const switcher = (
    <Dropdown
      label={t('nav.switch')}
      buttonClass={styles.crumb}
      button={
        <>
          <span className={styles.crumbText}>{org ? org.shortName : t('nav.organizations')}</span>
          {org && <span className={styles.pill}>{org.isDemo ? t('platform.demo') : org.status}</span>}
          {CHEVRONS}
        </>
      }
    >
      <a href={`${platformUrl}/platform`} className={styles.popItem}>
        <Icon name="back" size={16} />
        {t('nav.allOrgs')}
      </a>
      <div className={styles.popDivider} />
      <div className={styles.popLabel}>{t('nav.switch')}</div>
      <div className={styles.popScroll}>
        {orgs.map((o) => (
          <a key={o.id} href={`/platform/open/${o.id}`} className={styles.popItem} aria-current={o.id === org?.id}>
            <span className={styles.dot} style={{ background: o.brand?.primaryColor ?? DEFAULT_BRAND.primaryColor }}>
              {o.shortName.slice(0, 1).toUpperCase()}
            </span>
            {o.name}
            {o.id === org?.id && (
              <svg className={styles.check} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </a>
        ))}
      </div>
      <div className={styles.popDivider} />
      <a href={`${platformUrl}/platform?new=1`} className={styles.popItem}>
        <Icon name="plus" size={16} />
        {t('nav.newOrg')}
      </a>
    </Dropdown>
  );

  return (
    <div className={styles.shell}>
      {viewer.kind === 'resident' && viewer.actingAdminId ? (
        <form action={stopActingAction} className={styles.acting}>
          <span>{t('acting.banner', { name: viewer.name })}</span>
          <button type="submit">{t('acting.stop')}</button>
        </form>
      ) : (
        <span />
      )}

      <header className={styles.top}>
        <Link href={home} className={styles.mark} aria-label={org?.name ?? 'Kellona'} style={org && !mark ? { background: brand.primaryColor } : undefined}>
          {mark ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mark} alt="" />
          ) : (
            <span className={styles.markInitial}>{org!.shortName.slice(0, 1).toUpperCase()}</span>
          )}
        </Link>
        <span className={styles.slash} aria-hidden="true">
          /
        </span>
        {isAdmin ? (
          switcher
        ) : (
          <span className={styles.crumb}>
            <span className={styles.crumbText}>{org?.shortName ?? 'Kellona'}</span>
          </span>
        )}

        <div className={styles.topRight}>
          <Dropdown label={t('nav.userMenu')} align="right" buttonClass={styles.avatar} button={<span aria-hidden="true">{initials(viewer.name) || '?'}</span>}>
            <div className={styles.popHead}>
              <strong>{viewer.name}</strong>
              <span>{viewer.email}</span>
              <span>{role}</span>
            </div>
            <div className={styles.popDivider} />
            <div className={styles.popLabel}>{t('theme.label')}</div>
            <ThemeSwitcher initial={theme} labels={{ light: t('theme.light'), dark: t('theme.dark'), system: t('theme.system') }} />
            <div className={styles.popDivider} />
            <Link href="/account" className={styles.popItem}>
              <Icon name="user" size={16} />
              {t('nav.account')}
            </Link>
            <form action={signOutAction}>
              <button type="submit" className={`${styles.popItem} ${styles.danger}`}>
                <Icon name="out" size={16} />
                {t('nav.signOut')}
              </button>
            </form>
          </Dropdown>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.rail}>
          <nav className={styles.railInner} aria-label={org?.shortName ?? 'Kellona'}>
            {nav.sections.map((section, i) => (
              <div key={i} className={styles.railSection}>
                {section.map((item) => (
                  <SideItem key={item.href} item={item} active={active} t={t} className={styles.sideLink} />
                ))}
              </div>
            ))}
            <div className={`${styles.railSection} ${styles.railBottom}`}>
              {nav.bottom.map((item) => (
                <SideItem key={item.href} item={item} active={active} t={t} className={styles.sideLink} />
              ))}
            </div>
          </nav>
        </div>
        <main className={styles.main}>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </main>
      </div>

      <nav className={styles.tabs} aria-label={org?.shortName ?? 'Kellona'}>
        {tabs.map((item) => (
          <SideItem key={item.href} item={item} active={active} t={t} className={styles.tab} />
        ))}
      </nav>
    </div>
  );
}
