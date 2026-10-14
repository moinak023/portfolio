// Reads the copy of your data that LinkedIn lets you download (Settings → Data privacy → Get a copy of your data).
// The download is a ZIP of CSV files. Column names have changed between LinkedIn versions, so columns are matched
// loosely (case, spaces and underscores ignored) and anything not recognised is simply skipped.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Splits CSV text into rows of cells (RFC 4180: quoted cells, doubled quotes, line breaks inside quotes). */
export function parseCsv(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z]/g, '');

// Column names that mark the real header row. Some LinkedIn files start with note lines, and Skills.csv has one column.
const HEADERS = new Set(['name', 'firstname', 'skillname', 'text', 'body', 'authority', 'url', 'status', 'creationdate', 'company']);

/** Rows as objects keyed by header. Skips any note lines LinkedIn puts above the real header. */
export function tableOf(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  let at = rows.findIndex((r) => r.some((c) => HEADERS.has(norm(c))));
  if (at < 0) at = Math.max(0, rows.findIndex((r) => r.filter((c) => c.trim()).length >= 2));
  const head = rows[at].map(norm);
  return rows.slice(at + 1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

const col = (row, ...names) => {
  for (const n of names) { const v = row[norm(n)]; if (v) return v; }
  return '';
};

const entities = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/<br\s*\/?>/gi, '\n');

/** "11/16/13, 6:00 PM", "Nov 16, 2013", "2013-11-16" → "November 2013". Anything else is kept as written. */
export function monthYearOf(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  let m = /^(\d{4})-(\d{1,2})/.exec(v);
  if (m) return `${MONTHS[Number(m[2]) - 1] || ''} ${m[1]}`.trim();
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(v);
  if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return `${MONTHS[Number(m[1]) - 1] || ''} ${y}`.trim(); }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return v;
}
export const yearOf = (raw) => { const m = /(19|20)\d{2}/.exec(String(raw || '')); return m ? m[0] : ''; };

/** Which LinkedIn file a name is, or ''. */
export function kindOf(name) {
  const n = String(name || '').toLowerCase().split('/').pop();
  if (/^recommendations_received/.test(n)) return 'recommendations';
  if (/^skills\.csv$/.test(n)) return 'skills';
  if (/^certifications\.csv$/.test(n)) return 'certifications';
  if (/^endorsement_received_info/.test(n)) return 'endorsements';
  return '';
}

/** Everything useful in the export, already in the portfolio's own format. files: [{ name, text }] */
export function readExport(files) {
  const out = { recommendations: [], skills: [], certifications: [], found: [] };
  const endorsed = {};
  for (const f of files) {
    const kind = kindOf(f.name);
    if (!kind) continue;
    out.found.push(f.name.split('/').pop());
    const rows = tableOf(f.text);
    if (kind === 'recommendations') {
      rows.forEach((r) => {
        const text = entities(col(r, 'body', 'text', 'recommendation'));
        const name = [col(r, 'first name', 'firstname'), col(r, 'last name', 'lastname')].filter(Boolean).join(' ') || col(r, 'name', 'recommender');
        if (!text || !name) return;
        const status = col(r, 'status');
        out.recommendations.push({
          name,
          role: [col(r, 'title', 'job title', 'position', 'headline'), col(r, 'company')].filter(Boolean).join(', '),
          relation: '',
          date: monthYearOf(col(r, 'created date', 'creation date', 'date', 'created at')),
          text,
          visible: !status || /visible|accepted|shown|public/i.test(status),
        });
      });
    } else if (kind === 'skills') {
      rows.forEach((r) => { const s = col(r, 'name', 'skill', 'skill name'); if (s) out.skills.push(s); });
    } else if (kind === 'endorsements') {
      rows.forEach((r) => { const s = col(r, 'skill name', 'skill'); if (s) endorsed[s.toLowerCase()] = (endorsed[s.toLowerCase()] || 0) + 1; });
    } else if (kind === 'certifications') {
      rows.forEach((r) => {
        const name = col(r, 'name', 'certification', 'title');
        if (!name) return;
        const url = col(r, 'url', 'link');
        out.certifications.push({ name, issuer: col(r, 'authority', 'issuer', 'organization'), year: yearOf(col(r, 'started on', 'issued on', 'date')), link: /^https:\/\//i.test(url) ? url : '', icon: 'award' });
      });
    }
  }
  out.skills = [...new Set(out.skills)].map((name) => ({ name, endorsements: endorsed[name.toLowerCase()] || 0 }))
    .sort((a, b) => b.endorsements - a.endorsements || a.name.localeCompare(b.name));
  return out;
}

const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** True when the portfolio already has this recommendation (same person and the same start of the text). */
export const hasRecommendation = (list, r) => (list || []).some((x) => key(x.name) === key(r.name) && key(x.text).slice(0, 60) === key(r.text).slice(0, 60));
export const hasSkill = (groups, name) => (groups || []).some((g) => (g.items || []).some((s) => key(s) === key(name)));
export const hasCertification = (list, c) => (list || []).some((x) => key(x.name) === key(c.name));
