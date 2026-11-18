"""Pipeline and API tests with stand-in models (no weights needed): python -m pytest services/anim/tests"""

import io
import time

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import main, pipeline

W, H = 640, 400


def disc(h, w, cx=0.5, cy=0.55, r=0.22):
    yy, xx = np.mgrid[0:h, 0:w]
    return ((xx - cx * w) ** 2 + (yy - cy * h) ** 2) < (r * min(h, w)) ** 2


def fake_models():
    def depth(rgb):
        h, w = rgb.shape[:2]
        d = np.tile(np.linspace(0, 0.5, h, dtype=np.float32)[:, None], (1, w))  # floor gets nearer towards the bottom
        d[disc(h, w)] = 0.9  # a person standing in front
        return d

    def subject(rgb):
        return disc(*rgb.shape[:2]).astype(np.float32)

    def inpaint(rgb, hole):
        out = rgb.copy()
        out[hole] = (10, 200, 10)  # obvious colour, so the tests can see where the fill went
        return out

    return {"depth": depth, "subject": subject, "inpaint": inpaint}


def photo(w=W, h=H, fmt="JPEG"):
    img = np.zeros((h, w, 3), np.uint8)
    img[:] = (90, 110, 140)
    img[disc(h, w)] = (230, 180, 150)
    buf = io.BytesIO()
    Image.fromarray(img).save(buf, fmt)
    return buf.getvalue()


def decode(data):
    return Image.open(io.BytesIO(data))


def test_layers_split_the_subject_from_the_background():
    out = pipeline.analyse(photo(), fake_models())
    r, files = out["result"], out["files"]
    assert (r["width"], r["height"]) == (W, H)
    assert 2 <= len(r["layers"]) <= 4
    depths = [l["depth"] for l in r["layers"]]
    assert depths == sorted(depths) and depths[0] < 0.1 and depths[-1] > 0.8

    plate = decode(files["layer-0.webp"])
    assert plate.mode == "RGB" and plate.size == (W, H)
    # The background plate has the subject filled in (the fake LaMa paints green), with the hole dilated past it.
    px = np.asarray(plate)
    assert px[int(H * 0.55), W // 2, 1] > 150
    edge = int(W * 0.5 + 0.22 * H + W * 0.015)  # just outside the subject's edge: still filled
    assert px[int(H * 0.55), edge, 1] > 150

    near = decode(files[r["layers"][-1]["src"]])
    assert near.mode == "RGBA"
    a = np.asarray(near)[..., 3]
    assert a[int(H * 0.55), W // 2] > 240  # the subject is opaque
    assert a[5, 5] < 10  # the far corner is clear
    s = r["subjects"][0]
    assert s["layer"] == len(r["layers"]) - 1
    assert abs(s["bbox"][0] + s["bbox"][2] / 2 - W / 2) < 6
    # The subject's own layer shows the real subject, not the fill.
    assert abs(int(np.asarray(near)[int(H * 0.55), W // 2, 0]) - 230) < 20


def test_flat_picture_without_a_subject_is_one_layer():
    models = {**fake_models(), "depth": lambda rgb: np.full(rgb.shape[:2], 0.5, np.float32), "subject": lambda rgb: np.zeros(rgb.shape[:2], np.float32)}
    r = pipeline.analyse(photo(), models)["result"]
    assert len(r["layers"]) == 1 and r["subjects"] == []


def test_normalise_limits_size_and_rotates():
    big = photo(3000, 1500)
    assert pipeline.normalise(big).shape == (1024, 2048, 3)
    img = Image.new("RGB", (300, 100), "red")
    exif = img.getexif()
    exif[0x0112] = 6  # rotate 90°
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    assert pipeline.normalise(buf.getvalue()).shape == (300, 100, 3)
    with pytest.raises(pipeline.BadImage):
        pipeline.normalise(b"not an image")


def test_band_count_follows_the_depth_structure():
    two = np.r_[np.full(500, 0.1), np.full(500, 0.9)]
    assert pipeline.band_count(two)[0] == 2
    three = np.r_[np.full(300, 0.1), np.full(300, 0.5), np.full(300, 0.9)]
    assert pipeline.band_count(three)[0] == 3
    assert pipeline.band_count(np.linspace(0, 1, 1000))[0] == 4


@pytest.fixture(scope="module")
def client():
    main.start(loader=fake_models, warm=False)
    with TestClient(main.app) as c:
        yield c


def wait(client, job_id):
    for _ in range(200):
        j = client.get(f"/jobs/{job_id}").json()
        if j["status"] in ("done", "failed"):
            return j
        time.sleep(0.05)
    raise AssertionError("job never finished")


def test_api_runs_a_job_and_serves_its_layers(client):
    res = client.post("/analyse", files={"image": ("p.png", photo(fmt="PNG"), "image/png")})
    assert res.status_code == 202
    j = wait(client, res.json()["job_id"])
    assert j["status"] == "done", j
    layers = j["result"]["layers"]
    assert layers[0]["url"].endswith("/files/layer-0.webp")
    f = client.get(layers[-1]["url"])
    assert f.status_code == 200 and f.headers["content-type"] == "image/webp"
    assert client.get(f"/jobs/{res.json()['job_id']}/files/../../etc/passwd").status_code == 404
    assert client.get("/jobs/nope").status_code == 404


def test_api_reports_unreadable_pictures(client):
    res = client.post("/analyse", files={"image": ("x.jpg", b"hello", "image/jpeg")})
    j = wait(client, res.json()["job_id"])
    assert j["status"] == "failed" and "picture" in j["error"]
    assert client.post("/analyse", files={"image": ("x.jpg", b"", "image/jpeg")}).status_code == 400
