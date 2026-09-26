import Link from 'next/link';
import { redirect } from 'next/navigation';
import Frame from '../../../../components/Frame';
import BrandEditor from '../../../../components/BrandEditor';
import styles from '../../../../components/app.module.css';
import { db } from '../../../../prisma/db';
import { getCurrentOrg } from '../../../../lib/tenant/org';
import { orgScope } from '../../../../lib/tenant/scope';
import { getT } from '../../../../lib/i18n';
import { ensurePlatformHost } from '../../../../lib/tenant/platform-only';
import { requireAdmin } from '../../../../lib/auth/viewer';
import { addDomainAction, removeDomainAction, saveBrandAction, saveOrgDetailsAction } from '../../../../lib/platform/actions';

export default async function OrgSettingsPage({ params, searchParams }: PageProps<'/platform/o/[orgId]'>) {
  const { orgId } = await params;
  const sp = await searchParams;
  await ensurePlatformHost(`/platform/o/${orgId}`);
  const viewer = await requireAdmin();
  const here = await getCurrentOrg();
  const { t, locale } = await getT(here);
  const org = await db.orm.public.Organization.where({ id: orgId }).first();
  if (!org) redirect('/platform');
  const scope = orgScope(org.id);
  const [brand, domains] = await Promise.all([scope.brand.q().first(), scope.domains.q().all()]);

  const text = (name: string, label: Parameters<typeof t>[0], value: string | null, type = 'text') => (
    <label className={styles.field} key={name}>
      {t(label)}
      <input className={styles.input} name={name} type={type} defaultValue={value ?? ''} />
    </label>
  );

  return (
    <Frame org={here} viewer={viewer} t={t} locale={locale} active={here?.id === org.id ? `/platform/o/${org.id}` : '/platform'} title={org.name}>
      <Link href="/platform" className={styles.muted}>
        {t('platform.title')}
      </Link>
      {sp['saved'] && <p className={styles.ok}>{t('brand.saved')}</p>}
      {sp['error'] && <p className={styles.alert}>{sp['error'] === 'file' ? t('brand.error') : t('platform.error')}</p>}
      <p>
        <a className={styles.btn} href={`/platform/open/${org.id}`}>
          {t('platform.open')}
        </a>
      </p>

      <section className={styles.card}>
        <h2 className={styles.h2}>{t('brand.title')}</h2>
        <BrandEditor
          action={saveBrandAction}
          orgId={org.id}
          initial={{ primary: brand?.primaryColor ?? '#2f5d8a', accent: brand?.accentColor ?? '#e0a526', logoLight: brand?.logoLightUrl ?? null, logoDark: brand?.logoDarkUrl ?? null, name: org.shortName }}
          labels={{
            primary: t('platform.primary'),
            accent: t('platform.accent'),
            logoLight: t('brand.logoLight'),
            logoDark: t('brand.logoDark'),
            icon: t('brand.icon'),
            hint: t('brand.fileHint'),
            suggest: t('brand.suggest'),
            preview: t('brand.preview'),
            save: t('manage.save'),
          }}
        />
      </section>

      <form action={saveOrgDetailsAction} className={styles.card}>
        <h2 className={styles.h2}>{t('brand.details')}</h2>
        <input type="hidden" name="id" value={org.id} />
        <div className={styles.form}>
          {text('name', 'manage.name', org.name)}
          {text('shortName', 'platform.shortName', org.shortName)}
          {text('legalName', 'platform.legalName', org.legalName)}
          {text('businessId', 'brand.businessId', org.businessId)}
          {text('address', 'manage.address', org.address)}
          {text('supportEmail', 'platform.supportEmail', org.supportEmail, 'email')}
          {text('privacyEmail', 'brand.privacyEmail', org.privacyEmail, 'email')}
          {text('senderName', 'brand.senderName', org.senderName)}
          <label className={styles.field}>
            {t('platform.defaultLocale')}
            <select className={styles.select} name="defaultLocale" defaultValue={org.defaultLocale}>
              <option value="fi">Suomi</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className={styles.field}>
            {t('brand.status')}
            <select className={styles.select} name="status" defaultValue={org.status}>
              <option value="pilot">pilot</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </select>
          </label>
          <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
            <label className={styles.check}>
              <input type="checkbox" name="locales" value="fi" defaultChecked={org.locales.includes('fi')} /> Suomi
            </label>
            <label className={styles.check}>
              <input type="checkbox" name="locales" value="en" defaultChecked={org.locales.includes('en')} /> English
            </label>
          </fieldset>
          <button className={styles.btn}>{t('manage.save')}</button>
        </div>
      </form>

      <section className={styles.card}>
        <h2 className={styles.h2}>{t('brand.domains')}</h2>
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{org.slug}.kellona.fi</span>
            </span>
          </li>
          {domains.map((d) => (
            <li key={d.id} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{d.host}</span>
              </span>
              <form action={removeDomainAction}>
                <input type="hidden" name="id" value={org.id} />
                <input type="hidden" name="domainId" value={d.id} />
                <button className={styles.btnDanger}>{t('manage.remove')}</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addDomainAction} className={styles.form}>
          <input type="hidden" name="id" value={org.id} />
          <label className={styles.field}>
            {t('brand.host')}
            <input className={styles.input} name="host" required />
          </label>
          <button className={styles.btn}>{t('brand.addDomain')}</button>
        </form>
      </section>
    </Frame>
  );
}
