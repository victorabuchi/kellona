// Built in texts. Organizations override any key per locale through OrgText.
// {org} is replaced with the organization's short name.

export const LOCALES = ['fi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'fi' || value === 'en';
}

const en = {
  'common.language': 'Language',
  'common.finnish': 'Suomi',
  'common.english': 'English',
  'common.support': 'Support',
  'common.privacy': 'Privacy',
  'common.terms': 'Terms',
  'common.demoBadge': 'Demo organization',
  'signin.title': 'Sign in to {org}',
  'signin.lede': 'Book laundry, sauna, parking and shared spaces in your building.',
  'signin.email': 'Email address',
  'signin.emailHint': 'Use the email address your housing office has on file.',
  'signin.sendLink': 'Email me a sign-in link',
  'signin.or': 'or',
  'signin.google': 'Continue with Google',
  'signin.comingSoon': 'Sign-in is not switched on yet.',
  'noorg.title': 'Nothing here yet',
  'noorg.body': 'This address is not connected to a housing organization. Check the link your housing office sent you.',
  'privacy.title': 'Privacy policy',
  'privacy.controller': 'Data controller',
  'privacy.contact': 'Privacy contact',
  'privacy.what': 'What we process',
  'privacy.whatBody':
    'Your name, email address and apartment, which {org} provides from its resident register, and the bookings you make. Kellona processes this data on behalf of {org}.',
  'privacy.why': 'Why',
  'privacy.whyBody': 'To let residents book shared facilities fairly and to send booking reminders.',
  'privacy.rights': 'Your rights',
  'privacy.rightsBody': 'You can ask for a copy of your data or have your account deleted at any time.',
  'privacy.missing': 'Not provided yet',
  'meta.description': 'Booking for {org} residents.',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

const fi: Messages = {
  'common.language': 'Kieli',
  'common.finnish': 'Suomi',
  'common.english': 'English',
  'common.support': 'Tuki',
  'common.privacy': 'Tietosuoja',
  'common.terms': 'Käyttöehdot',
  'common.demoBadge': 'Esittelyorganisaatio',
  'signin.title': 'Kirjaudu: {org}',
  'signin.lede': 'Varaa pesutupa, sauna, autopaikka ja yhteiset tilat talossasi.',
  'signin.email': 'Sähköpostiosoite',
  'signin.emailHint': 'Käytä sähköpostiosoitetta, joka on vuokranantajasi tiedoissa.',
  'signin.sendLink': 'Lähetä kirjautumislinkki',
  'signin.or': 'tai',
  'signin.google': 'Jatka Googlella',
  'signin.comingSoon': 'Kirjautuminen ei ole vielä käytössä.',
  'noorg.title': 'Täällä ei ole vielä mitään',
  'noorg.body': 'Tätä osoitetta ei ole liitetty asuntoyhtiöön. Tarkista linkki, jonka sait vuokranantajaltasi.',
  'privacy.title': 'Tietosuojaseloste',
  'privacy.controller': 'Rekisterinpitäjä',
  'privacy.contact': 'Tietosuojayhteyshenkilö',
  'privacy.what': 'Mitä tietoja käsittelemme',
  'privacy.whatBody':
    'Nimesi, sähköpostiosoitteesi ja asuntosi, jotka {org} toimittaa asukasrekisteristään, sekä tekemäsi varaukset. Kellona käsittelee tietoja {org}:n lukuun.',
  'privacy.why': 'Miksi',
  'privacy.whyBody': 'Jotta asukkaat voivat varata yhteisiä tiloja reilusti ja saada muistutuksia varauksista.',
  'privacy.rights': 'Oikeutesi',
  'privacy.rightsBody': 'Voit milloin tahansa pyytää kopion tiedoistasi tai tilisi poistamista.',
  'privacy.missing': 'Ei vielä annettu',
  'meta.description': 'Varaukset {org}:n asukkaille.',
};

export const MESSAGES: Record<Locale, Messages> = { en, fi };
