import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '../../components/AuthShell';
import styles from '../../components/auth.module.css';
import { getCurrentOrg } from '../../lib/tenant/org';
import { getT } from '../../lib/i18n';
import { requestPilotAction } from '../../lib/platform/signup-actions';

export const metadata: Metadata = { title: 'Sign up' };

// Housing organizations ask for a pilot here. Residents never sign up: their
// housing office adds them.
export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const { sent, error } = await searchParams;
  if (await getCurrentOrg()) redirect('/');
  const { t, locale } = await getT(null);
  const field = (name: string, label: Parameters<typeof t>[0], opts: { type?: string; required?: boolean; auto?: string } = {}) => (
    <label className={styles.field}>
      {t(label)}
      <input className={styles.input} name={name} type={opts.type ?? 'text'} required={opts.required} autoComplete={opts.auto} />
    </label>
  );
  return (
    <AuthShell
      org={null}
      t={t}
      locale={locale}
      back="/signup"
      title={t('signup.title')}
      aside={
        <>
          {t('signup.have')} <Link href="/login">{t('signup.login')}</Link>
        </>
      }
    >
      {sent ? (
        <p className={styles.success} role="status">
          {t('signup.sent')}
        </p>
      ) : (
        <>
          <p className={styles.lede}>{t('signup.lede')}</p>
          {error && (
            <p className={styles.error} role="alert">
              {t('signup.error')}
            </p>
          )}
          <form action={requestPilotAction} className={styles.section}>
            {field('organizationName', 'signup.org', { required: true, auto: 'organization' })}
            {field('contactName', 'signup.name', { required: true, auto: 'name' })}
            {field('email', 'signup.email', { type: 'email', required: true, auto: 'email' })}
            {field('phone', 'signup.phone', { type: 'tel', auto: 'tel' })}
            {field('residents', 'signup.residents', { type: 'number' })}
            <label className={styles.field}>
              {t('signup.message')}
              <textarea className={styles.textarea} name="message" maxLength={2000} />
            </label>
            <label className={styles.honey} aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <button className={styles.button} type="submit">
              {t('signup.submit')}
            </button>
          </form>
        </>
      )}
      <p className={styles.notice}>{t('signup.residentNote')}</p>
    </AuthShell>
  );
}
