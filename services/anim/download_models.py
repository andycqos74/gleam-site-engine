"""Bakes the model weights into the image at build time (the service never downloads anything at runtime).

Depth Anything V2 Small and LaMa come from Hugging Face at pinned revisions and are checked against SHA-256
sums; rembg fetches isnet-general-use from its GitHub release itself (it verifies its own hash) into U2NET_HOME."""

import hashlib
import os
import sys
import urllib.request

MODELS_DIR = os.environ.get("MODELS_DIR", "/models")
FILES = {
    "depth_anything_v2_small.onnx": (
        "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/4472b7362082ad9968fee890ca0f1e5aca36b93d/onnx/model.onnx",
        "afb6a5c28f3b6bf1618c6e43f02073ef9dfdc70e937502d51603e57b0a1df10c",
    ),
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
    os.environ.setdefault("U2NET_HOME", MODELS_DIR)
    from rembg import new_session

    new_session("isnet-general-use")
    print("models ready:", sorted(os.listdir(MODELS_DIR)), flush=True)


if __name__ == "__main__":
    main()
