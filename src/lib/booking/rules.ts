import { addDays, weekStart } from './time';
import type { Rules } from './kinds';

// Pure booking rules, shared by the server actions and the unit tests.

export type RuleError = 'invalid' | 'past' | 'tooFar' | 'closed' | 'tooLong' | 'taken' | 'mine' | 'weekly' | 'capacity' | 'outsider' | 'notAvailable' | 'notFound';

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function turnHours(rules: Pick<Rules, 'turnStartHours'>): number[] | null {
  if (!rules.turnStartHours) return null;
  const hours = rules.turnStartHours
    .split(',')
    .map((h) => Number.parseInt(h.trim(), 10))
    .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
  return hours.length ? [...new Set(hours)].sort((a, b) => a - b) : null;
}

// Start hours offered in a day, and the fixed length when turns are used.
export function startHours(rules: Rules): number[] {
  const turns = turnHours(rules);
  if (turns) return turns;
  const out: number[] = [];
  for (let h = rules.openHour; h < rules.closeHour; h++) out.push(h);
  return out;
}

export function lengthOptions(rules: Rules, startHour: number): number[] {
  if (turnHours(rules)) return [rules.slotHours];
  const max = Math.min(rules.maxHoursPerBooking, rules.closeHour - startHour);
  return Array.from({ length: Math.max(0, max) }, (_, i) => i + 1);
}

// Checks one booking against the facility's hours. `ignoreAdvance` is used for
// later weeks of a standing weekly turn.
export function checkSlot(rules: Rules, start: Date, hours: number, now: number, ignoreAdvance = false): RuleError | null {
  if (Number.isNaN(start.getTime()) || start.getMinutes() !== 0 || start.getSeconds() !== 0 || !Number.isInteger(hours) || hours < 1) return 'invalid';
  if (start.getTime() < now) return 'past';
  if (!ignoreAdvance && start.getTime() > addDays(new Date(now), rules.advanceDays).getTime()) return 'tooFar';
  const h = start.getHours();
  const turns = turnHours(rules);
  if (turns) {
    if (!turns.includes(h) || hours !== rules.slotHours) return 'closed';
    return null;
  }
  if (hours > rules.maxHoursPerBooking) return 'tooLong';
  if (h < rules.openHour || h + hours > rules.closeHour) return 'closed';
  return null;
}

export type Busy = { start: number; end: number; residentId: string };

// Hours the resident already holds in the week of `start`.
export function hoursInWeek(busy: Busy[], residentId: string, start: Date): number {
  const from = weekStart(start).getTime();
  const to = addDays(weekStart(start), 7).getTime();
  return busy
    .filter((b) => b.residentId === residentId && b.start >= from && b.start < to)
    .reduce((sum, b) => sum + (b.end - b.start) / 3_600_000, 0);
}

// Minutes after booking during which a booking can always be undone, even
// inside the cutoff, so a mistaken tap is never stuck.
export const UNDO_MINUTES = 10;

// A booking can be cancelled until the facility's cutoff before it starts, or
// within UNDO_MINUTES of being made, as long as it has not started.
export function canCancel(startsAt: string | Date, cutoffMinutes: number, now: number, createdAt?: string | Date | null): boolean {
  const start = new Date(startsAt).getTime();
  if (start <= now) return false;
  if (createdAt && now - new Date(createdAt).getTime() < UNDO_MINUTES * 60_000) return true;
  return start - now >= Math.max(0, cutoffMinutes) * 60_000;
}

// The moment after which a booking can no longer be cancelled.
export function cancelDeadline(startsAt: string | Date, cutoffMinutes: number): Date {
  return new Date(new Date(startsAt).getTime() - Math.max(0, cutoffMinutes) * 60_000);
}
