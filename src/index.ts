import { Hono } from 'hono';
import type { Env, Vars } from './env';
import { authRoutes } from './auth';
import { contentRoutes } from './content';
import { renderPage, robots, sitemap } from './seo';
import { err, redirectTarget } from './lib';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// A www. address moves to the same address without www., keeping the path (see redirectTarget in lib.ts).
app.use('*', async (c, next) => {
  const to = redirectTarget(c.req.url);
  if (to) return c.redirect(to, 301);
  await next();
});

// Requests that change something must come from this site's own pages, so another website cannot act as the signed-in owner.
app.use('/api/*', async (c, next) => {
  const m = c.req.method;
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
    const origin = c.req.header('origin');
    if (origin && origin !== new URL(c.req.url).origin) return err(c, 403, 'This request did not come from the portfolio.');
  }
  await next();
  const path = c.req.path;
  if (path.startsWith('/api/files/')) {
    if (c.res.ok) c.header('Cache-Control', 'public, max-age=31536000, immutable');
    c.header('Cross-Origin-Resource-Policy', 'same-site');
  } else {
    c.header('Cache-Control', 'no-store');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');
  }
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Content-Security-Policy', "default-src 'none'; img-src 'self'; frame-ancestors 'none'");
  c.header('X-Robots-Tag', 'noindex');
});

app.get('/api/health', (c) => c.json({ ok: true, time: Date.now() }));

authRoutes(app);
contentRoutes(app);

// HTML pages: the Worker fills in the title, description, link preview and structured data from the saved content.
app.get('/', (c) => renderPage(c, 'home'));
app.get('/cv', (c) => renderPage(c, 'cv'));
app.get('/admin', (c) => renderPage(c, 'admin'));
app.get('/admin/*', (c) => renderPage(c, 'admin'));
app.get('/robots.txt', robots);
app.get('/sitemap.xml', sitemap);

app.notFound((c) => (c.req.path.startsWith('/api/') ? err(c, 404, 'No such API route.') : c.env.ASSETS.fetch(c.req.raw)));

app.onError((e, c) => {
  console.error(e);
  return err(c, 500, 'Something went wrong on the server.');
});

export default app;
