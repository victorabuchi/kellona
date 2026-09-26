'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './board.module.css';

export type BoardSlot = {
  start: string;
  label: string;
  endLabel: string;
  state: 'free' | 'taken' | 'mine' | 'closed';
  bookingId?: string;
  cancellable?: boolean;
  deadlineLabel?: string;
  lengths: number[];
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
  | 'repeatWeekly'
  | 'repeatFor'
  | 'repeatNote',
  string
>;

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
  bookAction: (formData: FormData) => Promise<void>;
  cancelAction: (formData: FormData) => Promise<void>;
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

// Week grid on wide screens, a day picker on phones. Hovering a slot previews
// it; choosing one opens a sheet to confirm, or to cancel your own booking.
export default function BookingBoard(props: Props) {
  const { days, hours, facility, usage, people, labels, dayParam, returnTo } = props;
  const [dayIndex, setDayIndex] = useState(props.initialDay);
  const [picked, setPicked] = useState<{ day: BoardDay; slot: BoardSlot } | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = sheet.current;
    if (!d) return;
    if (picked && !d.open) d.showModal();
    if (!picked && d.open) d.close();
  }, [picked]);

  const open = (day: BoardDay, slot: BoardSlot) => {
    if (slot.state !== 'closed') setPicked({ day, slot });
  };

  const stateLabel = (s: BoardSlot) => (s.state === 'free' ? labels.free : s.state === 'mine' ? labels.yours : s.state === 'taken' ? labels.booked : '');

  const cell = (day: BoardDay, slot: BoardSlot, col: number, key: string) => (
    <div className={styles.cellWrap} key={key}>
      <button
        type="button"
        className={`${styles.cell} ${styles[slot.state]} ${picked?.slot.start === slot.start ? styles.picked : ''}`}
        onClick={() => open(day, slot)}
        disabled={slot.state === 'closed'}
        aria-label={`${day.longLabel} ${slot.label}-${slot.endLabel}: ${stateLabel(slot) || labels.closed}`}
      >
        <span>{slot.label}</span>
        {slot.state === 'free' && (
          <span className={styles.plus} aria-hidden="true">
            +
          </span>
        )}
        {slot.state === 'mine' && <span>{labels.yours}</span>}
      </button>
      {slot.state !== 'closed' && (
        <div className={`${styles.peek} ${col >= 5 ? styles.peekLeft : ''}`} aria-hidden="true">
          <strong>
            {day.longLabel}, {slot.label}-{slot.endLabel}
          </strong>
          {facility.name} · {facility.place}
          <br />
          <span className={styles.peekTag}>{slot.state === 'free' ? labels.hoverBook : slot.state === 'mine' ? labels.hoverMine : labels.hoverTaken}</span>
        </div>
      )}
    </div>
  );

  const day = days[dayIndex] ?? days[0]!;
  const slot = picked?.slot;
  const lengths = slot?.lengths ?? [1];
  const willUse = slot ? usage.used + (lengths[0] ?? 1) : usage.used;

  return (
    <>
      <div className={styles.grid} role="grid">
        <div className={styles.corner} />
        {days.map((d) => (
          <div key={d.key} className={`${styles.dayHead} ${d.isToday ? styles.dayToday : ''}`}>
            <span>{d.weekday}</span>
            <strong>{d.date}</strong>
          </div>
        ))}
        {hours.map((h) => (
          <div key={h} style={{ display: 'contents' }}>
            <div className={styles.hour}>{h}</div>
            {days.map((d, col) => {
              const s = d.slots.find((x) => x.label === h);
              return s ? cell(d, s, col, d.key) : <div key={d.key} />;
            })}
          </div>
        ))}
      </div>

      <div className={styles.dayList}>
        <div className={styles.dayChips} role="group">
          {days.map((d, i) => (
            <button key={d.key} type="button" className={styles.dayChip} aria-pressed={i === dayIndex} onClick={() => setDayIndex(i)}>
              {d.weekday}
              <strong>{d.date}</strong>
              {d.slots.some((s) => s.state === 'free') ? <i /> : <i style={{ visibility: 'hidden' }} />}
            </button>
          ))}
        </div>
        <strong>{day.longLabel}</strong>
        <div className={styles.pills}>
          {day.slots.map((s, i) => cell(day, s, i % 2 ? 6 : 0, s.start))}
        </div>
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
          <div className={styles.sheetBody}>
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

            {slot.state === 'taken' && (
              <>
                <p className={styles.note}>{labels.takenBody}</p>
                <div className={styles.sheetActions}>
                  <button type="button" className={styles.secondary} onClick={() => setPicked(null)}>
                    {labels.close}
                  </button>
                </div>
              </>
            )}

            {slot.state === 'mine' && (
              <>
                <p className={styles.note}>{slot.cancellable ? fill(labels.cancelUntil, { time: slot.deadlineLabel ?? '' }) : fill(labels.cancelClosed, { time: slot.deadlineLabel ?? '' })}</p>
                <div className={styles.sheetActions}>
                  <a className={styles.secondary} href={`/book/ics/${slot.bookingId}`}>
                    {labels.addCal}
                  </a>
                </div>
              </>
            )}

          </div>
        )}
        {/* Both forms are always in the page (hidden until used), so they also work
            as plain HTML forms and their actions are server rendered. */}
        <form action={props.cancelAction} className={styles.sheetBody} style={{ paddingTop: 0 }} hidden={!(slot?.state === 'mine' && slot.cancellable)}>
          <input type="hidden" name="bookingId" value={slot?.bookingId ?? ''} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className={styles.dangerBtn}>{labels.cancelBooking}</button>
        </form>
        <form key={slot?.start ?? 'none'} action={props.bookAction} className={styles.sheetBody} style={{ paddingTop: 0 }} hidden={slot?.state !== 'free'}>
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
                  <button className={styles.primary} disabled={willUse > usage.max}>
                    {labels.reserve}
                  </button>
                </div>
              </form>
      </dialog>
    </>
  );
}
