import type { Metadata } from 'next';
import AuthShell from '../../components/AuthShell';
import styles from '../../components/auth.module.css';
import { requireOrg } from '../../lib/tenant/org';
import { getT } from '../../lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const org = await requireOrg();
  const { t } = await getT(org);
  return { title: t('privacy.title') };
}

// Every organization is its own data controller, so this page reads the
// controller details from the organization record.
export default async function PrivacyPage() {
  const org = await requireOrg();
  const { t, locale } = await getT(org);
  const missing = t('privacy.missing');
  return (
    <AuthShell org={org} t={t} locale={locale} back="/privacy" wide>
      <h1 className={styles.titleDoc}>{t('privacy.title')}</h1>
      <section className={styles.section}>
        <h2>{t('privacy.controller')}</h2>
        <dl className={styles.dl}>
          <dd>{org.legalName ?? org.name}</dd>
          {org.businessId && <dd>{org.businessId}</dd>}
          {org.address && <dd>{org.address}</dd>}
          <dt>{t('privacy.contact')}</dt>
          <dd>{org.privacyEmail ?? org.supportEmail ?? missing}</dd>
        </dl>
      </section>
      <section className={styles.section}>
        <h2>{t('privacy.what')}</h2>
        <p>{t('privacy.whatBody')}</p>
      </section>
      <section className={styles.section}>
        <h2>{t('privacy.why')}</h2>
        <p>{t('privacy.whyBody')}</p>
      </section>
      <section className={styles.section}>
        <h2>{t('privacy.rights')}</h2>
        <p>{t('privacy.rightsBody')}</p>
      </section>
    </AuthShell>
  );
}
