import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkInPhase, checkInWindow, isInUse } from '../src/lib/booking/checkin';

const rules = { checkInOpensMinutes: 20, checkInGraceMinutes: 15 };
const b = (checkedInAt: string | null = null) => ({ startsAt: '2026-09-28T11:00:00.000Z', endsAt: '2026-09-28T12:00:00.000Z', checkedInAt });
const at = (iso: string) => new Date(iso).getTime();

test('window opens 20 min before and closes 15 min after the start', () => {
  const w = checkInWindow(b().startsAt, rules);
  assert.equal(w.opens.toISOString(), '2026-09-28T10:40:00.000Z');
  assert.equal(w.closes.toISOString(), '2026-09-28T11:15:00.000Z');
});

test('phases over time', () => {
  assert.equal(checkInPhase(b(), rules, at('2026-09-28T10:39:00Z')), 'notYet');
  assert.equal(checkInPhase(b(), rules, at('2026-09-28T10:40:00Z')), 'open');
  assert.equal(checkInPhase(b(), rules, at('2026-09-28T11:15:00Z')), 'open');
  assert.equal(checkInPhase(b(), rules, at('2026-09-28T11:15:01Z')), 'missed');
  assert.equal(checkInPhase(b('2026-09-28T10:50:00Z'), rules, at('2026-09-28T11:30:00Z')), 'checkedIn');
  assert.equal(checkInPhase(b(), rules, at('2026-09-28T12:00:00Z')), 'over');
  assert.equal(checkInPhase(b(), { checkInOpensMinutes: 0, checkInGraceMinutes: 15 }, at('2026-09-28T11:30:00Z')), 'off');
});

test('in use only while checked in and running', () => {
  assert.equal(isInUse(b('2026-09-28T10:50:00Z'), at('2026-09-28T11:10:00Z')), true);
  assert.equal(isInUse(b('2026-09-28T10:50:00Z'), at('2026-09-28T10:55:00Z')), false);
  assert.equal(isInUse(b(), at('2026-09-28T11:10:00Z')), false);
});
