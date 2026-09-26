# Kellona architecture

Kellona is a booking system for student housing organizations. One deployment and one database serve every customer. Customers are called organizations.

## Tenant model

**Resolution.** Each request is mapped to an organization from its `Host` header (`src/lib/tenant/org.ts`), once per request:

1. Exact match in `OrgDomain.host` (customer subdomains and custom domains, for example `varaukset.customer.fi`).
2. `<slug>.<platform domain>` where platform domains come from `PLATFORM_DOMAINS` (default `kellona.fi,kellona.com`).
3. In development only: `<slug>.localhost:3000`, and plain `localhost` falls back to `DEV_ORG_SLUG`.

An unknown host renders a neutral Kellona page. Org-only pages call `requireOrg()`, which returns 404 there. Host parsing is pure and unit tested (`src/lib/tenant/host.ts`, `tests/host.test.ts`).

**Data isolation.** Every organization owned table has a non-null `organizationId` with a cascading foreign key to `Organization`. Application code reaches those tables only through `orgScope(orgId)` (`src/lib/tenant/scope.ts`):

- `scope.<model>.q()` starts from a collection already filtered by `organizationId`, so looking up another organization's id returns nothing, and updates or deletes by that id change nothing.
- `scope.<model>.create(data)` stamps `organizationId` itself and overrides any value in `data`.

Three tests hold this in place:

- `tests/tenant-isolation.test.ts` seeds two scratch organizations with a row in every scoped model, then proves that reads, id lookups, updates, deletes and creates through one scope never cross into the other. It deletes the scratch data at the end.
- `tests/scope-guard.test.ts` fails if any file in `src/` queries an organization owned model with `db.orm.public.<Model>` instead of going through the scope. The allow list is two files.
- Changing the scope filter makes the isolation test fail (checked by hand once).

**Second layer (planned).** Postgres row level security with a policy of `organization_id = current_setting('app.org_id')::uuid` on every scoped table, with the app connecting as a role without `BYPASSRLS` and setting `app.org_id` per transaction. This catches a bug that slips past `orgScope`. It needs a transaction per request on the pooled connection, so it is added after the booking flows exist and can be measured.

**Known gap.** Foreign keys do not yet enforce that related rows share an organization (a booking in A pointing at a facility in B). Server actions always load the parent through the same scope first, which prevents this in practice. Composite foreign keys on `(organizationId, id)` would enforce it in the database and are planned together with RLS.

**Platform level data.** `Organization`, `PlatformAdmin` (Kellona super-admins) and `LoginToken` (whose organization is empty for super-admins) are not organization owned and sit outside `orgScope`.

## Sign-in

- **Methods today:** password (for `AuthIdentity` rows with provider `password`, and super-admins) and a one-time email link valid for 15 minutes. Google and an organization's own OIDC or SAML are added as further `AuthIdentity` providers without schema changes.
- **Session:** an HMAC signed, HttpOnly, host-only cookie holding `{kind, orgId, id, exp}` (`src/lib/auth/token.ts`). A host-only cookie is never sent to another organization's address, and `getViewer()` also rejects a resident or staff session whose `orgId` is not the current host's organization. Super-admin sessions work on every host.
- **Email links** store only a SHA-256 hash of the token, work once, and only on the organization's own address. Opening the link shows a button rather than signing in on GET, so mail scanners cannot use it up. Requesting a link answers the same way whether or not the address is known. Without `RESEND_API_KEY` in development the link is shown on the page.
- **Passwords** use scrypt from `node:crypto`. Unknown emails cost the same time as wrong passwords. Failed attempts are limited per email in memory (8 per 15 minutes), which must move to the database before running more than one instance.
- **Super-admins** are created with `npm run admin:create` (password read from the environment).
- `scripts/e2e-auth.ts` checks all of this over HTTP against the dev server with scratch data.

## Branding model

Branding is data, never code. `OrgBrand` holds:

- light and dark logo, favicon, app icon (URLs, uploaded to Supabase Storage by the onboarding wizard)
- primary and accent color

At request time the root layout turns the two colors into CSS variables (`src/lib/brand/css.ts`) for light and dark schemes. `src/lib/brand/color.ts` derives the rest:

| Variable | Derived as |
| --- | --- |
| `--brand`, `--accent` | The chosen colors. In dark mode a very dark primary is lifted to 3:1 against the surface. |
| `--brand-hover`, `--accent-hover` | Darkened (or lightened, for near black colors). |
| `--brand-tint`, `--brand-tint-strong`, `--accent-tint` | Mixed with the page surface. |
| `--on-brand`, `--on-accent` | White or near black, whichever contrasts more. |
| `--brand-text` | The primary moved toward black or white until it reaches 4.5:1 on the surface, for links and brand colored text. |

Components use only these variables and the neutral tokens in `globals.css`. Colors are validated as hex before they reach CSS.

Also per organization: page title and description, favicon and theme color (`generateMetadata` / `generateViewport` in `src/app/layout.tsx`), and the web app manifest (`src/app/manifest.ts`) so the installed PWA carries the customer's name and icon.

**Text.** Finnish and English are built in (`src/lib/i18n/messages.ts`). `OrgText` overrides any key per organization and locale. `{org}` in a text is replaced with the organization's short name. Locale order: the user's cookie choice if the organization offers it, then the browser language, then the organization default.

**Legal.** Each organization is its own data controller. The privacy page reads `legalName`, `businessId`, `address` and `privacyEmail` from the organization record.

**Demo organizations.** `npm run seed:demo` creates two organizations marked `isDemo` with invented names, logos and colors. They exist to prove that nothing is hard coded. Real customers are created in the super-admin area.

## Booking

- `Facility` is one table for every bookable thing. `kind` is `laundry`, `sauna`, `parking`, `common_room`, `gym`, `study_room` or `grill`. New facilities get the kind's default rules (`src/lib/booking/kinds.ts`), which staff can tune per facility: opening hours, fixed turn starts (sauna 16, 18, 20), turn length, hours per booking, hours per person per week, days ahead and capacity.
- Availability (`resolveAmenities`): `BuildingAmenity` and `UnitAmenity` hold an explicit yes or no per kind. No row means automatic, which is available when the building has a facility of that kind. The apartment setting wins over the building setting.
- All limits are checked on the server (`src/lib/booking/rules.ts`, `engine.ts`): past times, days ahead, opening hours or fixed turns, length, clashes, the weekly limit (across all machines or saunas of the building, per space for spaces), capacity, and that invitees live in the same building. A unique index on `(facilityId, startsAt)` settles races.
- Group bookings: invite roommates, the whole apartment or others in the building. Invitees accept, decline or leave. Deleting a booking deletes its participants.
- Weekly standing turns: up to 12 weeks, same local hour across daylight saving (server runs with `TZ=Europe/Helsinki`). The first week follows every rule; later weeks may lie beyond the booking window but still respect clashes and the weekly limit. Skipped weeks are reported. A series is cancelled from a chosen week onward.
- Parking: `ParkingClaim`, one spot per resident and one resident per spot.
- Reminders: `GET /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`, run hourly. Each booking is reminded once, to the booker and accepted guests, by web push (VAPID) or by email when the resident has no working push subscription.
- Also: calendar file per booking (`/book/ics/<id>`), printable QR code per facility (`/manage/qr/<id>`) that opens its booking page on the organization's address.

## Areas and roles

- `/book`: residents. Hub, facility pages with a week strip and day slots, parking.
- `/manage`: staff. Buildings, facilities and rules, amenity states, apartment exceptions, upcoming bookings, residents and CSV import. Managers and super-admins see every building, other staff only linked buildings.
- `/platform`: super-admins. Organizations, creating one, branding (logo upload, colors with preview and a color suggested from the logo), organization details and web addresses. "Open" hands the session over to the organization's address with a one minute token, because sessions are per address.
- Super-admins can "view as" a resident to test and support; a banner shows it and "Back to admin" restores the admin session.
- Uploaded logos are stored as data URLs on `OrgBrand` (300 KB limit) until Supabase Storage is connected.

## Local development

```
npm install
npm run db:local        # real Postgres on port 54329, data in .localdb/
npx prisma db migrate
npm run seed:demo
npm run dev
```

Open `http://demo-north.localhost:3000` and `http://demo-lakeside.localhost:3000`. `http://booking.lakeside.localhost:3000` exercises custom domain lookup. `npm test` runs unit and database tests.

## Layout

```
src/app/            routes (App Router)
src/components/     shared UI
src/lib/tenant/     host resolution, organization loading, orgScope
src/lib/brand/      color derivation and CSS variables
src/lib/i18n/       texts, locale choice, per organization overrides
src/prisma/         contract.prisma and the database client
migrations/         Prisma 8 migration packages
scripts/            local database, demo seed, headless Chrome tools
tests/              node:test suites
```
