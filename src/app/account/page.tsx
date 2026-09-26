import type { Metadata } from 'next';
import Link from 'next/link';
import Frame from '../../components/Frame';
import styles from '../../components/app.module.css';
import { getCurrentOrg } from '../../lib/tenant/org';
import { getT } from '../../lib/i18n';
import { requireViewer } from '../../lib/auth/viewer';
import { signOutAction } from '../../lib/auth/actions';
import LanguageSwitcher from '../../components/LanguageSwitcher';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
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

  return (
    <Frame org={org} viewer={viewer} t={t} locale={locale} active="/account" title={t('account.title')}>
      <div className={styles.card}>
        <span className={styles.rowTitle}>{viewer.name}</span>
        <span className={styles.muted}>{viewer.email}</span>
        <span className={styles.muted}>
          {t('account.role')}: {role}
          {org ? ` · ${org.name}` : ''}
        </span>
      </div>
      <LanguageSwitcher locales={org?.locales ?? ['fi', 'en']} current={locale} back="/account" label={t('common.language')} />
      <div className={styles.actions}>
        {viewer.kind === 'admin' && (
          <Link className={styles.btn} href="/platform">
            {t('account.platform')}
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
    </Frame>
  );
}
