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
