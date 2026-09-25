// Runs a real Postgres server for local development and tests, so no Docker or
// Homebrew install is needed. Data lives in .localdb/ (git ignored).
// Usage: npm run db:local   (keeps running until Ctrl+C)
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const port = Number(process.env['LOCAL_DB_PORT'] ?? 54329);
const dir = './.localdb';

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

const fresh = !existsSync(`${dir}/PG_VERSION`);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('kellona');

console.log(`Postgres running: postgresql://postgres:postgres@localhost:${port}/kellona`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => undefined, 1 << 30);
