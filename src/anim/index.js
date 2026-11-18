// Animated images in the CMS. Any photo on the site (an upload in /media, or a theme photo in /img) can be given an
// animation from the editor: the photo is analysed for lights (analyse.js), the editor picks a preset and adjusts
// it, or describes what they want and Claude proposes settings, and the result plays for visitors wherever that
// photo appears (kit.js wraps it in <animated-image>). Animations are stored per photo address in the site's own
// database; a theme can ship defaults for its own photos in theme.animations.
//
// Claude only ever proposes: its settings load into the editor's preview, and nothing changes for visitors until an
// editor presses "Save animation".

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';
import { now } from '../db.js';
import { ValidationError } from '../content/store.js';
import { detectLights } from './analyse.js';
import { cleanConfig, MODEL_SCHEMA, PRESETS, EFFECT_TYPES, EFFECT_DEFAULTS, EFFECT_LABELS, PARTICLE_KINDS, suggestPreset } from './config.js';

const MAX_PROMPT = 1000;
const LAYER_DEPTH = 0.45; // single-layer photos: a little parallax for the photo, more for the lights in front of it

export const SYSTEM_PROMPT = `You set up subtle looping animations for still images on a website. The editor describes what they
want; you return animation settings that follow the given JSON schema exactly.

How the animation works: the still image is drawn on a canvas and effects play on top of it, in a seamless loop.
- drift: the whole picture slowly zooms and pans.
- parallax: the picture shifts slightly with the visitor's pointer (and sways gently on phones).
- twinkle: the small bright star-like points found in the image twinkle.
- sparkle: the larger bright lights found in the image glow and flare.
- pulses: dots of light travel from the brightest light (the hub) along straight lines to the other lights.
- particles: bubbles, dust, snow or embers drift inside one rectangular region.

Rules:
- Choose only from these effect types. Use twinkle, sparkle and pulses only when the analysis found lights
  (sparkle needs nodes; pulses needs a hub and several nodes; twinkle needs stars).
- Keep motion subtle by default: this sits behind or beside text on a web page. Only go strong when asked.
- For particles, base the region on the image and the analysis data. You can't see exact pixel positions: give
  your best approximate bbox in image pixels and set needsReview to true.
- If the request can't be done with these effects (for example making a person wave or adding sound), choose the
  closest settings and say so in note.
- The note is for the editor: one or two short, plain sentences in British English.`;

// Text summary of the analysis for the model: size, brightness and the biggest lights.
export function analysisSummary(a) {
  const nodes = a.lights?.nodes ?? [];
  return [
    `Image size: ${a.width} × ${a.height} pixels. Average brightness: ${Math.round((a.brightness ?? 0) * 100)}%.`,
    `Lights found: ${nodes.length} larger lights (nodes), ${a.lights?.stars?.length ?? 0} small star-like points.`,
    a.lights?.hub ? `Hub (brightest light): [${a.lights.hub.join(', ')}].` : 'No hub.',
    nodes.length ? `Top nodes as [x, y, area]: ${JSON.stringify(nodes.slice(0, 20))}.` : '',
    `Layers: ${a.layers?.length ?? 1} (the photo is one flat layer; there is no cut-out of people or objects).`,
  ].filter(Boolean).join('\n');
}

// Claude through the Messages API with structured outputs, so the answer always fits MODEL_SCHEMA. Refusals fall
// back server-side to the model Anthropic recommends.
export function claudeAnimator(config) {
  let client;
  return async ({ system, content }) => {
    client ??= new Anthropic({ apiKey: config.assistantApiKey, timeout: 120e3, maxRetries: 2 });
    const response = await client.beta.messages.create({
      model: config.animateModel,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: config.animateEffort, format: { type: 'json_schema', schema: MODEL_SCHEMA } },
      system,
      messages: [{ role: 'user', content }],
    });
    if (response.stop_reason === 'refusal') return { refused: true };
    if (response.stop_reason === 'max_tokens') throw new Error('Claude ran out of room for the answer.');
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { output: JSON.parse(text) };
  };
}

export function createAnimations({ db, theme, mediaDir, config: given = {} }) {
  const config = {
    ...given,
    animateModel: given.animateModel || 'claude-opus-5-5',
    animateEffort: given.animateEffort || 'medium',
  };
  db.exec(`CREATE TABLE IF NOT EXISTS animations (
    id INTEGER PRIMARY KEY,
    src TEXT NOT NULL UNIQUE,
    analysis TEXT NOT NULL,
    config TEXT,
    updated_at TEXT NOT NULL,
    updated_by INTEGER
  )`);
  const call = config.animateCall ?? claudeAnimator(config);
  const hasKey = !!config.assistantApiKey || !!config.animateCall;
  const themeDefaults = theme.animations ?? {};

  // The file behind a photo address, or null if it isn't one we can analyse.
  function fileFor(src) {
    const s = String(src ?? '');
    const media = /^\/media\/([\w-]+-1600\.webp)$/.exec(s);
    if (media) return path.join(mediaDir, media[1]);
    if (/^\/img\/[\w./-]+\.(jpe?g|png|webp)$/i.test(s) && !s.includes('..')) {
      const file = path.join(theme.publicDir, s);
      if (file.startsWith(path.join(theme.publicDir, 'img') + path.sep)) return file;
    }
    return null;
  }

  // In-memory index of what plays where: src -> { url, config }. Rebuilt after every change.
  let index;
  function buildIndex() {
    index = new Map();
    for (const [src, d] of Object.entries(themeDefaults)) index.set(src, { url: d.analysis, config: d.config });
    for (const r of db.prepare('SELECT id, src, config FROM animations').all()) {
      if (r.config) index.set(r.src, { url: `/_anim/${r.id}.json`, config: JSON.parse(r.config) });
      else index.delete(r.src); // removed by an editor, theme default included
    }
  }
  const lookup = (src) => { if (!index) buildIndex(); return index.get(src) ?? null; };

  const row = (src) => db.prepare('SELECT * FROM animations WHERE src = ?').get(src);

  // Analyses the photo the first time it's needed and keeps the result.
  async function analyse(src) {
    const file = fileFor(src);
    if (!file) throw new ValidationError('Only photos uploaded to this site or included with its design can be animated.');
    let r = row(src);
    if (!r) {
      if (!fs.existsSync(file)) throw new ValidationError('That photo could not be found.');
      const a = await detectLights(file);
      const analysis = { version: 1, width: a.width, height: a.height, brightness: a.brightness, layers: [{ src, depth: LAYER_DEPTH }], lights: a.lights };
      // A theme default (if any) keeps playing until an editor saves something else.
      const d = themeDefaults[src];
      db.prepare('INSERT OR IGNORE INTO animations (src, analysis, config, updated_at) VALUES (?, ?, ?, ?)')
        .run(src, JSON.stringify(analysis), d ? JSON.stringify(d.config) : null, now());
      r = row(src);
      buildIndex();
    }
    return { id: r.id, analysis: JSON.parse(r.analysis), config: r.config ? JSON.parse(r.config) : null };
  }

  // What the editor's Animate panel needs.
  async function panel(src) {
    const { id, analysis, config: saved } = await analyse(src);
    const start = suggestPreset(analysis);
    return {
      src,
      analysisUrl: `/_anim/${id}.json`,
      width: analysis.width,
      height: analysis.height,
      found: { nodes: analysis.lights.nodes.length, stars: analysis.lights.stars.length, hub: !!analysis.lights.hub },
      config: saved,
      saved: !!saved,
      suggested: start,
      presets: Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, { label: p.label, config: p.config }])),
      effects: EFFECT_TYPES.map((type) => ({ type, label: EFFECT_LABELS[type], defaults: EFFECT_DEFAULTS[type] })),
      particleKinds: PARTICLE_KINDS,
      ai: hasKey,
    };
  }

  async function save(src, input, userId) {
    const { analysis } = await analyse(src);
    const clean = input == null ? null : cleanConfig(input, analysis);
    db.prepare('UPDATE animations SET config = ?, updated_at = ?, updated_by = ? WHERE src = ?')
      .run(clean ? JSON.stringify(clean) : null, now(), userId ?? null, src);
    buildIndex();
    return clean;
  }

  // The analysis file the player loads.
  function analysisFile(id) {
    const r = db.prepare('SELECT analysis FROM animations WHERE id = ?').get(id);
    if (!r) return null;
    const a = JSON.parse(r.analysis);
    return { version: 1, width: a.width, height: a.height, layers: a.layers, lights: a.lights };
  }

  // Asks Claude for settings from the editor's description. Returns { config, note, needsReview } for review in the
  // editor; nothing is saved.
  async function suggest(src, prompt, current) {
    if (!hasKey) throw new ValidationError('The AI isn’t set up on this server (it needs an Anthropic API key).');
    const words = String(prompt ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, MAX_PROMPT);
    if (!words) throw new ValidationError('Describe the animation you’d like.');
    const { analysis } = await analyse(src);
    const image = await sharp(fileFor(src)).rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#fff' }).jpeg({ quality: 80 }).toBuffer();
    // Coordinates in the analysis are in analysed-image pixels; tell Claude the scale of the picture it sees.
    const meta = await sharp(image).metadata();
    const content = [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.toString('base64') } },
      { type: 'text', text: [
        `Analysis of the image (coordinates in image pixels; the picture above is scaled to ${meta.width} × ${meta.height}, so multiply what you see by ${round2(analysis.width / meta.width)}):`,
        analysisSummary(analysis),
        current ? `Current settings: ${JSON.stringify(current)}` : 'No current settings.',
        `The editor asks: ${words}`,
      ].join('\n\n') },
    ];
    let result;
    try {
      result = await call({ system: SYSTEM_PROMPT, content });
    } catch (e) {
      if (e instanceof Anthropic.APIError) console.error('Animation AI:', e.status, e.message);
      else console.error('Animation AI:', e);
      throw Object.assign(new Error('The AI couldn’t answer just now. Try again, or use the presets.'), { status: 502 });
    }
    if (result.refused) throw new ValidationError('The AI declined that request. Try describing it differently, or use the presets.');
    const out = result.output ?? {};
    const effects = (Array.isArray(out.effects) ? out.effects : []).filter((e) => EFFECT_TYPES.includes(e?.type))
      .map((e) => (e.type === 'particles' ? { ...e, region: { bbox: e.bbox } } : e));
    const clean = cleanConfig({ ...out, effects, pauseButton: current?.pauseButton }, analysis);
    // Light effects with no lights to work on would do nothing: drop them and say so.
    const L = analysis.lights;
    const usable = clean.effects.filter((e) => !(e.type === 'twinkle' && !L.stars.length) && !(e.type === 'sparkle' && !L.nodes.length) && !(e.type === 'pulses' && (!L.hub || L.nodes.length < 3)));
    let note = String(out.note ?? '').trim().slice(0, 500);
    if (usable.length < clean.effects.length) note = `${note} (Light effects were left out: no lights were found in this photo.)`.trim();
    return { config: { ...clean, effects: usable }, note, needsReview: !!out.needsReview || usable.some((e) => e.type === 'particles') };
  }

  return { lookup, analyse, panel, save, suggest, analysisFile, hasKey, fileFor };
}

const round2 = (n) => Math.round(n * 100) / 100;
