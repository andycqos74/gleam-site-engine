// Visitor statistics from Umami: the tracking script on public pages and Admin > Visitors, against a stand-in Umami
// server that answers like Umami 3 does.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadTheme } from '../src/theme.js';
import { createAnalytics, period } from '../src/analytics.js';

const starter = await loadTheme({ theme: 'starter' });
const WEBSITE = '8fdf1138-b991-413a-954f-8479592d1c47';

// Stand-in Umami: POST /api/auth/login, then GET /api/websites/<id>/{stats,pageviews,metrics,active} with the token.
const umami = { requests: [], tokens: new Set(['token-1']), logins: 0, down: false };
const umamiServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  umami.requests.push(`${req.method} ${url.pathname}${url.searchParams.get('type') ? `?type=${url.searchParams.get('type')}` : ''}`);
  const json = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  if (umami.down) return json(503, { error: 'down' });
  if (url.pathname === '/api/auth/login') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      const { username, password } = JSON.parse(body);
      if (username !== 'gleam' || password !== 'viewer-pass') return json(401, { error: 'incorrect-username-password' });
      umami.logins++;
      const token = `token-${umami.logins}`;
      umami.tokens.add(token);
      json(200, { token, user: { username } });
    });
  }
  if (!umami.tokens.has(req.headers.authorization?.replace('Bearer ', ''))) return json(401, { error: 'unauthorized' });
  const prefix = `/api/websites/${WEBSITE}/`;
  if (!url.pathname.startsWith(prefix)) return json(401, { error: 'unauthorized' });
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  switch (url.pathname.slice(prefix.length)) {
    case 'stats': return json(200, { pageviews: 1234, visitors: 456, visits: 500, bounces: 200, totaltime: 45000, comparison: { pageviews: 1000, visitors: 400, visits: 450, bounces: 225, totaltime: 27000 } });
    case 'pageviews': return json(200, { pageviews: [{ x: `${day}T00:00:00Z`, y: 34 }], sessions: [{ x: `${day}T00:00:00Z`, y: 12 }] });
    case 'metrics': {
      const lists = {
        path: [{ x: '/', y: 300 }, { x: '/about', y: 120 }],
        referrer: [{ x: 'google.com', y: 90 }, { x: '', y: 40 }],
        country: [{ x: 'GB', y: 400 }, { x: 'IE', y: 20 }],
        device: [{ x: 'mobile', y: 280 }, { x: 'desktop', y: 170 }],
        browser: [{ x: 'ios', y: 200 }, { x: 'chrome', y: 150 }],
      };
      return lists[url.searchParams.get('type')] ? json(200, lists[url.searchParams.get('type')]) : json(400, { error: 'bad-request' });
    }
    case 'active': return json(200, { visitors: 3 });
    default: return json(404, { error: 'not-found' });
  }
});

let umamiUrl;
const sites = [];
async function site(env = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-test-'));
  const app = createApp({ themeObject: starter, dataDir, adminEmail: 'admin@example.com', adminPassword: 'CorrectHorse99', cookieSecure: false, baseUrl: 'https://riverside.example.org', ...env });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  sites.push({ server, dataDir });
  return `http://127.0.0.1:${server.address().port}`;
}
const umamiConfig = (extra = {}) => ({ umami: { url: umamiUrl, websiteId: WEBSITE, username: 'gleam', password: 'viewer-pass', scriptName: 'script.js', ...extra } });

before(async () => {
  umamiServer.listen(0);
  await new Promise((r) => umamiServer.once('listening', r));
  umamiUrl = `http://127.0.0.1:${umamiServer.address().port}`;
});
after(() => {
  umamiServer.close();
  for (const s of sites) { s.server.close(); fs.rmSync(s.dataDir, { recursive: true, force: true }); }
});

async function signIn(base) {
  const jar = {};
  const c = async (url, opts = {}) => {
    const res = await fetch(base + url, { redirect: 'manual', ...opts, headers: { ...(opts.headers ?? {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
    for (const ck of res.headers.getSetCookie()) {
      const [k, v] = ck.split(';')[0].split('=');
      if (v) jar[k] = v; else delete jar[k];
    }
    return res;
  };
  await c('/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'admin@example.com', password: 'CorrectHorse99' }).toString() });
  return c;
}

test('without Umami settings, pages carry no tracking script and Admin > Visitors explains how to set it up', async () => {
  const base = await site();
  const res = await fetch(`${base}/`);
  assert.doesNotMatch(await res.text(), /data-website-id/);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self';/);
  const c = await signIn(base);
  assert.doesNotMatch(await (await c('/admin')).text(), /href="\/admin\/visitors"/);
  const page = await (await c('/admin/visitors')).text();
  assert.match(page, /Visitor figures aren't set up/);
  assert.match(page, /UMAMI_URL/);
});

test('with Umami set up, visitors get the tracking script and the policy allows the Umami server; editors are not counted', async () => {
  const base = await site(umamiConfig());
  const res = await fetch(`${base}/about`);
  const page = await res.text();
  assert.match(page, new RegExp(`<script defer src="${umamiUrl}/script.js" data-website-id="${WEBSITE}" data-domains="riverside.example.org,www.riverside.example.org" data-exclude-search="true" data-do-not-track="true"></script>`));
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, new RegExp(`script-src 'self' ${umamiUrl};`));
  assert.match(csp, new RegExp(`connect-src 'self' ${umamiUrl};`));

  const c = await signIn(base);
  assert.doesNotMatch(await (await c('/about')).text(), /data-website-id/, 'signed-in editors are not tracked');
});

test('Admin > Visitors shows this site\'s figures from Umami, signing in again when the token stops working', async () => {
  const base = await site(umamiConfig());
  const c = await signIn(base);
  umami.requests.length = 0;
  const res = await c('/admin/visitors?range=30d');
  assert.equal(res.status, 200);
  const page = await res.text();
  assert.match(page, /href="\/admin\/visitors"/, 'Visitors is in the admin menu');
  assert.match(page, /aria-current="page">Last 30 days/);
  assert.match(page, /3 people on the site/);
  assert.match(page, /class="stat-value">456<\/span><span class="stat-was">the 30 days before: 400/);
  assert.match(page, /class="stat-value">1,234</);
  assert.match(page, /Left after one page<\/span><span class="stat-value">40%<\/span><span class="stat-was">the 30 days before: 50%/);
  assert.match(page, /Average visit<\/span><span class="stat-value">1m 30s<\/span><span class="stat-was">the 30 days before: 1m 00s/);
  assert.match(page, /<svg class="visitors-chart"[^]*12 visitors, 34 page views/);
  assert.equal((page.match(/<g><title>/g) ?? []).length, 30, 'one bar per day');
  for (const s of ['/about', 'google.com', 'Direct, bookmarks or apps', 'United Kingdom', 'Ireland', 'Mobile', 'Safari (iOS)', 'Chrome']) assert.ok(page.includes(s), s);
  assert.ok(page.includes(`${umamiUrl}/websites/${WEBSITE}`), 'links to the full dashboard');
  assert.ok(umami.requests.includes('POST /api/auth/login'));
  assert.ok(umami.requests.includes(`GET /api/websites/${WEBSITE}/metrics?type=path`));

  // Cached for a few minutes: a second look doesn't ask Umami again.
  umami.requests.length = 0;
  await c('/admin/visitors?range=30d');
  assert.deepEqual(umami.requests, []);

  // Umami forgot the token (restarted with a new secret, password changed): sign in again and carry on.
  umami.tokens.clear();
  const again = await (await c('/admin/visitors?range=24h')).text();
  assert.match(again, /class="stat-value">456</);
  assert.equal((again.match(/<g><title>/g) ?? []).length, 24, 'one bar per hour');
});

test('Admin > Visitors explains what is wrong when Umami is unreachable or refuses the login', async () => {
  const wrong = await site(umamiConfig({ password: 'not-it' }));
  let page = await (await (await signIn(wrong))('/admin/visitors')).text();
  assert.match(page, /did not accept UMAMI_USERNAME and UMAMI_PASSWORD/);

  umami.down = true;
  try {
    const down = await site(umamiConfig());
    const res = await (await signIn(down))('/admin/visitors');
    assert.equal(res.status, 200);
    page = await res.text();
    assert.match(page, /The figures can't be shown right now/);
    assert.match(page, /answered 503/);
  } finally { umami.down = false; }

  const off = await site({ umami: { url: 'http://127.0.0.1:9', websiteId: WEBSITE, username: 'gleam', password: 'viewer-pass', scriptName: 'script.js' } });
  page = await (await (await signIn(off))('/admin/visitors')).text();
  assert.match(page, /could not be reached/);
  assert.equal((await fetch(`${off}/`)).status, 200, 'public pages are unaffected');

  const noLogin = await site({ umami: { url: umamiUrl, websiteId: WEBSITE, scriptName: 'script.js' } });
  assert.match(await (await fetch(`${noLogin}/`)).text(), /data-website-id/, 'tracking works without an API login');
  assert.match(await (await (await signIn(noLogin))('/admin/visitors')).text(), /Set UMAMI_API_KEY, or UMAMI_USERNAME and UMAMI_PASSWORD/);
});

test('an API key is sent instead of signing in, and Umami 2 response shapes are read too', async () => {
  const seen = [];
  const fake = async (url, opts) => {
    seen.push({ path: new URL(url).pathname, type: new URL(url).searchParams.get('type'), auth: opts.headers.Authorization, key: opts.headers['x-umami-api-key'] });
    const p = new URL(url).pathname;
    const body = p.endsWith('/stats') ? { pageviews: { value: 10, prev: 5 }, visitors: { value: 4, prev: 2 }, visits: { value: 5, prev: 2 }, bounces: { value: 1, prev: 1 }, totaltime: { value: 100, prev: 20 } }
      : p.endsWith('/pageviews') ? { pageviews: [], sessions: [] }
        : p.endsWith('/active') ? { x: 2 }
          : new URL(url).searchParams.get('type') === 'path' ? null : [{ x: '/', y: 10 }];
    return body === null ? new Response('{}', { status: 400 }) : Response.json(body);
  };
  const a = createAnalytics({ umami: { url: 'https://cloud.umami.is', apiUrl: 'https://api.umami.is/v1', websiteId: 'abc', apiKey: 'api_123', scriptName: 'script.js' } }, { fetch: fake });
  const r = await a.report('7d');
  assert.deepEqual(r.totals, { visitors: 4, pageviews: 10, visits: 5, bounceRate: 0.2, avgVisit: 20 });
  assert.equal(r.previous.visitors, 2);
  assert.equal(r.active, 2);
  assert.deepEqual(r.pages, [{ name: '/', count: 10 }], 'falls back to type=url');
  assert.ok(seen.every((s) => s.auth === 'Bearer api_123' && s.key === 'api_123'));
  assert.ok(seen.every((s) => s.path.startsWith('/v1/websites/abc/')), 'no sign-in with an API key');
  assert.ok(seen.some((s) => s.type === 'url'));
});

test('periods: buckets end today in the site\'s time zone, and start at local midnight', () => {
  const now = new Date('2026-07-15T23:30:00Z'); // 00:30 on 16 July in London (BST)
  const week = period('7d', 'Europe/London', now);
  assert.deepEqual(week.buckets.map((b) => b.key), ['2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16']);
  assert.equal(new Date(week.startAt).toISOString(), '2026-07-09T23:00:00.000Z');
  const year = period('12m', 'Europe/London', now);
  assert.equal(year.buckets.length, 12);
  assert.equal(year.buckets[0].key, '2025-08');
  assert.equal(year.buckets.at(-1).key, '2026-07');
  assert.equal(new Date(year.startAt).toISOString(), '2025-07-31T23:00:00.000Z');
  const day = period('24h', 'Europe/London', now);
  assert.equal(day.buckets.length, 24);
  assert.equal(day.buckets.at(-1).key, '2026-07-16 00');
  assert.equal(period('nonsense', 'Europe/London', now).label, 'Last 7 days');
});
