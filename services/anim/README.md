# Anim service

Optional processing service for the site engine's animated photos. It separates a photo into depth layers (the
background plate filled in behind the subject, the subject cut out, and up to two bands in between) so the
`<animated-image>` player can move people against the background. The engine uses it when `ANIM_SERVICE_URL` is set
(see "Animated photos" in the main README), and only for photos where an editor ticks "Separate the subject from
the background"; design notes are in `docs/animated-images/HANDOVER.md` §3–4.

## API

```
POST /analyse                  multipart field "image"  →  202 { "job_id": "…" }
GET  /jobs/{id}                →  { "status": "queued|running|done|failed", "progress": 0–1, "error"?, "result"? }
GET  /jobs/{id}/files/{name}   →  image/webp
GET  /health                   →  { "ok", "ready", "error" }
```

`result`: `{ width, height, layers: [{ src: "layer-0.webp", depth, url }], subjects: [{ label, bbox: [x, y, w, h], layer }], info }`,
in normalised-image pixels, layers ordered far to near. `layer-0` is opaque; the others have alpha. A picture with
no separate subject and little depth comes back as one layer. Jobs run one at a time and are kept for `JOB_TTL`
seconds (default 3600).

## Pipeline (`app/pipeline.py`)

Memory: each model is loaded for its own step and freed afterwards (onnxruntime's arena off, `malloc_trim` after
each job): ~130 MB idle, up to ~1 GB per photo. `ANIM_KEEP_MODELS=1` keeps them loaded (~4 s faster, ~2–3 GB).
The subject model is called directly rather than through rembg, which keeps numba, scipy and scikit-image (~350
MB) out of the image; the depth model is the 8-bit export (27 MB, same layers as the 99 MB one).

1. Normalise: EXIF rotation, sRGB, longest side ≤ 2048 px.
2. Depth Anything V2 Small (ONNX, 8-bit) → 0 (far) … 1 (near); 1-D k-means into 2–4 bands (more only when they explain
   the depth much better); small or near-identical bands merge.
3. `isnet-general-use` (rembg's model, same pre/post-processing) → subject mask; the whole subject goes into the band of its median depth.
4. Cumulative soft alpha masks per layer (~2 px edges, the subject's own soft mask kept).
5. Each non-nearest layer: dilate what's in front by 2.5 % of the width, fill with LaMa (512 × 512 ONNX, run on a
   crop around the hole).
6. WebP q80.

## Build, run, test

```
docker build -t gleam-anim-service services/anim          # downloads ~410 MB of weights into the image
docker run --rm -p 127.0.0.1:8000:8000 gleam-anim-service
docker build --target test services/anim                   # tests with stand-in models
```

Without Docker: `pip install -r requirements.txt -r requirements-dev.txt`, `python -m pytest tests`; to run it,
`MODELS_DIR=… python download_models.py`, then `uvicorn app.main:app --port 8000` with the same
variables. `ANIM_THREADS` limits onnxruntime's threads (default: all cores).
