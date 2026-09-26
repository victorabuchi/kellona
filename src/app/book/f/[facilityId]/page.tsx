import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppShell from '../../../../components/AppShell';
import BookingBoard, { type BoardDay, type BoardSlot } from '../../../../components/booking/BookingBoard';
import app from '../../../../components/app.module.css';
import styles from '../../../../components/booking/board.module.css';
import { requireResident } from '../../../../lib/auth/access';
import { getT } from '../../../../lib/i18n';
import { loadAmenities, loadNeighbours, residentContext, type FacilityRow } from '../../../../lib/booking/engine';
import { isAmenityKind, isSpaceKind, limitIsPerKind, MAX_REPEAT_WEEKS } from '../../../../lib/booking/kinds';
import { cancelDeadline, canCancel, UNDO_MINUTES, hoursInWeek, lengthOptions, overlaps, startHours, turnHours } from '../../../../lib/booking/rules';
import { addDays, at, dayStart, formatDay, hh, nowMs, parseDay, weekStart } from '../../../../lib/booking/time';
import { fmtWhen } from '../../../../lib/booking/format';
import { boardBookAction, boardCancelAction, boardCheckInAction, boardWatchAction, bookAction, cancelBookingAction, checkInAction, unwatchSlotAction, watchSlotAction } from '../../../../lib/booking/actions';
import { releaseMissed } from '../../../../lib/booking/release';
import { checkInPhase, checkInWindow, isInUse } from '../../../../lib/booking/checkin';
import type { MessageKey } from '../../../../lib/i18n/messages';
import Flash from '../../../../components/Flash';

const ERRORS = ['invalid', 'past', 'tooFar', 'closed', 'tooLong', 'taken', 'mine', 'weekly', 'capacity', 'outsider', 'notAvailable', 'notFound', 'tooLate', 'checkinEarly', 'checkinLate', 'outOfOrder'];

// ISO 8601 week number, from local date parts.
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function Rule({ d, text }: { d: string; text: string }) {
  return (
    <span className={styles.rule}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
      {text}
    </span>
  );
}

const ICON = {
  door: 'M3 21h18M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M15 12h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  cal: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-6.7L3 9',
  gauge: 'M12 14l4-4M3.3 17a10 10 0 1 1 17.4 0',
  check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
};

// Booking page for one facility: rules at a glance, weekly usage, and a week
// board where hovering previews a time and tapping it books or cancels.
export default async function FacilityPage({ params, searchParams }: PageProps<'/book/f/[facilityId]'>) {
  const { facilityId } = await params;
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');

  const { org, scope, viewer } = await requireResident();
  const { t, locale } = await getT(org);
  const ctx = await residentContext(scope, viewer.id);
  if (!ctx) redirect('/book');
  const facility = (await scope.facilities.q().where({ id: facilityId, buildingId: ctx.buildingId }).first()) as (FacilityRow & { cancelCutoffMinutes: number; maxRepeatWeeks: number; checkInOpensMinutes: number; checkInGraceMinutes: number; outOfOrder: boolean; outOfOrderNote: string | null }) | null;
  if (!facility || !isAmenityKind(facility.kind) || facility.kind === 'parking') redirect('/book');
  const amenities = await loadAmenities(scope, ctx.buildingId, ctx.unitId);
  if (!amenities.find((a) => a.kind === facility.kind)?.available) redirect('/book');

  const now = nowMs();
  // Free up bookings nobody checked in to before showing the week.
  if (facility.checkInOpensMinutes > 0) await releaseMissed(org, scope, [facility], now);
  const today = dayStart(new Date(now));
  const selected = parseDay(one('day'), new Date(now));
  const week = weekStart(selected);
  const weekEnd = addDays(week, 7);
  const base = `/book/f/${facility.id}`;
  const href = (day: Date) => `${base}?day=${formatDay(day)}`;
  const tag = locale === 'fi' ? 'fi-FI' : 'en-GB';

  const limitIds = limitIsPerKind(facility.kind)
    ? (await scope.facilities.q().where({ buildingId: ctx.buildingId, kind: facility.kind }).all()).map((f) => f.id)
    : [facility.id];
  const siblings = limitIsPerKind(facility.kind)
    ? await scope.facilities.q().where({ buildingId: ctx.buildingId, kind: facility.kind }).orderBy((f) => f.name.asc()).all()
    : [];
  const [bookings, mineWindow, people, watches] = await Promise.all([
    scope.bookings
      .q()
      .where({ facilityId: facility.id })
      .where((b) => b.startsAt.lt(weekEnd.toISOString()))
      .where((b) => b.endsAt.gt(week.toISOString()))
      .all(),
    scope.bookings
      .q()
      .where({ residentId: ctx.residentId })
      .where((b) => b.facilityId.in(limitIds))
      .where((b) => b.endsAt.gte(new Date(now - 8 * 86_400_000).toISOString()))
      .orderBy((b) => b.startsAt.asc())
      .all(),
    facility.capacity > 1 ? loadNeighbours(scope, ctx) : Promise.resolve({ roommates: [], others: [] }),
    scope.watches.q().where({ facilityId: facility.id, residentId: viewer.id }).all(),
  ]);
  const clock = (d: Date) => d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });

  const turns = turnHours(facility);
  const slotLen = turns ? facility.slotHours : 1;
  const lastBookable = addDays(new Date(now), facility.advanceDays).getTime();
  const starts = startHours(facility);
  const days: BoardDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(week, i);
    const slots: BoardSlot[] = starts.map((h) => {
      const start = at(day, h);
      const end = new Date(start);
      end.setHours(end.getHours() + slotLen);
      const booking = bookings.find((b) => overlaps(start.getTime(), end.getTime(), new Date(b.startsAt).getTime(), new Date(b.endsAt).getTime()));
      const closed = start.getTime() < now || start.getTime() > lastBookable || facility.outOfOrder;
      const state: BoardSlot['state'] = booking ? (booking.residentId === viewer.id ? 'mine' : 'taken') : closed ? 'closed' : 'free';
      const busyAfter = bookings.map((b) => new Date(b.startsAt).getTime()).filter((ms) => ms > start.getTime());
      const lengths = state === 'free' ? lengthOptions(facility, h).filter((n) => busyAfter.every((ms) => start.getTime() + n * 3_600_000 <= ms)) : [];
      return {
        start: start.toISOString(),
        label: hh(h),
        endLabel: hh(h + slotLen),
        state,
        bookingId: state === 'mine' ? booking!.id : undefined,
        cancellable: state === 'mine' ? canCancel(booking!.startsAt, facility.cancelCutoffMinutes, now, booking!.createdAt) : undefined,
        undoLabel:
          state === 'mine' && !canCancel(booking!.startsAt, facility.cancelCutoffMinutes, now) && canCancel(booking!.startsAt, facility.cancelCutoffMinutes, now, booking!.createdAt)
            ? clock(new Date(new Date(booking!.createdAt).getTime() + UNDO_MINUTES * 60_000))
            : undefined,
        deadlineLabel:
          state === 'mine' ? cancelDeadline(booking!.startsAt, facility.cancelCutoffMinutes).toLocaleString(tag, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : undefined,
        lengths: lengths.length ? lengths : [slotLen],
        inUse: booking ? isInUse(booking, now) : false,
        checkIn:
          state === 'mine' && facility.checkInOpensMinutes > 0
            ? {
                phase: checkInPhase(booking!, facility, now),
                opensLabel: clock(checkInWindow(booking!.startsAt, facility).opens),
                untilLabel: clock(checkInWindow(booking!.startsAt, facility).closes),
              }
            : undefined,
        watchId: state === 'taken' ? (watches.find((w) => w.startsAt === start.toISOString())?.id ?? null) : undefined,
      };
    });
    return {
      key: formatDay(day),
      weekday: day.toLocaleDateString(tag, { weekday: 'short' }),
      date: `${day.getDate()}.${day.getMonth() + 1}.`,
      longLabel: day.toLocaleDateString(tag, { weekday: 'long', day: 'numeric', month: 'long' }),
      isToday: day.getTime() === today.getTime(),
      slots,
    };
  });
  const hours = starts.map((h) => hh(h));
  const usedHours = hoursInWeek(
    mineWindow.map((b) => ({ start: new Date(b.startsAt).getTime(), end: new Date(b.endsAt).getTime(), residentId: b.residentId })),
    ctx.residentId,
    selected < today ? today : selected,
  );
  const next = mineWindow.find((b) => b.facilityId === facility.id && new Date(b.endsAt).getTime() > now);
  const selectedIndex = Math.max(0, days.findIndex((d) => d.key === formatDay(selected < today ? today : selected)));

  const error = ERRORS.find((e) => e === one('error'));
  const flash = one('ok') === 'checkedin' ? t('checkin.done') : one('ok') === 'watching' ? t('checkin.watching') : one('ok') ? t('board.done') : '';

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/book" title={siblings.length > 1 ? t(`kind.${facility.kind}` as MessageKey) : facility.name}>
      <div className={styles.hero}>
        <span className={styles.eyebrow}>{ctx.buildingName}</span>
        <Link href="/book" className={app.muted}>
          {t('book.allFacilities')}
        </Link>
      </div>

      {siblings.length > 1 && (
        <nav className={app.chips}>
          {siblings.map((s) => (
            <Link key={s.id} href={`/book/f/${s.id}?day=${formatDay(selected)}`} className={app.chip} aria-current={s.id === facility.id}>
              {s.name}
            </Link>
          ))}
        </nav>
      )}

      <div className={styles.rules}>
        {turns ? (
          <Rule d={ICON.clock} text={t('board.turns', { hours: turns.map((h) => hh(h)).join(', ') })} />
        ) : (
          <>
            <Rule d={ICON.door} text={t('board.open', { from: hh(facility.openHour), to: hh(facility.closeHour) })} />
            <Rule d={ICON.clock} text={t('board.slot', { n: facility.maxHoursPerBooking === 1 ? 1 : `1-${facility.maxHoursPerBooking}` })} />
          </>
        )}
        <Rule d={ICON.cal} text={t('board.ahead', { n: facility.advanceDays })} />
        <Rule d={ICON.undo} text={facility.cancelCutoffMinutes ? t('board.cancelRule', { n: facility.cancelCutoffMinutes }) : t('board.anytime')} />
        <Rule d={ICON.gauge} text={t('board.weekly', { n: facility.maxHoursPerWeek })} />
        {facility.checkInOpensMinutes > 0 && (
          <Rule d={ICON.check} text={t('checkin.rule', { before: facility.checkInOpensMinutes, after: facility.checkInGraceMinutes })} />
        )}
      </div>
      {facility.description && (
        <details className={styles.info}>
          <summary>{t('board.rules')}</summary>
          <p>{facility.description}</p>
        </details>
      )}

      <div className={styles.panelRow}>
        <div className={styles.usage}>
          <div className={styles.usageTop}>
            <span>{t('board.usage')}</span>
            <strong>{t('board.usageValue', { used: usedHours, max: facility.maxHoursPerWeek })}</strong>
          </div>
          <div className={styles.meter}>
            <span style={{ width: `${Math.min(100, (usedHours / facility.maxHoursPerWeek) * 100)}%` }} />
          </div>
        </div>
        {next && (
          <div className={styles.next}>
            <span className={app.muted}>{t('board.nextBooking')}</span>
            <span className={styles.nextWhen}>{fmtWhen(next.startsAt, locale, org.timezone)}</span>
          </div>
        )}
      </div>

      {facility.outOfOrder && (
        <div className={app.alert} role="status">
          <strong>{t('outOfOrder.label')}.</strong> {facility.outOfOrderNote ?? t('outOfOrder.lede')}{' '}
          <Link href={`/book/report?facility=${facility.id}`}>{t('nav.report')}</Link>
        </div>
      )}
      {error && <Flash className={app.alert} tone="err">{t(`book.error.${error}` as MessageKey)}</Flash>}
      {one('skipped') && <Flash className={app.alert} tone="err">{t('book.skipped', { n: one('skipped') })}</Flash>}

      <div className={styles.toolbar}>
        <div className={styles.weekNav}>
          <Link className={styles.navBtn} href={href(addDays(week, -7))} aria-label={t('book.prevWeek')}>
            &lsaquo;
          </Link>
          <span className={styles.weekLabel}>
            {t('board.week', { n: isoWeek(week) })} · {week.getDate()}.{week.getMonth() + 1}.-{addDays(week, 6).getDate()}.{addDays(week, 6).getMonth() + 1}.
          </span>
          <Link className={styles.navBtn} href={href(addDays(week, 7))} aria-label={t('book.nextWeek')}>
            &rsaquo;
          </Link>
          <Link className={styles.navBtn} href={href(today)}>
            {t('board.today')}
          </Link>
        </div>
        <div className={styles.legend}>
          <span>
            <i className={`${styles.swatch} ${styles.sFree}`} />
            {t('board.free')}
          </span>
          <span>
            <i className={`${styles.swatch} ${styles.sTaken}`} />
            {t('board.booked')}
          </span>
          <span>
            <i className={`${styles.swatch} ${styles.sMine}`} />
            {t('board.yours')}
          </span>
          {facility.checkInOpensMinutes > 0 && (
            <span>
              <i className={`${styles.swatch} ${styles.sInUse}`} />
              {t('checkin.inUse')}
            </span>
          )}
        </div>
      </div>

      <BookingBoard
        days={days}
        hours={hours}
        facility={{
          id: facility.id,
          name: facility.name,
          place: ctx.buildingName,
          capacity: facility.capacity,
          withNote: isSpaceKind(facility.kind),
          maxRepeat: Math.max(1, Math.min(MAX_REPEAT_WEEKS, facility.maxRepeatWeeks)),
        }}
        usage={{ used: usedHours, max: facility.maxHoursPerWeek }}
        people={people}
        dayParam={formatDay(selected)}
        returnTo={`${base}?day=${formatDay(selected)}`}
        initialDay={selectedIndex}
        labels={{
          free: t('board.free'),
          booked: t('board.booked'),
          yours: t('board.yours'),
          closed: t('board.closed'),
          confirmTitle: t('board.confirmTitle'),
          reserve: t('board.reserve'),
          close: t('board.close'),
          takenTitle: t('board.takenTitle'),
          takenBody: t('board.takenBody'),
          mineTitle: t('board.mineTitle'),
          cancelBooking: t('board.cancelBooking'),
          hoverBook: t('board.hoverBook'),
          hoverMine: t('board.hoverMine'),
          hoverTaken: t('board.hoverTaken'),
          addCal: t('board.addCal'),
          repeat: t('book.repeat'),
          once: t('book.once'),
          length: t('book.length'),
          note: t('book.note'),
          notePlaceholder: t('book.notePlaceholder'),
          group: t('book.group'),
          groupLede: t('book.groupLede', { n: facility.capacity }),
          inviteApartment: t('book.inviteApartment'),
          yourApartment: t('book.yourApartment'),
          otherResidents: t('book.otherResidents'),
          apt: t('book.apt'),
          limitReached: t('board.limitReached'),
          weeksN: t('board.weeksShort', { n: '{n}' }),
          repeatWeekly: t('board.repeatWeekly'),
          repeatFor: t('board.repeatFor'),
          repeatNote: t('board.repeatNote'),
          inUse: t('checkin.inUse'),
          checkIn: t('checkin.button'),
          checkedIn: t('checkin.checkedIn'),
          notify: t('checkin.notify'),
          watching: t('checkin.watching'),
          unwatch: t('checkin.unwatch'),
          opensAt: t('checkin.opensAt', { time: '{time}' }),
          openUntil: t('checkin.openUntil', { time: '{time}' }),
          live: t('board.live'),
          refresh: t('board.refresh'),
          updated: t('board.updatedAt', { time: '{time}' }),
          holdTip: t('board.holdTip'),
          bookedToast: t('board.bookedToast', { time: '{time}' }),
          cancelledToast: t('board.cancelled'),
          checkedInToast: t('checkin.done'),
          watchingToast: t('checkin.watching'),
          swipeTip: t('board.swipeTip'),
          errors: Object.fromEntries(ERRORS.map((e) => [e, t(`book.error.${e}` as MessageKey)])),
          hoursN: t('book.hours', { n: '{n}' }),
          after: t('board.after', { n: '{n}', max: '{max}' }),
          cancelUntil: t('board.cancelUntil', { time: '{time}' }),
          cancelClosed: t('board.cancelClosed', { time: '{time}' }),
          undoUntil: t('board.undoUntil', { time: '{time}' }),
          cancelConfirm: t('board.cancelConfirm'),
          cancelYes: t('board.cancelYes'),
          cancelKeep: t('board.cancelKeep'),
        }}
        bookAction={bookAction}
        cancelAction={cancelBookingAction}
        checkInAction={checkInAction}
        watchAction={watchSlotAction}
        unwatchAction={unwatchSlotAction}
        live={{ book: boardBookAction, cancel: boardCancelAction, checkIn: boardCheckInAction, watch: boardWatchAction }}
      />
      {flash && (
        <Flash className={styles.toast}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {flash}
        </Flash>
      )}
    </AppShell>
  );
}
