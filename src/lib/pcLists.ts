import db from './db';
import type { PrinterItem, SoftwareItem } from './agentReport';

// The installed-software and printer lists a PC reports. Both are agent-owned in
// full: a report is the whole list as of that moment, so storing it means replacing
// whatever was there, not merging. Rows are compared first so an identical report —
// the common case, several times a week per PC — writes nothing and does not bump
// auto-increment ids for no reason.

const canonical = (rows: unknown[]) => JSON.stringify(rows);

/**
 * Replaces the PC's stored program list with `items`. Returns true when the stored
 * list actually changed, so the endpoint can name `software` in `updated_fields`.
 */
export async function syncSoftware(pcId: number, items: SoftwareItem[]): Promise<boolean> {
  const [rows]: any = await db.query(
    "SELECT name, version, publisher, DATE_FORMAT(install_date, '%Y-%m-%d') AS install_date FROM pc_software WHERE pc_id = ? ORDER BY id",
    [pcId]
  );
  const existing = rows.map((r: any) => ({
    name: r.name,
    version: r.version,
    publisher: r.publisher,
    install_date: r.install_date ?? null,
  }));
  if (canonical(existing) === canonical(items)) return false;

  await replaceRows(
    'pc_software',
    pcId,
    '(pc_id, name, version, publisher, install_date)',
    items.map((s) => [pcId, s.name, s.version, s.publisher, s.install_date])
  );
  return true;
}

/** Same contract as `syncSoftware`, for the printer list. */
export async function syncPrinters(pcId: number, items: PrinterItem[]): Promise<boolean> {
  const [rows]: any = await db.query(
    'SELECT name, driver, port, kind, is_default, status FROM pc_printers WHERE pc_id = ? ORDER BY id',
    [pcId]
  );
  const existing = rows.map((r: any) => ({
    name: r.name,
    driver: r.driver,
    port: r.port,
    kind: r.kind,
    is_default: Number(r.is_default),
    status: r.status,
  }));
  if (canonical(existing) === canonical(items)) return false;

  await replaceRows(
    'pc_printers',
    pcId,
    '(pc_id, name, driver, port, kind, is_default, status)',
    items.map((p) => [pcId, p.name, p.driver, p.port, p.kind, p.is_default, p.status])
  );
  return true;
}

/** DELETE + bulk INSERT in one transaction, so a reader never sees a half-written list. */
async function replaceRows(table: string, pcId: number, columns: string, values: unknown[][]) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM ${table} WHERE pc_id = ?`, [pcId]);
    if (values.length > 0) {
      await conn.query(`INSERT INTO ${table} ${columns} VALUES ?`, [values]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}
