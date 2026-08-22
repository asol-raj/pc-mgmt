# Migrations

Baseline schema lives in `db/schema.sql`. Any schema change made *after* the app is
live goes here instead, as a numbered SQL file, applied in order:

```
0001_add_purchase_date.sql
0002_add_department_column.sql
```

## They run automatically

Pending migrations are applied at server startup, before the app serves anything:

- production — `server.mjs` (what `pm2 start ecosystem.config.cjs` runs) migrates,
  then hands over to `dist/server/entry.mjs`. So `git pull && npm run build && pm2
  restart pc-mgmt:7100` is enough; no separate SQL step.
- development — the `pcmgmt-migrate` integration in `astro.config.mjs` does the same
  when `astro dev` boots.

A migration that fails aborts the boot with exit code 1, so the app never serves
against a schema it doesn't match. In pm2 that shows as the process erroring —
check `pm2 logs pc-mgmt:7100` for the `[migrate]` line naming the file.

To run them by hand without starting the app:

```
npm run migrate
```

## How "already applied" is tracked

Applied filenames are recorded in a `schema_migrations` table, created on first run.

A database that was migrated by hand before this runner existed needs nothing
special: the first run re-attempts those files, treats "duplicate column/key" as
proof the change is already in place, and records them. Anything else is a real
error and stops the boot.

Because tracking is by filename, never edit or rename a migration that has already
run anywhere — add a new one instead.

## Applied so far

- `0001_add_os_edition_and_network.sql` — adds `os_edition`, `ip_address`, `ip_config`.
- `0002_add_last_reported_at.sql` — adds `last_reported_at`, set by the agent API.
- `0003_add_machine_id.sql` — adds the unique `machine_id` the agent API matches on.
- `0004_add_used_by.sql` — adds the admin-owned `used_by` person name.
