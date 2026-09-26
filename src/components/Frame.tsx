import AppShell from './AppShell';
import type { OrgContext } from '../lib/tenant/load';
import type { Viewer } from '../lib/auth/viewer';
import type { T } from '../lib/i18n';
import type { Locale } from '../lib/i18n/messages';

// Signed-in frame: the organization's branding on its own address, Kellona's
// on the platform address.
export default function Frame(props: { org: OrgContext | null; viewer: Viewer; t: T; locale: Locale; active: string; title: string; children: React.ReactNode }) {
  return (
    <AppShell org={props.org} viewer={props.viewer} t={props.t} active={props.active} title={props.title}>
      {props.children}
    </AppShell>
  );
}
