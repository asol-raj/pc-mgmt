import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { validatePcInput } from '../../../lib/validate';
import { parseCsv } from '../../../lib/csv';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? '';
  let text: string;

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return new Response(JSON.stringify({ error: 'No CSV file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      text = await file.text();
    } else {
      text = await request.text();
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to read upload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!text.trim()) {
    return new Response(JSON.stringify({ error: 'CSV file is empty' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = parseCsv(text);
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: 'No data rows found in CSV' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let created = 0;
  let updated = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const { data, error } = validatePcInput(rows[i]);
    if (error || !data) {
      errors.push({ row: i + 2, error: error ?? 'Invalid row' });
      continue;
    }

    try {
      const [existing]: any = await db.query('SELECT id FROM pcs WHERE asset_tag = ?', [data.asset_tag]);
      if (existing.length > 0) {
        await db.query('UPDATE pcs SET ? WHERE id = ?', [data, existing[0].id]);
        updated++;
      } else {
        await db.query('INSERT INTO pcs SET ?', [data]);
        created++;
      }
    } catch (err: any) {
      errors.push({ row: i + 2, error: err?.sqlMessage || 'Database error' });
    }
  }

  return new Response(JSON.stringify({ created, updated, errors }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
