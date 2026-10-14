// Cleans the JSON an administrator saves. Kept free of imports so it can be unit tested on its own.

export const MAX_STRING = 20000;
export const MAX_LIST = 120;
export const MAX_KEYS = 80;
export const MAX_DEPTH = 8;

/**
 * Cleans a JSON value an administrator sent: trims strings, caps sizes, keeps only plain values.
 * Throws an Error with a plain message when the shape is not acceptable.
 */
export function cleanJson(v: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) throw new Error('This content is nested too deeply.');
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.replace(/\r\n/g, '\n').trim().slice(0, MAX_STRING);
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) {
    if (v.length > MAX_LIST) throw new Error(`A list can hold at most ${MAX_LIST} entries.`);
    return v.map((x) => cleanJson(x, depth + 1));
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length > MAX_KEYS) throw new Error('This content has too many fields.');
    const out: Record<string, unknown> = {};
    for (const [k, x] of entries) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(k)) throw new Error('This content has a field name that is not allowed.');
      out[k] = cleanJson(x, depth + 1);
    }
    return out;
  }
  throw new Error('This content has a value that is not allowed.');
}
