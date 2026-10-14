import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api.js';
import { Gold } from './ui.jsx';

const KEY = 'portfolio:lastActivity';
const PING_EVERY = 4 * 60 * 1000; // tell the server we are still here, at most every 4 minutes
const WARN_BEFORE = 60 * 1000; // show the warning one minute before signing out

const readLast = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
const writeLast = (t) => { try { localStorage.setItem(KEY, String(t)); } catch { /* private mode */ } };

/**
 * Signs the person out after `minutes` without activity, with a one-minute warning.
 * Activity in any open tab of the site counts, so two tabs do not sign each other out.
 */
export function IdleGuard({ minutes = 30, onTimeout }) {
  const limit = minutes * 60 * 1000;
  const last = useRef(Date.now());
  const lastPing = useRef(Date.now());
  const warned = useRef(false);
  const [left, setLeft] = useState(null); // seconds left while the warning is shown

  useEffect(() => {
    const start = Date.now();
    last.current = start;
    writeLast(start);
    let lastWrite = start;
    const active = () => {
      if (warned.current) return; // once warned, only the button keeps the session
      const t = Date.now();
      last.current = t;
      if (t - lastWrite > 5000) { writeLast(t); lastWrite = t; }
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, active, { passive: true }));

    const tick = async () => {
      const t = Date.now();
      const seen = Math.max(last.current, readLast());
      const idle = t - seen;
      if (idle >= limit) {
        setLeft(null);
        onTimeout(`For security, you were signed out after ${minutes} minutes without activity. Please sign in again.`);
        return;
      }
      if (idle >= limit - WARN_BEFORE) {
        warned.current = true;
        setLeft(Math.ceil((limit - idle) / 1000));
      } else if (warned.current) {
        warned.current = false; // activity in another tab
        setLeft(null);
      }
      if (!warned.current && seen > lastPing.current && t - lastPing.current > PING_EVERY ) {
        lastPing.current = t;
        try { await api('/api/auth/ping', { method: 'POST' }); } catch { /* a 401 is handled by the app */ }
      }
    };
    const timer = window.setInterval(tick, 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      events.forEach((e) => window.removeEventListener(e, active));
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [limit, minutes, onTimeout]);

  const stay = async () => {
    const t = Date.now();
    last.current = t;
    lastPing.current = t;
    writeLast(t);
    warned.current = false;
    setLeft(null);
    try { await api('/api/auth/ping', { method: 'POST' }); } catch { /* handled by the app */ }
  };

  if (left === null) return null;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return createPortal(
    <div className="idle-back" role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-text">
      <div className="idle-card">
        <Gold name="clock" size="lg" />
        <h2 id="idle-title">Are you still there?</h2>
        <p id="idle-text">For security, you will be signed out of the admin in <b className="idle-count">{mm}:{ss}</b> because there has been no activity for a while. Save your changes first.</p>
        <div className="idle-actions">
          <button type="button" className="btn btn-solid" onClick={stay} autoFocus>Stay signed in</button>
          <button type="button" className="link-btn" onClick={() => onTimeout('')}>Sign out now</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
