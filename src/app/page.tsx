import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '../components/AuthShell';
import SignInForm from '../components/SignInForm';
import Landing from '../components/landing/Landing';
import styles from '../components/auth.module.css';
import { getCurrentOrg, onPlatformHost } from '../lib/tenant/org';
import { getT } from '../lib/i18n';
import { getViewer } from '../lib/auth/viewer';
import { homeFor } from '../lib/auth/home';

export async function generateMetadata(): Promise<Metadata> {
  const org = await getCurrentOrg();
  if (org || !(await onPlatformHost())) return {};
  const { t } = await getT(null);
  return { title: { absolute: `Kellona | ${t('landing.hero1')} ${t('landing.hero2')}` }, description: t('landing.lede'), robots: { index: true } };
}

// Kellona's own address shows the Kellona landing page. An organization's
// address opens straight on its branded sign-in.
export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams;
  const org = await getCurrentOrg();
  const { t, locale } = await getT(org);
  const viewer = await getViewer();

  if (!org) {
    if (await onPlatformHost()) {
      return <Landing t={t} locale={locale} signedIn={viewer?.kind === 'admin'} contactEmail={process.env['KELLONA_CONTACT_EMAIL'] ?? null} />;
    }
    return (
      <AuthShell org={null} t={t} locale={locale} back="/" title={t('noorg.title')}>
        <p className={styles.lede}>{t('noorg.body')}</p>
        <Link className={styles.buttonGhost} href="/login">
          {t('landing.login')}
        </Link>
      </AuthShell>
    );
  }

  if (viewer) redirect(homeFor(viewer.kind, true));
  return (
    <AuthShell org={org} t={t} locale={locale} back="/" title={t('signin.title')}>
      <p className={styles.lede}>{t('signin.lede')}</p>
      <SignInForm t={t} params={params} />
    </AuthShell>
  );
}
