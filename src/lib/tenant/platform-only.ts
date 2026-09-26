import { redirect } from 'next/navigation';
import { getCurrentOrg } from './org';

// Kellona level pages live on Kellona's own address. Opened on an
// organization's address, they move there (with the session) instead.
export async function ensurePlatformHost(path: string): Promise<void> {
  if (await getCurrentOrg()) redirect(`/platform/home?next=${encodeURIComponent(path)}`);
}
