#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/979fcc0709412b69a3aee25c8b260f1bf9931d502de6e1311aff5fd0ee7c61fb/contract';
import endContract from '../../snapshots/979fcc0709412b69a3aee25c8b260f1bf9931d502de6e1311aff5fd0ee7c61fb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/98070b863b3d2f12a3dd8f3ddf861fb269c7850531d24902c98904d5832bdb73/contract';
import startContract from '../../snapshots/98070b863b3d2f12a3dd8f3ddf861fb269c7850531d24902c98904d5832bdb73/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'building',
        column: col('area', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
