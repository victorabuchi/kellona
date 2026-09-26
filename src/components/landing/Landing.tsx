import Link from 'next/link';
import styles from './landing.module.css';
import ProductFilm from './film/ProductFilm';
import { FILM_KEYS, type FilmLabels } from './film-keys';
import RoleCards from './RoleCards';
import HowItWorks from './HowItWorks';
import LandingNav from './LandingNav';
import KindIcon from '../KindIcon';
import type { T } from '../../lib/i18n';
import type { Locale, MessageKey } from '../../lib/i18n/messages';
import { setLocaleAction } from '../../lib/i18n/actions';
import { nowMs } from '../../lib/booking/time';

// Each bookable kind floats with its own colored glow.
const GLOW: Array<[string, string]> = [
  ['laundry', '#2f5d8a'],
  ['sauna', '#d9480f'],
  ['parking', '#1971c2'],
  ['common_room', '#e0a526'],
  ['gym', '#2e7d4f'],
  ['study_room', '#7b1fa2'],
  ['grill', '#c2255c'],
];

const FEATURE_ICONS: Array<[string, string]> = [
  ['laundry', '#2f5d8a'],
  ['parking', '#1971c2'],
  ['common_room', '#e0a526'],
  ['people', '#d9480f'],
  ['repeat', '#2e7d4f'],
  ['bell', '#7b1fa2'],
  ['upload', '#0c8599'],
  ['shield', '#c2255c'],
];

const EXTRA_ICONS: Record<string, string> = {
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7',
  repeat: 'M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
};

function Icon({ name }: { name: string }) {
  if (!EXTRA_ICONS[name]) return <KindIcon kind={name} size={24} />;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={EXTRA_ICONS[name]} />
    </svg>
  );
}

function Wordmark() {
  return (
    <svg viewBox="0 0 220 64" width="117" height="34" role="img" aria-label="Kellona" style={{ display: 'block' }}>
      <rect width="64" height="64" rx="14" fill="#2f5d8a" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M32 20v12l8 6" fill="none" stroke="#e0a526" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="78" y="44" fontFamily="var(--font-sans), Helvetica, Arial, sans-serif" fontSize="32" fontWeight="800" fill="#14181f">
        Kellona
      </text>
    </svg>
  );
}

function Langs({ locale, back }: { locale: Locale; back: string }) {
  return (
    <form action={setLocaleAction} className={styles.langs}>
      <input type="hidden" name="back" value={back} />
      <button type="submit" name="locale" value="fi" aria-pressed={locale === 'fi'} lang="fi">
        Suomi
      </button>
      <button type="submit" name="locale" value="en" aria-pressed={locale === 'en'} lang="en">
        English
      </button>
    </form>
  );
}

export default function Landing({ t, locale, signedIn, contactEmail }: { t: T; locale: Locale; signedIn: boolean; contactEmail: string | null }) {
  const k = (key: string) => t(key as MessageKey);
  const film = Object.fromEntries(FILM_KEYS.map((key) => [key, k(key)])) as FilmLabels;
  const pair = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ title: k(`${prefix}${i + 1}.t`), desc: k(`${prefix}${i + 1}.d`) }));

  return (
    <div className={styles.page}>
      <LandingNav
        logo={<Wordmark />}
        menuLabel={k('landing.menu')}
        menus={[
          {
            id: 'product',
            label: k('menu.product'),
            columns: [
              {
                heading: k('menu.booking'),
                items: [
                  { title: k('kind.laundry'), desc: k('menu.d.laundry'), href: '#features', icon: 'laundry' },
                  { title: k('kind.sauna'), desc: k('menu.d.sauna'), href: '#features', icon: 'sauna' },
                  { title: k('kind.parking'), desc: k('menu.d.parking'), href: '#features', icon: 'parking' },
                  { title: k('menu.spaces'), desc: k('menu.d.spaces'), href: '#features', icon: 'space' },
                ],
              },
              {
                heading: k('menu.tools'),
                items: [
                  { title: k('landing.f4.t'), desc: k('menu.d.group'), href: '#showcase', icon: 'people' },
                  { title: k('landing.f5.t'), desc: k('menu.d.weekly'), href: '#features', icon: 'repeat' },
                  { title: k('landing.f6.t'), desc: k('menu.d.reminders'), href: '#features', icon: 'bell' },
                  { title: k('manage.qr'), desc: k('menu.d.qr'), href: '#features', icon: 'qr' },
                ],
              },
            ],
            side: {
              heading: k('menu.explore'),
              links: [
                { label: k('menu.seeIt'), href: '#showcase' },
                { label: k('menu.allFeatures'), href: '#features' },
                { label: k('menu.pilot'), href: '#how' },
              ],
            },
            footer: { label: k('menu.footerProduct'), href: '/signup' },
          },
          {
            id: 'solutions',
            label: k('menu.solutions'),
            columns: [
              {
                heading: k('menu.who'),
                items: [
                  { title: k('menu.office'), desc: k('menu.d.office'), href: '#how', icon: 'building' },
                  { title: k('menu.residents'), desc: k('menu.d.residents'), href: '#how', icon: 'phone' },
                ],
              },
              {
                heading: k('menu.brand'),
                items: [
                  { title: k('menu.address'), desc: k('menu.d.address'), href: '#showcase', icon: 'globe' },
                  { title: k('menu.logo'), desc: k('menu.d.logo'), href: '#showcase', icon: 'palette' },
                  { title: k('landing.f7.t'), desc: k('menu.d.import'), href: '#features', icon: 'upload' },
                  { title: k('landing.f8.t'), desc: k('menu.d.data'), href: '/privacy', icon: 'shield' },
                ],
              },
            ],
            side: {
              heading: k('menu.start'),
              links: [
                { label: k('landing.ctaPrimary'), href: '/signup' },
                { label: k('landing.login'), href: '/login' },
                { label: k('common.privacy'), href: '/privacy' },
              ],
            },
            footer: { label: k('menu.footerSolutions'), href: '/signup' },
          },
        ]}
        plain={[{ label: k('landing.nav.how'), href: '#how' }]}
        actions={
          signedIn ? (
            <Link href="/platform" className={styles.btnPrimary}>
              {k('landing.dashboard')}
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.btnGhost}>
                {k('landing.login')}
              </Link>
              <Link href="/signup" className={`${styles.btnPrimary} ${styles.navSignup}`}>
                {k('landing.signup')}
              </Link>
            </>
          )
        }
        mobileExtra={
          <div className={styles.mobileExtra}>
            {!signedIn && (
              <Link href="/signup" className={styles.btnPrimary}>
                {k('landing.signup')}
              </Link>
            )}
            <Langs locale={locale} back="/" />
          </div>
        }
      />

      <header id="showcase" className={styles.hero}>
        <div className={styles.aurora} aria-hidden="true" />
        <div className={`${styles.wrap} ${styles.heroInner}`}>
          <h1 className={styles.fadeUp}>
            {k('landing.hero1')} <span>{k('landing.hero2')}</span>
          </h1>
          <p className={`${styles.heroLede} ${styles.fadeUp} ${styles.d2}`}>{k('landing.lede')}</p>
          <div className={`${styles.heroCtas} ${styles.fadeUp} ${styles.d3}`}>
            <Link href="/signup" className={`${styles.btnHero} ${styles.big}`}>
              {k('landing.ctaPrimary')}
            </Link>
            <Link href="/login" className={`${styles.btnHeroGhost} ${styles.big}`}>
              {k('landing.ctaSecondary')}
            </Link>
          </div>
          <div className={styles.glowRow} aria-hidden="true">
            {GLOW.map(([kind, color]) => (
              <div key={kind} className={styles.glowTile} style={{ ['--glow' as string]: color }}>
                <KindIcon kind={kind} size={24} />
              </div>
            ))}
          </div>
        </div>
        <div className={`${styles.wrap} ${styles.filmWrap} ${styles.fadeUp} ${styles.d3}`}>
          <ProductFilm L={film} />
        </div>
      </header>

      <section id="features" className={styles.sectionAlt}>
        <div className={styles.wrap}>
          <div className={styles.head}>
            <h2>{k('landing.featuresTitle')}</h2>
            <p>{k('landing.featuresLede')}</p>
          </div>
          <div className={styles.features}>
            {FEATURE_ICONS.map(([icon, color], i) => (
              <div key={icon} className={styles.feature} style={{ ['--glow' as string]: color }}>
                <div className={styles.featureIcon}>
                  <Icon name={icon} />
                </div>
                <h3>{k(`landing.f${i + 1}.t`)}</h3>
                <p>{k(`landing.f${i + 1}.d`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.head}>
            <h2>{k('landing.builtTitle')}</h2>
            <p>{k('landing.builtLede')}</p>
          </div>
          <RoleCards
            cards={[
              { title: k('landing.residentsCard'), items: pair('landing.r', 4), cta: k('landing.residentsCta'), href: '/login', dark: false, icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' },
              { title: k('landing.staffCard'), items: pair('landing.s', 4), cta: k('landing.staffCta'), href: '/signup', dark: true, icon: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3' },
            ]}
          />
        </div>
      </section>

      <section id="how" className={styles.sectionAlt}>
        <div className={styles.wrap}>
          <div className={styles.head}>
            <h2>{k('landing.howTitle')}</h2>
            <p>{k('landing.howLede')}</p>
          </div>
          <HowItWorks
            tabs={[
              { label: k('landing.howTab.office'), steps: pair('landing.o', 4) },
              { label: k('landing.howTab.residents'), steps: pair('landing.p', 4) },
            ]}
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.band}>
            <h2>{k('landing.bandTitle')}</h2>
            <p>{k('landing.bandText')}</p>
            <Link href="/signup" className={`${styles.btnLight} ${styles.big}`}>
              {k('landing.ctaPrimary')}
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.footerCols}>
            <div className={styles.footerCol}>
              <Wordmark />
              <span>{k('landing.footer.made')}</span>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerTitle}>{k('landing.footer.product')}</span>
              <a href="#showcase">{k('landing.nav.showcase')}</a>
              <a href="#features">{k('landing.nav.features')}</a>
              <a href="#how">{k('landing.nav.how')}</a>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerTitle}>{k('landing.footer.company')}</span>
              <Link href="/signup">{k('landing.ctaPrimary')}</Link>
              <Link href="/login">{k('landing.login')}</Link>
              {contactEmail && <a href={`mailto:${contactEmail}`}>{k('landing.footer.contact')}</a>}
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerTitle}>{k('landing.footer.legal')}</span>
              <Link href="/privacy">{k('common.privacy')}</Link>
              <Link href="/terms">{k('common.terms')}</Link>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>&copy; {new Date(nowMs()).getFullYear()} Kellona · kellona.fi</span>
            <Langs locale={locale} back="/" />
          </div>
        </div>
      </footer>
    </div>
  );
}
