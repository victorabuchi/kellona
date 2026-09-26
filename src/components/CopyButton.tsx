'use client';

import { useState } from 'react';
import styles from './shell.module.css';

export default function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.copyBtn}
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? done : label}
    </button>
  );
}
