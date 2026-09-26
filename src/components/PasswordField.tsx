'use client';

import { useState } from 'react';
import styles from './auth.module.css';

export default function PasswordField({ label, show, hide }: { label: string; show: string; hide: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className={styles.field}>
      {label}
      <span className={styles.passwordWrap}>
        <input className={styles.input} type={visible ? 'text' : 'password'} name="password" autoComplete="current-password" />
        <button type="button" className={styles.eye} onClick={() => setVisible((v) => !v)} aria-label={visible ? hide : show} aria-pressed={visible}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {visible ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M1 1l22 22" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </span>
    </label>
  );
}
