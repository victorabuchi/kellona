import AuthShell from '../components/AuthShell';
import styles from '../components/auth.module.css';
import { getCurrentOrg } from '../lib/tenant/org';
import { getT } from '../lib/i18n';

// Sign-in screen. The form is shown in the organization's branding; sending
// links and Google sign-in are wired in the auth milestone.
export default async function SignInPage() {
  const org = await getCurrentOrg();
  const { t, locale } = await getT(org);

  if (!org) {
    return (
      <AuthShell org={null} t={t} locale={locale} back="/">
        <h1 className={styles.title}>{t('noorg.title')}</h1>
        <p className={styles.lede}>{t('noorg.body')}</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell org={org} t={t} locale={locale} back="/">
      <h1 className={styles.title}>{t('signin.title')}</h1>
      <p className={styles.lede}>{t('signin.lede')}</p>
      <form className={styles.section}>
        <label className={styles.field}>
          {t('signin.email')}
          <input className={styles.input} type="email" name="email" autoComplete="email" inputMode="email" required />
          <span className={styles.hint}>{t('signin.emailHint')}</span>
        </label>
        <button className={styles.button} type="submit" disabled>
          {t('signin.sendLink')}
        </button>
      </form>
      <div className={styles.divider}>{t('signin.or')}</div>
      <button className={styles.buttonGhost} type="button" disabled>
        {t('signin.google')}
      </button>
      <p className={styles.notice}>{t('signin.comingSoon')}</p>
    </AuthShell>
  );
}
