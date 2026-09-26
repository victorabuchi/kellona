// Resident import format. Headers are matched case-insensitively, in English
// or Finnish, and both comma and semicolon files (Finnish Excel) are accepted.

export type ResidentRow = { line: number; building: string; unit: string; name: string; email: string; floor: number | null; externalRef: string | null };
export type ParseResult = { rows: ResidentRow[]; errors: Array<{ line: number; reason: string }> };

const ALIASES: Record<keyof Omit<ResidentRow, 'line'>, string[]> = {
  building: ['building', 'rakennus', 'kohde', 'talo'],
  unit: ['apartment', 'unit', 'asunto', 'huoneisto'],
  name: ['name', 'nimi'],
  email: ['email', 'e-mail', 'sähköposti', 'sahkoposti'],
  floor: ['floor', 'kerros'],
  externalRef: ['external_id', 'externalid', 'id', 'tunnus'],
};

export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseResidentsCsv(text: string, maxRows = 5000): ParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((l) => l.trim() !== '');
  if (headerIndex < 0) return { rows: [], errors: [{ line: 1, reason: 'empty file' }] };
  const headerLine = lines[headerIndex]!;
  const delimiter = (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const headers = splitCsvLine(headerLine, delimiter).map((h) => h.toLowerCase());
  const col = Object.fromEntries(
    Object.entries(ALIASES).map(([key, names]) => [key, headers.findIndex((h) => names.includes(h))]),
  ) as Record<keyof typeof ALIASES, number>;
  const missing = (['building', 'unit', 'name', 'email'] as const).filter((k) => col[k] < 0);
  if (missing.length) return { rows: [], errors: [{ line: headerIndex + 1, reason: `missing columns: ${missing.join(', ')}` }] };

  const rows: ResidentRow[] = [];
  const errors: ParseResult['errors'] = [];
  const seen = new Set<string>();
  for (let i = headerIndex + 1; i < lines.length && rows.length < maxRows; i++) {
    if (!lines[i]!.trim()) continue;
    const cells = splitCsvLine(lines[i]!, delimiter);
    const get = (k: keyof typeof ALIASES) => (col[k] >= 0 ? (cells[col[k]] ?? '').trim() : '');
    const email = get('email').toLowerCase();
    const row = {
      line: i + 1,
      building: get('building').slice(0, 120),
      unit: get('unit').slice(0, 40),
      name: get('name').slice(0, 120),
      email,
      floor: Number.isInteger(Number.parseInt(get('floor'), 10)) ? Number.parseInt(get('floor'), 10) : null,
      externalRef: get('externalRef').slice(0, 80) || null,
    };
    if (!row.building || !row.unit || !row.name) errors.push({ line: row.line, reason: 'building, apartment and name are required' });
    else if (!EMAIL.test(email)) errors.push({ line: row.line, reason: 'invalid email' });
    else if (seen.has(email)) errors.push({ line: row.line, reason: 'duplicate email in file' });
    else {
      seen.add(email);
      rows.push(row);
    }
  }
  return { rows, errors };
}
