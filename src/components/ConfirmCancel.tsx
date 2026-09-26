'use client';

import { useState } from 'react';
import styles from './app.module.css';

// A cancel button that asks once before it submits.
export default function ConfirmCancel({
  action,
  bookingId,
  returnTo,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  bookingId: string;
  returnTo?: string;
  labels: { cancel: string; confirm: string; yes: string; keep: string };
}) {
  const [asking, setAsking] = useState(false);
  return (
    <form action={action} className={asking ? styles.confirm : styles.inline} role={asking ? 'alertdialog' : undefined} aria-label={asking ? labels.confirm : undefined}>
      <input type="hidden" name="bookingId" value={bookingId} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {asking ? (
        <>
          <span className={styles.confirmText}>{labels.confirm}</span>
          <button type="button" className={styles.btnGhost} onClick={() => setAsking(false)}>
            {labels.keep}
          </button>
          <button type="submit" className={styles.btnDangerSolid} autoFocus>
            {labels.yes}
          </button>
        </>
      ) : (
        <button type="button" className={styles.btnDanger} onClick={() => setAsking(true)}>
          {labels.cancel}
        </button>
      )}
    </form>
  );
}
