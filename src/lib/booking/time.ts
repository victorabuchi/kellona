// Week and slot math in server local time. Production must run with
// TZ=Europe/Helsinki so a 18:00 turn stays 18:00 across daylight saving.

export function nowMs(): number {
  return Date.now();
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Monday 00:00 local of the week containing date.
export function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

export function dayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// From local parts, never toISOString, so the date does not shift a day in
// time zones ahead of UTC.
export function formatDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDay(value: string | undefined | null, fallback: Date): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return dayStart(fallback);
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dayStart(fallback) : d;
}

export function at(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// The same local wall clock time on following weeks.
export function weeklyStarts(first: Date, weeks: number): Date[] {
  return Array.from({ length: weeks }, (_, i) => addDays(first, 7 * i));
}

export function hh(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
