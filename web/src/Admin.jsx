import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, fileUrl, uploadFile } from './api.js';
import { Icon, Gold, ICON_NAMES, initials } from './ui.jsx';
import { NAV, SPECS, fromForm, problem, toForm } from './schema.js';

/* ---------- fields ---------- */

function UploadField({ value, onChange, folder, say, label, pdf }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { const r = await uploadFile(file, folder); onChange(r.key, r); } catch (err) { say(err.message, true); }
    setBusy(false);
  };
  return (
    <div className="a-photo">
      {value && !pdf ? <img src={fileUrl(value)} alt="" /> : <span className="a-photo-empty"><Icon name={pdf ? 'doc' : 'photo'} size={22} /></span>}
      <div className="a-photo-actions">
        <input ref={input} type="file" accept={pdf ? 'application/pdf' : 'image/*'} hidden onChange={pick} aria-label={label} />
        <button type="button" className="a-btn" onClick={() => input.current && input.current.click()} disabled={busy}>{busy ? 'Uploading' : value ? (pdf ? 'Replace the PDF' : 'Replace image') : (pdf ? 'Choose a PDF' : 'Choose an image')}</button>
        {value ? <button type="button" className="a-btn a-btn-danger" onClick={() => onChange('', null)} disabled={busy}>Remove</button> : null}
      </div>
    </div>
  );
}

function Field({ f, value, onChange, say }) {
  const id = `f-${f.key}`;
  let control;
  if (f.type === 'photo') control = <UploadField value={value} onChange={(k) => onChange(k)} folder={f.folder || 'misc'} say={say} label={f.label} />;
  else if (f.type === 'toggle') {
    return (
      <label className="a-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}
      </label>
    );
  } else if (f.type === 'icon') {
    control = (
      <span className="a-icon-pick">
        <Gold name={value || 'star'} />
        <select id={id} data-field="" value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose an icon</option>
          {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </span>
    );
  } else if (f.type === 'long' || f.type === 'lines') {
    control = <textarea id={id} data-field="" rows={f.rows || 3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder || ''} />;
  } else {
    const type = f.type === 'date' ? 'date' : f.type === 'month' ? 'month' : f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : 'text';
    control = <input id={id} data-field="" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder || (f.type === 'month' ? 'YYYY-MM' : '')} list={f.suggest ? `${id}-list` : undefined} />;
  }
  return (
    <label className="a-field" htmlFor={f.type === 'photo' ? undefined : id}>
      <span>{f.label}</span>
      {control}
      {f.suggest ? <datalist id={`${id}-list`}>{f.suggest.map((x) => <option key={x} value={x} />)}</datalist> : null}
      {f.help ? <small>{f.help}</small> : null}
    </label>
  );
}

/** Side panel for adding or editing one entry of a list. */
function Drawer({ title, fields, initial, onSave, onDelete, onClose, say }) {
  const [vals, setVals] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.documentElement.setAttribute('data-lock', '1');
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.documentElement.removeAttribute('data-lock'); document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  const submit = async (e) => {
    e.preventDefault();
    const bad = problem(fields, vals);
    if (bad) { say(bad, true); return; }
    setBusy(true);
    try { await onSave(fromForm(fields, vals)); onClose(); } catch (err) { say(err.message, true); setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Remove this entry? You can bring it back from Earlier versions.')) return;
    setBusy(true);
    try { await onDelete(); onClose(); } catch (err) { say(err.message, true); setBusy(false); }
  };
  return createPortal(
    <div className="a-drawer-back" onClick={onClose}>
      <form className="a-drawer" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <header>
          <div><p className="a-eyebrow">Edit</p><h2>{title}</h2></div>
          <button type="button" className="a-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </header>
        <div className="a-drawer-body a-form">
          {fields.map((f) => <Field key={f.key} f={f} value={vals[f.key] ?? ''} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} say={say} />)}
        </div>
        <footer>
          {onDelete ? <button type="button" className="a-btn a-btn-danger" onClick={remove} disabled={busy}>Remove</button> : <span />}
          <button type="submit" className="a-btn a-btn-solid" disabled={busy}>{busy ? 'Saving' : 'Save'}</button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}

/* ---------- one section of the portfolio ---------- */

const newId = (prefix) => `${prefix || 'x'}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

function ListPanel({ spec, list, saveList, say }) {
  const [edit, setEdit] = useState(null); // { index } or { index: -1 } for a new entry
  const items = Array.isArray(list) ? list : [];
  const move = async (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    try { await saveList(next, 'Order saved.'); } catch (err) { say(err.message, true); }
  };
  const current = edit ? (edit.index >= 0 ? items[edit.index] : {}) : null;
  return (
    <section className="a-panel" data-list={spec.key}>
      <div className="a-toolbar">
        <h3 className="a-h3">{spec.label} <span className="a-count">{items.length}</span></h3>
        <button type="button" className="a-btn a-btn-solid" onClick={() => setEdit({ index: -1 })}><Icon name="plus" size={15} />Add a {spec.noun}</button>
      </div>
      {items.length === 0 ? <p className="a-muted a-empty-row">Nothing here yet. Add the first {spec.noun}.</p> : null}
      {items.map((x, i) => {
        const badges = (spec.badges ? spec.badges(x) : []).filter(Boolean);
        const icon = spec.icon ? spec.icon(x) : '';
        return (
          <div key={x.id || i} className="a-row" data-row="">
            <button type="button" className="a-row-main a-row-open" onClick={() => setEdit({ index: i })}>
              {icon ? <Gold name={icon} size="sm" /> : <span className="a-thumb a-thumb-empty" aria-hidden="true">{initials(spec.title(x)) || '?'}</span>}
              <span>
                <b>{spec.title(x) || 'Untitled'}</b>
                {spec.sub && spec.sub(x) ? <em>{spec.sub(x)}</em> : null}
                {badges.length ? <span className="a-badges">{badges.map((bd) => <i key={bd} data-st={bd === 'Hidden' ? 'off' : ''}>{bd}</i>)}</span> : null}
              </span>
            </button>
            <span className="a-row-tools">
              <button type="button" className="a-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up"><Icon name="up" size={16} /></button>
              <button type="button" className="a-icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down" title="Move down"><Icon name="down" size={16} /></button>
              <button type="button" className="a-icon-btn" onClick={() => setEdit({ index: i })} aria-label="Edit" title="Edit"><Icon name="edit" size={16} /></button>
            </span>
          </div>
        );
      })}
      {edit ? (
        <Drawer
          title={edit.index >= 0 ? (spec.title(current) || `Edit ${spec.noun}`) : `New ${spec.noun}`}
          fields={spec.fields}
          initial={toForm(spec.fields, current)}
          say={say}
          onClose={() => setEdit(null)}
          onSave={async (vals) => {
            const next = items.slice();
            if (edit.index >= 0) next[edit.index] = { ...items[edit.index], ...vals };
            else next.push({ id: newId(spec.prefix), ...vals });
            await saveList(next, 'Saved. The portfolio shows it now.');
          }}
          onDelete={edit.index >= 0 ? async () => { await saveList(items.filter((_, k) => k !== edit.index), 'Removed.'); } : null}
        />
      ) : null}
    </section>
  );
}

function Versions({ blockKey, count, onRestored, say }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const load = async () => {
    try { setRows((await api(`/api/admin/history/${blockKey}`)).versions); } catch (err) { say(err.message, true); }
  };
  const restore = async (v) => {
    if (!window.confirm('Put this earlier version back? What is there now is kept as another version.')) return;
    try { const r = await api(`/api/admin/history/${v.id}/restore`, { method: 'POST' }); await onRestored(r.data); await load(); say('The earlier version is back on the portfolio.'); } catch (err) { say(err.message, true); }
  };
  return (
    <section className="a-panel a-versions">
      <div className="a-toolbar">
        <h3 className="a-h3 with-icon"><Icon name="history" size={16} />Earlier versions <span className="a-count">{count || 0}</span></h3>
        <button type="button" className="a-btn" onClick={() => { setOpen((o) => !o); if (!open) load(); }} disabled={!count}>{open ? 'Hide' : 'Show'}</button>
      </div>
      <p className="a-muted">Every save keeps the version before it, so you can always undo a change. The last 25 are kept.</p>
      {open && rows ? rows.map((v) => (
        <div key={v.id} className="a-row">
          <span>{new Date(v.saved_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <button type="button" className="a-btn" onClick={() => restore(v)}>Restore this version</button>
        </div>
      )) : null}
    </section>
  );
}

function BlockEditor({ blockKey, data, history, onSaved, say }) {
  const spec = SPECS[blockKey];
  const fields = spec.fields.filter((f) => f.key);
  const [vals, setVals] = useState(() => toForm(fields, data));
  const [busy, setBusy] = useState(false);
  const base = useMemo(() => toForm(fields, data), [data]);
  const dirty = fields.some((f) => JSON.stringify(vals[f.key]) !== JSON.stringify(base[f.key]));
  useEffect(() => { if (!dirty) setVals(base); }, [base]);

  const put = async (next, message) => {
    const r = await api(`/api/admin/blocks/${blockKey}`, { method: 'PUT', body: next });
    await onSaved(blockKey, r.data);
    say(message);
  };
  const saveFields = async (e) => {
    e.preventDefault();
    const bad = problem(fields, vals);
    if (bad) { say(bad, true); return; }
    setBusy(true);
    try { await put({ ...data, ...fromForm(fields, vals) }, 'Saved. The portfolio shows the changes now.'); } catch (err) { say(err.message, true); }
    setBusy(false);
  };

  const groups = [];
  spec.fields.forEach((f) => { if (f.group) groups.push({ title: f.group, items: [] }); else if (groups.length) groups[groups.length - 1].items.push(f); });

  return (
    <div className="a-stack">
      {spec.intro ? <p className="a-intro"><Icon name="eye" size={16} />{spec.intro}</p> : null}
      {groups.length ? (
        <form onSubmit={saveFields} className="a-stack">
          {groups.map((g) => (
            <section key={g.title} className="a-panel">
              <h3 className="a-h3">{g.title}</h3>
              <div className="a-form">
                {g.items.map((f) => <Field key={f.key} f={f} value={vals[f.key] ?? ''} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} say={say} />)}
              </div>
            </section>
          ))}
          <div className="a-savebar">
            <span>{dirty ? 'You have changes that are not saved yet.' : 'Everything is saved.'}</span>
            <button type="submit" className="a-btn a-btn-solid" disabled={!dirty || busy}>{busy ? 'Saving' : 'Save changes'}</button>
          </div>
        </form>
      ) : null}
      {(spec.lists || []).map((l) => (
        <ListPanel key={l.key} spec={l} list={data[l.key]} say={say} saveList={(list, message) => put({ ...data, [l.key]: list }, message)} />
      ))}
      <Versions blockKey={blockKey} count={history[blockKey]} say={say} onRestored={(d) => onSaved(blockKey, d)} />
    </div>
  );
}

/* ---------- CV file ---------- */

function CvAdmin({ data, onSaved, say, go }) {
  const save = async (key, meta) => {
    const next = key ? { file_key: key, file_name: (meta && meta.name) || 'CV.pdf', uploaded_at: new Date().toISOString().slice(0, 10) } : { file_key: '', file_name: '', uploaded_at: '' };
    try { const r = await api('/api/admin/blocks/cv', { method: 'PUT', body: next }); await onSaved('cv', r.data); say(key ? 'Your CV is uploaded. The Download CV buttons now give this PDF.' : 'The PDF is removed. The buttons now open the CV page.'); } catch (err) { say(err.message, true); }
  };
  return (
    <div className="a-stack">
      <p className="a-intro"><Icon name="eye" size={16} />The portfolio always has a CV page that is made from your content and can be saved as a PDF. If you also have a designed CV, upload it here and the Download CV buttons will give that PDF instead.</p>
      <section className="a-panel">
        <h3 className="a-h3">Your designed CV (PDF, up to 10 MB)</h3>
        <div className="a-form">
          <UploadField value={data.file_key} pdf folder="cv" say={say} label="CV PDF" onChange={save} />
          {data.file_key ? <p className="a-muted">Current file: <b>{data.file_name}</b>{data.uploaded_at ? `, uploaded ${data.uploaded_at}` : ''}. <a href={fileUrl(data.file_key)} target="_blank" rel="noopener">Open it</a></p> : <p className="a-muted">No PDF uploaded. Visitors get the CV page instead.</p>}
        </div>
      </section>
      <section className="a-panel a-panel-dark">
        <h3 className="a-h3">The CV page</h3>
        <p>It is built from your profile, experience, skills, certifications and education, so it is always up to date.</p>
        <button type="button" className="a-quick" onClick={() => go('/cv')}><Icon name="doc" size={16} />Open the CV page</button>
      </section>
    </div>
  );
}

/* ---------- password ---------- */

function Account({ say }) {
  const [vals, setVals] = useState({ current: '', password: '', password2: '' });
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const set = (k) => (e) => setVals((s) => ({ ...s, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    if (vals.password !== vals.password2) { say('The two new passwords are not the same.', true); return; }
    setBusy(true);
    try {
      await api('/api/auth/change-password', { body: { current: vals.current, password: vals.password } });
      setVals({ current: '', password: '', password2: '' });
      say('Your password is changed. Your other devices have been signed out.');
    } catch (err) { say(err.message, true); }
    setBusy(false);
  };
  const type = show ? 'text' : 'password';
  return (
    <form className="a-stack" onSubmit={save}>
      <section className="a-panel">
        <h3 className="a-h3">Change my password</h3>
        <div className="a-form">
          <label className="a-field" htmlFor="pw-current"><span>Current password</span><input id="pw-current" data-field="" type={type} autoComplete="current-password" required value={vals.current} onChange={set('current')} /></label>
          <label className="a-field" htmlFor="pw-new"><span>New password</span><input id="pw-new" data-field="" type={type} autoComplete="new-password" required value={vals.password} onChange={set('password')} /><small>At least 10 characters. A short sentence is easy to remember and hard to guess.</small></label>
          <label className="a-field" htmlFor="pw-new2"><span>Type the new password again</span><input id="pw-new2" data-field="" type={type} autoComplete="new-password" required value={vals.password2} onChange={set('password2')} /></label>
          <label className="a-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show the passwords</label>
        </div>
      </section>
      <section className="a-panel a-panel-dark">
        <h3 className="a-h3">If you forget your password</h3>
        <p>On the sign-in page, enter your email address and choose "Forgot your password?". The code to set a new password is always emailed to your own address, and nobody else can sign in.</p>
      </section>
      <div className="a-savebar">
        <span>Changing the password signs you out on your other devices.</span>
        <button type="submit" className="a-btn a-btn-solid" disabled={busy || !vals.current || !vals.password || !vals.password2}>{busy ? 'Saving' : 'Change password'}</button>
      </div>
    </form>
  );
}

/* ---------- dashboard ---------- */

function todoList(b) {
  const out = [];
  const add = (text, to) => out.push({ text, to });
  const p = b.profile || {};
  if (!p.photo_key) add('Add your professional photograph to the opening.', 'profile');
  if (!p.linkedin) add('Add your LinkedIn profile address, so visitors can open it.', 'profile');
  const recs = ((b.recommendations || {}).items || []).filter((r) => r.visible !== false);
  if (recs.length < 3) add(`Paste more LinkedIn recommendations. The portfolio shows ${recs.length} now.`, 'recommendations');
  const noYear = ((b.certifications || {}).items || []).filter((c) => !c.year).length;
  if (noYear) add(`Add the year to ${noYear} certification${noYear > 1 ? 's' : ''}.`, 'certifications');
  const noLink = ((b.agentic || {}).items || []).filter((x) => !x.link && !/next/i.test(x.status || '')).length;
  if (noLink) add(`Add a demo or write-up link to ${noLink} agent project${noLink > 1 ? 's' : ''}, when you have one to share.`, 'agentic');
  if (!(b.cv || {}).file_key) add('Optional: upload your designed CV as a PDF. Until then, the CV page is used.', 'cv');
  return out;
}

function Dashboard({ blocks, nav, go, updatedAt }) {
  const n = (k, list = 'items') => (((blocks[k] || {})[list]) || []).length;
  const stats = [
    { n: n('agentic'), k: 'Agents and AI builds', icon: 'bot' },
    { n: n('work'), k: 'Architecture case studies', icon: 'hub' },
    { n: ((blocks.skills || {}).groups || []).reduce((a, g) => a + (g.items || []).length, 0), k: 'Skills listed', icon: 'spark' },
    { n: ((blocks.recommendations || {}).items || []).filter((r) => r.visible !== false).length, k: 'Recommendations shown', icon: 'quote' },
  ];
  const todos = todoList(blocks);
  return (
    <div className="a-stack">
      <div className="a-stats">
        {stats.map((x) => <div key={x.k} data-stat=""><div><b>{x.n}</b><small>{x.k}</small></div><Gold name={x.icon} /></div>)}
      </div>
      <div className="a-split">
        <section className="a-panel">
          <h3 className="a-h3">Worth doing next</h3>
          {todos.length === 0 ? <p className="a-muted">Nothing is missing. The portfolio is complete.</p> : null}
          {todos.map((t, i) => (
            <button key={i} type="button" className="a-row a-row-btn" onClick={() => nav(t.to)}>
              <span>{t.text}</span><small>{NAV.find((x) => x.id === t.to).label} →</small>
            </button>
          ))}
        </section>
        <section className="a-panel a-panel-dark">
          <h3 className="a-h3">Quick actions</h3>
          <button type="button" className="a-quick" onClick={() => go('/')}><Icon name="eye" size={16} />View the portfolio</button>
          <button type="button" className="a-quick" onClick={() => nav('agentic')}><Icon name="bot" size={16} />Add or edit an agent project</button>
          <button type="button" className="a-quick" onClick={() => nav('recommendations')}><Icon name="quote" size={16} />Add a recommendation</button>
          <button type="button" className="a-quick" onClick={() => nav('profile')}><Icon name="user" size={16} />Edit the opening</button>
          <button type="button" className="a-quick" onClick={() => go('/cv')}><Icon name="doc" size={16} />Open the CV page</button>
          <p>Every change you save appears on the portfolio straight away. {updatedAt ? `Last change: ${new Date(updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.` : ''}</p>
        </section>
      </div>
    </div>
  );
}

/* ---------- the console ---------- */

export default function Admin({ me, go, signOut, section, say, reloadSite }) {
  const [state, setState] = useState(null);
  const load = useCallback(async () => {
    try { setState(await api('/api/admin/blocks')); } catch (err) { if (err.status !== 401) say(err.message, true); }
  }, [say]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const el = document.querySelector('.a-ribbon [aria-current="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'center' });
    window.scrollTo(0, 0);
  }, [section]);

  const onSaved = useCallback(async (key, data) => {
    setState((s) => ({ ...s, blocks: { ...s.blocks, [key]: data }, updatedAt: Date.now(), history: { ...s.history, [key]: Math.min(25, ((s.history || {})[key] || 0) + 1) } }));
    reloadSite();
  }, [reloadSite]);

  const current = NAV.find((n) => n.id === section) || NAV[0];
  const nav = (id) => go(id === 'dashboard' ? '/admin' : `/admin/${id}`);

  let body = <p className="a-muted">Loading.</p>;
  if (state) {
    const b = state.blocks;
    if (current.id === 'dashboard') body = <Dashboard blocks={b} nav={nav} go={go} updatedAt={state.updatedAt} />;
    else if (current.id === 'account') body = <Account say={say} />;
    else if (current.id === 'cv') body = <CvAdmin data={b.cv || {}} onSaved={onSaved} say={say} go={go} />;
    else body = <BlockEditor key={current.id} blockKey={current.id} data={b[current.id] || {}} history={state.history || {}} onSaved={onSaved} say={say} />;
  }

  return (
    <main className="a-shell">
      <aside className="a-side" aria-label="Administration navigation">
        <a className="a-brand" href="/" onClick={(e) => { e.preventDefault(); go('/'); }}><b>Moinak Ghosh</b><span>PORTFOLIO ADMIN</span></a>
        <div className="a-me">
          <span aria-hidden="true">{initials(me.name)}</span>
          <div><small>OWNER</small><b>{me.name}</b></div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} type="button" data-nav="" aria-current={n.id === current.id} onClick={() => nav(n.id)}>
              <Icon name={n.icon} size={16} /><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="a-side-foot">
          <button type="button" onClick={() => go('/')}>View the portfolio ↗</button>
          <button type="button" onClick={() => signOut('')}>Sign out</button>
        </div>
      </aside>

      <section className="a-main">
        <header className="a-head">
          <div className="a-head-title"><Gold name={current.icon} /><div><p className="a-eyebrow">Administration</p><h1>{current.label}</h1></div></div>
          <span className="a-session"><i aria-hidden="true" />Signed in as {me.name} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <button type="button" className="a-btn a-head-view" onClick={() => go('/')}><Icon name="eye" size={15} />View site</button>
        </header>
        <div className="a-pad" key={current.id}>{body}</div>
      </section>

      <nav className="a-ribbon" aria-label="Administration sections">
        {NAV.map((n) => (
          <button key={n.id} type="button" data-rib="" aria-current={n.id === current.id} onClick={() => nav(n.id)}>
            <i><Icon name={n.icon} size={17} /></i><span>{n.label}</span>
          </button>
        ))}
        <button type="button" data-rib="" onClick={() => signOut('')}><i><Icon name="out" size={17} /></i><span>Sign out</span></button>
      </nav>
    </main>
  );
}
