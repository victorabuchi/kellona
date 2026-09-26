import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSlot, hoursInWeek, lengthOptions, overlaps, startHours } from '../src/lib/booking/rules';
import { DEFAULT_RULES } from '../src/lib/booking/kinds';
import { at, formatDay, parseDay, weekStart, weeklyStarts } from '../src/lib/booking/time';
import { resolveAmenities } from '../src/lib/booking/engine';

test('runs in Helsinki time', () => {
  assert.equal(process.env['TZ'], 'Europe/Helsinki');
});

test('weekly turns keep the local hour across the October daylight saving change', () => {
  const first = new Date(2026, 9, 18, 18, 0, 0); // Sunday 18 Oct 2026 18:00, DST ends 25 Oct
  const starts = weeklyStarts(first, 3);
  assert.deepEqual(starts.map((d) => d.getHours()), [18, 18, 18]);
  assert.equal(starts[1]!.getTime() - starts[0]!.getTime(), 7 * 86_400_000 + 3_600_000);
});

test('week start is Monday and day params use local dates', () => {
  const sunday = new Date(2026, 8, 27, 23, 30);
  assert.equal(formatDay(weekStart(sunday)), '2026-09-21');
  assert.equal(formatDay(parseDay('2026-10-25', new Date())), '2026-10-25');
  assert.equal(formatDay(parseDay('garbage', new Date(2026, 0, 2, 15))), '2026-01-02');
});

test('slot rules', () => {
  const now = new Date(2026, 8, 26, 12).getTime();
  const day = new Date(2026, 8, 27);
  const laundry = DEFAULT_RULES.laundry;
  assert.equal(checkSlot(laundry, at(day, 10), 1, now), null);
  assert.equal(checkSlot(laundry, at(day, 6), 1, now), 'closed');
  assert.equal(checkSlot(laundry, at(day, 21), 2, now), 'tooLong');
  assert.equal(checkSlot(laundry, new Date(2026, 8, 26, 11), 1, now), 'past');
  assert.equal(checkSlot(laundry, at(new Date(2026, 9, 5), 10), 1, now), 'tooFar');
  assert.equal(checkSlot(laundry, at(new Date(2026, 9, 5), 10), 1, now, true), null);
  assert.equal(checkSlot(laundry, new Date(2026, 8, 27, 10, 30), 1, now), 'invalid');
  const sauna = DEFAULT_RULES.sauna;
  assert.deepEqual(startHours(sauna), [16, 18, 20]);
  assert.equal(checkSlot(sauna, at(day, 18), 2, now), null);
  assert.equal(checkSlot(sauna, at(day, 17), 2, now), 'closed');
  assert.deepEqual(lengthOptions(DEFAULT_RULES.common_room, 20), [1, 2]);
  assert.deepEqual(lengthOptions(sauna, 16), [2]);
});

test('overlaps and weekly hours', () => {
  assert.ok(overlaps(0, 10, 5, 15));
  assert.ok(!overlaps(0, 10, 10, 20));
  const monday = new Date(2026, 8, 28, 10);
  const busy = [
    { start: monday.getTime(), end: monday.getTime() + 2 * 3_600_000, residentId: 'a' },
    { start: monday.getTime() + 86_400_000, end: monday.getTime() + 86_400_000 + 3_600_000, residentId: 'a' },
    { start: monday.getTime(), end: monday.getTime() + 3_600_000, residentId: 'b' },
    { start: monday.getTime() - 7 * 86_400_000, end: monday.getTime() - 7 * 86_400_000 + 3_600_000, residentId: 'a' },
  ];
  assert.equal(hoursInWeek(busy, 'a', new Date(2026, 9, 1, 12)), 3);
});

test('availability: automatic, building switch and apartment exception', () => {
  const counts = { sauna: 1, laundry: 2 };
  const get = (rows: ReturnType<typeof resolveAmenities>, kind: string) => rows.find((r) => r.kind === kind)!;
  let rows = resolveAmenities(counts, [], []);
  assert.equal(get(rows, 'sauna').available, true);
  assert.equal(get(rows, 'gym').available, false);
  rows = resolveAmenities(counts, [{ kind: 'sauna', enabled: false }], []);
  assert.equal(get(rows, 'sauna').available, false);
  rows = resolveAmenities(counts, [{ kind: 'sauna', enabled: false }], [{ kind: 'sauna', enabled: true }]);
  assert.equal(get(rows, 'sauna').available, true);
  assert.equal(get(rows, 'sauna').source, 'unit');
  rows = resolveAmenities(counts, [], [{ kind: 'laundry', enabled: false }]);
  assert.equal(get(rows, 'laundry').available, false);
  rows = resolveAmenities({}, [{ kind: 'gym', enabled: true }], []);
  assert.equal(get(rows, 'gym').available, false, 'yes without a facility is still unavailable');
});
