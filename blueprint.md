# PC Register App — Blueprint

## 1. Purpose

An internal tool for a client's office admin to keep a register of all workstations/PCs
in the organization. The office has ~100 PCs — a mix of old and new machines, some on
Windows 10 and some on Windows 11, some with MS Office installed and some without,
varying in performance (some slow, some good), and some due for retirement.

The admin needs to:
- Register newly added PCs
- Add all existing PCs into the system (initial data entry / bulk onboarding)
- Edit/update any PC's details over time
- Mark a PC as **Retired** when it's taken out of service
- Quickly look up a PC's key info (TeamViewer ID, extension number, location) when
  someone calls in needing remote support

Non-admin visitors to the site should be able to browse the register (read-only) and
see a given PC's key details in a clear, large-font "vitals" panel.

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Astro, SSR mode, `@astrojs/node` adapter | Requested by client; SSR needed for DB reads + admin session auth |
| Styling | Tailwind CSS | Requested; utility-first for a clean, single-page design |
| Interactivity | Alpine.js | Lightweight, no separate JS framework/build step needed for filtering + right-pane selection — keeps the "one page app" feel |
| Database | MySQL, accessed via `mysql2` connection pool | Requested; local MySQL instance for this project |
| Auth | Single shared admin password (hashed), signed HTTP-only session cookie, checked via Astro middleware | Simple, appropriate for a single-admin internal tool — no need for a full auth library or multi-user accounts |

## 3. Data Model — `pcs` table (MySQL)

| Column | Type | Notes |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | |
| `asset_tag` | VARCHAR, unique | Human-friendly ID, e.g. `PC-014` |
| `name` | VARCHAR | Windows host name, e.g. `POS-101`; kept in sync by the agent API |
| `location` | VARCHAR | e.g. "2nd Floor - Accounts" |
| `extension_number` | VARCHAR | Phone extension at that desk |
| `teamviewer_id` | VARCHAR | TeamViewer ID installed on that PC |
| `os` | ENUM('Windows 10','Windows 11') | |
| `has_ms_office` | BOOLEAN | |
| `office_version` | VARCHAR, nullable | Only relevant if `has_ms_office` is true, e.g. "2019", "365" |
| `age` | ENUM('New','Old') | Simple condition tag (decided over free-text/purchase-year) |
| `performance` | ENUM('Good','Average','Slow') | Simple condition tag |
| `status` | ENUM('Active','Retired') | Drives the "mark retired" workflow |
| `specs` | TEXT, nullable | Free text, e.g. "i5, 8GB RAM, 256GB SSD" |
| `notes` | TEXT, nullable | Any other admin remarks |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### Design decisions confirmed with client
- Age/performance captured as simple dropdown tags (New/Old, Good/Average/Slow) rather
  than free text or exact purchase dates — fast data entry for ~100 records, still filterable.
- MySQL runs locally for this project (not a remote/hosted instance).
- Admin auth is a single shared password (not per-user accounts).

## 4. Database Setup Scripts

Before any app code runs, the MySQL database itself is created via SQL scripts (not
by the app). These live in a `db/` folder and are run manually against the local
MySQL server:

- **`db/setup.sql`** — run once, as the MySQL root/sudo user (from `SUDO_MYSQL_USERNAME`
  / `SUDO_MYSQL_PASSWORD` in `.env`). Creates the `pcmgmt` database, creates the
  app-specific MySQL user (`MYSQL_USERNAME` / `MYSQL_PASSWORD` from `.env`), and grants
  that user privileges scoped to the `pcmgmt` database only.
- **`db/schema.sql`** — run once, as the app's MySQL user (or root), against the
  `pcmgmt` database. Creates all tables (starting with `pcs`) as defined in Section 3.
- **`db/migrations/`** — folder for incremental schema changes made *after* the initial
  schema is live (e.g. adding a column later). Each migration is a numbered, timestamped
  SQL file (e.g. `0001_add_purchase_date.sql`) applied in order, so schema changes are
  tracked and repeatable instead of edited ad hoc.

This keeps initial provisioning (`setup.sql`), the baseline schema (`schema.sql`), and
ongoing schema evolution (`migrations/`) cleanly separated.

## 5. Pages & Routes

### `/` — Public one-page app

Three-column layout:

- **Left panel** (fixed sidebar) — branding/logo, primary navigation (Home, Admin
  login link), and filter controls (by status, location, OS, age, performance)
- **Content area** (center, scrollable) — its own **top nav bar** containing the
  search box, current filter summary, and total PC count, with the PC list/grid
  below it
- **Right panel** — **quick info pane** for whichever PC is selected from the list
  in the content area: asset tag, location, extension number, TeamViewer ID, OS,
  status, performance, shown in large, easy-to-read font — designed so someone can
  glance at it while on a support call. Shows a placeholder/empty state until a PC
  is selected.
- Read-only — no edit controls on this page

### `/admin` — Protected admin dashboard
- If no valid session cookie: password login form
- Once authenticated: full table of all PCs with inline **Add / Edit / Delete / Mark
  Retired** actions
- "Add New PC" form (modal or side panel) for registering new machines or backfilling
  existing ones

### API routes
- `GET /api/pcs` — public, powers the homepage list
- `POST /api/pcs` — admin-only, create a PC
- `PUT /api/pcs/[id]` — admin-only, update a PC
- `DELETE /api/pcs/[id]` — admin-only, delete a PC
- `POST /api/auth/login` — verifies password, sets session cookie
- `POST /api/agent/report` — API-key auth, used by the .NET agent app installed on each
  PC to self-report its specs; see `docs/agent-api.md`
- Mutating routes and `/admin` are guarded by Astro middleware checking the session cookie;
  `/api/agent/*` is guarded by the same middleware checking the `AGENT_API_KEY` instead

## 6. Project Structure (planned)

```
pc-mgmt/
├── blueprint.md                 (this file)
├── db/
│   ├── setup.sql                (creates database + app user, run as sudo/root)
│   ├── schema.sql                (creates all tables)
│   └── migrations/              (numbered incremental schema changes)
├── src/
│   ├── layouts/Layout.astro
│   ├── pages/
│   │   ├── index.astro          (public one-pager)
│   │   ├── admin/index.astro    (login + dashboard)
│   │   └── api/
│   │       ├── pcs/index.ts     (GET, POST)
│   │       ├── pcs/[id].ts      (PUT, DELETE)
│   │       └── auth/login.ts
│   ├── lib/db.ts                (mysql2 pool)
│   ├── middleware.ts            (guards /admin + mutating APIs)
│   └── components/
│       ├── LeftPanel.astro      (branding, nav, filters)
│       ├── TopNavBar.astro      (search box, filter summary, PC count — content area header)
│       ├── PcCard.astro
│       ├── VitalsPane.astro     (right-hand quick info panel)
│       └── PcForm.astro
├── .env                         (real credentials — not committed)
├── .env.example                 (placeholder template, committed)
└── tailwind.config.mjs
```

## 7. Build Order

1. Run `db/setup.sql` (as sudo MySQL user) to create the `pcmgmt` database and app user
2. Run `db/schema.sql` to create the `pcs` table
3. Scaffold Astro project + Tailwind + Node adapter
4. Set up the app's MySQL connection (`lib/db.ts`) using the app user credentials
5. Build `/api/pcs` CRUD endpoints + `/api/auth/login`
6. Build public one-page UI (left panel, top nav bar, content list, right vitals pane)
7. Build `/admin` login + CRUD dashboard
8. Seed a few sample PCs to verify everything end-to-end
9. Add new migration files under `db/migrations/` for any schema change from here on,
   instead of editing `schema.sql` directly

## 8. Status

Blueprint agreed with client. Build not yet started as of 2026-08-10.
