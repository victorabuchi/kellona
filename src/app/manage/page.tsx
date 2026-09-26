import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '../../components/AppShell';
import styles from '../../components/app.module.css';
import { requireStaff } from '../../lib/auth/access';
import { getT } from '../../lib/i18n';
import { addBuildingAction } from '../../lib/manage/actions';

export const metadata: Metadata = { title: 'Buildings' };

export default async function ManagePage() {
  const access = await requireStaff();
  const { org, scope, viewer, buildingIds } = access;
  const { t } = await getT(org);
  const [all, units, facilities, residents] = await Promise.all([
    scope.buildings.q().orderBy((b) => b.name.asc()).all(),
    scope.units.q().all(),
    scope.facilities.q().all(),
    scope.residents.q().where({ status: 'active' }).all(),
  ]);
  const buildings = buildingIds ? all.filter((b) => buildingIds.includes(b.id)) : all;
  const unitBuilding = new Map(units.map((u) => [u.id, u.buildingId]));

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/manage" title={t('manage.title')}>
      <p className={styles.lede}>{t('manage.lede', { org: org.name })}</p>
      {buildings.length === 0 ? (
        <p className={styles.empty}>{t('manage.none')}</p>
      ) : (
        <ul className={styles.list}>
          {buildings.map((b) => (
            <li key={b.id} className={styles.row}>
              <span className={styles.rowText}>
                <Link href={`/manage/b/${b.id}`} className={styles.rowTitle}>
                  {b.name}
                </Link>
                <span className={styles.muted}>
                  {[
                    b.address,
                    t('manage.units', { n: units.filter((u) => u.buildingId === b.id).length }),
                    t('manage.facilities', { n: facilities.filter((f) => f.buildingId === b.id).length }),
                    t('manage.residentsCount', { n: residents.filter((r) => r.unitId && unitBuilding.get(r.unitId) === b.id).length }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <Link href={`/manage/b/${b.id}`} className={styles.btnGhost}>
                {t('book.open')}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {buildingIds === null && (
        <form action={addBuildingAction} className={styles.card}>
          <h2 className={styles.h2}>{t('manage.addBuilding')}</h2>
          <div className={styles.form}>
            <label className={styles.field}>
              {t('manage.name')}
              <input className={styles.input} name="name" required maxLength={120} />
            </label>
            <label className={styles.field}>
              {t('manage.address')}
              <input className={styles.input} name="address" maxLength={200} />
            </label>
            <button className={styles.btn}>{t('manage.add')}</button>
          </div>
        </form>
      )}
    </AppShell>
  );
}
