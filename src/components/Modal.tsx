'use client';

import { useRef } from 'react';
import styles from './shell.module.css';

// A button that opens its content in a native dialog.
export default function Modal({
  trigger,
  title,
  description,
  triggerClass,
  openInitially = false,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  triggerClass?: string;
  openInitially?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={triggerClass} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={(el) => {
          ref.current = el;
          if (el && openInitially && !el.open) el.showModal();
        }}
        className={styles.dialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className={styles.dialogInner}>
          <div className={styles.dialogHead}>
            <div>
              <h2>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <button type="button" className={styles.iconBtn} aria-label="Close" onClick={() => ref.current?.close()}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
