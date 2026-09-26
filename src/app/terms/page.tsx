import type { Metadata } from 'next';
import AuthShell from '../../components/AuthShell';
import styles from '../../components/auth.module.css';
import { getCurrentOrg } from '../../lib/tenant/org';
import { getT } from '../../lib/i18n';

export const metadata: Metadata = { title: 'Terms' };

export default async function TermsPage() {
  const org = await getCurrentOrg();
  const { t, locale } = await getT(org);
  return (
    <AuthShell org={org} t={t} locale={locale} back="/terms" wide>
      <h1 className={styles.titleDoc}>{t('terms.title')}</h1>
      <p>{org ? t('terms.org') : t('terms.platform')}</p>
    </AuthShell>
  );
}
