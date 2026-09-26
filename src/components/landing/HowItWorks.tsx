'use client';

import { useState } from 'react';
import styles from './landing.module.css';

type Step = { title: string; desc: string };

export default function HowItWorks({ tabs }: { tabs: Array<{ label: string; steps: Step[] }> }) {
  const [active, setActive] = useState(0);
  return (
    <>
      <div className={styles.tabs} role="group">
        {tabs.map((tab, i) => (
          <button key={tab.label} type="button" className={styles.tab} aria-pressed={i === active} onClick={() => setActive(i)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div key={active} className={`${styles.steps} ${styles.fadeUp}`}>
        {tabs[active]!.steps.map((s, i) => (
          <div key={s.title} className={styles.step}>
            <div className={styles.stepNum}>{i + 1}</div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}
