import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { pcsToCsv } from '../../../lib/csv';
import type { Pc } from '../../../lib/types';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.isAuthed) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [rows] = await db.query('SELECT * FROM pcs ORDER BY name ASC');
  const csv = pcsToCsv(rows as Pc[]);
  const filename = `pcs-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
