'use client';

import { useEffect, useState } from 'react';

const PARAMS = ['ok', 'error', 'saved', 'sent', 'skipped', 'imported'];

// A one-off message from a redirect (?ok=, ?error=...). It shows briefly, then
// fades out and drops its query parameter, so it does not linger or come back
// on refresh.
export default function Flash({ className, tone = 'ok', children, ms }: { className?: string; tone?: 'ok' | 'err'; children: React.ReactNode; ms?: number }) {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>('shown');
  useEffect(() => {
    const url = new URL(window.location.href);
    const present = PARAMS.filter((p) => url.searchParams.has(p));
    for (const p of present) url.searchParams.delete(p);
    if (present.length) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    const leave = window.setTimeout(() => setPhase('leaving'), ms ?? (tone === 'ok' ? 2200 : 3500));
    const gone = window.setTimeout(() => setPhase('gone'), (ms ?? (tone === 'ok' ? 2200 : 3500)) + 300);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(gone);
    };
  }, [ms, tone]);
  if (phase === 'gone') return null;
  return (
    <div
      className={className}
      role={tone === 'err' ? 'alert' : 'status'}
      onClick={() => setPhase('leaving')}
      style={{ transition: 'opacity 0.3s ease, transform 0.3s ease', opacity: phase === 'leaving' ? 0 : 1, transform: phase === 'leaving' ? 'translateY(-4px)' : undefined }}
      onTransitionEnd={() => phase === 'leaving' && setPhase('gone')}
    >
      {children}
    </div>
  );
}
