import { NextResponse } from 'next/server';
import { getCurrentOrg } from '../../../../lib/tenant/org';
import { orgScope } from '../../../../lib/tenant/scope';
import { getViewer } from '../../../../lib/auth/viewer';

function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

// One booking as an .ics file, for the booker and accepted guests.
export async function GET(_request: Request, ctx: RouteContext<'/book/ics/[bookingId]'>) {
  const { bookingId } = await ctx.params;
  const org = await getCurrentOrg();
  const viewer = await getViewer();
  if (!org || viewer?.kind !== 'resident') return new NextResponse('Not signed in', { status: 401 });
  const scope = orgScope(org.id);
  const booking = await scope.bookings.q().where({ id: bookingId }).include('facility', (f) => f).first();
  const guest = booking ? await scope.participants.q().where({ bookingId, residentId: viewer.id, status: 'accepted' }).first() : null;
  if (!booking || (booking.residentId !== viewer.id && !guest)) return new NextResponse('Not found', { status: 404 });

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kellona//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@kellona`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(booking.startsAt)}`,
    `DTEND:${stamp(booking.endsAt)}`,
    `SUMMARY:${escape(`${booking.facility!.name} (${org.shortName})`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
  return new NextResponse(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="booking-${booking.id.slice(0, 8)}.ics"` },
  });
}
