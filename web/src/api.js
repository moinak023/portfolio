import { demoApi } from './demo.js';

/** Preview build (no server): content comes from the starting content. */
// __DEMO__ is set at build time in vite.config.js; it is false in the normal build, so the preview code is left out.
// eslint-disable-next-line no-undef
export const DEMO = typeof __DEMO__ !== 'undefined' && __DEMO__ === true;

/** Small fetch wrapper for the Worker API. Throws an Error with the server's message on failure. */
export async function api(path, opts = {}) {
  if (DEMO) return demoApi(path, opts);
  const init = { method: opts.method || (opts.body || opts.form ? 'POST' : 'GET'), headers: {}, credentials: 'same-origin' };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
  const r = await fetch(path, init);
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  if (!r.ok) {
    const e = new Error((data && data.error) || `Request failed (${r.status})`);
    e.status = r.status;
    // The admin session has ended (inactivity, or signed out in another tab): tell the app to show the sign-in page.
    if (r.status === 401 && path.startsWith('/api/admin/')) {
      window.dispatchEvent(new CustomEvent('portfolio:signed-out', { detail: { message: data && data.reason === 'idle' ? data.error : '' } }));
    }
    throw e;
  }
  return data;
}

export const fileUrl = (key) => (!key ? '' : /^(blob|data):/.test(key) ? key : `/api/files/${key}`);

/** Resize a photograph in the browser before upload (longest edge 2400px, high-quality JPEG). */
export async function shrinkImage(file, maxEdge = 2400, quality = 0.9) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    throw new Error('This browser cannot read that image format. Please choose a JPEG or PNG image.');
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 3 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('The image could not be prepared for upload.');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/** Upload one image (resized first) or one PDF. Returns { key, name, size, type }. */
export async function uploadFile(file, folder) {
  const isPdf = file.type === 'application/pdf';
  const ready = isPdf ? file : await shrinkImage(file);
  const form = new FormData();
  form.append('file', ready);
  form.append('folder', folder);
  return api('/api/admin/upload', { form });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2016-11" → "Nov 2016"; "" → "" */
export function monthYear(ym) {
  const m = /^(\d{4})-(\d{2})/.exec(ym || '');
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(ym || '');
}

/** "Nov 2016 – Present · 9 yrs 11 mos" */
export function period(start, end, nowDate = new Date()) {
  const a = /^(\d{4})-(\d{2})/.exec(start || '');
  const b = /^(\d{4})-(\d{2})/.exec(end || '');
  const label = `${monthYear(start)} – ${end ? monthYear(end) : 'Present'}`;
  if (!a) return label;
  const endY = b ? Number(b[1]) : nowDate.getFullYear();
  const endM = b ? Number(b[2]) : nowDate.getMonth() + 1;
  const months = (endY - Number(a[1])) * 12 + (endM - Number(a[2])) + 1;
  if (months <= 0) return label;
  const y = Math.floor(months / 12);
  const mo = months % 12;
  const len = [y ? `${y} yr${y > 1 ? 's' : ''}` : '', mo ? `${mo} mo${mo > 1 ? 's' : ''}` : ''].filter(Boolean).join(' ');
  return `${label} · ${len}`;
}

/** Time since a date (yyyy-mm-dd), split into years, days, hours, minutes and seconds, for the live counter. */
export function since(iso, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (now < start) return null;
  let years = now.getFullYear() - start.getFullYear();
  let anniversary = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
  if (anniversary > now) { years -= 1; anniversary = new Date(start.getFullYear() + years, start.getMonth(), start.getDate()); }
  let rest = Math.floor((now - anniversary) / 1000);
  const days = Math.floor(rest / 86400); rest -= days * 86400;
  const hours = Math.floor(rest / 3600); rest -= hours * 3600;
  const minutes = Math.floor(rest / 60);
  const seconds = rest - minutes * 60;
  return { years, days, hours, minutes, seconds };
}

/** "a, b, c" or ["a","b"] → ["a","b"] */
export const asList = (v) => (Array.isArray(v) ? v : String(v || '').split(/\n|,/)).map((x) => String(x).trim()).filter(Boolean);
