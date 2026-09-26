import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '../../components/AppShell';
import KindIcon from '../../components/KindIcon';
import PushToggle from '../../components/PushToggle';
import styles from '../../components/app.module.css';
import { requireResident } from '../../lib/auth/access';
import { getT } from '../../lib/i18n';
import { loadAmenities, residentContext } from '../../lib/booking/engine';
import { isSpaceKind, type AmenityKind } from '../../lib/booking/kinds';
import { fmtWhen } from '../../lib/booking/format';
import { nowMs } from '../../lib/booking/time';
import { cancelBookingAction, cancelSeriesAction, checkInAction, respondInviteAction } from '../../lib/booking/actions';
import { releaseMissed } from '../../lib/booking/release';
import { checkInPhase } from '../../lib/booking/checkin';

export const metadata: Metadata = { title: 'Booking' };

type Card = { key: string; kind: AmenityKind; name: string; blurb: string; href: string; out?: boolean };

export default async function BookHubPage() {
  const { org, scope, viewer } = await requireResident();
  const { t, locale } = await getT(org);
  const ctx = await residentContext(scope, viewer.id);
  if (!ctx) {
    return (
      <AppShell org={org} viewer={viewer} t={t} active="/book" title={t('book.title')}>
        <p className={styles.empty}>{t('book.noHome')}</p>
      </AppShell>
    );
  }
  const now = nowMs();
  const nowIso = new Date(now).toISOString();
  const when = (iso: string) => fmtWhen(iso, locale, org.timezone);

  // Free up bookings nobody checked in to in this building.
  const checkInFacilities = await scope.facilities.q().where({ buildingId: ctx.buildingId }).where((f) => f.checkInOpensMinutes.gt(0)).all();
  if (checkInFacilities.length) await releaseMissed(org, scope, checkInFacilities, now);

  const [amenities, facilities, mine, participations, claim] = await Promise.all([
    loadAmenities(scope, ctx.buildingId, ctx.unitId),
    scope.facilities.q().where({ buildingId: ctx.buildingId }).orderBy((f) => f.sortOrder.asc()).orderBy((f) => f.name.asc()).all(),
    scope.bookings.q().where({ residentId: ctx.residentId }).where((b) => b.endsAt.gte(nowIso)).include('facility', (f) => f).orderBy((b) => b.startsAt.asc()).all(),
    scope.participants.q().where({ residentId: ctx.residentId }).where((p) => p.status.neq('declined')).all(),
    scope.parkingClaims.q().where({ residentId: ctx.residentId }).include('facility', (f) => f).first(),
  ]);
  const available = new Set(amenities.filter((a) => a.available).map((a) => a.kind));

  const cards: Card[] = [];
  for (const kind of ['laundry', 'sauna', 'parking'] as const) {
    if (!available.has(kind)) continue;
    const first = facilities.find((f) => f.kind === kind)!;
    const count = amenities.find((a) => a.kind === kind)!.count;
    const allOut = facilities.filter((f) => f.kind === kind).every((f) => f.outOfOrder);
    cards.push({ key: kind, kind, name: t(`kind.${kind}`), blurb: allOut ? (first.outOfOrderNote ?? t('outOfOrder.lede')) : t(`blurb.${kind}`, { n: count }), href: kind === 'parking' ? '/book/parking' : `/book/f/${first.id}`, out: allOut });
  }
  for (const f of facilities) {
    if (!isSpaceKind(f.kind) || !available.has(f.kind)) continue;
    cards.push({ key: f.id, kind: f.kind, name: f.name, blurb: f.outOfOrder ? (f.outOfOrderNote ?? t('outOfOrder.lede')) : f.description || t('blurb.space', { n: f.capacity }), href: `/book/f/${f.id}`, out: f.outOfOrder });
  }

  // Group sizes for my bookings, and bookings I was invited to.
  const myIds = mine.map((b) => b.id);
  const [groupRows, joined] = await Promise.all([
    myIds.length ? scope.participants.q().where((p) => p.bookingId.in(myIds)).where((p) => p.status.neq('declined')).all() : Promise.resolve([]),
    participations.length
      ? scope.bookings
          .q()
          .where((b) => b.id.in(participations.map((p) => p.bookingId)))
          .where((b) => b.endsAt.gte(nowIso))
          .include('facility', (f) => f)
          .include('resident', (r) => r)
          .orderBy((b) => b.startsAt.asc())
          .all()
      : Promise.resolve([]),
  ]);
  const statusOf = (bookingId: string) => participations.find((p) => p.bookingId === bookingId)?.status;
  const invites = joined.filter((b) => statusOf(b.id) === 'invited');
  const accepted = joined.filter((b) => statusOf(b.id) === 'accepted');

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/book" title={t('book.title')}>
      <p className={styles.lede}>{t('book.lede', { building: ctx.buildingName })}</p>

      {invites.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('book.invites')}</h2>
          <ul className={styles.list}>
            {invites.map((b) => (
              <li key={b.id} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{b.facility!.name}</span>
                  <span className={styles.muted}>{t('book.invitedYou', { name: b.resident!.name, when: when(b.startsAt) })}</span>
                </span>
                <form action={respondInviteAction} className={styles.actions}>
                  <input type="hidden" name="bookingId" value={b.id} />
                  <button className={styles.btn} name="decision" value="accept">
                    {t('book.accept')}
                  </button>
                  <button className={styles.btnGhost} name="decision" value="decline">
                    {t('book.decline')}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.h2}>{t('book.available')}</h2>
        {cards.length === 0 ? (
          <p className={styles.empty}>{t('book.nothing')}</p>
        ) : (
          <div className={styles.cards}>
            {cards.map((c) => (
              <Link key={c.key} href={c.href} className={styles.tile}>
                <span className={styles.tileIcon}>
                  <KindIcon kind={c.kind} />
                </span>
                <span className={styles.tileName}>
                  {c.name} {c.out && <span className={styles.alert} style={{ padding: '1px 8px', fontSize: 12 }}>{t('outOfOrder.label')}</span>}
                </span>
                <span className={styles.muted}>{c.blurb}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{t('book.upcoming')}</h2>
        {mine.length === 0 && accepted.length === 0 && !claim ? (
          <p className={styles.empty}>{t('book.noUpcoming')}</p>
        ) : (
          <ul className={styles.list}>
            {claim && (
              <li className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{t('book.parkingHeld', { label: claim.facility!.name })}</span>
                </span>
                <Link className={styles.btnGhost} href="/book/parking">
                  {t('book.manage')}
                </Link>
              </li>
            )}
            {mine.map((b) => {
              const n = groupRows.filter((p) => p.bookingId === b.id).length;
              return (
                <li key={b.id} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{b.facility!.name}</span>
                    <span className={styles.muted}>
                      {when(b.startsAt)} · {n ? t('book.withCount', { n }) : t('book.you')}
                      {b.seriesId ? ` · ${t('book.weekly')}` : ''}
                    {checkInPhase(b, b.facility!, now) === 'checkedIn' ? ` · ${t('checkin.checkedIn')}` : ''}
                    </span>
                  </span>
                  <span className={styles.actions}>
                    {checkInPhase(b, b.facility!, now) === 'open' && (
                      <form action={checkInAction}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <button className={styles.btn}>{t('checkin.button')}</button>
                      </form>
                    )}
                    <a className={styles.btnGhost} href={`/book/ics/${b.id}`}>
                      {t('book.calendar')}
                    </a>
                    <form action={cancelBookingAction}>
                      <input type="hidden" name="bookingId" value={b.id} />
                      <button className={styles.btnDanger}>{t('book.cancel')}</button>
                    </form>
                    {b.seriesId && (
                      <form action={cancelSeriesAction}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <button className={styles.btnDanger}>{t('book.cancelSeries')}</button>
                      </form>
                    )}
                  </span>
                </li>
              );
            })}
            {accepted.map((b) => (
              <li key={b.id} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{b.facility!.name}</span>
                  <span className={styles.muted}>
                    {when(b.startsAt)} · {t('book.organiser', { name: b.resident!.name })}
                  </span>
                </span>
                <span className={styles.actions}>
                  <a className={styles.btnGhost} href={`/book/ics/${b.id}`}>
                    {t('book.calendar')}
                  </a>
                  <form action={respondInviteAction}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <button className={styles.btnGhost} name="decision" value="decline">
                      {t('book.leave')}
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PushToggle labels={{ enable: t('push.enable'), on: t('push.on'), unsupported: t('push.unsupported') }} vapidKey={process.env['VAPID_PUBLIC_KEY'] ?? ''} />
    </AppShell>
  );
}
