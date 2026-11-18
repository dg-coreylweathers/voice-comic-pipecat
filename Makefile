# Voice Comic on Pipecat. Host targets need uv (it fetches Python 3.12 itself) and Node 24.
# docker-* targets need only Docker and are what reviewers run.
.PHONY: install test test-server test-web typecheck lint build docker-build docker-test docker-run docker-live docker-browser shot clean

IMAGE      ?= voice-comic-pipecat:dev
UV_IMAGE   ?= ghcr.io/astral-sh/uv:0.9.9-python3.12-bookworm-slim
NODE_IMAGE ?= node:24-slim
PW_IMAGE   ?= mcr.microsoft.com/playwright:v1.62.1-noble
ENV_FILE   ?= .env
PORT       ?= 8080

install:
	cd server && uv sync
	cd web && npm ci
	npm ci --ignore-scripts

test: test-server test-web
test-server:
	cd server && uv run pytest -q
test-web:
	cd web && npm test

typecheck: lint
	cd web && npm run typecheck
lint:
	cd server && uv run ruff check . && uv run ruff format --check .

build:
	cd web && npm run build

# ---- Docker gates -----------------------------------------------------------------------------------------------
docker-build:
	docker build -t $(IMAGE) .

# Unit tests + lint + typecheck + client build, each in a clean container. No API keys, no network after install.
docker-test:
	docker run --rm -v "$(CURDIR)":/src -v vcp_venv:/venv -e UV_PROJECT_ENVIRONMENT=/venv -w /src/server $(UV_IMAGE) \
	  sh -c "uv sync --frozen -q && uv run --no-sync ruff check . && uv run --no-sync ruff format --check . && uv run --no-sync pytest -q"
	docker run --rm -v "$(CURDIR)":/src -v vcp_web_nm:/src/web/node_modules -w /src/web $(NODE_IMAGE) \
	  sh -c "npm ci --no-audit --no-fund && npm test && npm run typecheck && npm run build"

# The built image with your keys, on http://localhost:$(PORT).
docker-run: docker-build
	docker run --rm -it --env-file $(ENV_FILE) -p $(PORT):8080 -v vcp_data:/data $(IMAGE)

# Real Deepgram + Anthropic. Python live harness (lane T) against the built image. Needs DEEPGRAM_API_KEY + ANTHROPIC_API_KEY in .env.
docker-live: docker-build
	-docker rm -f vcp-live >/dev/null 2>&1
	docker network create vcp-net >/dev/null 2>&1 || true
	docker run -d --rm --name vcp-live --network vcp-net --env-file $(ENV_FILE) -e BOOTH_MODE= $(IMAGE)
	docker run --rm --network vcp-net -v "$(CURDIR)":/src -v vcp_venv:/venv -e UV_PROJECT_ENVIRONMENT=/venv -w /src/server \
	  -e VC_BASE=http://vcp-live:8080 $(UV_IMAGE) sh -c "uv sync --frozen -q && uv run --no-sync python -m live" ; \
	  status=$$?; docker rm -f vcp-live >/dev/null; exit $$status

# Headless Chromium with a fake mic (scripts/browser.mjs, lane T) against the built image.
docker-browser: docker-build
	-docker rm -f vcp-app >/dev/null 2>&1
	docker network create vcp-net >/dev/null 2>&1 || true
	docker run -d --rm --name vcp-app --network vcp-net --env-file $(ENV_FILE) -e BOOTH_MODE= $(IMAGE)
	docker run --rm --network vcp-net --ipc=host -v "$(CURDIR)":/src -v vcp_root_nm:/src/node_modules -w /src \
	  -e VC_LOCAL_BASE=http://vcp-app:8080 $(PW_IMAGE) sh -c "npm ci --ignore-scripts --no-audit --no-fund && node scripts/browser.mjs" ; \
	  status=$$?; docker rm -f vcp-app >/dev/null; exit $$status

# Screenshot a route or a strip fixture against the built image: make shot ROUTE=/cast OUT=test/shots/cast.png
ROUTE ?= /
OUT   ?= test/shots/shot.png
shot: docker-build
	-docker rm -f vcp-shot >/dev/null 2>&1
	docker network create vcp-net >/dev/null 2>&1 || true
	docker run -d --rm --name vcp-shot --network vcp-net $(IMAGE)
	docker run --rm --network vcp-net --ipc=host -v "$(CURDIR)":/src -v vcp_root_nm:/src/node_modules -w /src \
	  -e VC_LOCAL_BASE=http://vcp-shot:8080 $(PW_IMAGE) sh -c "npm ci --ignore-scripts --no-audit --no-fund && mkdir -p $(dir $(OUT)) && node scripts/shot.mjs $(ROUTE) $(OUT)" ; \
	  status=$$?; docker rm -f vcp-shot >/dev/null; exit $$status

clean:
	rm -rf web/dist server/.pytest_cache server/.ruff_cache test/shots
