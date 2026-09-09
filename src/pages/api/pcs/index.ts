import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { validatePcInput } from '../../../lib/validate';
import { listPcs } from '../../../lib/pcs';

export const prerender = false;

export const GET: APIRoute = async () => {
  const rows = await listPcs();
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const { data, error } = validatePcInput(body);
  if (error || !data) {
    return new Response(JSON.stringify({ error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [result]: any = await db.query('INSERT INTO pcs SET ?', [data]);
    return new Response(JSON.stringify({ id: result.insertId, ...data }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return new Response(JSON.stringify({ error: 'asset_tag already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to create PC' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
