// The engine running the SolwAI theme: the home page and six app pages, and editing their per-app lists.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadTheme } from '../src/theme.js';

const solwai = await loadTheme({ theme: 'solwai' });
const PAGES = ['/', '/drum', '/this-organiser', '/unseen', '/luggage', '/b-ook', '/gleam'];
let server; let base; let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'solwai-test-'));
  const app = createApp({ themeObject: solwai, dataDir, adminEmail: 'admin@example.com', adminPassword: 'CorrectHorse99', cookieSecure: false });
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

test('every SolwAI page renders without editor markup', async () => {
  for (const p of PAGES) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    const page = await res.text();
    assert.match(page, /\/css\/solwai\.css/);
    assert.match(page, /aria-label="SolwAI"/);
    assert.doesNotMatch(page, /data-k=|data-item=|edit-config/, `${p} leaks editor markup`);
  }
  assert.equal((await fetch(`${base}/nowhere`)).status, 404);
  for (const asset of ['/fonts/C64Keyboard-Regular.otf', '/fonts/red-hat-display-latin-700-normal.woff2', '/img/hero-solway.jpg', '/img/gleam-mark.png', '/js/solwai.js']) {
    assert.equal((await fetch(base + asset)).status, 200, asset);
  }
});

test('the home page carries the handover copy, figures and app cards', async () => {
  const page = await (await fetch(`${base}/`)).text();
  assert.match(page, /Make AI pay its way in your business\./);
  assert.match(page, /data-count="">7,175</);
  assert.match(page, /12% → 35%/);
  assert.match(page, /Apps with AI built in<\/span> · 6/);
  assert.match(page, />Services<\/span> · 2/);
  assert.equal((page.match(/class="card app-card"/g) ?? []).length, 6);
  assert.match(page, /This<span class="wm-hyphen">-<\/span>Organiser/);
  assert.match(page, /href="\/b-ook"/);
});

test('app pages: own accent, current nav link, sections from apps.js', async () => {
  const unseen = await (await fetch(`${base}/unseen`)).text();
  assert.match(unseen, /<body class="page-unseen">/);
  assert.match(unseen, /<a href="\/unseen" aria-current="page">Unseen<\/a>/);
  assert.equal((unseen.match(/class="cut"/g) ?? []).length, 13, '12 features and 1 panel');
  assert.match(unseen, /<code>pg_dump<\/code>/);
  assert.doesNotMatch(unseen, /Read the docs/, 'a button without an address stays hidden');
  assert.match(unseen, /dash-second/);
  const organiser = await (await fetch(`${base}/this-organiser`)).text();
  assert.match(organiser, /class="cut cut-wide"/);
  assert.doesNotMatch(organiser, /cta-text/, 'an empty closing text is left out');
  assert.match(organiser, /<section class="legal"[\s\S]*>Privacy policy<\/a>[\s\S]*>Terms of service<\/a>/);
  assert.doesNotMatch(unseen, /class="legal"/, 'only apps with legal links get the row');
  const drum = await (await fetch(`${base}/drum`)).text();
  assert.match(drum, /class="text-link"[^>]*>See how it works ↓/);
  assert.match(drum, /Why cafés choose Drum/);
});

test('editors can change an app page and its lists in place', async () => {
  const { c, json } = await editor();
  const page = await (await c('/luggage')).text();
  assert.match(page, /data-k="luggage.hero.title"/);
  assert.match(page, /data-coll="luggageFeatures"/);
  const id = /data-item="luggageFeatures" data-id="(\d+)"/.exec(page)[1];
  const res = await json('POST', '/api/save', {
    fields: { 'luggage.hero.title': 'All your drives, one drive' },
    items: { [id]: { title: 'Bulk moves', text: '<p>Move <code>/a</code> anywhere.</p><script>x</script>' } },
  });
  assert.equal(res.status, 200);
  const pub = await (await fetch(`${base}/luggage`)).text();
  assert.match(pub, /All your drives, one drive/);
  assert.match(pub, /Bulk moves/);
  assert.match(pub, /Move <code>\/a<\/code> anywhere\./);
  assert.doesNotMatch(pub, /<script>x/);
  // New figures added to a panel land in that panel.
  const home = await (await c('/')).text();
  assert.match(home, /data-coll="stats" data-coll-label="Figure" data-coll-defaults="\{&quot;region&quot;:&quot;national&quot;\}"/);
});
