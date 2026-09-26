import type { Metadata } from 'next';
import AppShell from '../../../components/AppShell';
import Modal from '../../../components/Modal';
import styles from '../../../components/app.module.css';
import shell from '../../../components/shell.module.css';
import { requireManager } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import type { T } from '../../../lib/i18n';
import { addStaffAction, removeStaffAction, updateStaffAction } from '../../../lib/manage/staff-actions';
import Flash from '../../../components/Flash';

export const metadata: Metadata = { title: 'Staff' };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Role and building fields, shared by the add dialog and each edit form.
function StaffFields({ t, buildings, role, chosen }: { t: T; buildings: Array<{ id: string; name: string }>; role: string; chosen: string[] }) {
  return (
    <>
      <label className={styles.field} key="role">
        {t('staff.role')}
        <select className={styles.select} name="role" defaultValue={role}>
          <option value="staff">{t('staff.role.staff')}</option>
          <option value="manager">{t('staff.role.manager')}</option>
        </select>
      </label>
      <fieldset className={`${styles.field} ${styles.full}`} key="buildings" style={{ border: 0, padding: 0, margin: 0 }}>
        <span>{t('staff.buildings')}</span>
        <span className={styles.hint}>{t('staff.managerHint')}</span>
        {buildings.map((b) => (
          <label key={b.id} className={styles.check}>
            <input type="checkbox" name="buildings" value={b.id} defaultChecked={chosen.includes(b.id)} />
            {b.name}
          </label>
        ))}
      </fieldset>
    </>
  );
}

export default async function StaffPage({ searchParams }: PageProps<'/manage/staff'>) {
  const sp = await searchParams;
  const { org, scope, viewer } = await requireManager();
  const { t } = await getT(org);
  const [staff, links, buildings] = await Promise.all([
    scope.staff.q().orderBy((s) => s.name.asc()).all(),
    scope.staffBuildings.q().all(),
    scope.buildings.q().orderBy((b) => b.name.asc()).all(),
  ]);
  const buildingName = new Map(buildings.map((b) => [b.id, b.name]));

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/manage/staff" title={t('staff.title')}>
      <p className={styles.lede}>{t('staff.lede')}</p>
      {sp['saved'] && <Flash className={styles.ok}>{t('staff.saved')}</Flash>}
      {sp['error'] && <Flash className={styles.alert} tone="err">{t('staff.error')}</Flash>}

      <div className={shell.toolbar}>
        <span className={shell.blockMeta}>{t('staff.count', { n: staff.length })}</span>
        <Modal
          key="add-staff"
          title={t('staff.add')}
          description={t('staff.addLede')}
          triggerClass={shell.primary}
          openInitially={Boolean(sp['error'])}
          trigger={
            <span key="t" style={{ display: 'contents' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('staff.add')}
            </span>
          }
        >
          <form action={addStaffAction} className={styles.form}>
            <label className={styles.field} key="name">
              {t('manage.name')}
              <input className={styles.input} name="name" required maxLength={120} autoComplete="off" />
            </label>
            <label className={styles.field} key="email">
              {t('residents.email')}
              <input className={styles.input} name="email" type="email" required autoComplete="off" />
            </label>
            <StaffFields t={t} buildings={buildings} role="staff" chosen={[]} />
            <button key="submit" className={`${styles.btn} ${styles.full}`}>
              {t('staff.add')}
            </button>
          </form>
        </Modal>
      </div>

      {staff.length === 0 ? (
        <p className={shell.emptyState}>{t('staff.none')}</p>
      ) : (
        <div className={shell.grid}>
          {staff.map((s) => {
            const mine = links.filter((l) => l.staffId === s.id).map((l) => l.buildingId);
            const isMe = viewer.kind === 'staff' && viewer.id === s.id;
            return (
              <div key={s.id} className={shell.orgCard} style={{ ['--card' as string]: 'var(--brand)' }}>
                <div className={shell.orgTop}>
                  <span className={shell.orgMark}>{initials(s.name) || '?'}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className={shell.orgName} style={{ display: 'block' }}>
                      {s.name}
                    </span>
                    <span className={styles.muted} style={{ overflowWrap: 'anywhere' }}>
                      {s.email}
                    </span>
                  </span>
                </div>
                <span className={shell.orgMeta}>
                  <span className={`${shell.badge} ${s.role === 'manager' ? shell.badgeLive : ''}`}>{t(s.role === 'manager' ? 'staff.role.manager' : 'staff.role.staff')}</span>
                  {isMe && <span className={shell.badge}>{t('staff.you')}</span>}
                  {s.role === 'manager' ? (
                    <span className={shell.badge}>{t('staff.allBuildings')}</span>
                  ) : (
                    mine.map((id) => (
                      <span key={id} className={shell.badge}>
                        {buildingName.get(id)}
                      </span>
                    ))
                  )}
                </span>
                <details className={styles.details}>
                  <summary>{t('staff.edit')}</summary>
                  <form action={updateStaffAction} className={styles.form}>
                    <input type="hidden" name="id" value={s.id} />
                    <label className={styles.field} key="name">
                      {t('manage.name')}
                      <input className={styles.input} name="name" defaultValue={s.name} maxLength={120} />
                    </label>
                    <StaffFields t={t} buildings={buildings} role={s.role} chosen={mine} />
                    <button key="save" className={styles.btn}>
                      {t('manage.save')}
                    </button>
                  </form>
                  {!isMe && (
                    <form action={removeStaffAction} style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className={styles.btnDanger}>{t('manage.remove')}</button>
                    </form>
                  )}
                </details>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
