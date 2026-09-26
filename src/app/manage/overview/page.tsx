import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import AppShell from '../../../components/AppShell';
import styles from '../../../components/app.module.css';
import shell from '../../../components/shell.module.css';
import { requireStaff } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import { orgBaseUrl } from '../../../lib/tenant/urls';
import { addDays, dayStart, nowMs } from '../../../lib/booking/time';
import { isSpaceKind } from '../../../lib/booking/kinds';
import type { MessageKey } from '../../../lib/i18n/messages';

export const metadata: Metadata = { title: 'Overview' };

const ICON: Record<string, string> = {
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7',
  box: 'M21 8 12 3 3 8v8l9 5 9-5ZM3 8l9 5 9-5M12 13v8',
  cal: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z',
  palette: 'M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1 3.7A2 2 0 0 1 12 22ZM7.5 10.5h.01M10.5 7h.01M15 7.5h.01',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  parking: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM9 17V7h4a3 3 0 0 1 0 6H9',
};

function Svg({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

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
  // Booking activity: the last 7 days and the next 7, per facility type.
  const today = dayStart(new Date(now));
  const windowStart = addDays(today, -7);
  const days = Array.from({ length: 14 }, (_, i) => addDays(windowStart, i));
  const [windowBookings, claims, buildingStates] = await Promise.all([
    facilityIds.length
      ? scope.bookings
          .q()
          .where((b) => b.facilityId.in(facilityIds))
          .where((b) => b.startsAt.gte(windowStart.toISOString()))
          .where((b) => b.startsAt.lt(addDays(today, 7).toISOString()))
          .all()
      : Promise.resolve([]),
    scope.parkingClaims.q().all(),
    scope.buildingAmenities.q().where({ enabled: false }).all(),
  ]);
  const withGuests = windowBookings.length
    ? new Set((await scope.participants.q().where((p) => p.bookingId.in(windowBookings.map((b) => b.id))).all()).map((p) => p.bookingId))
    : new Set<string>();
  const kindOf = new Map(facilities.map((f) => [f.id, isSpaceKind(f.kind) ? 'spaces' : f.kind]));
  const upcoming = windowBookings.filter((b) => b.startsAt >= nowIso && b.startsAt < weekIso);
  const groups = (['laundry', 'sauna', 'spaces'] as const).map((kind) => {
    const rows = windowBookings.filter((b) => kindOf.get(b.facilityId) === kind);
    const perDay = days.map((d) => rows.filter((b) => dayStart(new Date(b.startsAt)).getTime() === d.getTime()).length);
    return {
      kind,
      label: kind === 'spaces' ? t('overview.spaces') : t(`kind.${kind}` as MessageKey),
      total: rows.length,
      perDay,
      max: Math.max(1, ...perDay),
      groups: rows.filter((b) => withGuests.has(b.id)).length,
      weekly: rows.filter((b) => b.seriesId).length,
      present: facilities.some((f) => (kind === 'spaces' ? isSpaceKind(f.kind) : f.kind === kind)),
    };
  });
  const spots = facilities.filter((f) => f.kind === 'parking');
  const claimed = claims.filter((c) => spots.some((s) => s.id === c.facilityId)).length;
  const fmtAxis = (d: Date) => d.toLocaleDateString(locale === 'fi' ? 'fi-FI' : 'en-GB', { day: 'numeric', month: 'short' });

  const primary = domains.find((d) => d.isPrimary && d.verifiedAt)?.host ?? null;
  const address = orgBaseUrl({ slug: org.slug, primaryHost: primary }, (await headers()).get('host'));
  const isAdmin = viewer.kind === 'admin';
  const canManage = buildingIds === null;
  const settings = '/manage/settings';
  const steps = [
    { label: t('overview.step.logo'), done: Boolean(brand?.logoLightUrl), href: canManage ? settings : null },
    { label: t('overview.step.building'), done: buildings.length > 0, href: '/manage' },
    { label: t('overview.step.facilities'), done: facilities.length > 0, href: buildings[0] ? `/manage/b/${buildings[0].id}#facilities` : '/manage' },
    { label: t('overview.step.residents'), done: residentCount > 0, href: '/manage/residents' },
    { label: t('overview.step.address'), done: domains.some((d) => d.verifiedAt), href: canManage ? settings : null },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  type Check = { sev: 'warning' | 'info'; cat: 'setup' | 'data'; title: string; desc: string; href: string | null };
  const checks: Check[] = [];
  for (const b of buildings) {
    const own = facilities.filter((f) => f.buildingId === b.id);
    if (!own.length) checks.push({ sev: 'warning', cat: 'setup', title: t('overview.c.noFacilities'), desc: t('overview.c.noFacilitiesD', { name: b.name }), href: `/manage/b/${b.id}#facilities` });
    const unitIds = new Set(units.filter((u) => u.buildingId === b.id).map((u) => u.id));
    if (!residents.some((r) => r.unitId && unitIds.has(r.unitId))) checks.push({ sev: 'warning', cat: 'data', title: t('overview.c.noResidents'), desc: t('overview.c.noResidentsD', { name: b.name }), href: '/manage/residents' });
    for (const off of buildingStates.filter((s) => s.buildingId === b.id)) {
      if (own.some((f) => f.kind === off.kind)) {
        checks.push({ sev: 'info', cat: 'setup', title: t('overview.c.switchedOff'), desc: t('overview.c.switchedOffD', { kind: t(`kind.${off.kind}` as MessageKey), name: b.name }), href: `/manage/b/${b.id}#amenities` });
      }
    }
  }
  const homeless = residents.filter((r) => !r.unitId).length;
  if (homeless && !buildingIds) checks.push({ sev: 'warning', cat: 'data', title: t('overview.c.homeless'), desc: t('overview.c.homelessD', { n: homeless }), href: '/manage/residents' });
  if (!brand?.logoLightUrl) checks.push({ sev: 'info', cat: 'setup', title: t('overview.c.logo'), desc: t('overview.c.logoD'), href: canManage ? settings : null });
  if (!domains.some((d) => d.verifiedAt)) checks.push({ sev: 'info', cat: 'setup', title: t('overview.c.address'), desc: t('overview.c.addressD', { host: `${org.slug}.kellona.fi` }), href: canManage ? settings : null });

  const first = buildings[0];
  const quick = [
    { icon: 'building', title: t('overview.q.building'), desc: t('overview.q.buildingD'), href: '/manage', show: buildingIds === null },
    { icon: 'people', title: t('overview.q.import'), desc: t('overview.q.importD'), href: '/manage/residents', show: true },
    { icon: 'box', title: t('overview.q.facility'), desc: t('overview.q.facilityD'), href: first ? `/manage/b/${first.id}#facilities` : '/manage', show: true },
    { icon: 'qr', title: t('overview.q.qr'), desc: t('overview.q.qrD'), href: first ? `/manage/b/${first.id}#facilities` : '/manage', show: Boolean(first) },
    { icon: 'palette', title: t('overview.q.brand'), desc: t('overview.q.brandD'), href: settings, show: canManage },
    { icon: 'eye', title: t('overview.q.preview'), desc: t('overview.q.previewD'), href: '/manage/residents', show: isAdmin },
  ].filter((q) => q.show);

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

      <section className={shell.block}>
        <div className={shell.blockHead}>
          <h2>{t('overview.quick')}</h2>
        </div>
        <div className={shell.quick}>
          <svg className={shell.quickCurves} viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 330 C 200 330, 280 120, 480 140 S 760 380, 1000 200" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M0 250 C 260 60, 520 60, 700 250 S 900 380, 1000 300" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {quick.map((q) => (
            <Link key={q.title} href={q.href} className={shell.quickRow}>
              <Svg d={ICON[q.icon]!} />
              <span className={shell.quickText}>
                <strong>{q.title}</strong>
                <span>{q.desc}</span>
              </span>
              <svg className={shell.quickChevron} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      <section className={shell.block}>
        <div className={shell.blockHead}>
          <h2>
            {windowBookings.length}
            <small>{t('overview.bookingsTotal')}</small>
          </h2>
          <span className={shell.blockMeta}>{t('overview.window')}</span>
        </div>
        <div className={shell.carousel}>
          {groups
            .filter((g) => g.present)
            .map((g) => (
              <div key={g.kind} className={shell.chartCard}>
                <div className={shell.chartTop}>
                  <div>
                    <div className={shell.chartTitle}>{g.label}</div>
                    <div className={shell.chartValue}>{g.total}</div>
                  </div>
                  <div className={shell.legend}>
                    <div>
                      <span>
                        <i className={shell.legendDot} style={{ background: '#b45309' }} />
                        {t('overview.groups')}
                      </span>
                      <strong>{g.groups}</strong>
                    </div>
                    <div>
                      <span>
                        <i className={shell.legendDot} style={{ background: '#7b1fa2' }} />
                        {t('overview.weekly')}
                      </span>
                      <strong>{g.weekly}</strong>
                    </div>
                  </div>
                </div>
                <div className={shell.bars} aria-hidden="true">
                  {g.perDay.map((n, i) => (
                    <span
                      key={i}
                      className={`${shell.bar} ${i >= 7 ? shell.barFuture : ''} ${i === 7 ? shell.barToday : ''}`}
                      style={{ height: `${(n / g.max) * 100}%` }}
                      title={`${fmtAxis(days[i]!)}: ${n}`}
                    />
                  ))}
                </div>
                <div className={shell.axis}>
                  <span>{fmtAxis(days[0]!)}</span>
                  <span>{t('overview.today')}</span>
                  <span>{fmtAxis(days[13]!)}</span>
                </div>
              </div>
            ))}
          {spots.length > 0 && (
            <div className={shell.chartCard}>
              <div className={shell.chartTop}>
                <div>
                  <div className={shell.chartTitle}>{t('kind.parking')}</div>
                  <div className={shell.chartValue}>
                    {claimed}/{spots.length}
                  </div>
                </div>
                <div className={shell.legend}>
                  <div>
                    <span>{t('overview.claimed')}</span>
                    <strong>{claimed}</strong>
                  </div>
                  <div>
                    <span>{t('overview.free')}</span>
                    <strong>{spots.length - claimed}</strong>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <div className={shell.meter}>
                  <span style={{ width: `${(claimed / spots.length) * 100}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={shell.block}>
        <div className={shell.blockHead}>
          <h2>{checks.length > 1 ? t('overview.checks', { n: checks.length }) : checks.length === 1 ? t('overview.checksOne') : t('overview.checksNone')}</h2>
          <span className={shell.blockMeta}>{t('overview.checksLede')}</span>
        </div>
        {checks.length > 0 && (
          <div className={shell.carousel}>
            {checks.map((c, i) => (
              <div key={i} className={shell.checkCard} style={{ ['--sev' as string]: c.sev === 'warning' ? '#c2410c' : '#1971c2' }}>
                <div className={shell.checkTop}>
                  <Svg d={ICON['shield']!} size={18} />
                  <span>{t(`overview.cat.${c.cat}` as MessageKey)}</span>
                  <span className={shell.sev}>{t(`overview.sev.${c.sev}` as MessageKey)}</span>
                </div>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
                {c.href && <Link href={c.href}>{t('overview.fix')} &rsaquo;</Link>}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
