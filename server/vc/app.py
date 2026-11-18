"""FastAPI application factory. Owned by lane S2 (HTTP), except the WebSocket handler body, which hands off to
lane S1's `vc.pipeline.bot.run_bot`.

Scaffold state: /health, the JSON 404 for unknown /api paths and the static client work. Everything marked
TODO(S2)/TODO(S1) is specified in docs/LANES.md.
"""

from __future__ import annotations

import time

from fastapi import FastAPI, WebSocket
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from vc.config import Config, load_config
from vc.paths import DIST_DIR

_STARTED = time.monotonic()


def create_app(config: Config | None = None) -> FastAPI:
    cfg = config or load_config()
    app = FastAPI(title="voice-comic-pipecat", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.config = cfg

    @app.get("/health")
    async def health() -> dict:
        return {"ok": True, "uptime": round(time.monotonic() - _STARTED, 1)}

    # TODO(S2): app.include_router(vc.api.router) -> /api/session, /api/catalog, /api/themes(.csv), /api/strips...
    # TODO(S2): lifespan: open Store + Themes, aiohttp.ClientSession, purge task every 15 min; build BotDeps.

    @app.websocket("/api/agent")
    async def agent(ws: WebSocket) -> None:
        # TODO(S2): verify ws.query_params["token"] with vc.auth BEFORE accept (close 4401 otherwise), decode
        #   SessionConfig.from_query(ws.query_params["cfg"]) (close 4400 on error), check Origin if configured.
        # TODO(S1): await vc.pipeline.bot.run_bot(ws, session_config, app.state.deps)
        await ws.close(code=1013, reason="pipeline not implemented yet (lane S1)")

    @app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "DELETE"])
    async def api_404(rest: str) -> JSONResponse:
        return JSONResponse({"error": "not_found"}, status_code=404)

    if DIST_DIR.is_dir():
        if (DIST_DIR / "assets").is_dir():
            app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
        index = DIST_DIR / "index.html"

        @app.get("/{path:path}", include_in_schema=False)
        async def spa(path: str):
            # Any extension-less path renders the SPA (routes live in web/src/App.tsx); real files are served as-is.
            f = (DIST_DIR / path).resolve()
            if path and "." in path.rsplit("/", 1)[-1]:
                if f.is_file() and DIST_DIR.resolve() in f.parents:
                    return FileResponse(f)
                return JSONResponse({"error": "not_found"}, status_code=404)
            return FileResponse(index)

    return app
