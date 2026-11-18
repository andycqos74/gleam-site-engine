"""The three ONNX models the pipeline uses, each behind a small class so tests can swap in stand-ins.

Weights are baked into the image at build time (see download_models.py); nothing is fetched at runtime.
MODELS_DIR (default /models) holds depth_anything_v2_small_int8.onnx, isnet-general-use.onnx and lama_fp32.onnx.

Memory: the pipeline loads each model only for its own step and frees it straight after (see pipeline.analyse),
with onnxruntime's memory arena off so freed memory goes back to the system. The peak is then about the largest
single model (~0.9 GB) instead of all three at once, and an idle service uses ~100 MB. Loading costs ~4 s per
photo; ANIM_KEEP_MODELS=1 keeps them loaded instead (faster, ~2–3 GB)."""

import os

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

MODELS_DIR = os.environ.get("MODELS_DIR", "/models")
THREADS = int(os.environ.get("ANIM_THREADS", "0"))  # 0 = onnxruntime picks


def _session(name):
    opts = ort.SessionOptions()
    opts.enable_cpu_mem_arena = False
    if THREADS:
        opts.intra_op_num_threads = THREADS
    return ort.InferenceSession(os.path.join(MODELS_DIR, name), opts, providers=["CPUExecutionProvider"])


class DepthModel:
    """Depth Anything V2 Small (8-bit weights: 27 MB instead of 99 MB, same depth to within 1 %). Returns relative depth, 0 = farthest, 1 = nearest, at the image's size."""

    MEAN = np.array([0.485, 0.456, 0.406], np.float32)
    STD = np.array([0.229, 0.224, 0.225], np.float32)

    def __init__(self):
        self.session = _session("depth_anything_v2_small_int8.onnx")
        self.input = self.session.get_inputs()[0].name

    def __call__(self, rgb):
        h, w = rgb.shape[:2]
        # As the model's own preprocessor: shorter side 518, keep the aspect, both sides a multiple of 14.
        scale = 518 / min(h, w)
        nh = max(14, int(round(h * min(scale, 1036 / max(h, w)) / 14)) * 14)
        nw = max(14, int(round(w * min(scale, 1036 / max(h, w)) / 14)) * 14)
        x = cv2.resize(rgb, (nw, nh), interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255
        x = ((x - self.MEAN) / self.STD).transpose(2, 0, 1)[None]
        d = np.squeeze(self.session.run(None, {self.input: x})[0]).astype(np.float32)
        d = cv2.resize(d, (w, h), interpolation=cv2.INTER_LINEAR)
        lo, hi = np.percentile(d, [1, 99])
        return np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)


class SubjectModel:
    """isnet-general-use (the model rembg uses, called directly so the image doesn't need rembg and its numba/scipy
    dependencies): a soft 0–1 mask of the main subject(s). Pre- and post-processing as rembg does it."""

    SIZE = 1024

    def __init__(self):
        self.session = _session("isnet-general-use.onnx")
        self.input = self.session.get_inputs()[0].name

    def __call__(self, rgb):
        h, w = rgb.shape[:2]
        x = np.asarray(Image.fromarray(rgb).resize((self.SIZE, self.SIZE), Image.LANCZOS), np.float32)
        x = x / max(float(x.max()), 1e-6) - 0.5
        pred = self.session.run(None, {self.input: x.transpose(2, 0, 1)[None]})[0][0, 0]
        lo, hi = float(pred.min()), float(pred.max())
        pred = (pred - lo) / max(hi - lo, 1e-6)
        mask = Image.fromarray((pred * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
        return np.asarray(mask, np.float32) / 255


class InpaintModel:
    """LaMa (big-lama, ONNX export with a fixed 512 × 512 input). Fills hole pixels of an RGB uint8 image."""

    SIZE = 512

    def __init__(self):
        self.session = _session("lama_fp32.onnx")
        self.inputs = [i.name for i in self.session.get_inputs()]

    def __call__(self, rgb, hole):
        h, w = rgb.shape[:2]
        S = self.SIZE
        img = cv2.resize(rgb, (S, S), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
        m = (cv2.resize(hole.astype(np.uint8) * 255, (S, S), interpolation=cv2.INTER_NEAREST) > 127).astype(np.float32)
        feeds = dict(zip(self.inputs, [img.transpose(2, 0, 1)[None], m[None, None]]))
        out = np.squeeze(self.session.run(None, feeds)[0]).transpose(1, 2, 0)
        if out.max() <= 1.5:  # some exports return 0–1, others 0–255
            out = out * 255
        out = np.clip(out, 0, 255).astype(np.uint8)
        return cv2.resize(out, (w, h), interpolation=cv2.INTER_CUBIC)


def load_models():
    """Models as factories: the pipeline creates each when its step starts and drops it afterwards."""
    for name in ("depth_anything_v2_small_int8.onnx", "isnet-general-use.onnx", "lama_fp32.onnx"):
        if not os.path.exists(os.path.join(MODELS_DIR, name)):
            raise FileNotFoundError(f"model weights missing: {os.path.join(MODELS_DIR, name)}")
    return {"depth": DepthModel, "subject": SubjectModel, "inpaint": InpaintModel}
