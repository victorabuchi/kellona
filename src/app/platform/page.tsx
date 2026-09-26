import AuthShell from '../../components/AuthShell';
import styles from '../../components/auth.module.css';
import { db } from '../../prisma/db';
import { getCurrentOrg } from '../../lib/tenant/org';
import { getT } from '../../lib/i18n';
import { requireAdmin } from '../../lib/auth/viewer';
import { hostConfigFromEnv } from '../../lib/tenant/host';

// Super-admin home. The onboarding wizard is added here in the next milestone.
export default async function PlatformPage() {
  await requireAdmin();
  const org = await getCurrentOrg();
  const { t, locale } = await getT(org);
  const orgs = await db.orm.public.Organization.orderBy((o) => o.name.asc()).include('domains', (d) => d).all();
  const config = hostConfigFromEnv();
  const base = config.production ? config.platformDomains[0] : 'localhost:3000';
  const proto = config.production ? 'https' : 'http';

  return (
    <AuthShell org={org} t={t} locale={locale} back="/platform" wide>
      <h1 className={styles.titleDoc}>{t('platform.title')}</h1>
      <p className={styles.lede}>{t('platform.lede')}</p>
      <ul className={styles.list}>
        {orgs.map((o) => {
          const host = o.domains.find((d) => d.isPrimary)?.host ?? `${o.slug}.${base}`;
          const url = `${proto}://${host}${!config.production && !host.includes(':') ? ':3000' : ''}/`;
          return (
            <li key={o.id} className={styles.listRow}>
              <span className={styles.listText}>
                <strong>{o.name}</strong>
                <span className={styles.hint}>
                  {o.slug} · {o.status}
                  {o.isDemo ? ` · ${t('platform.demo')}` : ''}
                </span>
              </span>
              <a className={styles.smallButton} href={url}>
                {t('platform.open')}
              </a>
            </li>
          );
        })}
      </ul>
    </AuthShell>
  );
}
