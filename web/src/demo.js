// Preview mode only (VITE_DEMO=1): a pretend server that keeps everything in memory, so the preview copy can show
// both the portfolio and the admin console. Nothing is saved; reloading the preview starts again.
// The normal build never includes this file.
import { content } from '../../seed/content.mjs';

// Nothing runs when this file is loaded (the state is made on first use), so the normal build can drop it entirely.
const copy = (v) => JSON.parse(JSON.stringify(v));
let blocks = null;
const history = {}; // key → [{ id, saved_at, data }]
let updatedAt = 0;
let nextId = 1;
let me = null; // the preview starts signed out, like the real site
// Sign-in works like the real site: only the owner's address, and a password set with a 6-digit code. The preview
// cannot send email, so the code is shown on screen. The password lasts until the preview is reloaded.
let password = '';
let code = '';
const owner = () => ({ id: 'm_owner', name: (content.profile && content.profile.name) || 'Owner', email: ownerEmail(), role: 'admin', admin: true });
const ownerEmail = () => String((content.profile && content.profile.email) || '').trim().toLowerCase();
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
const isOwner = (v) => String(v || '').trim().toLowerCase() === ownerEmail();
const NOT_ADMIN = 'This sign-in is only for the owner of this portfolio.';
// The same rules as the server (src/lib.ts passwordProblem).
function passwordProblem(pw, email) {
  if (pw.length < 10) return 'Use at least 10 characters for the password.';
  if (pw.length > 200) return 'That password is too long.';
  if (email && pw.toLowerCase().includes(email.split('@')[0].toLowerCase())) return 'Do not use your email address in the password.';
  if (/^(.)\1+$/.test(pw)) return 'That password is too easy to guess.';
  return '';
}

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

function publicBlocks() {
  const out = copy(blocks);
  if (out.recommendations && Array.isArray(out.recommendations.items)) out.recommendations.items = out.recommendations.items.filter((r) => r.visible !== false);
  return out;
}

function save(key, data) {
  const list = history[key] || (history[key] = []);
  if (blocks[key] !== undefined) list.unshift({ id: nextId++, saved_at: new Date().toISOString(), data: copy(blocks[key]) });
  list.splice(25);
  blocks[key] = copy(data);
  updatedAt = Date.now();
  return { data: copy(blocks[key]) };
}

export async function demoApi(path, opts = {}) {
  if (!blocks) { blocks = copy(content); updatedAt = Date.now(); }
  const method = opts.method || (opts.body || opts.form ? 'POST' : 'GET');
  const body = opts.body || {};
  if (path === '/api/site') return { blocks: publicBlocks(), updatedAt };
  if (path === '/api/auth/me') return { me, idleMinutes: 30 };
  if (path === '/api/auth/ping') return me ? { ok: true } : fail('Sign in to continue.', 401);
  if (path === '/api/auth/logout') { me = null; return { ok: true }; }
  if (path === '/api/auth/request') {
    if (!isEmail(body.email)) fail('Enter a valid email address.');
    return isOwner(body.email) ? { ok: true, step: 'password', hasPassword: !!password } : { ok: true, step: 'blocked', message: NOT_ADMIN };
  }
  if (path === '/api/auth/password') {
    if (!isEmail(body.email) || !body.password) fail('Enter your email address and password.');
    if (!isOwner(body.email) || !password || body.password !== password) fail('The email address or password is not right.');
    me = owner();
    return { ok: true, me };
  }
  if (path === '/api/auth/setup/request') {
    if (!isEmail(body.email)) fail('Enter a valid email address.');
    if (!isOwner(body.email)) return { ok: true, message: 'If that is the owner address, a 6-digit code has been sent to the owner\'s email.' };
    code = String(Math.floor(100000 + Math.random() * 900000));
    return { ok: true, message: 'This is the preview, so no email is sent.', devCode: code };
  }
  if (path === '/api/auth/setup/verify') {
    if (!isEmail(body.email) || !/^\d{6}$/.test(String(body.code || ''))) fail('Enter the 6-digit code from your email.');
    if (!isOwner(body.email) || !code || body.code !== code) fail('That code is not right. Check the email and try again.');
    const weak = passwordProblem(String(body.password || ''), ownerEmail());
    if (weak) fail(weak);
    password = String(body.password);
    code = '';
    me = owner();
    return { ok: true, me };
  }
  if (path === '/api/auth/change-password') {
    if (!me) fail('Sign in to continue.', 401);
    if (body.current !== password) fail('Your current password is not right.');
    const weak = passwordProblem(String(body.password || ''), ownerEmail());
    if (weak) fail(weak);
    if (body.password === body.current) fail('Choose a password that is different from the current one.');
    password = String(body.password);
    return { ok: true };
  }
  if (path.startsWith('/api/auth/')) fail('This works on the live site, not in the preview copy.');

  if (!me && path.startsWith('/api/admin/')) fail('Please sign in again.', 401);
  if (path === '/api/admin/blocks' && method === 'GET') {
    return { blocks: copy(blocks), updatedAt, history: Object.fromEntries(Object.entries(history).map(([k, v]) => [k, v.length])) };
  }
  let m = /^\/api\/admin\/blocks\/([a-z]+)$/.exec(path);
  if (m && method === 'PUT') return save(m[1], opts.body);
  m = /^\/api\/admin\/history\/([a-z]+)$/.exec(path);
  if (m) return { versions: (history[m[1]] || []).map(({ id, saved_at }) => ({ id, saved_at })) };
  m = /^\/api\/admin\/history\/(\d+)\/restore$/.exec(path);
  if (m) {
    const id = Number(m[1]);
    const key = Object.keys(history).find((k) => history[k].some((v) => v.id === id));
    if (!key) fail('That version was not found.', 404);
    return save(key, history[key].find((v) => v.id === id).data);
  }
  if (path === '/api/admin/upload') {
    const file = opts.form && opts.form.get('file');
    if (!file) fail('Choose a file first.');
    return { key: URL.createObjectURL(file), name: file.name, size: file.size, type: file.type };
  }
  return fail('This works on the live site, not in the preview copy.');
}
