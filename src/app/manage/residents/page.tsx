import type { Metadata } from 'next';
import AppShell from '../../../components/AppShell';
import styles from '../../../components/app.module.css';
import { requireStaff } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import { addResidentAction, importCsvAction, removeResidentAction } from '../../../lib/manage/actions';
import { actAsResidentAction } from '../../../lib/auth/acting-actions';

export const metadata: Metadata = { title: 'Residents' };

export default async function ResidentsPage({ searchParams }: PageProps<'/manage/residents'>) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const { org, scope, viewer, buildingIds } = await requireStaff();
  const { t } = await getT(org);

  const [allBuildings, units] = await Promise.all([scope.buildings.q().orderBy((b) => b.name.asc()).all(), scope.units.q().all()]);
  const buildings = buildingIds ? allBuildings.filter((b) => buildingIds.includes(b.id)) : allBuildings;
  const visibleUnitIds = units.filter((u) => buildings.some((b) => b.id === u.buildingId)).map((u) => u.id);
  const q = one('q').trim().toLowerCase();
  let query = scope.residents.q().orderBy((r) => r.name.asc());
  if (q) query = query.where((r) => r.email.like(`%${q.replace(/[%_]/g, '')}%`));
  const all = await query.limit(500).all();
  const residents = buildingIds ? all.filter((r) => r.unitId && visibleUnitIds.includes(r.unitId)) : all;
  const unitById = new Map(units.map((u) => [u.id, u]));
  const buildingById = new Map(allBuildings.map((b) => [b.id, b]));
  const imported = one('imported').split(',');

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/manage/residents" title={t('residents.title')}>
      <p className={styles.lede}>{t('residents.lede')}</p>
      {one('ok') && <p className={styles.ok}>{t('residents.saved')}</p>}
      {one('error') && <p className={styles.alert}>{t('residents.error')}</p>}
      {imported.length === 3 && (
        <p className={styles.ok}>{t('residents.imported', { created: imported[0]!, updated: imported[1]!, skipped: imported[2]! })}</p>
      )}
      {one('errors') && (
        <p className={styles.alert}>
          {t('residents.importErrors')} {one('errors')}
        </p>
      )}

      <form className={styles.form} method="get">
        <label className={styles.field}>
          {t('residents.email')}
          <input className={styles.input} name="q" defaultValue={q} type="search" />
        </label>
      </form>

      {residents.length === 0 ? (
        <p className={styles.empty}>{t('residents.none')}</p>
      ) : (
        <ul className={styles.list}>
          {residents.map((r) => {
            const unit = r.unitId ? unitById.get(r.unitId) : null;
            const building = unit ? buildingById.get(unit.buildingId) : null;
            return (
              <li key={r.id} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{r.name}</span>
                  <span className={styles.muted}>
                    {r.email} · {building && unit ? `${building.name} ${unit.code}` : t('residents.noUnit')}
                  </span>
                </span>
                <span className={styles.actions}>
                  {viewer.kind === 'admin' && r.unitId && (
                    <form action={actAsResidentAction}>
                      <input type="hidden" name="residentId" value={r.id} />
                      <button className={styles.btnGhost}>{t('residents.viewAs')}</button>
                    </form>
                  )}
                  <form action={removeResidentAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className={styles.btnDanger}>{t('manage.remove')}</button>
                  </form>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form action={addResidentAction} className={styles.card}>
        <h2 className={styles.h2}>{t('residents.add')}</h2>
        <div className={styles.form}>
          <label className={styles.field}>
            {t('manage.name')}
            <input className={styles.input} name="name" required maxLength={120} />
          </label>
          <label className={styles.field}>
            {t('residents.email')}
            <input className={styles.input} name="email" type="email" required />
          </label>
          <label className={styles.field}>
            {t('residents.building')}
            <select className={styles.select} name="buildingId" required>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            {t('residents.unit')}
            <input className={styles.input} name="unit" required maxLength={40} />
          </label>
          <button className={styles.btn}>{t('manage.add')}</button>
        </div>
      </form>

      <form action={importCsvAction} className={styles.card}>
        <h2 className={styles.h2}>{t('residents.import')}</h2>
        <p className={styles.hint}>{t('residents.importHint')}</p>
        <input type="file" name="file" accept=".csv,text/csv" />
        <textarea className={styles.textarea} name="csv" placeholder={'building,apartment,name,email\nTalo A,A 12,Maija Meikäläinen,maija@example.com'} />
        <div>
          <button className={styles.btn}>{t('residents.importButton')}</button>
        </div>
      </form>
    </AppShell>
  );
}
