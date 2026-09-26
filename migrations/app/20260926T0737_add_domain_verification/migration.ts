#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/979fcc0709412b69a3aee25c8b260f1bf9931d502de6e1311aff5fd0ee7c61fb/contract';
import startContract from '../../snapshots/979fcc0709412b69a3aee25c8b260f1bf9931d502de6e1311aff5fd0ee7c61fb/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/dc4224d61596714e942044e7976ac6bcb0f406cde72311071af03f4775faa8c1/contract';
import endContract from '../../snapshots/dc4224d61596714e942044e7976ac6bcb0f406cde72311071af03f4775faa8c1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'org_domain',
        column: col('lastCheckedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'org_domain',
        column: col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'org_domain',
        column: col('verificationToken', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'org_domain',
        column: col('verifiedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
