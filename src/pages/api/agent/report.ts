import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { buildAgentReport } from '../../../lib/agentReport';

export const prerender = false;

// Requests reach this route only after middleware has checked the API key.

// Set AGENT_ALLOW_CREATE=false once every PC is in the register, and the agent can
// then only update rows that already exist — it can no longer add any.
function creationAllowed(): boolean {
  return (process.env.AGENT_ALLOW_CREATE ?? 'true').toLowerCase() !== 'false';
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Only the fields whose value actually differs, so an unchanged report writes nothing. */
function changedFields(existing: any, detected: Record<string, string | number>) {
  const patch: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(detected)) {
    const current = existing[key];
    if (key === 'ram_gb') {
      if (Number(current) !== Number(value)) patch[key] = value;
      continue;
    }
    if (String(current ?? '') !== String(value)) patch[key] = value;
  }
  return patch;
}

// Lets the agent app verify its API key and the URL at install time.
export const GET: APIRoute = async () =>
  json({ ok: true, service: 'pc-mgmt agent api', endpoint: 'POST /api/agent/report' }, 200);

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const { report, error } = buildAgentReport(body);
  if (error || !report) return json({ error }, 400);

  const { machine_id, asset_tag, name, detected, location, assigned_users } = report;

  try {
    // Find the row this machine already owns. machine_id is authoritative: it survives
    // the admin renaming the PC, which is what would otherwise produce a duplicate.
    let existing: any = null;

    if (machine_id) {
      const [rows]: any = await db.query('SELECT * FROM pcs WHERE machine_id = ? LIMIT 1', [machine_id]);
      existing = rows[0] ?? null;
    }

    if (!existing && asset_tag) {
      const [rows]: any = await db.query('SELECT * FROM pcs WHERE asset_tag = ? LIMIT 1', [asset_tag]);
      const row = rows[0] ?? null;
      // A tag already claimed by a different machine is an admin data problem —
      // better to say so than to overwrite one machine's row with another's specs.
      if (row && machine_id && row.machine_id && row.machine_id !== machine_id) {
        return json(
          {
            error: `asset_tag "${asset_tag}" is already registered to a different machine`,
            registered_machine_id: row.machine_id,
          },
          409
        );
      }
      existing = row;
    }

    if (!existing && name) {
      const [rows]: any = await db.query('SELECT * FROM pcs WHERE name = ? LIMIT 2', [name]);
      if (rows.length > 1) {
        return json(
          { error: `More than one PC is named "${name}" — send machine_id or asset_tag to identify this machine` },
          409
        );
      }
      // A name match on a row owned by another machine is just two PCs sharing a
      // display name, so leave that row alone and register this machine separately.
      const row = rows[0] ?? null;
      if (row && !(machine_id && row.machine_id && row.machine_id !== machine_id)) {
        existing = row;
      }
    }

    if (existing) {
      const patch = changedFields(existing, detected);
      // Link the row to this machine the first time it reports an id, so every
      // later report matches on machine_id no matter how the PC gets renamed.
      if (machine_id && !existing.machine_id) patch.machine_id = machine_id;

      await db.query('UPDATE pcs SET ? WHERE id = ?', [
        { ...patch, last_reported_at: new Date() },
        existing.id,
      ]);

      return json(
        {
          status: Object.keys(patch).length > 0 ? 'updated' : 'unchanged',
          id: existing.id,
          asset_tag: existing.asset_tag,
          machine_id: machine_id || existing.machine_id,
          updated_fields: Object.keys(patch),
        },
        200
      );
    }

    if (!creationAllowed()) {
      return json(
        {
          error:
            'This PC is not in the register and AGENT_ALLOW_CREATE is off — an admin must add it first',
        },
        409
      );
    }

    // New machine: the agent has to at least tell us which Windows it runs, since
    // the column is required. Everything else falls back to the schema defaults.
    if (!detected.os) {
      return json({ error: 'os is required when registering a PC that is not in the register yet' }, 400);
    }
    if (!asset_tag && !name) {
      return json({ error: 'asset_tag or name is required to register a new PC' }, 400);
    }

    const record: Record<string, unknown> = {
      ...detected,
      // Until an admin assigns a real tag, the host name doubles as one.
      asset_tag: asset_tag || name,
      name: name || asset_tag,
      location: location || 'Unassigned',
      last_reported_at: new Date(),
    };
    if (machine_id) record.machine_id = machine_id;
    if (assigned_users) record.assigned_users = assigned_users;

    const [result]: any = await db.query('INSERT INTO pcs SET ?', [record]);

    return json(
      {
        status: 'created',
        id: result.insertId,
        asset_tag: record.asset_tag,
        machine_id: machine_id || null,
        updated_fields: Object.keys(detected),
      },
      201
    );
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      // Two reports from the same machine can race to the INSERT; the unique
      // machine_id stops the duplicate, and the loser updates the winner's row.
      if (machine_id) {
        const [rows]: any = await db.query('SELECT * FROM pcs WHERE machine_id = ? LIMIT 1', [machine_id]);
        if (rows[0]) {
          const patch = changedFields(rows[0], detected);
          await db.query('UPDATE pcs SET ? WHERE id = ?', [
            { ...patch, last_reported_at: new Date() },
            rows[0].id,
          ]);
          return json(
            {
              status: Object.keys(patch).length > 0 ? 'updated' : 'unchanged',
              id: rows[0].id,
              asset_tag: rows[0].asset_tag,
              machine_id,
              updated_fields: Object.keys(patch),
            },
            200
          );
        }
      }
      return json({ error: 'asset_tag already belongs to another PC' }, 409);
    }
    return json({ error: 'Failed to store the report' }, 500);
  }
};
