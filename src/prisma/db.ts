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
});
