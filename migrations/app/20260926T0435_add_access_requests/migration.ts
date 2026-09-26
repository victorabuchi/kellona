#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/9196d5e05143767d0acbb2e009910c3674494b67c536d5432015a6326e594c58/contract';
import startContract from '../../snapshots/9196d5e05143767d0acbb2e009910c3674494b67c536d5432015a6326e594c58/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/98070b863b3d2f12a3dd8f3ddf861fb269c7850531d24902c98904d5832bdb73/contract';
import endContract from '../../snapshots/98070b863b3d2f12a3dd8f3ddf861fb269c7850531d24902c98904d5832bdb73/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'access_request',
        columns: [
          col('contactName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('locale', 'text', {
            notNull: true,
            default: lit('fi'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('residents', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('new'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'access_request',
        index: 'access_request_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
