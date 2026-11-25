"""Photo → depth layers for the <animated-image> player.

  1. normalise: EXIF rotation, sRGB, longest side at most 2048 px
  2. depth:     Depth Anything V2 Small, 0 (far) … 1 (near), split into 2–4 bands with 1-D k-means; more bands
                only when the depth range is wide
  3. subject:   rembg (isnet-general-use) mask; the whole subject goes into one band (the band of its median
                depth), so a person never tears across layers
  4. masks:     layer k covers everything in band k or nearer (cumulative, so soft edges never leave gaps), with
                small speckles removed and the edges softened by ~2 px; the subject's own soft mask is kept
  5. fill:      every layer except the nearest is filled behind the nearer layers with LaMa, after dilating the
                hole by 2.5 % of the width so no halo of subject pixels stays behind
  6. encode:    layer-0 as opaque WebP, the rest as WebP with alpha (q80)

Coordinates and sizes in the result are in normalised-image pixels."""

import gc
import io
import time

import cv2
import numpy as np
from PIL import Image, ImageCms, ImageOps

MAX_SIDE = 2048
Image.MAX_IMAGE_PIXELS = 80_000_000

FAR_DEPTH = 0.05  # how far each layer moves with the pointer/sway in the player (0 = not at all)
NEAR_DEPTH = 0.85  # player moves a depth-1 layer by 2 % of the width at full pointer; keep under that
SUBJECT_MIN_AREA = 0.005  # share of the picture before a cut-out counts as a subject
BAND_MIN_AREA = 0.03  # bands smaller than this merge into their neighbour
BAND_MIN_GAP = 0.15  # bands closer than this in depth (0–1) merge: one wall shouldn't become two layers
DILATE = 0.025  # hole dilation before filling, share of the width


class BadImage(ValueError):
    pass


def normalise(data):
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception as e:  # noqa: BLE001 - anything Pillow can't read is a bad upload
        raise BadImage("not an image Pillow can read") from e
    img = ImageOps.exif_transpose(img)
    icc = img.info.get("icc_profile")
    if icc:
        try:
            src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            img = ImageCms.profileToProfile(img.convert("RGB") if img.mode not in ("RGB", "RGBA") else img,
                                            src, ImageCms.createProfile("sRGB"), outputMode="RGB")
        except Exception:  # noqa: BLE001 - a broken profile: treat the pixels as sRGB
            pass
    if img.mode in ("RGBA", "LA", "P"):
        rgba = img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.getchannel("A"))
        img = bg
    img = img.convert("RGB")
    if max(img.size) > MAX_SIDE:
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return np.asarray(img).copy()


def kmeans1d(values, k, iters=25):
    """Sorted cluster centres of a 1-D sample."""
    centres = np.quantile(values, (np.arange(k) + 0.5) / k)
    for _ in range(iters):
        labels = np.argmin(np.abs(values[:, None] - centres[None]), axis=1)
        new = np.array([values[labels == i].mean() if np.any(labels == i) else centres[i] for i in range(k)])
        if np.allclose(new, centres, atol=1e-4):
            break
        centres = new
    return np.sort(centres)


def band_count(depth):
    """How many depth bands the picture needs (2–4). The depth map is normalised to 0–1, so its range says
    nothing; instead, add bands only while they explain the depth much better than fewer would (k-means fit)."""
    v = np.asarray(depth, np.float32).ravel()
    v = v[:: max(1, v.size // 20000)]
    sse1 = float(((v - v.mean()) ** 2).sum()) or 1e-9
    for k in (2, 3):
        c = kmeans1d(v, k)
        sse = float((np.min(np.abs(v[:, None] - c[None]), axis=1) ** 2).sum())
        if sse <= 0.1 * sse1:
            return k, round(sse / sse1, 3)
    return 4, round(sse / sse1, 3)


def remove_specks(mask, min_area, keep=None):
    """Drops connected parts smaller than min_area (and fills holes that small), keeping `keep` pixels."""
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    small = np.zeros(n, bool)
    small[1:] = stats[1:, cv2.CC_STAT_AREA] < min_area
    out = mask & ~small[lab]
    n, lab, stats, _ = cv2.connectedComponentsWithStats((~out).astype(np.uint8), connectivity=8)
    holes = np.zeros(n, bool)
    holes[1:] = stats[1:, cv2.CC_STAT_AREA] < min_area
    out = out | holes[lab]
    if keep is not None:
        out |= keep
    return out


def split_layers(depth, subject):
    """Returns (cumulative hard masks for layers 1..K-1, layer depths, subject band or None, info)."""
    h, w = depth.shape
    area = h * w
    d = cv2.GaussianBlur(depth, (0, 0), max(1.0, w * 0.004))
    k, spread = band_count(d)  # spread: how much depth variation k bands leave unexplained
    sample = d[:: max(1, h // 256), :: max(1, w // 256)].ravel()
    centres = list(kmeans1d(sample, k))
    labels = np.argmin(np.abs(d[..., None] - np.array(centres)[None, None]), axis=2)

    # Merge bands too small to be worth a layer into the neighbour nearest in depth.
    while len(centres) > 1:
        sizes = np.bincount(labels.ravel(), minlength=len(centres)) / area
        gaps = np.diff(centres)
        i = int(np.argmin(sizes))
        if sizes[i] >= BAND_MIN_AREA:
            if gaps.min() >= BAND_MIN_GAP:
                break
            g = int(np.argmin(gaps))  # merge the smaller of the two closest bands into the other
            i = g if sizes[g] < sizes[g + 1] else g + 1
        if i == 0:
            j = 1
        elif i == len(centres) - 1:
            j = i - 1
        else:
            j = i - 1 if centres[i] - centres[i - 1] < centres[i + 1] - centres[i] else i + 1
        labels[labels == i] = j
        labels[labels > i] -= 1
        del centres[i]
        centres = [float(d[labels == n].mean()) if np.any(labels == n) else c for n, c in enumerate(centres)]

    hard = subject > 0.5
    subject_band = None
    if hard.mean() >= SUBJECT_MIN_AREA:
        subject_band = int(np.argmin(np.abs(np.array(centres) - np.median(d[hard]))))
        if len(centres) == 1:  # flat picture with a subject: still give the subject its own layer
            centres = [float(d[~hard].mean()) if np.any(~hard) else 0.0, float(np.median(d[hard]))]
            labels = np.zeros_like(labels)
            subject_band = 1
        subject_band = max(1, subject_band)  # the subject is never the background plate
        labels[hard] = subject_band

    K = len(centres)
    speck = area * 0.002
    cums = []
    for i in range(1, K):
        keep = hard if subject_band is not None and i <= subject_band else None
        m = remove_specks(labels >= i, speck, keep)
        cums.append(m)
    for i in range(len(cums) - 2, -1, -1):  # nearer layers must sit inside farther ones
        cums[i] |= cums[i + 1]
    # Drop layers that ended up empty after cleaning.
    kept = [i for i, m in enumerate(cums) if m.mean() >= 0.002]
    if len(kept) < len(cums):
        if subject_band is not None:
            subject_band = kept.index(subject_band - 1) + 1 if subject_band - 1 in kept else None
        cums = [cums[i] for i in kept]
        centres = [centres[0]] + [centres[i + 1] for i in kept]

    lo, hi = centres[0], centres[-1]
    depths = [FAR_DEPTH] + [round(float(FAR_DEPTH + (NEAR_DEPTH - FAR_DEPTH) * ((c - lo) / (hi - lo) if hi > lo else 1)), 3) for c in centres[1:]]
    return cums, depths, subject_band, {"fit": spread, "bands": k}


def soft_alpha(hard, subject=None, px=2.0):
    a = cv2.GaussianBlur(hard.astype(np.float32), (0, 0), px)
    if subject is not None:
        a = np.maximum(a, subject)
    return np.clip(a, 0, 1)


def fill_behind(rgb, hole, inpaint):
    """Fills `hole` (bool) with LaMa on a crop around it, so detail is kept where the model can use it."""
    h, w = hole.shape
    ys, xs = np.nonzero(hole)
    if not len(ys):
        return rgb
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    # Context around the hole, then square-ish so the 512 × 512 model input isn't badly stretched.
    m = int(max(y1 - y0, x1 - x0) * 0.25) + 32
    y0, y1, x0, x1 = max(0, y0 - m), min(h, y1 + m), max(0, x0 - m), min(w, x1 + m)
    side = max(y1 - y0, x1 - x0)
    if y1 - y0 < side:
        grow = side - (y1 - y0)
        y0 = max(0, y0 - grow // 2)
        y1 = min(h, y0 + side)
        y0 = max(0, y1 - side)
    if x1 - x0 < side:
        grow = side - (x1 - x0)
        x0 = max(0, x0 - grow // 2)
        x1 = min(w, x0 + side)
        x0 = max(0, x1 - side)
    crop, crop_hole = rgb[y0:y1, x0:x1], hole[y0:y1, x0:x1]
    filled = inpaint(crop, crop_hole)
    weight = cv2.GaussianBlur(crop_hole.astype(np.float32), (0, 0), 3)[..., None]
    weight = np.maximum(weight, crop_hole[..., None].astype(np.float32))
    out = rgb.copy()
    out[y0:y1, x0:x1] = (crop * (1 - weight) + filled * weight).astype(np.uint8)
    return out


def encode(rgb, alpha=None, quality=80):
    buf = io.BytesIO()
    if alpha is None:
        Image.fromarray(rgb).save(buf, "WEBP", quality=quality, method=5)
    else:
        a = (alpha * 255).round().astype(np.uint8)
        Image.fromarray(np.dstack([rgb, a]), "RGBA").save(buf, "WEBP", quality=quality, method=5)
    return buf.getvalue()


def _model(m):
    """A model class is created for this step only (and freed after it); anything else is already a model."""
    return m() if isinstance(m, type) else m


def analyse(data, models, progress=lambda p: None):
    """Image bytes → {"result": {...}, "files": {name: bytes}}. models maps depth/subject/inpaint to a model, or to
    a model class to load just for its step, so only one model is in memory at a time."""
    timings = {}
    t = time.perf_counter()

    def lap(name, p):
        nonlocal t
        now = time.perf_counter()
        timings[name] = round(now - t, 2)
        t = now
        progress(p)

    rgb = normalise(data)
    h, w = rgb.shape[:2]
    lap("normalise", 0.05)
    depth = _model(models["depth"])(rgb)
    gc.collect()
    lap("depth", 0.3)
    subject = _model(models["subject"])(rgb).astype(np.float32)
    gc.collect()
    subject = cv2.GaussianBlur(subject, (0, 0), 1.0)
    lap("subject", 0.5)

    cums, depths, subject_band, info = split_layers(depth, subject)
    files = {}
    layers = []
    if not cums:
        # Nothing stands apart from the background: one flat layer.
        files["layer-0.webp"] = encode(rgb)
        layers.append({"src": "layer-0.webp", "depth": 0.45})
        lap("layers", 1.0)
        return {"result": {"width": w, "height": h, "layers": layers, "subjects": [], "info": {**info, "timings": timings}}, "files": files}

    K = len(cums) + 1
    inpaint = _model(models["inpaint"]) if K > 1 else None
    soft_subject = subject if subject_band is not None else None
    dilate = max(3, int(round(w * DILATE)))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dilate + 1, 2 * dilate + 1))
    for i in range(K):
        if i < K - 1:
            # Everything in front of this layer, including the faint edge of the cut-out, grown by 2.5 % of the width.
            front = cums[i].copy()
            if soft_subject is not None and i + 1 <= subject_band:
                front |= soft_subject > 0.05
            hole = cv2.dilate(front.astype(np.uint8), kernel).astype(bool)
            colour = fill_behind(rgb, hole, inpaint)
        else:
            colour = rgb
        name = f"layer-{i}.webp"
        if i == 0:
            files[name] = encode(colour)
        else:
            alpha = soft_alpha(cums[i - 1], soft_subject if subject_band is not None and i <= subject_band else None)
            files[name] = encode(colour, alpha)
        layers.append({"src": name, "depth": depths[i]})
        progress(0.5 + 0.5 * (i + 1) / K)
    del inpaint
    gc.collect()
    lap("layers", 1.0)

    subjects = []
    if subject_band is not None:
        ys, xs = np.nonzero(subject > 0.5)
        subjects.append({"label": "subject", "bbox": [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)], "layer": subject_band})
    return {
        "result": {"width": w, "height": h, "layers": layers, "subjects": subjects, "info": {**info, "timings": timings}},
        "files": files,
    }
