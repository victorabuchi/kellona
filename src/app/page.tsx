import { redirect } from 'next/navigation';
import AuthShell from '../components/AuthShell';
import styles from '../components/auth.module.css';
import { getCurrentOrg } from '../lib/tenant/org';
import { getT } from '../lib/i18n';
import { getViewer } from '../lib/auth/viewer';
import { passwordSignInAction, requestLinkAction } from '../lib/auth/actions';
import { LOGIN_LINK_MINUTES } from '../lib/auth/constants';
import { homeFor } from '../lib/auth/home';

const ERRORS = ['missing', 'invalid', 'throttled', 'link', 'email'] as const;

export default async function SignInPage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : '');
  const org = await getCurrentOrg();
  const { t, locale } = await getT(org);
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer.kind, Boolean(org)));

  const error = ERRORS.find((e) => e === one('error'));
  const dev = process.env.NODE_ENV !== 'production' ? one('dev') : '';

  return (
    <AuthShell org={org} t={t} locale={locale} back="/">
      <h1 className={styles.title}>{org ? t('signin.title') : 'Kellona'}</h1>
      {org ? <p className={styles.lede}>{t('signin.lede')}</p> : <p className={styles.lede}>{t('noorg.body')}</p>}

      {error && (
        <p className={styles.error} role="alert">
          {t(`signin.error.${error}`)}
        </p>
      )}
      {one('sent') && (
        <p className={styles.success} role="status">
          {t('signin.sent', { minutes: LOGIN_LINK_MINUTES })}
        </p>
      )}
      {dev && (
        <p className={styles.notice}>
          {t('signin.devLink')} <a href={dev}>{dev}</a>
        </p>
      )}

      <form action={passwordSignInAction} className={styles.section}>
        <label className={styles.field}>
          {t('signin.email')}
          <input className={styles.input} type="email" name="email" autoComplete="username" inputMode="email" defaultValue={one('email')} required />
          <span className={styles.hint}>{t('signin.emailHint')}</span>
        </label>
        <label className={styles.field}>
          {t('signin.password')}
          <input className={styles.input} type="password" name="password" autoComplete="current-password" />
        </label>
        <button className={styles.button} type="submit">
          {t('signin.submit')}
        </button>
        <div className={styles.divider}>{t('signin.or')}</div>
        <button className={styles.buttonGhost} type="submit" formAction={requestLinkAction} formNoValidate>
          {t('signin.sendLink')}
        </button>
      </form>
    </AuthShell>
  );
}
