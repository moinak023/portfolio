// Renders the link-preview image (web/public/og.png, 1200x630) from scripts/og.html. Needs Playwright.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(new URL('./og.html', import.meta.url).href);
await page.waitForTimeout(500);
await page.screenshot({ path: fileURLToPath(new URL('../web/public/og.png', import.meta.url)) });
await browser.close();
console.log('og.png written');
