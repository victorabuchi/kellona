import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '../../components/AuthShell';
import SignInForm from '../../components/SignInForm';
import { getCurrentOrg } from '../../lib/tenant/org';
import { getT } from '../../lib/i18n';
import { getViewer } from '../../lib/auth/viewer';
import { homeFor } from '../../lib/auth/home';

export const metadata: Metadata = { title: 'Log in' };

// Kellona's own sign-in. On an organization's address the sign-in is at /.
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const org = await getCurrentOrg();
  if (org) redirect('/');
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer.kind, false));
  const { t, locale } = await getT(null);
  return (
    <AuthShell
      org={null}
      t={t}
      locale={locale}
      back="/login"
      title={t('login.title')}
      aside={
        <>
          {t('login.new')} <Link href="/signup">{t('login.request')}</Link>
        </>
      }
    >
      <SignInForm t={t} params={params} hint={t('login.residentHint')} />
    </AuthShell>
  );
}
