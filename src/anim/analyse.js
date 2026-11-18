// Image analysis for animated images (see public/animated-image.js): finds the bright points of light in a picture
// so the player can make them twinkle, sparkle and send pulses between them. Pure Node (sharp + typed arrays), so
// it runs inside the engine with no extra service.
//
//   nodes: bright blobs. Blur, threshold, connected components, then drop any blob near a bigger one. The biggest
//          is the "hub" (where pulses start).
//   stars: small points: local maxima over a 7×7 window that stand out from their surroundings, sampled to at most
//          700 so the player stays light.
//
// Thresholds come from the image's own brightness percentiles (with fixed floors), so a dark network graphic and an
// ordinary daylight photo both give sensible results. Coordinates are in the analysed image's pixels, which is
// what width/height in the result describe.

import sharp from 'sharp';

const MAX_SIDE = 2048;
const MAX_STARS = 700;
const MAX_NODES = 80;

// Deterministic random numbers, so the same image always gives the same analysis.
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function percentile(gray, p) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const target = gray.length * p;
  let n = 0;
  for (let v = 0; v < 256; v++) { n += hist[v]; if (n >= target) return v; }
  return 255;
}

// Separable maximum filter (radius r): the "dilate then compare" trick for local maxima.
function maxFilter(src, w, h, r) {
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let i = Math.max(0, x - r), e = Math.min(w - 1, x + r); i <= e; i++) if (src[row + i] > m) m = src[row + i];
      tmp[row + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 0;
      for (let i = Math.max(0, y - r), e = Math.min(h - 1, y + r); i <= e; i++) if (tmp[i * w + x] > m) m = tmp[i * w + x];
      out[y * w + x] = m;
    }
  }
  return out;
}

// 8-connected components of pixels at or above thr: [{ x, y, area }] with x, y the centroid.
function blobs(gray, w, h, thr, minArea) {
  const seen = new Uint8Array(gray.length);
  const stack = new Int32Array(gray.length);
  const found = [];
  for (let start = 0; start < gray.length; start++) {
    if (seen[start] || gray[start] < thr) continue;
    let top = 0; let area = 0; let sx = 0; let sy = 0;
    stack[top++] = start; seen[start] = 1;
    while (top) {
      const p = stack[--top];
      const px = p % w; const py = (p - px) / w;
      area++; sx += px; sy += py;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (!seen[q] && gray[q] >= thr) { seen[q] = 1; stack[top++] = q; }
        }
      }
    }
    if (area > minArea) found.push({ x: Math.round(sx / area), y: Math.round(sy / area), area });
  }
  return found;
}

async function grayOf(image, blur) {
  let img = image.clone();
  if (blur) img = img.blur(blur);
  const { data, info } = await img.toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
  if (info.channels === 1) return data;
  const out = new Uint8Array(info.width * info.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * info.channels];
  return out;
}

// input: a file path or Buffer. Returns { width, height, brightness, lights: { nodes, stars, hub } }.
export async function detectLights(input) {
  const image = sharp(input, { failOn: 'error', limitInputPixels: 80e6 }).rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#000' });
  const { info } = await image.clone().raw().toBuffer({ resolveWithObject: true });
  const w = info.width; const h = info.height;
  const scale = Math.max(w, h) / 1920; // the prototype's distances were tuned at 1920 px

  const [gray, soft, local] = await Promise.all([grayOf(image, 0), grayOf(image, 1.7), grayOf(image, 12)]);
  let sum = 0;
  for (let i = 0; i < gray.length; i += 7) sum += gray[i];
  const brightness = sum / Math.ceil(gray.length / 7) / 255;

  // Nodes: the brightest 0.25 % of the blurred image, but never below 175 (the prototype's dark-image setting).
  const nodeThr = Math.min(250, Math.max(175, percentile(soft, 0.995)));
  const minArea = Math.max(4, Math.round(12 * scale * scale));
  const merge = 40 * scale;
  const kept = [];
  const maxArea = w * h * 0.004; // anything bigger is a bright region (sky, a window), not a light
  for (const b of blobs(soft, w, h, nodeThr, minArea).filter((b) => b.area <= maxArea).sort((a, c) => c.area - a.area)) {
    if (kept.some((k) => Math.hypot(k.x - b.x, k.y - b.y) < merge)) continue;
    kept.push(b);
    if (kept.length >= MAX_NODES) break;
  }
  const nodes = kept.map((b) => [b.x, b.y, b.area]);

  // Stars: local maxima above the 97th percentile (at least 150) that are clearly brighter than their surroundings.
  const starThr = Math.min(245, Math.max(150, percentile(gray, 0.97)));
  const contrast = brightness > 0.35 ? 60 : 30;
  const peaks = maxFilter(gray, w, h, 3);
  let stars = [];
  for (let y = 3; y < h - 3; y++) {
    for (let x = 3, i = y * w + 3; x < w - 3; x++, i++) {
      const g = gray[i];
      if (g >= starThr && g === peaks[i] && g - local[i] >= contrast) stars.push([x, y, g]);
    }
  }
  if (stars.length > MAX_STARS) {
    const rnd = seeded(w * 31 + h);
    for (let i = stars.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [stars[i], stars[j]] = [stars[j], stars[i]]; }
    stars = stars.slice(0, MAX_STARS).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  }

  return {
    width: w,
    height: h,
    brightness: Math.round(brightness * 1000) / 1000,
    lights: { nodes, stars, hub: nodes.length ? [nodes[0][0], nodes[0][1]] : null },
  };
}
