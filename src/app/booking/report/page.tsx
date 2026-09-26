import type { Metadata } from 'next';
import AppShell from '../../../components/AppShell';
import styles from '../../../components/app.module.css';
import shell from '../../../components/shell.module.css';
import { requireResident } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import type { MessageKey } from '../../../lib/i18n/messages';
import { residentContext } from '../../../lib/booking/engine';
import { fmtWhen } from '../../../lib/booking/format';
import { REPORT_CATEGORIES } from '../../../lib/support/constants';
import { sendReportAction } from '../../../lib/support/actions';
import Flash from '../../../components/Flash';

export const metadata: Metadata = { title: 'Report a problem' };

export default async function ReportPage({ searchParams }: PageProps<'/booking/report'>) {
  const sp = await searchParams;
  const { org, scope, viewer } = await requireResident();
  const { t, locale } = await getT(org);
  const ctx = await residentContext(scope, viewer.id);
  const [facilities, reports, emergency] = await Promise.all([
    ctx ? scope.facilities.q().where({ buildingId: ctx.buildingId }).orderBy((f) => f.name.asc()).all() : Promise.resolve([]),
    scope.reports.q().where({ residentId: viewer.id }).include('facility', (f) => f).orderBy((r) => r.createdAt.desc()).limit(20).all(),
    scope.contacts.q().where({ emergency: true }).orderBy((c) => c.sortOrder.asc()).first(),
  ]);
  const badge = (status: string) => (status === 'done' ? shell.badgeLive : status === 'new' ? shell.badgePending : '');

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/booking/report" title={t('report.title')}>
      <p className={styles.lede}>{t('report.lede')}</p>
      {emergency?.phone && (
        <a className={shell.emergency} href={`tel:${emergency.phone.replace(/[^+\d]/g, '')}`}>
          <strong>{t('report.emergency')}</strong>
          <span>
            {emergency.title} · {emergency.phone}
          </span>
        </a>
      )}
      {sp['sent'] && <Flash className={styles.ok} ms={4000}>{t('report.sent')}</Flash>}
      {sp['error'] && <Flash className={styles.alert} tone="err">{t('report.error')}</Flash>}

      <form action={sendReportAction} className={`${styles.card} ${styles.form}`}>
        <label className={styles.field}>
          {t('report.facility')}
          <select className={styles.select} name="facilityId" defaultValue={typeof sp['facility'] === 'string' ? sp['facility'] : ''}>
            <option value="">{t('report.building')}</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({t(`kind.${f.kind}` as MessageKey)})
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          {t('report.category')}
          <select className={styles.select} name="category" defaultValue="broken">
            {REPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`report.cat.${c}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className={`${styles.field} ${styles.full}`}>
          {t('report.message')}
          <textarea className={styles.textarea} style={{ fontFamily: 'inherit', fontSize: 15 }} name="message" required minLength={3} maxLength={2000} placeholder={t('report.messageHint')} />
        </label>
        <button className={`${styles.btn} ${styles.full}`}>{t('report.send')}</button>
      </form>

      <section className={styles.section}>
        <h2 className={styles.h2}>{t('report.yours')}</h2>
        {reports.length === 0 ? (
          <p className={styles.empty}>{t('report.none')}</p>
        ) : (
          <ul className={styles.list}>
            {reports.map((r) => (
              <li key={r.id} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>
                    {r.facility?.name ?? t('report.building')} · {t(`report.cat.${r.category}` as MessageKey)}
                  </span>
                  <span className={styles.muted}>
                    {fmtWhen(r.createdAt, locale, org.timezone)} · {r.message}
                  </span>
                  {r.staffNote && (
                    <span className={styles.muted}>
                      <strong>{t('report.reply')}:</strong> {r.staffNote}
                    </span>
                  )}
                </span>
                <span className={`${shell.badge} ${badge(r.status)}`}>{t(`report.status.${r.status}` as MessageKey)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
