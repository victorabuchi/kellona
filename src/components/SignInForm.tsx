import styles from './auth.module.css';
import PasswordField from './PasswordField';
import type { T } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n/messages';
import { passwordSignInAction, requestLinkAction } from '../lib/auth/actions';
import { LOGIN_LINK_MINUTES } from '../lib/auth/constants';

const ERRORS = ['missing', 'invalid', 'throttled', 'link', 'email'] as const;

// Password and email link sign-in, shared by an organization's / and Kellona's /login.
export default function SignInForm({ t, params, hint }: { t: T; params: Record<string, string | string[] | undefined>; hint?: string }) {
  const one = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : '');
  const error = ERRORS.find((e) => e === one('error'));
  const devLinks = process.env.NODE_ENV !== 'production' ? [params['dev']].flat().filter((v): v is string => typeof v === 'string') : [];
  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {t(`signin.error.${error}` as MessageKey)}
        </p>
      )}
      {one('sent') && (
        <p className={styles.success} role="status">
          {t('signin.sent', { minutes: LOGIN_LINK_MINUTES })}
        </p>
      )}
      {devLinks.length > 0 && (
        <div className={`${styles.notice} ${styles.linkList}`}>
          <span>{t('signin.devLink')}</span>
          {devLinks.map((link) => (
            <a key={link} href={link}>
              {link}
            </a>
          ))}
        </div>
      )}
      {hint && <p className={styles.lede}>{hint}</p>}
      <form action={passwordSignInAction} className={styles.section}>
        <label className={styles.field}>
          {t('signin.email')}
          <input className={styles.input} type="email" name="email" autoComplete="username" inputMode="email" defaultValue={one('email')} required />
        </label>
        <PasswordField label={t('signin.password')} show={t('login.show')} hide={t('login.hide')} />
        <button className={styles.button} type="submit">
          {t('signin.submit')}
        </button>
        <div className={styles.divider}>{t('signin.or')}</div>
        <button className={styles.buttonGhost} type="submit" formAction={requestLinkAction} formNoValidate>
          {t('signin.sendLink')}
        </button>
      </form>
    </>
  );
}
