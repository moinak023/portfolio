// End-to-end browser test against a LOCAL worker with DEV_OTP=1.
// Runs the public portfolio, the CV page and every admin function on a desktop and a phone, saves screenshots,
// and fails on console errors, sideways scrolling, cropped photographs or admin changes that do not reach the site.
// Run: BASE=http://127.0.0.1:8787 ADMIN_PW='...' SHOTS=./shots node tests/e2e.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { strToU8, zipSync } from 'fflate';

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
const LINKEDIN_ZIP = `${SHOTS}/test-linkedin.zip`;
writeFileSync(LINKEDIN_ZIP, zipSync({
  'Recommendations_Received.csv': strToU8('First Name,Last Name,Company,Job Title,Text,Creation Date,Status\nE2E Asha,Rao,Example Ltd,CTO,"Clear thinker.\nGreat partner.",09/01/24,VISIBLE\nE2E Hidden,Rec,Beta,PM,Hidden on LinkedIn,01/02/20,HIDDEN\n'),
  'Skills.csv': strToU8('Name\nE2E Skill B\nE2E Skill A\n'),
  'Endorsement_Received_Info.csv': strToU8('Endorsement Date,Skill Name,Endorser First Name\n2024/01/01,E2E Skill A,A\n'),
  'Certifications.csv': strToU8('Name,Url,Authority,Started On,Finished On,License Number\nE2E Certificate,,Example Board,Jan 2025,,\n'),
  'Connections.csv': strToU8('First Name,Last Name\nNot,Imported\n'),
}));
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
/** Remove and restore buttons ask for a second click before they act. */
async function twice(target) {
  await target.click();
  await target.click();
}
/** Drags one row by its handle onto another, with a mouse (desktop) or a finger (phone). */
async function dragRow(page, cdp, fromId, toId) {
  const grip = page.locator(`[data-section="${fromId}"] [data-grip]`);
  await page.locator(`[data-section="${toId}"]`).scrollIntoViewIfNeeded();
  await grip.scrollIntoViewIfNeeded();
  const a = await grip.boundingBox();
  const b = await page.locator(`[data-section="${toId}"] [data-grip]`).boundingBox();
  const ax = a.x + a.width / 2; const ay = a.y + a.height / 2; const by = b.y + b.height / 2 - 8;
  if (cdp) {
    const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: ax, y }] });
    await touch('touchStart', ay);
    for (let i = 1; i <= 24; i += 1) { await touch('touchMove', ay + ((by - ay) * i) / 24); await page.waitForTimeout(16); }
    await page.waitForTimeout(150);
    await touch('touchEnd');
  } else {
    await page.mouse.move(ax, ay);
    await page.mouse.down();
    await page.mouse.move(ax, ay - 10, { steps: 4 });
    await page.mouse.move(ax, by, { steps: 24 });
    await page.waitForTimeout(150);
    await page.mouse.up();
  }
}
const orderOf = (b) => b.layout.sections.map((x) => x.id);
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
    check(!(await page.$('.sheet')) && !(await page.evaluate(() => document.documentElement.hasAttribute('data-lock'))), P('a menu link closes the menu and unlocks the page'));
    // Every menu item, in an order that jumps both down and up the page, must put its section right under the header.
    const navH = await page.$eval('.nav', (n) => n.offsetHeight);
    const items = await page.evaluate(() => [...document.querySelectorAll('.nav-links a[href^="/#"]')].map((a) => a.getAttribute('href').slice(2)));
    for (const id of [...items.slice().reverse(), ...items]) {
      await page.click('.burger');
      await page.waitForSelector('.sheet');
      await page.click(`.sheet-item[href="/#${id}"]`);
      await page.waitForTimeout(500);
      const t1 = await page.$eval(`#${id}`, (el) => Math.round(el.getBoundingClientRect().top));
      await page.waitForTimeout(700);
      const t2 = await page.$eval(`#${id}`, (el) => Math.round(el.getBoundingClientRect().top));
      check(Math.abs(t1 - navH) <= 2 && t1 === t2, P(`menu item ${id} lands right under the header and stays (${t1}, ${t2}, header ${navH})`));
    }
    const endless = await page.evaluate(() => document.getAnimations().filter((x) => x.effect && x.effect.getComputedTiming().iterations === Infinity).length);
    check(endless === 0, P(`no endless decorative animations run on the phone (${endless})`));
  } else {
    const navH = await page.$eval('.nav', (n) => n.offsetHeight);
    for (const id of ['contact', 'experience', 'agentic']) {
      await page.click(`.nav-links a[href="/#${id}"]`);
      await page.waitForTimeout(2200);
      const top = await page.$eval(`#${id}`, (el) => Math.round(el.getBoundingClientRect().top));
      const atEnd = await page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2);
      check(Math.abs(top - navH) <= 2 || atEnd, P(`navigation link to ${id} scrolls smoothly to right under the header, or to the end of the page (top ${top}, header ${navH})`));
    }
  }
  const blurred = await page.evaluate(() => [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } }).filter((r) => r.type === CSSRule.KEYFRAMES_RULE && /blur/.test(r.cssText)).map((r) => r.name));
  check(blurred.length === 0, P(`no animation blurs content while it moves (${blurred.join(', ')})`));

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
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.locator('.footer-admin').scrollIntoViewIfNeeded();
  await page.click('.footer-admin');
  check(!!(await page.waitForSelector('#login-email', { timeout: 5000 }).catch(() => null)), P('the footer link opens the admin sign-in page'));
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
  await page.fill('#d-title', `E2E agent ${kind}`);
  await page.fill('#d-tagline', 'A test entry.');
  await page.fill('#d-status', 'Proof of concept');
  await page.fill('#d-highlights', 'First point\nSecond point');
  await page.fill('#d-stack', 'One, Two');
  await page.fill('#d-link', 'http://not-https.example');
  await page.click('.a-drawer footer .a-btn-solid');
  check(await toastSays(page, /https/), P('a link that is not https is refused'));
  await page.fill('#d-link', 'https://example.com/demo');
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
  await twice(page.locator('.a-drawer footer .a-btn-danger'));
  await page.waitForSelector('.a-drawer', { state: 'detached' });
  check(!(await publicSite(page)).agentic.items.some((x) => x.title === `E2E agent ${kind}`), P('removed project is gone from the site'));

  // Earlier versions: put the removed project back, then remove it again by restoring
  await page.click('.a-versions .a-toolbar .a-btn');
  await page.waitForSelector('.a-versions .a-row');
  await twice(page.locator('.a-versions .a-row .a-btn').first());
  check(await toastSays(page, /earlier version/i), P('restoring an earlier version works'));
  check(await siteSoon(page, (b) => b.agentic.items.some((x) => x.title === `E2E agent ${kind}`)), P('restored version is on the site'));
  await page.waitForTimeout(400);
  await twice(page.locator('.a-versions .a-row .a-btn').first());
  check(await siteSoon(page, (b) => !b.agentic.items.some((x) => x.title === `E2E agent ${kind}`)), P('restoring again undoes the restore'));

  // Recommendations: a hidden one never reaches visitors
  await page.goto(`${BASE}/admin/recommendations`, { waitUntil: 'networkidle' });
  await page.click('[data-list="items"] .a-toolbar .a-btn-solid');
  await page.fill('#d-name', 'E2E Hidden');
  await page.fill('#d-text', 'Not for visitors.');
  await page.uncheck('#d-visible');
  await page.click('.a-drawer footer .a-btn-solid');
  await page.waitForSelector('.a-drawer', { state: 'detached' });
  check(!(await publicSite(page)).recommendations.items.some((x) => x.name === 'E2E Hidden'), P('hidden recommendation stays private'));
  check(!!(await page.$('.a-badges i[data-st="off"]')), P('admin marks it as Hidden'));
  const recRows = await page.$$('[data-list="items"] [data-row]');
  await (await recRows[recRows.length - 1].$('.a-row-open')).click();
  await twice(page.locator('.a-drawer footer .a-btn-danger'));
  await page.waitForSelector('.a-drawer', { state: 'detached' });

  // A new recommendation added by hand appears in the same style as the others
  await page.click('[data-list="items"] .a-toolbar .a-btn-solid');
  await page.fill('#d-name', `E2E Colleague ${kind}`);
  await page.fill('#d-role', 'Chief Technology Officer, Example Ltd');
  await page.fill('#d-text', 'A thoughtful architect.');
  await page.click('.a-drawer footer .a-btn-solid');
  await page.waitForSelector('.a-drawer', { state: 'detached' });
  await page.goto(`${BASE}/#recommendations`, { waitUntil: 'networkidle' });
  const newRec = page.locator('#recommendations figure.rec', { hasText: `E2E Colleague ${kind}` });
  check(await newRec.count() === 1 && (await newRec.locator('figcaption small').first().textContent()).includes('Example Ltd'), P('a recommendation added by hand shows on the site like the others'));
  await page.goto(`${BASE}/admin/recommendations`, { waitUntil: 'networkidle' });
  await page.locator('[data-list="items"] [data-row]', { hasText: `E2E Colleague ${kind}` }).locator('.a-row-open').click();
  await twice(page.locator('.a-drawer footer .a-btn-danger'));
  await page.waitForSelector('.a-drawer', { state: 'detached' });

  // ---------- page builder ----------
  const start = await page.evaluate(async () => (await (await fetch('/api/admin/blocks')).json()).blocks);
  await page.goto(`${BASE}/admin/builder`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-section]');
  check((await page.$$('[data-section]')).length === 10, P('builder lists the ten sections in page order'));
  if (kind === 'desktop') {
    const frame = await page.waitForSelector('iframe[title="Live preview of the portfolio"]');
    const inner = await frame.contentFrame();
    check(!!(await inner.waitForSelector('.hero-band h1', { timeout: 10000 }).catch(() => null)), P('live preview shows the portfolio beside the builder'));
    check((await page.$$('.a-nav-group')).length === 2, P('sidebar lists the page sections as their own group'));
  }
  await shot(page, `${kind}-admin-builder`);
  // drag a section to a new place
  const cdp = kind === 'phone' ? await page.context().newCDPSession(page) : null;
  const [mover, target] = kind === 'phone' ? ['principles', 'agentic'] : ['skills', 'agentic'];
  await dragRow(page, cdp, mover, target);
  check(await siteSoon(page, (b) => orderOf(b).indexOf(mover) === orderOf(b).indexOf(target) - 1), P(`dragging ${mover} above ${target} changes the page order`));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const ids = await page.$$eval('main > section[id]', (els) => els.map((e) => e.id));
  check(ids.indexOf(mover) === ids.indexOf(target) - 1, P('the portfolio shows the new order'));
  // keyboard: focus the handle and press the arrow keys
  await page.goto(`${BASE}/admin/builder`, { waitUntil: 'networkidle' });
  await page.focus(`[data-section="${mover}"] [data-grip]`);
  await page.keyboard.press('ArrowDown');
  check(await siteSoon(page, (b) => orderOf(b).indexOf(mover) === orderOf(b).indexOf(target) + 1), P('the down arrow key moves a section one place down'));
  check(await page.evaluate((m) => document.activeElement === document.querySelector(`[data-section="${m}"] [data-grip]`), mover), P('the handle keeps the keyboard focus after a move'));
  await page.keyboard.press('ArrowUp');
  check(await siteSoon(page, (b) => orderOf(b).indexOf(mover) === orderOf(b).indexOf(target) - 1), P('the up arrow key moves it back up'));
  // hide and show a section
  await page.click('[data-section="principles"] [data-toggle-visible]');
  check(await siteSoon(page, (b) => b.layout.sections.find((x) => x.id === 'principles').visible === false), P('the eye button hides a section'));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check(!(await page.$('#principles')), P('a hidden section is not on the portfolio'));
  await page.goto(`${BASE}/admin/builder`, { waitUntil: 'networkidle' });
  check(!!(await page.$('[data-section="principles"].a-sec-hidden')), P('the builder marks it as hidden'));
  await page.click('[data-section="principles"] [data-toggle-visible]');
  check(await siteSoon(page, (b) => b.layout.sections.find((x) => x.id === 'principles').visible !== false), P('the eye button shows it again'));
  // add a section of my own with sub-sections
  await page.click('[data-add-section]');
  await page.waitForSelector('.a-templates');
  await shot(page, `${kind}-admin-add-section`);
  await page.click('[data-template="cards"]');
  await page.waitForURL(/\/admin\/c-[a-z0-9]+$/);
  const cid = page.url().split('/').pop();
  await page.waitForSelector('#f-title');
  await page.fill('#f-title', `E2E section ${kind}`);
  await page.fill('#f-intro', 'Made by the browser test.');
  await page.click('.a-savebar button[type=submit]');
  check(await toastSays(page, /Saved/), P('a new section saves'));
  await page.click('#sec-menu');
  check(await toastSays(page, /top menu/), P('the new section can be added to the top menu'));
  await page.click('[data-list="items"] .a-toolbar .a-btn-solid');
  await page.fill('#d-title', 'E2E card');
  await page.fill('#d-text', 'First line.\nSecond line.');
  await page.fill('#d-points', 'Point one\nPoint two');
  await page.click('.a-drawer footer .a-btn-solid');
  await page.waitForSelector('.a-drawer', { state: 'detached' });
  check(await siteSoon(page, (b) => { const s = b.layout.sections.find((x) => x.id === cid); return !!s && s.items.length === 3 && s.items[2].points.length === 2; }), P('a sub-section is added to the new section'));
  await shot(page, `${kind}-admin-custom`);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await scrollThrough(page);
  check((await page.$$(`#${cid} .cs-card`)).length === 3, P('the new section shows its three cards on the portfolio'));
  check(((await page.textContent(`#${cid} h2`)) || '').includes(`E2E section ${kind}`), P('the new section has its title'));
  if (kind === 'phone') {
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('.burger');
    await page.waitForSelector('.sheet');
    const item = page.locator('.sheet-item', { hasText: `E2E section ${kind}` });
    check(await item.count() === 1, P('the new section is in the menu'));
    await item.click();
    await page.waitForTimeout(800);
  } else {
    check(!!(await page.$(`.nav-links a[href="/#${cid}"]`)), P('the new section is in the top menu'));
  }
  await page.locator(`#${cid}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await shot(page, `${kind}-site-custom`);
  // change the template without losing the content
  await page.goto(`${BASE}/admin/${cid}`, { waitUntil: 'networkidle' });
  await page.selectOption('#f-template', 'timeline');
  await page.selectOption('#f-style', 'dark');
  await page.click('.a-savebar button[type=submit]');
  check(await toastSays(page, /Saved/), P('the template can be changed'));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await scrollThrough(page);
  check((await page.$$(`#${cid}.cs-dark .cs-timeline > li`)).length === 3, P('the same sub-sections now show as a dark timeline'));
  await page.locator(`#${cid}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await shot(page, `${kind}-site-custom-timeline`);
  await noSideScroll(page, P('portfolio with a section of my own'));
  // delete it from the builder
  await page.goto(`${BASE}/admin/builder`, { waitUntil: 'networkidle' });
  await twice(page.locator(`[data-section="${cid}"] .a-icon-danger`));
  check(await siteSoon(page, (b) => !b.layout.sections.some((x) => x.id === cid)), P('a section of my own can be deleted'));

  // ---------- LinkedIn import ----------
  await page.goto(`${BASE}/admin/linkedin`, { waitUntil: 'networkidle' });
  await page.setInputFiles('#li-file', LINKEDIN_ZIP);
  await page.waitForSelector('[data-import="recommendations"] .a-pick');
  check((await page.$$('[data-import="recommendations"] .a-pick')).length === 2, P('the LinkedIn file shows both recommendations'));
  check((await page.$$('[data-import="skills"] .a-chip-pick')).length === 2 && (await page.$$('[data-import="certifications"] .a-pick')).length === 1, P('and its skills and certification'));
  await shot(page, `${kind}-admin-linkedin`);
  await page.click('[data-import-go]');
  check(await toastSays(page, /Imported 2 recommendations, 2 skills, 1 certification/), P('import adds what was picked'));
  const after = await publicSite(page);
  check(after.recommendations.items.some((x) => x.name === 'E2E Asha Rao' && x.date === 'September 2024') && !after.recommendations.items.some((x) => x.name === 'E2E Hidden Rec'), P('imported recommendation is shown, the one hidden on LinkedIn stays hidden'));
  check(after.skills.groups.some((g) => g.name === 'From LinkedIn' && g.items.join('|') === 'E2E Skill A|E2E Skill B'), P('imported skills are in a From LinkedIn group, most endorsed first'));
  check(after.certifications.items.some((x) => x.name === 'E2E Certificate' && x.year === '2025'), P('imported certification is listed'));
  await page.setInputFiles('#li-file', LINKEDIN_ZIP);
  await page.waitForSelector('[data-import="recommendations"] .a-pick');
  check((await page.$$('.a-pick-have, .a-chip-pick.a-pick-have')).length === 5 && await page.isDisabled('[data-import-go]'), P('importing the same file again adds nothing twice'));
  // put everything back as it was before the builder and import tests
  await page.evaluate(async (snap) => {
    for (const k of ['layout', 'recommendations', 'skills', 'certifications']) await fetch(`/api/admin/blocks/${k}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snap[k]) });
  }, start);

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
