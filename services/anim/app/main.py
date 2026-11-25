"""Processing service for animated photos: turns a photo into depth layers for the site engine's player.

  POST /analyse                  multipart field "image"  →  202 { job_id }
  GET  /jobs/{id}                →  { status: queued|running|done|failed, progress, error?, result? }
  GET  /jobs/{id}/files/{name}   →  a layer (image/webp), named in result.layers[].src
  GET  /health                   →  { ok, ready }

Jobs run one at a time on a worker thread (the models use every CPU core anyway) and are kept in memory for
JOB_TTL seconds. Only the engine should reach this service: keep it on the stack's internal network."""

import ctypes
import gc
import os
import queue
import re
import threading
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Response, UploadFile

from . import pipeline

MAX_UPLOAD = int(os.environ.get("MAX_UPLOAD_MB", "30")) * 1024 * 1024
JOB_TTL = int(os.environ.get("JOB_TTL", "3600"))
MAX_QUEUED = int(os.environ.get("MAX_QUEUED", "20"))


@asynccontextmanager
async def lifespan(_app):
    if state["loader"] is None:
        start()
    yield


app = FastAPI(title="gleam anim service", lifespan=lifespan)
jobs = {}
lock = threading.Lock()
work = queue.Queue()
state = {"models": None, "loader": None, "error": None}


def load_models():
    """Model classes, loaded per step by the pipeline (low memory); with ANIM_KEEP_MODELS=1, loaded once and kept."""
    from .models import load_models as load

    classes = load()
    if os.environ.get("ANIM_KEEP_MODELS", "").lower() in ("1", "true", "yes"):
        return {k: cls() for k, cls in classes.items()}
    return classes


def models():
    if state["models"] is None:
        state["models"] = state["loader"]()
    return state["models"]


def worker():
    while True:
        job_id = work.get()
        job = jobs.get(job_id)
        if job is None:
            continue
        data = job.pop("data")
        job["status"] = "running"
        try:
            out = pipeline.analyse(data, models(), progress=lambda p: job.__setitem__("progress", round(p, 2)))
            job.update(status="done", progress=1.0, result=out["result"], files=out["files"])
        except pipeline.BadImage as e:
            job.update(status="failed", error=f"That file is not a picture the service can read ({e}).")
        except Exception as e:  # noqa: BLE001 - report every failure to the caller rather than losing the job
            job.update(status="failed", error=f"Processing failed: {type(e).__name__}: {e}")
        job["finished"] = time.time()
        release_memory()


def release_memory():
    """Hands memory freed by the models back to the system, so an idle service stays small."""
    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except (OSError, AttributeError):
        pass


def purge():
    cutoff = time.time() - JOB_TTL
    with lock:
        for k in [k for k, j in jobs.items() if j.get("finished", time.time()) < cutoff]:
            del jobs[k]


def start(loader=load_models, warm=True):
    """Starts the worker thread. warm=True loads the models (or checks they're there) straight away."""
    state["loader"] = loader
    threading.Thread(target=worker, daemon=True, name="anim-worker").start()
    if warm:
        def warmup():
            try:
                models()
            except Exception as e:  # noqa: BLE001
                state["error"] = str(e)
        threading.Thread(target=warmup, daemon=True, name="anim-warmup").start()


@app.get("/health")
def health():
    return {"ok": state["error"] is None, "ready": state["models"] is not None, "error": state["error"]}


@app.post("/analyse", status_code=202)
async def analyse(image: UploadFile = File(...)):
    purge()
    data = await image.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "The picture is too large.")
    if not data:
        raise HTTPException(400, "No picture was sent.")
    if work.qsize() >= MAX_QUEUED:
        raise HTTPException(503, "Too many pictures waiting; try again shortly.")
    job_id = uuid.uuid4().hex
    with lock:
        jobs[job_id] = {"status": "queued", "progress": 0.0, "data": data, "created": time.time()}
    work.put(job_id)
    return {"job_id": job_id}


def _job(job_id):
    job = jobs.get(job_id) if re.fullmatch(r"[0-9a-f]{32}", job_id) else None
    if job is None:
        raise HTTPException(404, "No such job.")
    return job


@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    purge()
    job = _job(job_id)
    out = {"status": job["status"], "progress": job["progress"]}
    if job["status"] == "failed":
        out["error"] = job["error"]
    if job["status"] == "done":
        out["result"] = {**job["result"], "layers": [{**l, "url": f"/jobs/{job_id}/files/{l['src']}"} for l in job["result"]["layers"]]}
    return out


@app.get("/jobs/{job_id}/files/{name}")
def job_file(job_id: str, name: str):
    job = _job(job_id)
    data = job.get("files", {}).get(name)
    if data is None:
        raise HTTPException(404, "No such file.")
    return Response(data, media_type="image/webp")
