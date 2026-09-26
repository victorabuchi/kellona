import type { Metadata } from 'next';
import AppShell from '../../../components/AppShell';
import BrandEditor from '../../../components/BrandEditor';
import styles from '../../../components/app.module.css';
import { requireManager } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import { db } from '../../../prisma/db';
import { saveSettingsAction, saveSettingsBrandAction } from '../../../lib/manage/settings-actions';
import SupportEditors from '../../../components/SupportEditors';
import DomainManager from '../../../components/DomainManager';
import { addOwnDomainAction, makeOwnPrimaryAction, removeOwnDomainAction, verifyOwnDomainAction } from '../../../lib/manage/settings-actions';
import { cnameTarget } from '../../../lib/tenant/dns';
import { hostingAutomated } from '../../../lib/tenant/hosting';
import { fmtWhen } from '../../../lib/booking/format';
import Flash from '../../../components/Flash';

export const metadata: Metadata = { title: 'Settings' };

// The organization's own settings, for its managers and for super-admins.
// Web addresses need DNS work, so only Kellona (super-admins) change them.
export default async function SettingsPage({ searchParams }: PageProps<'/manage/settings'>) {
  const sp = await searchParams;
  const { org, scope, viewer } = await requireManager();
  const { t, locale } = await getT(org);
  const [row, brand, domains, contacts, articles] = await Promise.all([
    db.orm.public.Organization.where({ id: org.id }).first(),
    scope.brand.q().first(),
    scope.domains.q().all(),
    scope.contacts.q().orderBy((c) => c.sortOrder.asc()).all(),
    scope.help.q().orderBy((a) => a.sortOrder.asc()).all(),
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
      {sp['saved'] && <Flash className={styles.ok}>{t('settings.saved')}</Flash>}
      {sp['error'] === 'file' && <Flash className={styles.alert} tone="err">{t('brand.error')}</Flash>}

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

      <SupportEditors t={t} contacts={contacts} articles={articles} />

      <DomainManager
        t={t}
        domains={domains}
        fallbackHost={`${org.slug}.kellona.fi`}
        target={cnameTarget()}
        hidden={{}}
        actions={{ add: addOwnDomainAction, verify: verifyOwnDomainAction, primary: makeOwnPrimaryAction, remove: removeOwnDomainAction }}
        message={typeof sp['domain'] === 'string' ? sp['domain'] : typeof sp['error'] === 'string' && ['invalid', 'taken'].includes(sp['error']) ? sp['error'] : null}
        hostingNote={hostingAutomated() ? t('domain.hostingAuto') : isAdmin && domains[0] ? t('domain.hostingManual', { host: domains[0].host }) : null}
        fmt={(iso) => fmtWhen(iso, locale, org.timezone)}
      />
    </AppShell>
  );
}
