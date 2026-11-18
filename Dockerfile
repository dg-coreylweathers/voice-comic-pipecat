# syntax=docker/dockerfile:1.7
# Voice Comic on Pipecat: build the React client with Node, run one Python service (FastAPI + uvicorn) that serves it,
# hosts a Pipecat pipeline per WebSocket, and stores strips in SQLite on /data.

# ---- 1. client ------------------------------------------------------------------------------------------------
FROM node:24-slim AS web
WORKDIR /app
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci --ignore-scripts --no-audit --no-fund
COPY shared ./shared
COPY web ./web
RUN cd web && npm run build

# ---- 2. runtime -----------------------------------------------------------------------------------------------
FROM python:3.12-slim AS runtime
COPY --from=ghcr.io/astral-sh/uv:0.9.9 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    HF_HOME=/opt/hf \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    DATA_DIR=/data
WORKDIR /app/server

# Dependencies first (cached layer), then the project.
COPY server/pyproject.toml server/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY server/vc ./vc
RUN uv sync --frozen --no-dev
COPY shared /app/shared

# Bake the perception models (public Hugging Face repos, no token) so the first visitor never waits on a download.
RUN /app/.venv/bin/python -m vc.prefetch && chmod -R a+rX /opt/hf
ENV HF_HUB_OFFLINE=1

COPY --from=web /app/web/dist /app/web/dist

RUN useradd --system --uid 10001 --home /app app && mkdir -p /data && chown app:app /data
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD ["/app/.venv/bin/python", "-c", "import os,sys,urllib.request; sys.exit(0 if urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8080\")}/health', timeout=2).status == 200 else 1)"]
CMD ["/app/.venv/bin/python", "-m", "vc"]
