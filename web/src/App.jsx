import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, DEMO } from './api.js';
import { Toast } from './ui.jsx';
import Site from './Site.jsx';
import Cv from './Cv.jsx';
import Login from './Login.jsx';
import Admin from './Admin.jsx';
import { IdleGuard } from './idle.jsx';

// In the preview build the page has no server routes, so the current page is kept in memory.
let demoPath = '/';
const pathNow = () => (DEMO ? demoPath : window.location.pathname.replace(/\/+$/, '') || '/');
const pushPath = (p) => { if (DEMO) demoPath = p.split('#')[0]; else window.history.pushState({}, '', p); };

export default function App() {
  const [path, setPath] = useState(pathNow());
  const [site, setSite] = useState(null); // public content
  const [error, setError] = useState('');
  const [me, setMe] = useState(undefined); // undefined while checking, null when signed out
  const [idleMinutes, setIdleMinutes] = useState(30);
  const [toast, setToast] = useState(null);
  const [notice, setNotice] = useState('');
  const isAdminPath = path.startsWith('/admin');
  const meRef = useRef(me);
  meRef.current = me;

  const loadSite = useCallback(async () => {
    try { setSite(await api('/api/site')); setError(''); } catch (e) { setError(e.message); }
  }, []);
  const loadMe = useCallback(async () => {
    try { const r = await api('/api/auth/me'); setMe(r.me); setIdleMinutes(r.idleMinutes || 30); } catch { setMe(null); }
  }, []);

  useEffect(() => { loadSite(); loadMe(); }, [loadSite, loadMe]);

  useEffect(() => {
    const onPop = () => setPath(pathNow());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((to) => {
    const [p, hash] = to.split('#');
    const target = p || '/';
    const apply = () => {
      if (target !== pathNow()) { pushPath(target + (hash ? `#${hash}` : '')); setPath(target); }
      else if (hash && !DEMO) window.history.replaceState({}, '', `${target}#${hash}`);
      requestAnimationFrame(() => {
        const el = hash ? document.getElementById(hash) : null;
        if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
      });
    };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduce && target !== pathNow()) document.startViewTransition(apply); else apply();
  }, []);

  const say = useCallback((text, bad = false) => {
    setToast({ text, bad });
    window.clearTimeout(say.t);
    say.t = window.setTimeout(() => setToast(null), 3800);
  }, []);

  const signOut = useCallback(async (message) => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* cleared either way */ }
    try { localStorage.setItem('portfolio:signedOutAt', String(Date.now())); } catch { /* private mode */ }
    setNotice(typeof message === 'string' ? message : '');
    setMe(null);
  }, []);

  useEffect(() => {
    const onSignedOut = (e) => {
      const msg = (e.detail && e.detail.message) || '';
      if (meRef.current) setNotice(msg || 'Your session has ended. Please sign in again.');
      setMe(null);
    };
    const onStorage = (e) => { if (e.key === 'portfolio:signedOutAt') setMe(null); };
    window.addEventListener('portfolio:signed-out', onSignedOut);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('portfolio:signed-out', onSignedOut); window.removeEventListener('storage', onStorage); };
  }, []);

  if (isAdminPath) {
    if (me === undefined) return <div className="boot" aria-busy="true"><span>Admin</span></div>;
    if (!me) return <Login onDone={async () => { setNotice(''); await loadMe(); }} notice={notice} go={go} />;
    return (
      <>
        <Admin me={me} go={go} say={say} signOut={signOut} section={path.split('/')[2] || 'dashboard'} reloadSite={loadSite} />
        <Toast toast={toast} />
        <IdleGuard minutes={idleMinutes} onTimeout={signOut} />
      </>
    );
  }

  if (!site) {
    return error
      ? <div className="boot"><span>{error}</span><button className="btn btn-ghost" type="button" onClick={loadSite}>Try again</button></div>
      : <div className="boot" aria-busy="true"><span>Moinak Ghosh</span></div>;
  }
  const page = path === '/cv' ? <Cv site={site} go={go} /> : <Site site={site} go={go} isAdmin={!!me} />;
  return <>{page}<Toast toast={toast} /></>;
}
