import { DEFAULT_RULES, isAmenityKind, MAX_REPEAT_WEEKS, type Rules } from '../booking/kinds';

function int(formData: FormData, name: string, min: number, max: number): number | null {
  const raw = String(formData.get(name) ?? '').trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}

// Rule fields from a staff form. Blank fields fall back to `base`, which is the
// facility's current rules or the kind's defaults for a new facility.
export function readRules(formData: FormData, kind: string, base?: Rules): Rules {
  const fallback = base ?? (isAmenityKind(kind) ? DEFAULT_RULES[kind] : DEFAULT_RULES.common_room);
  const turnsRaw = formData.has('turnStartHours') ? String(formData.get('turnStartHours') ?? '').trim() : null;
  const turns =
    turnsRaw === null
      ? fallback.turnStartHours
      : turnsRaw
          .split(/[,\s]+/)
          .map((h) => Number.parseInt(h, 10))
          .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23)
          .join(',') || null;
  const openHour = int(formData, 'openHour', 0, 23) ?? fallback.openHour;
  let closeHour = int(formData, 'closeHour', 1, 24) ?? fallback.closeHour;
  if (closeHour <= openHour) closeHour = Math.min(24, openHour + 1);
  return {
    capacity: int(formData, 'capacity', 1, 500) ?? fallback.capacity,
    openHour,
    closeHour,
    turnStartHours: turns,
    slotHours: int(formData, 'slotHours', 1, 12) ?? fallback.slotHours,
    maxHoursPerBooking: int(formData, 'maxHoursPerBooking', 1, 24) ?? fallback.maxHoursPerBooking,
    maxHoursPerWeek: int(formData, 'maxHoursPerWeek', 1, 168) ?? fallback.maxHoursPerWeek,
    advanceDays: int(formData, 'advanceDays', 1, 365) ?? fallback.advanceDays,
    cancelCutoffMinutes: int(formData, 'cancelCutoffMinutes', 0, 10080) ?? fallback.cancelCutoffMinutes,
    maxRepeatWeeks: int(formData, 'maxRepeatWeeks', 1, MAX_REPEAT_WEEKS) ?? fallback.maxRepeatWeeks,
  };
}
