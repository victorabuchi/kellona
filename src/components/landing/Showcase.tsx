'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './landing.module.css';

export type ShowcaseLabels = {
  tabs: { resident: string; group: string; staff: string; brand: string };
  titles: { resident: [string, string]; group: [string, string]; staff: [string, string]; brand: [string, string] };
  kinds: { laundry: string; sauna: string; parking: string; common_room: string; gym: string };
  play: string;
  pause: string;
  today: string;
  book: string;
  confirm: string;
  booked: string;
  invite: string;
  invited: string;
  accepted: string;
  accept: string;
  decline: string;
  saved: string;
  save: string;
  apartment: string;
  auto: string;
  yes: string;
  no: string;
  amenities: string;
  yourBrand: string;
  weekdays: string[];
  invitedYou: string;
};

const INK = '#14181f';
const MUTED = '#6b7380';
const LINE = '#e3e7ec';

// Moves an arrow cursor onto the element marked data-target for this step.
// Position is written to the DOM directly, after layout, so it follows the
// real element wherever the demo placed it.
function Cursor({ root, target, press }: { root: React.RefObject<HTMLDivElement | null>; target: string | null; press: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = root.current;
    const cursor = ref.current;
    if (!container || !cursor) return;
    const el = target ? container.querySelector<HTMLElement>(`[data-target="${target}"]`) : null;
    if (!el) {
      cursor.style.opacity = '0';
      return;
    }
    let top = el.offsetHeight / 2;
    let left = Math.min(el.offsetWidth / 2, 60);
    let node: HTMLElement | null = el;
    while (node && node !== container) {
      top += node.offsetTop;
      left += node.offsetLeft;
      node = node.offsetParent as HTMLElement | null;
    }
    cursor.style.top = `${top}px`;
    cursor.style.left = `${left}px`;
    cursor.style.opacity = '1';
  }, [root, target]);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 40,
        left: 40,
        opacity: 0,
        transform: press ? 'scale(0.85)' : 'scale(1)',
        transition: 'top 0.45s cubic-bezier(0.25,0.46,0.45,0.94), left 0.45s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.25s, transform 0.12s',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <svg width="20" height="24" viewBox="0 0 18 22">
        <path d="M1 1L1 17L5 13L8 20L10.5 19L7.5 12L13 12Z" fill="#111" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Phone({ children, brand = '#2f5d8a', title }: { children: React.ReactNode; brand?: string; title: string }) {
  return (
    <div style={{ width: 280, borderRadius: 36, background: '#0f1217', padding: 10, boxShadow: '0 30px 70px -20px rgba(20,24,31,0.45)' }}>
      <div style={{ borderRadius: 28, overflow: 'hidden', background: '#f6f7f9', height: 540, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ height: 26, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: 80, height: 6, borderRadius: 3, background: '#d7dbe0' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#fff', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: brand, transition: 'background 0.5s' }} />
          <div style={{ fontWeight: 800, fontSize: 14, color: INK }}>{title}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Btn({ children, color, target, pressed, ghost }: { children: React.ReactNode; color: string; target?: string; pressed?: boolean; ghost?: boolean }) {
  return (
    <div
      data-target={target}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '7px 12px',
        borderRadius: 9,
        fontWeight: 700,
        fontSize: 12,
        background: ghost ? '#fff' : color,
        color: ghost ? INK : '#fff',
        border: `1px solid ${ghost ? LINE : color}`,
        transform: pressed ? 'scale(0.94)' : 'scale(1)',
        transition: 'transform 0.12s, background 0.5s, border-color 0.5s',
      }}
    >
      {children}
    </div>
  );
}

function Toast({ show, text, color }: { show: boolean; text: string; color: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: show ? 16 : -60,
        transition: 'bottom 0.35s ease',
        background: INK,
        color: '#fff',
        borderRadius: 12,
        padding: '10px 12px',
        fontSize: 13,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 9, background: color, display: 'grid', placeItems: 'center' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {text}
    </div>
  );
}

// Resident books a laundry slot.
const RESIDENT = { delays: [900, 700, 700, 700, 900, 600, 250, 3200], targets: [null, 'day', 'day', 'slot', 'slot', 'confirm', 'confirm', null] };
function ResidentDemo({ step, l }: { step: number; l: ShowcaseLabels }) {
  const color = '#2f5d8a';
  const day = step >= 2 ? 2 : 0;
  const picked = step >= 4;
  const booked = step >= 7;
  return (
    <Phone title={l.kinds.laundry} brand={color}>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {l.weekdays.map((d, i) => (
            <div
              key={d}
              data-target={i === 2 ? 'day' : undefined}
              style={{
                textAlign: 'center',
                padding: '5px 0',
                borderRadius: 8,
                fontSize: 10,
                lineHeight: 1.2,
                background: i === day ? color : '#fff',
                color: i === day ? '#fff' : INK,
                border: `1px solid ${i === day ? color : LINE}`,
                transition: 'all 0.25s',
              }}
            >
              {d}
              <div style={{ fontWeight: 800, fontSize: 13 }}>{21 + i}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14 }}>
          {[16, 17, 18, 19, 20].map((h) => {
            const isTarget = h === 18;
            const taken = h === 17;
            return (
              <div
                key={h}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 12px',
                  borderTop: h === 16 ? 'none' : `1px solid ${LINE}`,
                  background: isTarget && booked ? '#e8eff6' : isTarget && picked ? '#f3f7fb' : '#fff',
                  outline: isTarget && picked && !booked ? `2px solid ${color}` : 'none',
                  outlineOffset: -2,
                  transition: 'background 0.3s',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 13, color: INK }}>{h}:00</span>
                {taken ? (
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{l.booked}</span>
                ) : isTarget && booked ? (
                  <span style={{ fontSize: 11, color, fontWeight: 800 }}>{l.booked}</span>
                ) : (
                  <Btn color={color} target={isTarget ? 'slot' : undefined} pressed={isTarget && step === 4}>
                    {l.book}
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
        <div
          style={{
            background: '#fff',
            border: `1px solid ${LINE}`,
            borderRadius: 14,
            padding: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: picked && !booked ? 1 : 0,
            transform: picked && !booked ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all 0.3s',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>
            {l.weekdays[2]} 23 · 18:00
          </span>
          <Btn color={color} target="confirm" pressed={step === 6}>
            {l.confirm}
          </Btn>
        </div>
      </div>
      <Toast show={booked} text={`${l.kinds.laundry} · 18:00 · ${l.booked}`} color={color} />
    </Phone>
  );
}

// Booker invites roommates to the sauna; a roommate accepts.
const GROUP = { delays: [900, 700, 500, 700, 500, 700, 250, 1600, 800, 700, 250, 3200], targets: [null, 'p0', 'p0', 'p1', 'p1', 'confirm', 'confirm', null, 'accept', 'accept', 'accept', null] };
function GroupDemo({ step, l }: { step: number; l: ShowcaseLabels }) {
  const color = '#d9480f';
  const names = ['Aino', 'Eero'];
  const checked = [step >= 2, step >= 4];
  const sent = step >= 7;
  const second = step >= 8;
  const accepted = step >= 11;
  if (second) {
    return (
      <Phone title={l.kinds.sauna} brand={color}>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4 }}>Eero</div>
          <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: INK }}>{l.kinds.sauna}</div>
            <div style={{ fontSize: 12, color: MUTED }}>{l.invitedYou}</div>
            {accepted ? (
              <span style={{ fontSize: 12, fontWeight: 800, color }}>{l.accepted}</span>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn color={color} target="accept" pressed={step === 10}>
                  {l.accept}
                </Btn>
                <Btn color={color} ghost>
                  {l.decline}
                </Btn>
              </div>
            )}
          </div>
        </div>
        <Toast show={accepted} text={`${l.kinds.sauna} · ${l.accepted}`} color={color} />
      </Phone>
    );
  }
  return (
    <Phone title={l.kinds.sauna} brand={color}>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: INK }}>
            {l.weekdays[2]} 23 · 18:00-20:00
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>{l.invite}</div>
          {names.map((n, i) => (
            <div key={n} data-target={`p${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: INK }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  border: `1.5px solid ${checked[i] ? color : '#b9c0c9'}`,
                  background: checked[i] ? color : '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  transition: 'all 0.2s',
                }}
              >
                {checked[i] && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              {n}
            </div>
          ))}
          <Btn color={color} target="confirm" pressed={step === 6}>
            {l.confirm}
          </Btn>
        </div>
      </div>
      <Toast show={sent} text={l.invited} color={color} />
    </Phone>
  );
}

// Staff switch the sauna off for one apartment.
const STAFF = { delays: [900, 700, 500, 800, 500, 700, 250, 3200], targets: [null, 'sauna', 'sauna', 'no', 'no', 'save', 'save', null] };
function StaffDemo({ step, l }: { step: number; l: ShowcaseLabels }) {
  const color = '#2e7d4f';
  const open = step >= 2 && step < 5;
  const value = step >= 4 ? l.no : l.auto;
  const saved = step >= 7;
  const rows: Array<[string, string]> = [
    [l.kinds.laundry, l.auto],
    [l.kinds.sauna, value],
    [l.kinds.parking, l.yes],
    [l.kinds.gym, l.auto],
  ];
  return (
    <div style={{ width: 460, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 70px -24px rgba(20,24,31,0.35)', position: 'relative' }}>
      <div style={{ background: '#f5f6f8', borderBottom: `1px solid ${LINE}`, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {['#ff5f57', '#ffbd2e', '#28c940'].map((c) => (
          <span key={c} style={{ width: 9, height: 9, borderRadius: 5, background: c }} />
        ))}
        <span style={{ flex: 1, textAlign: 'center', fontSize: 10, color: MUTED, background: '#ebedf0', borderRadius: 5, padding: '3px 8px' }}>varaukset.example.fi/manage</span>
      </div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 360 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>
          {l.apartment} B 3
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>{l.amenities}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {rows.map(([k, v]) => {
            const isSauna = k === l.kinds.sauna;
            return (
              <div key={k} style={{ position: 'relative' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: INK, marginBottom: 4 }}>{k}</div>
                <div
                  data-target={isSauna ? 'sauna' : undefined}
                  style={{
                    border: `1px solid ${isSauna && open ? color : LINE}`,
                    borderRadius: 8,
                    padding: '7px 9px',
                    fontSize: 12,
                    color: isSauna && step >= 4 ? color : INK,
                    fontWeight: isSauna && step >= 4 ? 800 : 400,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  {v}
                  <span style={{ color: MUTED }}>▾</span>
                </div>
                {isSauna && open && (
                  <div style={{ position: 'absolute', top: 54, left: 0, right: 0, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: '0 12px 24px rgba(0,0,0,0.12)', zIndex: 5 }}>
                    {[l.auto, l.yes, l.no].map((o) => (
                      <div key={o} data-target={o === l.no ? 'no' : undefined} style={{ padding: '7px 9px', fontSize: 12, color: INK, background: o === l.no && step >= 3 ? '#eaf4ee' : '#fff' }}>
                        {o}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <Btn color={color} target="save" pressed={step === 6}>
            {l.save}
          </Btn>
        </div>
      </div>
      <Toast show={saved} text={l.saved} color={color} />
    </div>
  );
}

// The same app in three brands.
const BRANDS = [
  { name: 'Northwind', color: '#1d3f6e', accent: '#f2a900' },
  { name: 'Lakeside', color: '#2e7d4f', accent: '#e76f51' },
  { name: '', color: '#7b1fa2', accent: '#26a69a' },
];
const BRAND = { delays: [1200, 700, 300, 1400, 700, 300, 1400, 700, 300, 2600], targets: [null, 's1', 's1', null, 's2', 's2', null, 's0', 's0', null] };
function BrandDemo({ step, l }: { step: number; l: ShowcaseLabels }) {
  const active = step >= 8 ? 0 : step >= 5 ? 2 : step >= 2 ? 1 : 0;
  const b = BRANDS[active]!;
  const name = b.name || l.yourBrand;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <Phone title={name} brand={b.color}>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([['laundry', l.kinds.laundry], ['sauna', l.kinds.sauna], ['common_room', l.kinds.common_room]] as const).map(([k, label]) => (
            <div key={k} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: `${b.color}18`, transition: 'background 0.5s', display: 'grid', placeItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: b.color, transition: 'background 0.5s' }} />
              </span>
              <span style={{ fontWeight: 800, fontSize: 13, color: INK, flex: 1 }}>{label}</span>
              <Btn color={b.color}>{l.book}</Btn>
            </div>
          ))}
          <div style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 6, background: b.accent, color: '#fff', transition: 'background 0.5s' }}>{name}</div>
        </div>
      </Phone>
      <div style={{ display: 'flex', gap: 12 }}>
        {BRANDS.map((x, i) => (
          <span
            key={x.color}
            data-target={`s${i}`}
            style={{ width: 30, height: 30, borderRadius: 15, background: x.color, border: `3px solid ${i === active ? '#fff' : 'transparent'}`, boxShadow: i === active ? `0 0 0 2px ${x.color}, 0 0 18px ${x.color}` : 'none', transition: 'all 0.3s' }}
          />
        ))}
      </div>
    </div>
  );
}

const DEMOS = {
  resident: { color: '#2f5d8a', ...RESIDENT, Demo: ResidentDemo },
  group: { color: '#d9480f', ...GROUP, Demo: GroupDemo },
  staff: { color: '#2e7d4f', ...STAFF, Demo: StaffDemo },
  brand: { color: '#7b1fa2', ...BRAND, Demo: BrandDemo },
} as const;
type Key = keyof typeof DEMOS;
const ORDER: Key[] = ['resident', 'group', 'staff', 'brand'];

// Scales the fixed-size demo to fit the card on any screen.
function Fit({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      if (!i.offsetWidth || !i.offsetHeight) return;
      setScale(Math.min(1, o.clientWidth / i.offsetWidth, o.clientHeight / i.offsetHeight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className={styles.frame}>
      <div ref={inner} style={{ transform: `scale(${scale})`, transformOrigin: 'center center', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

export default function Showcase({ labels }: { labels: ShowcaseLabels }) {
  const [active, setActive] = useState<Key>('resident');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const demoRoot = useRef<HTMLDivElement>(null);
  const def = DEMOS[active];
  const last = def.delays.length - 1;
  const finished = step >= last;

  useEffect(() => {
    if (!playing) return;
    if (finished) {
      // Move on to the next demo after a pause, so the showcase plays like a video.
      const t = setTimeout(() => {
        const next = ORDER[(ORDER.indexOf(active) + 1) % ORDER.length]!;
        setActive(next);
        setStep(0);
      }, 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => Math.min(s + 1, last)), def.delays[step] ?? 800);
    return () => clearTimeout(t);
  }, [playing, step, finished, active, def.delays, last]);

  const [title, desc] = labels.titles[active];
  const { Demo } = def;
  const target = def.targets[step] ?? null;
  const press = def.targets[step] !== null && def.targets[step] === def.targets[step - 1] && def.targets[step + 1] !== def.targets[step];

  return (
    <div className={styles.showcase}>
      <div key={active} className={`${styles.head} ${styles.fadeUp}`}>
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      <div className={styles.showCard} style={{ boxShadow: `0 0 110px -24px ${def.color}88, 0 4px 24px rgba(20,24,31,0.06)` }}>
        <Fit>
          <div ref={demoRoot} style={{ position: 'relative' }}>
            <Demo step={step} l={labels} />
            <Cursor root={demoRoot} target={target} press={press} />
          </div>
        </Fit>
        <button
          type="button"
          className={styles.playBtn}
          aria-label={playing ? labels.pause : labels.play}
          onClick={() => {
            if (finished) setStep(0);
            setPlaying((p) => !p || finished);
          }}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="4" width="5" height="16" rx="1" />
              <rect x="14" y="4" width="5" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4l14 8-14 8V4z" />
            </svg>
          )}
        </button>
        <div className={styles.pills} role="group">
          {ORDER.map((k) => (
            <button
              key={k}
              type="button"
              className={styles.pill}
              aria-pressed={k === active}
              style={k === active ? { background: DEMOS[k].color } : undefined}
              onClick={() => {
                setActive(k);
                setStep(0);
                setPlaying(true);
              }}
            >
              {labels.tabs[k]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
