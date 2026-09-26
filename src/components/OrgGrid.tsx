'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './shell.module.css';

export type OrgCardData = {
  id: string;
  name: string;
  slug: string;
  status: string;
  isDemo: boolean;
  color: string;
  icon: string | null;
  buildings: string;
};

// Searchable grid of organization cards.
export default function OrgGrid({
  orgs,
  labels,
  action,
}: {
  orgs: OrgCardData[];
  labels: { search: string; noMatch: string; open: string; settings: string; demo: string };
  action: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = query ? orgs.filter((o) => `${o.name} ${o.slug}`.toLowerCase().includes(query)) : orgs;
  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.search} aria-label={labels.search} />
        </label>
        {action}
      </div>
      {shown.length === 0 ? (
        <p className={styles.emptyState}>{labels.noMatch}</p>
      ) : (
        <div className={styles.grid}>
          {shown.map((o) => (
            <div key={o.id} className={styles.orgCard} style={{ ['--card' as string]: o.color }}>
              <div className={styles.orgTop}>
                <span className={styles.orgMark}>
                  {o.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.icon} alt="" />
                  ) : (
                    o.name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className={styles.orgName} style={{ display: 'block' }}>
                    {o.name}
                  </span>
                  <span className={styles.orgMeta}>
                    <span className={`${styles.badge} ${o.status === 'active' ? styles.badgeLive : ''}`}>{o.status}</span>
                    {o.isDemo && <span className={styles.badge}>{labels.demo}</span>}
                    <span className={styles.badge}>{o.buildings}</span>
                  </span>
                </span>
              </div>
              <div className={styles.orgActions}>
                <Link href={`/platform/o/${o.id}`} className={styles.ghost}>
                  {labels.settings}
                </Link>
                {/* Plain link: the route hands the session over to the organization's address. */}
                <a href={`/platform/open/${o.id}`} className={styles.cardPrimary}>
                  {labels.open}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
