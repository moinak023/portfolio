# Moinak Ghosh — professional portfolio

A public portfolio at **moinakghosh.com**, with an admin console at **moinakghosh.com/admin** that only the owner can sign in to.

- **Portfolio**: the opening, key numbers, the agent ecosystem (diagram and projects), how I work, architecture case studies, a live career counter, experience, skills, certifications, education, recommendations and contact.
- **CV page** (`/cv`): built from the same content, always up to date, and saved as a PDF with the browser's print dialogue. If a designed CV PDF is uploaded in the admin, the Download CV buttons give that file instead.
- **Admin** (`/admin`): every section is editable. Lists can be added to, edited, reordered and removed. Every save keeps the version before it (last 25 per section), so any change can be undone. Photographs and the CV PDF are uploaded from the admin.
- **Link previews and search**: the Worker fills in the page title, description, Open Graph preview (`/og.png`) and schema.org Person data from the saved content, and serves `robots.txt` and `sitemap.xml`.

Same design system and stack as the family site: one Cloudflare Worker (Hono) serving a React app, a D1 database for content, and an R2 bucket for photographs and the CV.

## Sign-in

Only `OWNER_EMAIL` can sign in. The first time, choose "Email me a code": a 6-digit code goes to the owner's email (through Resend), and you choose a password. Password resets work the same way. The admin session ends after `IDLE_MINUTES` (30) without activity, with a one-minute warning.

## Run it on your computer

```
npm install
cp .dev.vars.example .dev.vars     # DEV_OTP=1 shows the code on screen instead of emailing it
npm run migrate:local
npm run dev                        # http://localhost:8787
```

## Put it on Cloudflare

1. `wrangler.jsonc` already names the `portfolio` D1 database and the `portfolio-files` R2 bucket.
2. In Workers & Pages, import this repository. Build command: `npm run build`. Deploy command: `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`.
3. In the Worker's Settings → Variables and Secrets, add the secret `RESEND_API_KEY` (a Resend API key; moinakghosh.com is already verified there).
4. The routes in `wrangler.jsonc` attach `moinakghosh.com` and `www.moinakghosh.com` (www redirects to the main address).

## Change the starting content

`seed/content.mjs` is only the starting content. After the first deployment, edit everything in the admin. To rebuild `migrations/0002_content.sql` from the seed file: `npm run seed`. To redraw the link-preview image: `node scripts/og.mjs` (needs Playwright).

## Tests

Start the local server first (`npm run dev`, with `DEV_OTP=1` in `.dev.vars`), then:

```bash
npm run test:unit                                     # helpers, content cleaning, admin forms, starting content
npm run test:reset                                    # puts the LOCAL database back to its starting content
BASE=http://127.0.0.1:8787 npm run test:api           # every API route, signed in and signed out
BASE=http://127.0.0.1:8787 npm run test:e2e           # real browser, desktop and phone, every admin function
```

The API and browser tests refuse to run against anything other than a local address, and undo every change they make.
