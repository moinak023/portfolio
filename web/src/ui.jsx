import React, { useEffect, useRef, useState } from 'react';
import { fileUrl } from './api.js';

/** Small inline icons (stroke only), so the site needs no icon font. */
const PATHS = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  text: 'M4 6h16M4 12h16M4 18h10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',
  people: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.9M15.5 3.2a3.5 3.5 0 0 1 0 6.6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  photo: 'M4 6h16v13H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  mail: 'M3 6h18v13H3zM3 7l9 7 9-7',
  key: 'M7.5 16a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9M12 11.5h9.5M18 11.5v3.5M21.5 11.5v2.5',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  out: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  quote: 'M5 17v-4a5 5 0 0 1 5-5M5 17h4v-4H5M14 17v-4a5 5 0 0 1 5-5M14 17h4v-4h-4',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  chat: 'M4 5h16v11H10l-5 4v-4H4z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7',
  bot: 'M5 9h14v10H5zM12 9V5M12 4.5h.01M9 13.5v1M15 13.5v1M2.5 13v3M21.5 13v3M9.5 17h5',
  chip: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
  plug: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
  shield: 'M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  layers: 'M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5',
  briefcase: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z',
  flow: 'M4 5h6v5H4zM14 14h6v5h-6zM7 10v6.5h7M17 14V7.5h-7',
  database: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 12h.01',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  lab: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9',
  check: 'M5 12.5l4.5 4.5L19 7',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  grad: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  hub: 'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M10.2 10.2L6.5 6.5M13.8 10.2l3.7-3.7M10.2 13.8l-3.7 3.7M13.8 13.8l3.7 3.7M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4M19 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4M5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4M19 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  sync: 'M20 7h-9a6 6 0 0 0-6 6M17 4l3 3-3 3M4 17h9a6 6 0 0 0 6-6M7 20l-3-3 3-3',
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  printer: 'M7 8V3h10v5M5 8h14a2 2 0 0 1 2 2v6h-4M7 16H3v-6a2 2 0 0 1 2-2M7 13h10v8H7z',
  grip: 'M9 5.5v.5M9 11.75v.5M9 18v.5M15 5.5v.5M15 11.75v.5M15 18v.5',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  eyeoff: 'M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.9 3.8M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.9 9.9 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  menu2: 'M4 6h16M4 12h10M4 18h16',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};
export const ICON_NAMES = Object.keys(PATHS);

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'grip' ? 2.8 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] || PATHS.star} />
    </svg>
  );
}

/**
 * Scrolls the page so the section sits just below the sticky header.
 * The position is worked out in code and only this page scrolls (scrollIntoView would also scroll a page that
 * shows the portfolio in a frame). Once the scroll settles, the position is checked again and corrected, in case
 * anything above changed height on the way. A touch, wheel or key press by the visitor stops the correction.
 */
export function scrollToSection(id, smooth = false) {
  let tries = 0;
  const run = () => {
    const el = document.getElementById(id);
    if (!el) { if (tries < 30) { tries += 1; requestAnimationFrame(run); } return; }
    const nav = document.querySelector('.nav');
    const offset = nav ? nav.offsetHeight + (parseFloat(getComputedStyle(nav).top) || 0) : 0;
    const want = () => Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - offset));
    window.scrollTo({ top: want(), behavior: smooth ? 'smooth' : 'auto' });
    let stopped = false;
    const stop = () => { stopped = true; };
    const events = ['touchstart', 'wheel', 'keydown'];
    events.forEach((n) => window.addEventListener(n, stop, { once: true, passive: true }));
    const fix = () => { if (!stopped && Math.abs(window.scrollY - want()) > 2) window.scrollTo({ top: want(), behavior: 'auto' }); };
    if (smooth && 'onscrollend' in window) window.addEventListener('scrollend', fix, { once: true });
    (smooth ? [1500] : [80, 450]).forEach((ms) => setTimeout(fix, ms));
    setTimeout(() => events.forEach((n) => window.removeEventListener(n, stop)), 2000);
  };
  run();
}

/**
 * Marks [data-rise] and similar elements as seen the first time they come into view, which plays their entrance once.
 * On phones this is the only thing that makes them visible, so elements added later (a saved change, a new section)
 * are picked up too, and without IntersectionObserver everything is simply shown.
 */
const REVEAL = '[data-rise]:not([data-seen]),[data-mask]:not([data-seen]),[data-draw]:not([data-seen])';
export function useReveal(dep) {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll(REVEAL).forEach((el) => el.setAttribute('data-seen', ''));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.setAttribute('data-seen', ''); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    const watch = (root) => {
      if (root.matches && root.matches(REVEAL)) io.observe(root);
      if (root.querySelectorAll) root.querySelectorAll(REVEAL).forEach((el) => io.observe(el));
    };
    watch(document);
    const mo = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) watch(n); })));
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [dep]);
}

/** A photograph shown whole, at its own shape (never cropped or enlarged). */
export function Photo({ k, label, className = '' }) {
  if (!k) return null;
  return <div className={`photo photo-natural ${className}`}><img src={fileUrl(k)} alt={label || ''} loading="lazy" decoding="async" /></div>;
}

/** Counts up to a number the first time it scrolls into view. Keeps any text around the number ("16+", "15+"). */
export function CountUp({ value, ms = 1200 }) {
  const m = /^(\D*)(\d+)(.*)$/.exec(String(value || ''));
  const target = m ? Number(m[2]) : 0;
  const ref = useRef(null);
  const [shown, setShown] = useState(target);
  useEffect(() => {
    const el = ref.current;
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!m || !el || reduce || typeof IntersectionObserver === 'undefined') { setShown(target); return undefined; }
    setShown(0);
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / ms);
        setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, ms]);
  if (!m) return <span className="num">{value}</span>;
  return <span ref={ref} className="num">{m[1]}{shown}{m[3]}</span>;
}

/** Splits a headline into words that rise in one after another. */
export function Words({ text, start = 0 }) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  // The space sits outside each word: a space at the end of an inline-block is dropped by the browser.
  return words.map((w, i) => (
    <React.Fragment key={i}><span className="word" style={{ '--i': start + i }}>{w}</span>{i < words.length - 1 ? ' ' : ''}</React.Fragment>
  ));
}

/** An icon in a round golden badge. */
export function Gold({ name, size = 'md' }) {
  const px = size === 'lg' ? 26 : size === 'sm' ? 14 : 17;
  return <span className={`gicon gicon-${size}`} aria-hidden="true"><Icon name={name} size={px} /></span>;
}

/** Small tracked label with a golden icon badge in front of it. */
export function Eyebrow({ icon, light, children, ...rest }) {
  return <p className={`eyebrow ${light ? 'eyebrow-light' : ''}`} {...rest}>{icon ? <Gold name={icon} size="sm" /> : null}<span>{children}</span></p>;
}

export function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`toast ${toast.bad ? 'toast-bad' : ''}`} role="status">{toast.text}</div>;
}

export const initials = (n) => String(n || '').split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

/** Only https links (and mailto/tel) are ever rendered as links. */
export const safeHref = (u) => (typeof u === 'string' && /^(https:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:\+?[0-9 ()-]+)$/i.test(u.trim()) ? u.trim() : '');
