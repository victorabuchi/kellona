import type { Metadata } from 'next';
import Link from 'next/link';
import Frame from '../../components/Frame';
import styles from '../../components/app.module.css';
import a from '../../components/account.module.css';
import { getCurrentOrg } from '../../lib/tenant/org';
import { orgScope } from '../../lib/tenant/scope';
import { getT } from '../../lib/i18n';
import { requireViewer } from '../../lib/auth/viewer';
import { signOutAction } from '../../lib/auth/actions';
import { updateNameAction } from '../../lib/auth/account-actions';
import { deleteBlock } from '../../lib/auth/account-deletion';
import { homeFor } from '../../lib/auth/home';
import { db } from '../../prisma/db';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import ThemeCards from '../../components/ThemeCards';
import DeleteAccount from '../../components/DeleteAccount';
import Flash from '../../components/Flash';
import { readTheme } from '../../lib/theme';

export const metadata: Metadata = { title: 'Account' };

const METHOD_ICON: Record<string, string> = {
  email: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM22 7l-10 6L2 7',
  password: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  google: 'M21 12a9 9 0 1 1-2.6-6.4M21 12h-9',
  sso: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
};

function Svg({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Account settings with a side bar: profile, appearance, security, danger zone.
export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
  const viewer = await requireViewer();
  const org = await getCurrentOrg();
  const { t, locale } = await getT(org);
  const sp = await searchParams;
  const role =
    viewer.kind === 'admin'
      ? t('account.role.admin')
      : viewer.kind === 'resident'
        ? t('account.role.resident')
        : viewer.role === 'manager'
          ? t('account.role.manager')
          : t('account.role.staff');
  const block = await deleteBlock(viewer);

  // Sign-in methods: every account can get an email link; others as stored.
  const methods = new Set<string>(['email']);
  if (viewer.kind === 'admin') {
    if ((await db.orm.public.PlatformAdmin.where({ id: viewer.id }).first())?.passwordHash) methods.add('password');
  } else {
    const where = viewer.kind === 'resident' ? { residentId: viewer.id } : { staffId: viewer.id };
    for (const i of await orgScope(viewer.orgId).identities.q().where(where).all()) {
      methods.add(i.provider === 'password' || i.provider === 'google' || i.provider === 'email' ? i.provider : 'sso');
    }
  }
  const acting = viewer.kind === 'resident' && Boolean(viewer.actingAdminId);

  return (
    <Frame org={org} viewer={viewer} t={t} locale={locale} active="/account" title={t('account.title')}>
      {sp['saved'] && <Flash className={styles.ok}>{t('account.saved')}</Flash>}
      {sp['error'] === 'name' && (
        <Flash className={styles.alert} tone="err">
          {t('account.nameError')}
        </Flash>
      )}
      {sp['error'] === 'confirm' && (
        <Flash className={styles.alert} tone="err">
          {t('account.delete.mismatch')}
        </Flash>
      )}
      <div className={a.layout}>
        <nav className={a.side} aria-label={t('account.settings')}>
          <Link href={homeFor(viewer.kind, Boolean(org))} className={a.back}>
            <Svg d="M19 12H5M12 19l-7-7 7-7" />
            {t('account.back')}
          </Link>
          <span className={a.sideLabel}>{t('account.settings')}</span>
          <a href="#profile" className={a.sideLink}>
            {t('account.nav.profile')}
          </a>
          <a href="#appearance" className={a.sideLink}>
            {t('account.nav.appearance')}
          </a>
          <a href="#security" className={a.sideLink}>
            {t('profile.security')}
          </a>
          <a href="#danger" className={`${a.sideLink} ${a.sideDanger}`}>
            {t('account.danger')}
          </a>
        </nav>

        <div className={a.content}>
          <section id="profile" className={a.section}>
            <h2>{t('account.profileTitle')}</h2>
            <p>{t('account.profileLede')}</p>
            <div className={a.panel}>
              <div className={a.row}>
                <span className={a.rowLabel}>
                  {t('account.name')}
                  <small>{t('account.nameHint')}</small>
                </span>
                <form action={updateNameAction} className={a.nameForm}>
                  <input name="name" defaultValue={viewer.name} maxLength={80} required disabled={acting} aria-label={t('account.name')} />
                  <button className={styles.btn} disabled={acting}>
                    {t('manage.save')}
                  </button>
                </form>
              </div>
              <div className={a.row}>
                <span className={a.rowLabel}>
                  {t('account.email')}
                  <small>{t('account.emailHint')}</small>
                </span>
                <span className={a.value}>{viewer.email}</span>
              </div>
              <div className={a.row}>
                <span className={a.rowLabel}>{t('account.role')}</span>
                <span className={a.value}>
                  {role}
                  {org ? ` · ${org.name}` : ''}
                </span>
              </div>
            </div>
          </section>

          <section id="appearance" className={a.section}>
            <h2>{t('account.nav.appearance')}</h2>
            <p>{t('account.appearanceLede')}</p>
            <div className={a.panel}>
              <div className={a.row} style={{ alignItems: 'start' }}>
                <span className={a.rowLabel}>{t('account.themeMode')}</span>
                <ThemeCards initial={await readTheme()} labels={{ light: t('theme.light'), dark: t('theme.dark'), system: t('theme.system') }} />
              </div>
              <div className={a.row}>
                <span className={a.rowLabel}>{t('common.language')}</span>
                <LanguageSwitcher locales={org?.locales ?? ['fi', 'en']} current={locale} back="/account" label={t('common.language')} />
              </div>
            </div>
          </section>

          <section id="security" className={a.section}>
            <h2>{t('profile.security')}</h2>
            <p>{t('account.securityLede')}</p>
            <div className={a.panel}>
              {[...methods].map((m) => (
                <div key={m} className={a.method}>
                  <span className={a.methodIcon}>
                    <Svg d={METHOD_ICON[m]!} />
                  </span>
                  <span className={a.methodText}>
                    {t(`account.method.${m}` as Parameters<typeof t>[0])}
                    <small>{viewer.email}</small>
                  </span>
                  <span className={a.connected}>{t('account.connected')}</span>
                </div>
              ))}
              <div className={a.method}>
                <span className={a.methodIcon}>
                  <Svg d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </span>
                <span className={a.methodText}>
                  {t('account.signOut')}
                  <small>{t('account.signOutHint')}</small>
                </span>
                <form action={signOutAction}>
                  <button className={styles.btnGhost} type="submit">
                    {t('account.signOut')}
                  </button>
                </form>
              </div>
            </div>
            <div className={styles.actions}>
              {viewer.kind === 'admin' && (
                <a className={styles.btnGhost} href={org ? '/platform/home' : '/platform'}>
                  {t('account.platform')}
                </a>
              )}
              <Link className={styles.btnGhost} href="/privacy">
                {t('common.privacy')}
              </Link>
            </div>
          </section>

          <section id="danger" className={a.section}>
            <h2>{t('account.danger')}</h2>
            <DeleteAccount
              email={viewer.email}
              blocked={block ? t(`account.delete.${block}`) : null}
              labels={{
                title: t('account.delete.title'),
                body: viewer.kind === 'resident' ? t('account.delete.resident') : viewer.kind === 'staff' ? t('account.delete.staff', { org: org?.name ?? '' }) : t('account.delete.admin'),
                button: t('account.delete.button'),
                confirm: t('account.delete.confirm'),
                final: t('account.delete.final'),
                cancel: t('account.delete.cancel'),
              }}
            />
          </section>
        </div>
      </div>
    </Frame>
  );
}
