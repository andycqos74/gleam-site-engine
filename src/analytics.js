// Visitor statistics from Umami (https://umami.is): a privacy-friendly analytics server, run separately from the
// sites, that counts visits without cookies and without storing IP addresses. One Umami server can count any number
// of websites, Gleam or not. Here the engine adds Umami's tracking script to public pages and, for Admin > Visitors,
// reads this site's figures from the Umami API on the server, so the Umami login never reaches a browser.
//
// Written against Umami 3 (also reads the older v2 response shapes). Self-hosted Umami signs in with a username and
// password (or takes an API key); Umami Cloud takes an API key at UMAMI_API_URL=https://api.umami.is/v1.

import { today } from './content/types.js';

export class AnalyticsError extends Error {}

export const RANGES = {
  '24h': { label: 'Last 24 hours', unit: 'hour' },
  '7d': { label: 'Last 7 days', unit: 'day', count: 7 },
  '30d': { label: 'Last 30 days', unit: 'day', count: 30 },
  '12m': { label: 'Last 12 months', unit: 'month', count: 12 },
};
export const DEFAULT_RANGE = '7d';

const CACHE_MS = 5 * 60e3;
const TIMEOUT_MS = 10e3;

// Minutes ahead of UTC in timeZone at that moment ("GMT+01:00" → 60).
function tzOffset(date, timeZone) {
  const name = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'longOffset' }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? '';
  const m = /([+-])(\d\d):(\d\d)/.exec(name);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}
// Midnight at the start of a YYYY-MM-DD day in timeZone.
function midnight(ymd, timeZone) {
  const utc = new Date(`${ymd}T00:00:00Z`);
  return new Date(utc.getTime() - tzOffset(utc, timeZone) * 60e3);
}
const hourKey = (date, timeZone) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}`;
};

// The period and its buckets (oldest first), each with a key matching Umami's own bucket labels.
export function period(rangeKey, timeZone = 'Europe/London', now = new Date()) {
  const range = RANGES[rangeKey] ?? RANGES[DEFAULT_RANGE];
  const day = 864e5;
  if (range.unit === 'hour') {
    const buckets = Array.from({ length: 24 }, (_, i) => {
      const key = hourKey(new Date(now.getTime() - (23 - i) * 3600e3), timeZone);
      return { key, label: `${key.slice(11)}:00` };
    });
    return { ...range, startAt: now.getTime() - day, endAt: now.getTime(), buckets };
  }
  const [y, m, d] = today(timeZone, now).split('-').map(Number);
  if (range.unit === 'day') {
    const buckets = Array.from({ length: range.count }, (_, i) => {
      const date = new Date(Date.UTC(y, m - 1, d - (range.count - 1 - i)));
      return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) };
    });
    return { ...range, startAt: midnight(buckets[0].key, timeZone).getTime(), endAt: now.getTime(), buckets };
  }
  const buckets = Array.from({ length: range.count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (range.count - 1 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-GB', { month: 'short', year: i === 0 || d.getUTCMonth() === 0 ? 'numeric' : undefined, timeZone: 'UTC' }) };
  });
  return { ...range, startAt: midnight(`${buckets[0].key}-01`, timeZone).getTime(), endAt: now.getTime(), buckets };
}

// Umami labels buckets "2026-10-25 14:00:00" (or as an ISO string); reduce one to its period key.
const bucketKey = (x, unit) => String(x).replace('T', ' ').slice(0, { hour: 13, day: 10, month: 7 }[unit]);

const num = (v) => Number(v?.value ?? v ?? 0) || 0;
// Umami 3: { pageviews, visitors, visits, bounces, totaltime, comparison: {...} }. Umami 2: { pageviews: { value, prev }, ... }.
function totals(stats, previous) {
  const pick = (k) => (previous ? (stats.comparison ? num(stats.comparison[k]) : num(stats[k]?.prev)) : num(stats[k]));
  const visits = pick('visits');
  return {
    visitors: pick('visitors'),
    pageviews: pick('pageviews'),
    visits,
    bounceRate: visits ? Math.min(1, pick('bounces') / visits) : 0,
    avgVisit: visits ? pick('totaltime') / visits : 0,
  };
}

const regionNames = new Intl.DisplayNames(['en-GB'], { type: 'region' });
const countryName = (code) => {
  try { return code ? regionNames.of(code) : 'Unknown'; } catch { return code; }
};
const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : 'Unknown');
// Umami's browser codes that don't read well capitalised.
const BROWSERS = {
  crios: 'Chrome (iOS)', 'chromium-webview': 'Chrome (in an app)', 'edge-chromium': 'Edge', 'edge-ios': 'Edge (iOS)',
  fxios: 'Firefox (iOS)', ie: 'Internet Explorer', ios: 'Safari (iOS)', 'ios-webview': 'Safari (in an app)',
  'opera-mini': 'Opera Mini', samsung: 'Samsung Internet', yandexbrowser: 'Yandex', browser: 'Unknown',
};
const rows = (list, name = (x) => x) => (Array.isArray(list) ? list : []).map((r) => ({ name: name(r.x), count: num(r.y) }));

// config.umami (see config.js). Returns null when Umami isn't set up for this site.
export function createAnalytics(config, { fetch = globalThis.fetch, timeZone = 'Europe/London' } = {}) {
  const u = config.umami ?? {};
  if (!u.url || !u.websiteId) return null;
  if (!/^https?:\/\/[^/]/.test(u.url)) throw new Error(`UMAMI_URL should be the Umami server's address, such as https://stats.example.org (got "${u.url}").`);
  const origin = new URL(u.url).origin;
  const apiBase = u.apiUrl || `${u.url}/api`;
  const canReport = !!(u.apiKey || (u.username && u.password));
  let token = null;
  const cache = new Map();

  async function call(method, path, { query, body } = {}) {
    const url = new URL(apiBase + path);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
    const headers = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    // Self-hosted Umami takes an API key as a bearer token; Umami Cloud reads x-umami-api-key.
    if (u.apiKey) Object.assign(headers, { Authorization: `Bearer ${u.apiKey}`, 'x-umami-api-key': u.apiKey });
    else if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(url, { method, headers, body: body && JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new AnalyticsError(`The statistics server at ${origin} could not be reached (${e.cause?.code ?? e.name}).`);
    }
    return res;
  }

  async function login() {
    const res = await call('POST', '/auth/login', { body: { username: u.username, password: u.password } });
    if (res.status >= 500) throw new AnalyticsError(`The statistics server answered ${res.status} when signing in.`);
    const data = res.ok ? await res.json().catch(() => ({})) : {};
    if (!data.token) {
      throw new AnalyticsError(data.requiresTwoFactor
        ? 'The Umami account set in UMAMI_USERNAME has two-factor sign-in turned on. Use an account without it, or an API key.'
        : 'The statistics server did not accept UMAMI_USERNAME and UMAMI_PASSWORD.');
    }
    token = data.token;
  }

  async function get(path, query) {
    if (!u.apiKey && !token) await login();
    let res = await call('GET', path, { query });
    // Sign-in tokens end when the Umami password changes or Umami restarts with a new secret: sign in again once.
    if (res.status === 401 && !u.apiKey) {
      await login();
      res = await call('GET', path, { query });
    }
    if (res.status === 401 || res.status === 403) throw new AnalyticsError(`The Umami account can't see website ${u.websiteId}. Check UMAMI_WEBSITE_ID, and that the account (or API key) has access to that website.`);
    if (res.status === 404) throw new AnalyticsError(`The statistics server has no website ${u.websiteId}. Check UMAMI_WEBSITE_ID and UMAMI_URL.`);
    if (!res.ok) throw Object.assign(new AnalyticsError(`The statistics server answered ${res.status} for ${path}.`), { status: res.status });
    // A web page instead of JSON usually means UMAMI_URL points somewhere other than Umami.
    return res.json().catch(() => { throw new AnalyticsError(`${origin} didn't answer like an Umami server. Check UMAMI_URL.`); });
  }

  const site = `/websites/${encodeURIComponent(u.websiteId)}`;

  async function fetchReport(rangeKey, now) {
    const p = period(rangeKey, timeZone, now);
    const span = { startAt: p.startAt, endAt: p.endAt };
    const metric = (type, limit = 10) => get(`${site}/metrics`, { ...span, type, limit });
    // Umami 3 calls page addresses "path"; Umami 2 called them "url".
    const pages = () => metric('path').catch((e) => (e.status === 400 ? metric('url') : Promise.reject(e)));
    const [stats, series, top, referrers, countries, devices, browsers, active] = await Promise.all([
      get(`${site}/stats`, { ...span, compare: 'prev' }),
      get(`${site}/pageviews`, { ...span, unit: p.unit, timezone: timeZone }),
      pages(),
      metric('referrer'),
      metric('country'),
      metric('device'),
      metric('browser'),
      get(`${site}/active`).catch(() => null),
    ]);
    const byKey = (list) => {
      const m = new Map();
      for (const r of Array.isArray(list) ? list : []) {
        const k = bucketKey(r.x, p.unit);
        m.set(k, (m.get(k) ?? 0) + num(r.y));
      }
      return m;
    };
    const views = byKey(series.pageviews);
    const visitors = byKey(series.sessions);
    return {
      range: rangeKey,
      label: p.label,
      at: now.getTime(),
      totals: totals(stats, false),
      previous: totals(stats, true),
      series: p.buckets.map((b) => ({ ...b, pageviews: views.get(b.key) ?? 0, visitors: visitors.get(b.key) ?? 0 })),
      pages: rows(top),
      referrers: rows(referrers, (x) => x || 'Direct, bookmarks or apps'),
      countries: rows(countries, countryName),
      devices: rows(devices, capitalise),
      browsers: rows(browsers, (x) => BROWSERS[x] ?? capitalise(String(x ?? '').replace(/-/g, ' '))),
      active: active == null ? null : num(active.visitors ?? active.x ?? active[0]?.x ?? active),
    };
  }

  // This site's figures for a range in RANGES, cached for a few minutes.
  async function report(rangeKey = DEFAULT_RANGE, { now = new Date() } = {}) {
    if (!RANGES[rangeKey]) rangeKey = DEFAULT_RANGE;
    if (!canReport) throw new AnalyticsError('Set UMAMI_API_KEY, or UMAMI_USERNAME and UMAMI_PASSWORD, to show the figures here.');
    const hit = cache.get(rangeKey);
    if (hit && now.getTime() - hit.at < CACHE_MS) return hit;
    const data = await fetchReport(rangeKey, now);
    cache.set(rangeKey, data);
    return data;
  }

  // The BASE_URL host and its www / bare-domain twin: a site often answers on both (solwai.co.uk and
  // www.solwai.co.uk), and Umami silently ignores visits to any host not listed.
  function siteHosts(host) {
    const twin = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    return /^[\d.]+$|^localhost$|:/.test(host) ? host : `${host},${twin}`;
  }

  return {
    origin,
    canReport,
    dashboardUrl: `${u.url}/websites/${encodeURIComponent(u.websiteId)}`,
    // Attributes for the <script> tag on public pages.
    tracker: {
      src: `${u.url}/${u.scriptName}`,
      websiteId: u.websiteId,
      domains: config.baseUrl ? siteHosts(new URL(config.baseUrl).hostname) : null,
    },
    report,
  };
}
