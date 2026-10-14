import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { unzipSync, strFromU8 } from 'fflate';
import { DEMO, api, fileUrl, uploadFile } from './api.js';
import { Icon, Gold, ICON_NAMES, initials } from './ui.jsx';
import { NAV, SPECS, CUSTOM_FIELDS, itemFields, fromForm, problem, toForm } from './schema.js';
import { BUILT_IN, STYLES, TEMPLATES, duplicate, newSection, sectionName, sectionsOf } from './sections.js';
import { SortableList } from './Sortable.jsx';
import { hasCertification, hasRecommendation, hasSkill, kindOf, readExport } from './linkedin.js';

/* ---------- small pieces ---------- */

/** A button that asks for a second click before doing something that removes or replaces content. */
function TwoStep({ onConfirm, children, again = 'Click again to confirm', className = 'a-btn a-btn-danger', disabled, label }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return (
    <button type="button" className={`${className}${armed ? ' a-armed' : ''}`} disabled={disabled} aria-label={label}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? again : children}
    </button>
  );
}

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

// scope keeps ids unique when two forms are open at once (a section form and an edit panel, for example).
function Field({ f, value, onChange, say, scope = 'f' }) {
  const id = `${scope}-${f.key}`;
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
  } else if (f.type === 'select') {
    control = (
      <select id={id} data-field="" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
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
function Drawer({ title, fields, initial, onSave, onDelete, onClose, say, note }) {
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
          {note ? <p className="a-intro"><Icon name="eye" size={16} />{note}</p> : null}
          {fields.map((f) => <Field key={f.key} scope="d" f={f} value={vals[f.key] ?? ''} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} say={say} />)}
        </div>
        <footer>
          {onDelete ? <TwoStep onConfirm={remove} disabled={busy} again="Click again to remove">Remove</TwoStep> : <span />}
          <button type="submit" className="a-btn a-btn-solid" disabled={busy}>{busy ? 'Saving' : 'Save'}</button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}

/* ---------- lists inside a section: drag, edit, add, remove ---------- */

const newId = (prefix) => `${prefix || 'x'}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

function ListPanel({ spec, list, saveList, say }) {
  const [edit, setEdit] = useState(null); // { index } or { index: -1 } for a new entry
  const items = Array.isArray(list) ? list : [];
  const move = async (next, message = 'Order saved.') => { try { await saveList(next, message); } catch (err) { say(err.message, true); } };
  const current = edit ? (edit.index >= 0 ? items[edit.index] : {}) : null;
  return (
    <section className="a-panel" data-list={spec.key}>
      <div className="a-toolbar">
        <h3 className="a-h3">{spec.label} <span className="a-count">{items.length}</span></h3>
        <button type="button" className="a-btn a-btn-solid" onClick={() => setEdit({ index: -1 })}><Icon name="plus" size={15} />Add a {spec.noun}</button>
      </div>
      {spec.hint ? <p className="a-muted a-hint">{spec.hint}</p> : null}
      {items.length === 0 ? <p className="a-muted a-empty-row">Nothing here yet. Add the first {spec.noun}.</p> : null}
      {items.length > 1 ? <p className="a-muted a-drag-tip"><Icon name="grip" size={14} />Drag the handle to change the order.</p> : null}
      <SortableList
        items={items}
        getId={(x) => x.id}
        label={`Drag to move this ${spec.noun}`}
        onReorder={(next) => move(next)}
        renderRow={(x, i, grip) => {
          const badges = (spec.badges ? spec.badges(x) : []).filter(Boolean);
          const icon = spec.icon ? spec.icon(x) : '';
          return (
            <div className="a-row" data-row="">
              {grip}
              <button type="button" className="a-row-main a-row-open" onClick={() => setEdit({ index: i })}>
                {icon ? <Gold name={icon} size="sm" /> : <span className="a-thumb a-thumb-empty" aria-hidden="true">{initials(spec.title(x)) || '?'}</span>}
                <span>
                  <b>{spec.title(x) || 'Untitled'}</b>
                  {spec.sub && spec.sub(x) ? <em>{spec.sub(x)}</em> : null}
                  {badges.length ? <span className="a-badges">{badges.map((bd) => <i key={bd} data-st={bd === 'Hidden' ? 'off' : ''}>{bd}</i>)}</span> : null}
                </span>
              </button>
              <span className="a-row-tools">
                <button type="button" className="a-icon-btn" onClick={() => { const n = items.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; move(n); }} disabled={i === 0} aria-label="Move up" title="Move up"><Icon name="up" size={16} /></button>
                <button type="button" className="a-icon-btn" onClick={() => { const n = items.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; move(n); }} disabled={i === items.length - 1} aria-label="Move down" title="Move down"><Icon name="down" size={16} /></button>
                <button type="button" className="a-icon-btn" onClick={() => setEdit({ index: i })} aria-label="Edit" title="Edit"><Icon name="edit" size={16} /></button>
              </span>
            </div>
          );
        }}
      />
      {edit ? (
        <Drawer
          title={edit.index >= 0 ? (spec.title(current) || `Edit ${spec.noun}`) : `New ${spec.noun}`}
          fields={spec.fields}
          initial={toForm(spec.fields, current)}
          say={say}
          note={spec.drawerNote}
          onClose={() => setEdit(null)}
          onSave={async (vals) => {
            const next = items.slice();
            if (edit.index >= 0) next[edit.index] = { ...items[edit.index], ...vals };
            else next.push({ id: newId(spec.prefix), ...vals });
            await saveList(next, 'Saved. The portfolio shows it now.');
          }}
          onDelete={edit.index >= 0 ? async () => { await saveList(items.filter((_, k) => k !== edit.index), 'Removed. You can bring it back from Earlier versions.'); } : null}
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
          <TwoStep className="a-btn" again="Click again to restore" onConfirm={() => restore(v)}>Restore this version</TwoStep>
        </div>
      )) : null}
    </section>
  );
}

/** Form over one saved section: its own fields with a save bar, then its lists, then its earlier versions. */
function BlockEditor({ blockKey, spec, data, history, onSaved, say, showVersions = true, scope = 'f' }) {
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
                {g.items.map((f) => <Field key={f.key} scope={scope} f={f} value={vals[f.key] ?? ''} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} say={say} />)}
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
      {showVersions ? <Versions blockKey={blockKey} count={history[blockKey]} say={say} onRestored={(d) => onSaved(blockKey, d)} /> : null}
    </div>
  );
}

/* ---------- one section of the page ---------- */

/** Visibility, menu and menu label of a section, saved in the page layout. */
function SectionSettings({ section, saveSection, say }) {
  const [label, setLabel] = useState(section.label || '');
  useEffect(() => { setLabel(section.label || ''); }, [section.id, section.label]);
  const set = async (patch, message) => { try { await saveSection({ ...section, ...patch }, message); } catch (err) { say(err.message, true); } };
  return (
    <section className="a-panel a-settings">
      <h3 className="a-h3">On the page</h3>
      <div className="a-settings-row">
        <label className="a-check" htmlFor="sec-visible"><input id="sec-visible" type="checkbox" checked={section.visible !== false} onChange={(e) => set({ visible: e.target.checked }, e.target.checked ? 'The section is shown on the portfolio.' : 'The section is hidden. Its content is kept.')} /> Show this section</label>
        <label className="a-check" htmlFor="sec-menu"><input id="sec-menu" type="checkbox" checked={!!section.menu} onChange={(e) => set({ menu: e.target.checked, label: label || sectionLabelFallback(section) }, e.target.checked ? 'Added to the top menu.' : 'Removed from the top menu.')} /> Show in the top menu</label>
      </div>
      <form className="a-inline" onSubmit={(e) => { e.preventDefault(); set({ label: label.trim() }, 'Menu name saved.'); }}>
        <label className="a-field" htmlFor="sec-label"><span>Name in the top menu</span><input id="sec-label" data-field="" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="For example Agentic AI" /></label>
        <button type="submit" className="a-btn" disabled={label.trim() === (section.label || '')}>Save name</button>
      </form>
    </section>
  );
}
const sectionLabelFallback = (s) => (s.type === 'custom' ? (s.title || 'Section') : BUILT_IN[s.type].name);

function CustomEditor({ section, saveSection, say, history, onSaved }) {
  const template = TEMPLATES[section.template] || TEMPLATES.cards;
  const fields = CUSTOM_FIELDS(TEMPLATES, STYLES).filter((f) => f.key);
  const spec = { fields: CUSTOM_FIELDS(TEMPLATES, STYLES) };
  const base = useMemo(() => toForm(fields, section), [section]);
  const [vals, setVals] = useState(base);
  const [busy, setBusy] = useState(false);
  const dirty = fields.some((f) => JSON.stringify(vals[f.key]) !== JSON.stringify(base[f.key]));
  useEffect(() => { if (!dirty) setVals(base); }, [base]);
  const groups = [];
  spec.fields.forEach((f) => { if (f.group) groups.push({ title: f.group, items: [] }); else if (groups.length) groups[groups.length - 1].items.push(f); });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await saveSection({ ...section, ...fromForm(fields, vals) }, 'Saved. The portfolio shows the changes now.'); } catch (err) { say(err.message, true); }
    setBusy(false);
  };
  const itemSpec = {
    key: 'items', label: 'Sub-sections', noun: template.noun, prefix: `${section.id}-`,
    title: (x) => x.title || x.label || (x.text ? x.text.slice(0, 60) : ''),
    sub: (x) => (x.title ? x.text : '') || x.label,
    icon: (x) => x.icon,
    fields: itemFields(template),
    hint: `${template.name}: ${template.about}`,
  };
  return (
    <div className="a-stack">
      <form onSubmit={save} className="a-stack">
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
      <ListPanel spec={itemSpec} list={section.items} say={say} saveList={(items, message) => saveSection({ ...section, items }, message)} />
      <Versions blockKey="layout" count={history.layout} say={say} onRestored={(d) => onSaved('layout', d)} />
    </div>
  );
}

function SectionEditor({ section, state, saveSection, onSaved, say, go }) {
  const b = state.blocks;
  const head = <SectionSettings section={section} saveSection={saveSection} say={say} />;
  if (section.type === 'custom') return <div className="a-stack">{head}<CustomEditor section={section} saveSection={saveSection} say={say} history={state.history || {}} onSaved={onSaved} /></div>;
  const spec = SPECS[section.type];
  const blockKey = spec.block || BUILT_IN[section.type].block;
  return (
    <div className="a-stack">
      {head}
      <BlockEditor key={section.id} blockKey={blockKey} spec={spec} data={b[blockKey] || {}} history={state.history || {}} onSaved={onSaved} say={say} />
      {section.type === 'certifications' ? (
        <BlockEditor key="education" scope="ed" blockKey="education" spec={SPECS.education} data={b.education || {}} history={state.history || {}} onSaved={onSaved} say={say} />
      ) : null}
      {section.type === 'counter' ? <button type="button" className="a-btn" onClick={() => go('/admin/profile')}><Icon name="user" size={15} />Edit the opening and profile</button> : null}
    </div>
  );
}

/* ---------- page builder ---------- */

function Preview({ version, focus }) {
  const box = useRef(null);
  const frame = useRef(null);
  const [device, setDevice] = useState('desktop');
  const [size, setSize] = useState({ w: 600, h: 640 });
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const deviceW = device === 'phone' ? 390 : 1280;
  const scale = Math.min(1, size.w / deviceW);
  const onLoad = () => {
    try {
      // Scroll only inside the preview frame (scrollIntoView would also scroll the admin page around it).
      const win = frame.current && frame.current.contentWindow;
      const el = focus && win ? win.document.getElementById(focus) : null;
      if (el) win.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + win.scrollY - 84));
    } catch { /* the preview is on the same site; nothing to do if it is not loaded yet */ }
  };
  return (
    <section className="pb-preview" aria-label="Live preview">
      <div className="pb-preview-bar">
        <span className="a-h3 with-icon"><Icon name="eye" size={16} />Live preview</span>
        <div className="a-seg2" role="group" aria-label="Preview width">
          <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>Desktop</button>
          <button type="button" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}>Phone</button>
        </div>
      </div>
      <div className="pb-preview-box" ref={box}>
        {DEMO ? <p className="a-muted pb-preview-note">The live preview appears here on the real site. In this preview copy, open the portfolio from the menu to see your changes.</p> : (
          <iframe ref={frame} key={`${version}-${device}`} title="Live preview of the portfolio" src={`/?preview=${version}`} onLoad={onLoad} loading="lazy"
            style={{ width: deviceW, height: size.h / scale, transform: `scale(${scale})`, marginLeft: device === 'phone' ? Math.max(0, (size.w - deviceW * scale) / 2) : 0 }} />
        )}
      </div>
    </section>
  );
}

function AddSection({ onAdd, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.documentElement.setAttribute('data-lock', '1');
    return () => { document.removeEventListener('keydown', onKey); document.documentElement.removeAttribute('data-lock'); };
  }, [onClose]);
  return createPortal(
    <div className="a-drawer-back" onClick={onClose}>
      <div className="a-drawer a-add" role="dialog" aria-modal="true" aria-label="Add a section" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><p className="a-eyebrow">Page builder</p><h2>Add a section</h2></div>
          <button type="button" className="a-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </header>
        <div className="a-drawer-body">
          <p className="a-muted">Choose how the new section looks. You can change the template later without losing what you wrote.</p>
          <div className="a-templates">
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <button key={k} type="button" className="a-template" data-template={k} onClick={() => onAdd(k)}>
                <Gold name={t.icon} />
                <span><b>{t.name}</b><small>{t.about}</small></span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PageBuilder({ state, saveLayout, onSaved, nav, say, previewVersion }) {
  const sections = sectionsOf(state.blocks.layout);
  const [adding, setAdding] = useState(false);
  const [focus, setFocus] = useState('');
  const save = async (next, message, focusId) => {
    if (focusId) setFocus(focusId);
    try { await saveLayout(next, message); } catch (err) { say(err.message, true); }
  };
  const add = async (template) => {
    const s = newSection(template);
    const at = sections.length && sections[sections.length - 1].type === 'contact' ? sections.length - 1 : sections.length;
    const next = [...sections.slice(0, at), s, ...sections.slice(at)];
    setAdding(false);
    await save(next, 'Section added. Now fill it in.', s.id);
    nav(s.id);
  };
  return (
    <div className="pb">
      <div className="pb-list a-stack">
        <p className="a-intro"><Icon name="eye" size={16} />Drag sections by the handle to change their order on the page. Use the eye to show or hide a section, and the pencil to edit what it says. The opening always comes first and the footer last.</p>
        <section className="a-panel">
          <div className="a-toolbar">
            <h3 className="a-h3">Page order <span className="a-count">{sections.length}</span></h3>
            <button type="button" className="a-btn a-btn-solid" onClick={() => setAdding(true)} data-add-section=""><Icon name="plus" size={15} />Add a section</button>
          </div>
          <div className="a-row a-row-fixed">
            <span className="a-grip a-grip-off" aria-hidden="true"><Icon name="lock" size={14} /></span>
            <button type="button" className="a-row-main a-row-open" onClick={() => nav('profile')}><Gold name="user" size="sm" /><span><b>Opening</b><em>Your name, headline, introduction and photograph. Always first.</em></span></button>
            <span className="a-row-tools"><button type="button" className="a-icon-btn" onClick={() => nav('profile')} aria-label="Edit the opening" title="Edit"><Icon name="edit" size={16} /></button></span>
          </div>
          <SortableList
            items={sections}
            getId={(s) => s.id}
            label="Drag to move this section"
            onReorder={(next, from, to) => save(next, 'Page order saved.', next[to].id)}
            renderRow={(s, i, grip) => {
              const t = s.type === 'custom' ? TEMPLATES[s.template] || TEMPLATES.cards : BUILT_IN[s.type];
              const hidden = s.visible === false;
              const what = s.type === 'custom' ? `Your section · ${t.name}` : `Built in · ${BUILT_IN[s.type].name}`;
              return (
                <div className={`a-row a-sec${hidden ? ' a-sec-hidden' : ''}`} data-row="" data-section={s.id}>
                  {grip}
                  <button type="button" className="a-row-main a-row-open" onClick={() => { setFocus(s.id); nav(s.id); }}>
                    <Gold name={(s.type === 'custom' && s.icon) || t.icon} size="sm" />
                    <span>
                      <b>{sectionName(s, state.blocks)}</b>
                      <em>{what}{s.menu ? ` · In the menu as "${s.label || sectionLabelFallback(s)}"` : ''}</em>
                      {hidden ? <span className="a-badges"><i data-st="off">Hidden</i></span> : null}
                    </span>
                  </button>
                  <span className="a-row-tools">
                    <button type="button" className="a-icon-btn" data-toggle-visible="" onClick={() => save(sections.map((x) => (x.id === s.id ? { ...x, visible: hidden } : x)), hidden ? 'Shown on the portfolio.' : 'Hidden. Its content is kept.', s.id)} aria-label={hidden ? 'Show this section' : 'Hide this section'} title={hidden ? 'Show' : 'Hide'}><Icon name={hidden ? 'eyeoff' : 'eye'} size={16} /></button>
                    <button type="button" className="a-icon-btn" onClick={() => { setFocus(s.id); nav(s.id); }} aria-label="Edit this section" title="Edit"><Icon name="edit" size={16} /></button>
                    {s.type === 'custom' ? <button type="button" className="a-icon-btn" onClick={() => { const c = duplicate(s); save([...sections.slice(0, i + 1), c, ...sections.slice(i + 1)], 'Section copied.', c.id); }} aria-label="Copy this section" title="Copy"><Icon name="copy" size={16} /></button> : null}
                    {s.type === 'custom' ? <TwoStep className="a-icon-btn a-icon-danger" again="Sure?" label="Delete this section" onConfirm={() => save(sections.filter((x) => x.id !== s.id), 'Section deleted. You can bring it back from Earlier versions.')}><Icon name="trash" size={16} /></TwoStep> : null}
                  </span>
                </div>
              );
            }}
          />
          <div className="a-row a-row-fixed">
            <span className="a-grip a-grip-off" aria-hidden="true"><Icon name="lock" size={14} /></span>
            <span className="a-row-main"><Gold name="text" size="sm" /><span><b>Footer</b><em>Your name and location. Always last.</em></span></span>
          </div>
        </section>
        <Versions blockKey="layout" count={(state.history || {}).layout} say={say} onRestored={(d) => onSaved('layout', d)} />
      </div>
      <Preview version={previewVersion} focus={focus} />
      {adding ? <AddSection onAdd={add} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

/* ---------- import from LinkedIn ---------- */

async function readFiles(fileList) {
  const out = [];
  for (const file of fileList) {
    const buf = new Uint8Array(await file.arrayBuffer());
    if (/\.zip$/i.test(file.name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
      const entries = unzipSync(buf, { filter: (f) => !!kindOf(f.name) });
      Object.entries(entries).forEach(([name, data]) => out.push({ name, text: strFromU8(data) }));
    } else out.push({ name: file.name, text: new TextDecoder('utf-8').decode(buf) });
  }
  return out;
}

function LinkedInImport({ state, onSaved, say, nav }) {
  const b = state.blocks;
  const [found, setFound] = useState(null);
  const [pick, setPick] = useState({ recs: {}, skills: {}, certs: {} });
  const [group, setGroup] = useState('__new');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef(null);
  const recs = (b.recommendations || {}).items || [];
  const groups = (b.skills || {}).groups || [];
  const certs = (b.certifications || {}).items || [];

  const load = async (files) => {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const r = readExport(await readFiles(Array.from(files)));
      if (!r.found.length) throw new Error('No LinkedIn files were found. Upload the ZIP file LinkedIn sends you, or the files Recommendations_Received.csv, Skills.csv and Certifications.csv.');
      setFound(r);
      setPick({
        recs: Object.fromEntries(r.recommendations.map((x, i) => [i, !hasRecommendation(recs, x)])),
        skills: Object.fromEntries(r.skills.map((x, i) => [i, !hasSkill(groups, x.name)])),
        certs: Object.fromEntries(r.certifications.map((x, i) => [i, !hasCertification(certs, x)])),
      });
    } catch (err) { say(err.message, true); }
    setBusy(false);
  };

  const run = async () => {
    setBusy(true);
    const done = [];
    try {
      const newRecs = found.recommendations.filter((x, i) => pick.recs[i] && !hasRecommendation(recs, x)).map((x) => ({ id: newId('r'), ...x }));
      if (newRecs.length) {
        const r = await api('/api/admin/blocks/recommendations', { method: 'PUT', body: { ...b.recommendations, items: [...recs, ...newRecs] } });
        await onSaved('recommendations', r.data);
        done.push(`${newRecs.length} recommendation${newRecs.length > 1 ? 's' : ''}`);
      }
      const newSkills = found.skills.filter((x, i) => pick.skills[i] && !hasSkill(groups, x.name)).map((x) => x.name);
      if (newSkills.length) {
        const next = group === '__new'
          ? [...groups, { id: newId('g'), name: 'From LinkedIn', icon: 'link', items: newSkills }]
          : groups.map((g) => (g.id === group ? { ...g, items: [...(g.items || []), ...newSkills] } : g));
        const r = await api('/api/admin/blocks/skills', { method: 'PUT', body: { ...b.skills, groups: next } });
        await onSaved('skills', r.data);
        done.push(`${newSkills.length} skill${newSkills.length > 1 ? 's' : ''}`);
      }
      const newCerts = found.certifications.filter((x, i) => pick.certs[i] && !hasCertification(certs, x)).map((x) => ({ id: newId('c'), ...x }));
      if (newCerts.length) {
        const r = await api('/api/admin/blocks/certifications', { method: 'PUT', body: { ...b.certifications, items: [...certs, ...newCerts] } });
        await onSaved('certifications', r.data);
        done.push(`${newCerts.length} certification${newCerts.length > 1 ? 's' : ''}`);
      }
      say(done.length ? `Imported ${done.join(', ')}. They are on the portfolio now.` : 'Nothing new to import.');
      setFound(null);
    } catch (err) { say(err.message, true); }
    setBusy(false);
  };

  const toggle = (k, i) => setPick((p) => ({ ...p, [k]: { ...p[k], [i]: !p[k][i] } }));
  const count = (k) => Object.values(pick[k]).filter(Boolean).length;

  return (
    <div className="a-stack">
      <p className="a-intro"><Icon name="eye" size={16} />LinkedIn does not let other websites read your profile, but it gives you a copy of your own data. Upload that copy here and your recommendations, skills and certifications come in, in the portfolio's own style. Nothing is added twice.</p>
      <section className="a-panel">
        <h3 className="a-h3">Get your data from LinkedIn</h3>
        <ol className="a-steps">
          <li>On LinkedIn, on a computer, open <b>Me</b>, then <b>Settings &amp; Privacy</b>, then <b>Data privacy</b>.</li>
          <li>Under <b>How LinkedIn uses your data</b>, choose <b>Get a copy of your data</b>.</li>
          <li>Choose the full archive, so the file has your recommendations, skills and certifications. Then choose <b>Request archive</b>. If you only need new recommendations, you can pick just <b>Recommendations</b>, which is quicker.</li>
          <li>LinkedIn emails you when the file is ready. The full archive can take up to a day. Download the ZIP file.</li>
          <li>Upload the ZIP file below. You can also upload the CSV files one by one.</li>
        </ol>
      </section>
      <section className="a-panel">
        <h3 className="a-h3">Upload the file</h3>
        <div className={`a-drop${over ? ' a-drop-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files); }}>
          <Gold name="upload" size="lg" />
          <p><b>Drop the LinkedIn ZIP file here</b><br /><span className="a-muted">or the CSV files Recommendations_Received, Skills and Certifications</span></p>
          <input ref={input} id="li-file" type="file" accept=".zip,.csv,application/zip,text/csv" multiple hidden onChange={(e) => { load(e.target.files); e.target.value = ''; }} />
          <button type="button" className="a-btn a-btn-solid" onClick={() => input.current && input.current.click()} disabled={busy}>{busy ? 'Reading' : 'Choose the file'}</button>
        </div>
      </section>

      {found ? (
        <>
          <section className="a-panel" data-import="recommendations">
            <div className="a-toolbar"><h3 className="a-h3">Recommendations <span className="a-count">{found.recommendations.length}</span></h3><span className="a-muted">{count('recs')} selected</span></div>
            {found.recommendations.length === 0 ? <p className="a-muted">None found in the file.</p> : null}
            {found.recommendations.map((x, i) => {
              const have = hasRecommendation(recs, x);
              return (
                <label key={i} className={`a-pick${have ? ' a-pick-have' : ''}`}>
                  <input type="checkbox" checked={!!pick.recs[i]} disabled={have} onChange={() => toggle('recs', i)} />
                  <span><b>{x.name}</b>{x.role ? ` · ${x.role}` : ''}{x.date ? ` · ${x.date}` : ''}{have ? <i className="a-tag-have">Already on the portfolio</i> : null}{x.visible ? null : <i className="a-tag-have">Hidden on LinkedIn, imported as hidden</i>}<em>{x.text}</em></span>
                </label>
              );
            })}
          </section>
          <section className="a-panel" data-import="skills">
            <div className="a-toolbar"><h3 className="a-h3">Skills <span className="a-count">{found.skills.length}</span></h3><span className="a-muted">{count('skills')} selected</span></div>
            {found.skills.length ? (
              <label className="a-field" htmlFor="li-group"><span>Put new skills in</span>
                <select id="li-group" data-field="" value={group} onChange={(e) => setGroup(e.target.value)}>
                  <option value="__new">A new group called "From LinkedIn"</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            ) : <p className="a-muted">None found in the file.</p>}
            <div className="a-pick-chips">
              {found.skills.map((x, i) => {
                const have = hasSkill(groups, x.name);
                return <label key={i} className={`a-chip-pick${have ? ' a-pick-have' : ''}`}><input type="checkbox" checked={!!pick.skills[i]} disabled={have} onChange={() => toggle('skills', i)} />{x.name}{x.endorsements ? <i>{x.endorsements}</i> : null}</label>;
              })}
            </div>
          </section>
          <section className="a-panel" data-import="certifications">
            <div className="a-toolbar"><h3 className="a-h3">Certifications <span className="a-count">{found.certifications.length}</span></h3><span className="a-muted">{count('certs')} selected</span></div>
            {found.certifications.length === 0 ? <p className="a-muted">None found in the file.</p> : null}
            {found.certifications.map((x, i) => {
              const have = hasCertification(certs, x);
              return (
                <label key={i} className={`a-pick${have ? ' a-pick-have' : ''}`}>
                  <input type="checkbox" checked={!!pick.certs[i]} disabled={have} onChange={() => toggle('certs', i)} />
                  <span><b>{x.name}</b>{[x.issuer, x.year].filter(Boolean).length ? ` · ${[x.issuer, x.year].filter(Boolean).join(' · ')}` : ''}{have ? <i className="a-tag-have">Already on the portfolio</i> : null}</span>
                </label>
              );
            })}
          </section>
          <div className="a-savebar">
            <span>Found in: {found.found.join(', ')}</span>
            <button type="button" className="a-btn a-btn-solid" onClick={run} disabled={busy || !(count('recs') + count('skills') + count('certs'))} data-import-go="">{busy ? 'Importing' : 'Import the selected items'}</button>
          </div>
        </>
      ) : null}
      <section className="a-panel a-panel-dark">
        <h3 className="a-h3">A new recommendation, one at a time</h3>
        <p>When someone writes you a new recommendation, you can also add it by hand. It appears in the same style as the others.</p>
        <button type="button" className="a-quick" onClick={() => nav('recommendations')}><Icon name="quote" size={16} />Add a recommendation by hand</button>
      </section>
    </div>
  );
}

/* ---------- CV file, password, dashboard ---------- */

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

function todoList(b) {
  const out = [];
  const add = (text, to) => out.push({ text, to });
  const p = b.profile || {};
  if (!p.photo_key) add('Add your professional photograph to the opening.', 'profile');
  if (!p.linkedin) add('Add your LinkedIn profile address, so visitors can open it.', 'profile');
  const recs = ((b.recommendations || {}).items || []).filter((r) => r.visible !== false);
  if (recs.length < 3) add(`Import your LinkedIn recommendations. The portfolio shows ${recs.length} now.`, 'linkedin');
  const noYear = ((b.certifications || {}).items || []).filter((c) => !c.year).length;
  if (noYear) add(`Add the year to ${noYear} certification${noYear > 1 ? 's' : ''}.`, 'certifications');
  const noLink = ((b.agentic || {}).items || []).filter((x) => !x.link && !/next/i.test(x.status || '')).length;
  if (noLink) add(`Add a demo or write-up link to ${noLink} agent project${noLink > 1 ? 's' : ''}, when you have one to share.`, 'agentic');
  if (!(b.cv || {}).file_key) add('Optional: upload your designed CV as a PDF. Until then, the CV page is used.', 'cv');
  return out;
}

function Dashboard({ blocks, nav, go, updatedAt, labelOf }) {
  const n = (k, list = 'items') => (((blocks[k] || {})[list]) || []).length;
  const sections = sectionsOf(blocks.layout);
  const stats = [
    { n: sections.filter((s) => s.visible !== false).length, k: 'Sections on the page', icon: 'layers' },
    { n: n('agentic'), k: 'Agents and AI builds', icon: 'bot' },
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
              <span>{t.text}</span><small>{labelOf(t.to)} →</small>
            </button>
          ))}
        </section>
        <section className="a-panel a-panel-dark">
          <h3 className="a-h3">Quick actions</h3>
          <button type="button" className="a-quick" onClick={() => nav('builder')}><Icon name="layers" size={16} />Arrange the page</button>
          <button type="button" className="a-quick" onClick={() => go('/')}><Icon name="eye" size={16} />View the portfolio</button>
          <button type="button" className="a-quick" onClick={() => nav('agentic')}><Icon name="bot" size={16} />Add or edit an agent project</button>
          <button type="button" className="a-quick" onClick={() => nav('linkedin')}><Icon name="upload" size={16} />Import from LinkedIn</button>
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
  const [previewVersion, setPreviewVersion] = useState(1);
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
    setPreviewVersion((v) => v + 1);
    reloadSite();
  }, [reloadSite]);

  const sections = state ? sectionsOf(state.blocks.layout) : [];
  const saveLayout = useCallback(async (nextSections, message) => {
    const r = await api('/api/admin/blocks/layout', { method: 'PUT', body: { ...(state ? state.blocks.layout : {}), sections: nextSections } });
    await onSaved('layout', r.data);
    if (message) say(message);
  }, [state, onSaved, say]);
  const saveSection = useCallback((updated, message) => saveLayout(sections.map((s) => (s.id === updated.id ? updated : s)), message), [sections, saveLayout]);

  const fixed = NAV.find((n) => n.id === section);
  const current = fixed || sections.find((s) => s.id === section) || NAV[0];
  const nav = (id) => go(id === 'dashboard' ? '/admin' : `/admin/${id}`);
  const iconOf = (s) => (s.type === 'custom' ? (s.icon || (TEMPLATES[s.template] || TEMPLATES.cards).icon) : BUILT_IN[s.type].icon);
  const nameOf = (s) => (state ? sectionName(s, state.blocks) : '');
  const labelOf = (id) => { const f = NAV.find((x) => x.id === id); if (f) return f.label; const s = sections.find((x) => x.id === id); return s ? (s.type === 'custom' ? nameOf(s) : BUILT_IN[s.type].name) : id; };
  const title = fixed ? fixed.label : current.type ? (current.type === 'custom' ? nameOf(current) : BUILT_IN[current.type].name) : 'Dashboard';
  const icon = fixed ? fixed.icon : current.type ? iconOf(current) : 'home';

  let body = <p className="a-muted">Loading.</p>;
  if (state) {
    const b = state.blocks;
    const id = fixed ? fixed.id : current.id;
    if (fixed && id === 'dashboard') body = <Dashboard blocks={b} nav={nav} go={go} updatedAt={state.updatedAt} labelOf={labelOf} />;
    else if (fixed && id === 'builder') body = <PageBuilder state={state} saveLayout={saveLayout} onSaved={onSaved} nav={nav} say={say} previewVersion={previewVersion} />;
    else if (fixed && id === 'account') body = <Account say={say} />;
    else if (fixed && id === 'cv') body = <CvAdmin data={b.cv || {}} onSaved={onSaved} say={say} go={go} />;
    else if (fixed && id === 'linkedin') body = <LinkedInImport state={state} onSaved={onSaved} say={say} nav={nav} />;
    else if (fixed) body = <BlockEditor key={id} blockKey={id} spec={SPECS[id]} data={b[id] || {}} history={state.history || {}} onSaved={onSaved} say={say} />;
    else body = <SectionEditor key={current.id} section={current} state={state} saveSection={saveSection} onSaved={onSaved} say={say} go={go} />;
  }
  const top = NAV.slice(0, 3);
  const bottom = NAV.slice(3);
  const navButton = (n) => (
    <button key={n.id} type="button" data-nav="" aria-current={(fixed ? fixed.id : current.id) === n.id} onClick={() => nav(n.id)}>
      <Icon name={n.icon} size={16} /><span>{n.label}</span>
    </button>
  );

  return (
    <main className={`a-shell${fixed && fixed.id === 'builder' ? ' a-shell-wide' : ''}`}>
      <aside className="a-side" aria-label="Administration navigation">
        <a className="a-brand" href="/" onClick={(e) => { e.preventDefault(); go('/'); }}><b>{me.name}</b><span>PORTFOLIO ADMIN</span></a>
        <div className="a-me">
          <span aria-hidden="true">{initials(me.name)}</span>
          <div><small>OWNER</small><b>{me.name}</b></div>
        </div>
        <nav>
          {top.map(navButton)}
          <p className="a-nav-group">Sections on the page</p>
          {sections.map((s) => (
            <button key={s.id} type="button" data-nav="" data-hidden={s.visible === false ? '' : undefined} aria-current={!fixed && current.id === s.id} onClick={() => nav(s.id)}>
              <Icon name={iconOf(s)} size={16} /><span>{s.type === 'custom' ? nameOf(s) : BUILT_IN[s.type].name}</span>{s.visible === false ? <small>Hidden</small> : null}
            </button>
          ))}
          <p className="a-nav-group">More</p>
          {bottom.map(navButton)}
        </nav>
        <div className="a-side-foot">
          <button type="button" onClick={() => go('/')}>View the portfolio ↗</button>
          <button type="button" onClick={() => signOut('')}>Sign out</button>
        </div>
      </aside>

      <section className="a-main">
        <header className="a-head">
          <div className="a-head-title"><Gold name={icon} /><div><p className="a-eyebrow">{fixed ? 'Administration' : 'Section'}</p><h1>{title}</h1></div></div>
          <span className="a-session"><i aria-hidden="true" />Signed in as {me.name}</span>
          <button type="button" className="a-btn a-head-view" onClick={() => go('/')}><Icon name="eye" size={15} />View site</button>
        </header>
        <div className="a-pad" key={fixed ? fixed.id : current.id}>{body}</div>
      </section>

      <nav className="a-ribbon" aria-label="Administration sections">
        {[...top, ...sections.map((s) => ({ id: s.id, label: s.type === 'custom' ? nameOf(s) : BUILT_IN[s.type].name, icon: iconOf(s) })), ...bottom].map((n) => (
          <button key={n.id} type="button" data-rib="" aria-current={(fixed ? fixed.id : current.id) === n.id} onClick={() => nav(n.id)}>
            <i><Icon name={n.icon} size={17} /></i><span>{n.label}</span>
          </button>
        ))}
        <button type="button" data-rib="" onClick={() => signOut('')}><i><Icon name="out" size={17} /></i><span>Sign out</span></button>
      </nav>
    </main>
  );
}
