import type { Metadata } from 'next';
import AppShell from '../../../components/AppShell';
import BrandEditor from '../../../components/BrandEditor';
import styles from '../../../components/app.module.css';
import shell from '../../../components/shell.module.css';
import { requireManager } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import { db } from '../../../prisma/db';
import { saveSettingsAction, saveSettingsBrandAction } from '../../../lib/manage/settings-actions';
import { addDomainAction, removeDomainAction } from '../../../lib/platform/actions';

export const metadata: Metadata = { title: 'Settings' };

// The organization's own settings, for its managers and for super-admins.
// Web addresses need DNS work, so only Kellona (super-admins) change them.
export default async function SettingsPage({ searchParams }: PageProps<'/manage/settings'>) {
  const sp = await searchParams;
  const { org, scope, viewer } = await requireManager();
  const { t } = await getT(org);
  const [row, brand, domains] = await Promise.all([
    db.orm.public.Organization.where({ id: org.id }).first(),
    scope.brand.q().first(),
    scope.domains.q().all(),
  ]);
  const isAdmin = viewer.kind === 'admin';
  const text = (name: string, label: Parameters<typeof t>[0], value: string | null | undefined, type = 'text') => (
    <label className={styles.field} key={name}>
      {t(label)}
      <input className={styles.input} name={name} type={type} defaultValue={value ?? ''} />
    </label>
  );

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/manage/settings" title={t('settings.title')}>
      <p className={styles.lede}>{t('settings.lede')}</p>
      {sp['saved'] && <p className={styles.ok}>{t('settings.saved')}</p>}
      {sp['error'] && <p className={styles.alert}>{sp['error'] === 'file' ? t('brand.error') : t('platform.error')}</p>}

      <section className={styles.card}>
        <h2 className={styles.h2}>{t('brand.title')}</h2>
        <BrandEditor
          action={saveSettingsBrandAction}
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

      <form action={saveSettingsAction} className={styles.card}>
        <h2 className={styles.h2}>{t('settings.contact')}</h2>
        <div className={styles.form}>
          {text('name', 'manage.name', row?.name)}
          {text('shortName', 'platform.shortName', row?.shortName)}
          {text('legalName', 'platform.legalName', row?.legalName)}
          {text('businessId', 'brand.businessId', row?.businessId)}
          {text('address', 'manage.address', row?.address)}
          {text('supportEmail', 'platform.supportEmail', row?.supportEmail, 'email')}
          {text('supportPhone', 'common.support', row?.supportPhone, 'tel')}
          {text('privacyEmail', 'brand.privacyEmail', row?.privacyEmail, 'email')}
          {text('senderName', 'brand.senderName', row?.senderName)}
          <label className={styles.field} key="defaultLocale">
            {t('platform.defaultLocale')}
            <select className={styles.select} name="defaultLocale" defaultValue={row?.defaultLocale ?? 'fi'}>
              <option value="fi">Suomi</option>
              <option value="en">English</option>
            </select>
          </label>
          <fieldset className={styles.field} key="locales" style={{ border: 0, padding: 0, margin: 0 }}>
            <span>{t('settings.languages')}</span>
            <label className={styles.check}>
              <input type="checkbox" name="locales" value="fi" defaultChecked={row?.locales.includes('fi')} /> Suomi
            </label>
            <label className={styles.check}>
              <input type="checkbox" name="locales" value="en" defaultChecked={row?.locales.includes('en')} /> English
            </label>
          </fieldset>
          <button key="save" className={`${styles.btn} ${styles.full}`}>
            {t('manage.save')}
          </button>
        </div>
      </form>

      <section className={styles.card}>
        <h2 className={styles.h2}>{t('brand.domains')}</h2>
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.rowTitle}>{org.slug}.kellona.fi</span>
          </li>
          {domains.map((d) => (
            <li key={d.id} className={styles.row}>
              <span className={styles.rowTitle}>{d.host}</span>
              {isAdmin && (
                <form action={removeDomainAction}>
                  <input type="hidden" name="id" value={org.id} />
                  <input type="hidden" name="domainId" value={d.id} />
                  <input type="hidden" name="back" value="/manage/settings" />
                  <button className={styles.btnDanger}>{t('manage.remove')}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {isAdmin ? (
          <form action={addDomainAction} className={styles.form}>
            <input type="hidden" name="id" value={org.id} />
            <input type="hidden" name="back" value="/manage/settings" />
            <label className={styles.field}>
              {t('brand.host')}
              <input className={styles.input} name="host" required />
            </label>
            <button className={styles.btn}>{t('brand.addDomain')}</button>
          </form>
        ) : (
          <p className={shell.blockMeta} style={{ height: 'auto', padding: '10px 12px' }}>
            {t('settings.domainsNote')}
          </p>
        )}
      </section>
    </AppShell>
  );
}
