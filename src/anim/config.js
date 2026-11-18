// Effect configs for animated images: the effect types, their defaults, the presets, and cleanConfig(), which every
// config passes through before it is stored (from the editor's controls or from Claude). Unknown effect types are
// rejected; every number is clamped to a range that keeps the motion subtle and the loop seamless.

import { ValidationError } from '../content/store.js';

export const EFFECT_TYPES = ['drift', 'parallax', 'twinkle', 'sparkle', 'pulses', 'particles'];
export const PARTICLE_KINDS = ['bubbles', 'dust', 'snow', 'embers'];

// What each effect looks like when it's switched on in the editor.
export const EFFECT_DEFAULTS = {
  drift: { type: 'drift', zoom: 0.025, panX: 14, panY: 8 },
  parallax: { type: 'parallax', strength: 1, pointer: true, autoSway: true },
  twinkle: { type: 'twinkle', source: 'stars', density: 0.5 },
  sparkle: { type: 'sparkle', source: 'nodes', flare: true },
  pulses: { type: 'pulses', from: 'hub', to: 'nodes', minArea: 40 },
  particles: { type: 'particles', kind: 'dust', count: 24, size: 1 },
};

export const EFFECT_LABELS = {
  drift: 'Slow drift', parallax: 'Parallax', twinkle: 'Twinkling lights', sparkle: 'Light sparkle', pulses: 'Pulses along lines', particles: 'Particles',
};

const preset = (label, types, intensity, speed) => ({ label, config: { version: 1, loopSeconds: 8, speed, intensity, effects: types.map((t) => ({ ...EFFECT_DEFAULTS[t] })) } });
export const PRESETS = {
  subject: preset('Subject drift', ['drift', 'parallax'], 0.6, 0.8),
  subtle: preset('Subtle', ['drift', 'parallax', 'twinkle', 'sparkle'], 0.45, 0.8),
  network: preset('Network alive', ['drift', 'parallax', 'twinkle', 'sparkle', 'pulses'], 0.7, 1),
  twinkle: preset('Twinkle only', ['twinkle', 'sparkle'], 0.65, 1),
  cinematic: preset('Cinematic drift', ['drift', 'parallax', 'twinkle'], 0.4, 0.6),
};

// The preset to start from for a freshly analysed image: lights on a dark picture get the light effects; anything
// else (a photo of people, a room, a landscape) gets the general-purpose drift, as does any photo with a cut-out
// subject that isn't covered in lights.
export function suggestPreset(analysis) {
  const nodes = analysis?.lights?.nodes?.length ?? 0;
  const dark = (analysis?.brightness ?? 1) < 0.35;
  // A subject cut out by the processing service: the subject drifts against the background.
  if ((analysis?.depth?.subjects ?? analysis?.subjects)?.length && nodes < 8) return 'subject';
  if (dark && nodes >= 8) return 'network';
  if (dark && nodes >= 3) return 'subtle';
  return 'subject';
}

const num = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const round = (n, places = 3) => Math.round(n * 10 ** places) / 10 ** places;
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

// Clamps a particles region to the picture. Accepts { bbox: [x, y, w, h] } or { poly: [[x, y], ...] } (or a bare
// bbox array, as Claude returns it). Without one, the middle third of the picture.
function cleanRegion(region, W, H) {
  const clampPt = ([x, y]) => [Math.round(num(x, 0, W, 0)), Math.round(num(y, 0, H, 0))];
  if (Array.isArray(region?.poly) && region.poly.length >= 3 && region.poly.length <= 32 && region.poly.every((p) => Array.isArray(p) && p.length === 2)) {
    return { poly: region.poly.map(clampPt) };
  }
  const b = Array.isArray(region) ? region : region?.bbox;
  if (Array.isArray(b) && b.length === 4 && b.every((v) => Number.isFinite(Number(v)))) {
    const x = Math.round(num(b[0], 0, W - 8, 0)); const y = Math.round(num(b[1], 0, H - 8, 0));
    return { bbox: [x, y, Math.round(num(b[2], 8, W - x, W - x)), Math.round(num(b[3], 8, H - y, H - y))] };
  }
  return { bbox: [Math.round(W / 3), Math.round(H / 3), Math.round(W / 3), Math.round(H / 3)] };
}

// Returns a clean config, or throws a ValidationError. analysis gives the picture size for pixel values.
export function cleanConfig(input, analysis = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('The animation settings are missing.');
  const W = analysis.width || 1920; const H = analysis.height || 1080;
  const effects = Array.isArray(input.effects) ? input.effects : [];
  if (effects.length > 10) throw new ValidationError('Too many effects (10 at most).');
  const seen = new Set();
  const out = [];
  for (const e of effects) {
    if (!e || !EFFECT_TYPES.includes(e.type)) throw new ValidationError(`Unknown animation effect: ${String(e?.type ?? '').slice(0, 40)}`);
    if (e.type !== 'particles' && seen.has(e.type)) continue;
    seen.add(e.type);
    const c = { type: e.type };
    if (e.depth != null) c.depth = round(num(e.depth, 0, 1.5, 1));
    switch (e.type) {
      case 'drift': {
        const maxPan = Math.round(W * 0.015);
        Object.assign(c, { zoom: round(num(e.zoom, 0, 0.05, 0.025)), panX: Math.round(num(e.panX, -maxPan, maxPan, 14)), panY: Math.round(num(e.panY, -maxPan, maxPan, 8)) });
        break;
      }
      case 'parallax': Object.assign(c, { strength: round(num(e.strength, 0, 2, 1)), pointer: bool(e.pointer, true), autoSway: bool(e.autoSway, true) }); break;
      case 'twinkle': Object.assign(c, { source: 'stars', density: round(num(e.density, 0, 1, 0.5)) }); break;
      case 'sparkle': Object.assign(c, { source: 'nodes', flare: bool(e.flare, true) }); break;
      case 'pulses': Object.assign(c, { from: 'hub', to: 'nodes', minArea: Math.round(num(e.minArea, 0, 10000, 40)) }); break;
      case 'particles':
        if (out.filter((x) => x.type === 'particles').length >= 3) continue;
        Object.assign(c, {
          kind: PARTICLE_KINDS.includes(e.kind) ? e.kind : 'dust',
          region: cleanRegion(e.region ?? e.bbox, W, H),
          count: Math.round(num(e.count, 1, 60, 24)),
          size: round(num(e.size, 0.3, 3, 1)),
        });
        break;
      default:
    }
    out.push(c);
  }
  return {
    version: 1,
    loopSeconds: Math.round(num(input.loopSeconds, 4, 12, 8)),
    speed: round(num(input.speed, 0.25, 2, 1), 2),
    intensity: round(num(input.intensity, 0, 1, 0.6), 2),
    pauseButton: bool(input.pauseButton, true),
    // Play the photo's depth layers (subject cut out from the background) instead of the flat photo.
    depth: bool(input.depth, false),
    effects: out,
  };
}

// The JSON Schema Claude's answer must follow (structured outputs). Number ranges can't be expressed in these
// schemas, so they're described in words and cleanConfig() clamps them afterwards.
const n = (description) => ({ type: 'number', description });
const effect = (type, props) => ({
  type: 'object', additionalProperties: false, required: ['type', ...Object.keys(props)],
  properties: { type: { type: 'string', const: type }, ...props },
});
export const MODEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intensity', 'speed', 'loopSeconds', 'effects', 'note', 'needsReview'],
  properties: {
    intensity: n('Overall strength of the light effects and motion, 0 to 1. Default 0.5; subtle is 0.3 to 0.6.'),
    speed: n('Playback speed, 0.25 to 2. 1 is normal; 0.6 to 0.8 feels calm.'),
    loopSeconds: { type: 'integer', description: 'Length of one seamless loop in seconds, 4 to 12. Usually 8.' },
    effects: {
      type: 'array',
      description: 'The effects to use, at most one of each type except particles (up to 3 regions).',
      items: {
        anyOf: [
          effect('drift', { zoom: n('Slow zoom amount, 0 to 0.05 (0.025 typical).'), panX: n('Horizontal drift in image pixels, small (under 1.5% of the width).'), panY: n('Vertical drift in image pixels, small.') }),
          effect('parallax', { strength: n('0 to 2, 1 typical. Moves with the pointer, and sways gently on its own.'), autoSway: { type: 'boolean', description: 'Sway gently when there is no pointer (phones).' } }),
          effect('twinkle', { density: n('Share of the small star-like points that twinkle, 0 to 1.') }),
          effect('sparkle', { flare: { type: 'boolean', description: 'Add a four-point star flare at the peak of each light.' } }),
          effect('pulses', { minArea: n('Only send pulses to lights at least this big (pixel area); 40 typical.') }),
          effect('particles', {
            kind: { type: 'string', enum: PARTICLE_KINDS },
            bbox: { type: 'array', items: { type: 'number' }, description: 'Region [x, y, width, height] in image pixels where the particles appear.' },
            count: { type: 'integer', description: 'Number of particles, 1 to 60.' },
            size: n('Particle size multiplier, 0.3 to 3. 1 typical.'),
          }),
        ],
      },
    },
    note: { type: 'string', description: 'One or two plain sentences for the editor: what you chose, and anything you could not do.' },
    needsReview: { type: 'boolean', description: 'True if you estimated a region (e.g. particles bbox) rather than taking it from the analysis data.' },
  },
};
