import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import styles from '../../../components/app.module.css';
import shell from '../../../components/shell.module.css';
import { requireResident } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import { fmtWhen } from '../../../lib/booking/format';
import { canCancel, hoursInWeek } from '../../../lib/booking/rules';
import { cancelBookingAction } from '../../../lib/booking/actions';
import ConfirmCancel from '../../../components/ConfirmCancel';
import Flash from '../../../components/Flash';
import { nowMs } from '../../../lib/booking/time';

export const metadata: Metadata = { title: 'My bookings' };

// Everything the resident booked: upcoming, recent history with check-ins and no-shows.
export default async function MyBookingsPage({ searchParams }: PageProps<'/book/mine'>) {
  const { org, scope, viewer } = await requireResident();
  const { t, locale } = await getT(org);
  const now = nowMs();
  const nowIso = new Date(now).toISOString();
  const since = new Date(now - 30 * 86_400_000).toISOString();
  const [upcoming, past, releases, claim] = await Promise.all([
    scope.bookings.q().where({ residentId: viewer.id }).where((b) => b.endsAt.gte(nowIso)).include('facility', (f) => f).orderBy((b) => b.startsAt.asc()).all(),
    scope.bookings.q().where({ residentId: viewer.id }).where((b) => b.endsAt.lt(nowIso)).where((b) => b.startsAt.gte(since)).include('facility', (f) => f).orderBy((b) => b.startsAt.desc()).all(),
    scope.releases.q().where({ residentId: viewer.id }).where((r) => r.startsAt.gte(since)).include('facility', (f) => f).all(),
    scope.parkingClaims.q().where({ residentId: viewer.id }).include('facility', (f) => f).first(),
  ]);
  const when = (iso: string) => fmtWhen(iso, locale, org.timezone);
  const tooLate = (await searchParams)['error'] === 'tooLate';
  const cancelLabels = { cancel: t('book.cancel'), confirm: t('board.cancelConfirm'), yes: t('board.cancelYes'), keep: t('board.cancelKeep') };
  const busy = [...upcoming, ...past].map((b) => ({ start: new Date(b.startsAt).getTime(), end: new Date(b.endsAt).getTime(), residentId: b.residentId }));
  const weekHours = hoursInWeek(busy, viewer.id, new Date(now));
  const history = [
    ...past.map((b) => ({ key: b.id, at: b.startsAt, name: b.facility!.name, facilityId: b.facilityId, state: b.checkedInAt ? 'checked' : 'used' })),
    ...releases.map((r) => ({ key: r.id, at: r.startsAt, name: r.facility!.name, facilityId: r.facilityId, state: 'noshow' })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/book/mine" title={t('mine.title')}>
      <p className={styles.lede}>{t('mine.lede')}</p>
      {tooLate && (
        <Flash className={styles.alert} tone="err">
          {t('book.error.tooLate')}
        </Flash>
      )}
      <div className={shell.stats}>
        {[
          [t('mine.statUpcoming'), upcoming.length],
          [t('mine.statHours'), weekHours],
          [t('mine.statNoShows'), releases.length],
        ].map(([label, value]) => (
          <div key={label} className={shell.stat}>
            <span>
              <span className={shell.statLabel}>{label}</span>
              <span className={shell.statValue}>{value}</span>
            </span>
          </div>
        ))}
      </div>

      <section className={styles.section}>
        <h2 className={styles.h2}>{t('mine.upcoming')}</h2>
        {upcoming.length === 0 && !claim ? (
          <p className={styles.empty}>{t('mine.none')}</p>
        ) : (
          <ul className={styles.list}>
            {claim && (
              <li className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{t('book.parkingHeld', { label: claim.facility!.name })}</span>
                </span>
                <Link className={styles.btnGhost} href="/book/parking">
                  {t('mine.open')}
                </Link>
              </li>
            )}
            {upcoming.map((b) => (
              <li key={b.id} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{b.facility!.name}</span>
                  <span className={styles.muted}>
                    {when(b.startsAt)}
                    {b.checkedInAt ? ` · ${t('mine.checkedIn')}` : ''}
                    {b.seriesId ? ` · ${t('book.weekly')}` : ''}
                  </span>
                </span>
                <span className={styles.actions}>
                  <a className={styles.btnGhost} href={`/book/ics/${b.id}`}>
                    {t('book.calendar')}
                  </a>
                  <Link className={styles.btn} href={`/book/f/${b.facilityId}`}>
                    {t('mine.open')}
                  </Link>
                  {canCancel(b.startsAt, b.facility!.cancelCutoffMinutes, now, b.createdAt) && (
                    <ConfirmCancel action={cancelBookingAction} bookingId={b.id} returnTo="/book/mine" labels={cancelLabels} />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{t('mine.past')}</h2>
        {history.length === 0 ? (
          <p className={styles.empty}>{t('mine.nonePast')}</p>
        ) : (
          <ul className={styles.list}>
            {history.map((h) => (
              <li key={h.key} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{h.name}</span>
                  <span className={styles.muted}>{when(h.at)}</span>
                </span>
                <span className={`${shell.badge} ${h.state === 'noshow' ? shell.badgePending : shell.badgeLive}`}>
                  {h.state === 'noshow' ? t('mine.noShow') : h.state === 'checked' ? t('mine.checkedIn') : t('mine.used')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
