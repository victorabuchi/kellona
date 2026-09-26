#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/9ac4fe93d4849f49f4c71d108e9755c2761908ea0bfd5bb2ec339c4eab37fd7c/contract';
import startContract from '../../snapshots/9ac4fe93d4849f49f4c71d108e9755c2761908ea0bfd5bb2ec339c4eab37fd7c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/efd4acb77501028d39044f6763e951b790ed45b8e2b07d7ca78bed56c6a861b8/contract';
import endContract from '../../snapshots/efd4acb77501028d39044f6763e951b790ed45b8e2b07d7ca78bed56c6a861b8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'facility',
        column: col('maxRepeatWeeks', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
