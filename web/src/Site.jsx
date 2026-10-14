import React, { useEffect, useState } from 'react';
import { asList, fileUrl, period, since } from './api.js';
import { CountUp, Eyebrow, Gold, Icon, Photo, Words, initials, safeHref, scrollToSection, useReveal } from './ui.jsx';
import { SiteNav, SiteFooter } from './Chrome.jsx';
import { menuLinks, sectionsOf } from './sections.js';


const statusTone = (s) => {
  const v = String(s || '').toLowerCase();
  if (/live|in use|delivered|running/.test(v)) return 'live';
  if (/next|design|idea|plan/.test(v)) return 'next';
  if (/proof|poc|explor/.test(v)) return 'poc';
  return 'built';
};

function Status({ value }) {
  if (!value) return null;
  return <span className="status" data-tone={statusTone(value)}><i aria-hidden="true" />{value}</span>;
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** The opening: who I am, in one look. */
function Hero({ p, go, cvHref }) {
  const link = (to) => (e) => { e.preventDefault(); go(to); };
  return (
    <section className="hero-band">
      <div className="wrap hero">
        <div className="hero-text">
          <Eyebrow icon="briefcase" light>{p.eyebrow}</Eyebrow>
          <h1 className="h1"><Words text={p.title_lead} start={1} /> <span className="accent"><Words text={p.title_accent} start={6} /></span></h1>
          <p className="lead rise-in" style={{ '--i': 9 }}>{p.intro}</p>
          <div className="row rise-in" style={{ '--i': 11 }}>
            <a className="btn btn-gold" href="/#agentic" onClick={link('/#agentic')}>See my agent work</a>
            {cvHref
              ? <a className="btn btn-ghost" href={cvHref} target="_blank" rel="noopener"><Icon name="download" size={16} />Download CV</a>
              : <a className="btn btn-ghost" href="/cv" onClick={link('/cv')}><Icon name="doc" size={16} />View CV</a>}
          </div>
          <ul className="hero-meta rise-in" style={{ '--i': 13 }}>
            {p.location ? <li><Icon name="pin" size={15} />{p.location}</li> : null}
            {p.email ? <li><Icon name="mail" size={15} /><a href={`mailto:${p.email}`}>{p.email}</a></li> : null}
            {safeHref(p.linkedin) ? <li><Icon name="link" size={15} /><a href={safeHref(p.linkedin)} target="_blank" rel="noopener">LinkedIn</a></li> : null}
          </ul>
        </div>
        <div className="hero-photo">
          {p.photo_key
            ? <Photo k={p.photo_key} label={p.name} className="frame frame-offset" />
            : (
              <div className="monogram frame-offset" role="img" aria-label={p.name}>
                <span className="mono-ring" aria-hidden="true" />
                <b>{initials(p.name)}</b>
                <small>{p.headline}</small>
              </div>
            )}
        </div>
      </div>
    </section>
  );
}

function Stats({ s }) {
  const items = (s.items || []).filter((x) => x.value || x.label);
  if (!items.length) return null;
  return (
    <section id="stats" className="band band-ink band-bright">
      <div className="wrap">
        <Eyebrow icon="chart" light data-rise="">{s.eyebrow}</Eyebrow>
        <h2 className="h2" data-rise="">{s.title}</h2>
        <div className="stats">
          {items.map((x, i) => (
            <div key={x.id || i} className="stat" data-rise="" style={{ '--d': i }}>
              <Gold name={x.icon || 'star'} />
              <div><b><CountUp value={x.value} /></b><p>{x.label}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The agent ecosystem drawn as layers: where I talk to the agents, the agents, the models, the MCP tools and the guardrails. */
function Ecosystem({ a }) {
  const layers = (a.layers || []).filter((l) => l.name);
  if (!layers.length) return null;
  return (
    <figure className="eco" data-rise="" aria-label={a.diagram_title || 'How the pieces fit together'}>
      <figcaption className="eco-title"><Gold name="layers" size="sm" />{a.diagram_title}</figcaption>
      <div className="eco-stack">
        <span className="eco-spine" aria-hidden="true"><i /></span>
        {layers.map((l, i) => (
          <div key={l.id || i} className="eco-layer" data-rise="" style={{ '--d': i }}>
            <div className="eco-name"><Gold name={l.icon || 'layers'} /><span><small>Layer {i + 1}</small>{l.name}</span></div>
            <ul className="eco-chips">
              {asList(l.items).map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </figure>
  );
}

function Project({ x, i }) {
  const href = safeHref(x.link);
  const highlights = asList(x.highlights);
  const stack = asList(x.stack);
  return (
    <article className={`proj${x.featured ? ' proj-featured' : ''}`} data-rise="" data-lift="" style={{ '--d': Math.min(i, 4) }} id={x.id ? `p-${x.id}` : undefined}>
      <div className="proj-main">
        <header className="proj-head">
          <Gold name={x.icon || 'bot'} size={x.featured ? 'lg' : 'md'} />
          <Status value={x.status} />
          {x.year ? <span className="proj-year">{x.year}</span> : null}
        </header>
        <h3>{x.title}</h3>
        {x.tagline ? <p className="proj-tag">{x.tagline}</p> : null}
        {x.summary ? <p className="muted">{x.summary}</p> : null}
        {x.image_key ? <Photo k={x.image_key} label={x.title} className="proj-img frame" /> : null}
        {stack.length ? <ul className="chips">{stack.map((s) => <li key={s}>{s}</li>)}</ul> : null}
        {href ? <a className="proj-link" href={href} target="_blank" rel="noopener">{x.link_label || 'Open'}<Icon name="external" size={14} /></a> : null}
      </div>
      {highlights.length ? (
        <ul className="ticks">
          {highlights.map((h) => <li key={h}><Icon name="check" size={16} /><span>{h}</span></li>)}
        </ul>
      ) : null}
    </article>
  );
}

function Agentic({ a }) {
  const items = a.items || [];
  return (
    <section id="agentic" className="wrap section">
      <div className="section-head" data-rise="">
        <Eyebrow icon="bot">{a.eyebrow}</Eyebrow>
        <h2 className="h2" data-mask="">{a.title}</h2>
        {a.intro ? <p className="muted lead-wide">{a.intro}</p> : null}
      </div>
      <Ecosystem a={a} />
      <div className="projects">
        {[...items.filter((x) => x.featured), ...items.filter((x) => !x.featured)].map((x, i) => <Project key={x.id || i} x={x} i={i} />)}
      </div>
    </section>
  );
}

function Principles({ pr }) {
  const items = (pr.items || []).filter((x) => x.title);
  if (!items.length) return null;
  return (
    <section id="principles" className="band band-alt">
      <div className="wrap section">
        <div className="section-head" data-rise="">
          <Eyebrow icon="target">{pr.eyebrow}</Eyebrow>
          <h2 className="h2" data-mask="">{pr.title}</h2>
        </div>
        <div className="principles">
          {items.map((x, i) => (
            <article key={x.id || i} className="principle" data-rise="" data-lift="" style={{ '--d': i }}>
              <Gold name={x.icon || 'star'} size="lg" />
              <h3>{x.title}</h3>
              <p className="muted">{x.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Work({ w }) {
  const items = w.items || [];
  if (!items.length) return null;
  return (
    <section id="work" className="wrap section">
      <div className="section-head" data-rise="">
        <Eyebrow icon="hub">{w.eyebrow}</Eyebrow>
        <h2 className="h2" data-mask="">{w.title}</h2>
        {w.intro ? <p className="muted lead-wide">{w.intro}</p> : null}
      </div>
      <div className="cases">
        {items.map((x, i) => (
          <article key={x.id || i} className="case" data-rise="" data-lift="" style={{ '--d': Math.min(i % 2, 1) }}>
            <header className="case-head">
              <Gold name={x.icon || 'layers'} />
              <span className="case-client">{[x.client, x.period].filter(Boolean).join(' · ')}</span>
              <Status value={x.status} />
            </header>
            <h3>{x.title}</h3>
            <dl>
              {x.problem ? <><dt>The problem</dt><dd>{x.problem}</dd></> : null}
              {x.approach ? <><dt>What I designed</dt><dd>{x.approach}</dd></> : null}
              {x.outcome ? <><dt>Where it stands</dt><dd>{x.outcome}</dd></> : null}
            </dl>
            {asList(x.tags).length ? <ul className="chips">{asList(x.tags).map((t) => <li key={t}>{t}</li>)}</ul> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Counter({ p }) {
  const now = useNow();
  const t = since(p.career_start, now);
  if (!t) return null;
  const cells = [['years', t.years], ['days', t.days], ['hours', t.hours], ['minutes', t.minutes], ['seconds', t.seconds]];
  return (
    <section id="counter" className="counter">
      <div className="wrap counter-in">
        <div>
          <Eyebrow icon="clock" light>{p.counter_title}</Eyebrow>
          <div className="counter-cells" aria-live="off">
            {cells.map(([k, v]) => <div key={k}><b className="num">{k === 'years' ? v : String(v).padStart(2, '0')}</b><small>{k}</small></div>)}
          </div>
        </div>
        {p.counter_text ? <div className="counter-side"><p>{p.counter_text}</p></div> : null}
      </div>
    </section>
  );
}

function Experience({ e }) {
  const items = e.items || [];
  if (!items.length) return null;
  return (
    <section id="experience" className="wrap section story">
      <div className="story-side">
        <div data-rise="l">
          <Eyebrow icon="briefcase">{e.eyebrow}</Eyebrow>
          <h2 className="h2" data-mask="">{e.title}</h2>
          {e.intro ? <p className="muted">{e.intro}</p> : null}
        </div>
      </div>
      <ol className="timeline">
        <span className="timeline-line" data-draw="" aria-hidden="true" />
        {items.map((x, i) => (
          <li key={x.id || i} data-rise="r" style={{ '--d': Math.min(i, 4) }}>
            <span className="timeline-label">{String(x.start || '').slice(0, 4)}{x.end ? ` – ${String(x.end).slice(0, 4)}` : ' – now'}</span>
            <div>
              <h3>{x.company}</h3>
              <p className="xp-role">{x.role}</p>
              <p className="xp-meta">{period(x.start, x.end)}{x.place ? ` · ${x.place}` : ''}</p>
              {x.summary ? <p className="muted">{x.summary}</p> : null}
              {asList(x.points).length ? (
                <ul className="xp-points">{asList(x.points).map((pt) => <li key={pt}>{pt}</li>)}</ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Skills({ s }) {
  const groups = (s.groups || []).filter((g) => g.name);
  if (!groups.length) return null;
  return (
    <section id="skills" className="band band-alt">
      <div className="wrap section">
        <div className="section-head" data-rise="">
          <Eyebrow icon="spark">{s.eyebrow}</Eyebrow>
          <h2 className="h2" data-mask="">{s.title}</h2>
        </div>
        <div className="skills">
          {groups.map((g, i) => (
            <article key={g.id || i} className="skill" data-rise="" data-lift="" style={{ '--d': i % 3 }}>
              <h3 className="with-icon"><Gold name={g.icon || 'star'} />{g.name}</h3>
              <ul className="chips">{asList(g.items).map((x) => <li key={x}>{x}</li>)}</ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Certifications({ c, ed }) {
  const items = (c.items || []).filter((x) => x.name);
  const edu = (ed.items || []).filter((x) => x.degree);
  const langs = (ed.languages || []).filter((x) => x.name);
  if (!items.length && !edu.length) return null;
  return (
    <section id="certifications" className="wrap section">
      <div className="section-head" data-rise="">
        <Eyebrow icon="award">{c.eyebrow}</Eyebrow>
        <h2 className="h2" data-mask="">{c.title}</h2>
      </div>
      <div className="certs">
        {items.map((x, i) => {
          const href = safeHref(x.link);
          const body = <><Gold name={x.icon || 'award'} /><span><b>{x.name}</b><small>{[x.issuer, x.year].filter(Boolean).join(' · ')}</small></span>{href ? <Icon name="external" size={14} /> : null}</>;
          return href
            ? <a key={x.id || i} className="cert" href={href} target="_blank" rel="noopener" data-rise="" data-lift="" style={{ '--d': i % 4 }}>{body}</a>
            : <div key={x.id || i} className="cert" data-rise="" data-lift="" style={{ '--d': i % 4 }}>{body}</div>;
        })}
      </div>
      {edu.length || langs.length ? (
        <div className="edu" data-rise="">
          {edu.length ? (
            <div>
              <p className="eyebrow"><Gold name="grad" size="sm" /><span>Education</span></p>
              {edu.map((x, i) => <p key={x.id || i} className="edu-line"><b>{x.degree}</b><span>{[x.school, x.year].filter(Boolean).join(' · ')}</span></p>)}
            </div>
          ) : null}
          {langs.length ? (
            <div>
              <p className="eyebrow"><Gold name="globe" size="sm" /><span>Languages</span></p>
              <ul className="langs">{langs.map((x, i) => <li key={x.id || i}><b>{x.name}</b><span>{x.level}</span></li>)}</ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Recommendations({ r }) {
  const items = (r.items || []).filter((x) => x.text && x.visible !== false);
  if (!items.length) return null;
  return (
    <section id="recommendations" className="band band-ink">
      <div className="wrap">
        <Eyebrow icon="quote" light data-rise="">{r.eyebrow}</Eyebrow>
        <h2 className="h2" data-rise="">{r.title}</h2>
        {r.intro ? <p className="on-dark-muted" data-rise="">{r.intro}</p> : null}
        <div className={`recs${items.length === 1 ? ' recs-one' : ''}`}>
          {items.map((x, i) => (
            <figure key={x.id || i} className="rec" data-rise="" style={{ '--d': Math.min(i, 3) }}>
              <Icon name="quote" size={30} />
              <blockquote>{x.text}</blockquote>
              <figcaption>
                <span className="avatar" aria-hidden="true">{initials(x.name)}</span>
                <span><b>{x.name}</b><small>{[x.role, x.date].filter(Boolean).join(' · ')}</small>{x.relation ? <small>{x.relation}</small> : null}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact({ c, p, cvHref, go }) {
  const linkedin = safeHref(p.linkedin);
  const phone = p.show_phone && p.phone ? `tel:${String(p.phone).replace(/[^+\d]/g, '')}` : '';
  return (
    <section id="contact" className="wrap section">
      <div className="cta-band" data-rise="">
        <span className="blob blob-a" aria-hidden="true" /><span className="blob blob-b" aria-hidden="true" />
        <div className="cta-text">
          <Eyebrow icon="mail" light>{c.eyebrow}</Eyebrow>
          <h2>{c.title}</h2>
          <p>{c.text}</p>
          {p.open_to ? <p className="cta-open"><Icon name="check" size={16} />{p.open_to}</p> : null}
        </div>
        <div className="cta-actions">
          {p.email ? <a className="btn btn-gold btn-pill" href={`mailto:${p.email}`}><Icon name="mail" size={16} />Email me</a> : null}
          {linkedin ? <a className="btn btn-ghost btn-pill" href={linkedin} target="_blank" rel="noopener"><Icon name="link" size={16} />LinkedIn</a> : null}
          {phone ? <a className="btn btn-ghost btn-pill" href={phone}><Icon name="phone" size={16} />{p.phone}</a> : null}
          {cvHref
            ? <a className="btn btn-ghost btn-pill" href={cvHref} target="_blank" rel="noopener"><Icon name="download" size={16} />Download CV</a>
            : <a className="btn btn-ghost btn-pill" href="/cv" onClick={(e) => { e.preventDefault(); go('/cv'); }}><Icon name="doc" size={16} />View CV</a>}
        </div>
      </div>
    </section>
  );
}

/* ---------- sections added in the page builder ---------- */

function Head({ s, light }) {
  if (!s.eyebrow && !s.title && !s.intro) return null;
  return (
    <div className="section-head" data-rise="">
      {s.eyebrow ? <Eyebrow icon={s.icon || 'star'} light={light}>{s.eyebrow}</Eyebrow> : null}
      {s.title ? <h2 className="h2" data-mask="">{s.title}</h2> : null}
      {s.intro ? <p className={`${light ? 'on-dark-muted' : 'muted'} lead-wide`}>{s.intro}</p> : null}
    </div>
  );
}

function ItemLink({ x, light }) {
  const href = safeHref(x.link);
  if (!href) return null;
  return <a className={`proj-link${light ? ' on-dark-link' : ''}`} href={href} target={/^https:/.test(href) ? '_blank' : undefined} rel="noopener">{x.link_label || 'Open'}<Icon name="external" size={14} /></a>;
}

function Points({ list }) {
  const items = asList(list);
  if (!items.length) return null;
  return <ul className="ticks">{items.map((h) => <li key={h}><Icon name="check" size={16} /><span>{h}</span></li>)}</ul>;
}

/** A section made in the page builder: cards, text, timeline, numbers, quotes or a call to action. */
export function CustomSection({ s }) {
  const items = (s.items || []).filter((x) => x && (x.title || x.text || x.label));
  const dark = s.style === 'dark';
  const tone = dark ? 'band band-ink cs-dark' : s.style === 'cream' ? 'band band-alt' : '';
  const t = s.template || 'cards';
  let body = null;
  if (t === 'cards') {
    body = (
      <div className="cs-cards">
        {items.map((x, i) => (
          <article key={x.id || i} className="cs-card" data-rise="" data-lift="" style={{ '--d': i % 3 }}>
            <header className="proj-head">{x.icon ? <Gold name={x.icon} /> : null}{x.label ? <span className="status" data-tone="built"><i aria-hidden="true" />{x.label}</span> : null}</header>
            {x.title ? <h3>{x.title}</h3> : null}
            {x.text ? <p className="muted cs-text">{x.text}</p> : null}
            {x.image_key ? <Photo k={x.image_key} label={x.title} className="frame" /> : null}
            <Points list={x.points} />
            {asList(x.tags).length ? <ul className="chips">{asList(x.tags).map((g) => <li key={g}>{g}</li>)}</ul> : null}
            <ItemLink x={x} light={dark} />
          </article>
        ))}
      </div>
    );
  } else if (t === 'text') {
    body = (
      <div className="cs-text-wrap">
        {s.image_key ? <Photo k={s.image_key} label={s.title} className="frame cs-text-img" /> : null}
        <div className="cs-paras">
          {items.map((x, i) => (
            <div key={x.id || i} className="cs-para" data-rise="">
              {x.title ? <h3>{x.title}</h3> : null}
              {x.text ? <p className="cs-text">{x.text}</p> : null}
              <Points list={x.points} />
              {x.image_key ? <Photo k={x.image_key} label={x.title} className="frame" /> : null}
            </div>
          ))}
        </div>
      </div>
    );
  } else if (t === 'timeline') {
    body = (
      <ol className="timeline cs-timeline">
        <span className="timeline-line" data-draw="" aria-hidden="true" />
        {items.map((x, i) => (
          <li key={x.id || i} data-rise="r" style={{ '--d': Math.min(i, 4) }}>
            {x.label ? <span className="timeline-label">{x.label}</span> : null}
            <div>
              {x.title ? <h3>{x.title}</h3> : null}
              {x.text ? <p className={`${dark ? 'on-dark-muted' : 'muted'} cs-text`}>{x.text}</p> : null}
              <Points list={x.points} />
              {x.image_key ? <Photo k={x.image_key} label={x.title} className="timeline-photo" /> : null}
            </div>
          </li>
        ))}
      </ol>
    );
  } else if (t === 'numbers') {
    body = (
      <div className={`stats${dark ? '' : ' stats-light'}`}>
        {items.map((x, i) => (
          <div key={x.id || i} className="stat" data-rise="" style={{ '--d': i }}>
            <Gold name={x.icon || 'star'} />
            <div><b><CountUp value={x.title} /></b><p>{x.text}</p></div>
          </div>
        ))}
      </div>
    );
  } else if (t === 'quotes') {
    body = (
      <div className={`recs${items.length === 1 ? ' recs-one' : ''}${dark ? '' : ' recs-light'}`}>
        {items.map((x, i) => (
          <figure key={x.id || i} className="rec" data-rise="" style={{ '--d': Math.min(i, 3) }}>
            <Icon name="quote" size={30} />
            <blockquote>{x.text}</blockquote>
            {x.title ? <figcaption><span className="avatar" aria-hidden="true">{initials(x.title)}</span><span><b>{x.title}</b>{x.label ? <small>{x.label}</small> : null}</span></figcaption> : null}
          </figure>
        ))}
      </div>
    );
  } else if (t === 'cta') {
    return (
      <section id={s.id} className="wrap section">
        <div className="cta-band" data-rise="">
          <span className="blob blob-a" aria-hidden="true" /><span className="blob blob-b" aria-hidden="true" />
          <div className="cta-text">
            {s.eyebrow ? <Eyebrow icon={s.icon || 'star'} light>{s.eyebrow}</Eyebrow> : null}
            {s.title ? <h2>{s.title}</h2> : null}
            {s.intro ? <p>{s.intro}</p> : null}
          </div>
          <div className="cta-actions">
            {items.filter((x) => safeHref(x.link)).map((x, i) => (
              <a key={x.id || i} className={`btn btn-pill ${i === 0 ? 'btn-gold' : 'btn-ghost'}`} href={safeHref(x.link)} target={/^https:/.test(x.link) ? '_blank' : undefined} rel="noopener">{x.title || 'Open'}</a>
            ))}
          </div>
        </div>
      </section>
    );
  }
  const inner = <><Head s={s} light={dark} />{body}</>;
  if (!tone) return <section id={s.id} className="wrap section">{inner}</section>;
  return <section id={s.id} className={tone}><div className={dark ? 'wrap cs-dark-in' : 'wrap section'}>{inner}</div></section>;
}

/** One section of the page, in the order set in the page builder. */
function SectionOf({ s, b, p, go, cvHref }) {
  switch (s.type) {
    case 'stats': return <Stats s={b.stats || {}} />;
    case 'agentic': return <Agentic a={b.agentic || {}} />;
    case 'principles': return <Principles pr={b.principles || {}} />;
    case 'work': return <Work w={b.work || {}} />;
    case 'counter': return <Counter p={p} />;
    case 'experience': return <Experience e={b.experience || {}} />;
    case 'skills': return <Skills s={b.skills || {}} />;
    case 'certifications': return <Certifications c={b.certifications || {}} ed={b.education || {}} />;
    case 'recommendations': return <Recommendations r={b.recommendations || {}} />;
    case 'contact': return <Contact c={b.contact || {}} p={p} cvHref={cvHref} go={go} />;
    case 'custom': return <CustomSection s={s} />;
    default: return null;
  }
}

export const cvLink = (cv, name) => (cv && cv.file_key ? `${fileUrl(cv.file_key)}?download=1&name=${encodeURIComponent(`${String(name || 'CV').replace(/\s+/g, '-')}-CV.pdf`)}` : '');

export default function Site({ site, go, isAdmin }) {
  const b = site.blocks;
  const p = b.profile || {};
  useReveal(site);
  useEffect(() => {
    // Opening a link like /#agentic lands on that section once the page has drawn.
    const id = window.location.hash.slice(1);
    if (id) requestAnimationFrame(() => scrollToSection(id));
  }, []);
  const cvHref = cvLink(b.cv, p.name);
  return (
    <div className="page">
      <SiteNav go={go} isAdmin={isAdmin} links={menuLinks(b.layout)} name={p.name} />
      <main>
        <Hero p={p} go={go} cvHref={cvHref} />
        {sectionsOf(b.layout).filter((s) => s.visible !== false).map((s) => <SectionOf key={s.id} s={s} b={b} p={p} go={go} cvHref={cvHref} />)}
      </main>
      <SiteFooter name={p.name} location={p.location} />
    </div>
  );
}
