import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import styles from '../../../components/app.module.css';
import { requireResident } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import { loadAmenities, residentContext } from '../../../lib/booking/engine';
import { claimParkingAction, releaseParkingAction } from '../../../lib/booking/actions';
import Flash from '../../../components/Flash';

export const metadata: Metadata = { title: 'Parking' };

const ERRORS = { already: 'parking.already', gone: 'parking.gone', notAvailable: 'book.error.notAvailable' } as const;

export default async function ParkingPage({ searchParams }: PageProps<'/book/parking'>) {
  const { error } = await searchParams;
  const { org, scope, viewer } = await requireResident();
  const { t } = await getT(org);
  const ctx = await residentContext(scope, viewer.id);
  if (!ctx) redirect('/book');
  const amenities = await loadAmenities(scope, ctx.buildingId, ctx.unitId);
  if (!amenities.find((a) => a.kind === 'parking')?.available) redirect('/book');

  const spots = await scope.facilities.q().where({ buildingId: ctx.buildingId, kind: 'parking' }).orderBy((f) => f.name.asc()).all();
  const claims = spots.length ? await scope.parkingClaims.q().where((c) => c.facilityId.in(spots.map((s) => s.id))).all() : [];
  const mine = claims.find((c) => c.residentId === viewer.id);
  const errorKey = typeof error === 'string' && error in ERRORS ? ERRORS[error as keyof typeof ERRORS] : null;

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/book" title={t('kind.parking')}>
      <Link href="/book" className={styles.muted}>
        {t('book.allFacilities')}
      </Link>
      <p className={styles.lede}>{t('parking.lede')}</p>
      {errorKey && <Flash className={styles.alert} tone="err">{t(errorKey)}</Flash>}
      <ul className={styles.list}>
        {spots.map((spot) => {
          const claim = claims.find((c) => c.facilityId === spot.id);
          const isMine = claim?.residentId === viewer.id;
          return (
            <li key={spot.id} className={`${styles.slot} ${isMine ? styles.slotMine : ''}`}>
              <span className={styles.slotTime}>{spot.name}</span>
              {isMine ? (
                <form action={releaseParkingAction} className={styles.actions}>
                  <span className={styles.badge}>{t('parking.yours')}</span>
                  <button className={styles.btnDanger}>{t('parking.release')}</button>
                </form>
              ) : claim ? (
                <span className={styles.badge}>{t('parking.taken')}</span>
              ) : mine ? (
                <span className={styles.badge}>{t('parking.free')}</span>
              ) : (
                <form action={claimParkingAction}>
                  <input type="hidden" name="facilityId" value={spot.id} />
                  <button className={styles.btn}>{t('parking.claim')}</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
