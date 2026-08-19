import crypto from 'node:crypto';

// Header the agent app sends its key in. `Authorization: Bearer <key>` works too.
export const AGENT_KEY_HEADER = 'x-api-key';

function configuredKeys(): string[] {
  return (process.env.AGENT_API_KEY ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

// Hash both sides first so the compare is timing-safe even for unequal lengths.
function keysMatch(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function extractApiKey(request: Request): string {
  const header = request.headers.get(AGENT_KEY_HEADER);
  if (header) return header.trim();

  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  return bearer ? bearer[1].trim() : '';
}

export function isValidApiKey(key: string): boolean {
  if (!key) return false;
  const keys = configuredKeys();
  // No key configured means the agent API stays shut, rather than wide open.
  if (keys.length === 0) return false;
  return keys.some((configured) => keysMatch(configured, key));
}
