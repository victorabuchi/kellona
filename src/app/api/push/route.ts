import { NextResponse } from 'next/server';
import { getCurrentOrg } from '../../../lib/tenant/org';
import { orgScope } from '../../../lib/tenant/scope';
import { getViewer } from '../../../lib/auth/viewer';

// Saves this device's push subscription for the signed in resident.
export async function POST(request: Request) {
  const org = await getCurrentOrg();
  const viewer = await getViewer();
  if (!org || viewer?.kind !== 'resident') return new NextResponse('Not signed in', { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  const endpoint = body?.endpoint ?? '';
  const p256dh = body?.keys?.p256dh ?? '';
  const auth = body?.keys?.auth ?? '';
  if (!endpoint.startsWith('https://') || !p256dh || !auth) return new NextResponse('Bad subscription', { status: 400 });

  const scope = orgScope(org.id);
  const existing = await scope.pushSubscriptions.q().where({ endpoint }).first();
  if (existing) await scope.pushSubscriptions.q().where({ id: existing.id }).update({ residentId: viewer.id, p256dh, auth });
  else await scope.pushSubscriptions.create({ residentId: viewer.id, endpoint, p256dh, auth });
  return NextResponse.json({ ok: true });
}
