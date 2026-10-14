import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';

/** Top navigation. When the links do not fit on one line, they move into a full-screen menu. */
export function SiteNav({ go, isAdmin, links, name = 'Moinak Ghosh' }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) document.documentElement.setAttribute('data-lock', '1'); else document.documentElement.removeAttribute('data-lock');
    return () => document.documentElement.removeAttribute('data-lock');
  }, [open]);
  const jump = (to) => (e) => { e.preventDefault(); setOpen(false); go(to); };
  const linksRef = useRef(null);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const el = linksRef.current;
    if (!el) return undefined;
    const measure = () => {
      el.parentElement.classList.remove('nav-compact');
      const tooWide = el.scrollWidth > el.clientWidth + 1;
      el.parentElement.classList.toggle('nav-compact', tooWide);
      setCompact(tooWide);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el.parentElement);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [isAdmin, links.length]);
  const [first, ...rest] = String(name).split(' ');
  const brand = <>{first} <i>{rest.join(' ')}</i></>;
  const all = [...links, { to: '/cv', label: 'CV' }, ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : [])];
  return (
    <>
      <div id="scroll-progress" aria-hidden="true" />
      <header className={`nav${compact ? ' nav-compact' : ''}`}>
        <a className="brand" href="/" onClick={jump('/')}>{brand}</a>
        <nav className="nav-links" aria-label="Main" ref={linksRef}>
          {links.map((l) => <a key={l.to} href={l.to} onClick={jump(l.to)} data-underline="">{l.label}</a>)}
          {isAdmin ? <a className="nav-admin" href="/admin" onClick={jump('/admin')}><Icon name="key" size={14} />Admin</a> : null}
          <a className="nav-cv" href="/cv" onClick={jump('/cv')}><Icon name="doc" size={15} />CV</a>
        </nav>
        <button type="button" className="burger" onClick={() => setOpen(true)} aria-label="Open the menu"><Icon name="menu" size={22} /></button>
      </header>
      {open ? createPortal(
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="sheet-top">
            <span className="brand brand-light">{brand}</span>
            <button type="button" className="burger burger-light" onClick={() => setOpen(false)} aria-label="Close the menu"><Icon name="close" size={22} /></button>
          </div>
          <nav aria-label="Menu">
            {all.map((l) => <a key={l.to} className="sheet-item" href={l.to} onClick={jump(l.to)}>{l.label}<Icon name="arrow" size={18} /></a>)}
          </nav>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

export function SiteFooter({ name, location }) {
  return (
    <footer className="footer">
      <div className="wrap footer-in">
        <span>© {new Date().getFullYear()} {name}{location ? ` · ${location}` : ''}</span>
        <span>Designed and built with AI agents, on Cloudflare.</span>
      </div>
    </footer>
  );
}
