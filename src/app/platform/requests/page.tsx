import type { Metadata } from 'next';
import Frame from '../../../components/Frame';
import styles from '../../../components/app.module.css';
import { db } from '../../../prisma/db';
import { getCurrentOrg } from '../../../lib/tenant/org';
import { getT } from '../../../lib/i18n';
import { ensurePlatformHost } from '../../../lib/tenant/platform-only';
import { requireAdmin } from '../../../lib/auth/viewer';

export const metadata: Metadata = { title: 'Pilot requests' };

export default async function RequestsPage() {
  await ensurePlatformHost('/platform/requests');
  const viewer = await requireAdmin();
  const here = await getCurrentOrg();
  const { t, locale } = await getT(here);
  const requests = await db.orm.public.AccessRequest.orderBy((r) => r.createdAt.desc()).limit(200).all();
  return (
    <Frame org={here} viewer={viewer} t={t} locale={locale} active="/platform/requests" title={t('platform.requests')}>
      <p className={styles.lede}>{t('platform.requestsLede')}</p>
      {requests.length === 0 ? (
        <p className={styles.empty}>{t('platform.noRequests')}</p>
      ) : (
        <ul className={styles.list}>
          {requests.map((r) => (
            <li key={r.id} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{r.organizationName}</span>
                <span className={styles.muted}>
                  {r.contactName} · <a href={`mailto:${r.email}`}>{r.email}</a>
                  {r.phone ? ` · ${r.phone}` : ''}
                  {r.residents ? ` · ${r.residents}` : ''} · {r.createdAt.slice(0, 10)}
                </span>
                {r.message && <span className={styles.muted}>{r.message}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
