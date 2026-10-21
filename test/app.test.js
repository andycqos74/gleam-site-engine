import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { cleanUrl, cleanValue } from '../src/content/store.js';

let server; let base; let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qos-test-'));
  const app = createApp({ dataDir, adminEmail: 'admin@example.com', adminPassword: 'CorrectHorse99', cookieSecure: false });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

// A minimal cookie-keeping client.
function client() {
  const jar = {};
  return async (url, opts = {}) => {
    const res = await fetch(base + url, { redirect: 'manual', ...opts, headers: { ...(opts.headers ?? {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      if (v) jar[k] = v; else delete jar[k];
    }
    return res;
  };
}

const form = (obj) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(obj).toString() });

async function signedIn() {
  const c = client();
  const res = await c('/admin/login', form({ email: 'admin@example.com', password: 'CorrectHorse99' }));
  assert.equal(res.status, 303);
  const page = await (await c('/admin')).text();
  const csrf = /name="_csrf" value="([^"]+)"/.exec(page)[1];
  await c('/admin/edit-mode', form({ _csrf: csrf, on: '1', next: '/' }));
  const json = (method, url, body) => c(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: body && JSON.stringify(body) });
  return { c, csrf, json };
}

test('every public page renders without editor markup', async () => {
  for (const p of ['/', '/about', '/programmes', '/shop', '/gallery', '/contact', '/privacy']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    const html = await res.text();
    assert.match(html, /QoS Community Trust/);
    assert.doesNotMatch(html, /data-k=|data-item=|edit-config/, `${p} leaks editor markup`);
  }
  assert.equal((await fetch(`${base}/nowhere`)).status, 404);
});

test('the homepage shows the handover content', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /<span class="pill pill-gold pill-a">journey<\/span>/);
  assert.match(html, /Pick your starting point/);
  assert.match(html, /Walking Football/);
  // Soft Play and KGV Gym are not featured on the homepage cards
  assert.equal((html.match(/class="prog-card/g) ?? []).length, 8);
});

test('hidden items stay off the public site (the example vacancy starts hidden)', async () => {
  const html = await (await fetch(base + '/about')).text();
  assert.doesNotMatch(html, /Community Football Coach/);
});

test('editing API refuses anonymous users and requests without the CSRF token', async () => {
  const anon = await fetch(`${base}/api/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(anon.status, 401);
  const { c } = await signedIn();
  const noToken = await c('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { 'home.hero.sub': 'x' } }) });
  assert.equal(noToken.status, 403);
});

test('an editor can change text, a list item and a link, and change history can put it back', async () => {
  const { c, json } = await signedIn();
  const editing = await (await c('/')).text();
  assert.match(editing, /data-k="home.hero.sub"/);
  const journeyId = /data-item="journey" data-id="(\d+)"/.exec(editing)[1];

  const res = await json('POST', '/api/save', {
    fields: { 'home.hero.sub': 'New <b>subhead</b>', 'home.hero.cta1.url': 'www.example.org/page' },
    items: { [journeyId]: { stage: 'Tiny Tots', bogus: 'ignored' } },
  });
  assert.equal(res.status, 200);

  const pub = await (await fetch(base + '/')).text();
  assert.match(pub, /New &lt;b&gt;subhead&lt;\/b&gt;/, 'plain text fields are escaped');
  assert.match(pub, /href="https:\/\/www.example.org\/page"/);
  assert.match(pub, /Tiny Tots/);

  const history = await (await c('/admin/history')).text();
  const revId = [...history.matchAll(/\/admin\/history\/(\d+)\/restore/g)].map((m) => Number(m[1])).sort((a, b) => a - b)[0];
  const csrf = /name="_csrf" value="([^"]+)"/.exec(history)[1];
  await c(`/admin/history/${revId}/restore`, form({ _csrf: csrf }));
  const restored = await (await fetch(base + '/')).text();
  assert.match(restored, /bringing football, tennis and community sport/);
});

test('bad links and unknown fields are rejected', async () => {
  const { json } = await signedIn();
  assert.equal((await json('POST', '/api/save', { fields: { 'home.hero.cta1.url': 'javascript:alert(1)' } })).status, 400);
  assert.equal((await json('POST', '/api/save', { fields: { 'not.a.field': 'x' } })).status, 400);
  assert.equal((await json('POST', '/api/save', { fields: { 'home.hero.img1': '/etc/passwd' } })).status, 400);
});

test('list items can be added, moved, hidden and deleted', async () => {
  const { json } = await signedIn();
  const add = await (await json('POST', '/api/items', { coll: 'funders', data: { name: 'Big Lottery' } })).json();
  assert.ok(add.id);
  let html = await (await fetch(base + '/about')).text();
  assert.match(html, /Big Lottery/);

  await json('PUT', `/api/items/${add.id}`, { data: { hidden: true } });
  html = await (await fetch(base + '/about')).text();
  assert.doesNotMatch(html, /Big Lottery/);

  assert.equal((await json('POST', `/api/items/${add.id}/move`, { dir: -1 })).status, 200);
  assert.equal((await json('DELETE', `/api/items/${add.id}`)).status, 200);
  assert.equal((await json('GET', `/api/items/${add.id}`)).status, 404);
});

test('rich text is sanitised', () => {
  const v = cleanValue({ type: 'rich' }, '<p onclick="x()">Hi <script>alert(1)</script><a href="javascript:x">y</a><b>b</b></p>');
  assert.equal(v, '<p>Hi <a>y</a><strong>b</strong></p>');
  assert.equal(cleanUrl('someone@example.com'), 'mailto:someone@example.com');
  assert.equal(cleanUrl('/contact?topic=Parties'), '/contact?topic=Parties');
});

test('photo uploads are resized to WebP and served', async () => {
  const { c, csrf } = await signedIn();
  const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#1f5fbf' } }).png().toBuffer();
  const body = new FormData();
  body.append('file', new Blob([png], { type: 'image/png' }), 'big.png');
  const res = await c('/api/media', { method: 'POST', headers: { 'X-CSRF-Token': csrf }, body });
  const data = await res.json();
  assert.equal(res.status, 200, JSON.stringify(data));
  assert.match(data.url, /^\/media\/[\w-]+-1600\.webp$/);
  assert.equal(data.width, 1600);
  const img = await fetch(base + data.url);
  assert.equal(img.headers.get('content-type'), 'image/webp');

  const bad = new FormData();
  bad.append('file', new Blob(['not an image'], { type: 'image/png' }), 'x.png');
  assert.equal((await c('/api/media', { method: 'POST', headers: { 'X-CSRF-Token': csrf }, body: bad })).status, 400);
});

test('contact form validates, stores the message and shows it to editors', async () => {
  const bad = await fetch(base + '/contact', { ...form({ name: '', email: 'nope', message: '' }), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } });
  assert.equal(bad.status, 422);
  assert.deepEqual(Object.keys((await bad.json()).errors).sort(), ['email', 'message', 'name']);

  const ok = await fetch(base + '/contact', { ...form({ name: 'Pat', email: 'pat@example.com', topic: 'Parties', message: 'Party on 3 May?' }), redirect: 'manual' });
  assert.equal(ok.status, 303);

  const { c } = await signedIn();
  const page = await (await c('/admin/messages')).text();
  assert.match(page, /Party on 3 May\?/);
});

test('admins can add editors, who must choose their own password first', async () => {
  const { c, csrf } = await signedIn();
  const page = await (await c('/admin/users', form({ _csrf: csrf, name: 'Sam Editor', email: 'sam@example.com', role: 'editor' }))).text();
  const temp = /<p class="temp-password"><code>([^<]+)<\/code>/.exec(page)[1];

  const sam = client();
  const login = await sam('/admin/login', form({ email: 'sam@example.com', password: temp }));
  assert.equal(login.headers.get('location'), '/admin/account');
  const blocked = await sam('/admin/history');
  assert.equal(blocked.headers.get('location'), '/admin/account');
  const users = await sam('/admin/users');
  assert.notEqual(users.status, 200);
});
