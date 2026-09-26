'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import confetti from 'canvas-confetti';
import styles from './film.module.css';
import { SCENES, brandAt, type Beat } from './scenes';
import type { FilmKey, FilmLabels } from '../film-keys';

const TICK = 100;
const DESK = { w: 1100, h: 640 };
const PHONE = { w: 390, h: 760 };

function beatAt(beats: Beat[], t: number): { target: string | null; press: boolean; key: number } {
  let current: Beat = [0, null];
  for (const b of beats) if (b[0] <= t) current = b;
  const [at, target, press] = current;
  return { target, press: Boolean(press && t < at + press), key: at };
}

// The landing page "video": the real Kellona screens, played scene by scene
// with a cursor, inside a browser window. Plays only while on screen; with
// reduced motion it shows each scene's finished state and does not advance.
export default function ProductFilm({ L }: { L: FilmLabels }) {
  const [clock, setClock] = useState({ scene: 0, t: 0 });
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [box, setBox] = useState<{ scale: number; phone: boolean } | null>(null);
  const reduced = useReducedMotion();
  const outer = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const confettiCanvas = useRef<HTMLCanvasElement>(null);
  const shoot = useRef<confetti.CreateTypes | null>(null);
  const last = useRef({ scene: -1, t: 0 });

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry!.contentRect.width;
      const phone = w < 640;
      setBox({ scale: w / (phone ? PHONE : DESK).w, phone });
    });
    ro.observe(el);
    const io = new IntersectionObserver(([entry]) => setVisible(entry!.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const running = playing && visible && !reduced;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setClock((c) => (c.t + TICK >= SCENES[c.scene]!.dur ? { scene: (c.scene + 1) % SCENES.length, t: 0 } : { scene: c.scene, t: c.t + TICK }));
    }, TICK);
    return () => window.clearInterval(id);
  }, [running]);

  const def = SCENES[clock.scene]!;
  const t = reduced ? def.dur - 1 : clock.t;
  const phone = box?.phone ?? false;
  const size = phone ? PHONE : DESK;
  const beat = beatAt(def.beats, t);
  const glow = def.glow || brandAt(t);

  // Confetti when a scene books something.
  useEffect(() => {
    const prev = last.current;
    last.current = { scene: clock.scene, t: clock.t };
    if (reduced || prev.scene !== clock.scene) return;
    if (!def.bursts.some((b) => prev.t < b && clock.t >= b)) return;
    if (!shoot.current && confettiCanvas.current) shoot.current = confetti.create(confettiCanvas.current, { resize: true });
    shoot.current?.({ particleCount: 70, spread: 75, startVelocity: 32, origin: { y: 0.55 }, colors: [glow, '#e0a526', '#ffffff', '#10b981'], scalar: 0.9, ticks: 160 });
  }, [clock, def, reduced, glow]);

  // Put the cursor on the element the current beat points at. Written to the
  // DOM directly, measured from the element's real (possibly animated) box.
  useLayoutEffect(() => {
    const root = canvas.current;
    const arrow = cursor.current;
    if (!root || !arrow || !box) return;
    const el = beat.target ? root.querySelector<HTMLElement>(`[data-target="${beat.target}"]`) : null;
    if (!el) {
      arrow.style.opacity = '0';
      return;
    }
    const r = el.getBoundingClientRect();
    const base = root.getBoundingClientRect();
    const x = (r.left - base.left + Math.min(r.width / 2, 70)) / box.scale;
    const y = (r.top - base.top + r.height / 2) / box.scale;
    arrow.style.transform = `translate(${x}px, ${y}px)`;
    arrow.style.opacity = '1';
  }, [beat.target, t, box]);

  const select = (i: number) => {
    last.current = { scene: i, t: 0 };
    setClock({ scene: i, t: 0 });
    setPlaying(true);
  };
  const Scene = def.Scene;
  const k = (key: string) => L[key as FilmKey];

  return (
    <div className={styles.film}>
      <div className={styles.stage}>
        <div className={styles.glow} style={{ background: `radial-gradient(closest-side, ${glow}, transparent)` }} aria-hidden="true" />
        <div className={styles.window}>
          <div className={styles.chrome} aria-hidden="true">
            <span className={styles.dots}>
              <i />
              <i />
              <i />
            </span>
            <span className={styles.url}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <motion.span key={def.url(t)} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }}>
                {def.url(t)}
              </motion.span>
            </span>
          </div>
          <div ref={outer} className={styles.viewport} style={box ? { height: size.h * box.scale } : undefined}>
            <div
              ref={canvas}
              className={`${styles.canvas} ${running ? '' : styles.paused}`}
              style={{ width: size.w, height: size.h, transform: `scale(${box?.scale ?? 1})`, visibility: box ? 'visible' : 'hidden' }}
              aria-hidden="true"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={`${def.id}-${phone}`} className={styles.sceneWrap} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <Scene t={t} L={L} phone={phone} brand="#2f5d8a" />
                </motion.div>
              </AnimatePresence>
              <canvas ref={confettiCanvas} className={styles.confetti} />
              <div ref={cursor} className={styles.cursor} data-press={beat.press}>
                {beat.press && <i key={beat.key} className={styles.ripple} />}
                <svg width="22" height="26" viewBox="0 0 18 22">
                  <path d="M1 1L1 17L5 13L8 20L10.5 19L7.5 12L13 12Z" fill="#111" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
          <button type="button" className={styles.play} onClick={() => setPlaying((p) => !p)} aria-label={running ? L['film.pause'] : L['film.play']}>
            {running ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="5" y="4" width="5" height="16" rx="1" />
                <rect x="14" y="4" width="5" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 4l14 8-14 8V4z" />
              </svg>
            )}
          </button>
        </div>
        <div className={styles.tabBar} role="tablist">
          {SCENES.map((s, i) => (
            <button key={s.id} type="button" role="tab" aria-selected={i === clock.scene} className={styles.tab} onClick={() => select(i)}>
              {k(`film.tab.${s.id}`)}
              {i === clock.scene && <i className={styles.tabProgress} style={{ width: `${(t / s.dur) * 100}%` }} />}
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={def.id} className={styles.caption} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          <b>{k(`film.cap.${def.id}.t`)}</b> {k(`film.cap.${def.id}.d`)}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
