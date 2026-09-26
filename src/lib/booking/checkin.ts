// Check-in timing, pure so it is unit tested. A facility with
// checkInOpensMinutes = 0 does not use check-in.

export type CheckInRules = { checkInOpensMinutes: number; checkInGraceMinutes: number };
export type CheckInPhase = 'off' | 'notYet' | 'open' | 'checkedIn' | 'missed' | 'over';

export function checkInWindow(startsAt: string | Date, rules: CheckInRules): { opens: Date; closes: Date } {
  const start = new Date(startsAt).getTime();
  return { opens: new Date(start - rules.checkInOpensMinutes * 60_000), closes: new Date(start + rules.checkInGraceMinutes * 60_000) };
}

export function checkInPhase(b: { startsAt: string; endsAt: string; checkedInAt: string | null }, rules: CheckInRules, now: number): CheckInPhase {
  if (rules.checkInOpensMinutes <= 0) return 'off';
  if (new Date(b.endsAt).getTime() <= now) return 'over';
  if (b.checkedInAt) return 'checkedIn';
  const { opens, closes } = checkInWindow(b.startsAt, rules);
  if (now < opens.getTime()) return 'notYet';
  if (now <= closes.getTime()) return 'open';
  return 'missed';
}

// "In use" for everyone: checked in and the booking is running now.
export function isInUse(b: { startsAt: string; endsAt: string; checkedInAt: string | null }, now: number): boolean {
  return Boolean(b.checkedInAt) && new Date(b.startsAt).getTime() <= now && now < new Date(b.endsAt).getTime();
}
