import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResidentsCsv, splitCsvLine } from '../src/lib/manage/csv';

test('splits quoted cells', () => {
  assert.deepEqual(splitCsvLine('a,"b, c","d ""q"""', ','), ['a', 'b, c', 'd "q"']);
});

test('parses English comma files', () => {
  const r = parseResidentsCsv('building,apartment,name,email,floor\nTalo A,A 1,Maija M,Maija@Example.com,2\n');
  assert.equal(r.errors.length, 0);
  assert.deepEqual(r.rows[0], { line: 2, building: 'Talo A', unit: 'A 1', name: 'Maija M', email: 'maija@example.com', floor: 2, externalRef: null });
});

test('parses Finnish semicolon files with BOM and reports bad rows', () => {
  const r = parseResidentsCsv('﻿Rakennus;Asunto;Nimi;Sähköposti;Tunnus\nA;1;Eka;eka@x.fi;123\nA;2;Toka;ei-sahkoposti\nA;3;Kolmas;eka@x.fi\n;4;Nelja;n@x.fi');
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.externalRef, '123');
  assert.deepEqual(r.errors.map((e) => e.line), [3, 4, 5]);
});

test('missing columns are reported', () => {
  const r = parseResidentsCsv('name,email\nA,a@b.fi');
  assert.equal(r.rows.length, 0);
  assert.match(r.errors[0]!.reason, /building, unit/);
});
