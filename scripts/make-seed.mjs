// Builds the content migrations from seed/content.mjs. Run: npm run seed
// 0002_content.sql holds every section except the page layout, which was added later in 0003_layout.sql.
// Both use INSERT OR IGNORE, so running them again never overwrites what was edited in the admin console.
import { writeFileSync } from 'node:fs';
import { content } from '../seed/content.mjs';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const t = Date.UTC(2026, 9, 14);
const LATER = { layout: '0003_layout.sql' };
const files = { '0002_content.sql': [] };
for (const [key, data] of Object.entries(content)) {
  const file = LATER[key] || '0002_content.sql';
  (files[file] ||= []).push(`INSERT OR IGNORE INTO blocks (key, data, updated_at) VALUES (${q(key)}, ${q(JSON.stringify(data))}, ${t});`);
}
for (const [name, lines] of Object.entries(files)) {
  const head = '-- Starting content of the portfolio. Generated from seed/content.mjs by scripts/make-seed.mjs.\n-- INSERT OR IGNORE: running it again never overwrites what was edited in the admin console.';
  writeFileSync(new URL(`../migrations/${name}`, import.meta.url), [head, ...lines].join('\n') + '\n');
  console.log(`${name}: ${lines.length} section(s)`);
}
