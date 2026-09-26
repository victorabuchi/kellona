import Link from 'next/link';
import AuthShell from '../../components/AuthShell';
import styles from '../../components/auth.module.css';
import { getCurrentOrg } from '../../lib/tenant/org';
import { getT } from '../../lib/i18n';
import { requireViewer } from '../../lib/auth/viewer';
import { signOutAction } from '../../lib/auth/actions';

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
    <AuthShell org={org} t={t} locale={locale} back="/account" wide>
      <h1 className={styles.titleDoc}>{t('account.title')}</h1>
      <dl className={styles.dl}>
        <dd>
          <strong>{viewer.name}</strong>
        </dd>
        <dd>{viewer.email}</dd>
        <dt>{t('account.role')}</dt>
        <dd>{role}</dd>
        {org && (
          <>
            <dt>{t('account.organization')}</dt>
            <dd>{org.name}</dd>
          </>
        )}
      </dl>
      <p className={styles.lede}>{t('account.next')}</p>
      {viewer.kind === 'admin' && (
        <Link className={styles.button} href="/platform">
          {t('account.platform')}
        </Link>
      )}
      <form action={signOutAction}>
        <button className={styles.buttonGhost} type="submit">
          {t('account.signOut')}
        </button>
      </form>
    </AuthShell>
  );
}
