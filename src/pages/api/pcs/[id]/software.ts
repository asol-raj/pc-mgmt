import type { APIRoute } from 'astro';
import { softwareOf } from '../../../../lib/pcs';

export const prerender = false;

// Read-only, and public like GET /api/pcs: the register page opens this list in a
// modal for anyone who can see the register.
export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: 'Invalid id' }), { status: 400 });
  }
  const rows = await softwareOf(id);
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
