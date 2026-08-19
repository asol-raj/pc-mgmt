import 'dotenv/config';
import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, isValidSessionToken } from './lib/auth';
import { extractApiKey, isValidApiKey } from './lib/agentAuth';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE']);

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  // The agent API is machine-to-machine: API key instead of an admin session.
  if (pathname.startsWith('/api/agent')) {
    if (!isValidApiKey(extractApiKey(context.request))) {
      return new Response(JSON.stringify({ error: 'Invalid or missing API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return next();
  }

  const token = context.cookies.get(SESSION_COOKIE)?.value;
  const isAuthed = isValidSessionToken(token);

  context.locals.isAuthed = isAuthed;

  const isAdminPage = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const isProtectedApi =
    pathname.startsWith('/api/pcs') && MUTATING_METHODS.has(context.request.method);

  if ((isAdminPage || isProtectedApi) && !isAuthed) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return context.redirect('/admin/login');
  }

  return next();
});
