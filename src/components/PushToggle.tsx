'use client';

import { useEffect, useState } from 'react';
import styles from './app.module.css';

type State = 'unknown' | 'unsupported' | 'off' | 'on' | 'busy';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Offers booking reminders on this device. Without push support the server
// falls back to email, so this only informs.
export default function PushToggle({ vapidKey, labels }: { vapidKey: string; labels: { enable: string; on: string; unsupported: string } }) {
  const [state, setState] = useState<State>('unknown');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setState('unsupported');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      if (!cancelled) setState(sub ? 'on' : 'off');
    })().catch(() => !cancelled && setState('unsupported'));
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  async function enable() {
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      setState(res.ok ? 'on' : 'off');
    } catch {
      setState('off');
    }
  }

  if (state === 'unknown') return null;
  if (state === 'unsupported') return <p className={styles.muted}>{labels.unsupported}</p>;
  if (state === 'on') return <p className={styles.muted}>{labels.on}</p>;
  return (
    <button type="button" className={styles.btnGhost} onClick={enable} disabled={state === 'busy'}>
      {labels.enable}
    </button>
  );
}
