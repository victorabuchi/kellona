'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './landing.module.css';

export type MenuItem = { title: string; desc: string; href: string; icon: string };
export type Menu = {
  id: string;
  label: string;
  columns: Array<{ heading: string; items: MenuItem[] }>;
  side: { heading: string; links: Array<{ label: string; href: string }> };
  footer: { label: string; href: string };
};

const ICONS: Record<string, string> = {
  laundry: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM4 8h16M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  sauna: 'M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4M16 3c-1 1.5 1 2.5 0 4M3 11h18v9H3zM3 15h18',
  parking: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM9 17V7h4a3 3 0 0 1 0 6H9',
  space: 'M4 18v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5M2 18h20M6 11V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7',
  repeat: 'M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z',
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM11 18h2',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  palette: 'M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1 3.7A2 2 0 0 1 12 22ZM7.5 10.5h.01M10.5 7h.01M15 7.5h.01',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
};

function Icon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] ?? ICONS['space']} />
    </svg>
  );
}

function Go({ href, className, onClick, children }: { href: string; className?: string; onClick?: () => void; children: React.ReactNode }) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

// Top bar with hover cards: pointing at a menu opens a card that explains
// each feature, like a product site's mega menu. On phones it folds into one list.
export default function LandingNav({
  logo,
  menus,
  plain,
  actions,
  mobileExtra,
  menuLabel,
}: {
  logo: React.ReactNode;
  menus: Menu[];
  plain: Array<{ label: string; href: string }>;
  actions: React.ReactNode;
  mobileExtra: React.ReactNode;
  menuLabel: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const active = menus.find((m) => m.id === open) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setMobile(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const show = (id: string) => {
    window.clearTimeout(timer.current);
    setOpen(id);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(null), 140);
  };
  const close = () => {
    setOpen(null);
    setMobile(false);
  };

  return (
    <nav className={styles.nav} onMouseLeave={hide}>
      <div className={`${styles.wrap} ${styles.navInner}`}>
        <Link href="/" className={styles.navLogo} aria-label="Kellona" onClick={close}>
          {logo}
        </Link>
        <ul className={styles.navLinks}>
          {menus.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={styles.trigger}
                aria-expanded={open === m.id}
                aria-haspopup="true"
                onMouseEnter={() => show(m.id)}
                onFocus={() => show(m.id)}
                onClick={() => (open === m.id ? setOpen(null) : show(m.id))}
              >
                {m.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </li>
          ))}
          {plain.map((p) => (
            <li key={p.href}>
              <a href={p.href} className={styles.trigger} onMouseEnter={() => setOpen(null)}>
                {p.label}
              </a>
            </li>
          ))}
        </ul>
        <div className={styles.navActions} onMouseEnter={() => setOpen(null)}>
          {actions}
          <button type="button" className={styles.menuBtn} aria-label={menuLabel} aria-expanded={mobile} onClick={() => setMobile((v) => !v)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobile ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {active && (
        <div className={styles.panelWrap}>
          <div className={styles.panel} role="menu" onMouseEnter={() => show(active.id)}>
            <div className={styles.panelGrid}>
              {active.columns.map((col) => (
                <div key={col.heading} className={styles.panelCol}>
                  <div className={styles.panelHeading}>{col.heading}</div>
                  {col.items.map((item) => (
                    <Go key={item.title} href={item.href} className={styles.panelItem} onClick={close}>
                      <span className={styles.panelIcon}>
                        <Icon name={item.icon} />
                      </span>
                      <span>
                        <span className={styles.panelTitle}>{item.title}</span>
                        <span className={styles.panelDesc}>{item.desc}</span>
                      </span>
                    </Go>
                  ))}
                </div>
              ))}
              <div className={`${styles.panelCol} ${styles.panelSide}`}>
                <div className={styles.panelHeading}>{active.side.heading}</div>
                {active.side.links.map((l) => (
                  <Go key={l.href} href={l.href} className={styles.panelSideLink} onClick={close}>
                    {l.label}
                  </Go>
                ))}
              </div>
            </div>
            <Go href={active.footer.href} className={styles.panelFooter} onClick={close}>
              {active.footer.label}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Go>
          </div>
        </div>
      )}

      {mobile && (
        <div className={styles.mobilePanel}>
          {menus.map((m) => (
            <details key={m.id} className={styles.mobileGroup}>
              <summary>{m.label}</summary>
              {m.columns.flatMap((c) => c.items).map((item) => (
                <Go key={item.title} href={item.href} className={styles.panelItem} onClick={close}>
                  <span className={styles.panelIcon}>
                    <Icon name={item.icon} />
                  </span>
                  <span>
                    <span className={styles.panelTitle}>{item.title}</span>
                    <span className={styles.panelDesc}>{item.desc}</span>
                  </span>
                </Go>
              ))}
            </details>
          ))}
          {plain.map((p) => (
            <a key={p.href} href={p.href} className={styles.mobileLink} onClick={close}>
              {p.label}
            </a>
          ))}
          {mobileExtra}
        </div>
      )}
    </nav>
  );
}
