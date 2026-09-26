#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/52b0977688c1600170a6f3d2fd2280972b65f70be6bae4d2f2264167dcf415ee/contract';
import endContract from '../../snapshots/52b0977688c1600170a6f3d2fd2280972b65f70be6bae4d2f2264167dcf415ee/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/efd4acb77501028d39044f6763e951b790ed45b8e2b07d7ca78bed56c6a861b8/contract';
import startContract from '../../snapshots/efd4acb77501028d39044f6763e951b790ed45b8e2b07d7ca78bed56c6a861b8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'booking_release',
        columns: [
          col('endsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('facilityId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('releasedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('residentId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('startsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'slot_watch',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('facilityId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('residentId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('startsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'booking',
        column: col('checkInReminderSentAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'facility',
        column: col('checkInGraceMinutes', 'int4', {
          notNull: true,
          default: lit(15),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'facility',
        column: col('checkInOpensMinutes', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'slot_watch',
        constraint: 'slot_watch_facilityId_startsAt_residentId_key',
        columns: ['facilityId', 'startsAt', 'residentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_release',
        index: 'booking_release_facilityId_idx_3710d8c1',
        columns: ['facilityId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_release',
        index: 'booking_release_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_release',
        index: 'booking_release_organizationId_startsAt_idx_4d98ff60',
        columns: ['organizationId', 'startsAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'booking_release',
        index: 'booking_release_residentId_idx_9d41a33b',
        columns: ['residentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'slot_watch',
        index: 'slot_watch_facilityId_idx_3710d8c1',
        columns: ['facilityId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'slot_watch',
        index: 'slot_watch_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'slot_watch',
        index: 'slot_watch_residentId_idx_9d41a33b',
        columns: ['residentId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'booking_release',
        foreignKey: {
          name: 'booking_release_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'booking_release',
        foreignKey: {
          name: 'booking_release_facilityId_fkey',
          columns: ['facilityId'],
          references: { schema: 'public', table: 'facility', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'booking_release',
        foreignKey: {
          name: 'booking_release_residentId_fkey',
          columns: ['residentId'],
          references: { schema: 'public', table: 'resident', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'slot_watch',
        foreignKey: {
          name: 'slot_watch_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'slot_watch',
        foreignKey: {
          name: 'slot_watch_facilityId_fkey',
          columns: ['facilityId'],
          references: { schema: 'public', table: 'facility', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'slot_watch',
        foreignKey: {
          name: 'slot_watch_residentId_fkey',
          columns: ['residentId'],
          references: { schema: 'public', table: 'resident', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
