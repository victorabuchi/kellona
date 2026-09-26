import type { OrgContext } from '../tenant/load';
import type { OrgScope } from '../tenant/scope';
import { pushToResident } from '../push';
import { sendEmail } from '../email';

// Push first; email when the resident has no working push subscription.
export async function notifyResident(
  org: OrgContext,
  scope: OrgScope,
  residentId: string,
  message: { title: string; body: string; url?: string },
): Promise<'push' | 'email' | 'none'> {
  const title = `${org.senderName}: ${message.title}`;
  if ((await pushToResident(scope, residentId, { title, body: message.body, url: message.url ?? '/booking' })) > 0) return 'push';
  const resident = await scope.residents.q().where({ id: residentId }).first();
  if (resident && (await sendEmail({ to: resident.email, senderName: org.senderName, subject: title, text: message.body }))) return 'email';
  return 'none';
}

export async function notifyInvitees(org: OrgContext, scope: OrgScope, residentIds: string[], body: string, title: string): Promise<void> {
  for (const id of residentIds) await notifyResident(org, scope, id, { title, body }).catch(() => undefined);
}
