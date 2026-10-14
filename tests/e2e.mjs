// End-to-end browser test against a LOCAL worker with DEV_OTP=1.
// Runs the public portfolio, the CV page and every admin function on a desktop and a phone, saves screenshots,
// and fails on console errors, sideways scrolling, cropped photographs or admin changes that do not reach the site.
// Run: BASE=http://127.0.0.1:8787 ADMIN_PW='...' SHOTS=./shots node tests/e2e.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) throw new Error('Run only against a local server.');
const OWNER = 'moinak023@gmail.com';
const PW = process.env.ADMIN_PW || 'local test password 2026';
const SHOTS = process.env.SHOTS || './shots';
mkdirSync(SHOTS, { recursive: true });

const results = [];
const problems = [];
const check = (ok, what) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) problems.push(what); };

function testPng(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x += 1) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 20 + (x * 180) / w; raw[o + 1] = 80 + (y * 120) / h; raw[o + 2] = 110; }
  }
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PORTRAIT = `${SHOTS}/test-portrait.png`;
writeFileSync(PORTRAIT, testPng(600, 860));
const PDF = `${SHOTS}/test-cv.pdf`;
writeFileSync(PDF, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

async function noSideScroll(page, label) {
  const x = await page.evaluate(() => { const y = scrollY; scrollTo(400, y); const moved = scrollX; scrollTo(0, y); return moved; });
  check(x === 0, `${label}: page does not move sideways (moved ${x}px)`);
}
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(300, innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 70)); }
    scrollTo(0, 0);
  });
}
async function shot(page, name, full = false) {
  if (!full) { await page.screenshot({ path: `${SHOTS}/${name}.png` }); return; }
  const { h, vh } = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
  let i = 0;
  for (let y = 0; y < h && i < 40; y += vh - 80, i += 1) {
    await page.evaluate((yy) => scrollTo({ top: yy, behavior: 'instant' }), y);
    await page.waitForTimeout(650);
    await page.screenshot({ path: `${SHOTS}/${name}-${String(i + 1).padStart(2, '0')}.png` });
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
}
async function wholePhoto(page, selector, label) {
  await page.waitForFunction((sel) => { const i = document.querySelector(sel); return i && i.complete && i.naturalWidth > 0; }, selector, { timeout: 10000 }).catch(() => {});
  const r = await page.$eval(selector, (i) => { const b = i.getBoundingClientRect(); return { nat: i.naturalWidth / i.naturalHeight, shown: b.width / b.height, fit: getComputedStyle(i).objectFit }; }).catch(() => null);
  check(!!r && Math.abs(r.nat - r.shown) / r.nat < 0.03 && r.fit !== 'cover', `${label}: photograph shown whole at its own shape ${JSON.stringify(r)}`);
}
/** Waits for a toast whose text matches (an older toast may still be on screen). */
const toastSays = async (page, re) => page.waitForFunction((src) => {
  const t = document.querySelector('.toast');
  return !!t && new RegExp(src, 'i').test(t.textContent || '');
}, re.source, { timeout: 8000 }).then(() => true).catch(() => false);
const publicSite = async (page) => page.evaluate(async () => (await (await fetch('/api/site')).json()).blocks);
/** Polls the public site until the condition holds (saves are quick, but the check must not race them). */
const siteSoon = async (page, fn, ms = 6000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn(await publicSite(page))) return true; await page.waitForTimeout(250); }
  return false;
};

async function signIn(page) {
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', OWNER);
  await page.click('button[type=submit]');
  await page.waitForSelector('#login-password, .login-form h2:has-text("Set a new password")');
  if (await page.$('#login-password')) {
    await page.fill('#login-password', PW);
    await page.click('button[type=submit]');
  } else {
    await page.click('button[type=submit]');
    const note = await page.waitForSelector('.login-form p:has-text("Development code")').then((e) => e.textContent());
    const code = /(\d{6})/.exec(note)[1];
    await page.fill('#login-code', code);
    await page.fill('#new-password', PW);
    await page.fill('#new-password2', PW);
    await page.click('button[type=submit]');
  }
  await page.waitForSelector('.a-shell');
}

async function run(kind) {
  const browser = await chromium.launch();
  const ctx = kind === 'phone' ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/401|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  const P = (s) => `${kind}: ${s}`;

  // ---------- public portfolio ----------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hero-band h1');
  const h1 = (await page.textContent('.hero-band h1')).replace(/\s+/g, ' ').trim();
  check(h1 === 'Architecture for the agentic enterprise.', P(`headline reads correctly ("${h1}")`));
  await scrollThrough(page);
  for (const id of ['agentic', 'work', 'experience', 'skills', 'certifications', 'recommendations', 'contact']) check(!!(await page.$(`#${id}`)), P(`section #${id} is on the page`));
  check((await page.$$('.proj')).length === 9, P('nine agent projects shown'));
  check((await page.$$('.eco-layer')).length === 5, P('ecosystem diagram has five layers'));
  check(!!(await page.$('.proj-featured')), P('Xarvis is featured across the full width'));
  check(!(await page.$('.nav-admin')), P('no Admin link for visitors'));
  await noSideScroll(page, P('portfolio'));
  await shot(page, `${kind}-portfolio`, true);

  if (kind === 'phone') {
    await page.click('.burger');
    await page.waitForSelector('.sheet');
    const sheetW = await page.$eval('.sheet', (s) => s.getBoundingClientRect().width);
    check(Math.abs(sheetW - (await page.evaluate(() => innerWidth))) < 2, P('menu covers the whole screen'));
    await shot(page, `${kind}-menu`);
    await page.click('.sheet-item:has-text("Skills")');
    await page.waitForTimeout(800);
    const top = await page.$eval('#skills', (el) => el.getBoundingClientRect().top);
    check(!(await page.$('.sheet')) && top < 300 && top > -50, P(`menu link closes the menu and goes to Skills (top ${Math.round(top)})`));
  } else {
    await page.click('.nav-links a:has-text("Experience")');
    await page.waitForTimeout(800);
    const top = await page.$eval('#experience', (el) => el.getBoundingClientRect().top);
    check(top < 200 && top > -50, P(`navigation link goes to Experience (top ${Math.round(top)})`));
  }

  // ---------- CV page ----------
  await page.goto(`${BASE}/cv`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.cv-page');
  check((await page.$$('.cv-job')).length === 4, P('CV page lists the four roles'));
  await noSideScroll(page, P('CV page'));
  await shot(page, `${kind}-cv`, kind === 'desktop');
  if (kind === 'desktop') {
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    writeFileSync(`${SHOTS}/cv-print.pdf`, pdf);
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    check(pages >= 1 && pages <= 3, P(`CV prints on ${pages} A4 page(s)`));
    await page.emulateMedia({ media: 'screen' });
  }
  await page.click('.cv-bar > button');
  await page.waitForSelector('.hero-band');
  check(page.url() === `${BASE}/`, P('Back to the portfolio returns home'));

  // ---------- admin ----------
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', 'someone@example.test');
  await page.click('button[type=submit]');
  check(!!(await page.waitForSelector('text=This sign-in is only for the owner', { timeout: 5000 }).catch(() => null)), P('other addresses cannot sign in'));
  await noSideScroll(page, P('sign-in page'));
  await shot(page, `${kind}-signin`);
  await signIn(page);
  check(!!(await page.waitForSelector('text=Worth doing next', { timeout: 8000 }).catch(() => null)), P('dashboard opens after sign-in'));
  await noSideScroll(page, P('admin dashboard'));
  await shot(page, `${kind}-admin-dashboard`);

  // Profile: edit a text and upload a photograph
  await page.goto(`${BASE}/admin/profile`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#f-intro');
  const original = await page.inputValue('#f-intro');
  await page.fill('#f-intro', `${original} E2E-${kind}`);
  await page.click('.a-savebar button[type=submit]');
  check(await toastSays(page, /Saved/), P('profile text saves'));
  check(((await publicSite(page)).profile.intro || '').endsWith(`E2E-${kind}`), P('profile text reaches the public site'));
  await page.fill('#f-intro', original);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.a-photo-actions .a-btn')]);
  await chooser.setFiles(PORTRAIT);
  await page.waitForSelector('.a-photo img', { timeout: 15000 });
  await page.click('.a-savebar button[type=submit]');
  check(await toastSays(page, /Saved/), P('photograph saved'));
  await shot(page, `${kind}-admin-profile`);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await wholePhoto(page, '.hero-photo img', P('opening photograph'));
  check(!(await page.$('.monogram')), P('monogram replaced by the photograph'));
  check((await page.textContent('.hero-band .lead')).trim() === original.trim(), P('profile text restored'));

  // Agentic AI: add, see on the site, move, remove
  await page.goto(`${BASE}/admin/agentic`, { waitUntil: 'networkidle' });
  const before = (await page.$$('[data-list="items"] [data-row]')).length;
  await page.click('[data-list="items"] .a-toolbar .a-btn-solid');
  await page.waitForSelector('.a-drawer');
  const dw = await page.$eval('.a-drawer', (d) => d.getBoundingClientRect().width);
  check(kind === 'phone' ? Math.abs(dw - (await page.evaluate(() => innerWidth))) < 2 : dw > 400, P('edit panel opens at the right width'));
  await page.fill('.a-drawer #f-title', `E2E agent ${kind}`);
  await page.fill('.a-drawer #f-tagline', 'A test entry.');
  await page.fill('.a-drawer #f-status', 'Proof of concept');
  await page.fill('.a-drawer #f-highlights', 'First point\nSecond point');
  await page.fill('.a-drawer #f-stack', 'One, Two');
  await page.fill('.a-drawer #f-link', 'http://not-https.example');
  await page.click('.a-drawer footer .a-btn-solid');
  check(await toastSays(page, /https/), P('a link that is not https is refused'));
  await page.fill('.a-drawer #f-link', 'https://example.com/demo');
  await shot(page, `${kind}-admin-drawer`);
  await page.click('.a-drawer footer .a-btn-solid');
  await page.waitForSelector('.a-drawer', { state: 'detached' });
  check((await page.$$('[data-list="items"] [data-row]')).length === before + 1, P('new agent project listed'));
  const added = (await publicSite(page)).agentic.items.find((x) => x.title === `E2E agent ${kind}`);
  check(!!added && added.highlights.length === 2 && added.stack.join('|') === 'One|Two', P('new project reaches the site with its highlights and stack'));
  const rows = await page.$$('[data-list="items"] [data-row]');
  await (await rows[rows.length - 1].$('button[aria-label="Move up"]')).click();
  await page.waitForTimeout(600);
  const order = (await publicSite(page)).agentic.items.map((x) => x.title);
  check(order[order.length - 2] === `E2E agent ${kind}`, P('moving an entry up changes the order on the site'));
  await shot(page, `${kind}-admin-agentic`);
  await (await (await page.$$('[data-list="items"] [data-row]'))[order.length - 2].$('.a-row-open')).click();
  await page.waitForSelector('.a-drawer');
  await page.click('.a-drawer footer .a-btn-danger');
  await page.waitForSelector('.a-drawer', { state: 'detached' });
  check(!(await publicSite(page)).agentic.items.some((x) => x.title === `E2E agent ${kind}`), P('removed project is gone from the site'));

  // Earlier versions: put the removed project back, then remove it again by restoring
  await page.click('.a-versions .a-toolbar .a-btn');
  await page.waitForSelector('.a-versions .a-row');
  await (await page.$$('.a-versions .a-row .a-btn'))[0].click();
  check(await toastSays(page, /earlier version/i), P('restoring an earlier version works'));
  check(await siteSoon(page, (b) => b.agentic.items.some((x) => x.title === `E2E agent ${kind}`)), P('restored version is on the site'));
  await page.waitForTimeout(400);
  await (await page.$$('.a-versions .a-row .a-btn'))[0].click();
  check(await siteSoon(page, (b) => !b.agentic.items.some((x) => x.title === `E2E agent ${kind}`)), P('restoring again undoes the restore'));

  // Recommendations: a hidden one never reaches visitors
  await page.goto(`${BASE}/admin/recommendations`, { waitUntil: 'networkidle' });
  await page.click('[data-list="items"] .a-toolbar .a-btn-solid');
  await page.fill('.a-drawer #f-name', 'E2E Hidden');
  await page.fill('.a-drawer #f-text', 'Not for visitors.');
  await page.uncheck('.a-drawer #f-visible');
  await page.click('.a-drawer footer .a-btn-solid');
  await page.waitForSelector('.a-drawer', { state: 'detached' });
  check(!(await publicSite(page)).recommendations.items.some((x) => x.name === 'E2E Hidden'), P('hidden recommendation stays private'));
  check(!!(await page.$('.a-badges i[data-st="off"]')), P('admin marks it as Hidden'));
  const recRows = await page.$$('[data-list="items"] [data-row]');
  await (await recRows[recRows.length - 1].$('.a-row-open')).click();
  await page.click('.a-drawer footer .a-btn-danger');
  await page.waitForSelector('.a-drawer', { state: 'detached' });

  // CV file: upload a PDF, the site's Download CV button gives it, then remove it
  await page.goto(`${BASE}/admin/cv`, { waitUntil: 'networkidle' });
  const [pdfChooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.a-photo-actions .a-btn')]);
  await pdfChooser.setFiles(PDF);
  check(await toastSays(page, /CV is uploaded/), P('CV PDF uploads'));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const dl = await page.getAttribute('.hero-band a:has-text("Download CV")', 'href').catch(() => '');
  check(/\/api\/files\/cv\/[a-f0-9]+\.pdf\?download=1/.test(dl || ''), P('Download CV gives the uploaded PDF'));
  await page.goto(`${BASE}/admin/cv`, { waitUntil: 'networkidle' });
  await page.click('.a-photo-actions .a-btn-danger');
  check(await toastSays(page, /removed/), P('CV PDF removed'));

  // Remove the test photograph again
  await page.goto(`${BASE}/admin/profile`, { waitUntil: 'networkidle' });
  await page.click('.a-photo-actions .a-btn-danger');
  await page.click('.a-savebar button[type=submit]');
  check(await toastSays(page, /Saved/), P('photograph removed'));
  check(!(await publicSite(page)).profile.photo_key, P('site is back to the monogram'));

  if (kind === 'phone') {
    check(await page.$eval('.a-ribbon', (n) => getComputedStyle(n).position === 'fixed'), P('admin sections are a bottom bar on the phone'));
  }
  await noSideScroll(page, P('admin profile'));

  // Signed-in owner sees the Admin link on the site; signing out closes the admin
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  if (kind === 'desktop') check(!!(await page.$('.nav-admin')), P('owner sees the Admin link'));
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.click(kind === 'phone' ? '[data-rib]:has-text("Sign out")' : '.a-side-foot button:has-text("Sign out")');
  await page.waitForSelector('#login-email');
  check((await page.evaluate(async () => (await fetch('/api/admin/blocks')).status)) === 401, P('signing out closes the admin API'));

  check(errors.length === 0, P(`no console errors${errors.length ? ' → ' + errors.slice(0, 3).join(' | ') : ''}`));
  await browser.close();
}

await run('desktop');
await run('phone');
console.log(results.join('\n'));
console.log(problems.length ? `\n${problems.length} FAILED` : `\nAll ${results.length} checks passed`);
process.exit(problems.length ? 1 : 0);
