import type { Hono } from 'hono';
import type { Env, Vars } from './env';
import { requireAdmin } from './auth';
import { err, id, now, str } from './lib';
import { cleanJson } from './clean';

type App = Hono<{ Bindings: Env; Variables: Vars }>;

/** Every editable part of the portfolio. Each one is stored as one JSON document. */
export const BLOCK_KEYS = [
  'profile', 'stats', 'principles', 'agentic', 'work', 'experience', 'skills',
  'certifications', 'recommendations', 'education', 'contact', 'seo', 'cv', 'layout',
] as const;
export type BlockKey = (typeof BLOCK_KEYS)[number];
const isBlockKey = (k: string): k is BlockKey => (BLOCK_KEYS as readonly string[]).includes(k);

const MAX_BLOCK_BYTES = 300 * 1024;
const HISTORY_KEEP = 25;
export const FILE_KEY_RE = /^[a-z0-9_]{1,30}\/[a-z0-9_]{6,60}\.(jpg|png|webp|pdf)$/;

type Row = { key: string; data: string; updated_at: number };

export async function readBlocks(env: Env): Promise<{ blocks: Record<string, unknown>; updatedAt: number }> {
  const rows = await env.DB.prepare('SELECT key, data, updated_at FROM blocks').all<Row>();
  const blocks: Record<string, unknown> = {};
  let updatedAt = 0;
  for (const r of rows.results) {
    try { blocks[r.key] = JSON.parse(r.data); } catch { blocks[r.key] = {}; }
    updatedAt = Math.max(updatedAt, r.updated_at || 0);
  }
  for (const k of BLOCK_KEYS) if (!(k in blocks)) blocks[k] = {};
  return { blocks, updatedAt };
}

async function saveBlock(env: Env, key: BlockKey, data: unknown) {
  const json = JSON.stringify(data);
  if (json.length > MAX_BLOCK_BYTES) throw new Error('This section is too large to save. Shorten some of the texts.');
  const t = now();
  const prev = await env.DB.prepare('SELECT data FROM blocks WHERE key = ?').bind(key).first<{ data: string }>();
  const stmts = [];
  if (prev && prev.data !== json) stmts.push(env.DB.prepare('INSERT INTO block_history (id, key, data, saved_at) VALUES (?,?,?,?)').bind(id('h'), key, prev.data, t));
  stmts.push(env.DB.prepare('INSERT INTO blocks (key, data, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind(key, json, t));
  stmts.push(env.DB.prepare('DELETE FROM block_history WHERE key = ? AND id NOT IN (SELECT id FROM block_history WHERE key = ? ORDER BY saved_at DESC LIMIT ?)').bind(key, key, HISTORY_KEEP));
  await env.DB.batch(stmts);
  return t;
}

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export function contentRoutes(app: App) {
  // Everything the public portfolio shows. No sign-in needed.
  app.get('/api/site', async (c) => {
    const { blocks, updatedAt } = await readBlocks(c.env);
    // Hidden recommendations never leave the server.
    const rec = blocks.recommendations as { items?: { visible?: boolean }[] } | undefined;
    if (rec && Array.isArray(rec.items)) blocks.recommendations = { ...rec, items: rec.items.filter((r) => r.visible !== false) };
    return c.json({ blocks, updatedAt });
  });

  // Photographs and the CV. Keys are random, so a file can only be fetched by someone given its link.
  app.get('/api/files/:folder/:name', async (c) => {
    const key = `${c.req.param('folder')}/${c.req.param('name')}`;
    if (!FILE_KEY_RE.test(key)) return err(c, 404, 'No such file.');
    const obj = await c.env.FILES.get(key);
    if (!obj) return err(c, 404, 'No such file.');
    const h = new Headers();
    obj.writeHttpMetadata(h);
    h.set('etag', obj.httpEtag);
    if (key.endsWith('.pdf')) {
      const name = str(c.req.query('name'), 80).replace(/[^A-Za-z0-9 ._-]/g, '').trim() || 'CV.pdf';
      h.set('Content-Disposition', `${c.req.query('download') ? 'attachment' : 'inline'}; filename="${name.endsWith('.pdf') ? name : `${name}.pdf`}"`);
    }
    return new Response(obj.body, { headers: h });
  });

  app.use('/api/admin/*', requireAdmin);

  app.get('/api/admin/blocks', async (c) => {
    const { blocks, updatedAt } = await readBlocks(c.env);
    const counts = await c.env.DB.prepare('SELECT key, COUNT(*) AS n FROM block_history GROUP BY key').all<{ key: string; n: number }>();
    return c.json({ blocks, updatedAt, history: Object.fromEntries(counts.results.map((r) => [r.key, r.n])) });
  });

  app.put('/api/admin/blocks/:key', async (c) => {
    const key = c.req.param('key');
    if (!isBlockKey(key)) return err(c, 404, 'No such section.');
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return err(c, 400, 'Nothing to save.');
    let data: unknown;
    try { data = cleanJson(body); } catch (e) { return err(c, 400, (e as Error).message); }
    try { return c.json({ ok: true, updatedAt: await saveBlock(c.env, key, data), data }); } catch (e) { return err(c, 413, (e as Error).message); }
  });

  // Earlier versions of one section, newest first.
  app.get('/api/admin/history/:key', async (c) => {
    const key = c.req.param('key');
    if (!isBlockKey(key)) return err(c, 404, 'No such section.');
    const rows = await c.env.DB.prepare('SELECT id, saved_at, length(data) AS size FROM block_history WHERE key = ? ORDER BY saved_at DESC LIMIT ?').bind(key, HISTORY_KEEP).all();
    return c.json({ versions: rows.results });
  });

  // Put an earlier version back. The version being replaced is kept, so a restore can itself be undone.
  app.post('/api/admin/history/:id/restore', async (c) => {
    const row = await c.env.DB.prepare('SELECT key, data FROM block_history WHERE id = ?').bind(c.req.param('id')).first<{ key: string; data: string }>();
    if (!row || !isBlockKey(row.key)) return err(c, 404, 'That version no longer exists.');
    const data = JSON.parse(row.data);
    await saveBlock(c.env, row.key, data);
    return c.json({ ok: true, key: row.key, data });
  });

  // One photograph (already resized in the browser) or one PDF (the CV).
  app.post('/api/admin/upload', async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file');
    const folder = str(form?.get('folder'), 30).replace(/[^a-z0-9_]/g, '') || 'misc';
    if (!(file instanceof File)) return err(c, 400, 'Choose a file to upload.');
    const ext = TYPES[file.type];
    if (!ext) return err(c, 400, 'Only JPEG, PNG or WebP images, or a PDF, can be uploaded.');
    if (file.size > (ext === 'pdf' ? MAX_PDF : MAX_IMAGE)) return err(c, 413, `That file is too large. The limit is ${ext === 'pdf' ? 10 : 8} MB.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Check the file really is what its type says (a PDF starts with %PDF, images with their own signatures).
    const sig = Array.from(bytes.slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('');
    const okSig = ext === 'pdf' ? sig === '25504446' : ext === 'png' ? sig === '89504e47' : ext === 'jpg' ? sig.startsWith('ffd8ff') : sig === '52494646';
    if (!okSig) return err(c, 400, 'That file does not look like a real image or PDF.');
    const key = `${folder}/${id()}.${ext}`;
    await c.env.FILES.put(key, bytes, { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' } });
    return c.json({ ok: true, key, name: str(file.name, 120), size: file.size, type: file.type });
  });
}
