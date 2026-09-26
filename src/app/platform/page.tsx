import type { Metadata } from 'next';
import Link from 'next/link';
import Frame from '../../components/Frame';
import styles from '../../components/app.module.css';
import { db } from '../../prisma/db';
import { getCurrentOrg } from '../../lib/tenant/org';
import { getT } from '../../lib/i18n';
import { requireAdmin } from '../../lib/auth/viewer';
import { createOrgAction } from '../../lib/platform/actions';

export const metadata: Metadata = { title: 'Platform' };

export default async function PlatformPage({ searchParams }: PageProps<'/platform'>) {
  const { error } = await searchParams;
  const viewer = await requireAdmin();
  const org = await getCurrentOrg();
  const { t, locale } = await getT(org);
  const orgs = await db.orm.public.Organization.orderBy((o) => o.name.asc()).all();

  return (
    <Frame org={org} viewer={viewer} t={t} locale={locale} active="/platform" title={t('platform.title')}>
      <p className={styles.lede}>{t('platform.lede')}</p>
      <ul className={styles.list}>
        {orgs.map((o) => (
          <li key={o.id} className={styles.row}>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{o.name}</span>
              <span className={styles.muted}>
                {o.slug} · {o.status}
                {o.isDemo ? ` · ${t('platform.demo')}` : ''}
              </span>
            </span>
            <span className={styles.actions}>
              <Link className={styles.btnGhost} href={`/platform/o/${o.id}`}>
                {t('platform.edit')}
              </Link>
              {/* A plain link: the route hands the session over to the other address. */}
              <a className={styles.btn} href={`/platform/open/${o.id}`}>
                {t('platform.open')}
              </a>
            </span>
          </li>
        ))}
      </ul>

      <form action={createOrgAction} className={styles.card}>
        <h2 className={styles.h2}>{t('platform.create')}</h2>
        {error && <p className={styles.alert}>{t('platform.error')}</p>}
        <div className={styles.form}>
          <label className={styles.field}>
            {t('manage.name')}
            <input className={styles.input} name="name" required maxLength={120} />
          </label>
          <label className={styles.field}>
            {t('platform.shortName')}
            <input className={styles.input} name="shortName" maxLength={40} />
          </label>
          <label className={styles.field}>
            {t('platform.slug')}
            <input className={styles.input} name="slug" required pattern="[a-z0-9][a-z0-9-]*[a-z0-9]" maxLength={50} />
            <span className={styles.hint}>{t('platform.slugHint')}</span>
          </label>
          <label className={styles.field}>
            {t('platform.legalName')}
            <input className={styles.input} name="legalName" maxLength={200} />
          </label>
          <label className={styles.field}>
            {t('platform.supportEmail')}
            <input className={styles.input} name="supportEmail" type="email" />
          </label>
          <label className={styles.field}>
            {t('platform.defaultLocale')}
            <select className={styles.select} name="defaultLocale" defaultValue="fi">
              <option value="fi">Suomi</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className={styles.field}>
            {t('platform.primary')}
            <input className={styles.swatch} type="color" name="primaryColor" defaultValue="#2f5d8a" />
          </label>
          <label className={styles.field}>
            {t('platform.accent')}
            <input className={styles.swatch} type="color" name="accentColor" defaultValue="#e0a526" />
          </label>
          <button className={styles.btn}>{t('platform.createButton')}</button>
        </div>
      </form>
    </Frame>
  );
}
