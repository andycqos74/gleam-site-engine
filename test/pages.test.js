// Static HTML pages (src/static-pages.js): Admin > Pages, uploads, the public page in both layouts, history.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadTheme } from '../src/theme.js';
import { contentHtml, decodeUpload, titleOf } from '../src/static-pages.js';

const starter = await loadTheme({ theme: 'starter' });
let server; let base; let dataDir; let app;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-test-'));
  app = createApp({ themeObject: starter, dataDir, adminEmail: 'admin@example.com', adminPassword: 'CorrectHorse99', cookieSecure: false, baseUrl: 'https://hub.example.org' });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); app.locals.db.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

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
async function signIn() {
  const c = client();
  await c('/admin/login', form({ email: 'admin@example.com', password: 'CorrectHorse99' }));
  const csrf = /name="_csrf" value="([^"]+)"/.exec(await (await c('/admin')).text())[1];
  // The page form is multipart: fields, plus an optional file { name, content, type }.
  const send = (url, fields, file) => {
    const body = new FormData();
    body.append('_csrf', csrf);
    for (const [k, v] of Object.entries(fields)) body.append(k, v);
    if (file) body.append('file', new Blob([file.content], { type: file.type ?? 'text/html' }), file.name);
    return c(url, { method: 'POST', body });
  };
  return { c, csrf, send, post: (url, fields) => c(url, form({ _csrf: csrf, ...fields })) };
}
const idOf = (res) => /\/admin\/pages\/(\d+)/.exec(res.headers.get('location'))[1];

const TERMS = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>Terms &amp; Conditions</title>
<meta name="description" content="The terms for using the hub.">
<style>body { color: red }</style><script>alert(1)</script></head>
<body><main><h1 class="big" style="color:red">Terms &amp; Conditions</h1>
<p onclick="alert(1)">Please read <a href="javascript:alert(1)">these</a> <a href="https://example.org" target="_blank">terms</a>.</p>
<table><tr><th colspan="2">Fees</th></tr></table><script>alert(2)</script></main></body></html>`;

test('uploaded HTML is read in its own encoding and cleaned for the site layout', () => {
  const latin = Buffer.from('<html><head><meta charset="windows-1252"><title>Caf\xe9 terms</title></head><body><p>\x93Quoted\x94</p></body></html>', 'latin1');
  const text = decodeUpload(latin);
  assert.match(text, /Café terms/);
  assert.match(text, /“Quoted”/);
  assert.match(text, /charset="utf-8"/);
  assert.equal(titleOf(TERMS), 'Terms & Conditions');

  const clean = contentHtml(TERMS);
  assert.doesNotMatch(clean, /script|style|onclick|javascript:|<main/i);
  assert.match(clean, /<h1 class="big">Terms &amp; Conditions<\/h1>/);
  assert.match(clean, /<a href="https:\/\/example.org" target="_blank" rel="noopener noreferrer">/);
  assert.match(clean, /<th colspan="2">Fees<\/th>/);
});

test('administrators upload a page; it shows inside the site design at its address', async () => {
  const { c, send } = await signIn();
  const res = await send('/admin/pages', { title: '', slug: '', layout: 'site', published: '1', html: '' }, { name: 'Terms and Conditions.html', content: TERMS });
  assert.equal(res.status, 303);
  const id = idOf(res);

  const edit = await (await c(`/admin/pages/${id}`)).text();
  assert.match(edit, /value="Terms &amp; Conditions"/, 'title from the file');
  assert.match(edit, /value="terms-and-conditions"/, 'address from the file name');
  assert.match(edit, /value="The terms for using the hub\."/, 'description from the file');

  const visitor = await fetch(`${base}/terms-and-conditions`);
  assert.equal(visitor.status, 200);
  const page = await visitor.text();
  assert.match(page, /<title>Terms &amp; Conditions \| /);
  assert.match(page, /<header class="top">/, 'the theme\'s layout');
  assert.match(page, /<section class="block narrow static-page"><div><h1 class="big">/, 'the theme\'s staticPage, with the file\'s own heading (its <main> as a <div>)');
  assert.doesNotMatch(page, /alert\(/);

  // Signed-in administrators get "Edit this page" pointing at the admin, not in-place editing.
  assert.match(await (await c('/terms-and-conditions')).text(), new RegExp(`href="/admin/pages/${id}">Edit this page`));
  assert.match(await (await fetch(`${base}/sitemap.xml`)).text(), /hub\.example\.org\/terms-and-conditions</);
  assert.equal((await fetch(`${base}/terms-and-conditions/`, { redirect: 'manual' })).headers.get('location'), '/terms-and-conditions');
});

test('a page shown as its file keeps its own document, and its scripts are blocked', async () => {
  const { send } = await signIn();
  const res = await send('/admin/pages', { title: 'Cookies', slug: 'legal/cookies', layout: 'standalone', published: '1', html: TERMS });
  assert.equal(res.status, 303);
  const page = await fetch(`${base}/legal/cookies`);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), TERMS);
  assert.match(page.headers.get('content-security-policy'), /script-src 'none'/);
  assert.match(page.headers.get('content-type'), /text\/html; charset=utf-8/);

  // A fragment gets a document around it.
  const frag = await send('/admin/pages', { title: 'Returns <policy>', slug: 'returns', layout: 'standalone', published: '1', html: '<p>Within 30 days.</p>' });
  assert.equal(frag.status, 303);
  const text = await (await fetch(`${base}/returns`)).text();
  assert.match(text, /^<!doctype html>/);
  assert.match(text, /<title>Returns &lt;policy&gt;<\/title>/);
  assert.match(text, /<body>\n<p>Within 30 days\.<\/p>/);
});

test('addresses are checked: format, the site\'s own pages and files, and other pages', async () => {
  const { send } = await signIn();
  for (const [slug, message] of [
    ['About', null], // lower-cased, then clashes
    ['about', /already one of the site&#39;s pages/],
    ['posts/terms', /belong to/],
    ['admin/terms', /used by the site itself/],
    ['css/starter.css', /lower-case letters/],
    ['css', /already a file/],
    ['bad slug!', /lower-case letters/],
    ['terms-and-conditions', /Another page already uses/],
  ]) {
    const res = await send('/admin/pages', { title: 'X', slug, layout: 'site', published: '1', html: '<p>Hello</p>' });
    assert.equal(res.status, 400, slug);
    if (message) assert.match(await res.text(), message, slug);
  }
  const empty = await send('/admin/pages', { title: 'X', slug: 'x', layout: 'site', published: '1', html: '<script>alert(1)</script>' });
  assert.equal(empty.status, 400);
  assert.match(await empty.text(), /no words in this HTML/);
  const notHtml = await send('/admin/pages', { title: 'X', slug: 'x', layout: 'site', published: '1', html: '' }, { name: 'terms.pdf', content: '%PDF', type: 'application/pdf' });
  assert.match(await notHtml.text(), /Choose an \.html file/);
});

test('editors and visitors can\'t manage pages; uploads need the CSRF token', async () => {
  const anon = await fetch(`${base}/admin/pages`, { method: 'POST', body: new FormData(), redirect: 'manual' });
  assert.equal(anon.status, 302);
  assert.match(anon.headers.get('location'), /^\/admin\/login/);

  const { c, post } = await signIn();
  const created = await (await post('/admin/users', { name: 'Ed', email: 'ed@example.com', role: 'editor' })).text();
  const editor = client();
  const password = /class="temp-password"><code>([^<]+)<\/code>/.exec(created)?.[1];
  assert.ok(password);
  await editor('/admin/login', form({ email: 'ed@example.com', password }));
  // Still on a temporary password: sent to choose their own first; then administrators only.
  assert.equal((await editor('/admin/pages', { method: 'POST', body: new FormData() })).status, 403);

  const noToken = new FormData();
  noToken.append('title', 'X'); noToken.append('slug', 'sneaky'); noToken.append('html', '<p>Hi</p>');
  assert.equal((await c('/admin/pages', { method: 'POST', body: noToken })).status, 403);
  assert.equal((await fetch(`${base}/sneaky`)).status, 404);
});

test('unpublished pages are hidden from visitors; edits, deletes and Put back are in the change history', async () => {
  const { c, send, post } = await signIn();
  const id = idOf(await send('/admin/pages', { title: 'Privacy', slug: 'privacy', layout: 'site', published: '1', html: '<p>Version one</p>' }));
  assert.equal((await send(`/admin/pages/${id}`, { title: 'Privacy notice', slug: 'privacy', layout: 'site', html: '<p>Version two</p>' })).status, 303);
  assert.equal((await fetch(`${base}/privacy`)).status, 404, 'unpublished');
  assert.match(await (await c('/privacy')).text(), /Version two/, 'signed-in users still see it');

  // Replacing the HTML with a file; blank fields keep what the page had.
  await send(`/admin/pages/${id}`, { title: '', slug: '', layout: 'site', published: '1', html: '<p>ignored</p>' }, { name: 'new.htm', content: '<p>Version three</p>' });
  const v3 = await (await fetch(`${base}/privacy`)).text();
  assert.match(v3, /Version three/);
  assert.match(v3, /<h1>Privacy notice<\/h1>/, 'the title as a heading when the HTML has none');

  const history = await (await c('/admin/history')).text();
  assert.match(history, /Changed Page &quot;Privacy notice&quot; \(\/privacy\)/);
  const download = await c(`/admin/pages/${id}/download`);
  assert.match(download.headers.get('content-disposition'), /privacy\.html/);
  assert.equal(await download.text(), '<p>Version three</p>');

  assert.equal((await post(`/admin/pages/${id}/delete`, {})).status, 303);
  assert.equal((await fetch(`${base}/privacy`)).status, 404);
  const revs = await (await c('/admin/history')).text();
  const deleted = /Deleted Page &quot;Privacy notice&quot;[\s\S]*?\/admin\/history\/(\d+)\/restore/.exec(revs)[1];
  assert.equal((await post(`/admin/history/${deleted}/restore`, {})).status, 200);
  assert.match(await (await fetch(`${base}/privacy`)).text(), /Version three/, 'put back');
});

test('a deleted page\'s id is never reused, so Put back on its old changes can\'t overwrite a newer page', async () => {
  const { c, send, post } = await signIn();
  const id = idOf(await send('/admin/pages', { title: 'Cookies', slug: 'cookies', layout: 'site', published: '1', html: '<p>Cookies one</p>' }));
  await send(`/admin/pages/${id}`, { title: 'Cookies', slug: 'cookies', layout: 'site', published: '1', html: '<p>Cookies two</p>' });
  assert.equal((await post(`/admin/pages/${id}/delete`, {})).status, 303);
  const newer = idOf(await send('/admin/pages', { title: 'Refunds', slug: 'refunds', layout: 'site', published: '1', html: '<p>Refund policy</p>' }));
  assert.notEqual(newer, id);

  // Putting back the deletion brings the page back under its old id, so its earlier changes still apply to it.
  const revs = await (await c('/admin/history')).text();
  const deleted = /Deleted Page &quot;Cookies&quot;[\s\S]*?\/admin\/history\/(\d+)\/restore/.exec(revs)[1];
  assert.equal((await post(`/admin/history/${deleted}/restore`, {})).status, 200);
  assert.equal((await c(`/admin/pages/${id}`)).status, 200);
  const changed = /Changed Page &quot;Cookies&quot;[\s\S]*?\/admin\/history\/(\d+)\/restore/.exec(await (await c('/admin/history')).text())[1];
  assert.equal((await post(`/admin/history/${changed}/restore`, {})).status, 200);
  assert.match(await (await fetch(`${base}/cookies`)).text(), /Cookies one/);
  assert.match(await (await fetch(`${base}/refunds`)).text(), /Refund policy/, 'the newer page is untouched');
});

test('editors don\'t see or put back changes to static pages', async () => {
  const { c, send, post } = await signIn();
  const id = idOf(await send('/admin/pages', { title: 'Accessibility', slug: 'accessibility', layout: 'site', published: '1', html: '<p>Statement</p>' }));
  assert.equal((await post(`/admin/pages/${id}/delete`, {})).status, 303);
  const rev = /Deleted Page &quot;Accessibility&quot;[\s\S]*?\/admin\/history\/(\d+)\/restore/.exec(await (await c('/admin/history')).text())[1];

  const created = await (await post('/admin/users', { name: 'Pat', email: 'pat@example.com', role: 'editor' })).text();
  const temp = /<code>([A-Za-z0-9]{14})<\/code>/.exec(created)[1];
  const ed = client();
  await ed('/admin/login', form({ email: 'pat@example.com', password: temp }));
  const csrf = /name="_csrf" value="([^"]+)"/.exec(await (await ed('/admin/account')).text())[1];
  await ed('/admin/account', form({ _csrf: csrf, current: temp, password: 'EditorPass123', confirm: 'EditorPass123' }));

  assert.doesNotMatch(await (await ed('/admin/history')).text(), /Accessibility/);
  assert.equal((await ed(`/admin/history/${rev}/restore`, form({ _csrf: csrf }))).status, 403);
  assert.equal((await fetch(`${base}/accessibility`)).status, 404, 'still deleted');
});
