import AuthShell from '../../../components/AuthShell';
import styles from '../../../components/auth.module.css';
import { getCurrentOrg } from '../../../lib/tenant/org';
import { getT } from '../../../lib/i18n';
import { consumeLinkAction } from '../../../lib/auth/actions';

// A button, not an automatic sign-in on GET, so mail scanners that open links
// cannot use up the one-time token.
export default async function VerifyPage({ searchParams }: PageProps<'/auth/verify'>) {
  const { token } = await searchParams;
  const org = await getCurrentOrg();
  const { t, locale } = await getT(org);
  return (
    <AuthShell org={org} t={t} locale={locale} back="/">
      <h1 className={styles.title}>{t('verify.title')}</h1>
      <p className={styles.lede}>{t('verify.body')}</p>
      <form action={consumeLinkAction}>
        <input type="hidden" name="token" value={typeof token === 'string' ? token : ''} />
        <button className={styles.button} type="submit">
          {t('verify.submit')}
        </button>
      </form>
    </AuthShell>
  );
}
