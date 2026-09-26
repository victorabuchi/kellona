'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './shell.module.css';

// Small popover menu that closes on outside click, Escape and navigation.
export default function Dropdown({
  button,
  label,
  align = 'left',
  buttonClass,
  children,
}: {
  button: React.ReactNode;
  label: string;
  align?: 'left' | 'right';
  buttonClass?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className={styles.dropdown} ref={ref}>
      <button type="button" className={buttonClass} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {button}
      </button>
      {open && (
        <div
          className={`${styles.popover} ${align === 'right' ? styles.popoverRight : ''}`}
          role="menu"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
