// API tests against a LOCAL worker started with DEV_OTP=1 (the admin code is returned in the response).
// Run: npm run dev (in another terminal), then: BASE=http://127.0.0.1:8787 npm run test:api
// Every change made here is undone at the end, and the test checks that the content is back as it started.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) throw new Error('These tests change data. Run them only against a local server.');

const OWNER = 'moinak023@gmail.com';
const PW = 'local test password 2026';

function client() {
  let cookie = '';
  return async (path, { method, body, form, headers = {} } = {}) => {
    const init = { method: method || (body || form ? 'POST' : 'GET'), headers: { cookie, ...headers }, redirect: 'manual' };
    if (form) init.body = form;
    else if (body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
    const r = await fetch(BASE + path, init);
    const set = r.headers.get('set-cookie');
    if (set) cookie = /Max-Age=0|expires=Thu, 01 Jan 1970/i.test(set) ? '' : set.split(';')[0];
    const type = r.headers.get('content-type') || '';
    const data = type.includes('json') ? await r.json() : type.includes('text') || type.includes('xml') ? await r.text() : await r.arrayBuffer();
    return { status: r.status, data, headers: r.headers };
  };
}

const anon = client();
const owner = client();
let startBlocks;

/** A real 1x1 PNG and a tiny real PDF. */
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf00000301010018dd8db40000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

test('the public site loads without signing in, with every section', async () => {
  const r = await anon('/api/site');
  assert.equal(r.status, 200);
  for (const k of ['profile', 'stats', 'agentic', 'work', 'experience', 'skills', 'certifications', 'recommendations', 'education', 'contact', 'seo', 'cv']) assert.ok(r.data.blocks[k], k);
  assert.equal(r.data.blocks.profile.name, 'Moinak Ghosh');
  startBlocks = r.data.blocks;
});

test('pages carry the title, description, link preview and structured data', async () => {
  const r = await anon('/');
  assert.equal(r.status, 200);
  assert.match(r.data, /<title>Moinak Ghosh — Senior Enterprise Architect/);
  assert.match(r.data, /property="og:image" content="[^"]+\/og\.png"/);
  assert.match(r.data, /"@type":"Person"/);
  assert.match(r.data, /<meta name="robots" content="index, follow"/);
  assert.match(r.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  const cv = await anon('/cv');
  assert.match(cv.data, /<title>CV · Moinak Ghosh<\/title>/);
  const adm = await anon('/admin');
  assert.match(adm.headers.get('x-robots-tag') || '', /noindex/);
  assert.match(adm.data, /content="noindex, nofollow"/);
  const robots = await anon('/robots.txt');
  assert.match(robots.data, /Disallow: \/admin/);
  const map = await anon('/sitemap.xml');
  assert.match(map.data, /<loc>[^<]+\/cv<\/loc>/);
});

test('the admin API is closed without signing in', async () => {
  assert.equal((await anon('/api/admin/blocks')).status, 401);
  assert.equal((await anon('/api/admin/blocks/profile', { method: 'PUT', body: { name: 'x' } })).status, 401);
  assert.equal((await anon('/api/admin/upload', { form: new FormData() })).status, 401);
  assert.equal((await anon('/api/auth/me')).data.me, null);
});

test('only the owner address reaches the password step', async () => {
  const other = await anon('/api/auth/request', { body: { email: 'someone@example.test' } });
  assert.equal(other.data.step, 'blocked');
  const me = await anon('/api/auth/request', { body: { email: OWNER } });
  assert.equal(me.data.step, 'password');
  const setup = await anon('/api/auth/setup/request', { body: { email: 'someone@example.test' } });
  assert.equal(setup.status, 200);
  assert.equal(setup.data.devCode, undefined, 'no code is created for other addresses');
});

test('requests from another website are refused', async () => {
  const r = await anon('/api/auth/request', { body: { email: OWNER }, headers: { origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
});

test('the owner sets a password with the emailed code and is signed in', async () => {
  const req = await owner('/api/auth/setup/request', { body: { email: OWNER } });
  assert.equal(req.status, 200);
  assert.match(req.data.devCode, /^\d{6}$/);
  const wrong = await owner('/api/auth/setup/verify', { body: { email: OWNER, code: req.data.devCode === '000000' ? '111111' : '000000', password: PW } });
  assert.equal(wrong.status, 400);
  const weak = await owner('/api/auth/setup/verify', { body: { email: OWNER, code: req.data.devCode, password: 'short' } });
  assert.equal(weak.status, 400);
  const ok = await owner('/api/auth/setup/verify', { body: { email: OWNER, code: req.data.devCode, password: PW } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.me.admin, true);
  const again = await owner('/api/auth/setup/verify', { body: { email: OWNER, code: req.data.devCode, password: PW } });
  assert.equal(again.status, 400, 'a code works once');
  assert.equal((await owner('/api/auth/me')).data.me.email, OWNER);
});

test('a wrong password is refused, the right one signs in', async () => {
  const c = client();
  assert.equal((await c('/api/auth/password', { body: { email: OWNER, password: 'wrong password here' } })).status, 400);
  assert.equal((await c('/api/auth/password', { body: { email: 'someone@example.test', password: PW } })).status, 400);
  const ok = await c('/api/auth/password', { body: { email: OWNER, password: PW } });
  assert.equal(ok.status, 200);
  assert.equal((await c('/api/admin/blocks')).status, 200);
  await c('/api/auth/logout', { method: 'POST' });
  assert.equal((await c('/api/admin/blocks')).status, 401);
});

test('saving a section changes the public site and keeps the earlier version', async () => {
  const before = (await owner('/api/admin/blocks')).data;
  const profile = { ...before.blocks.profile, intro: 'API test introduction.' };
  const r = await owner('/api/admin/blocks/profile', { method: 'PUT', body: profile });
  assert.equal(r.status, 200);
  assert.equal((await anon('/api/site')).data.blocks.profile.intro, 'API test introduction.');
  const hist = await owner('/api/admin/history/profile');
  assert.ok(hist.data.versions.length >= 1);
  const restore = await owner(`/api/admin/history/${hist.data.versions[0].id}/restore`, { method: 'POST' });
  assert.equal(restore.status, 200);
  assert.equal((await anon('/api/site')).data.blocks.profile.intro, startBlocks.profile.intro);
});

test('bad saves are refused with a plain message', async () => {
  assert.equal((await owner('/api/admin/blocks/nonsense', { method: 'PUT', body: { a: 1 } })).status, 404);
  assert.equal((await owner('/api/admin/blocks/profile', { method: 'PUT', body: [1, 2] })).status, 400);
  const badKey = await owner('/api/admin/blocks/profile', { method: 'PUT', body: { 'bad key': 1 } });
  assert.equal(badKey.status, 400);
  assert.match(badKey.data.error, /field name/);
  const huge = await owner('/api/admin/blocks/contact', { method: 'PUT', body: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, 'x'.repeat(19000)])) });
  assert.equal(huge.status, 413);
});

test('hidden recommendations never reach visitors', async () => {
  const rec = (await owner('/api/admin/blocks')).data.blocks.recommendations;
  const hiddenOne = { id: 'rtest', name: 'Hidden Person', text: 'Should not be public', visible: false };
  await owner('/api/admin/blocks/recommendations', { method: 'PUT', body: { ...rec, items: [...rec.items, hiddenOne] } });
  const pub = (await anon('/api/site')).data.blocks.recommendations.items;
  assert.ok(!pub.some((r) => r.id === 'rtest'));
  assert.ok((await owner('/api/admin/blocks')).data.blocks.recommendations.items.some((r) => r.id === 'rtest'));
  await owner('/api/admin/blocks/recommendations', { method: 'PUT', body: rec });
});

test('uploads: real images and PDFs only, served back with the right type', async () => {
  const f1 = new FormData(); f1.append('file', new Blob([PNG], { type: 'image/png' }), 'dot.png'); f1.append('folder', 'profile');
  const img = await owner('/api/admin/upload', { form: f1 });
  assert.equal(img.status, 200);
  assert.match(img.data.key, /^profile\/[a-f0-9]+\.png$/);
  const got = await anon(`/api/files/${img.data.key}`);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('content-type'), 'image/png');
  assert.match(got.headers.get('cache-control') || '', /immutable/);

  const f2 = new FormData(); f2.append('file', new Blob([PDF], { type: 'application/pdf' }), 'cv.pdf'); f2.append('folder', 'cv');
  const pdf = await owner('/api/admin/upload', { form: f2 });
  assert.equal(pdf.status, 200);
  const dl = await anon(`/api/files/${pdf.data.key}?download=1&name=Moinak-Ghosh-CV.pdf`);
  assert.equal(dl.headers.get('content-type'), 'application/pdf');
  assert.match(dl.headers.get('content-disposition') || '', /attachment; filename="Moinak-Ghosh-CV.pdf"/);

  const fake = new FormData(); fake.append('file', new Blob([Buffer.from('<html>not a pdf</html>')], { type: 'application/pdf' }), 'x.pdf');
  assert.equal((await owner('/api/admin/upload', { form: fake })).status, 400);
  const svg = new FormData(); svg.append('file', new Blob([Buffer.from('<svg/>')], { type: 'image/svg+xml' }), 'x.svg');
  assert.equal((await owner('/api/admin/upload', { form: svg })).status, 400);
  assert.equal((await anon('/api/files/../secret.txt')).status, 404);
  assert.equal((await anon('/api/files/profile/nothere123456.png')).status, 404);
});

test('changing the password signs out other devices', async () => {
  const other = client();
  await other('/api/auth/password', { body: { email: OWNER, password: PW } });
  assert.equal((await other('/api/admin/blocks')).status, 200);
  const NEW = 'another local password 2026';
  assert.equal((await owner('/api/auth/change-password', { body: { current: 'wrong one here', password: NEW } })).status, 400);
  assert.equal((await owner('/api/auth/change-password', { body: { current: PW, password: NEW } })).status, 200);
  assert.equal((await other('/api/admin/blocks')).status, 401);
  assert.equal((await owner('/api/admin/blocks')).status, 200);
  assert.equal((await owner('/api/auth/change-password', { body: { current: NEW, password: PW } })).status, 200);
});

after(async () => {
  // Put every section back exactly as it started.
  if (startBlocks) {
    for (const [k, v] of Object.entries(startBlocks)) {
      if (k === 'recommendations') continue; // restored inside its own test (the public copy hides hidden entries)
      await owner(`/api/admin/blocks/${k}`, { method: 'PUT', body: v });
    }
    const now = (await anon('/api/site')).data.blocks;
    assert.deepEqual(now, startBlocks, 'content is back as it started');
  }
  await owner('/api/auth/logout', { method: 'POST' });
});
