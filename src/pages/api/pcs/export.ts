import type { APIRoute } from 'astro';
import { listPcs } from '../../../lib/pcs';
import { pcsToCsv } from '../../../lib/csv';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.isAuthed) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const csv = pcsToCsv(await listPcs());
  const filename = `pcs-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
