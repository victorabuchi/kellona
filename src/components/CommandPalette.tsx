'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './shell.module.css';

export type PaletteItem = { group: string; label: string; hint?: string; href: string; external?: boolean };

// Search button with a Cmd/Ctrl+K command palette over pages and records.
export default function CommandPalette({
  items,
  labels,
}: {
  items: PaletteItem[];
  labels: { button: string; placeholder: string; empty: string; hint: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const [mac, setMac] = useState(true);

  useEffect(() => {
    // Platform is only known in the browser; default to the Mac symbol on the server.
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    if (!isMac) queueMicrotask(() => setMac(false));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = query ? items.filter((i) => `${i.label} ${i.hint ?? ''}`.toLowerCase().includes(query)) : items.filter((i) => i.group === items[0]?.group);
    return list.slice(0, 40);
  }, [items, q]);

  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    setOpen(false);
    setQ('');
    setIndex(0);
    if (item.external) window.location.href = item.href;
    else router.push(item.href);
  };

  return (
    <>
      <button type="button" className={styles.searchBtn} onClick={() => setOpen(true)} aria-label={labels.button}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className={styles.searchLabel}>{labels.button}</span>
        <kbd className={styles.kbd}>{mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <dialog
        ref={dialog}
        className={styles.palette}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className={styles.paletteSearch}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            autoFocus
            value={q}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                go(results[index]);
              }
            }}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>
        <div className={styles.paletteList} role="listbox">
          {results.length === 0 && <p className={styles.paletteEmpty}>{labels.empty}</p>}
          {results.map((item, i) => {
            const heading = item.group !== results[i - 1]?.group ? item.group : null;
            return (
              <div key={`${item.group}|${item.href}|${item.label}`}>
                {heading && <div className={styles.popLabel}>{heading}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  className={styles.paletteItem}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => go(item)}
                >
                  <span>{item.label}</span>
                  {item.hint && <span className={styles.paletteHint}>{item.hint}</span>}
                  {i === index && <span className={styles.paletteEnter}>↵ {labels.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </dialog>
    </>
  );
}
