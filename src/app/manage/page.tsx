import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '../../components/AppShell';
import styles from '../../components/app.module.css';
import { requireStaff } from '../../lib/auth/access';
import { getT } from '../../lib/i18n';
import { addBuildingAction } from '../../lib/manage/actions';

export const metadata: Metadata = { title: 'Buildings' };

// Buildings grouped by area, areas in alphabetical order, ungrouped last.
function groupByArea<B extends { area: string | null; name: string }>(buildings: B[], otherLabel: string): Array<[string, B[]]> {
  const groups = new Map<string, B[]>();
  for (const b of buildings) {
    const key = b.area ?? '';
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'fi')))
    .map(([area, list]) => [area || otherLabel, list.sort((x, y) => x.name.localeCompare(y.name, 'fi', { numeric: true }))]);
}

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
        <>
          {groupByArea(buildings, t('manage.noArea')).map(([area, group]) => (
            <section key={area} className={styles.section}>
              <h2 className={styles.h2}>
                {area} <span className={styles.muted}>· {group.length}</span>
              </h2>
              <ul className={styles.list}>
                {group.map((b) => (
                  <li key={b.id} className={styles.row}>
                    <span className={styles.rowText}>
                      <Link href={`/manage/b/${b.id}`} className={styles.rowTitle}>
                        {b.name}
                      </Link>
                      <span className={styles.muted}>
                        {[
                          b.address && b.address !== b.name ? b.address : null,
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
            </section>
          ))}
        </>
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
            <label className={styles.field}>
              {t('manage.area')}
              <input className={styles.input} name="area" maxLength={80} list="areas" />
              <datalist id="areas">
                {[...new Set(all.map((b) => b.area).filter(Boolean))].map((a) => (
                  <option key={a} value={a!} />
                ))}
              </datalist>
            </label>
            <button className={styles.btn}>{t('manage.add')}</button>
          </div>
        </form>
      )}
    </AppShell>
  );
}
