// Unit tests for the pure helpers. Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, passwordProblem, redirectTarget } from '../src/lib.ts';
import { setupMail } from '../src/email.ts';
import { cleanJson } from '../src/clean.ts';
import { asList, monthYear, period, since } from '../web/src/api.js';
import { fromForm, problem, toForm, SPECS, NAV, CUSTOM_FIELDS, itemFields } from '../web/src/schema.js';
import { BUILT_IN, DEFAULT_SECTIONS, STYLES, TEMPLATES, duplicate, menuLinks, newSection, sectionName, sectionsOf } from '../web/src/sections.js';
import { parseCsv, readExport, monthYearOf, hasRecommendation, hasSkill } from '../web/src/linkedin.js';
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
  assert.throws(() => cleanJson({ a: { b: { c: { d: { e: { f: { g: { h: { i: 1 } } } } } } } } }), /nested/);
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
  const ids = [...NAV.map((n: any) => n.id), ...Object.keys(BUILT_IN)];
  assert.equal(new Set(ids).size, ids.length, 'page names and section names never clash');
  const editors: [string, string][] = [
    ...NAV.filter((n: any) => !['dashboard', 'builder', 'linkedin', 'account', 'cv'].includes(n.id)).map((n: any) => [n.id, n.id] as [string, string]),
    ...Object.entries(BUILT_IN).map(([type, b]: [string, any]) => [type, (SPECS[type] && SPECS[type].block) || b.block] as [string, string]),
  ];
  for (const [id, block] of editors) {
    assert.ok(SPECS[id], `${id} has an editor`);
    for (const l of SPECS[id].lists || []) {
      assert.ok(l.fields.length > 0 && typeof l.title === 'function', `${id}.${l.key}`);
      assert.ok((content as any)[block] && Array.isArray((content as any)[block][l.key]), `${id}.${l.key} has starting content`);
    }
  }
});

test('page builder: the saved order is used, missing built-in sections come back hidden, the menu follows the page', () => {
  assert.deepEqual(sectionsOf(undefined).map((s: any) => s.id), DEFAULT_SECTIONS.map((s) => s.id));
  assert.deepEqual(sectionsOf(content.layout).map((s: any) => s.id), DEFAULT_SECTIONS.map((s) => s.id));
  const custom = newSection('timeline');
  const mine = sectionsOf({ sections: [{ id: 'contact', type: 'contact', visible: true, menu: true, label: 'Talk' }, { ...custom, menu: true, label: 'Story' }, { id: 'x', type: 'unknown' }] });
  assert.equal(mine[0].id, 'contact');
  assert.equal(mine[1].id, custom.id);
  assert.ok(!mine.some((s: any) => s.id === 'x'), 'unknown kinds are ignored');
  assert.equal(mine.length, 2 + Object.keys(BUILT_IN).length - 1);
  assert.ok(mine.slice(2).every((s: any) => s.visible === false), 'built-in sections missing from the layout are hidden, not lost');
  assert.deepEqual(menuLinks({ sections: mine }), [{ to: '/#contact', label: 'Talk' }, { to: `/#${custom.id}`, label: 'Story' }]);
  assert.equal(menuLinks({ sections: [{ ...mine[0], visible: false }] }).length, 0, 'a hidden section is never in the menu');
});

test('page builder: new and copied sections are complete, valid and use their own ids', () => {
  for (const t of Object.keys(TEMPLATES)) {
    const s = newSection(t);
    assert.equal(s.template, t);
    assert.match(s.id, /^c-[a-z0-9]+$/);
    assert.ok(s.items.length >= 1 && s.items.every((x: any) => x.id.startsWith(`${s.id}-`)), `${t} has starter sub-sections`);
    assert.doesNotThrow(() => cleanJson({ sections: [s] }), `${t} passes the server's cleaning`);
    assert.ok(itemFields(TEMPLATES[t]).length > 0, `${t} has sub-section fields`);
  }
  const s = newSection('cards');
  const c = duplicate(s);
  assert.notEqual(c.id, s.id);
  assert.ok(c.items.every((x: any, i: number) => x.id !== s.items[i].id && x.title === s.items[i].title));
  assert.equal(sectionName(c), `${s.title} (copy)`);
  assert.equal(sectionName({ type: 'skills' }, content), content.skills.title);
  const fields = CUSTOM_FIELDS(TEMPLATES, STYLES).filter((f: any) => f.key);
  assert.ok(['template', 'style', 'title', 'intro'].every((k) => fields.some((f: any) => f.key === k)));
  assert.match(problem(itemFields(TEMPLATES.cta), { title: 'Mail', link: 'javascript:alert(1)' }), /https|mailto/);
  assert.equal(problem(itemFields(TEMPLATES.cta), { title: 'Mail', link: 'mailto:me@example.com' }), '');
});

test('LinkedIn export: recommendations, skills with endorsements and certifications are read in the portfolio format', () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""e"""\r\n1,"multi\nline",3\n'), [['a', 'b, c', 'd "e"'], ['1', 'multi\nline', '3']]);
  assert.equal(monthYearOf('11/16/13, 6:00 PM'), 'November 2013');
  assert.equal(monthYearOf('2024-03-02'), 'March 2024');
  const r = readExport([
    { name: 'Basic_LinkedInDataExport/Recommendations_Received.csv', text: '﻿First Name,Last Name,Company,Job Title,Text,Creation Date,Status\nAsha,Rao,Acme,CTO,"Moinak is &quot;great&quot;.\nTruly.",09/01/24,VISIBLE\nOld,Note,Beta,PM,Hidden one,01/02/20,HIDDEN\n' },
    { name: 'Skills.csv', text: 'Name\nSalesforce\nAgentic AI\nSalesforce\n' },
    { name: 'Endorsement_Received_Info.csv', text: 'Endorsement Date,Skill Name,Endorser First Name\n2024/01/01,Agentic AI,A\n2024/01/02,Agentic AI,B\n' },
    { name: 'Certifications.csv', text: 'Name,Url,Authority,Started On,Finished On,License Number\nTOGAF 9,http://x.example,The Open Group,Mar 2019,,\n' },
    { name: 'Connections.csv', text: 'First Name,Last Name\nNot,Imported\n' },
  ]);
  assert.deepEqual(r.found, ['Recommendations_Received.csv', 'Skills.csv', 'Endorsement_Received_Info.csv', 'Certifications.csv']);
  assert.equal(r.recommendations.length, 2);
  assert.deepEqual(r.recommendations[0], { name: 'Asha Rao', role: 'CTO, Acme', relation: '', date: 'September 2024', text: 'Moinak is "great".\nTruly.', visible: true });
  assert.equal(r.recommendations[1].visible, false, 'a recommendation hidden on LinkedIn comes in hidden');
  assert.deepEqual(r.skills, [{ name: 'Agentic AI', endorsements: 2 }, { name: 'Salesforce', endorsements: 0 }]);
  assert.deepEqual(r.certifications, [{ name: 'TOGAF 9', issuer: 'The Open Group', year: '2019', link: '', icon: 'award' }]);
  assert.ok(hasRecommendation([{ name: 'asha rao', text: 'Moinak is "great". Truly.' }], r.recommendations[0]), 'the same recommendation is not added twice');
  assert.ok(hasSkill([{ items: ['agentic ai'] }], 'Agentic AI'));
});

test('starting content: no MuleSoft claimed as a skill, no private details published', () => {
  const all = JSON.stringify(content);
  assert.ok(!/mulesoft/i.test(all), 'MuleSoft is not presented as a skill');
  assert.ok(!/23\/12\/1986|1986-12-23|Timbaud|07 52|73849/.test(all), 'no date of birth, home address or phone number');
  assert.equal(content.profile.show_phone, false);
});

test('addresses: the main domain and www move to profile.moinakghosh.com, keeping the path; other addresses stay', () => {
  const host = 'profile.moinakghosh.com';
  for (const from of ['https://moinakghosh.com/cv?x=1', 'https://www.moinakghosh.com/cv?x=1', 'http://www.profile.moinakghosh.com/cv?x=1']) {
    assert.equal(redirectTarget(from, host), 'https://profile.moinakghosh.com/cv?x=1', from);
  }
  assert.equal(redirectTarget('https://profile.moinakghosh.com/admin', host), '', 'the site itself is served');
  assert.equal(redirectTarget('https://family.moinakghosh.com/', host), '', 'other sites on the domain are never redirected here');
  assert.equal(redirectTarget('http://127.0.0.1:8787/api/health', host), '', 'local testing is served');
  assert.equal(redirectTarget('https://portfolio.recap-ai.workers.dev/', host), '', 'the workers.dev address is served');
  assert.equal(redirectTarget('https://www.example.test/a', ''), 'https://example.test/a', 'without SITE_HOST, www is still dropped');
});
