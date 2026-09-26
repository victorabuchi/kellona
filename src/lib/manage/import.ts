import type { OrgScope } from '../tenant/scope';
import type { ResidentRow } from './csv';

export type ImportResult = { created: number; updated: number; skipped: number };

// Creates missing buildings and apartments, then creates or updates residents
// by email. Residents not in the file are left alone.
export async function importResidents(scope: OrgScope, rows: ResidentRow[], allowedBuildingIds: string[] | null): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0 };
  const buildings = new Map((await scope.buildings.q().all()).map((b) => [b.name.toLowerCase(), b]));
  const units = new Map((await scope.units.q().all()).map((u) => [`${u.buildingId}|${u.code.toLowerCase()}`, u]));
  const residents = new Map((await scope.residents.q().all()).map((r) => [r.email, r]));

  for (const row of rows) {
    let building = buildings.get(row.building.toLowerCase());
    if (!building) {
      // Staff limited to some buildings cannot create new ones.
      if (allowedBuildingIds) {
        result.skipped += 1;
        continue;
      }
      building = await scope.buildings.create({ name: row.building, area: row.area });
      buildings.set(row.building.toLowerCase(), building);
    }
    if (allowedBuildingIds && !allowedBuildingIds.includes(building.id)) {
      result.skipped += 1;
      continue;
    }
    const unitKey = `${building.id}|${row.unit.toLowerCase()}`;
    let unit = units.get(unitKey);
    if (!unit) {
      unit = await scope.units.create({ buildingId: building.id, code: row.unit, floor: row.floor });
      units.set(unitKey, unit);
    }
    const existing = residents.get(row.email);
    if (existing) {
      await scope.residents.q().where({ id: existing.id }).update({ name: row.name, unitId: unit.id, status: 'active', externalRef: row.externalRef ?? existing.externalRef });
      result.updated += 1;
    } else {
      const created = await scope.residents.create({ name: row.name, email: row.email, unitId: unit.id, externalRef: row.externalRef });
      residents.set(row.email, created);
      result.created += 1;
    }
  }
  return result;
}
