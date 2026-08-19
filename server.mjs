// Production entry point (see ecosystem.config.cjs): brings the schema up to date,
// then hands over to the built Astro server. A failed migration aborts the boot
// rather than serving the app against a schema it does not match.
import { runMigrations } from './scripts/migrate.mjs';

try {
  await runMigrations();
} catch (err) {
  console.error(`[migrate] ${err.message}`);
  process.exit(1);
}

await import('./dist/server/entry.mjs');
