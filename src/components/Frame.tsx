import AppShell from './AppShell';
import AuthShell from './AuthShell';
import styles from './app.module.css';
import type { OrgContext } from '../lib/tenant/load';
import type { Viewer } from '../lib/auth/viewer';
import type { T } from '../lib/i18n';
import type { Locale } from '../lib/i18n/messages';

// App shell when the address belongs to an organization, otherwise the plain
// Kellona frame (super-admin pages on a platform host).
export default function Frame(props: { org: OrgContext | null; viewer: Viewer; t: T; locale: Locale; active: string; title: string; children: React.ReactNode }) {
  if (props.org) return <AppShell org={props.org} viewer={props.viewer} t={props.t} active={props.active} title={props.title}>{props.children}</AppShell>;
  return (
    <AuthShell org={null} t={props.t} locale={props.locale} back={props.active} wide>
      <h1 className={styles.title}>{props.title}</h1>
      {props.children}
    </AuthShell>
  );
}
