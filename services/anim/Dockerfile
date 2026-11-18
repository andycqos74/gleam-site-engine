# Processing service for animated photos (optional): separates a photo into depth layers so people move against
# the background. See README.md here and "Animated photos" in the main README.
#   docker build -t gleam-anim-service services/anim
#   docker build --target test services/anim        runs the tests (stand-in models, no weights needed)
# The model weights (~410 MB) are downloaded once, here, and baked into the image: nothing is fetched at runtime.
# The whole image is ~900 MB. It needs ~1 GB of memory while processing a photo and ~100 MB when idle.

FROM python:3.11-slim-bookworm AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MODELS_DIR=/models
WORKDIR /srv
COPY requirements.txt ./
RUN pip install -r requirements.txt

FROM base AS test
COPY requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
COPY app ./app
COPY tests ./tests
RUN python -m pytest -q tests

FROM base AS final
COPY download_models.py ./
RUN python download_models.py && chmod -R a+rX /models
COPY app ./app
RUN useradd --system --uid 10001 anim
USER anim
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
