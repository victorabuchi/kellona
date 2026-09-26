'use client';

import { useState } from 'react';
import styles from './app.module.css';
import { deleteAccountAction } from '../lib/auth/account-actions';

// Danger zone: asks for the account's email before the delete button works.
export default function DeleteAccount({
  email,
  blocked,
  labels,
}: {
  email: string;
  blocked: string | null;
  labels: { title: string; body: string; button: string; confirm: string; final: string; cancel: string };
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  return (
    <div className={styles.danger}>
      <span className={styles.dangerIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" />
        </svg>
      </span>
      <div className={styles.dangerText}>
        <strong>{labels.title}</strong>
        <p>{labels.body}</p>
        {blocked ? (
          <p className={styles.dangerNote}>{blocked}</p>
        ) : (
          // The form is always in the page; the email field shows once opened.
          <form action={deleteAccountAction} className={styles.dangerForm}>
            <label hidden={!open}>
              {labels.confirm}
              <input name="confirm" type="email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} />
            </label>
            {open ? (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => {
                    setOpen(false);
                    setTyped('');
                  }}
                >
                  {labels.cancel}
                </button>
                <button type="submit" className={styles.btnDangerSolid} disabled={!matches}>
                  {labels.final}
                </button>
              </div>
            ) : (
              <button type="button" className={styles.btnDangerSolid} style={{ justifySelf: 'start' }} onClick={() => setOpen(true)}>
                {labels.button}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
