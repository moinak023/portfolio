import { Hono, type Context, type Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env, Member, Vars } from './env';
import { err, hashPassword, id, isEmail, normEmail, now, passwordProblem, randomToken, sha256, str, verifyPassword } from './lib';
import { sendMail, setupMail } from './email';

// The portfolio is public. Only the admin console needs a sign-in, and only the owner can sign in.
// On HTTPS the cookie carries the __Host- prefix: the browser only accepts it from this exact site, over HTTPS.
const COOKIE_SECURE = '__Host-portfolio_session';
const COOKIE_LOCAL = 'portfolio_session';
const OTP_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_PER_WINDOW = 4; // codes per 15 minutes
const PASSWORD_FAILS_PER_WINDOW = 8; // wrong passwords per 15 minutes
const LOOKUPS_PER_WINDOW = 10; // wrong email addresses one connection may try per 15 minutes
const WINDOW = 15 * 60 * 1000;
const SESSION_HOURS = 12; // a session never lasts longer than this, even with activity
const TOUCH_EVERY = 60 * 1000;
const DUMMY_HASH = `pbkdf2$100000$${'A'.repeat(22)}==$${'A'.repeat(43)}=`;

type Ctx = Context<{ Bindings: Env; Variables: Vars }>;
type App = Hono<{ Bindings: Env; Variables: Vars }>;

export const me = (m: Member) => ({ id: m.id, name: m.name, email: m.email, admin: true });

const isSecure = (c: Context) => new URL(c.req.url).protocol === 'https:';
const cookieName = (c: Context) => (isSecure(c) ? COOKIE_SECURE : COOKIE_LOCAL);
export const readToken = (c: Context) => getCookie(c, cookieName(c)) || '';

export const idleMinutes = (env: Env) => {
  const n = Number(env.IDLE_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 30;
};

export const ownerEmail = (env: Env) => normEmail(env.OWNER_EMAIL || '');

/** The signed-in administrator, or null. `idle` is set when the session has just ended for inactivity. */
export async function sessionFromRequest(c: Ctx): Promise<{ member: Member; idle?: false } | { idle: true } | null> {
  const token = readToken(c);
  if (!token) return null;
  const sid = await sha256(token);
  const t = now();
  const row = await c.env.DB.prepare(
    'SELECT m.*, s.created_at AS s_created, s.last_seen_at AS s_seen FROM sessions s JOIN members m ON m.id = s.member_id WHERE s.id = ? AND s.expires_at > ?',
  ).bind(sid, t).first<Member & { s_created: number; s_seen: number }>();
  if (!row || row.status !== 'active' || row.role !== 'admin') return null;
  const lastSeen = Math.max(row.s_seen || 0, row.s_created || 0);
  if (t - lastSeen > idleMinutes(c.env) * 60 * 1000) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
    return { idle: true };
  }
  if (t - (row.s_seen || 0) > Math.min(TOUCH_EVERY, idleMinutes(c.env) * 15000)) await c.env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(t, sid).run();
  const { s_created, s_seen, ...member } = row;
  return { member };
}

/** Middleware: requires the signed-in administrator. */
export async function requireAdmin(c: Ctx, next: Next) {
  const s = await sessionFromRequest(c);
  if (!s || s.idle) {
    return s && s.idle
      ? c.json({ error: `For security, you were signed out after ${idleMinutes(c.env)} minutes without activity. Please sign in again.`, reason: 'idle' }, 401)
      : err(c, 401, 'Sign in to continue.');
  }
  c.set('member', s.member);
  await next();
}

async function openSession(c: Ctx, member: Member) {
  const token = randomToken();
  const t = now();
  await c.env.DB.prepare('INSERT INTO sessions (id, member_id, created_at, expires_at, user_agent, last_seen_at) VALUES (?,?,?,?,?,?)')
    .bind(await sha256(token), member.id, t, t + SESSION_HOURS * 3600000, str(c.req.header('user-agent'), 200), t).run();
  if (Math.random() < 0.1) {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
      c.env.DB.prepare('DELETE FROM otp_codes WHERE created_at < ?').bind(t - 86400000),
      c.env.DB.prepare('DELETE FROM auth_failures WHERE created_at < ?').bind(t - 86400000),
    ]);
  }
  setCookie(c, cookieName(c), token, { httpOnly: true, secure: isSecure(c), sameSite: 'Strict', path: '/', maxAge: SESSION_HOURS * 3600 });
}

const findAdmin = (c: Ctx, email: string) => c.env.DB.prepare("SELECT * FROM members WHERE email = ? AND role = 'admin'").bind(email).first<Member>();

async function tooMany(c: Ctx, key: string, limit: number) {
  const r = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM auth_failures WHERE email = ? AND created_at > ?').bind(key, now() - WINDOW).first<{ n: number }>();
  return (r?.n ?? 0) >= limit;
}
const note = (c: Ctx, key: string) => c.env.DB.prepare('INSERT INTO auth_failures (id, email, created_at) VALUES (?,?,?)').bind(id('af'), key, now()).run();

/** Creates a 6-digit code for setting the admin password and emails it to the OWNER. Returns an error Response, or the dev code / ''. */
async function issueCode(c: Ctx, email: string): Promise<Response | string> {
  const recent = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM otp_codes WHERE email = ? AND created_at > ?').bind(email, now() - WINDOW).first<{ n: number }>();
  if ((recent?.n ?? 0) >= OTP_PER_WINDOW) return err(c, 429, 'Too many codes requested. Wait 15 minutes and try again.');
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const t = now();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE otp_codes SET consumed = 1 WHERE email = ? AND consumed = 0').bind(email),
    c.env.DB.prepare('INSERT INTO otp_codes (id, email, code_hash, expires_at, attempts, consumed, created_at) VALUES (?,?,?,?,0,0,?)')
      .bind(id('otp'), email, await sha256(`setup:${email}:${code}`), t + OTP_MINUTES * 60 * 1000, t),
  ]);
  const dev = c.env.DEV_OTP === '1';
  let sent = false;
  try {
    sent = await sendMail(c.env, setupMail(c.env, ownerEmail(c.env) || email, code, OTP_MINUTES));
  } catch (e) {
    console.error(`Admin code email failed (key set: ${Boolean(c.env.RESEND_API_KEY)}): ${(e instanceof Error ? e.message : String(e)).slice(0, 500)}`);
    if (!dev) return err(c, 500, 'The email could not be sent. Please try again in a minute.');
  }
  if (dev) { console.log(`[DEV] admin code for ${email}: ${code}`); return code; }
  if (!sent) return err(c, 500, 'Email sending is not configured on the server yet.');
  return '';
}

async function checkCode(c: Ctx, email: string, code: string): Promise<Response | null> {
  const otp = await c.env.DB.prepare('SELECT * FROM otp_codes WHERE email = ? AND consumed = 0 ORDER BY created_at DESC LIMIT 1')
    .bind(email).first<{ id: string; code_hash: string; expires_at: number; attempts: number }>();
  if (!otp || otp.expires_at < now()) return err(c, 400, 'That code has expired. Ask for a new one.');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return err(c, 429, 'Too many wrong attempts. Ask for a new code.');
  if (otp.code_hash !== (await sha256(`setup:${email}:${code}`))) {
    await c.env.DB.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').bind(otp.id).run();
    return err(c, 400, 'That code is not right. Check the email and try again.');
  }
  await c.env.DB.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').bind(otp.id).run();
  return null;
}

const cleanCode = (v: unknown) => str(v, 20).replace(/\D/g, '');
const NOT_ADMIN = 'This sign-in is only for the owner of this portfolio.';

export function authRoutes(app: App) {
  // Step 1: the email address. Only the owner's address goes on to the password step.
  app.post('/api/auth/request', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = normEmail(body.email);
    if (!isEmail(email)) return err(c, 400, 'Enter a valid email address.');
    const ip = `ip:${c.req.header('cf-connecting-ip') || 'local'}`;
    if (await tooMany(c, ip, LOOKUPS_PER_WINDOW)) return err(c, 429, 'Too many attempts. Wait 15 minutes and try again.');
    const admin = await findAdmin(c, email);
    if (!admin || admin.status !== 'active') {
      await note(c, ip);
      return c.json({ ok: true, step: 'blocked', message: NOT_ADMIN });
    }
    return c.json({ ok: true, step: 'password', hasPassword: !!admin.password_hash });
  });

  app.post('/api/auth/password', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = normEmail(body.email);
    const password = String(body.password ?? '').slice(0, 200);
    if (!isEmail(email) || !password) return err(c, 400, 'Enter your email address and password.');
    if (await tooMany(c, email, PASSWORD_FAILS_PER_WINDOW)) return err(c, 429, 'Too many wrong passwords. Wait 15 minutes and try again.');
    const admin = await findAdmin(c, email);
    const ok = admin && admin.status === 'active' && admin.password_hash
      ? await verifyPassword(password, admin.password_hash)
      : (await verifyPassword(password, DUMMY_HASH), false); // same work either way, so timing reveals nothing
    if (!ok || !admin) {
      await note(c, email);
      return err(c, 400, 'The email address or password is not right.');
    }
    await c.env.DB.prepare('DELETE FROM auth_failures WHERE email = ?').bind(email).run();
    await openSession(c, admin);
    return c.json({ ok: true, me: me(admin) });
  });

  // Setting or resetting the admin password needs a 6-digit code, which is always emailed to the owner.
  app.post('/api/auth/setup/request', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = normEmail(body.email);
    if (!isEmail(email)) return err(c, 400, 'Enter a valid email address.');
    const generic = { ok: true, message: 'If that is the owner address, a 6-digit code has been sent to the owner\'s email.' };
    const admin = await findAdmin(c, email);
    if (!admin || admin.status !== 'active') return c.json(generic);
    const r = await issueCode(c, email);
    if (r instanceof Response) return r;
    const message = 'We have sent a 6-digit code to your email address.';
    return c.json(r ? { ok: true, message, devCode: r } : { ok: true, message });
  });

  app.post('/api/auth/setup/verify', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = normEmail(body.email);
    const code = cleanCode(body.code);
    const password = String(body.password ?? '');
    if (!isEmail(email) || !/^\d{6}$/.test(code)) return err(c, 400, 'Enter the 6-digit code from your email.');
    const weak = passwordProblem(password, email);
    if (weak) return err(c, 400, weak);
    const admin = await findAdmin(c, email);
    if (!admin || admin.status !== 'active') return err(c, 400, 'That code has expired. Ask for a new one.');
    const bad = await checkCode(c, email, code);
    if (bad) return bad;
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE members SET password_hash = ?, password_set_at = ? WHERE id = ?').bind(await hashPassword(password), now(), admin.id),
      c.env.DB.prepare('DELETE FROM sessions WHERE member_id = ?').bind(admin.id),
      c.env.DB.prepare('DELETE FROM auth_failures WHERE email = ?').bind(email),
    ]);
    await openSession(c, admin);
    return c.json({ ok: true, me: me(admin) });
  });

  app.post('/api/auth/change-password', requireAdmin, async (c) => {
    const m = c.get('member');
    const body = await c.req.json().catch(() => ({}));
    const current = String(body.current ?? '');
    const password = String(body.password ?? '');
    if (!(await verifyPassword(current, m.password_hash || ''))) return err(c, 400, 'Your current password is not right.');
    const weak = passwordProblem(password, m.email);
    if (weak) return err(c, 400, weak);
    if (password === current) return err(c, 400, 'Choose a password that is different from the current one.');
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE members SET password_hash = ?, password_set_at = ? WHERE id = ?').bind(await hashPassword(password), now(), m.id),
      c.env.DB.prepare('DELETE FROM sessions WHERE member_id = ? AND id != ?').bind(m.id, await sha256(readToken(c))),
    ]);
    return c.json({ ok: true });
  });

  app.post('/api/auth/logout', async (c) => {
    const token = readToken(c);
    if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
    deleteCookie(c, cookieName(c), { path: '/', secure: isSecure(c) });
    return c.json({ ok: true });
  });

  app.get('/api/auth/me', async (c) => {
    const s = await sessionFromRequest(c);
    return c.json({ me: s && !s.idle ? me(s.member) : null, idleMinutes: idleMinutes(c.env) });
  });

  // Called every few minutes while the owner is actively editing, so an open admin page does not time out.
  app.post('/api/auth/ping', requireAdmin, (c) => c.json({ ok: true, idleMinutes: idleMinutes(c.env) }));
}
