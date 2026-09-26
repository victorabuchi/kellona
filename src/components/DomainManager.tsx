import styles from './app.module.css';
import shell from './shell.module.css';
import CopyButton from './CopyButton';
import type { T } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n/messages';
import { txtName, txtValue } from '../lib/tenant/domain-check';

type Domain = { id: string; host: string; isPrimary: boolean; verificationToken: string | null; verifiedAt: string | null; lastCheckedAt: string | null; lastError: string | null };
type Action = (formData: FormData) => Promise<void>;

// Connect, verify, switch and remove custom domains. Used by an organization's
// own settings and by the super-admin platform settings (with hidden fields).
export default function DomainManager({
  t,
  domains,
  fallbackHost,
  target,
  hidden,
  actions,
  message,
  hostingNote,
  fmt,
}: {
  t: T;
  domains: Domain[];
  fallbackHost: string;
  target: string;
  hidden: Record<string, string>;
  actions: { add: Action; verify: Action; primary: Action; remove: Action };
  message: string | null;
  hostingNote: string | null;
  fmt: (iso: string) => string;
}) {
  const fields = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  const msgKey = message ? (`domain.msg.${message}` as MessageKey) : null;
  return (
    <section className={styles.card} id="domains">
      <h2 className={styles.h2}>{t('domain.title')}</h2>
      <p className={styles.muted}>{t('domain.lede', { fallback: fallbackHost })}</p>
      {msgKey && <p className={message === 'invalid' || message === 'taken' || message === 'pending' ? styles.alert : styles.ok}>{t(msgKey)}</p>}

      <ul className={styles.list}>
        <li className={styles.row}>
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>{fallbackHost}</span>
            <span className={styles.muted}>{t('domain.always')}</span>
          </span>
        </li>
        {domains.map((d) => {
          const verified = Boolean(d.verifiedAt);
          const token = d.verificationToken ?? '';
          return (
            <li key={d.id} className={`${styles.row} ${shell.domainRow}`}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{d.host}</span>
                <span className={shell.orgMeta}>
                  <span className={`${shell.badge} ${verified ? shell.badgeLive : shell.badgePending}`}>{verified ? t('domain.verified') : t('domain.pending')}</span>
                  {d.isPrimary && <span className={shell.badge}>{t('domain.primary')}</span>}
                  {d.lastCheckedAt && <span className={styles.muted}>{t('domain.lastChecked', { when: fmt(d.lastCheckedAt) })}</span>}
                </span>
              </span>
              <span className={styles.actions}>
                <form action={actions.verify}>
                  {fields}
                  <input type="hidden" name="domainId" value={d.id} />
                  <button className={verified ? styles.btnGhost : styles.btn}>{verified ? t('domain.recheck') : t('domain.verify')}</button>
                </form>
                {verified && !d.isPrimary && (
                  <form action={actions.primary}>
                    {fields}
                    <input type="hidden" name="domainId" value={d.id} />
                    <button className={styles.btnGhost}>{t('domain.makePrimary')}</button>
                  </form>
                )}
                <form action={actions.remove}>
                  {fields}
                  <input type="hidden" name="domainId" value={d.id} />
                  <button className={styles.btnDanger}>{t('domain.remove')}</button>
                </form>
              </span>
              {d.lastError && <p className={`${styles.alert} ${shell.domainFull}`}>{t(`domain.err.${d.lastError}` as MessageKey)}</p>}
              {(!verified || d.lastError === 'not_pointing') && (
                <div className={shell.domainFull}>
                  <p className={styles.muted}>{t('domain.steps')}</p>
                  <div className={shell.dnsTable} role="table">
                    <div className={shell.dnsHead} role="row">
                      <span>{t('domain.type')}</span>
                      <span>{t('domain.name')}</span>
                      <span>{t('domain.value')}</span>
                    </div>
                    {[
                      ['CNAME', d.host, target],
                      ['TXT', txtName(d.host), txtValue(token)],
                    ].map(([type, name, value]) => (
                      <div key={type} className={shell.dnsRow} role="row">
                        <span className={shell.badge}>{type}</span>
                        <span className={shell.dnsCell}>
                          <code>{name}</code>
                          <CopyButton value={name!} label={t('domain.copy')} done={t('domain.copied')} />
                        </span>
                        <span className={shell.dnsCell}>
                          <code>{value}</code>
                          <CopyButton value={value!} label={t('domain.copy')} done={t('domain.copied')} />
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className={styles.hint}>{t('domain.apex', { target })}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form action={actions.add} className={styles.form}>
        {fields}
        <label className={styles.field}>
          {t('domain.host')}
          <input className={styles.input} name="host" required placeholder="booking.example.com" autoCapitalize="none" spellCheck={false} />
          <span className={styles.hint}>{t('domain.hostHint')}</span>
        </label>
        <button className={styles.btn}>{t('domain.add')}</button>
      </form>
      <p className={styles.hint}>{t('domain.switchHint')}</p>
      {hostingNote && <p className={styles.hint}>{hostingNote}</p>}
    </section>
  );
}
