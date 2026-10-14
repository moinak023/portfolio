import React, { useEffect } from 'react';
import { DEMO, asList, period } from './api.js';
import { Icon, safeHref } from './ui.jsx';
import { cvLink } from './Site.jsx';

/**
 * A printable CV made from the same content as the portfolio, so it is always up to date.
 * "Save as PDF" uses the browser's own print dialogue.
 */
export default function Cv({ site, go }) {
  const b = site.blocks;
  const p = b.profile || {};
  const exp = (b.experience || {}).items || [];
  const agents = ((b.agentic || {}).items || []).filter((x) => !/next/i.test(x.status || ''));
  const work = (b.work || {}).items || [];
  const skills = ((b.skills || {}).groups || []).filter((g) => g.name);
  const certs = ((b.certifications || {}).items || []).filter((x) => x.name);
  const edu = ((b.education || {}).items || []).filter((x) => x.degree);
  const langs = ((b.education || {}).languages || []).filter((x) => x.name);
  const site_url = DEMO ? 'moinakghosh.com' : window.location.origin.replace(/^https?:\/\//, '');
  const linkedin = safeHref(p.linkedin);
  const designed = cvLink(b.cv, p.name);

  useEffect(() => {
    document.documentElement.classList.add('cv-mode');
    window.scrollTo(0, 0);
    return () => document.documentElement.classList.remove('cv-mode');
  }, []);

  return (
    <div className="cv-wrap">
      <div className="cv-bar">
        <button type="button" className="btn btn-ghost-dark" onClick={() => go('/')}><Icon name="arrow" size={16} />Back to the portfolio</button>
        <div className="cv-bar-right">
          {designed ? <a className="btn btn-ghost-dark" href={designed} target="_blank" rel="noopener"><Icon name="download" size={16} />Designed CV (PDF)</a> : null}
          {DEMO ? null : <button type="button" className="btn btn-solid" onClick={() => window.print()}><Icon name="printer" size={16} />Save as PDF</button>}
        </div>
      </div>

      <article className="cv-page" aria-label={`CV of ${p.name}`}>
        <header className="cv-head">
          <div>
            <h1>{p.name}</h1>
            <p className="cv-headline">{p.headline}</p>
          </div>
          <ul className="cv-contact">
            {p.location ? <li><Icon name="pin" size={13} />{p.location}</li> : null}
            {p.email ? <li><Icon name="mail" size={13} />{p.email}</li> : null}
            {p.show_phone && p.phone ? <li><Icon name="phone" size={13} />{p.phone}</li> : null}
            {linkedin ? <li><Icon name="link" size={13} />{linkedin.replace(/^https:\/\/(www\.)?/, '')}</li> : null}
            <li><Icon name="globe" size={13} />{site_url}</li>
          </ul>
        </header>

        <p className="cv-summary">{p.intro}</p>

        <div className="cv-grid">
          <div className="cv-main">
            <section>
              <h2>Experience</h2>
              {exp.map((x) => (
                <div key={x.id} className="cv-job">
                  <div className="cv-job-head"><b>{x.role}</b><span>{period(x.start, x.end).split(' · ')[0]}</span></div>
                  <p className="cv-company">{x.company}{x.place ? ` · ${x.place}` : ''}</p>
                  {x.summary ? <p>{x.summary}</p> : null}
                  {asList(x.points).length ? <ul>{asList(x.points).map((pt) => <li key={pt}>{pt}</li>)}</ul> : null}
                </div>
              ))}
            </section>
            {agents.length ? (
              <section>
                <h2>Agentic AI work</h2>
                <ul className="cv-list">
                  {agents.map((x) => <li key={x.id}><b>{x.title}</b>{x.status ? ` · ${x.status}` : ''}. {x.tagline}</li>)}
                </ul>
              </section>
            ) : null}
            {work.length ? (
              <section>
                <h2>Architecture highlights</h2>
                <ul className="cv-list">
                  {work.map((x) => <li key={x.id}><b>{x.title}</b>{x.client ? ` (${x.client})` : ''}. {x.outcome || x.approach}</li>)}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="cv-side">
            <section>
              <h2>Skills</h2>
              {skills.map((g) => <p key={g.id} className="cv-skill"><b>{g.name}</b>{asList(g.items).join(' · ')}</p>)}
            </section>
            {certs.length ? (
              <section>
                <h2>Certifications</h2>
                <ul className="cv-plain">{certs.map((x) => <li key={x.id}><b>{x.name}</b><span>{[x.issuer, x.year].filter(Boolean).join(' · ')}</span></li>)}</ul>
              </section>
            ) : null}
            {edu.length ? (
              <section>
                <h2>Education</h2>
                <ul className="cv-plain">{edu.map((x) => <li key={x.id}><b>{x.degree}</b><span>{[x.school, x.year].filter(Boolean).join(' · ')}</span></li>)}</ul>
              </section>
            ) : null}
            {langs.length ? (
              <section>
                <h2>Languages</h2>
                <ul className="cv-plain">{langs.map((x) => <li key={x.id}><b>{x.name}</b><span>{x.level}</span></li>)}</ul>
              </section>
            ) : null}
          </aside>
        </div>
      </article>
    </div>
  );
}
