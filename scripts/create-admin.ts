// Creates or updates a Kellona super-admin. The password is read from the
// environment so it never ends up in code or shell history files as an argument.
// Usage: ADMIN_EMAIL=me@example.com ADMIN_NAME="Me" ADMIN_PASSWORD='...' npm run admin:create
import { db } from '../src/prisma/db';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../src/lib/auth/password';

const email = (process.env['ADMIN_EMAIL'] ?? '').trim().toLowerCase();
const name = (process.env['ADMIN_NAME'] ?? '').trim() || email;
const password = process.env['ADMIN_PASSWORD'] ?? '';
if (!email.includes('@') || password.length < MIN_PASSWORD_LENGTH) {
  console.error(`Set ADMIN_EMAIL and ADMIN_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters).`);
  process.exit(1);
}

const passwordHash = await hashPassword(password);
const existing = await db.orm.public.PlatformAdmin.where({ email }).first();
if (existing) await db.orm.public.PlatformAdmin.where({ id: existing.id }).update({ name, passwordHash });
else await db.orm.public.PlatformAdmin.create({ email, name, passwordHash });
console.log(`${existing ? 'Updated' : 'Created'} super-admin ${email}`);
await db.close();
