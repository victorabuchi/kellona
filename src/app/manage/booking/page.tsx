import type { Metadata } from 'next';
import AppShell from '../../../components/AppShell';
import styles from '../../../components/app.module.css';
import { requireStaff } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import { openBookingAsAdminAction } from '../../../lib/auth/acting-actions';

export const metadata: Metadata = { title: 'Booking' };

// Super-admin entry to the resident booking pages: pick a building and book as
// a resident there. Staff are sent to the residents list to view as someone.
export default async function AdminBookingPage() {
  const { org, scope, viewer } = await requireStaff();
  const { t } = await getT(org);
  const [buildings, facilities] = await Promise.all([scope.buildings.q().orderBy((b) => b.name.asc()).all(), scope.facilities.q().all()]);
  const withFacilities = buildings.filter((b) => facilities.some((f) => f.buildingId === b.id));
  return (
    <AppShell org={org} viewer={viewer} t={t} active="/manage/booking" title={t('adminBook.title')}>
      <p className={styles.lede}>{t('adminBook.lede')}</p>
      {withFacilities.length === 0 ? (
        <p className={styles.empty}>{t('adminBook.none')}</p>
      ) : (
        <ul className={styles.list}>
          {withFacilities.map((b) => (
            <li key={b.id} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{b.name}</span>
                <span className={styles.muted}>
                  {[b.area, t('manage.facilities', { n: facilities.filter((f) => f.buildingId === b.id).length })].filter(Boolean).join(' · ')}
                </span>
              </span>
              {viewer.kind === 'admin' && (
                <form action={openBookingAsAdminAction}>
                  <input type="hidden" name="buildingId" value={b.id} />
                  <button className={styles.btn}>{t('adminBook.open')}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
