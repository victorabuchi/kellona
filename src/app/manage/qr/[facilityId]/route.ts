import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { NextResponse } from 'next/server';
import { getCurrentOrg } from '../../../../lib/tenant/org';
import { orgScope } from '../../../../lib/tenant/scope';
import { getViewer } from '../../../../lib/auth/viewer';
import { orgBaseUrl } from '../../../../lib/tenant/urls';

// Printable QR code that opens this facility's booking page on the
// organization's own address.
export async function GET(_request: Request, ctx: RouteContext<'/manage/qr/[facilityId]'>) {
  const { facilityId } = await ctx.params;
  const org = await getCurrentOrg();
  const viewer = await getViewer();
  if (!org || !viewer || viewer.kind === 'resident') return new NextResponse('Not allowed', { status: 403 });
  const scope = orgScope(org.id);
  const facility = await scope.facilities.q().where({ id: facilityId }).first();
  if (!facility) return new NextResponse('Not found', { status: 404 });
  const primary = (await scope.domains.q().where({ isPrimary: true }).where((d) => d.verifiedAt.isNotNull()).first())?.host ?? null;
  const base = orgBaseUrl({ slug: org.slug, primaryHost: primary }, (await headers()).get('host'));
  const url = facility.kind === 'parking' ? `${base}/book/parking` : `${base}/book/f/${facility.id}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 2, width: 512 });
  return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `inline; filename="qr-${facility.name}.svg"` } });
}
