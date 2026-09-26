import type { Metadata } from 'next';
import Frame from '../../components/Frame';
import Modal from '../../components/Modal';
import OrgGrid from '../../components/OrgGrid';
import styles from '../../components/app.module.css';
import shell from '../../components/shell.module.css';
import { db } from '../../prisma/db';
import { getCurrentOrg } from '../../lib/tenant/org';
import { orgScope } from '../../lib/tenant/scope';
import { getT } from '../../lib/i18n';
import { ensurePlatformHost } from '../../lib/tenant/platform-only';
import { requireAdmin } from '../../lib/auth/viewer';
import { createOrgAction } from '../../lib/platform/actions';
import { DEFAULT_BRAND } from '../../lib/brand/defaults';

export const metadata: Metadata = { title: 'Organizations' };

export default async function PlatformPage({ searchParams }: PageProps<'/platform'>) {
  const sp = await searchParams;
  await ensurePlatformHost('/platform');
  const viewer = await requireAdmin();
  const here = await getCurrentOrg();
  const { t, locale } = await getT(here);
  const orgs = await db.orm.public.Organization.orderBy((o) => o.name.asc()).include('brand', (b) => b).all();
  const counts = await Promise.all(orgs.map(async (o) => (await orgScope(o.id).buildings.q().all()).length));
  const openForm = Boolean(sp['new'] || sp['error']);

  const field = (name: string, label: Parameters<typeof t>[0], opts: { type?: string; required?: boolean; hint?: string; pattern?: string } = {}) => (
    <label className={styles.field} key={name}>
      {t(label)}
      <input className={styles.input} name={name} type={opts.type ?? 'text'} required={opts.required} pattern={opts.pattern} />
      {opts.hint && <span className={styles.hint}>{opts.hint}</span>}
    </label>
  );

  return (
    <Frame org={here} viewer={viewer} t={t} locale={locale} active="/platform" title={t('platform.yours')}>
      <p className={styles.lede}>{t('platform.lede')}</p>
      <OrgGrid
        orgs={orgs.map((o, i) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          status: o.status,
          isDemo: o.isDemo,
          color: o.brand?.primaryColor ?? DEFAULT_BRAND.primaryColor,
          icon: o.brand?.appIconUrl ?? o.brand?.faviconUrl ?? null,
          buildings: t('platform.buildingsCount', { n: counts[i]! }),
        }))}
        labels={{ search: t('platform.search'), noMatch: t('platform.noMatch'), open: t('platform.open'), settings: t('platform.edit'), demo: t('platform.demo') }}
        action={
          <Modal
            key="new-org"
            title={t('nav.newOrg')}
            description={t('platform.newLede')}
            triggerClass={shell.primary}
            openInitially={openForm}
            trigger={
              <span key="trigger" style={{ display: 'contents' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t('nav.newOrg')}
              </span>
            }
          >
            <form action={createOrgAction} className={styles.form}>
              {sp['error'] && (
                <p key="error" className={`${styles.alert} ${styles.full}`}>
                  {t('platform.error')}
                </p>
              )}
              {field('name', 'manage.name', { required: true })}
              {field('shortName', 'platform.shortName')}
              {field('slug', 'platform.slug', { required: true, pattern: '[a-z0-9][a-z0-9-]*[a-z0-9]', hint: t('platform.slugHint') })}
              {field('legalName', 'platform.legalName')}
              {field('supportEmail', 'platform.supportEmail', { type: 'email' })}
              <label className={styles.field} key="defaultLocale">
                {t('platform.defaultLocale')}
                <select className={styles.select} name="defaultLocale" defaultValue="fi">
                  <option value="fi">Suomi</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className={styles.field} key="primaryColor">
                {t('platform.primary')}
                <input className={styles.swatch} type="color" name="primaryColor" defaultValue="#2f5d8a" />
              </label>
              <label className={styles.field} key="accentColor">
                {t('platform.accent')}
                <input className={styles.swatch} type="color" name="accentColor" defaultValue="#e0a526" />
              </label>
              <button key="submit" className={`${styles.btn} ${styles.full}`}>
                {t('platform.createButton')}
              </button>
            </form>
          </Modal>
        }
      />
    </Frame>
  );
}
