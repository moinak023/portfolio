// Builds one self-contained HTML preview of the public portfolio (no server, starting content only):
// VITE_DEMO=1 npx vite build web && node scripts/make-preview.mjs  ->  preview/portfolio-preview.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('dist-demo/index.html', root), 'utf8');
const css = /href="\/(assets\/[^"]+\.css)"/.exec(html)[1];
const js = /src="\/(assets\/[^"]+\.js)"/.exec(html)[1];
let style = readFileSync(new URL(`dist-demo/${css}`, root), 'utf8');
style = style.replace(/url\("?\/fonts\/([a-z0-9-]+\.woff2)"?\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(new URL(`web/public/fonts/${f}`, root)).toString('base64')})`);
const script = readFileSync(new URL(`dist-demo/${js}`, root), 'utf8').replace(/<\/script/gi, '<\\/script');
const out = `<title>Moinak Ghosh Portfolio</title>
<meta name="description" content="Preview of the portfolio with its starting content.">
<style>${style}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
mkdirSync(new URL('preview/', root), { recursive: true });
writeFileSync(new URL('preview/portfolio-preview.html', root), out);
console.log(`preview/portfolio-preview.html ${(out.length / 1024).toFixed(0)} KB`);
