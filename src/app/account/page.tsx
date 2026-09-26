import type { Metadata } from 'next';
import Link from 'next/link';
import Frame from '../../components/Frame';
import styles from '../../components/app.module.css';
import { getCurrentOrg } from '../../lib/tenant/org';
import { getT } from '../../lib/i18n';
import { requireViewer } from '../../lib/auth/viewer';
import { signOutAction } from '../../lib/auth/actions';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import ThemeSwitcher from '../../components/ThemeSwitcher';
import { readTheme } from '../../lib/theme';
import DeleteAccount from '../../components/DeleteAccount';
import Flash from '../../components/Flash';
import { deleteBlock } from '../../lib/auth/account-deletion';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
  const viewer = await requireViewer();
  const org = await getCurrentOrg();
  const { t, locale } = await getT(org);
  const role =
    viewer.kind === 'admin'
      ? t('account.role.admin')
      : viewer.kind === 'resident'
        ? t('account.role.resident')
        : viewer.role === 'manager'
          ? t('account.role.manager')
          : t('account.role.staff');
  const block = await deleteBlock(viewer);
  const error = (await searchParams)['error'];

  return (
    <Frame org={org} viewer={viewer} t={t} locale={locale} active="/account" title={t('account.title')}>
      {error === 'confirm' && (
        <Flash className={styles.alert} tone="err">
          {t('account.delete.mismatch')}
        </Flash>
      )}
      <div className={styles.card}>
        <span className={styles.rowTitle}>{viewer.name}</span>
        <span className={styles.muted}>{viewer.email}</span>
        <span className={styles.muted}>
          {t('account.role')}: {role}
          {org ? ` · ${org.name}` : ''}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.rowTitle}>{t('theme.label')}</span>
        <ThemeSwitcher initial={await readTheme()} labels={{ light: t('theme.light'), dark: t('theme.dark'), system: t('theme.system') }} />
        <span className={styles.rowTitle}>{t('common.language')}</span>
        <LanguageSwitcher locales={org?.locales ?? ['fi', 'en']} current={locale} back="/account" label={t('common.language')} />
      </div>
      <div className={styles.actions}>
        {viewer.kind === 'admin' && (
          <a className={styles.btn} href={org ? '/platform/home' : '/platform'}>
            {t('account.platform')}
          </a>
        )}
        {viewer.kind === 'resident' && (
          <Link className={styles.btnGhost} href="/booking/help">
            {t('nav.help')}
          </Link>
        )}
        <Link className={styles.btnGhost} href="/privacy">
          {t('common.privacy')}
        </Link>
        <form action={signOutAction}>
          <button className={styles.btnDanger} type="submit">
            {t('account.signOut')}
          </button>
        </form>
      </div>
      <section className={styles.section}>
        <h2 className={styles.h2}>{t('account.danger')}</h2>
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
    </Frame>
  );
}
