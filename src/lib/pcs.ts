import db from './db';
import type { Pc, PcPrinter, PcSoftware } from './types';

/**
 * Every PC, the way both pages and `GET /api/pcs` hand it to the browser: the row
 * itself plus what the child tables add up to — how many programs and printers were
 * reported, and the printer names joined so the Data tab and the CSV can show them
 * without another request. The full lists are fetched on demand when someone opens
 * them (see `softwareOf` / `printersOf`); a PC can carry hundreds of programs and the
 * register does not need them all on every page load.
 */
export async function listPcs(): Promise<Pc[]> {
  const [rows] = await db.query(
    `SELECT p.*,
            (SELECT COUNT(*) FROM pc_software s WHERE s.pc_id = p.id) AS software_count,
            (SELECT COUNT(*) FROM pc_printers r WHERE r.pc_id = p.id) AS printer_count,
            (SELECT GROUP_CONCAT(r.name ORDER BY r.is_default DESC, r.name SEPARATOR ', ')
               FROM pc_printers r WHERE r.pc_id = p.id) AS printers
       FROM pcs p
      ORDER BY p.name ASC`
  );
  return rows as Pc[];
}

/** Installed programs for one PC, alphabetical. */
export async function softwareOf(pcId: number): Promise<PcSoftware[]> {
  const [rows] = await db.query(
    "SELECT id, name, version, publisher, DATE_FORMAT(install_date, '%Y-%m-%d') AS install_date FROM pc_software WHERE pc_id = ? ORDER BY name ASC",
    [pcId]
  );
  return rows as PcSoftware[];
}

/** Installed printers for one PC, default first, then alphabetical. */
export async function printersOf(pcId: number): Promise<PcPrinter[]> {
  const [rows] = await db.query(
    'SELECT id, name, driver, port, kind, is_default, status FROM pc_printers WHERE pc_id = ? ORDER BY is_default DESC, name ASC',
    [pcId]
  );
  return rows as PcPrinter[];
}
