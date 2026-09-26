import styles from './app.module.css';
import type { T } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n/messages';
import { AMENITY_KINDS } from '../lib/booking/kinds';
import { saveAmenitiesAction } from '../lib/manage/actions';

// Automatic / yes / no per kind, for a building or one apartment.
export default function AmenityForm({ t, buildingId, unitId, states }: { t: T; buildingId: string; unitId?: string; states: Record<string, boolean | undefined> }) {
  return (
    <form action={saveAmenitiesAction} className={styles.section}>
      <input type="hidden" name="buildingId" value={buildingId} />
      {unitId && <input type="hidden" name="unitId" value={unitId} />}
      <div className={styles.stateGrid}>
        {AMENITY_KINDS.map((kind) => {
          const value = states[kind] === undefined ? 'auto' : states[kind] ? 'yes' : 'no';
          return (
            <label key={kind} className={styles.field}>
              {t(`kind.${kind}` as MessageKey)}
              <select name={`state_${kind}`} className={styles.select} defaultValue={value}>
                <option value="auto">{t('manage.state.auto')}</option>
                <option value="yes">{t('manage.state.yes')}</option>
                <option value="no">{t('manage.state.no')}</option>
              </select>
            </label>
          );
        })}
      </div>
      <div>
        <button className={styles.btn}>{t('manage.save')}</button>
      </div>
    </form>
  );
}
