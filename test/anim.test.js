// Animated images: light detection (src/anim/analyse.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLights } from '../src/anim/analyse.js';

test('detectLights finds the hub, the city nodes and the stars on the SolwAI network map', async () => {
  const a = await detectLights('themes/solwai/public/img/hero-solway.jpg');
  assert.equal(a.width, 1920);
  assert.equal(a.height, 1080);
  assert.ok(a.lights.nodes.length >= 20 && a.lights.nodes.length <= 80, `nodes: ${a.lights.nodes.length}`);
  assert.ok(Math.hypot(a.lights.hub[0] - 1240, a.lights.hub[1] - 404) < 20, `hub: ${a.lights.hub}`);
  assert.equal(a.lights.stars.length, 700);
  // Nodes are sorted biggest first and kept apart.
  const [first, second] = a.lights.nodes;
  assert.ok(first[2] >= second[2]);
});

// ---------- the CMS side: storage, the editor's API, validation and the Claude suggestion ----------
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { loadTheme } from '../src/theme.js';
import { cleanConfig, MODEL_SCHEMA, PRESETS, suggestPreset } from '../src/anim/config.js';

test('cleanConfig clamps numbers, rejects unknown effects and keeps particles inside the picture', () => {
  const c = cleanConfig({ speed: 9, intensity: -1, loopSeconds: 30, effects: [
    { type: 'drift', zoom: 1, panX: 5000 },
    { type: 'drift', zoom: 0.01 },
    { type: 'particles', kind: 'confetti', region: { bbox: [900, 500, 5000, 5000] }, count: 500 },
  ] }, { width: 1000, height: 600 });
  assert.equal(c.speed, 2);
  assert.equal(c.intensity, 0);
  assert.equal(c.loopSeconds, 12);
  assert.equal(c.effects.length, 2, 'duplicate drift dropped');
  assert.deepEqual([c.effects[0].zoom, c.effects[0].panX], [0.05, 15]);
  assert.deepEqual(c.effects[1], { type: 'particles', kind: 'dust', region: { bbox: [900, 500, 100, 100] }, count: 60, size: 1 });
  assert.throws(() => cleanConfig({ effects: [{ type: 'explode' }] }), /Unknown animation effect/);
  for (const p of Object.values(PRESETS)) assert.deepEqual(cleanConfig(p.config).effects.map((e) => e.type), p.config.effects.map((e) => e.type));
  assert.equal(suggestPreset({ brightness: 0.2, lights: { nodes: Array(20).fill([0, 0, 50]) } }), 'network');
  assert.equal(suggestPreset({ brightness: 0.5, lights: { nodes: [] } }), 'subject');
});

test('area effects: shine, glow and ripple each get a named area; twinkle and sparkle can be limited to one', async () => {
  const { inRegion } = await import('../src/anim/index.js');
  const c = cleanConfig({ effects: [
    { type: 'shine', label: '  <b>Club</b> sign\u0007 ', region: { bbox: [100, 50, 300, 40] }, angle: 200, width: 0, sweeps: 9 },
    { type: 'glow', bbox: [10, 10, 50, 50], tint: 'purple', strength: 4, beats: 0 },
    { type: 'ripple', region: { poly: [[0, 400], [900, 400], [900, 600], [0, 600]] }, amount: 0.4, waves: 20, direction: 'diagonal' },
    { type: 'ripple', region: { bbox: [0, 0, 10, 10] } },
    { type: 'ripple', region: { bbox: [0, 0, 10, 10] } },
    { type: 'ripple', region: { bbox: [0, 0, 10, 10] } },
    { type: 'twinkle', density: 0.3, label: 'floodlights', region: { bbox: [0, 0, 300, 100] } },
    { type: 'sparkle' },
  ] }, { width: 1000, height: 600 });
  assert.deepEqual(c.effects[0], { type: 'shine', region: { bbox: [100, 50, 300, 40] }, label: 'bClub/b sign', angle: 60, width: 0.1, sweeps: 3 });
  assert.deepEqual(c.effects[1], { type: 'glow', region: { bbox: [10, 10, 50, 50] }, tint: 'natural', strength: 1, beats: 1 });
  assert.deepEqual(c.effects[2], { type: 'ripple', region: { poly: [[0, 400], [900, 400], [900, 600], [0, 600]] }, amount: 0.4, waves: 8, direction: 'horizontal' });
  assert.equal(c.effects.filter((e) => e.type === 'ripple').length, 3, 'three of each area effect at most');
  assert.deepEqual(c.effects.find((e) => e.type === 'twinkle'), { type: 'twinkle', region: { bbox: [0, 0, 300, 100] }, label: 'floodlights', source: 'stars', density: 0.3 });
  assert.deepEqual(c.effects.find((e) => e.type === 'sparkle'), { type: 'sparkle', source: 'nodes', flare: true }, 'no area: the whole photo');
  // An area effect without an area gets the middle of the picture.
  assert.deepEqual(cleanConfig({ effects: [{ type: 'shine' }] }, { width: 900, height: 600 }).effects[0].region, { bbox: [300, 200, 300, 200] });
  assert.equal(inRegion({ bbox: [10, 10, 20, 20] }, 15, 29), true);
  assert.equal(inRegion({ bbox: [10, 10, 20, 20] }, 31, 15), false);
  assert.equal(inRegion({ poly: [[0, 0], [100, 0], [0, 100]] }, 20, 20), true);
  assert.equal(inRegion({ poly: [[0, 0], [100, 0], [0, 100]] }, 80, 80), false);
});

test('the structured-output schema only uses features structured outputs support', () => {
  const walk = (s) => {
    if (!s || typeof s !== 'object') return;
    for (const bad of ['minimum', 'maximum', 'minLength', 'maxLength', 'multipleOf']) assert.ok(!(bad in s), bad);
    if (s.type === 'object') assert.equal(s.additionalProperties, false);
    Object.values(s).forEach(walk);
  };
  walk(MODEL_SCHEMA);
});

const solwai = await loadTheme({ theme: 'solwai' });
function site(extra = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anim-test-'));
  const app = createApp({ themeObject: solwai, dataDir, adminEmail: 'admin@example.com', adminPassword: 'CorrectHorse99', cookieSecure: false, ...extra });
  const server = app.listen(0);
  const base = () => `http://127.0.0.1:${server.address().port}`;
  const jar = {};
  const c = async (url, opts = {}) => {
    const res = await fetch(base() + url, { redirect: 'manual', ...opts, headers: { ...(opts.headers ?? {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
    for (const ck of res.headers.getSetCookie()) { const [k, v] = ck.split(';')[0].split('='); if (v) jar[k] = v; else delete jar[k]; }
    return res;
  };
  const form = (obj) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(obj).toString() });
  async function login() {
    await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
    await c('/admin/login', form({ email: 'admin@example.com', password: 'CorrectHorse99' }));
    const csrf = /name="_csrf" value="([^"]+)"/.exec(await (await c('/admin')).text())[1];
    const json = (method, url, body) => c(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: body && JSON.stringify(body) });
    json.upload = (fd) => c('/api/media', { method: 'POST', headers: { 'X-CSRF-Token': csrf }, body: fd });
    return json;
  }
  const close = () => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); };
  return { c, login, close, base, dataDir };
}

test('editors analyse a photo, save an animation, and visitors get it wherever the photo appears', async (t) => {
  const s = site();
  t.after(s.close);
  const json = await s.login();
  const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#203040' } }).jpeg().toBuffer();
  const fd = new FormData();
  fd.append('file', new Blob([photo], { type: 'image/jpeg' }), 'room.jpg');
  const up = await (await json.upload(fd)).json();

  // Not a photo on this site: refused.
  assert.equal((await json('POST', '/api/animations/panel', { src: '/etc/passwd' })).status, 400);
  assert.equal((await json('POST', '/api/animations/panel', { src: '/img/../../theme.js' })).status, 400);

  const panel = await (await json('POST', '/api/animations/panel', { src: up.url })).json();
  assert.equal(panel.suggested, 'subject');
  assert.equal(panel.saved, false);
  assert.equal(panel.ai, false);
  assert.match(panel.analysisUrl, /^\/_anim\/\d+\.json$/);
  const analysis = await (await fetch(s.base() + panel.analysisUrl)).json();
  assert.deepEqual(analysis.layers, [{ src: up.url, depth: 0.45 }]);

  assert.equal((await json('PUT', '/api/animations', { src: up.url, config: { effects: [{ type: 'wobble' }] } })).status, 400);
  const saved = await (await json('PUT', '/api/animations', { src: up.url, config: PRESETS.subject.config })).json();
  assert.equal(saved.config.effects.length, 2);

  // Use the photo as the hero and check what visitors get.
  await json('POST', '/api/save', { fields: { 'home.hero.image': up.url } });
  const page = await (await fetch(`${s.base()}/`)).text();
  assert.match(page, new RegExp(`<animated-image class="hero-photo" src="${panel.analysisUrl.replace(/\./g, '\\.')}" config="[^"]+" controls><img src="${up.url}"`));
  assert.match(page, /<script src="\/_engine\/animated-image\.js\?v=[^"]+" defer>/);

  // Removing it shows the still photo again.
  await json('PUT', '/api/animations', { src: up.url, config: null });
  const still = await (await fetch(`${s.base()}/`)).text();
  assert.doesNotMatch(still, /<animated-image/);
  assert.match(still, new RegExp(`<img src="${up.url}"[^>]*class="hero-photo"`));
});

test('the theme default animation plays until an editor changes or removes it', async (t) => {
  const s = site();
  t.after(s.close);
  assert.match(await (await fetch(`${s.base()}/`)).text(), /<animated-image class="hero-photo" src="\/img\/anim\/hero-solway\.json"/);
  const json = await s.login();
  const panel = await (await json('POST', '/api/animations/panel', { src: '/img/hero-solway.jpg' })).json();
  assert.equal(panel.saved, true, 'starts from the theme default');
  assert.equal(panel.config.effects.length, 5);
  assert.ok(panel.found.nodes >= 20);
  await json('PUT', '/api/animations', { src: '/img/hero-solway.jpg', config: null });
  assert.doesNotMatch(await (await fetch(`${s.base()}/`)).text(), /<animated-image/);
});

test('Claude proposes settings from a description; they are validated and not saved', async (t) => {
  const calls = [];
  const s = site({
    animateCall: async (req) => {
      calls.push(req);
      return { output: { intensity: 3, speed: 0.7, loopSeconds: 8, note: 'Bubbles rise in the glass.', needsReview: true, effects: [
        { type: 'drift', zoom: 0.02, panX: 10, panY: 6 },
        { type: 'sparkle', flare: true },
        { type: 'particles', kind: 'bubbles', bbox: [100, 100, 80, 200], count: 20, size: 1 },
      ] } };
    },
  });
  t.after(s.close);
  const json = await s.login();
  const panel = await (await json('POST', '/api/animations/panel', { src: '/img/hero-solway.jpg' })).json();
  assert.equal(panel.ai, true);
  assert.equal((await json('POST', '/api/animations/suggest', { src: '/img/hero-solway.jpg', prompt: '  ' })).status, 400);
  const r = await (await json('POST', '/api/animations/suggest', { src: '/img/hero-solway.jpg', prompt: 'champagne bubbles please' })).json();
  assert.equal(r.config.intensity, 1, 'clamped');
  assert.deepEqual(r.config.effects.map((e) => e.type), ['drift', 'sparkle', 'particles']);
  assert.deepEqual(r.config.effects[2].region, { bbox: [100, 100, 80, 200] });
  assert.equal(r.needsReview, true);
  assert.equal(r.note, 'Bubbles rise in the glass.');
  // What Claude was sent: the image, the analysis summary and the request.
  const [img, text] = calls[0].content;
  assert.equal(img.type, 'image');
  assert.equal(img.source.media_type, 'image/jpeg');
  assert.match(text.text, /Image size: 1920 × 1080/);
  assert.match(text.text, /Hub \(brightest light\)/);
  assert.match(text.text, /The editor asks: champagne bubbles please/);
  assert.match(calls[0].system, /Choose only from these effect types/);
  // Nothing saved: the theme default still plays.
  const again = await (await json('POST', '/api/animations/panel', { src: '/img/hero-solway.jpg' })).json();
  assert.equal(again.config.effects.length, 5);
});

test('Claude can target parts of the photo: named areas come back as regions to review', async (t) => {
  const calls = [];
  const s = site({
    animateCall: async (req) => {
      calls.push(req);
      return { output: { intensity: 0.5, speed: 1, loopSeconds: 8, note: 'The sign shines.', needsReview: false, effects: [
        { type: 'shine', label: 'club sign', bbox: [250, 108, 435, 40], angle: 20, width: 0.25, sweeps: 1 },
        { type: 'ripple', label: 'sea', bbox: [0, 900, 1920, 180], amount: 0.5, waves: 3, direction: 'horizontal' },
        { type: 'twinkle', density: 0.5, label: null, bbox: null },
        { type: 'sparkle', flare: true, label: 'empty corner', bbox: [0, 0, 5, 5] },
      ] } };
    },
  });
  t.after(s.close);
  const json = await s.login();
  const panel = await (await json('POST', '/api/animations/panel', { src: '/img/hero-solway.jpg' })).json();
  assert.deepEqual(panel.areaTypes, ['particles', 'shine', 'glow', 'ripple']);
  const r = await (await json('POST', '/api/animations/suggest', { src: '/img/hero-solway.jpg', prompt: 'make the sign shine' })).json();
  assert.deepEqual(r.config.effects.map((e) => e.type), ['shine', 'ripple', 'twinkle'], 'sparkle in an area with no lights is left out');
  assert.deepEqual(r.config.effects[0].region, { bbox: [250, 108, 435, 40] });
  assert.equal(r.config.effects[0].label, 'club sign');
  assert.equal(r.config.effects[2].region, undefined, 'twinkle over the whole photo');
  assert.equal(r.needsReview, true, 'areas are always estimates');
  assert.match(r.note, /no lights were found in that area/);
  assert.match(calls[0].system, /shine: a band of light sweeps across the area/);
  // Saved as proposed.
  const saved = await (await json('PUT', '/api/animations', { src: '/img/hero-solway.jpg', config: r.config })).json();
  assert.deepEqual(saved.config.effects[1], { type: 'ripple', region: { bbox: [0, 900, 1920, 180] }, label: 'sea', amount: 0.5, waves: 3, direction: 'horizontal' });
});

// ---------- depth layers from the optional processing service (services/anim), stubbed over real HTTP ----------
import http from 'node:http';

// A stand-in for the service: POST /analyse → job id; GET /jobs/<id> is "running" once, then done; layer files are
// tiny WebPs. opts.fail makes every job fail; opts.down closes the server.
async function stubService(opts = {}) {
  const webp = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#0000' } }).webp().toBuffer();
  const calls = [];
  let polls = 0;
  const server = http.createServer((req, res) => {
    calls.push(`${req.method} ${req.url}`);
    const send = (status, body, type = 'application/json') => { res.writeHead(status, { 'Content-Type': type }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
    if (req.method === 'POST' && req.url === '/analyse') {
      let size = 0;
      req.on('data', (c) => { size += c.length; });
      req.on('end', () => { calls.push(`bytes ${size}`); send(202, { job_id: 'abc123' }); });
      return;
    }
    if (req.url === '/jobs/abc123') {
      if (opts.fail) return send(200, { status: 'failed', error: 'model exploded' });
      if (polls++ === 0) return send(200, { status: 'running', progress: 0.4 });
      return send(200, { status: 'done', progress: 1, result: {
        width: 1800, height: 1200,
        layers: [{ src: 'layer-0.webp', depth: 0.05 }, { src: 'layer-1.webp', depth: 0.5 }, { src: 'layer-2.webp', depth: 0.85 }],
        subjects: [{ label: 'subject', bbox: [600, 300, 600, 900], layer: 2 }],
      } });
    }
    if (/^\/jobs\/abc123\/files\/layer-[0-2]\.webp$/.test(req.url)) return send(200, webp, 'image/webp');
    send(404, { detail: 'nope' });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}/`, calls, close: () => server.close() };
}

async function uploadPerson(json) {
  const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#a08070' } }).jpeg().toBuffer();
  const fd = new FormData();
  fd.append('file', new Blob([photo], { type: 'image/jpeg' }), 'person.jpg');
  return (await json.upload(fd)).json();
}

test('depth layers are an option per photo: made on request, played only when the settings ask for them', async (t) => {
  const svc = await stubService();
  const s = site({ animServiceUrl: svc.url, animServicePollMs: 5 });
  t.after(() => { s.close(); svc.close(); });
  const json = await s.login();
  const up = await uploadPerson(json);

  // Uploading and opening the panel don't touch the service.
  const panel = await (await json('POST', '/api/animations/panel', { src: up.url })).json();
  assert.equal(svc.calls.length, 0);
  assert.deepEqual(panel.depth, { available: true, ready: false, url: null, layers: 1, subjects: 0 });
  assert.match(panel.analysisUrl, /^\/_anim\/\d+\.json$/);

  // The editor ticks "Separate the subject": the service makes the layers (once, however often it's asked).
  const [depth, again] = await Promise.all([1, 2].map(async () => (await json('POST', '/api/animations/depth', { src: up.url })).json()));
  assert.equal(svc.calls.filter((c) => c === 'POST /analyse').length, 1);
  assert.deepEqual(again, depth);
  assert.equal(depth.ready, true);
  assert.equal(depth.layers, 3);
  assert.equal(depth.subjects, 1);
  assert.match(depth.url, /^\/_anim\/\d+\.json\?depth=[0-9a-f]{12}$/);
  assert.ok(Number(svc.calls.find((c) => c.startsWith('bytes')).split(' ')[1]) > 1000, 'the photo was sent');

  const layered = await (await fetch(s.base() + depth.url)).json();
  assert.deepEqual(layered.layers.map((l) => l.depth), [0.05, 0.5, 0.85]);
  for (const l of layered.layers) {
    assert.match(l.src, /^\/media\/anim\/[0-9a-f]{20}\/layer-\d\.webp$/);
    const res = await fetch(s.base() + l.src);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/webp');
  }
  // The service saw a 1800 × 1200 picture; the subject is kept in the analysis's own pixels (900 × 600).
  assert.deepEqual(layered.subjects, [{ label: 'subject', bbox: [300, 150, 300, 450], layer: 2 }]);
  // The flat analysis is unchanged, and a wrong depth key finds nothing.
  assert.deepEqual((await (await fetch(s.base() + panel.analysisUrl)).json()).layers, [{ src: up.url, depth: 0.45 }]);
  assert.equal((await fetch(`${s.base()}${panel.analysisUrl}?depth=0000000000`)).status, 404);

  // Saved without depth: visitors get the flat photo. With depth: the layers.
  await json('POST', '/api/save', { fields: { 'home.hero.image': up.url } });
  const heroSrc = async () => /<animated-image class="hero-photo" src="([^"]+)"/.exec(await (await fetch(`${s.base()}/`)).text())?.[1];
  const flat = await (await json('PUT', '/api/animations', { src: up.url, config: PRESETS.subject.config })).json();
  assert.equal(flat.config.depth, false);
  assert.equal(await heroSrc(), panel.analysisUrl);
  const on = await (await json('PUT', '/api/animations', { src: up.url, config: { ...PRESETS.subject.config, depth: true } })).json();
  assert.equal(on.config.depth, true);
  assert.equal((await heroSrc()).replace(/&amp;/g, '&'), depth.url);
  const reopened = await (await json('POST', '/api/animations/panel', { src: up.url })).json();
  assert.equal(reopened.suggested, 'subject');
  assert.equal(reopened.depth.ready, true);
});

test('without the service, or when it fails, photos still animate as one layer', async (t) => {
  const plain = site();
  t.after(plain.close);
  const j0 = await plain.login();
  const up0 = await uploadPerson(j0);
  const p0 = await (await j0('POST', '/api/animations/panel', { src: up0.url })).json();
  assert.equal(p0.depth.available, false);
  assert.equal((await j0('POST', '/api/animations/depth', { src: up0.url })).status, 400);
  // Depth asked for in saved settings, but never made: plays flat.
  const saved = await (await j0('PUT', '/api/animations', { src: up0.url, config: { ...PRESETS.subject.config, depth: true } })).json();
  assert.equal(saved.config.depth, false);

  const svc = await stubService({ fail: true });
  const s = site({ animServiceUrl: svc.url, animServicePollMs: 5 });
  const errors = [];
  const log = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  t.after(() => { console.error = log; s.close(); svc.close(); });
  const json = await s.login();
  const up = await uploadPerson(json);
  const res = await json('POST', '/api/animations/depth', { src: up.url });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /couldn’t be separated/);
  assert.ok(errors.some((e) => /model exploded/.test(e)), errors.join('\n'));
  const panel = await (await json('POST', '/api/animations/panel', { src: up.url })).json();
  assert.equal(panel.depth.ready, false);

  // An unreachable service behaves the same.
  const s2 = site({ animServiceUrl: 'http://127.0.0.1:9/' });
  t.after(s2.close);
  const json2 = await s2.login();
  const up2 = await uploadPerson(json2);
  assert.equal((await json2('POST', '/api/animations/depth', { src: up2.url })).status, 502);
  assert.ok(errors.some((e) => /unreachable/.test(e)));
});

test('ANIM_SERVICE_URL is read from the environment', async () => {
  const { loadConfig } = await import('../src/config.js');
  assert.equal(loadConfig({ ANIM_SERVICE_URL: ' http://anim:8000/ ' }).animServiceUrl, 'http://anim:8000');
  assert.equal(loadConfig({}).animServiceUrl, '');
});
