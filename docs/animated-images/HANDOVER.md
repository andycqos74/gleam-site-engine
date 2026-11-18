# Handover: Animated Images for website + CMS

**For:** Claude Code
**From:** a prototyping session in Claude chat, November 2026
**Status:** concept proven with two prototypes. Nothing is built in the real codebase yet.

---

## 1. What we're building

A CMS feature that turns an uploaded still image into a **subtle, looping, web-friendly animation**. Examples:

- slow camera drift and a parallax effect, where the subject moves slightly against the background
- twinkling lights, sparkles and glow pulses
- small particles inside a region, such as champagne bubbles, dust or snow
- light pulses travelling along lines, as in network or map graphics

Editors upload an image and then either:
1. **pick a preset** and adjust intensity and speed, or
2. **type a prompt** (e.g. "make the floodlights twinkle and drift slowly towards the player"). The prompt goes to the Claude API, which returns an effect config.

**Main design decision:** the animation is **rendered live in the browser** from a few layer images plus a JSON config. It is *not* baked into a video. MP4 export is a secondary option, for social media.

Why:
- Live rendering is roughly 150–300 KB per image, compared with 0.5–2 MB for a video.
- It stays sharp at any size.
- It can respond to the mouse or scrolling.
- It respects `prefers-reduced-motion`.
- Settings can be changed later without re-processing the image.

---

## 2. What the prototypes proved

| Prototype | Input | Result | Size |
|---|---|---|---|
| Network map (`reference/prototype-network/`) | Dark map graphic with glowing nodes | Live canvas player with presets, star twinkle, node flare, pulses along lines, drift and parallax | ~256 KB, including the image as base64 WebP |
| Same, baked | — | 8 s seamless loop, 1280×720, H.264 CRF 26 | 647 KB MP4 / 606 KB WebM |
| Restaurant photo (`reference/prototype-parallax/`) | Photo of a man at a table, taken from an Instagram ad | Automatic cut-out of subject and table, filled-in background plate, two-layer parallax plus rising champagne bubbles | 1080×1080 8 s loop, 462 KB MP4 |

Findings:
- **Light detection by brightness works well.** Blur, apply a threshold, find connected components, then merge any within 40 px. On the map image this found 43 nodes, plus several hundred star points from local maxima. No hand placement was needed.
- **The cut-out model `rembg` + `isnet-general-use`** picked out the person *and* the table and its items in one pass. `u2net_human_seg` did worse: it found only the person and left holes. A second pass on a crop is needed for objects the model misses; in the test it missed a pint glass.
- **`cv2.inpaint` is too crude for filling the background.** A smeared patch shows when the subject moves. → **Use LaMa in production.**
- **Two layers isn't enough when several things are at different depths.** In the test, a person in the near foreground was left in the background layer. → **Use a depth model to split the image into 3–4 layers.**
- **Every animation is periodic in `t ∈ [0,1)`**: each effect uses whole-number cycles per loop. That's what makes loops seamless, and it lets the browser player and the MP4 renderer share the same maths.

---

## 3. Architecture

```
 Editor uploads image
        │
        ▼
 CMS backend ──► Processing service (Python, Docker) ──► stores assets
        │          1. normalise (resize, strip EXIF, sRGB)
        │          2. depth map + layer split
        │          3. cut-outs (rembg) per layer
        │          4. background fill (LaMa)
        │          5. light/highlight detection
        │          6. write layers (WebP with alpha) + analysis.json
        │
        ├──► (optional) Claude API: prompt + image + analysis.json ──► effect config JSON
        │
        ▼
 CMS stores: asset folder + effect config (JSON column)
        │
        ▼
 Website: <animated-image> web component renders layers + config on <canvas>
        │
        └──► (optional) Export MP4: same config → server renderer → ffmpeg
```

**Check the existing website/CMS stack in this repo before choosing integration points.** The processing service should be a separate container no matter what the CMS is built in. It exposes a small HTTP API, so the CMS only needs to make HTTP calls and store JSON plus files.

---

## 4. Processing service

### Stack
- Python 3.11+, FastAPI, run as a Docker container
- `rembg[cpu]` (ONNX) with the `isnet-general-use` model for cut-outs
- **LaMa** for filling the background, e.g. the `big-lama` ONNX/TorchScript export, or `simple-lama-inpainting`
- **Depth Anything V2 Small** (ONNX) for the depth map
- `opencv-python-headless`, `numpy`, `Pillow`, `ffmpeg` (for export)

**Model weights must be downloaded at image build time and baked into the container**, not fetched at runtime. rembg models come from GitHub releases. LaMa and Depth Anything are usually on Hugging Face, so check that the build environment can reach them.

### API
```
POST /analyse            multipart: image  →  { job_id }
GET  /jobs/{id}          →  { status, progress, result? }
POST /export             { asset_id, config, format: "mp4"|"webm", size, seconds } → { job_id }
```
Process jobs asynchronously with a simple queue. A worker thread is fine to start with; switch to Redis/RQ if it's needed. Processing a 1080p image on CPU should take somewhere between a few seconds and about 30 s. The cut-out model takes about 2 s on CPU.

### Pipeline steps
1. **Normalise:** apply the EXIF rotation, convert to sRGB, limit the longest side to 2048 px, and keep the original.
2. **Depth:** run Depth Anything and normalise the result to 0–1. Split it into 2–4 bands with k-means on the depth values, or with fixed bands. Use more layers only when the depth range is wide.
3. **Cut-outs:** run rembg for the main subject. Combine it with the depth bands to make soft alpha masks per layer (blur the edges by about 2 px). Order the layers far to near.
4. **Background fill:** for every layer except the nearest, dilate the region covered by the layers in front of it by 2–3 % of the image width, then fill it with LaMa. This dilation matters: without it, a halo of subject pixels stays behind.
5. **Light detection** (copy the logic in `reference/prototype-network/detect_lights.py`):
   - **nodes:** Gaussian blur (9×9) → threshold about 175 → connected components with area over 12 → sort by area → drop any within 40 px of a bigger one. The hub is the largest one.
   - **stars:** local maxima (7×7 dilate, then equality) above brightness 150 → random sample of up to 700.
   - Adapt both thresholds to the image (use percentiles rather than fixed values), because the prototype was tuned on a dark image.
6. **Outputs**, per asset:
   ```
   /assets/anim/{id}/
     original.jpg
     layer-0.webp   (background plate, no alpha, q80)
     layer-1.webp … (alpha WebP, q80)
     depth.webp     (optional, for debugging)
     analysis.json
   ```
   `analysis.json`:
   ```json
   {
     "width": 1920, "height": 1080,
     "layers": [{ "src": "layer-0.webp", "depth": 0.0 }, { "src": "layer-1.webp", "depth": 0.6 }],
     "lights": { "nodes": [[x,y,area],...], "stars": [[x,y,brightness],...], "hub": [x,y] },
     "subjects": [{ "label": "person", "bbox": [x,y,w,h], "layer": 1 }]
   }
   ```
   Coordinates are in source-image pixels.

---

## 5. Effect config (stored per image in the CMS)

```json
{
  "version": 1,
  "loopSeconds": 8,
  "speed": 1.0,
  "intensity": 0.6,
  "effects": [
    { "type": "drift",    "zoom": 0.025, "panX": 14, "panY": 8 },
    { "type": "parallax", "strength": 1.0, "pointer": true, "autoSway": true },
    { "type": "twinkle",  "source": "stars", "density": 0.5 },
    { "type": "sparkle",  "source": "nodes", "flare": true },
    { "type": "pulses",   "from": "hub", "to": "nodes", "minArea": 40 },
    { "type": "particles","kind": "bubbles", "region": { "poly": [[568,690],[628,690],[612,805],[588,805]] }, "count": 22, "layer": 1 }
  ]
}
```
- Validate against a JSON Schema on save, and reject unknown `type`s.
- Ranges: `intensity` 0–1, `speed` 0.25–2, `loopSeconds` 4–12.
- Presets are just stored configs:
  - **Subtle:** drift, parallax, twinkle and sparkle at 0.45 intensity, speed 0.8
  - **Network alive:** everything at 0.7
  - **Twinkle only**
  - **Cinematic drift:** drift, parallax and twinkle at 0.4, speed 0.6
  - **Subject drift:** drift and parallax only. This is the general-purpose preset for photos of people.

---

## 6. Front-end player: `<animated-image>` web component

Start from `reference/prototype-network/player-prototype.html`. All the rendering logic is in its single `<script>`.

```html
<animated-image src="/assets/anim/123/" config='{"...":"..."}' alt="…">
  <img src="/assets/anim/123/original.jpg" alt="…">  <!-- fallback / LCP / no-JS -->
</animated-image>
```

Requirements:
- **Plain JS custom element with no framework**, under 10 KB minified. It reads `analysis.json` and the config.
- **Canvas 2D** is enough. Use WebGL only if profiling demands it.
- **Layers** are drawn far to near. Each layer's transform is `scale = baseZoom + drift`, `offset = pan + pointer × layer.depth × strength`. Sprite effects run on the near layer and inherit its transform.
- **Sprites:** pre-render radial-gradient glow and dot sprites once, and composite them with `globalCompositeOperation = 'lighter'`.
- **Periodic timing:** `t = (clock % loop) / loop`. Every effect uses whole-number cycles of `t`. Keep this, because the MP4 export relies on it.
- **Parallax input:** pointer position relative to the element, eased (lerp 0.06). Gentle automatic sway when there's no pointer, e.g. on touch screens. Optionally, scroll position as a source.
- **Performance:**
  - pause off-screen with `IntersectionObserver`
  - pause when `document.hidden`
  - cap devicePixelRatio at 2
  - keep particle counts limited
  - load layers lazily; the `<img>` fallback shows first, then the canvas fades in
- **Accessibility:**
  - `prefers-reduced-motion: reduce` → render a static frame, or only the faintest twinkle with no drift or parallax
  - keep `alt` on the fallback
  - add an optional pause button when the image is a page hero
- Behaves responsively like `object-fit: cover`.

---

## 7. CMS integration

- **Upload:** send to the processing service, show progress, and store the asset ID once it finishes.
- **Editor panel:**
  - preset chips
  - effect toggles
  - intensity and speed sliders
  - live preview using the same `<animated-image>` component
  - a "reset to preset" button
- **Prompt box:** sends to the Claude API (see §8). The returned config **loads into the editor for review**; it is never published automatically.
- **Persistence:** asset ID plus config JSON on the content record, and a version field.
- **Export button:** optional, calls `/export` and offers the MP4 for download.

---

## 8. Claude API: prompt to effect config

- Use the **Messages API** with an image input and **tool use**, so the output is guaranteed to fit the schema.
- Model: a current Sonnet or Haiku. **Check model IDs and SDK usage against https://docs.claude.com before coding.**
- Send:
  - the normalised image, downscaled to about 1024 px
  - a short summary of `analysis.json` (layer count, subjects with bboxes, the top 20 node positions and the hub)
  - the user's prompt
- Define one tool, `set_effect_config`, whose input schema is the §5 schema.
- System prompt essentials:
  - "Choose only from the listed effect types."
  - "Keep motion subtle by default."
  - "For any region-based effect, use coordinates from the supplied analysis data or subject bboxes. Do not invent precise pixel positions. If you need a region the analysis doesn't provide, give an approximate bbox and set `needsReview: true`."
  - "If the request can't be done with the available effects, choose the closest config and explain in `note`."
- **Server-side:** validate against the schema, clamp ranges, and snap region effects to nearby detected features. The API key stays on the server; never put it in the browser.
- **Optional:** make `/analyse` return regions for common objects (glasses, lamps, windows, floodlights) using a detector, so Claude picks from regions instead of estimating coordinates.

---

## 9. MP4/WebM export

- Re-implement the player maths server-side, as in `reference/*/render_mp4.py` (numpy + OpenCV, piped to ffmpeg), **or** record the real web component in headless Chromium (Playwright). The headless-browser route guarantees an exact match with the website, so prefer it if Chromium fits in the container.
- ffmpeg:
  - H.264: `-c:v libx264 -preset veryfast -crf 24 -pix_fmt yuv420p -movflags +faststart`, 25 fps
  - WebM: `-c:v libvpx-vp9 -b:v 0 -crf 40 -row-mt 1`
- On the website, embed with `<video autoplay muted loop playsinline poster=…>`.
- Don't output GIF; offer animated WebP only if specifically requested.

---

## 10. Known issues and lessons

- **Screenshots as source:** uploads may include app chrome such as Instagram headers and "8/8" badges. Add an optional crop step in the editor. The prototype cropped manually and painted out the badge.
- **Fill quality:** a crude fill smears visibly near detailed backgrounds, e.g. wall mouldings. Use LaMa and keep layer movement small: under about 2 % of the width.
- **Layer order:** objects the cut-out misses stay in the background and slide against the foreground. The depth-based split fixes most of this, and the editor should let the user paint to add or remove areas from a layer later (v2).
- **Thresholds:** light detection was tuned on a dark image. Use percentile-based thresholds for normal photos.
- **Rights:** test images included a third-party advert. Production use should only process images the club or organisation has rights to.

---

## 11. Suggested build order

1. **Player:** `<animated-image>` web component, ported from the prototype. Test it with the prototype assets by hand-writing `analysis.json`.
2. **Processing service:** the Docker container with rembg, LaMa, depth and light detection, plus the `/analyse` job API.
3. **CMS:** upload flow, editor panel with presets, config storage and rendering on the website.
4. **Claude prompt-to-config:** the tool-use call, validation and the review step.
5. **Export:** MP4/WebM.
6. **v2:** mask touch-up brush, object region detection, scroll-linked parallax.

### Done means
- [ ] An uploaded photo of a person gets a working "Subject drift" preset with no manual steps.
- [ ] A dark image with lights gets working twinkle and sparkle presets.
- [ ] The player is under 10 KB, holds 60 fps on a mid-range phone, pauses off-screen, and respects reduced motion.
- [ ] The total page weight added per animated image is under 400 KB at 1080p.
- [ ] Prompt-generated configs always pass schema validation and are reviewed before publishing.
- [ ] Exported MP4 loops seamlessly and matches the web version.

---

## 12. Reference files

```
reference/
  prototype-network/
    player-prototype.html   working canvas player (presets, twinkle, sparkle, pulses, drift, parallax, controls)
    detect_lights.py        node + star detection → spots.json
    render_mp4.py           server-side render of the same effects → MP4 (reads src.jpg + spots.json)
  prototype-parallax/
    build_layers.py         rembg cut-out + background plate (cv2.inpaint — replace with LaMa)
    render_mp4.py           two-layer parallax + bubbles-in-region → MP4 (reads photo.png, bg_plate.png, fg_alpha.png)
    layers-example.jpg      cut-out (red) vs filled background
```
These are throwaway prototypes. Use them for the maths and behaviour, not for code structure.
