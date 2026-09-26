import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import styles from '../../../components/app.module.css';
import shell from '../../../components/shell.module.css';
import { requireResident } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';

export const metadata: Metadata = { title: 'Contact' };

// Contacts are organization data, edited by its managers in Settings.
export default async function ContactPage() {
  const { org, scope, viewer } = await requireResident();
  const { t } = await getT(org);
  const contacts = await scope.contacts.q().orderBy((c) => c.sortOrder.asc()).all();
  const sorted = [...contacts.filter((c) => c.emergency), ...contacts.filter((c) => !c.emergency)];
  const tel = (p: string) => `tel:${p.replace(/[^+\d]/g, '')}`;
  return (
    <AppShell org={org} viewer={viewer} t={t} active="/booking/contact" title={t('contact.title')}>
      <p className={styles.lede}>{t('contact.lede')}</p>
      {sorted.length === 0 ? (
        <p className={styles.empty}>{t('contact.none')}</p>
      ) : (
        <div className={shell.grid}>
          {sorted.map((c) => (
            <div key={c.id} className={`${shell.contactCard} ${c.emergency ? shell.contactEmergency : ''}`}>
              <div>
                {c.emergency && <span className={`${shell.badge} ${shell.badgePending}`}>{t('contact.emergency')}</span>}
                <h2>{c.title}</h2>
                {c.description && <p>{c.description}</p>}
                {c.hours && <p className={shell.contactHours}>{c.hours}</p>}
              </div>
              <div className={shell.contactActions}>
                {c.phone && (
                  <a className={c.emergency ? shell.primary : shell.ghost} href={tel(c.phone)}>
                    {t('contact.call')} {c.phone}
                  </a>
                )}
                {c.email && (
                  <a className={shell.ghost} href={`mailto:${c.email}`}>
                    {c.email}
                  </a>
                )}
                {c.url && (
                  <a className={shell.ghost} href={c.url} target="_blank" rel="noreferrer">
                    {t('contact.web')}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Link href="/booking/report" className={shell.ghost} style={{ alignSelf: 'flex-start' }}>
        {t('contact.reportInstead')}
      </Link>
    </AppShell>
  );
}
