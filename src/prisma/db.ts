import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

// Only src/lib/tenant/scope.ts, platform code and tests should import this
// directly. Everything organization owned goes through orgScope().
// @ts-expect-error contract.d.ts omits `nullable` on to-one relation
// descriptors (emitter bug in @prisma/orm-postgres@8.0.0-rc.10). contract.json,
// which the runtime validates against, is correct.
export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
  // The runtime checks the contract marker once and keeps the result, so a
  // single dropped connection (the Supabase pooler closes idle ones) would fail
  // every later query until a restart. Drift is checked with `prisma db verify`
  // and by the migration commands instead.
  verifyMarker: false,
  // Close idle connections before the pooler does, and give up on a hung
  // connect instead of hanging the request.
  poolOptions: { idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 },
});
