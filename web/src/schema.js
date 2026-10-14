// What can be edited in each section of the admin console, and how each field is entered.
// Types: text, long, lines (one entry per line), tags (separated by commas), date, month, select, toggle,
// photo (image upload), icon, url, email.

const T = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });
const L = (key, label, extra = {}) => ({ key, label, type: 'long', ...extra });

export const STATUS_IDEAS = ['Live', 'In use', 'Working prototype', 'Working skill', 'Phase 1 built', 'Proof of concept', 'Designed', 'Rolling out', 'Delivered', 'Next'];

const ICON_HELP = 'The small golden badge shown beside this entry.';

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'profile', label: 'Profile and opening', icon: 'user' },
  { id: 'stats', label: 'Numbers band', icon: 'chart' },
  { id: 'agentic', label: 'Agentic AI', icon: 'bot' },
  { id: 'principles', label: 'How I work', icon: 'target' },
  { id: 'work', label: 'Architecture', icon: 'hub' },
  { id: 'experience', label: 'Experience', icon: 'briefcase' },
  { id: 'skills', label: 'Skills', icon: 'spark' },
  { id: 'certifications', label: 'Certifications', icon: 'award' },
  { id: 'education', label: 'Education and languages', icon: 'grad' },
  { id: 'recommendations', label: 'Recommendations', icon: 'quote' },
  { id: 'contact', label: 'Contact', icon: 'mail' },
  { id: 'cv', label: 'CV file', icon: 'doc' },
  { id: 'seo', label: 'Search and sharing', icon: 'globe' },
  { id: 'account', label: 'My password', icon: 'lock' },
];

const HEAD = [T('eyebrow', 'Small label above the title'), T('title', 'Section title')];

export const SPECS = {
  profile: {
    intro: 'The opening of the portfolio: your name, the headline, the introduction and your photograph. These also feed the CV page and the link preview on LinkedIn and WhatsApp.',
    fields: [
      { group: 'Who you are' },
      T('name', 'Your name'),
      T('headline', 'Headline', { help: 'Shown on the CV page, in search results and under the monogram.' }),
      T('eyebrow', 'Small line above the main title'),
      T('title_lead', 'Main title'),
      T('title_accent', 'Highlighted end of the main title', { help: 'Shown in gold after the main title.' }),
      L('intro', 'Introduction', { rows: 5 }),
      { key: 'photo_key', label: 'Professional photograph', type: 'photo', folder: 'profile', help: 'Shown whole, never cropped. Without a photograph, a golden monogram is shown.' },
      { group: 'Contact details' },
      T('location', 'Location'),
      { key: 'email', label: 'Email address shown on the site', type: 'email' },
      { key: 'linkedin', label: 'LinkedIn profile address', type: 'url', placeholder: 'https://www.linkedin.com/in/...' },
      { key: 'github', label: 'GitHub address (optional)', type: 'url', placeholder: 'https://github.com/...' },
      T('phone', 'Phone number (optional)'),
      { key: 'show_phone', label: 'Show the phone number on the site and CV', type: 'toggle', default: false },
      L('open_to', 'What you are open to', { rows: 2 }),
      { group: 'Live counter' },
      { key: 'career_start', label: 'Career start date', type: 'date', help: 'The counter shows the years, days, hours, minutes and seconds since this date.' },
      T('counter_title', 'Counter title'),
      L('counter_text', 'Text beside the counter', { rows: 3 }),
    ],
  },
  stats: {
    intro: 'The dark band under the opening, with your key numbers counting up.',
    fields: [{ group: 'Band titles' }, ...HEAD],
    lists: [{
      key: 'items', label: 'Numbers', noun: 'number', prefix: 's',
      title: (x) => `${x.value || '?'} ${x.label || ''}`, icon: (x) => x.icon,
      fields: [T('value', 'Number', { help: 'For example 16+ or 11. The digits count up when the band comes into view.' }), T('label', 'What the number means'), { key: 'icon', label: 'Icon', type: 'icon', help: ICON_HELP }],
    }],
  },
  agentic: {
    intro: 'Your agents and AI builds, and the ecosystem diagram that shows how they fit together. Featured entries are shown first and across the full width.',
    fields: [{ group: 'Section text' }, ...HEAD, L('intro', 'Introduction', { rows: 5 }), T('diagram_title', 'Title of the ecosystem diagram')],
    lists: [
      {
        key: 'items', label: 'Agents and AI builds', noun: 'project', prefix: 'a',
        title: (x) => x.title, sub: (x) => x.tagline, icon: (x) => x.icon, badges: (x) => [x.status, x.featured ? 'Featured' : ''],
        fields: [
          T('title', 'Name'),
          T('tagline', 'One-line description', { help: 'Shown in teal under the name.' }),
          { key: 'status', label: 'Status', type: 'text', suggest: STATUS_IDEAS, help: 'For example Live, Working prototype, Proof of concept or Next.' },
          T('year', 'Year'),
          { key: 'icon', label: 'Icon', type: 'icon', help: ICON_HELP },
          { key: 'featured', label: 'Feature it first, across the full width', type: 'toggle', default: false },
          L('summary', 'What it is', { rows: 5 }),
          { key: 'highlights', label: 'Highlights', type: 'lines', rows: 7, help: 'One highlight per line. Each gets a golden tick.' },
          { key: 'stack', label: 'Technology', type: 'tags', help: 'Separate with commas.' },
          { key: 'link', label: 'Link (optional)', type: 'url', placeholder: 'https://...' },
          T('link_label', 'Text of the link', { placeholder: 'Watch the demo' }),
          { key: 'image_key', label: 'Screenshot or diagram (optional)', type: 'photo', folder: 'projects' },
        ],
      },
      {
        key: 'layers', label: 'Ecosystem diagram layers', noun: 'layer', prefix: 'l',
        title: (x) => x.name, sub: (x) => (Array.isArray(x.items) ? x.items.join(' · ') : ''), icon: (x) => x.icon,
        fields: [T('name', 'Layer name'), { key: 'icon', label: 'Icon', type: 'icon', help: ICON_HELP }, { key: 'items', label: 'What is in this layer', type: 'lines', rows: 7, help: 'One entry per line.' }],
      },
    ],
  },
  principles: {
    intro: 'The cards that explain how you work.',
    fields: [{ group: 'Section titles' }, ...HEAD],
    lists: [{
      key: 'items', label: 'Principles', noun: 'principle', prefix: 'pr',
      title: (x) => x.title, sub: (x) => x.text, icon: (x) => x.icon,
      fields: [T('title', 'Title'), L('text', 'Text', { rows: 4 }), { key: 'icon', label: 'Icon', type: 'icon', help: ICON_HELP }],
    }],
  },
  work: {
    intro: 'The architecture you own, as short case studies: the problem, what you designed and where it stands.',
    fields: [{ group: 'Section text' }, ...HEAD, L('intro', 'Introduction', { rows: 3 })],
    lists: [{
      key: 'items', label: 'Case studies', noun: 'case study', prefix: 'w',
      title: (x) => x.title, sub: (x) => [x.client, x.period].filter(Boolean).join(' · '), icon: (x) => x.icon, badges: (x) => [x.status],
      fields: [
        T('title', 'Title'), T('client', 'Client or programme'), T('period', 'Period'),
        { key: 'status', label: 'Status', type: 'text', suggest: STATUS_IDEAS },
        { key: 'icon', label: 'Icon', type: 'icon', help: ICON_HELP },
        L('problem', 'The problem', { rows: 4 }), L('approach', 'What I designed', { rows: 5 }), L('outcome', 'Where it stands', { rows: 3 }),
        { key: 'tags', label: 'Tags', type: 'tags', help: 'Separate with commas.' },
      ],
    }],
  },
  experience: {
    intro: 'Your career timeline. The most recent role goes first.',
    fields: [{ group: 'Section text' }, ...HEAD, L('intro', 'Introduction', { rows: 3 })],
    lists: [{
      key: 'items', label: 'Roles', noun: 'role', prefix: 'e',
      title: (x) => `${x.company || ''} · ${x.role || ''}`, sub: (x) => `${x.start || '?'} to ${x.end || 'now'}`,
      fields: [
        T('company', 'Company'), T('role', 'Role'), T('place', 'Place'),
        { key: 'start', label: 'Started', type: 'month' },
        { key: 'end', label: 'Ended', type: 'month', help: 'Leave empty for your current role.' },
        L('summary', 'Summary', { rows: 4 }),
        { key: 'points', label: 'Key points or client engagements', type: 'lines', rows: 7, help: 'One per line.' },
      ],
    }],
  },
  skills: {
    intro: 'Your skills, in groups.',
    fields: [{ group: 'Section titles' }, ...HEAD],
    lists: [{
      key: 'groups', label: 'Skill groups', noun: 'group', prefix: 'g',
      title: (x) => x.name, sub: (x) => (Array.isArray(x.items) ? x.items.join(' · ') : ''), icon: (x) => x.icon,
      fields: [T('name', 'Group name'), { key: 'icon', label: 'Icon', type: 'icon', help: ICON_HELP }, { key: 'items', label: 'Skills', type: 'tags', help: 'Separate with commas.' }],
    }],
  },
  certifications: {
    intro: 'Certifications and programmes. Add a link to a credential page if you have one.',
    fields: [{ group: 'Section titles' }, ...HEAD],
    lists: [{
      key: 'items', label: 'Certifications', noun: 'certification', prefix: 'c',
      title: (x) => x.name, sub: (x) => [x.issuer, x.year].filter(Boolean).join(' · '), icon: (x) => x.icon,
      fields: [T('name', 'Name'), T('issuer', 'Issued by'), T('year', 'Year'), { key: 'link', label: 'Credential link (optional)', type: 'url', placeholder: 'https://...' }, { key: 'icon', label: 'Icon', type: 'icon', help: ICON_HELP }],
    }],
  },
  education: {
    intro: 'Shown under the certifications, and on the CV page.',
    fields: [],
    lists: [
      { key: 'items', label: 'Education', noun: 'degree', prefix: 'ed', title: (x) => x.degree, sub: (x) => [x.school, x.year].filter(Boolean).join(' · '), fields: [T('degree', 'Degree'), T('school', 'University or school'), T('year', 'Year')] },
      { key: 'languages', label: 'Languages', noun: 'language', prefix: 'la', title: (x) => x.name, sub: (x) => x.level, fields: [T('name', 'Language'), T('level', 'Level')] },
    ],
  },
  recommendations: {
    intro: 'Recommendations people wrote about you. To copy them from LinkedIn: open your profile, go to Recommendations, then Received, and paste each one here. Hidden ones are never sent to visitors.',
    fields: [{ group: 'Section text' }, ...HEAD, L('intro', 'Introduction', { rows: 2 })],
    lists: [{
      key: 'items', label: 'Recommendations', noun: 'recommendation', prefix: 'r',
      title: (x) => x.name, sub: (x) => x.text, badges: (x) => [x.visible === false ? 'Hidden' : ''],
      fields: [
        T('name', 'Name'), T('role', 'Their role or company'), T('relation', 'How you worked together'), T('date', 'Date'),
        L('text', 'Recommendation', { rows: 9 }),
        { key: 'visible', label: 'Show it on the portfolio', type: 'toggle', default: true },
      ],
    }],
  },
  contact: {
    intro: 'The closing band with your email, LinkedIn and CV buttons.',
    fields: [{ group: 'Contact band' }, ...HEAD, L('text', 'Text', { rows: 4 })],
  },
  seo: {
    intro: 'How the portfolio appears in Google and in link previews on LinkedIn, WhatsApp and email.',
    fields: [
      { group: 'Search and link previews' },
      T('title', 'Page title', { help: 'Around 60 characters works best.' }),
      L('description', 'Description', { rows: 3, help: 'Around 155 characters works best.' }),
      { key: 'index', label: 'Let search engines show the portfolio', type: 'toggle', default: true },
    ],
  },
};

const blank = (f) => (f.type === 'toggle' ? !!f.default : f.type === 'lines' || f.type === 'tags' ? [] : '');

/** Values as the form shows them: lists become text with one entry per line (or commas for tags). */
export function toForm(fields, data) {
  const out = {};
  fields.forEach((f) => {
    if (!f.key) return;
    const v = data && f.key in data ? data[f.key] : blank(f);
    if (f.type === 'lines') out[f.key] = Array.isArray(v) ? v.join('\n') : String(v || '');
    else if (f.type === 'tags') out[f.key] = Array.isArray(v) ? v.join(', ') : String(v || '');
    else if (f.type === 'toggle') out[f.key] = v === undefined || v === '' ? !!f.default : !!v;
    else out[f.key] = v == null ? '' : v;
  });
  return out;
}

/** Values as they are saved: lines and tags become lists, everything else is trimmed text. */
export function fromForm(fields, vals) {
  const out = {};
  fields.forEach((f) => {
    if (!f.key) return;
    const v = vals[f.key];
    if (f.type === 'lines') out[f.key] = String(v || '').split('\n').map((x) => x.trim()).filter(Boolean);
    else if (f.type === 'tags') out[f.key] = String(v || '').split(/,|\n/).map((x) => x.trim()).filter(Boolean);
    else if (f.type === 'toggle') out[f.key] = !!v;
    else out[f.key] = typeof v === 'string' ? v.trim() : v;
  });
  return out;
}

/** Checks a form before saving. Returns a message, or '' when it is fine. */
export function problem(fields, vals) {
  for (const f of fields) {
    const v = typeof vals[f.key] === 'string' ? vals[f.key].trim() : '';
    if (!v) continue;
    if (f.type === 'url' && !/^https:\/\/[^\s<>"]+$/i.test(v)) return `${f.label}: use a full address that starts with https://`;
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `${f.label}: enter a valid email address.`;
  }
  return '';
}
