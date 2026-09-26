import Link from 'next/link';
import styles from './app.module.css';
import type { T } from '../lib/i18n';
import type { Neighbour } from '../lib/booking/engine';
import { MAX_REPEAT_WEEKS } from '../lib/booking/kinds';

export default function BookingPanel({
  action,
  hidden,
  whenLabel,
  lengths,
  capacity,
  roommates,
  others,
  closeHref,
  withNote,
  t,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  whenLabel: string;
  lengths: number[];
  capacity: number;
  roommates: Neighbour[];
  others: Neighbour[];
  closeHref: string;
  withNote: boolean;
  t: T;
}) {
  return (
    <form action={action} className={styles.card} id="panel">
      <h2 className={styles.h2}>{t('book.panel')}</h2>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className={styles.rowTitle}>{whenLabel}</div>
      <div className={styles.form}>
        {lengths.length > 1 && (
          <label className={styles.field}>
            {t('book.length')}
            <select name="hours" className={styles.select} defaultValue={lengths[0]}>
              {lengths.map((n) => (
                <option key={n} value={n}>
                  {t('book.hours', { n })}
                </option>
              ))}
            </select>
          </label>
        )}
        {lengths.length === 1 && <input type="hidden" name="hours" value={lengths[0]} />}
        <label className={styles.field}>
          {t('book.repeat')}
          <select name="repeatWeeks" className={styles.select} defaultValue="1">
            <option value="1">{t('book.once')}</option>
            {Array.from({ length: MAX_REPEAT_WEEKS - 1 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {t('book.weeks', { n })}
              </option>
            ))}
          </select>
          <span className={styles.hint}>{t('book.repeatHint')}</span>
        </label>
        {withNote && (
          <label className={`${styles.field} ${styles.full}`}>
            {t('book.note')}
            <input name="note" maxLength={200} placeholder={t('book.notePlaceholder')} className={styles.input} />
          </label>
        )}
      </div>

      {capacity > 1 && roommates.length + others.length > 0 && (
        <div className={styles.section}>
          <span className={styles.rowTitle}>{t('book.group')}</span>
          <span className={styles.hint}>{t('book.groupLede', { n: capacity })}</span>
          {roommates.length > 0 && (
            <>
              <label className={styles.check}>
                <input type="checkbox" name="inviteApartment" value="1" />
                {t('book.inviteApartment')}
              </label>
              <span className={styles.hint}>{t('book.yourApartment')}</span>
              <div className={styles.people}>
                {roommates.map((r) => (
                  <label key={r.id} className={styles.check}>
                    <input type="checkbox" name="participants" value={r.id} />
                    {r.name}
                  </label>
                ))}
              </div>
            </>
          )}
          {others.length > 0 && (
            <details className={styles.details}>
              <summary>{t('book.otherResidents')}</summary>
              <div className={styles.people}>
                {others.map((r) => (
                  <label key={r.id} className={styles.check}>
                    <input type="checkbox" name="participants" value={r.id} />
                    {r.name} <span className={styles.hint}>{t('book.apt')} {r.unitCode}</span>
                  </label>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.btn}>
          {t('book.confirm')}
        </button>
        <Link href={closeHref} className={styles.btnGhost}>
          {t('book.close')}
        </Link>
      </div>
    </form>
  );
}
