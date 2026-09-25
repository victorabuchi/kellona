// Fails when application code queries an organization owned model directly
// instead of through orgScope(), which is what keeps tenants apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ORG_MODELS } from '../src/lib/tenant/scope';

const ROOT = join(import.meta.dirname, '..');
// Files allowed to reach these models directly, and why.
const ALLOWED: Record<string, string> = {
  'src/lib/tenant/scope.ts': 'the scope itself',
  'src/lib/tenant/load.ts': 'resolves the organization from a domain before any scope exists',
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

test('no direct queries on organization owned models outside the scope', () => {
  const pattern = new RegExp(`\\borm\\s*\\.\\s*public\\s*\\.\\s*(${ORG_MODELS.join('|')})\\b`);
  const offenders: string[] = [];
  for (const file of files(join(ROOT, 'src'))) {
    const rel = relative(ROOT, file);
    if (ALLOWED[rel]) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (pattern.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(offenders, [], `Use orgScope() instead:\n${offenders.join('\n')}`);
});
