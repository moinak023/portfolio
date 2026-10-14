// The sections a page can be made of. The opening always comes first and the footer last; everything between
// is ordered, shown or hidden in Admin → Page builder. Built-in sections keep their content in their own
// section of the database; custom sections keep their content inside the layout itself.

/** Built-in sections: what they are called in the builder, their icon, and which saved section holds their content. */
export const BUILT_IN = {
  stats: { name: 'Numbers band', icon: 'chart', block: 'stats', about: 'Your key numbers, counting up on a dark band.' },
  agentic: { name: 'Agentic AI', icon: 'bot', block: 'agentic', about: 'The ecosystem diagram and your agent projects.' },
  principles: { name: 'How I work', icon: 'target', block: 'principles', about: 'Cards with the habits behind your designs.' },
  work: { name: 'Architecture', icon: 'hub', block: 'work', about: 'Case studies: the problem, the design and where it stands.' },
  counter: { name: 'Live counter', icon: 'clock', block: 'profile', about: 'Years, days, hours, minutes and seconds since your career started.' },
  experience: { name: 'Experience', icon: 'briefcase', block: 'experience', about: 'Your career timeline.' },
  skills: { name: 'Skills', icon: 'spark', block: 'skills', about: 'Skill groups shown as cards.' },
  certifications: { name: 'Certifications and education', icon: 'award', block: 'certifications', about: 'Certifications, then education and languages.' },
  recommendations: { name: 'Recommendations', icon: 'quote', block: 'recommendations', about: 'Recommendations, on a dark band.' },
  contact: { name: 'Contact', icon: 'mail', block: 'contact', about: 'The closing band with your contact buttons.' },
};

/** Templates for sections you add yourself. Every template uses the same sub-section fields, labelled for its purpose. */
export const TEMPLATES = {
  cards: {
    name: 'Cards', icon: 'layers', about: 'Sub-sections side by side as cards, each with an icon, text, points, tags, an image and a link.',
    noun: 'card',
    fields: { title: 'Title', label: 'Small label above the title', text: 'Text', points: 'Points (one per line)', tags: 'Tags (separated by commas)', icon: 'Icon', image_key: 'Image (optional)', link: 'Link (optional)', link_label: 'Text of the link' },
  },
  text: {
    name: 'Text', icon: 'text', about: 'A heading and introduction, then paragraphs with their own headings. Good for an article or a longer story.',
    noun: 'paragraph',
    fields: { title: 'Heading of this part (optional)', text: 'Paragraph', points: 'Points (one per line, optional)', image_key: 'Image (optional)' },
  },
  timeline: {
    name: 'Timeline', icon: 'history', about: 'Sub-sections in order down a gold line, each with a date, a title, text and points.',
    noun: 'entry',
    fields: { label: 'Date or year', title: 'Title', text: 'Text', points: 'Points (one per line)', image_key: 'Image (optional)' },
  },
  numbers: {
    name: 'Numbers', icon: 'chart', about: 'Big numbers that count up, each with a short line saying what it means.',
    noun: 'number',
    fields: { title: 'Number (for example 16+)', text: 'What the number means', icon: 'Icon' },
  },
  quotes: {
    name: 'Quotes', icon: 'quote', about: 'Quotes or testimonials, each with the name and role of the person.',
    noun: 'quote',
    fields: { text: 'Quote', title: 'Name', label: 'Role or company' },
  },
  cta: {
    name: 'Call to action', icon: 'arrow', about: 'A rounded band with a title, a line of text and buttons.',
    noun: 'button',
    fields: { title: 'Button text', link: 'Button link (https:// or mailto:)' },
  },
};

export const STYLES = [['light', 'Light (page colour)'], ['cream', 'Cream band'], ['dark', 'Dark teal band']];

/** The page order used until a layout is saved. */
export const DEFAULT_SECTIONS = [
  { id: 'stats', type: 'stats', visible: true, menu: false, label: 'In numbers' },
  { id: 'agentic', type: 'agentic', visible: true, menu: true, label: 'Agentic AI' },
  { id: 'principles', type: 'principles', visible: true, menu: false, label: 'How I work' },
  { id: 'work', type: 'work', visible: true, menu: true, label: 'Architecture' },
  { id: 'counter', type: 'counter', visible: true, menu: false, label: 'Live counter' },
  { id: 'experience', type: 'experience', visible: true, menu: true, label: 'Experience' },
  { id: 'skills', type: 'skills', visible: true, menu: true, label: 'Skills' },
  { id: 'certifications', type: 'certifications', visible: true, menu: false, label: 'Certifications' },
  { id: 'recommendations', type: 'recommendations', visible: true, menu: true, label: 'Recommendations' },
  { id: 'contact', type: 'contact', visible: true, menu: true, label: 'Contact' },
];

/** The sections in page order. A built-in section missing from a saved layout is added back at the end, hidden. */
export function sectionsOf(layout) {
  const saved = layout && Array.isArray(layout.sections) && layout.sections.length ? layout.sections : DEFAULT_SECTIONS;
  const list = saved.filter((s) => s && s.id && (s.type === 'custom' || BUILT_IN[s.type]));
  for (const d of DEFAULT_SECTIONS) if (!list.some((s) => s.type === d.type)) list.push({ ...d, visible: false });
  return list;
}

/** Menu links for the top navigation, in page order. */
export const menuLinks = (layout) => sectionsOf(layout)
  .filter((s) => s.visible !== false && s.menu && (s.label || s.title))
  .map((s) => ({ to: `/#${s.id}`, label: s.label || s.title }));

/** A new custom section, ready to fill in. */
export function newSection(template) {
  const t = TEMPLATES[template] || TEMPLATES.cards;
  const id = `c-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const one = (n) => ({ id: `${id}-${n}`, title: '', label: '', text: '', points: [], tags: [], icon: '', image_key: '', link: '', link_label: '' });
  const starter = {
    cards: [{ ...one(1), title: 'First card', text: 'Describe it here.', icon: 'star' }, { ...one(2), title: 'Second card', text: 'Describe it here.', icon: 'star' }],
    text: [{ ...one(1), text: 'Write your text here.' }],
    timeline: [{ ...one(1), label: '2026', title: 'First entry', text: 'What happened.' }],
    numbers: [{ ...one(1), title: '10+', text: 'What the number means', icon: 'chart' }],
    quotes: [{ ...one(1), text: 'The quote goes here.', title: 'Name', label: 'Role' }],
    cta: [{ ...one(1), title: 'Email me', link: '' }],
  }[template] || [];
  return {
    id, type: 'custom', template: template in TEMPLATES ? template : 'cards', style: template === 'cta' ? 'light' : 'light',
    visible: true, menu: false, label: '', eyebrow: t.name, icon: t.icon, title: `New ${t.name.toLowerCase()} section`, intro: '',
    image_key: '', items: starter,
  };
}

/** A copy of a custom section with new ids, placed right after the original. */
export function duplicate(section) {
  const copy = JSON.parse(JSON.stringify(section));
  const id = `c-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  copy.id = id;
  copy.title = `${section.title || 'Section'} (copy)`;
  copy.menu = false;
  copy.items = (copy.items || []).map((x, i) => ({ ...x, id: `${id}-${i + 1}` }));
  return copy;
}

/** What the builder shows as the name of a section. */
export function sectionName(s, blocks = {}) {
  if (s.type === 'custom') return s.title || 'Untitled section';
  const b = blocks[BUILT_IN[s.type].block] || {};
  if (s.type === 'counter') return b.counter_title || BUILT_IN.counter.name;
  return b.title || BUILT_IN[s.type].name;
}
