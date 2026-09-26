import { AnimatePresence, motion } from 'motion/react';
import styles from './film.module.css';
import type { FilmLabels } from '../film-keys';

// The scenes of the landing page film. Each one is a pure function of the
// scene clock t (milliseconds), so pausing, seeking and reduced motion are free.

export type SceneProps = { t: number; L: FilmLabels; phone: boolean; brand: string };
// [at ms, data-target the cursor rests on (null hides it), press length ms]
export type Beat = [number, string | null, number?];

const ORG = 'Riverside Homes';
const BUILDING = 'Rantakatu 12';
export const DEFAULT_BRAND = '#2f5d8a';
const SWATCHES = ['#0f766e', '#be185d', '#4f46e5'];

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const within = (t: number, a: number, b: number) => t >= a && t < b;

const P = {
  cal: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z',
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  door: 'M3 21h18M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M15 12h.01',
  undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-6.7L3 9',
  gauge: 'M12 14l4-4M3.3 17a10 10 0 1 1 17.4 0',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  check: 'M20 6 9 17l-5-5',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  washer: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM4 8h16M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM7 5.5h.01M10 5.5h.01',
  sauna: 'M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4M16 3c-1 1.5 1 2.5 0 4M3 11h18v9H3zM3 15h18',
};

function I({ d, size = 16, stroke = 2 }: { d: string; size?: number; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// A house mark by default; after the logo upload in the brand scene, a
// made-up logo for "your housing company".
function Mark({ custom }: { custom?: boolean }) {
  return custom ? (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M4 6l8 7 8-7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13v7" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ) : (
    <I d={P.home} size={16} stroke={2.4} />
  );
}

const RESIDENT_NAV: Array<[keyof typeof P, keyof FilmLabels]> = [
  ['cal', 'film.nav.booking'],
  ['list', 'film.nav.mine'],
  ['alert', 'film.nav.report'],
  ['phone', 'film.nav.contact'],
  ['user', 'film.nav.account'],
];
const STAFF_NAV: Array<[keyof typeof P, keyof FilmLabels]> = [
  ['home', 'film.nav.overview'],
  ['cal', 'film.nav.booking'],
  ['building', 'film.nav.buildings'],
  ['alert', 'film.nav.reports'],
  ['gear', 'film.nav.settings'],
];

// The Kellona app shell: top bar, icon rail (desktop) or tab bar (phone).
function AppFrame({
  L,
  phone,
  staff,
  active,
  brand,
  logo,
  bell,
  children,
}: {
  L: FilmLabels;
  phone: boolean;
  staff?: boolean;
  active: number;
  brand: string;
  logo?: boolean;
  bell?: 'idle' | 'ring';
  children: React.ReactNode;
}) {
  const nav = staff ? STAFF_NAV : RESIDENT_NAV;
  return (
    <div className={styles.app} style={{ ['--b' as string]: brand }}>
      <header className={styles.top}>
        <span className={styles.mark}>
          <Mark custom={logo} />
        </span>
        <span className={styles.slash}>/</span>
        <span className={styles.orgName}>{logo ? L['film.yourName'] : ORG}</span>
        <span className={styles.topRight}>
          {bell && (
            <span className={`${styles.iconBtn} ${bell === 'ring' ? styles.bellRing : ''}`}>
              <I d={P.bell} />
              {bell === 'ring' && <i className={styles.bellDot} />}
            </span>
          )}
          <span className={styles.lang}>
            {L['film.lang']}
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
          {phone ? (
            <span className={styles.iconBtn}>
              <I d={P.search} />
            </span>
          ) : (
            <span className={styles.search}>
              <I d={P.search} size={14} />
              {L['film.search']}
              <kbd>⌘K</kbd>
            </span>
          )}
          {staff ? (
            <span className={styles.avatar}>MK</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.avatar} src="/landing/people/you.jpg" alt="" width={30} height={30} />
          )}
        </span>
      </header>
      <div className={styles.body}>
        {!phone && (
          <nav className={styles.rail}>
            {nav.map(([icon], i) => (
              <span key={icon} className={styles.railItem} data-active={i === active}>
                <I d={P[icon]} size={18} />
              </span>
            ))}
          </nav>
        )}
        <main className={styles.main}>{children}</main>
      </div>
      {phone && (
        <nav className={styles.tabs}>
          {nav.map(([icon, label], i) => (
            <span key={icon} className={styles.tabItem} data-active={i === active}>
              <I d={P[icon]} size={18} />
              <small>{L[label].split(' ')[0]}</small>
            </span>
          ))}
        </nav>
      )}
    </div>
  );
}

function Toast({ show, text, tone = 'ok' }: { show: boolean; text: string; tone?: 'ok' | 'info' }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={text}
          className={styles.toast}
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          <span className={tone === 'ok' ? styles.toastOk : styles.toastInfo}>
            <I d={tone === 'ok' ? P.check : P.bell} size={12} stroke={3} />
          </span>
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Sheet({ phone, open, title, children }: { phone: boolean; open: boolean; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <motion.div
            className={phone ? styles.sheetPhone : styles.sheet}
            initial={phone ? { y: '100%' } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={phone ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={phone ? { y: '100%' } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            {phone && <span className={styles.grabber} />}
            <div className={styles.sheetHead}>
              <strong>{title}</strong>
              <span className={styles.x}>×</span>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Details({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className={styles.details}>
      {rows.map(([icon, text]) => (
        <span key={text}>
          <I d={P[icon as keyof typeof P]} size={15} />
          {text}
        </span>
      ))}
    </div>
  );
}

function Rules({ L, phone }: { L: FilmLabels; phone: boolean }) {
  const rules: Array<[keyof typeof P, keyof FilmLabels]> = [
    ['door', 'film.rule.open'],
    ['clock', 'film.rule.slots'],
    ['undo', 'film.rule.cancel'],
    ['gauge', 'film.rule.week'],
  ];
  return (
    <div className={styles.rules}>
      {rules.slice(0, phone ? 2 : 4).map(([icon, key]) => (
        <span key={key} className={styles.rule}>
          <I d={P[icon]} size={13} />
          {L[key]}
        </span>
      ))}
    </div>
  );
}

function Usage({ L, used }: { L: FilmLabels; used: number }) {
  return (
    <div className={styles.card}>
      <div className={styles.usageTop}>
        <span>{L['film.thisWeek']}</span>
        <strong>{fill(L['film.ofHours'], { n: used })}</strong>
      </div>
      <div className={styles.meter}>
        <span style={{ width: `${(used / 6) * 100}%` }} />
      </div>
    </div>
  );
}

function LiveBar({ L, time, pulse }: { L: FilmLabels; time: string; pulse?: boolean }) {
  return (
    <div className={styles.liveBar}>
      <span className={styles.liveDot} />
      <span>
        <b>{L['film.live']}</b> · <span className={pulse ? styles.flashText : undefined}>{fill(L['film.updated'], { time })}</span>
      </span>
      <span className={styles.refresh}>
        <I d={P.refresh} size={13} />
        {L['film.refresh']}
      </span>
    </div>
  );
}

type Cell = 'free' | 'taken' | 'mine' | 'inuse' | 'closed';
const HOURS = [16, 17, 18, 19, 20, 21];
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

// The week board. Desktop shows the whole week; the phone shows Thursday.
function Board({
  L,
  phone,
  state,
  targets = {},
  peek,
  hold,
  flash = [],
}: {
  L: FilmLabels;
  phone: boolean;
  state: (day: number, hour: number) => Cell;
  targets?: Record<string, string>;
  peek?: [number, number] | null;
  hold?: [number, number] | null;
  flash?: Array<[number, number]>;
}) {
  const days = L['film.days'].split(',');
  const label = (c: Cell) => (c === 'mine' ? L['film.yours'] : c === 'inuse' ? L['film.inUse'] : c === 'taken' ? L['film.taken'] : '');
  const cell = (d: number, h: number) => {
    const c = state(d, h);
    const key = `${d}-${h}`;
    const flashing = flash.some(([fd, fh]) => fd === d && fh === h);
    return (
      <div key={key} className={styles.cellWrap}>
        <motion.div
          className={`${styles.cell} ${styles[c]} ${flashing ? styles.flash : ''}`}
          data-target={targets[key]}
          layout={false}
          animate={c === 'mine' || c === 'inuse' ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          <span>{hh(h)}</span>
          {label(c) && <em>{label(c)}</em>}
          {c === 'inuse' && <i className={styles.pulse} />}
          {hold && hold[0] === d && hold[1] === h && <i className={styles.holdRing} />}
        </motion.div>
        <AnimatePresence>
          {!phone && peek && peek[0] === d && peek[1] === h && (
            <motion.div className={styles.peek} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <strong>
                {L['film.dateThu']}, {hh(h)}-{hh(h + 1)}
              </strong>
              <span>
                {L['film.machine2']} · {BUILDING}
              </span>
              <em>{L['film.tapToBook']}</em>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };
  if (phone) {
    return (
      <div className={styles.boardPhone}>
        <div className={styles.chips}>
          {days.map((d, i) => (
            <span key={d} className={styles.dayChip} data-active={i === 3}>
              <small>{d}</small>
              <b>{21 + i}</b>
            </span>
          ))}
        </div>
        <div className={styles.dayList}>{HOURS.map((h) => cell(3, h))}</div>
      </div>
    );
  }
  return (
    <div className={styles.board}>
      <span />
      {days.map((d, i) => (
        <span key={d} className={styles.dayHead} data-today={i === 3}>
          <small>{d}</small>
          <b>{21 + i}.9.</b>
        </span>
      ))}
      {HOURS.map((h) => (
        <div key={h} className={styles.row}>
          <span className={styles.hourLabel}>{hh(h)}</span>
          {days.map((_, d) => cell(d, h))}
        </div>
      ))}
    </div>
  );
}

function PageHead({ L, title, icon }: { L: FilmLabels; title: string; icon: keyof typeof P }) {
  return (
    <div className={styles.pageHead}>
      <span className={styles.pageIcon}>
        <I d={P[icon]} size={20} />
      </span>
      <div>
        <h3>{title}</h3>
        <small>{BUILDING}</small>
      </div>
      <span className={styles.machines}>
        <b>{L['film.machine1']}</b>
        <b data-active="true">{L['film.machine2']}</b>
      </span>
    </div>
  );
}

// 1. Book: tap a free time, confirm, confetti; the board updates live; hold to book.
function BookScene({ t, L, phone, brand }: SceneProps) {
  const booked18 = t >= 4200;
  const booked21 = t >= 9500;
  const state = (d: number, h: number): Cell => {
    if (d < 3) return 'closed';
    if (d === 3) {
      if (h === 18 && booked18) return 'mine';
      if (h === 21 && booked21) return 'mine';
      if (h === 19 && t >= 6800) return 'taken';
      if (h === 16 || h === 20) return 'taken';
      return 'free';
    }
    return (d * 7 + h) % 4 === 0 ? 'taken' : 'free';
  };
  const used = 1 + (booked18 ? 1 : 0) + (booked21 ? 1 : 0);
  return (
    <AppFrame L={L} phone={phone} active={0} brand={brand}>
      <PageHead L={L} title={L['film.laundry']} icon="washer" />
      <Rules L={L} phone={phone} />
      <div className={phone ? styles.stack : styles.split}>
        <div className={styles.stack}>
          <LiveBar L={L} time={t >= 6800 ? '15:42' : '15:40'} pulse={within(t, 6800, 8000)} />
          <Board
            L={L}
            phone={phone}
            state={state}
            targets={{ '3-18': 'cell-a', '3-21': 'cell-b' }}
            peek={within(t, 1100, 2300) ? [3, 18] : null}
            hold={within(t, 8200, 9500) ? [3, 21] : null}
            flash={t >= 6800 && t < 8000 ? [[3, 19]] : []}
          />
        </div>
        {!phone && (
          <div className={styles.stack}>
            <Usage L={L} used={used} />
            <div className={styles.tipCard}>{L['film.hold']}</div>
          </div>
        )}
      </div>
      <Sheet phone={phone} open={within(t, 2500, 4200)} title={L['film.confirmTitle']}>
        <Details
          rows={[
            ['pin', `${L['film.machine2']} · ${BUILDING}`],
            ['cal', L['film.dateThu']],
            ['clock', '18:00-19:00'],
          ]}
        />
        <p className={styles.note}>{fill(L['film.usage'], { n: 2 })}</p>
        <div className={styles.sheetActions}>
          <span className={styles.btnGhost}>{L['film.close']}</span>
          <span className={`${styles.btn} ${within(t, 3900, 4200) ? styles.pressed : ''}`} data-target="reserve">
            {L['film.reserve']}
          </span>
        </div>
      </Sheet>
      <Toast show={within(t, 4300, 6600)} text={fill(L['film.bookedToast'], { time: '18:00' })} />
      <Toast show={within(t, 9600, 11800)} text={fill(L['film.bookedToast'], { time: '21:00' })} />
    </AppFrame>
  );
}

// 2. Check in: a reminder opens check-in, the machine shows in use, and a
// missed turn is released to the people waiting.
function CheckInScene({ t, L, phone, brand }: SceneProps) {
  const checkedIn = t >= 3700;
  const released = t >= 8800;
  const state = (d: number, h: number): Cell => {
    if (d < 3) return 'closed';
    if (d === 3) {
      if (h === 18) return checkedIn ? 'inuse' : 'mine';
      if (h === 19) return released ? 'free' : 'taken';
      if (h === 16 || h === 17 || h === 20) return 'taken';
      return 'free';
    }
    return (d * 7 + h) % 4 === 0 ? 'taken' : 'free';
  };
  return (
    <AppFrame L={L} phone={phone} active={0} brand={brand}>
      <PageHead L={L} title={L['film.laundry']} icon="washer" />
      <div className={phone ? styles.stack : styles.split}>
        <div className={styles.stack}>
          <LiveBar L={L} time={t >= 5600 ? '19:13' : '17:41'} pulse={within(t, 8800, 9800)} />
          <Board L={L} phone={phone} state={state} targets={{ '3-18': 'cell-mine' }} flash={released && t < 9800 ? [[3, 19]] : []} />
        </div>
        <div className={styles.stack}>
          <AnimatePresence>
            {t >= 5600 && (
              <motion.div className={styles.watchCard} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}>
                <div className={styles.ringWrap}>
                  <svg viewBox="0 0 44 44" width="56" height="56" aria-hidden="true">
                    <circle cx="22" cy="22" r="18" className={styles.ringBg} />
                    <circle cx="22" cy="22" r="18" className={released ? styles.ringDone : styles.ringRun} />
                  </svg>
                  <b>{released ? '0:00' : `${Math.max(0, Math.ceil(15 * (1 - clamp01((t - 6000) / 2800))))}:00`}</b>
                </div>
                <div>
                  <strong>{L['film.watchTitle']}</strong>
                  <p>{released ? L['film.released'] : L['film.watchBody']}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!phone && <Usage L={L} used={2} />}
        </div>
      </div>
      <AnimatePresence>
        {within(t, 600, 2100) && (
          <motion.div
            className={styles.notif}
            data-target="notif"
            initial={{ y: -90, opacity: 0 }}
            animate={{ y: 0, opacity: 1, scale: within(t, 1900, 2100) ? 0.97 : 1 }}
            exit={{ y: -90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <span className={styles.notifIcon}>
              <Mark />
            </span>
            <div>
              <small>
                {ORG} · {L['film.now']}
              </small>
              <strong>{L['film.notifTitle']}</strong>
              <span>{L['film.notifBody']}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Sheet phone={phone} open={within(t, 2200, 3700)} title={L['film.yourBooking']}>
        <Details
          rows={[
            ['pin', `${L['film.machine2']} · ${BUILDING}`],
            ['cal', L['film.dateThu']],
            ['clock', '18:00-19:00'],
          ]}
        />
        <p className={styles.checkNote}>{L['film.checkinOpen']}</p>
        <span className={`${styles.btn} ${styles.btnWide} ${within(t, 3400, 3700) ? styles.pressed : ''}`} data-target="checkin">
          {L['film.checkin']}
        </span>
      </Sheet>
      <Toast show={within(t, 3800, 5800)} text={L['film.checkedIn']} />
      <Toast show={within(t, 8900, 11000)} text={L['film.released']} tone="info" />
    </AppFrame>
  );
}

const PEOPLE = [
  ['Aino', 'A 12'],
  ['Mikko', 'A 12'],
  ['Sara', 'B 4'],
  ['Leo', 'C 7'],
];
const ACCEPT_AT = [6800, 7900, 9000];
// Stock portraits of made-up residents (public/landing/people).
const photo = (name: string) => `/landing/people/${name.toLowerCase()}.jpg`;

function Face({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className ?? styles.face} src={photo(name)} alt="" width={24} height={24} />;
}

// 3. Invite: book the sauna and bring roommates; they accept one by one.
function InviteScene({ t, L, phone, brand }: SceneProps) {
  const picked = [t >= 2700, t >= 3500, t >= 4300];
  const count = 1 + picked.filter(Boolean).length;
  const booked = t >= 5500;
  const days = L['film.days'].split(',').slice(2, phone ? 3 : 5);
  const turns = [17, 18, 19, 20];
  return (
    <AppFrame L={L} phone={phone} active={0} brand={brand}>
      <PageHead L={L} title={L['film.sauna']} icon="sauna" />
      <div className={phone ? styles.stack : styles.split}>
        <div className={styles.saunaGrid} style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map((d, di) => (
            <div key={d} className={styles.saunaCol}>
              <span className={styles.dayHead}>
                <small>{d}</small>
                <b>{23 + di}.9.</b>
              </span>
              {turns.map((h) => {
                const mine = di === 0 && h === 20 && booked;
                const taken = !mine && (di * 5 + h) % 3 === 0;
                return (
                  <motion.div
                    key={h}
                    className={`${styles.turn} ${mine ? styles.mine : taken ? styles.taken : styles.free}`}
                    data-target={di === 0 && h === 20 ? 'sauna' : undefined}
                    animate={mine ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                  >
                    <span>
                      {hh(h)}-{hh(h + 1)}
                    </span>
                    {mine ? (
                      <span className={styles.faces}>
                        {['You', ...PEOPLE.slice(0, 3).map((p) => p[0]!)].map((n, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={n} src={photo(n)} alt="" style={{ opacity: i === 0 || t >= ACCEPT_AT[i - 1]! ? 1 : 0.35 }} />
                        ))}
                      </span>
                    ) : (
                      <em>{taken ? L['film.taken'] : L['film.free']}</em>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
        <AnimatePresence>
          {booked && (
            <motion.div className={styles.card} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <strong className={styles.cardTitle}>{L['film.invitations']}</strong>
              {PEOPLE.slice(0, 3).map(([name, apt], i) => {
                const ok = t >= ACCEPT_AT[i]!;
                return (
                  <motion.div key={name} className={styles.personRow} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 * i }}>
                    <Face name={name!} />
                    <span>
                      <b>{name}</b>
                      <small>{apt}</small>
                    </span>
                    <em className={ok ? styles.okBadge : styles.waitBadge}>{ok ? L['film.accepted'] : L['film.pending']}</em>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Sheet phone={phone} open={within(t, 1500, 5500)} title={L['film.confirmTitle']}>
        <Details
          rows={[
            ['pin', `${L['film.sauna']} · ${BUILDING}`],
            ['cal', L['film.dateWed']],
            ['clock', '20:00-21:00'],
          ]}
        />
        <div className={styles.who}>
          <div className={styles.whoHead}>
            <b>{L['film.whoComing']}</b>
            <span>{fill(L['film.capacity'], { n: count, max: 6 })}</span>
          </div>
          {PEOPLE.map(([name, apt], i) => (
            <span key={name} className={styles.personRow} data-target={`p-${i}`} data-on={Boolean(picked[i])}>
              <i className={styles.box}>{picked[i] && <I d={P.check} size={11} stroke={3.5} />}</i>
              <Face name={name!} />
              <span>
                <b>{name}</b>
                <small>{apt}</small>
              </span>
            </span>
          ))}
        </div>
        <span className={`${styles.btn} ${styles.btnWide} ${within(t, 5200, 5500) ? styles.pressed : ''}`} data-target="invite">
          {L['film.reserveInvite']}
        </span>
      </Sheet>
      {PEOPLE.slice(0, 3).map(([name], i) => (
        <Toast key={name} show={within(t, ACCEPT_AT[i]!, ACCEPT_AT[i]! + 1000)} text={fill(L['film.acceptedToast'], { name: name! })} />
      ))}
    </AppFrame>
  );
}

const BARS = [62, 78, 71, 90, 96, 58, 44];

// 4. Manage: numbers and charts, a new report arrives, the machine goes out of
// order for residents, and the report is closed.
function ManageScene({ t, L, phone, brand }: SceneProps) {
  const k = ease(t / 1500);
  const arrived = t >= 2600;
  const expanded = t >= 4250;
  const ooo = t >= 5650;
  const done = t >= 8750;
  const open = arrived && !done ? 2 : 1;
  const stats: Array<[string, string]> = [
    [L['film.stat.bookings'], Math.round(1284 * k).toLocaleString('fi-FI')],
    [L['film.stat.use'], `${Math.round(78 * k)}%`],
    [L['film.stat.noshow'], `${Math.round(3 * k)}%`],
    [L['film.stat.reports'], String(open)],
  ];
  const days = L['film.days'].split(',');
  return (
    <AppFrame L={L} phone={phone} staff active={0} brand={brand} bell={within(t, 2600, 3800) ? 'ring' : 'idle'}>
      <div className={styles.stats}>
        {stats.map(([label, value], i) => (
          <div key={label} className={`${styles.stat} ${i === 3 && within(t, 2600, 3400) ? styles.flash : ''}`}>
            <small>{label}</small>
            <b>{value}</b>
          </div>
        ))}
      </div>
      <div className={phone ? styles.stack : styles.split}>
        <div className={styles.stack}>
          {!phone && (
            <div className={styles.card}>
              <strong className={styles.cardTitle}>{L['film.chart']}</strong>
              <div className={styles.chart}>
                {BARS.map((v, i) => (
                  <span key={i}>
                    <i style={{ height: `${v * ease((t - 200 - i * 120) / 900)}%` }} />
                    <small>{days[i]}</small>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className={styles.card}>
            <strong className={styles.cardTitle}>{L['film.reports']}</strong>
            <AnimatePresence initial={false}>
              {arrived && !done && (
                <motion.div
                  key="new"
                  className={styles.report}
                  data-target="report"
                  initial={{ opacity: 0, height: 0, y: -12 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, x: 40 }}
                >
                  <div className={styles.reportTop}>
                    <span>
                      <b>{L['film.report1']}</b>
                      <small>{L['film.report1.by']}</small>
                    </span>
                    <em className={styles.newBadge}>{L['film.new']}</em>
                  </div>
                  {expanded && (
                    <motion.div className={styles.reportActions} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                      <span className={styles.switchRow} data-target="ooo">
                        <i className={`${styles.switch} ${ooo ? styles.switchOn : ''}`} />
                        {L['film.outOfOrder']}
                      </span>
                      <span className={`${styles.btnGhost} ${within(t, 8500, 8750) ? styles.pressed : ''}`} data-target="done">
                        {L['film.markDone']}
                      </span>
                    </motion.div>
                  )}
                  {ooo && <p className={styles.oooNote}>{L['film.outOfOrderOn']}</p>}
                </motion.div>
              )}
            </AnimatePresence>
            <div className={styles.report} style={{ opacity: 0.7 }}>
              <div className={styles.reportTop}>
                <span>
                  <b>{L['film.report2']}</b>
                  <small>{L['film.report2.by']}</small>
                </span>
              </div>
            </div>
          </div>
        </div>
        {!phone && (
          <AnimatePresence>
            {t >= 6200 && (
              <motion.div className={styles.mini} initial={{ opacity: 0, x: 40, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }}>
                <small className={styles.miniLabel}>{L['film.residentView']}</small>
                <div className={styles.miniPhone}>
                  <div className={styles.miniTop}>
                    <span className={styles.mark} style={{ width: 20, height: 20 }}>
                      <Mark />
                    </span>
                    <b>{L['film.laundry']}</b>
                  </div>
                  {[L['film.machine1'], L['film.machine2']].map((m, i) => (
                    <div key={m} className={styles.miniMachine} data-out={i === 1 && ooo && !done}>
                      <I d={P.washer} size={18} />
                      <b>{m}</b>
                      {i === 1 && ooo && !done ? <em>{L['film.outOfOrder']}</em> : <em className={styles.okBadge}>{L['film.free']}</em>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      <Toast show={within(t, 8800, 10800)} text={L['film.doneToast']} />
    </AppFrame>
  );
}

const DOMAIN = 'booking.yourhousing.fi';

// 5. Brand: recolor everything live, upload a logo, connect your own domain.
export function brandAt(t: number): string {
  if (t >= 3600) return SWATCHES[2]!;
  if (t >= 2400) return SWATCHES[1]!;
  if (t >= 1200) return SWATCHES[0]!;
  return DEFAULT_BRAND;
}

function BrandScene({ t, L, phone }: SceneProps) {
  const brand = brandAt(t);
  const uploading = within(t, 4800, 5600);
  const logo = t >= 5600;
  const typed = DOMAIN.slice(0, Math.max(0, Math.floor((t - 6000) / 55)));
  const dns = [8500, 9000, 9500].map((at) => (t >= at ? 'ok' : t >= 8000 ? 'wait' : 'idle'));
  const verified = t >= 9700;
  return (
    <AppFrame L={L} phone={phone} staff active={4} brand={brand} logo={logo}>
      <div className={phone ? styles.stack : styles.split}>
        <div className={styles.stack}>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>{L['film.branding']}</strong>
            <div className={styles.brandRow}>
              <span className={styles.logoTile} data-target="logo">
                {logo ? (
                  <motion.span className={styles.mark} style={{ width: 40, height: 40 }} initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}>
                    <Mark custom />
                  </motion.span>
                ) : (
                  <I d={P.upload} size={18} />
                )}
                {uploading && (
                  <i className={styles.uploadBar}>
                    <i />
                  </i>
                )}
              </span>
              <span>
                <b>{L['film.logo']}</b>
                <small>{logo ? 'logo.svg · 4 KB' : `${L['film.upload']} SVG, PNG`}</small>
              </span>
            </div>
            <div className={styles.brandRow}>
              <span className={styles.swatches}>
                {[DEFAULT_BRAND, ...SWATCHES].map((c, i) => (
                  <i key={c} data-target={i ? `sw-${i}` : undefined} data-on={brand === c} style={{ background: c }} />
                ))}
              </span>
              <span>
                <b>{L['film.color']}</b>
                <small>{brand.toUpperCase()}</small>
              </span>
            </div>
          </div>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>{L['film.domain']}</strong>
            <div className={styles.domainRow}>
              <span className={styles.input}>
                <I d={P.globe} size={14} />
                {typed}
                {t >= 6000 && t < 7800 && <i className={styles.caret} />}
              </span>
              <span className={`${styles.btn} ${within(t, 7800, 8000) ? styles.pressed : ''}`} data-target="verify">
                {verified ? L['film.verified'] : t >= 8000 ? L['film.checking'] : L['film.verify']}
              </span>
            </div>
            {t >= 8000 && (
              <div className={styles.dns}>
                {[L['film.dnsCname'], L['film.dnsTxt'], L['film.https']].map((label, i) => (
                  <motion.span key={label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                    <i data-state={dns[i]}>{dns[i] === 'ok' ? <I d={P.check} size={11} stroke={3.5} /> : null}</i>
                    {label}
                  </motion.span>
                ))}
              </div>
            )}
          </div>
        </div>
        {!phone && (
          <div className={styles.mini}>
            <small className={styles.miniLabel}>{L['film.preview']}</small>
            <div className={styles.miniPhone} style={{ ['--b' as string]: brand }}>
              <div className={styles.miniTop}>
                <span className={styles.mark} style={{ width: 20, height: 20 }}>
                  <Mark custom={logo} />
                </span>
                <b>{L['film.laundry']}</b>
              </div>
              <div className={styles.miniMeter}>
                <span />
              </div>
              {[17, 18, 19, 20].map((h, i) => (
                <div key={h} className={`${styles.miniSlot} ${i === 1 ? styles.mine : styles.free}`}>
                  {hh(h)}
                  {i === 1 && <em>{L['film.yours']}</em>}
                </div>
              ))}
              <div className={styles.miniBtn}>{L['film.reserve']}</div>
            </div>
          </div>
        )}
      </div>
    </AppFrame>
  );
}

export type SceneDef = {
  id: 'book' | 'checkin' | 'invite' | 'manage' | 'brand';
  dur: number;
  glow: string;
  url: (t: number) => string;
  beats: Beat[];
  bursts: number[];
  Scene: (p: SceneProps) => React.ReactElement;
};

export const SCENES: SceneDef[] = [
  {
    id: 'book',
    dur: 12000,
    glow: '#3b82f6',
    url: () => 'booking.riverside.fi/booking/laundry',
    beats: [
      [0, null],
      [500, 'cell-a'],
      [2150, 'cell-a', 250],
      [2600, null],
      [3100, 'reserve'],
      [3850, 'reserve', 300],
      [4400, null],
      [7500, 'cell-b'],
      [8150, 'cell-b', 1350],
      [9800, null],
    ],
    bursts: [4200, 9500],
    Scene: BookScene,
  },
  {
    id: 'checkin',
    dur: 11500,
    glow: '#10b981',
    url: () => 'booking.riverside.fi/booking/laundry',
    beats: [
      [0, null],
      [1300, 'notif'],
      [1850, 'notif', 250],
      [2300, null],
      [2800, 'checkin'],
      [3350, 'checkin', 300],
      [3800, null],
    ],
    bursts: [],
    Scene: CheckInScene,
  },
  {
    id: 'invite',
    dur: 10800,
    glow: '#f59e0b',
    url: () => 'booking.riverside.fi/booking/sauna',
    beats: [
      [0, null],
      [500, 'sauna'],
      [1150, 'sauna', 250],
      [1700, null],
      [2200, 'p-0'],
      [2550, 'p-0', 200],
      [3000, 'p-1'],
      [3350, 'p-1', 200],
      [3800, 'p-2'],
      [4150, 'p-2', 200],
      [4700, 'invite'],
      [5150, 'invite', 300],
      [5600, null],
    ],
    bursts: [5500],
    Scene: InviteScene,
  },
  {
    id: 'manage',
    dur: 11500,
    glow: '#8b5cf6',
    url: () => 'booking.riverside.fi/manage/overview',
    beats: [
      [0, null],
      [3500, 'report'],
      [3950, 'report', 300],
      [4600, 'ooo'],
      [5350, 'ooo', 300],
      [6000, null],
      [7900, 'done'],
      [8450, 'done', 300],
      [8900, null],
    ],
    bursts: [],
    Scene: ManageScene,
  },
  {
    id: 'brand',
    dur: 12500,
    glow: '',
    url: (t) => (t >= 9900 ? `${DOMAIN}/manage/settings` : 'booking.riverside.fi/manage/settings'),
    beats: [
      [0, null],
      [500, 'sw-1'],
      [950, 'sw-1', 250],
      [1700, 'sw-2'],
      [2150, 'sw-2', 250],
      [2900, 'sw-3'],
      [3350, 'sw-3', 250],
      [4100, 'logo'],
      [4550, 'logo', 250],
      [5200, null],
      [7200, 'verify'],
      [7750, 'verify', 250],
      [8200, null],
    ],
    bursts: [9700],
    Scene: BrandScene,
  },
];
