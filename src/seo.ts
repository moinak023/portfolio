import type { Context } from 'hono';
import type { Env, Vars } from './env';
import { readBlocks } from './content';

type Any = Record<string, any>;

/** Security headers for the HTML pages the Worker serves (the _headers file only covers static files). */
export function pageHeaders(h: Headers, { noindex = false, isAdmin = false } = {}) {
  h.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  h.set('X-Frame-Options', 'DENY');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cache-Control', isAdmin ? 'no-store' : 'no-cache');
  if (noindex) h.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  else h.delete('X-Robots-Tag');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isHttp = (u: unknown) => typeof u === 'string' && /^https:\/\/[^\s"<>]+$/i.test(u);

/** Title, description, preview card and structured data for search engines and link previews (LinkedIn, WhatsApp, email). */
export async function renderPage(c: Context<{ Bindings: Env; Variables: Vars }>, kind: 'home' | 'cv' | 'admin') {
  const url = new URL(c.req.url);
  const shell = await c.env.ASSETS.fetch(new Request(new URL('/', url).toString(), { headers: { accept: 'text/html' } }));
  const { blocks } = await readBlocks(c.env);
  const p = (blocks.profile || {}) as Any;
  const seo = (blocks.seo || {}) as Any;
  const exp = (((blocks.experience || {}) as Any).items || []) as Any[];
  const skills = (((blocks.skills || {}) as Any).groups || []) as Any[];
  const name = p.name || 'Portfolio';
  const baseTitle = seo.title || `${name} — ${p.headline || ''}`.replace(/ — $/, '');
  const title = kind === 'cv' ? `CV · ${name}` : kind === 'admin' ? `Admin · ${name}` : baseTitle;
  const description = String(seo.description || p.intro || '').slice(0, 300);
  const canonical = `${url.origin}${kind === 'cv' ? '/cv' : kind === 'admin' ? '/admin' : '/'}`;
  const noindex = kind === 'admin' || seo.index === false;
  const image = `${url.origin}/og.png`;

  const person: Any = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url: `${url.origin}/`,
    jobTitle: p.headline || undefined,
    image: p.photo_key ? `${url.origin}/api/files/${p.photo_key}` : image,
    description: description || undefined,
    address: p.location ? { '@type': 'PostalAddress', addressLocality: p.location } : undefined,
    worksFor: exp[0] && exp[0].company ? { '@type': 'Organization', name: exp[0].company } : undefined,
    sameAs: [p.linkedin, p.github].filter(isHttp),
    knowsAbout: skills.flatMap((g) => (Array.isArray(g.items) ? g.items : [])).slice(0, 30),
  };
  const ld = JSON.stringify(person).replace(/</g, '\\u003c');

  const head = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow'}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:site_name" content="${esc(name)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    kind === 'home' ? `<script type="application/ld+json">${ld}</script>` : '',
  ].join('\n    ');

  const res = new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(title); } })
    .on('meta[name="description"]', { element(e) { e.setAttribute('content', description); } })
    .on('meta[name="robots"]', { element(e) { e.remove(); } })
    .on('head', { element(e) { e.append(head, { html: true }); } })
    .transform(new Response(shell.body, shell));
  const out = new Response(res.body, { status: 200, headers: new Headers(res.headers) });
  pageHeaders(out.headers, { noindex, isAdmin: kind === 'admin' });
  out.headers.set('Content-Type', 'text/html; charset=utf-8');
  return out;
}

export async function robots(c: Context<{ Bindings: Env; Variables: Vars }>) {
  const { blocks } = await readBlocks(c.env);
  const origin = new URL(c.req.url).origin;
  const open = ((blocks.seo || {}) as Any).index !== false;
  const body = open
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return c.text(body, 200, { 'Cache-Control': 'public, max-age=3600' });
}

export async function sitemap(c: Context<{ Bindings: Env; Variables: Vars }>) {
  const { updatedAt } = await readBlocks(c.env);
  const origin = new URL(c.req.url).origin;
  const day = new Date(updatedAt || Date.now()).toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc><lastmod>${day}</lastmod></url>
  <url><loc>${origin}/cv</loc><lastmod>${day}</lastmod></url>
</urlset>
`;
  return c.body(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
}
