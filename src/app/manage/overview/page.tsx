import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import AppShell from '../../../components/AppShell';
import styles from '../../../components/app.module.css';
import shell from '../../../components/shell.module.css';
import { requireStaff } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import { orgBaseUrl } from '../../../lib/tenant/urls';
import { fmtWhen } from '../../../lib/booking/format';
import { nowMs } from '../../../lib/booking/time';

export const metadata: Metadata = { title: 'Overview' };

const ICON: Record<string, string> = {
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7',
  box: 'M21 8 12 3 3 8v8l9 5 9-5ZM3 8l9 5 9-5M12 13v8',
  cal: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
};

function Tile({ icon, label, children }: { icon: string | null; label: string; children: React.ReactNode }) {
  return (
    <div className={shell.stat}>
      <span className={shell.statIcon}>
        {icon ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={ICON[icon]} />
          </svg>
        ) : (
          <span className={shell.dots} aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} />
            ))}
          </span>
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className={shell.statLabel}>{label}</span>
        <span className={shell.statValue}>{children}</span>
      </span>
    </div>
  );
}

// Home of an organization: where it stands and what is left to set up.
export default async function OverviewPage() {
  const { org, scope, viewer, buildingIds } = await requireStaff();
  const { t, locale } = await getT(org);
  const now = nowMs();
  const nowIso = new Date(now).toISOString();
  const weekIso = new Date(now + 7 * 86_400_000).toISOString();

  const [buildingsAll, units, residents, facilitiesAll, brand, domains] = await Promise.all([
    scope.buildings.q().all(),
    scope.units.q().all(),
    scope.residents.q().where({ status: 'active' }).all(),
    scope.facilities.q().all(),
    scope.brand.q().first(),
    scope.domains.q().all(),
  ]);
  const buildings = buildingIds ? buildingsAll.filter((b) => buildingIds.includes(b.id)) : buildingsAll;
  const visible = new Set(buildings.map((b) => b.id));
  const facilities = facilitiesAll.filter((f) => visible.has(f.buildingId));
  const unitBuilding = new Map(units.map((u) => [u.id, u.buildingId]));
  const residentCount = residents.filter((r) => r.unitId && visible.has(unitBuilding.get(r.unitId) ?? '')).length;
  const facilityIds = facilities.map((f) => f.id);
  const upcoming = facilityIds.length
    ? await scope.bookings
        .q()
        .where((b) => b.facilityId.in(facilityIds))
        .where((b) => b.startsAt.gte(nowIso))
        .where((b) => b.startsAt.lt(weekIso))
        .include('facility', (f) => f)
        .include('resident', (r) => r)
        .orderBy((b) => b.startsAt.asc())
        .all()
    : [];

  const primary = domains.find((d) => d.isPrimary)?.host ?? null;
  const address = orgBaseUrl({ slug: org.slug, primaryHost: primary }, (await headers()).get('host'));
  const isAdmin = viewer.kind === 'admin';
  const settings = `/platform/o/${org.id}`;
  const steps = [
    { label: t('overview.step.logo'), done: Boolean(brand?.logoLightUrl), href: isAdmin ? settings : null },
    { label: t('overview.step.building'), done: buildings.length > 0, href: '/manage' },
    { label: t('overview.step.facilities'), done: facilities.length > 0, href: buildings[0] ? `/manage/b/${buildings[0].id}#facilities` : '/manage' },
    { label: t('overview.step.residents'), done: residentCount > 0, href: '/manage/residents' },
    { label: t('overview.step.address'), done: domains.length > 0, href: isAdmin ? settings : null },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/manage/overview" title={org.name}>
      <div className={shell.address}>
        <a href={address}>{address.replace(/^https?:\/\//, '')}</a>
        <span className={shell.badge}>{org.isDemo ? t('platform.demo') : org.status}</span>
      </div>

      <div className={shell.overviewGrid}>
        <div className={styles.section}>
          <div className={shell.stats}>
            <Tile icon={null} label={t('overview.status')}>
              {org.status}
            </Tile>
            <Tile icon="building" label={t('overview.buildings')}>
              {buildings.length}
            </Tile>
            <Tile icon="people" label={t('overview.residents')}>
              {residentCount}
            </Tile>
            <Tile icon="box" label={t('overview.facilities')}>
              {facilities.length}
            </Tile>
            <Tile icon="cal" label={t('overview.upcoming')}>
              {upcoming.length}
            </Tile>
            <Tile icon="globe" label={t('overview.address')}>
              {primary ?? `${org.slug}.kellona.fi`}
            </Tile>
          </div>

          <h2 className={styles.h2}>{t('overview.recent')}</h2>
          {upcoming.length === 0 ? (
            <p className={styles.empty}>{t('overview.noRecent')}</p>
          ) : (
            <ul className={styles.list}>
              {upcoming.slice(0, 8).map((b) => (
                <li key={b.id} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{b.facility!.name}</span>
                    <span className={styles.muted}>
                      {fmtWhen(b.startsAt, locale, org.timezone)} · {b.resident!.name}
                    </span>
                  </span>
                  <Link className={styles.btnGhost} href={`/manage/b/${b.facility!.buildingId}#bookings`}>
                    {t('overview.open')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <section className={shell.panel}>
          <h2>{t('overview.getStarted')}</h2>
          <p>{t('overview.getStartedLede')}</p>
          <div className={shell.progress} aria-label={`${doneCount}/${steps.length}`}>
            <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <div className={shell.steps}>
            {steps.map((s) => {
              const body = (
                <>
                  <span className={shell.stepCheck} aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  {s.label}
                  <span className={shell.stepState}>{s.done ? t('overview.done') : t('overview.todo')}</span>
                </>
              );
              return s.href ? (
                <Link key={s.label} href={s.href} className={`${shell.step} ${s.done ? shell.stepDone : ''}`}>
                  {body}
                </Link>
              ) : (
                <div key={s.label} className={`${shell.step} ${s.done ? shell.stepDone : ''}`}>
                  {body}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
