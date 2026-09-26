// Facility kinds and their default rules. Staff can tune rules per facility.

export const INVENTORY_KINDS = ['laundry', 'sauna', 'parking'] as const;
export const SPACE_KINDS = ['common_room', 'gym', 'study_room', 'grill'] as const;
export const AMENITY_KINDS = [...INVENTORY_KINDS, ...SPACE_KINDS] as const;
export type AmenityKind = (typeof AMENITY_KINDS)[number];
export type SpaceKind = (typeof SPACE_KINDS)[number];

export function isAmenityKind(value: string): value is AmenityKind {
  return (AMENITY_KINDS as readonly string[]).includes(value);
}
export function isSpaceKind(value: string): value is SpaceKind {
  return (SPACE_KINDS as readonly string[]).includes(value);
}

export type Rules = {
  capacity: number;
  openHour: number;
  closeHour: number;
  turnStartHours: string | null;
  slotHours: number;
  maxHoursPerBooking: number;
  maxHoursPerWeek: number;
  advanceDays: number;
  cancelCutoffMinutes: number;
  maxRepeatWeeks: number;
};

export const DEFAULT_RULES: Record<AmenityKind, Rules> = {
  // One hour machine slots, 07:00 to 22:00.
  laundry: { capacity: 1, openHour: 7, closeHour: 22, turnStartHours: null, slotHours: 1, maxHoursPerBooking: 1, maxHoursPerWeek: 6, advanceDays: 7, cancelCutoffMinutes: 0, maxRepeatWeeks: 1 },
  // Two hour turns at 16, 18 and 20.
  sauna: { capacity: 6, openHour: 16, closeHour: 22, turnStartHours: '16,18,20', slotHours: 2, maxHoursPerBooking: 2, maxHoursPerWeek: 4, advanceDays: 7, cancelCutoffMinutes: 0, maxRepeatWeeks: 12 },
  parking: { capacity: 1, openHour: 0, closeHour: 24, turnStartHours: null, slotHours: 1, maxHoursPerBooking: 1, maxHoursPerWeek: 168, advanceDays: 365, cancelCutoffMinutes: 0, maxRepeatWeeks: 1 },
  common_room: { capacity: 20, openHour: 8, closeHour: 22, turnStartHours: null, slotHours: 1, maxHoursPerBooking: 4, maxHoursPerWeek: 6, advanceDays: 14, cancelCutoffMinutes: 0, maxRepeatWeeks: 12 },
  gym: { capacity: 6, openHour: 6, closeHour: 22, turnStartHours: null, slotHours: 1, maxHoursPerBooking: 2, maxHoursPerWeek: 6, advanceDays: 7, cancelCutoffMinutes: 0, maxRepeatWeeks: 12 },
  study_room: { capacity: 6, openHour: 8, closeHour: 22, turnStartHours: null, slotHours: 1, maxHoursPerBooking: 3, maxHoursPerWeek: 9, advanceDays: 14, cancelCutoffMinutes: 0, maxRepeatWeeks: 12 },
  grill: { capacity: 12, openHour: 10, closeHour: 22, turnStartHours: null, slotHours: 1, maxHoursPerBooking: 3, maxHoursPerWeek: 6, advanceDays: 14, cancelCutoffMinutes: 0, maxRepeatWeeks: 12 },
};

// Laundry and sauna limits count across every machine or sauna in the
// building; a space's limit counts that space only.
export function limitIsPerKind(kind: string): boolean {
  return kind === 'laundry' || kind === 'sauna';
}

export const MAX_REPEAT_WEEKS = 12;
