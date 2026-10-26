// Digital business cards (src/cards.js): admin screens, the public card, Save contact (vCard) and QR codes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadTheme } from '../src/theme.js';
import { cleanCard, foldLine, inkOn, vcard } from '../src/cards.js';

const starter = await loadTheme({ theme: 'starter' });
let server; let base; let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cards-test-'));
  const app = createApp({ themeObject: starter, dataDir, adminEmail: 'admin@example.com', adminPassword: 'CorrectHorse99', cookieSecure: false, baseUrl: 'https://hub.example.org' });
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
async function signIn(email = 'admin@example.com', password = 'CorrectHorse99') {
  const c = client();
  await c('/admin/login', form({ email, password }));
  const csrf = /name="_csrf" value="([^"]+)"/.exec(await (await c('/admin')).text())[1];
  const post = (url, fields) => c(url, form({ _csrf: csrf, ...fields }));
  return { c, csrf, post };
}
async function newCard(post, fields) {
  const res = await post('/admin/cards', { givenName: 'Ali', familyName: 'Smith', title: 'Community Coach', email: 'ali@example.org', ...fields });
  assert.equal(res.status, 303);
  const id = /\/admin\/cards\/(\d+)/.exec(res.headers.get('location'))[1];
  return id;
}
const codeOf = async (c, id) => /\/c\/([a-z2-9]{8})/.exec(await (await c(`/admin/cards/${id}`)).text())[1];

test('vCards are escaped, folded at 75 bytes without splitting characters, and in CRLF lines', () => {
  const card = { data: { ...cleanCard({ givenName: 'Zoë', familyName: 'O\'Neil, Jr', bio: 'Line one\nLine two; more' }).data, links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/zoe' }] } };
  const text = vcard(card, { orgName: 'Hub; North', address: '1 Road\nTown', phone: '01234 567890', website: 'https://hub.example.org' }, { url: 'https://hub.example.org/c/abcdefgh' });
  assert.match(text, /^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
  assert.match(text, /\r\nN:O'Neil\\, Jr;Zoë;;;\r\n/);
  assert.match(text, /\r\nORG:Hub\\; North\r\n/);
  assert.match(text, /\r\nNOTE:Line one\\nLine two\\; more\r\n/);
  assert.match(text, /\r\nADR;TYPE=WORK:;;1 Road\\nTown;;;;\r\n/);
  assert.match(text, /\r\nTEL;TYPE=WORK,VOICE:01234 567890\r\n/, 'the organisation\'s number when the card has none');
  assert.match(text, /item1\.URL:https:\/\/hub\.example\.org\/c\/abcdefgh\r\nitem1\.X-ABLabel:Business card/);
  assert.match(text, /item2\.X-ABLabel:LinkedIn/);
  assert.match(text, /\r\nEND:VCARD\r\n$/);

  const long = `NOTE:${'é'.repeat(100)}`;
  const folded = foldLine(long).split('\r\n');
  assert.ok(folded.length > 1);
  for (const line of folded) assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.equal(folded.map((l, i) => (i ? l.slice(1) : l)).join(''), long, 'unfolding gives back the line');
});

test('card details are checked before saving', () => {
  const { errors } = cleanCard({ email: 'nope', mobile: 'call me', website: 'example.org', linkLabel: ['X'], linkUrl: ['javascript:alert(1)'], photo: '/media/../../etc/passwd.png' });
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'givenName', 'links', 'mobile', 'photo', 'website']);
  const ok = cleanCard({ givenName: 'Ali', linkLabel: ['', ''], linkUrl: ['https://example.org/book', ''] });
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.data.links, [{ label: 'example.org', url: 'https://example.org/book' }]);
  assert.equal(inkOn('#ffffff'), '#14173a');
  assert.equal(inkOn('#1e2252'), '#ffffff');
});

test('administrators make cards; they are not found until cards are turned on', async () => {
  const { c, post } = await signIn();
  assert.match(await (await c('/admin')).text(), /href="\/admin\/cards"/);
  const bad = await post('/admin/cards', { givenName: '', familyName: '', email: 'x' });
  assert.equal(bad.status, 400);
  assert.match(await bad.text(), /Enter the person&#39;s name/);

  const id = await newCard(post, { mobile: '+44 7700 900123', linkLabel: 'LinkedIn', linkUrl: 'https://linkedin.com/in/ali' });
  const code = await codeOf(c, id);
  const edit = await (await c(`/admin/cards/${id}`)).text();
  assert.match(edit, /<svg/, 'the QR code is on the edit screen');
  assert.match(edit, new RegExp(`https://hub\\.example\\.org/c/${code}`));

  assert.equal((await fetch(`${base}/c/${code}`)).status, 404, 'off: visitors get not found');
  assert.equal((await fetch(`${base}/c/${code}.vcf`)).status, 404);
  assert.equal((await c(`/c/${code}`)).status, 200, 'signed-in users can check a card before it goes live');

  assert.equal((await post('/admin/cards/settings', { enabled: '1', accent: '#2e9e5b', address: '1 High Street', phone: '01387 123456' })).status, 303);
  const res = await fetch(`${base}/c/${code}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  const page = await res.text();
  assert.match(page, /Ali Smith/);
  assert.match(page, /Community Coach/);
  assert.match(page, /Riverside Community Hub/);
  assert.match(page, /--bc-accent:#2e9e5b/);
  assert.match(page, new RegExp(`href="/c/${code}\\.vcf"`));
  assert.match(page, /href="tel:\+447700900123"/);
  assert.match(page, /href="https:\/\/linkedin\.com\/in\/ali"/);
  assert.match(page, /noindex/);
  assert.doesNotMatch(page, /starter\.css/, 'the card doesn\'t use the theme\'s layout');

  const v = await fetch(`${base}/c/${code}.vcf`);
  assert.equal(v.headers.get('content-type'), 'text/vcard; charset=utf-8');
  assert.match(v.headers.get('content-disposition'), /attachment; filename="Ali Smith\.vcf"/);
  const text = await v.text();
  assert.match(text, /FN:Ali Smith\r\n/);
  assert.match(text, /TEL;TYPE=CELL,VOICE:\+44 7700 900123/);
  assert.match(text, /ADR;TYPE=WORK:;;1 High Street/);

  const png = await fetch(`${base}/c/${code}/qr.png?download=1`);
  assert.equal(png.headers.get('content-type'), 'image/png');
  assert.match(png.headers.get('content-disposition'), /Ali Smith QR code\.png/);
  assert.match(await (await fetch(`${base}/c/${code}/qr.svg`)).text(), /^<svg/);

  const list = await (await c('/admin/cards')).text();
  assert.match(list, /<td>1<\/td>\s*<td>1<\/td>/, 'one view and one save by a visitor; the admin\'s own visit isn\'t counted');

  assert.equal((await fetch(`${base}/c/zzzzzzzz`)).status, 404);
  assert.equal((await fetch(`${base}/c/short`)).status, 404);
  assert.match(await (await fetch(`${base}/robots.txt`)).text(), /Disallow: \/c\//);
  assert.doesNotMatch(await (await fetch(`${base}/sitemap.xml`)).text(), /\/c\//);
});

test('editing keeps the code; deactivated cards show nothing about the person; history puts changes back', async () => {
  const { c, post } = await signIn();
  await post('/admin/cards/settings', { enabled: '1' });
  const id = await newCard(post, { givenName: 'Jo', familyName: 'Bloggs' });
  const code = await codeOf(c, id);

  assert.equal((await post(`/admin/cards/${id}`, { givenName: 'Jo', familyName: 'Bloggs', title: 'Head Coach' })).status, 303);
  assert.equal(await codeOf(c, id), code, 'the link never changes');
  assert.match(await (await fetch(`${base}/c/${code}`)).text(), /Head Coach/);

  await post(`/admin/cards/${id}/active`, { active: '0' });
  const gone = await fetch(`${base}/c/${code}`);
  assert.equal(gone.status, 410);
  const goneText = await gone.text();
  assert.match(goneText, /no longer in use/);
  assert.doesNotMatch(goneText, /Bloggs|Head Coach/);
  assert.equal((await fetch(`${base}/c/${code}.vcf`)).status, 410);
  assert.equal((await fetch(`${base}/c/${code}/qr.png`)).status, 404);

  const history = await (await c('/admin/history')).text();
  assert.match(history, /Business card &quot;Jo Bloggs&quot;/);
  const revId = /\/admin\/history\/(\d+)\/restore/.exec(history)[1];
  await post(`/admin/history/${revId}/restore`, {});
  assert.equal((await fetch(`${base}/c/${code}`)).status, 200, 'putting back the deactivation');
});

test('deleting a card erases it and its history', async () => {
  const { c, post } = await signIn();
  await post('/admin/cards/settings', { enabled: '1' });
  const id = await newCard(post, { givenName: 'Sam', familyName: 'Erased' });
  const code = await codeOf(c, id);
  assert.equal((await post(`/admin/cards/${id}/delete`, {})).status, 303);
  assert.equal((await fetch(`${base}/c/${code}`)).status, 404);
  assert.doesNotMatch(await (await c('/admin/history')).text(), /Erased/);
  assert.equal((await c(`/admin/cards/${id}`)).status, 404);
});

test('only administrators can manage cards, and posts need the CSRF token', async () => {
  const { c, post } = await signIn();
  const created = await (await post('/admin/users', { name: 'Ed', email: 'ed@example.com', role: 'editor' })).text();
  const temp = /<code>([A-Za-z0-9]{14})<\/code>/.exec(created)[1];
  const ed = client();
  await ed('/admin/login', form({ email: 'ed@example.com', password: temp }));
  const csrf = /name="_csrf" value="([^"]+)"/.exec(await (await ed('/admin/account')).text())[1];
  await ed('/admin/account', form({ _csrf: csrf, current: temp, password: 'EditorPass123', confirm: 'EditorPass123' }));
  assert.equal((await ed('/admin/cards')).status, 403);
  assert.equal((await ed('/admin/cards', form({ _csrf: csrf, givenName: 'X' }))).status, 403);
  assert.doesNotMatch(await (await ed('/admin')).text(), /href="\/admin\/cards"/);

  assert.equal((await c('/admin/cards', form({ givenName: 'No token' }))).status, 403);
});
