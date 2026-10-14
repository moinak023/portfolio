// Builds migrations/0002_content.sql from seed/content.mjs. Run: npm run seed
import { writeFileSync } from 'node:fs';
import { content } from '../seed/content.mjs';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const t = Date.UTC(2026, 9, 14);
const lines = [
  '-- Starting content of the portfolio. Generated from seed/content.mjs by scripts/make-seed.mjs.',
  '-- INSERT OR IGNORE: running it again never overwrites what was edited in the admin console.',
];
for (const [key, data] of Object.entries(content)) {
  lines.push(`INSERT OR IGNORE INTO blocks (key, data, updated_at) VALUES (${q(key)}, ${q(JSON.stringify(data))}, ${t});`);
}
writeFileSync(new URL('../migrations/0002_content.sql', import.meta.url), lines.join('\n') + '\n');
console.log(`Wrote ${Object.keys(content).length} sections.`);
