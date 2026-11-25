// Client for the optional processing service (services/anim): it separates a photo into depth layers (background
// plate filled in behind the subject, the subject cut out, and up to two bands in between) so the person moves
// against the background in the player. Set ANIM_SERVICE_URL to use it; without it every photo plays as one layer.
//
// The service works asynchronously: POST /analyse returns a job id, GET /jobs/<id> reports progress and, when
// done, the layers, each fetched from GET /jobs/<id>/files/<name>. The layers are stored with the uploads in
// <mediaDir>/anim/<hash of the photo>/ and served from /media/anim/..., so the same photo is processed only once.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_LAYERS = 6;
const MAX_FILE = 20 * 1024 * 1024;
const MAX_SUBJECTS = 10;
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export class LayerServiceError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v, min, max, fallback) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };

export function createLayerService({ url, mediaDir, fetch: doFetch = globalThis.fetch, pollMs = 1000, timeoutMs = 300e3 }) {
  const base = String(url).replace(/\/+$/, '');

  async function call(p, opts = {}) {
    let res;
    try {
      res = await doFetch(base + p, { ...opts, signal: AbortSignal.timeout(60e3) });
    } catch (e) {
      throw new LayerServiceError(`processing service unreachable (${e.cause?.code ?? e.message})`);
    }
    if (!res.ok) throw new LayerServiceError(`processing service: ${p.split('/')[1]} HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
    return res;
  }

  // Sends the photo, waits for the job and stores its layers. Returns { width, height, layers, subjects, id } with
  // layer srcs as site addresses (/media/anim/<id>/layer-N.webp).
  async function layers(file) {
    const buf = fs.readFileSync(file);
    const id = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 20);
    const dir = path.join(mediaDir, 'anim', id);
    const manifest = path.join(dir, 'layers.json');
    if (fs.existsSync(manifest)) return JSON.parse(fs.readFileSync(manifest, 'utf8'));

    const form = new FormData();
    form.append('image', new Blob([buf], { type: TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' }), path.basename(file));
    const { job_id: job } = await (await call('/analyse', { method: 'POST', body: form })).json();
    if (!/^[\w-]{1,64}$/.test(String(job ?? ''))) throw new LayerServiceError('processing service: no job id');

    const deadline = Date.now() + timeoutMs;
    let status;
    for (;;) {
      status = await (await call(`/jobs/${job}`)).json();
      if (status.status === 'done') break;
      if (status.status === 'failed') throw new LayerServiceError(`processing service: ${String(status.error ?? 'failed').slice(0, 300)}`);
      if (Date.now() > deadline) throw new LayerServiceError('processing service: timed out');
      await sleep(pollMs);
    }

    const r = status.result ?? {};
    const width = Math.round(num(r.width, 1, 20000, 0)); const height = Math.round(num(r.height, 1, 20000, 0));
    const list = Array.isArray(r.layers) ? r.layers.slice(0, MAX_LAYERS) : [];
    if (!width || !height || !list.length || !list.every((l) => /^layer-\d\.webp$/.test(l?.src ?? ''))) {
      throw new LayerServiceError('processing service: unexpected result');
    }
    // Download into a temporary folder, then move it into place, so a half-written set is never used.
    const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
    fs.mkdirSync(tmp, { recursive: true });
    try {
      const out = [];
      for (const l of list) {
        const res = await call(`/jobs/${job}/files/${l.src}`);
        const data = Buffer.from(await res.arrayBuffer());
        if (data.length > MAX_FILE || data.subarray(8, 12).toString() !== 'WEBP') throw new LayerServiceError(`processing service: ${l.src} is not a WebP`);
        fs.writeFileSync(path.join(tmp, l.src), data);
        out.push({ src: `/media/anim/${id}/${l.src}`, depth: Math.round(num(l.depth, 0, 1, 0.45) * 1000) / 1000 });
      }
      const subjects = (Array.isArray(r.subjects) ? r.subjects : []).slice(0, MAX_SUBJECTS)
        .filter((s) => Array.isArray(s?.bbox) && s.bbox.length === 4)
        .map((s) => ({ label: String(s.label ?? 'subject').slice(0, 40), bbox: s.bbox.map((v) => Math.round(num(v, 0, 20000, 0))), layer: Math.round(num(s.layer, 0, out.length - 1, out.length - 1)) }));
      const result = { id, width, height, layers: out, subjects };
      fs.writeFileSync(path.join(tmp, 'layers.json'), JSON.stringify(result));
      fs.rmSync(dir, { recursive: true, force: true });
      fs.renameSync(tmp, dir);
      return result;
    } catch (e) {
      fs.rmSync(tmp, { recursive: true, force: true });
      throw e;
    }
  }

  return { layers, url: base };
}
