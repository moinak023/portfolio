// Browser test of the self-contained preview copy (preview/portfolio-preview.html), on a desktop and a phone.
// The preview has no server, but its sign-in must behave like the real site: owner address only, a password set
// with a 6-digit code (shown on screen, because the preview cannot send email), wrong passwords refused.
// Build first: VITE_DEMO=1 npx vite build web && node scripts/make-preview.mjs. Run: node tests/preview.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT || 'playwright');
const FILE = `file://${fileURLToPath(new URL('../preview/portfolio-preview.html', import.meta.url))}`;
const OWNER = 'moinak023@gmail.com';
const PW = 'preview password 2026';
const results = [];
const check = (ok, what) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${what}`);

async function run(kind) {
  const browser = await chromium.launch();
  const ctx = kind === 'phone' ? await browser.newContext({ ...devices['Pixel 7'] }) : await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const P = (s) => `${kind}: ${s}`;
  const say = async () => (await page.textContent('.login-card')) || '';

  await page.goto(FILE);
  await page.waitForSelector('.hero-band h1');
  check(!(await page.$('.nav-admin')), P('the preview starts signed out (no Admin button in the menu)'));
  await page.locator('.footer-admin').scrollIntoViewIfNeeded();
  await page.click('.footer-admin');
  check(!!(await page.waitForSelector('#login-email', { timeout: 5000 }).catch(() => null)), P('the footer link opens the sign-in page'));

  await page.fill('#login-email', 'someone@example.test');
  await page.click('.login-card button[type=submit]');
  await page.waitForSelector('text=only for the owner');
  check(true, P('another address is refused'));
  await page.click('text=Try a different email address');

  await page.fill('#login-email', OWNER);
  await page.click('.login-card button[type=submit]');
  await page.waitForSelector('text=Set a new password');
  check((await say()).includes('You have not set a password yet'), P('the owner is asked to set a password first'));
  await page.click('.login-card button[type=submit]');
  await page.waitForSelector('#login-code');
  const code = (/Your code is (\d{6})/.exec(await say()) || [])[1];
  check(!!code, P(`the code is shown on screen in the preview (${code})`));
  await page.fill('#login-code', code === '000000' ? '111111' : '000000');
  await page.fill('#new-password', PW);
  await page.fill('#new-password2', PW);
  await page.click('.login-card button[type=submit]');
  check(!!(await page.waitForSelector('text=That code is not right', { timeout: 4000 }).catch(() => null)), P('a wrong code is refused'));
  await page.fill('#login-code', code);
  await page.fill('#new-password', 'short');
  await page.fill('#new-password2', 'short');
  await page.click('.login-card button[type=submit]');
  check(!!(await page.waitForSelector('text=at least 10 characters', { timeout: 4000 }).catch(() => null)), P('a short password is refused'));
  await page.fill('#new-password', PW);
  await page.fill('#new-password2', PW);
  await page.click('.login-card button[type=submit]');
  check(!!(await page.waitForSelector('text=Worth doing next', { timeout: 6000 }).catch(() => null)), P('the right code and a good password open the admin'));

  await page.click(kind === 'phone' ? '[data-rib]:has-text("Sign out")' : '.a-side-foot button:has-text("Sign out")');
  await page.waitForSelector('#login-email');
  check(true, P('signing out goes back to the sign-in page'));
  await page.fill('#login-email', OWNER);
  await page.click('.login-card button[type=submit]');
  await page.waitForSelector('#login-password');
  await page.fill('#login-password', 'not my password at all');
  await page.click('.login-card button[type=submit]');
  check(!!(await page.waitForSelector('text=is not right', { timeout: 4000 }).catch(() => null)), P('a wrong password is refused'));
  await page.fill('#login-password', PW);
  await page.click('.login-card button[type=submit]');
  check(!!(await page.waitForSelector('text=Worth doing next', { timeout: 6000 }).catch(() => null)), P('the right password signs in again'));

  check(errors.length === 0, P(`no page errors${errors.length ? ` → ${errors.join(' | ')}` : ''}`));
  await browser.close();
}

await run('desktop');
await run('phone');
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(failed ? `\n${failed} FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
