import webpush from 'web-push';
import type { OrgScope } from './tenant/scope';

export function pushConfigured(): boolean {
  return Boolean(process.env['VAPID_PUBLIC_KEY'] && process.env['VAPID_PRIVATE_KEY'] && process.env['VAPID_SUBJECT']);
}

let configured = false;
function ensure() {
  if (configured) return;
  webpush.setVapidDetails(process.env['VAPID_SUBJECT']!, process.env['VAPID_PUBLIC_KEY']!, process.env['VAPID_PRIVATE_KEY']!);
  configured = true;
}

export type PushPayload = { title: string; body: string; url?: string };

// Sends to every device of the resident. Returns how many deliveries worked;
// subscriptions the browser has dropped are removed.
export async function pushToResident(scope: OrgScope, residentId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  ensure();
  const subs = await scope.pushSubscriptions.q().where({ residentId }).all();
  let delivered = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload));
      delivered += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await scope.pushSubscriptions.q().where({ id: sub.id }).delete();
      else console.error('Push failed', status);
    }
  }
  return delivered;
}
