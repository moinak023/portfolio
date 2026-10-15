import type { Context } from 'hono';

export const now = () => Date.now();

export function id(prefix = ''): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${hex}` : hex;
}

export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const normEmail = (e: unknown): string => String(e || '').trim().toLowerCase();

export const isEmail = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

export const str = (v: unknown, max = 2000): string => String(v ?? '').trim().slice(0, max);

export function err(c: Context, status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503, message: string) {
  return c.json({ error: message }, status);
}

/* ---------- passwords (administrators only) ---------- */

const PBKDF2_ITERATIONS = 100000; // the maximum Cloudflare Workers allows
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

/** Returns "pbkdf2$<iterations>$<salt>$<hash>" for storage. */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(await pbkdf2(password, salt, PBKDF2_ITERATIONS))}`;
}

/** Compares a password with a stored hash in constant time. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false;
  const got = new Uint8Array(await pbkdf2(password, unb64(salt), Number(iter)));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i += 1) diff |= got[i] ^ want[i];
  return diff === 0;
}

/** Returns an error message when a new password is too weak, or '' when it is acceptable. */
export function passwordProblem(password: string, email = ''): string {
  if (password.length < 10) return 'Use at least 10 characters for the password.';
  if (password.length > 200) return 'That password is too long.';
  if (email && password.toLowerCase().includes(email.split('@')[0].toLowerCase())) return 'Do not use your email address in the password.';
  if (/^(.)\1+$/.test(password)) return 'That password is too easy to guess.';
  return '';
}

/**
 * Where a request should be sent instead, or '' to serve it. moinakghosh.com, www.moinakghosh.com and
 * www.profile.moinakghosh.com move to the site's one address (siteHost), keeping the path and query.
 * Any other www. address loses the www. Other addresses (local testing, workers.dev, other subdomains) are served.
 */
export function redirectTarget(requestUrl: string, siteHost = ''): string {
  const url = new URL(requestUrl);
  const parent = siteHost ? siteHost.split('.').slice(1).join('.') : '';
  if (siteHost && url.hostname !== siteHost && [parent, `www.${parent}`, `www.${siteHost}`].includes(url.hostname)) {
    url.hostname = siteHost;
    url.protocol = 'https:';
    url.port = '';
    return url.toString();
  }
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    return url.toString();
  }
  return '';
}
