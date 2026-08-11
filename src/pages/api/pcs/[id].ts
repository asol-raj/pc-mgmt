import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { validatePcInput } from '../../../lib/validate';

export const prerender = false;

export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: 'Invalid id' }), { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const { data, error } = validatePcInput(body);
  if (error || !data) {
    return new Response(JSON.stringify({ error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [result]: any = await db.query('UPDATE pcs SET ? WHERE id = ?', [data, id]);
    if (result.affectedRows === 0) {
      return new Response(JSON.stringify({ error: 'PC not found' }), { status: 404 });
    }
    return new Response(JSON.stringify({ id, ...data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return new Response(JSON.stringify({ error: 'asset_tag already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to update PC' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: 'Invalid id' }), { status: 400 });
  }

  const [result]: any = await db.query('DELETE FROM pcs WHERE id = ?', [id]);
  if (result.affectedRows === 0) {
    return new Response(JSON.stringify({ error: 'PC not found' }), { status: 404 });
  }
  return new Response(null, { status: 204 });
};
