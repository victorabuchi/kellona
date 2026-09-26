const PATHS: Record<string, string> = {
  laundry: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM4 8h16M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM7 5.5h.01M10 5.5h.01',
  sauna: 'M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4M16 3c-1 1.5 1 2.5 0 4M3 11h18v9H3zM3 15h18',
  parking: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM9 17V7h4a3 3 0 0 1 0 6H9',
  common_room: 'M4 18v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5M2 18h20M6 11V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3M6 18v2M18 18v2',
  gym: 'M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12',
  study_room: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5ZM4 19a2 2 0 0 1 2-2h13v4H6a2 2 0 0 1-2-2ZM9 7h6',
  grill: 'M4 10h16a8 8 0 0 1-16 0ZM8 18l-2 4M16 18l2 4M9 3c-1 1.5 1 2.5 0 4M15 3c-1 1.5 1 2.5 0 4',
};

export default function KindIcon({ kind, size = 22 }: { kind: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[kind] ?? PATHS['common_room']} />
    </svg>
  );
}
