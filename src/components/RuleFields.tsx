import styles from './app.module.css';
import type { T } from '../lib/i18n';
import type { Rules } from '../lib/booking/kinds';

// Rule inputs shared by the add and edit facility forms. Blank means default.
export default function RuleFields({ t, rules }: { t: T; rules?: Rules }) {
  const field = (name: keyof Rules, label: Parameters<T>[0], min: number, max: number) => (
    <label className={styles.field} key={name}>
      {t(label)}
      <input className={styles.input} type="number" name={name} min={min} max={max} inputMode="numeric" defaultValue={rules ? String(rules[name] ?? '') : ''} />
    </label>
  );
  return (
    <>
      {field('capacity', 'manage.capacity', 1, 500)}
      {field('openHour', 'manage.openHour', 0, 23)}
      {field('closeHour', 'manage.closeHour', 1, 24)}
      {field('maxHoursPerBooking', 'manage.maxPerBooking', 1, 24)}
      {field('maxHoursPerWeek', 'manage.maxPerWeek', 1, 168)}
      {field('advanceDays', 'manage.advanceDays', 1, 365)}
      {field('cancelCutoffMinutes', 'manage.cancelCutoff', 0, 10080)}
      <label className={styles.field}>
        {t('manage.turns')}
        <input className={styles.input} name="turnStartHours" defaultValue={rules?.turnStartHours ?? ''} placeholder="16,18,20" />
      </label>
      {field('slotHours', 'manage.slotHours', 1, 12)}
    </>
  );
}
