'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './landing.module.css';

type Item = { title: string; desc: string };
type Card = { title: string; items: Item[]; cta: string; href: string; dark: boolean; icon: string };

function RoleCard({ card, active, onPick }: { card: Card; active: number; onPick: (i: number) => void }) {
  return (
    <div className={`${styles.role} ${card.dark ? styles.roleDark : ''}`}>
      <div className={styles.roleIcon}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={card.icon} />
        </svg>
      </div>
      <h3>{card.title}</h3>
      <div className={styles.roleList}>
        {card.items.map((item, i) => (
          <button key={item.title} type="button" className={`${styles.roleRow} ${i === active ? styles.roleRowActive : ''}`} onClick={() => onPick(i)}>
            <span className={styles.roleRowTop}>
              {item.title}
              {i === active && (
                <svg className={styles.check} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            {i === active && <p>{item.desc}</p>}
          </button>
        ))}
      </div>
      <Link href={card.href} className={card.dark ? styles.btnLight : styles.btnPrimary} style={{ alignSelf: 'flex-start' }}>
        {card.cta}
      </Link>
    </div>
  );
}

// Two cards whose highlighted feature moves on every few seconds.
export default function RoleCards({ cards }: { cards: Card[] }) {
  const [active, setActive] = useState(cards.map(() => 0));
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => a.map((v, i) => (v + 1) % cards[i]!.items.length)), 3200);
    return () => clearInterval(t);
  }, [paused, cards]);
  return (
    <div className={styles.roles} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {cards.map((card, i) => (
        <RoleCard key={card.title} card={card} active={active[i]!} onPick={(n) => setActive((a) => a.map((v, j) => (j === i ? n : v)))} />
      ))}
    </div>
  );
}
