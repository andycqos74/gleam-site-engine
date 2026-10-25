// The engine on its own terms: run with the starter theme, which shares no code or content with the QoS theme.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, createSite } from '../src/app.js';
import { loadTheme, prepareTheme } from '../src/theme.js';

const starter = await loadTheme({ theme: 'starter' });
let server; let base; let dataDir;
const VOICE_TOKEN = 'test-voice-token-0123456789abcdef0123456789';

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-test-'));
  const app = createApp({ themeObject: starter, dataDir, adminEmail: 'admin@example.com', adminPassword: 'CorrectHorse99', cookieSecure: false, voiceApiToken: VOICE_TOKEN });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

function client() {
  const jar = {};
  return async (url, opts = {}) => {
    const res = await fetch(base + url, { redirect: 'manual', ...opts, headers: { ...(opts.headers ?? {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
    for (const c of res.headers.getSetCookie()) {
      const [k, v] = c.split(';')[0].split('=');
      if (v) jar[k] = v; else delete jar[k];
    }
    return res;
  };
}
const form = (obj) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(obj).toString() });
async function editor() {
  const c = client();
  await c('/admin/login', form({ email: 'admin@example.com', password: 'CorrectHorse99' }));
  const csrf = /name="_csrf" value="([^"]+)"/.exec(await (await c('/admin')).text())[1];
  await c('/admin/edit-mode', form({ _csrf: csrf, on: '1', next: '/' }));
  const json = (method, url, body) => c(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: body && JSON.stringify(body) });
  return { c, json };
}

test('starter theme pages render with the theme\'s own assets and none of the QoS design', async () => {
  for (const p of ['/', '/about', '/posts', '/contact']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    const page = await res.text();
    assert.match(page, /Riverside Community Hub/);
    assert.match(page, /\/css\/starter\.css/);
    assert.doesNotMatch(page, /QoS|site\.css|data-k=/);
  }
  assert.equal((await fetch(`${base}/css/starter.css`)).status, 200);
  assert.equal((await fetch(`${base}/css/site.css`)).status, 404, 'other themes\' files are not served');
  assert.equal((await fetch(`${base}/programmes`)).status, 404);
  assert.match(await (await fetch(`${base}/_engine/editor.js`)).text(), /edit-config/);
});

test('in-place editing works the same on another theme', async () => {
  const { c, json } = await editor();
  const page = await (await c('/')).text();
  assert.match(page, /data-k="home.hero.title"/);
  assert.match(page, /\/_engine\/editor\.js/);
  const featureId = /data-item="features" data-id="(\d+)"/.exec(page)[1];
  assert.equal((await json('POST', '/api/save', { fields: { 'home.hero.title': 'Hello [neighbours]' }, items: { [featureId]: { title: 'Pottery' } } })).status, 200);
  const pub = await (await fetch(base + '/')).text();
  assert.match(pub, /Hello <span class="pill pill-accent pill-a">neighbours<\/span>/);
  assert.match(pub, /Pottery/);
  assert.equal((await json('POST', '/api/save', { fields: { 'home.programmes.title': 'x' } })).status, 400, 'fields from other themes are unknown here');
  assert.equal((await json('POST', '/api/items', { coll: 'programmes' })).status, 400);
});

test('dated lists: scheduled posts stay hidden and get their own page when published', async () => {
  const { c, json } = await editor();
  const { id } = await (await json('POST', '/api/items', { coll: 'posts', data: { title: 'Summer fair', date: '2099-06-01' } })).json();
  assert.doesNotMatch(await (await fetch(base + '/posts')).text(), /Summer fair/);
  assert.equal((await fetch(`${base}/posts/${id}-summer-fair`)).status, 404);
  assert.match(await (await c('/posts')).text(), /Scheduled: visitors see this from 1 June 2099/);
  await json('PUT', `/api/items/${id}`, { data: { date: '2020-01-01' } });
  const pageRes = await fetch(`${base}/posts/${id}-summer-fair`);
  assert.equal(pageRes.status, 200);
  assert.match(await pageRes.text(), /<meta property="og:type" content="article">/);
  assert.match(await (await fetch(base + '/sitemap.xml')).text(), new RegExp(`/posts/${id}-summer-fair`));
});

test('contact form and admin screens work without any theme styling', async () => {
  const sent = await fetch(base + '/contact', { ...form({ name: 'Jo', email: 'jo@example.com', topic: 'Room hire', message: 'Saturday?' }), redirect: 'manual' });
  assert.equal(sent.headers.get('location'), '/contact?sent=1');
  const { c } = await editor();
  const admin = await (await c('/admin/messages')).text();
  assert.match(admin, /Saturday\?/);
  assert.match(admin, /Room hire/);
  assert.match(admin, /\/_engine\/editor\.css/);
  assert.doesNotMatch(admin, /starter\.css/);
  assert.match(admin, /Riverside Community Hub/, 'admin is branded with the site name');
});

test('phone messages from the voice agent arrive in Admin > Messages', async () => {
  const send = (body, token = VOICE_TOKEN) => fetch(`${base}/api/inbound/voice-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const msg = {
    ref: 'call_123#1', name: 'Mrs X', phone: '+44 7700 900432', topic: 'Price request',
    message: 'Wants a price for a boiler service.', urgency: 'urgent', preferred_time: 'Thursday afternoon',
    needs_review: true, transcript_url: 'https://voice.example.com/calls/call_123',
  };
  assert.equal((await send(msg, null)).status, 401);
  assert.equal((await send(msg, 'wrong-token')).status, 401);
  const bad = await send({ ...msg, ref: 'call_123#2', message: ' ', urgency: 'soon', transcript_url: 'javascript:alert(1)' });
  assert.equal(bad.status, 422);
  assert.deepEqual(Object.keys((await bad.json()).errors).sort(), ['message', 'transcript_url', 'urgency']);

  const first = await send(msg);
  assert.equal(first.status, 201);
  const { id } = await first.json();
  const again = await send(msg);
  assert.equal(again.status, 200, 'a retried delivery is not stored twice');
  assert.deepEqual(await again.json(), { ok: true, id, duplicate: true });
  assert.equal((await send({ ref: 'call_124#1', message: 'Please ring back.' })).status, 201, 'name and number can be withheld');

  await fetch(base + '/contact', form({ name: 'Web Visitor', email: 'web@example.com', topic: 'Room hire', message: 'From the website' }));
  const { c } = await editor();
  const all = await (await c('/admin/messages')).text();
  assert.match(all, /Mrs X/);
  assert.match(all, /href="tel:\+447700900432"/);
  assert.match(all, /Urgent/);
  assert.match(all, /Please check/);
  assert.match(all, /Thursday afternoon/);
  assert.match(all, /href="https:\/\/voice\.example\.com\/calls\/call_123"/);
  assert.match(all, /Unknown caller[\s\S]*Number withheld/);
  assert.match(all, /From the website/);
  assert.match(all, /Re%3A%20your%20message%20to%20Riverside%20Community%20Hub/, 'reply subject uses the site name');
  const phoneOnly = await (await c('/admin/messages?show=phone')).text();
  assert.match(phoneOnly, /Mrs X/);
  assert.doesNotMatch(phoneOnly, /From the website/);
  assert.doesNotMatch(await (await c('/admin/messages?show=form')).text(), /Mrs X/);

  const csrf = /name="_csrf" value="([^"]+)"/.exec(phoneOnly)[1];
  const done = await c(`/admin/messages/${id}`, form({ _csrf: csrf, handled: '1', show: 'phone' }));
  assert.equal(done.headers.get('location'), '/admin/messages?show=phone');
  assert.match(await (await c('/admin/messages?show=phone')).text(), /is-handled[\s\S]*Mrs X/);
});

test('the voice message endpoint is off unless VOICE_API_TOKEN is set', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-novoice-'));
  const app = createApp({ themeObject: starter, dataDir: dir });
  const srv = app.listen(0);
  await new Promise((r) => srv.once('listening', r));
  const res = await fetch(`http://127.0.0.1:${srv.address().port}/api/inbound/voice-message`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer anything' }, body: '{}',
  });
  assert.equal(res.status, 404);
  srv.close(); app.locals.db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('databases from before phone messages get the new columns and keep their messages', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-old-'));
  const Database = (await import('better-sqlite3')).default;
  const old = new Database(path.join(dir, 'site.db'));
  old.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY, at TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
    topic TEXT, message TEXT NOT NULL, emailed INTEGER NOT NULL DEFAULT 0, handled INTEGER NOT NULL DEFAULT 0)`);
  old.prepare("INSERT INTO messages (at, name, email, message) VALUES ('2026-01-01T00:00:00Z', 'Old', 'o@example.com', 'Hi')").run();
  old.close();
  const app = createApp({ themeObject: starter, dataDir: dir });
  const row = app.locals.db.prepare('SELECT * FROM messages').get();
  assert.equal(row.source, 'form');
  assert.equal(row.needs_review, 0);
  assert.equal(row.ref, null);
  app.locals.db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('two sites with different themes and data folders run side by side without sharing anything', async () => {
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'site-a-'));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'site-b-'));
  const a = await createSite({ theme: 'starter', dataDir: dirA });
  const b = await createSite({ theme: 'qos', dataDir: dirB });
  a.locals.store.setField('site.name', 'Site A', null);
  assert.equal(a.locals.store.fields()['site.name'], 'Site A');
  assert.equal(b.locals.store.fields()['site.name'], 'QoS Community Trust');
  assert.equal(a.locals.store.items('programmes').length, 0);
  assert.ok(b.locals.store.items('programmes').length > 0);
  assert.ok(fs.existsSync(path.join(dirA, 'site.db')) && fs.existsSync(path.join(dirB, 'site.db')));
  a.locals.db.close(); b.locals.db.close();
  fs.rmSync(dirA, { recursive: true, force: true }); fs.rmSync(dirB, { recursive: true, force: true });
});

test('broken theme manifests fail at start-up with a clear message', async () => {
  assert.throws(() => prepareTheme({ name: 'x' }, '/tmp/x'), /missing: fields, collections, pages, layout/);
  assert.throws(() => prepareTheme({ name: 'x', fields: {}, collections: { a: {} }, pages: { '/': { key: 'home', render: () => '' } }, layout: () => '' }, '/tmp/x'), /collection "a" needs a label/);
  await assert.rejects(loadTheme({ theme: 'does-not-exist' }), /No theme found/);
  await assert.rejects(loadTheme({ theme: '../etc' }), /not a valid theme name/);
});
