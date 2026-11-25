"""Bakes the model weights into the image at build time (the service never downloads anything at runtime).

Each file comes from a pinned revision and is checked against its SHA-256 sum. ~410 MB in all."""

import hashlib
import os
import sys
import urllib.request

MODELS_DIR = os.environ.get("MODELS_DIR", "/models")
FILES = {
    # Depth Anything V2 Small, 8-bit quantised export (the full-precision one is 99 MB and gives the same layers)
    "depth_anything_v2_small_int8.onnx": (
        "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/4472b7362082ad9968fee890ca0f1e5aca36b93d/onnx/model_quantized.onnx",
        "fcf51f1b230362b28690bb9d1809bf0431f29cad20534e3f589bd7285547f20d",
    ),
    # rembg's isnet-general-use, from rembg's own release
    "isnet-general-use.onnx": (
        "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx",
        "60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a",
    ),
    # big-lama, ONNX export with a fixed 512 x 512 input
    "lama_fp32.onnx": (
        "https://huggingface.co/Carve/LaMa-ONNX/resolve/c3c0c9e468934d62e79c329e35d82dd09ff8c444/lama_fp32.onnx",
        "1faef5301d78db7dda502fe59966957ec4b79dd64e16f03ed96913c7a4eb68d6",
    ),
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    os.makedirs(MODELS_DIR, exist_ok=True)
    for name, (url, digest) in FILES.items():
        path = os.path.join(MODELS_DIR, name)
        if not (os.path.exists(path) and sha256(path) == digest):
            print(f"downloading {name}", flush=True)
            urllib.request.urlretrieve(url, path + ".part")
            os.replace(path + ".part", path)
        if sha256(path) != digest:
            sys.exit(f"{name}: checksum mismatch")
    print("models ready:", sorted(os.listdir(MODELS_DIR)), flush=True)


if __name__ == "__main__":
    main()
