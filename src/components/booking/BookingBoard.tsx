'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import styles from './board.module.css';

export type BoardSlot = {
  start: string;
  label: string;
  endLabel: string;
  state: 'free' | 'taken' | 'mine' | 'closed';
  bookingId?: string;
  cancellable?: boolean;
  deadlineLabel?: string;
  // Set when only the just-booked undo window allows cancelling.
  undoLabel?: string;
  lengths: number[];
  // Someone checked in and the time is running now.
  inUse?: boolean;
  // Own bookings at facilities that use check-in.
  checkIn?: { phase: 'off' | 'notYet' | 'open' | 'checkedIn' | 'missed' | 'over'; opensLabel: string; untilLabel: string };
  // Set when the viewer asked to be told if this booked time frees up.
  watchId?: string | null;
};

export type BoardDay = { key: string; weekday: string; date: string; longLabel: string; isToday: boolean; slots: BoardSlot[] };

export type BoardLabels = Record<
  | 'free'
  | 'booked'
  | 'yours'
  | 'closed'
  | 'confirmTitle'
  | 'reserve'
  | 'close'
  | 'takenTitle'
  | 'takenBody'
  | 'mineTitle'
  | 'cancelBooking'
  | 'hoverBook'
  | 'hoverMine'
  | 'hoverTaken'
  | 'addCal'
  | 'repeat'
  | 'once'
  | 'length'
  | 'note'
  | 'notePlaceholder'
  | 'group'
  | 'groupLede'
  | 'inviteApartment'
  | 'yourApartment'
  | 'otherResidents'
  | 'apt'
  | 'limitReached'
  // Templates with {n}, {max} or {time}, filled in here.
  | 'weeksN'
  | 'hoursN'
  | 'after'
  | 'cancelUntil'
  | 'cancelClosed'
  | 'undoUntil'
  | 'cancelConfirm'
  | 'cancelYes'
  | 'cancelKeep'
  | 'repeatWeekly'
  | 'repeatFor'
  | 'repeatNote'
  | 'inUse'
  | 'checkIn'
  | 'checkedIn'
  | 'notify'
  | 'watching'
  | 'unwatch'
  | 'opensAt'
  | 'openUntil'
  | 'live'
  | 'refresh'
  | 'updated'
  | 'holdTip'
  | 'bookedToast'
  | 'cancelledToast'
  | 'checkedInToast'
  | 'watchingToast'
  | 'swipeTip',
  string
> & { errors: Record<string, string> };

type Outcome = { ok: true; code: string; skipped?: number } | { ok: false; code: string };

function fill(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, String(v)), template);
}

type Person = { id: string; name: string; unitCode: string };

type Props = {
  days: BoardDay[];
  hours: string[];
  facility: { id: string; name: string; place: string; capacity: number; withNote: boolean; maxRepeat: number };
  usage: { used: number; max: number };
  people: { roommates: Person[]; others: Person[] };
  dayParam: string;
  returnTo: string;
  initialDay: number;
  labels: BoardLabels;
  // Plain form actions (work without JavaScript) ...
  bookAction: (formData: FormData) => Promise<void>;
  cancelAction: (formData: FormData) => Promise<void>;
  checkInAction: (formData: FormData) => Promise<void>;
  watchAction: (formData: FormData) => Promise<void>;
  unwatchAction: (formData: FormData) => Promise<void>;
  // ... and the in-place versions used when it is on.
  live: {
    book: (formData: FormData) => Promise<Outcome>;
    cancel: (bookingId: string) => Promise<Outcome>;
    checkIn: (bookingId: string) => Promise<Outcome>;
    watch: (facilityId: string, startsAt: string) => Promise<Outcome>;
  };
};

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Off by default; switching it on offers a few week counts up to the facility's limit.
function RepeatPicker({ max, labels }: { max: number; labels: BoardLabels }) {
  const [on, setOn] = useState(false);
  const choices = [...new Set([2, 4, 8, 12, max].filter((n) => n >= 2 && n <= max))].sort((a, b) => a - b);
  const [weeks, setWeeks] = useState(choices[0] ?? 2);
  return (
    <div className={styles.repeat}>
      <label className={styles.switchRow}>
        <span>{labels.repeatWeekly}</span>
        <input type="checkbox" role="switch" className={styles.switch} checked={on} onChange={(e) => setOn(e.target.checked)} />
      </label>
      <input type="hidden" name="repeatWeeks" value={on ? weeks : 1} />
      {on && (
        <>
          <span className={styles.note}>{labels.repeatFor}</span>
          <div className={styles.segments} role="radiogroup">
            {choices.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={weeks === n} className={styles.segment} onClick={() => setWeeks(n)}>
                {fill(labels.weeksN, { n })}
              </button>
            ))}
          </div>
          <span className={styles.note}>{labels.repeatNote}</span>
        </>
      )}
    </div>
  );
}

const CAL = 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z';
const CLOCK = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2';
const PIN = 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z';
const REFRESH = 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6';
const HOLD_MS = 550;

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not supported
  }
}

function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const css = getComputedStyle(document.documentElement);
  const brand = css.getPropertyValue('--brand').trim() || '#2f5d8a';
  const accent = css.getPropertyValue('--accent').trim() || '#e0a526';
  confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin: { y: 0.75 }, colors: [brand, accent, '#ffffff'], scalar: 0.9 });
}

function clockNow(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Live week board. Tap a time for details, long press to act at once
// (book a free time, check in to yours, get notified about a taken one).
// Everything happens in place, and the board refreshes itself every 30 s.
export default function BookingBoard(props: Props) {
  const { days, hours, facility, usage, people, labels, dayParam, returnTo } = props;
  const router = useRouter();
  const [dayIndex, setDayIndex] = useState(props.initialDay);
  const [direction, setDirection] = useState(0);
  const [picked, setPicked] = useState<{ day: BoardDay; slot: BoardSlot } | null>(null);
  const [override, setOverride] = useState<{ days: BoardDay[]; map: Record<string, BoardSlot['state']> }>({ days, map: {} });
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  // The opened sheet for which "Cancel booking" was pressed once (asks to confirm).
  const [confirmFor, setConfirmFor] = useState<object | null>(null);
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState<{ days: BoardDay[]; at: string }>({ days, at: '' });
  const [holding, setHolding] = useState<string | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const heldRef = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);

  // Fresh server data replaces any optimistic states (compared during render).
  const map = override.days === days ? override.map : {};
  if (override.days !== days) setOverride({ days, map: {} });
  if (updated.days !== days) setUpdated({ days, at: typeof window === 'undefined' ? '' : clockNow() });

  const refresh = useCallback(() => {
    setRefreshing(true);
    startTransition(() => router.refresh());
    window.setTimeout(() => setRefreshing(false), 700);
  }, [router]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !sheet.current?.open) router.refresh();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), toast.tone === 'ok' ? 2000 : 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const d = sheet.current;
    if (!d) return;
    if (picked && !d.open) d.showModal();
    if (!picked && d.open) d.close();
  }, [picked]);

  const stateOf = (s: BoardSlot): BoardSlot['state'] => map[s.start] ?? s.state;
  const setSlot = (start: string, state: BoardSlot['state'] | null) =>
    setOverride((o) => {
      const next = { ...o.map };
      if (state) next[start] = state;
      else delete next[start];
      return { days: o.days, map: next };
    });

  const run = (slot: BoardSlot, optimistic: BoardSlot['state'] | null, op: () => Promise<Outcome>, success: string) => {
    if (optimistic) setSlot(slot.start, optimistic);
    startTransition(async () => {
      const result = await op();
      if (result.ok) {
        if (result.code === 'booked') {
          buzz([12, 40, 18]);
          celebrate();
        } else buzz(15);
        setToast({ text: success, tone: 'ok' });
        setPicked(null);
        router.refresh();
      } else {
        buzz([40, 30, 40]);
        setSlot(slot.start, null);
        setToast({ text: labels.errors[result.code] ?? result.code, tone: 'err' });
        // Close the sheet so the message is not hidden behind it, and show the
        // board as it is now (the time may have been taken meanwhile).
        setPicked(null);
        router.refresh();
      }
    });
  };

  const quickBook = (slot: BoardSlot) => {
    const fd = new FormData();
    fd.set('facilityId', facility.id);
    fd.set('day', dayParam);
    fd.set('startsAt', slot.start);
    fd.set('hours', String(slot.lengths[0] ?? 1));
    fd.set('repeatWeeks', '1');
    run(slot, 'mine', () => props.live.book(fd), fill(labels.bookedToast, { time: slot.label }));
  };

  // Long press does the main thing for the slot right away.
  const longPress = (slot: BoardSlot) => {
    const state = stateOf(slot);
    if (state === 'free') quickBook(slot);
    else if (state === 'mine' && slot.checkIn?.phase === 'open' && slot.bookingId) run(slot, null, () => props.live.checkIn(slot.bookingId!), labels.checkedInToast);
    else if (state === 'taken' && !slot.inUse && !slot.watchId) run(slot, null, () => props.live.watch(facility.id, slot.start), labels.watchingToast);
  };

  const pressStart = (slot: BoardSlot) => {
    if (stateOf(slot) === 'closed') return;
    heldRef.current = false;
    setHolding(slot.start);
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true;
      setHolding(null);
      buzz(20);
      longPress(slot);
    }, HOLD_MS);
  };
  const pressEnd = () => {
    window.clearTimeout(holdTimer.current);
    setHolding(null);
  };

  const open = (day: BoardDay, slot: BoardSlot) => {
    if (heldRef.current) {
      heldRef.current = false;
      return;
    }
    if (stateOf(slot) !== 'closed') setPicked({ day, slot: { ...slot, state: stateOf(slot) } });
  };

  const goDay = (i: number) => {
    if (i < 0 || i >= days.length || i === dayIndex) return;
    setDirection(i > dayIndex ? 1 : -1);
    setDayIndex(i);
    buzz(6);
  };

  const stateLabel = (s: BoardSlot) => {
    const st = stateOf(s);
    return st === 'free' ? labels.free : st === 'mine' ? labels.yours : st === 'taken' ? labels.booked : '';
  };

  const cell = (day: BoardDay, slot: BoardSlot, col: number, key: string, index: number) => {
    const st = stateOf(slot);
    return (
      <motion.div
        className={styles.cellWrap}
        key={key}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: Math.min(index * 0.012, 0.25) }}
      >
        <motion.button
          type="button"
          className={`${styles.cell} ${styles[st]} ${slot.inUse ? styles.inuse : ''} ${picked?.slot.start === slot.start ? styles.picked : ''} ${holding === slot.start ? styles.holding : ''}`}
          onClick={() => open(day, slot)}
          onPointerDown={() => pressStart(slot)}
          onPointerUp={pressEnd}
          onPointerLeave={pressEnd}
          onPointerCancel={pressEnd}
          onContextMenu={(e) => e.preventDefault()}
          whileTap={st === 'closed' ? undefined : { scale: 0.96 }}
          disabled={st === 'closed'}
          data-start={slot.start}
          aria-label={`${day.longLabel} ${slot.label}-${slot.endLabel}: ${stateLabel(slot) || labels.closed}`}
        >
          <span>{slot.label}</span>
          {slot.inUse ? (
            <span className={styles.live}>
              <i aria-hidden="true" />
              {labels.inUse}
            </span>
          ) : st === 'mine' ? (
            <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
              {labels.yours}
            </motion.span>
          ) : st === 'free' ? (
            <span className={styles.plus} aria-hidden="true">
              +
            </span>
          ) : null}
          {holding === slot.start && <span className={styles.ring} aria-hidden="true" />}
        </motion.button>
        {st !== 'closed' && (
          <div className={`${styles.peek} ${col >= 5 ? styles.peekLeft : ''}`} aria-hidden="true">
            <strong>
              {day.longLabel}, {slot.label}-{slot.endLabel}
            </strong>
            {facility.name} · {facility.place}
            <br />
            <span className={styles.peekTag}>{slot.inUse ? labels.inUse : st === 'free' ? labels.hoverBook : st === 'mine' ? labels.hoverMine : labels.hoverTaken}</span>
          </div>
        )}
      </motion.div>
    );
  };

  const day = days[dayIndex] ?? days[0]!;
  const slot = picked?.slot;
  const lengths = slot?.lengths ?? [1];
  const willUse = slot ? usage.used + (lengths[0] ?? 1) : usage.used;

  // In-place submit for the sheet forms; the form action stays as a no-JS fallback.
  const onSubmit = (kind: 'book' | 'cancel' | 'checkin' | 'watch') => (e: React.FormEvent<HTMLFormElement>) => {
    if (!slot) return;
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (kind === 'book') run(slot, 'mine', () => props.live.book(fd), fill(labels.bookedToast, { time: slot.label }));
    if (kind === 'cancel' && slot.bookingId) run(slot, 'free', () => props.live.cancel(slot.bookingId!), labels.cancelledToast);
    if (kind === 'checkin' && slot.bookingId) run(slot, null, () => props.live.checkIn(slot.bookingId!), labels.checkedInToast);
    if (kind === 'watch') run(slot, null, () => props.live.watch(facility.id, slot.start), labels.watchingToast);
  };

  return (
    <>
      <div className={styles.liveBar}>
        <span className={styles.liveDot} aria-hidden="true" />
        <span>
          {labels.live}
          {updated.at && <span className={styles.liveTime}> · {fill(labels.updated, { time: updated.at })}</span>}
        </span>
        <span className={styles.liveTip}>{labels.holdTip}</span>
        <button type="button" className={styles.refreshBtn} onClick={refresh} aria-label={labels.refresh} disabled={refreshing}>
          <motion.span animate={{ rotate: refreshing ? 360 : 0 }} transition={{ duration: 0.7, ease: 'easeInOut' }} style={{ display: 'inline-flex' }}>
            <Icon d={REFRESH} size={16} />
          </motion.span>
          <span>{labels.refresh}</span>
        </button>
      </div>

      <div className={styles.grid} role="grid" aria-busy={pending}>
        <div className={styles.corner} />
        {days.map((d) => (
          <div key={d.key} className={`${styles.dayHead} ${d.isToday ? styles.dayToday : ''}`}>
            <span>{d.weekday}</span>
            <strong>{d.date}</strong>
          </div>
        ))}
        {hours.map((h, row) => (
          <div key={h} style={{ display: 'contents' }}>
            <div className={styles.hour}>{h}</div>
            {days.map((d, col) => {
              const s = d.slots.find((x) => x.label === h);
              return s ? cell(d, s, col, d.key, row * 7 + col) : <div key={d.key} />;
            })}
          </div>
        ))}
      </div>

      <div
        className={styles.dayList}
        onTouchStart={(e) => {
          const t = e.touches[0]!;
          swipe.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start) return;
          const t = e.changedTouches[0]!;
          const dx = t.clientX - start.x;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(t.clientY - start.y) * 1.5) goDay(dayIndex + (dx < 0 ? 1 : -1));
        }}
      >
        <div className={styles.dayChips} role="group">
          {days.map((d, i) => (
            <button key={d.key} type="button" className={styles.dayChip} aria-pressed={i === dayIndex} onClick={() => goDay(i)}>
              {i === dayIndex && <motion.span layoutId="dayChipBg" className={styles.dayChipBg} transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <span className={styles.dayChipText}>{d.weekday}</span>
              <strong className={styles.dayChipText}>{d.date}</strong>
              {d.slots.some((s) => stateOf(s) === 'free') ? <i /> : <i style={{ visibility: 'hidden' }} />}
            </button>
          ))}
        </div>
        <span className={styles.swipeTip}>{labels.swipeTip}</span>
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={day.key}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.2 }}
            className={styles.dayPane}
          >
            <strong>{day.longLabel}</strong>
            <div className={styles.pills}>{day.slots.map((s, i) => cell(day, s, i % 2 ? 6 : 0, s.start, i))}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <dialog
        ref={sheet}
        className={styles.sheet}
        onClose={() => setPicked(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPicked(null);
        }}
      >
        {picked && slot && (
          <motion.div className={styles.sheetBody} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
            <div className={styles.grabber} aria-hidden="true" />
            <div className={styles.sheetHead}>
              <h2>{slot.state === 'free' ? labels.confirmTitle : slot.state === 'mine' ? labels.mineTitle : labels.takenTitle}</h2>
              <button type="button" className={styles.secondary} style={{ height: 36, padding: '0 12px' }} onClick={() => setPicked(null)} aria-label={labels.close}>
                ×
              </button>
            </div>
            <div className={styles.ticket}>
              <Icon d={PIN} />
              <span>
                {facility.name} · {facility.place}
              </span>
              <Icon d={CAL} />
              <span>{picked.day.longLabel}</span>
              <Icon d={CLOCK} />
              <span>
                {slot.label}-{slot.endLabel}
              </span>
            </div>

            {slot.state === 'taken' && <p className={styles.note}>{slot.inUse ? labels.inUse : slot.watchId ? labels.watching : labels.takenBody}</p>}

            {slot.state === 'mine' && (
              <>
                {slot.checkIn && slot.checkIn.phase !== 'off' && (
                  <p className={`${styles.checkNote} ${slot.checkIn.phase === 'open' ? styles.checkNoteOpen : ''}`}>
                    {slot.checkIn.phase === 'checkedIn'
                      ? labels.checkedIn
                      : slot.checkIn.phase === 'open'
                        ? fill(labels.openUntil, { time: slot.checkIn.untilLabel })
                        : fill(labels.opensAt, { time: slot.checkIn.opensLabel })}
                  </p>
                )}
                <p className={styles.note}>
                  {slot.undoLabel
                    ? fill(labels.undoUntil, { time: slot.undoLabel })
                    : slot.cancellable
                      ? fill(labels.cancelUntil, { time: slot.deadlineLabel ?? '' })
                      : fill(labels.cancelClosed, { time: slot.deadlineLabel ?? '' })}
                </p>
                <div className={styles.sheetActions}>
                  <a className={styles.secondary} href={`/book/ics/${slot.bookingId}`}>
                    {labels.addCal}
                  </a>
                </div>
              </>
            )}
          </motion.div>
        )}
        {/* The forms are always in the page (hidden until used), so they also work
            as plain HTML forms; with JavaScript they run in place instead. */}
        <form action={props.checkInAction} onSubmit={onSubmit('checkin')} className={styles.sheetBody} style={{ paddingTop: 0 }} hidden={slot?.checkIn?.phase !== 'open'}>
          <input type="hidden" name="bookingId" value={slot?.bookingId ?? ''} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className={styles.primary} disabled={pending}>
            {labels.checkIn}
          </button>
        </form>
        <form action={props.watchAction} onSubmit={onSubmit('watch')} className={styles.sheetBody} style={{ paddingTop: 0 }} hidden={!(slot?.state === 'taken' && !slot.inUse && !slot.watchId)}>
          <input type="hidden" name="facilityId" value={facility.id} />
          <input type="hidden" name="startsAt" value={slot?.start ?? ''} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className={styles.primary} disabled={pending}>
            {labels.notify}
          </button>
        </form>
        <form action={props.unwatchAction} className={styles.sheetBody} style={{ paddingTop: 0 }} hidden={!(slot?.state === 'taken' && slot.watchId)}>
          <input type="hidden" name="watchId" value={slot?.watchId ?? ''} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className={styles.secondary}>{labels.unwatch}</button>
        </form>
        <form action={props.cancelAction} onSubmit={onSubmit('cancel')} className={styles.sheetBody} style={{ paddingTop: 0 }} hidden={!(slot?.state === 'mine' && slot.cancellable)}>
          <input type="hidden" name="bookingId" value={slot?.bookingId ?? ''} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {picked && confirmFor === picked ? (
            <motion.div className={styles.confirmBox} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} role="alertdialog" aria-label={labels.cancelConfirm}>
              <p>{labels.cancelConfirm}</p>
              <div className={styles.confirmRow}>
                <button type="button" className={styles.secondary} onClick={() => setConfirmFor(null)}>
                  {labels.cancelKeep}
                </button>
                <button className={styles.dangerSolid} disabled={pending} autoFocus>
                  {labels.cancelYes}
                </button>
              </div>
            </motion.div>
          ) : (
            <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => setConfirmFor(picked)}>
              {labels.cancelBooking}
            </button>
          )}
        </form>
        <form key={slot?.start ?? 'none'} action={props.bookAction} onSubmit={onSubmit('book')} className={styles.sheetBody} style={{ paddingTop: 0 }} hidden={slot?.state !== 'free'}>
          <input type="hidden" name="facilityId" value={facility.id} />
          <input type="hidden" name="day" value={dayParam} />
          <input type="hidden" name="startsAt" value={slot?.start ?? ''} />
          {lengths.length > 1 ? (
            <label className={styles.field}>
              {labels.length}
              <select name="hours" className={styles.select} defaultValue={lengths[0]}>
                {lengths.map((n) => (
                  <option key={n} value={n}>
                    {fill(labels.hoursN, { n })}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="hours" value={lengths[0] ?? 1} />
          )}
          {facility.maxRepeat > 1 && <RepeatPicker max={facility.maxRepeat} labels={labels} />}
          {facility.withNote && (
            <label className={styles.field}>
              {labels.note}
              <input name="note" maxLength={200} placeholder={labels.notePlaceholder} className={styles.input} />
            </label>
          )}
          {facility.capacity > 1 && people.roommates.length + people.others.length > 0 && (
            <details>
              <summary className={styles.field}>{labels.group}</summary>
              <p className={styles.note}>{labels.groupLede}</p>
              {people.roommates.length > 0 && (
                <label className={styles.check}>
                  <input type="checkbox" name="inviteApartment" value="1" />
                  {labels.inviteApartment}
                </label>
              )}
              <div className={styles.people}>
                {[...people.roommates, ...people.others].map((p) => (
                  <label key={p.id} className={styles.check}>
                    <input type="checkbox" name="participants" value={p.id} />
                    {p.name}
                    <span className={styles.note}>
                      {labels.apt} {p.unitCode}
                    </span>
                  </label>
                ))}
              </div>
            </details>
          )}
          <p className={styles.note}>{willUse > usage.max ? labels.limitReached : fill(labels.after, { n: willUse, max: usage.max })}</p>
          <div className={styles.sheetActions}>
            <button type="button" className={styles.secondary} onClick={() => setPicked(null)}>
              {labels.close}
            </button>
            <motion.button whileTap={{ scale: 0.97 }} className={styles.primary} disabled={willUse > usage.max || pending}>
              {pending ? '...' : labels.reserve}
            </motion.button>
          </div>
        </form>
      </dialog>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.text}
            className={`${styles.toast} ${toast.tone === 'err' ? styles.toastErr : ''}`}
            role="status"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            onClick={() => setToast(null)}
          >
            {toast.tone === 'ok' ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <span aria-hidden="true">!</span>
            )}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
