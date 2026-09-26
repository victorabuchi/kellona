# Kellona

White-label booking for student housing organizations: laundry, sauna, parking and shared spaces. One deployment serves many organizations, each with its own address, branding and texts. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Run locally

Requirements: Node 22 or newer.

```bash
git clone https://github.com/victorabuchi/kellona.git
cd kellona
npm install
cp .env.example .env      # then set DATABASE_URL (see below)
npm run setup             # applies migrations and creates the two demo organizations
npm run dev
```

After signing in as a super-admin, use Platform, then Open on any organization. Open:

- http://demo-north.localhost:3000 (demo organization, Finnish default)
- http://demo-lakeside.localhost:3000 (demo organization, English default)
- http://booking.lakeside.localhost:3000 (same organization through a custom domain entry)
- http://localhost:3000 (falls back to `DEV_ORG_SLUG`)

`*.localhost` addresses work in Chrome, Firefox and Safari without editing `/etc/hosts`.

### Database

- **Supabase:** use the session pooler string (port 5432, user `postgres.<project-ref>`). Not the transaction pooler on 6543.
- **Offline:** `npm run db:local` in a separate terminal starts a real Postgres on port 54329 with data in `.localdb/`. Set `DATABASE_URL="postgresql://postgres:postgres@localhost:54329/kellona"`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm test` | Unit tests and database tests (tenant isolation). Scratch data is deleted afterwards. |
| `npm run typecheck`, `npm run lint` | Static checks |
| `npm run setup` | Emit contract, apply migrations, seed demo organizations. Safe to rerun. |
| `ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD='...' npm run admin:create` | Create or update a Kellona super-admin |
| `E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD='...' npx tsx scripts/e2e-auth.ts` | Sign-in end to end checks against the running dev server |
| `E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD='...' TZ=Europe/Helsinki npx tsx scripts/e2e-booking.ts` | Booking, staff, import, parking and reminder checks end to end |
| `E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD='...' npx tsx scripts/audit-mobile.ts [dir]` | Every route at 390px and 360px in headless Chrome; fails on horizontal overflow |
| `npm run screenshot -- <url> <out.png> [width] [dark]` | Viewport screenshot in headless Chrome |

## Schema changes

1. Edit `src/prisma/contract.prisma`
2. `npx prisma contract emit`
3. `npx prisma migration plan --name <slug> --from <previous migration directory name>`
4. `npx prisma db migrate --json`
