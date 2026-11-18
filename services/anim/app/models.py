"""The three ONNX models the pipeline uses, each behind a small class so tests can swap in stand-ins.

Weights are baked into the image at build time (see download_models.py); nothing is fetched at runtime.
MODELS_DIR (default /models) holds depth_anything_v2_small.onnx, lama_fp32.onnx and, for rembg,
isnet-general-use.onnx (rembg looks in U2NET_HOME, which the Dockerfile points at the same folder)."""

import os

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

MODELS_DIR = os.environ.get("MODELS_DIR", "/models")
THREADS = int(os.environ.get("ANIM_THREADS", "0"))  # 0 = onnxruntime picks


def _session(name):
    opts = ort.SessionOptions()
    if THREADS:
        opts.intra_op_num_threads = THREADS
    return ort.InferenceSession(os.path.join(MODELS_DIR, name), opts, providers=["CPUExecutionProvider"])


class DepthModel:
    """Depth Anything V2 Small. Returns relative depth, 0 = farthest, 1 = nearest, at the image's size."""

    MEAN = np.array([0.485, 0.456, 0.406], np.float32)
    STD = np.array([0.229, 0.224, 0.225], np.float32)

    def __init__(self):
        self.session = _session("depth_anything_v2_small.onnx")
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
    """rembg with isnet-general-use: a soft 0–1 mask of the main subject(s)."""

    def __init__(self):
        from rembg import new_session  # imported here so tests don't need rembg

        self.session = new_session("isnet-general-use")

    def __call__(self, rgb):
        from rembg import remove

        mask = remove(Image.fromarray(rgb), session=self.session, only_mask=True)
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
    return {"depth": DepthModel(), "subject": SubjectModel(), "inpaint": InpaintModel()}
