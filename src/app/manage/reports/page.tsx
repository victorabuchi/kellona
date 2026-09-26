import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import styles from '../../../components/app.module.css';
import shell from '../../../components/shell.module.css';
import { requireStaff } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import type { MessageKey } from '../../../lib/i18n/messages';
import { fmtWhen } from '../../../lib/booking/format';
import { REPORT_STATUSES } from '../../../lib/support/constants';
import { updateReportAction } from '../../../lib/manage/support-actions';

export const metadata: Metadata = { title: 'Reports' };

// Problem reports from residents. Staff see only their own buildings.
export default async function ReportsPage({ searchParams }: PageProps<'/manage/reports'>) {
  const sp = await searchParams;
  const show = sp['show'] === 'done' || sp['show'] === 'all' ? (sp['show'] as string) : 'open';
  const { org, scope, viewer, buildingIds } = await requireStaff();
  const { t, locale } = await getT(org);
  let query = scope.reports.q().include('facility', (f) => f).include('resident', (r) => r).orderBy((r) => r.createdAt.desc());
  if (show === 'open') query = query.where((r) => r.status.neq('done'));
  if (show === 'done') query = query.where({ status: 'done' });
  const [all, buildings, units] = await Promise.all([query.limit(200).all(), scope.buildings.q().all(), scope.units.q().all()]);
  const reports = buildingIds ? all.filter((r) => r.buildingId && buildingIds.includes(r.buildingId)) : all;
  const buildingName = new Map(buildings.map((b) => [b.id, b.name]));
  const unitCode = new Map(units.map((u) => [u.id, u.code]));

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/manage/reports" title={t('reports.title')}>
      <p className={styles.lede}>{t('reports.lede')}</p>
      <nav className={styles.chips}>
        {(['open', 'done', 'all'] as const).map((f) => (
          <Link key={f} href={`/manage/reports?show=${f}`} className={styles.chip} aria-current={show === f}>
            {t(`reports.filter.${f}` as MessageKey)}
          </Link>
        ))}
      </nav>
      {reports.length === 0 ? (
        <p className={shell.emptyState}>{t('reports.none')}</p>
      ) : (
        <div className={styles.section}>
          {reports.map((r) => (
            <form key={r.id} action={updateReportAction} className={styles.card}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="show" value={show} />
              <div className={shell.toolbar}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>
                    {r.facility?.name ?? t('report.building')} · {t(`report.cat.${r.category}` as MessageKey)}
                  </span>
                  <span className={styles.muted}>
                    {[r.buildingId ? buildingName.get(r.buildingId) : null, fmtWhen(r.createdAt, locale, org.timezone), t('reports.by', { name: r.resident?.name ?? '', unit: r.resident?.unitId ? (unitCode.get(r.resident.unitId) ?? '') : '' })]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className={`${shell.badge} ${r.status === 'done' ? shell.badgeLive : r.status === 'new' ? shell.badgePending : ''}`}>{t(`report.status.${r.status}` as MessageKey)}</span>
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{r.message}</p>
              <div className={styles.form}>
                <label className={styles.field}>
                  {t('brand.status')}
                  <select className={styles.select} name="status" defaultValue={r.status}>
                    {REPORT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`report.status.${s}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  {t('reports.staffNote')}
                  <input className={styles.input} name="staffNote" defaultValue={r.staffNote ?? ''} maxLength={2000} />
                </label>
                {r.facilityId && !r.facility?.outOfOrder && (
                  <label className={`${styles.check} ${styles.full}`}>
                    <input type="checkbox" name="markOutOfOrder" value="1" />
                    {t('reports.markOut')}
                  </label>
                )}
                <button className={styles.btn}>{t('reports.save')}</button>
              </div>
            </form>
          ))}
        </div>
      )}
    </AppShell>
  );
}
