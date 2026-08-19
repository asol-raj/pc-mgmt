import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');

// Only one process may migrate at a time, so a restart of several instances
// cannot run the same ALTER twice.
const LOCK_NAME = 'pcmgmt_migrations';
const LOCK_TIMEOUT_SECONDS = 60;

// A database that was migrated by hand before this runner existed already has the
// columns. Re-running those files hits these errors, which mean "already applied"
// rather than "broken", so we record the file and move on.
const ALREADY_APPLIED_CODES = new Set([
  'ER_DUP_FIELDNAME', // duplicate column
  'ER_DUP_KEYNAME', // duplicate index/key
  'ER_TABLE_EXISTS_ERROR',
  'ER_DUP_ENTRY',
]);

function connectionConfig() {
  return {
    host: process.env.MYSQL_HOSTNAME,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  };
}

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.toLowerCase().endsWith('.sql'))
    .sort(); // 0001_, 0002_, ... — numeric prefixes keep this in order
}

/**
 * Splits a migration file into statements. Comments and `USE <db>;` lines are
 * dropped — the connection is already pointed at the right database, and running
 * USE would let a file escape it.
 */
function statementsOf(sql) {
  const cleaned = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .filter((line) => !/^\s*USE\s+/i.test(line))
    .join('\n');

  return cleaned
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function runMigrations({ log = console.log } = {}) {
  const files = migrationFiles();
  if (files.length === 0) return { applied: [], skipped: [] };

  const conn = await mysql.createConnection(connectionConfig());
  const applied = [];
  const skipped = [];

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [lockRows] = await conn.query('SELECT GET_LOCK(?, ?) AS locked', [
      LOCK_NAME,
      LOCK_TIMEOUT_SECONDS,
    ]);
    if (lockRows[0]?.locked !== 1) {
      throw new Error('Timed out waiting for the migration lock — is another instance starting?');
    }

    try {
      const [rows] = await conn.query('SELECT filename FROM schema_migrations');
      const done = new Set(rows.map((row) => row.filename));

      for (const file of files) {
        if (done.has(file)) {
          skipped.push(file);
          continue;
        }

        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        let alreadyInPlace = false;

        for (const statement of statementsOf(sql)) {
          try {
            await conn.query(statement);
          } catch (err) {
            if (ALREADY_APPLIED_CODES.has(err?.code)) {
              alreadyInPlace = true;
              continue;
            }
            throw new Error(`Migration ${file} failed: ${err?.sqlMessage || err?.message}`);
          }
        }

        await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
        applied.push(file);
        log(
          alreadyInPlace
            ? `[migrate] ${file} was already in the schema — recorded`
            : `[migrate] applied ${file}`
        );
      }
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
    }
  } finally {
    await conn.end();
  }

  if (applied.length === 0) log(`[migrate] schema up to date (${skipped.length} migrations)`);
  return { applied, skipped };
}

// `npm run migrate` runs this file directly.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[migrate] ${err.message}`);
      process.exit(1);
    });
}
