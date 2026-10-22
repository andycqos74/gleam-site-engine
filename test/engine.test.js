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

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-test-'));
  const app = createApp({ themeObject: starter, dataDir, adminEmail: 'admin@example.com', adminPassword: 'CorrectHorse99', cookieSecure: false });
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
