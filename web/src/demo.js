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
let me;
const owner = () => ({ id: 'm_owner', name: (content.profile && content.profile.name) || 'Owner', role: 'admin' });

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
  if (!blocks) { blocks = copy(content); updatedAt = Date.now(); me = owner(); }
  const method = opts.method || (opts.body || opts.form ? 'POST' : 'GET');
  if (path === '/api/site') return { blocks: publicBlocks(), updatedAt };
  if (path === '/api/auth/me') return { me, idleMinutes: 30 };
  if (path === '/api/auth/ping') return { ok: true };
  if (path === '/api/auth/logout') { me = null; return { ok: true }; }
  if (path === '/api/auth/request') return { step: 'password', hasPassword: true };
  if (path === '/api/auth/password') { me = owner(); return { ok: true }; }
  if (path.startsWith('/api/auth/')) fail('Passwords and codes work on the live site. In this preview, any password signs you in.');

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
