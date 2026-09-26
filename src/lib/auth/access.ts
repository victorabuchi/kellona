import { redirect } from 'next/navigation';
import { requireOrg } from '../tenant/org';
import { orgScope, type OrgScope } from '../tenant/scope';
import type { OrgContext } from '../tenant/load';
import { getViewer, type Viewer } from './viewer';

export type StaffAccess = {
  org: OrgContext;
  scope: OrgScope;
  viewer: Extract<Viewer, { kind: 'admin' | 'staff' }>;
  // null means every building in the organization.
  buildingIds: string[] | null;
};

// Staff tools: organization managers and super-admins see every building,
// other staff only the buildings linked to them.
export async function requireStaff(): Promise<StaffAccess> {
  const org = await requireOrg();
  const viewer = await getViewer();
  if (!viewer || viewer.kind === 'resident') redirect('/');
  const scope = orgScope(org.id);
  if (viewer.kind === 'admin' || viewer.role === 'manager') return { org, scope, viewer, buildingIds: null };
  const links = await scope.staffBuildings.q().where({ staffId: viewer.id }).all();
  return { org, scope, viewer, buildingIds: links.map((l) => l.buildingId) };
}

export function canSeeBuilding(access: StaffAccess, buildingId: string): boolean {
  return access.buildingIds === null || access.buildingIds.includes(buildingId);
}

export async function requireStaffBuilding(buildingId: string): Promise<StaffAccess> {
  const access = await requireStaff();
  const building = await access.scope.buildings.q().where({ id: buildingId }).first();
  if (!building || !canSeeBuilding(access, buildingId)) redirect('/manage');
  return access;
}

export type ResidentAccess = { org: OrgContext; scope: OrgScope; viewer: Extract<Viewer, { kind: 'resident' }> };

export async function requireResident(): Promise<ResidentAccess> {
  const org = await requireOrg();
  const viewer = await getViewer();
  if (!viewer) redirect('/');
  if (viewer.kind !== 'resident') redirect('/manage');
  return { org, scope: orgScope(org.id), viewer };
}
