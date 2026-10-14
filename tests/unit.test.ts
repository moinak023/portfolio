// Unit tests for the pure helpers. Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, passwordProblem } from '../src/lib.ts';
import { setupMail } from '../src/email.ts';
import { cleanJson } from '../src/clean.ts';
import { asList, monthYear, period, since } from '../web/src/api.js';
import { fromForm, problem, toForm, SPECS, NAV } from '../web/src/schema.js';
import { content } from '../seed/content.mjs';

test('passwords: a stored hash verifies only the right password', async () => {
  const h = await hashPassword('a long portfolio sentence');
  assert.equal(await verifyPassword('a long portfolio sentence', h), true);
  assert.equal(await verifyPassword('a long portfolio sentencE', h), false);
  for (const bad of ['', 'plain', 'pbkdf2$1$x']) assert.equal(await verifyPassword('x', bad), false);
  assert.match(passwordProblem('short'), /at least 10/);
  assert.match(passwordProblem('moinak023-rocks-hard', 'moinak023@gmail.com'), /email address/);
});

test('the admin code email carries the code and the site name, and nothing else is needed', () => {
  const m = setupMail({ SITE_NAME: 'Moinak Ghosh' } as any, 'moinak023@gmail.com', '123456', 10);
  assert.equal(m.to, 'moinak023@gmail.com');
  assert.match(m.subject, /123456/);
  assert.match(m.html, /123456/);
  assert.match(m.text, /10 minutes/);
});

test('cleanJson trims text, keeps plain values and refuses odd shapes', () => {
  assert.deepEqual(cleanJson({ a: '  hi \r\n there ', n: 3, b: true, l: [' x ', 2], z: null }), { a: 'hi \n there', n: 3, b: true, l: ['x', 2], z: '' });
  assert.equal((cleanJson('y'.repeat(30000)) as string).length, 20000);
  assert.throws(() => cleanJson({ 'bad key': 1 }), /field name/);
  assert.throws(() => cleanJson({ __proto__x: Array.from({ length: 200 }, () => 1) }), /at most/);
  assert.throws(() => cleanJson({ a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } }), /nested/);
  assert.throws(() => cleanJson({ f: () => 1 } as any), /not allowed/);
});

test('every starting section passes the same cleaning the server applies', () => {
  for (const [key, data] of Object.entries(content)) {
    assert.doesNotThrow(() => cleanJson(data), key);
    assert.ok(JSON.stringify(data).length < 300 * 1024, `${key} is under the size limit`);
  }
});

test('dates: month labels, role periods and the live counter', () => {
  assert.equal(monthYear('2016-11'), 'Nov 2016');
  assert.equal(period('2014-07', '2016-10'), 'Jul 2014 – Oct 2016 · 2 yrs 4 mos');
  assert.equal(period('2010-01', '2011-02'), 'Jan 2010 – Feb 2011 · 1 yr 2 mos');
  assert.match(period('2016-11', '', new Date(2026, 9, 14)), /^Nov 2016 – Present · 9 yrs 12 mos$|^Nov 2016 – Present · 10 yrs$/);
  const s = since('2010-01-01', new Date(2026, 9, 14, 16, 30, 5));
  assert.equal(s.years, 16);
  assert.ok([15, 16].includes(s.hours), 'hours of real elapsed time (one hour less across a daylight-saving change)');
  assert.equal(s.minutes, 30);
  assert.equal(s.seconds, 5);
  assert.equal(since('2030-01-01', new Date(2026, 0, 1)), null);
  assert.equal(since('nonsense'), null);
});

test('admin forms: lists become lines or commas and come back the same', () => {
  const fields = SPECS.agentic.lists[0].fields;
  const item = content.agentic.items[0];
  const form = toForm(fields, item);
  assert.equal(typeof form.highlights, 'string');
  assert.equal(form.stack, item.stack.join(', '));
  const back = fromForm(fields, form);
  assert.deepEqual(back.highlights, item.highlights);
  assert.deepEqual(back.stack, item.stack);
  assert.equal(back.featured, true);
  assert.deepEqual(asList('a, b\nc'), ['a', 'b', 'c']);
});

test('admin forms: links must be https and emails must look like emails', () => {
  const f = SPECS.profile.fields.filter((x: any) => x.key);
  assert.match(problem(f, { linkedin: 'http://linkedin.com/in/x' }), /https/);
  assert.match(problem(f, { linkedin: 'javascript:alert(1)' }), /https/);
  assert.equal(problem(f, { linkedin: 'https://www.linkedin.com/in/moinak' }), '');
  assert.match(problem(f, { email: 'not-an-email' }), /valid email/);
});

test('every admin section has an editor, and every list has the fields it shows', () => {
  for (const n of NAV) {
    if (['dashboard', 'account', 'cv'].includes(n.id)) continue;
    assert.ok(SPECS[n.id], `${n.id} has a spec`);
    for (const l of SPECS[n.id].lists || []) {
      assert.ok(l.fields.length > 0 && typeof l.title === 'function', `${n.id}.${l.key}`);
      assert.ok((content as any)[n.id] && Array.isArray((content as any)[n.id][l.key]), `${n.id}.${l.key} has starting content`);
    }
  }
});

test('starting content: no MuleSoft claimed as a skill, no private details published', () => {
  const all = JSON.stringify(content);
  assert.ok(!/mulesoft/i.test(all), 'MuleSoft is not presented as a skill');
  assert.ok(!/23\/12\/1986|1986-12-23|Timbaud|07 52|73849/.test(all), 'no date of birth, home address or phone number');
  assert.equal(content.profile.show_phone, false);
});
