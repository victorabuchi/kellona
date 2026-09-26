import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppShell from '../../../../components/AppShell';
import BookingPanel from '../../../../components/BookingPanel';
import styles from '../../../../components/app.module.css';
import { requireResident } from '../../../../lib/auth/access';
import { getT } from '../../../../lib/i18n';
import { loadAmenities, loadNeighbours, residentContext, type FacilityRow } from '../../../../lib/booking/engine';
import { isAmenityKind, isSpaceKind, limitIsPerKind } from '../../../../lib/booking/kinds';
import { lengthOptions, startHours, turnHours, overlaps } from '../../../../lib/booking/rules';
import { addDays, at, dayStart, formatDay, hh, nowMs, parseDay, weekStart } from '../../../../lib/booking/time';
import { fmtDayLong, fmtWeekday } from '../../../../lib/booking/format';
import { bookAction, cancelBookingAction } from '../../../../lib/booking/actions';
import type { MessageKey } from '../../../../lib/i18n/messages';

const ERRORS = ['invalid', 'past', 'tooFar', 'closed', 'tooLong', 'taken', 'weekly', 'capacity', 'outsider', 'notAvailable', 'notFound'];

export default async function FacilityPage({ params, searchParams }: PageProps<'/book/f/[facilityId]'>) {
  const { facilityId } = await params;
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');

  const { org, scope, viewer } = await requireResident();
  const { t, locale } = await getT(org);
  const ctx = await residentContext(scope, viewer.id);
  if (!ctx) redirect('/book');
  const facility = (await scope.facilities.q().where({ id: facilityId, buildingId: ctx.buildingId }).first()) as FacilityRow | null;
  if (!facility || !isAmenityKind(facility.kind) || facility.kind === 'parking') redirect('/book');
  const amenities = await loadAmenities(scope, ctx.buildingId, ctx.unitId);
  if (!amenities.find((a) => a.kind === facility.kind)?.available) redirect('/book');

  const now = nowMs();
  const today = dayStart(new Date(now));
  const lastDay = dayStart(addDays(new Date(now), facility.advanceDays));
  const day = parseDay(one('day'), new Date(now));
  const dayParam = formatDay(day);
  const week = weekStart(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const base = `/book/f/${facility.id}`;
  const href = (p: Record<string, string>) => `${base}?${new URLSearchParams(p).toString()}`;

  const siblings = limitIsPerKind(facility.kind)
    ? await scope.facilities.q().where({ buildingId: ctx.buildingId, kind: facility.kind }).orderBy((f) => f.name.asc()).all()
    : [];

  const from = day.toISOString();
  const to = addDays(day, 1).toISOString();
  const bookings = await scope.bookings
    .q()
    .where({ facilityId: facility.id })
    .where((b) => b.startsAt.lt(to))
    .where((b) => b.endsAt.gt(from))
    .all();

  const turns = turnHours(facility);
  const slotLen = turns ? facility.slotHours : 1;
  const slots = startHours(facility).map((h) => {
    const start = at(day, h);
    const end = new Date(start);
    end.setHours(end.getHours() + slotLen);
    const booking = bookings.find((b) => overlaps(start.getTime(), end.getTime(), new Date(b.startsAt).getTime(), new Date(b.endsAt).getTime()));
    const past = start.getTime() < now;
    const beyond = start.getTime() > addDays(new Date(now), facility.advanceDays).getTime();
    return { h, start, end, booking, closed: past || beyond };
  });

  // The picked slot opens the booking panel.
  const pick = one('pick');
  const picked = slots.find((s) => s.start.toISOString() === pick && !s.booking && !s.closed);
  let panel: React.ReactNode = null;
  if (picked) {
    const nextBusy = bookings.map((b) => new Date(b.startsAt).getTime()).filter((ms) => ms > picked.start.getTime());
    const lengths = lengthOptions(facility, picked.h).filter((n) => nextBusy.every((ms) => picked.start.getTime() + n * 3_600_000 <= ms));
    const people = facility.capacity > 1 ? await loadNeighbours(scope, ctx) : { roommates: [], others: [] };
    const endHour = picked.h + (turns ? facility.slotHours : lengths[0] ?? 1);
    panel = (
      <BookingPanel
        action={bookAction}
        hidden={{ facilityId: facility.id, day: dayParam, startsAt: picked.start.toISOString() }}
        whenLabel={`${fmtDayLong(day, locale)} ${hh(picked.h)}${turns ? `-${hh(endHour)}` : ''}`}
        lengths={lengths.length ? lengths : [1]}
        capacity={facility.capacity}
        roommates={people.roommates}
        others={people.others}
        closeHref={href({ day: dayParam })}
        withNote={isSpaceKind(facility.kind)}
        t={t}
      />
    );
  }

  const error = ERRORS.find((e) => e === one('error'));
  const rules = turns
    ? t('book.rulesTurns', { len: facility.slotHours, week: facility.maxHoursPerWeek, days: facility.advanceDays })
    : t('book.rules', { max: facility.maxHoursPerBooking, week: facility.maxHoursPerWeek, days: facility.advanceDays });

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/book" title={siblings.length > 1 ? t(`kind.${facility.kind}` as MessageKey) : facility.name}>
      <Link href="/book" className={styles.muted}>
        {t('book.allFacilities')}
      </Link>
      {siblings.length > 1 && (
        <nav className={styles.chips}>
          {siblings.map((s) => (
            <Link key={s.id} href={`/book/f/${s.id}?day=${dayParam}`} className={styles.chip} aria-current={s.id === facility.id}>
              {s.name}
            </Link>
          ))}
        </nav>
      )}
      <p className={styles.lede}>{facility.description ? `${facility.description} ` : ''}{rules}</p>

      {error && <p className={styles.alert}>{t(`book.error.${error}` as MessageKey)}</p>}
      {one('ok') && <p className={styles.ok}>{t('book.booked')}</p>}
      {one('skipped') && <p className={styles.alert}>{t('book.skipped', { n: one('skipped') })}</p>}

      <div className={styles.weekNav}>
        <Link className={styles.btnGhost} href={href({ day: formatDay(addDays(week, -7)) })} aria-label={t('book.prevWeek')}>
          &lsaquo;
        </Link>
        <Link className={styles.btnGhost} href={href({ day: formatDay(today) })}>
          {t('book.today')}
        </Link>
        <Link className={styles.btnGhost} href={href({ day: formatDay(addDays(week, 7)) })} aria-label={t('book.nextWeek')}>
          &rsaquo;
        </Link>
      </div>
      <nav className={styles.days}>
        {days.map((d) => (
          <Link
            key={d.getTime()}
            href={href({ day: formatDay(d) })}
            className={styles.day}
            aria-current={d.getTime() === day.getTime()}
            data-off={d < today || d > lastDay}
          >
            <span>{fmtWeekday(d, locale)}</span>
            <strong>{d.getDate()}</strong>
          </Link>
        ))}
      </nav>

      <h2 className={styles.h2}>{fmtDayLong(day, locale)}</h2>
      {panel}
      <ul className={styles.list}>
        {slots.map((s) => {
          const mine = s.booking?.residentId === viewer.id;
          const isPicked = picked?.h === s.h;
          return (
            <li key={s.h} className={`${styles.slot} ${mine ? styles.slotMine : ''} ${isPicked ? styles.slotPicked : ''}`}>
              <span className={styles.slotTime}>
                {hh(s.h)}
                {turns ? `-${hh(s.h + facility.slotHours)}` : ''}
              </span>
              {mine ? (
                <form action={cancelBookingAction} className={styles.actions}>
                  <span className={styles.badge}>{t('book.slotMine')}</span>
                  <input type="hidden" name="bookingId" value={s.booking!.id} />
                  <input type="hidden" name="returnTo" value={href({ day: dayParam })} />
                  <button className={styles.btnDanger}>{t('book.cancel')}</button>
                </form>
              ) : s.booking ? (
                <span className={styles.badge}>{t('book.slotTaken')}</span>
              ) : s.closed ? (
                <span className={styles.badge}>{t('book.slotPast')}</span>
              ) : (
                <Link className={styles.btn} href={`${href({ day: dayParam, pick: s.start.toISOString() })}#panel`}>
                  {t('book.slotFree')}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
