import { cache } from 'react';
import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { orgScope } from '../tenant/scope';
import { getCurrentOrg } from '../tenant/org';
import { readSession } from './session';

export type Viewer =
  | { kind: 'admin'; id: string; name: string; email: string }
  | { kind: 'resident'; id: string; orgId: string; name: string; email: string; unitId: string | null }
  | { kind: 'staff'; id: string; orgId: string; name: string; email: string; role: string };

// Who is signed in on this address. Resident and staff sessions are only valid
// on their own organization's host; platform admins are valid everywhere.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession();
  if (!session) return null;

  if (session.kind === 'admin') {
    const admin = await db.orm.public.PlatformAdmin.where({ id: session.adminId }).first();
    return admin ? { kind: 'admin', id: admin.id, name: admin.name, email: admin.email } : null;
  }

  const org = await getCurrentOrg();
  if (!org || org.id !== session.orgId) return null;
  const scope = orgScope(org.id);
  if (session.kind === 'resident') {
    const r = await scope.residents.q().where({ id: session.residentId }).first();
    if (!r || r.status !== 'active') return null;
    return { kind: 'resident', id: r.id, orgId: org.id, name: r.name, email: r.email, unitId: r.unitId };
  }
  const s = await scope.staff.q().where({ id: session.staffId }).first();
  return s ? { kind: 'staff', id: s.id, orgId: org.id, name: s.name, email: s.email, role: s.role } : null;
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/');
  return viewer;
}

export async function requireAdmin(): Promise<Extract<Viewer, { kind: 'admin' }>> {
  const viewer = await getViewer();
  if (viewer?.kind !== 'admin') redirect('/');
  return viewer;
}
