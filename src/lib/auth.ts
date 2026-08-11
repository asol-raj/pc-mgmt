import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export const SESSION_COOKIE = 'pcmgmt_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function sign(value: string): string {
  const secret = process.env.SESSION_SECRET ?? '';
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH ?? '';
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `admin.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [role, expires, signature] = parts;
  const payload = `${role}.${expires}`;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return false;
  return Number(expires) > Date.now();
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};
