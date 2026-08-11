import 'dotenv/config';
import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, isValidSessionToken } from './lib/auth';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE']);

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;
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
