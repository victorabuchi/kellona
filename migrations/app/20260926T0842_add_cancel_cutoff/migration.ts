#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9ac4fe93d4849f49f4c71d108e9755c2761908ea0bfd5bb2ec339c4eab37fd7c/contract';
import endContract from '../../snapshots/9ac4fe93d4849f49f4c71d108e9755c2761908ea0bfd5bb2ec339c4eab37fd7c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/dc4224d61596714e942044e7976ac6bcb0f406cde72311071af03f4775faa8c1/contract';
import startContract from '../../snapshots/dc4224d61596714e942044e7976ac6bcb0f406cde72311071af03f4775faa8c1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'facility',
        column: col('cancelCutoffMinutes', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
