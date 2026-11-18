"""HTTP routes (port of server/index.js). Lane S2. Mounted by app.py.

GET  /api/session                 -> {"token"}            rate 20/min/IP
GET  /api/catalog                 -> vc.catalog.public_catalog(...)
GET  /api/themes[?event=&days=]   -> summary + events
GET  /api/themes.csv[?event=]     -> text/csv attachment voice-comic-themes-{event}.csv
POST /api/strips                  -> 201 {id, url:/s/{id}, booth, createdAt[, expiresAt]}  rate 12/min, 5 MB,
                                     validate (panels 1..200, title<=120, events<=20000, resets<=200 numbers);
                                     usage := deps.usage.get(body.sessionId) when present (server-metered);
                                     booth := BOOTH_MODE or body.booth; sanitize_strip(...)
PUT  /api/strips/{id}/audio       -> RIFF check, 403 in booth (deployment or strip), 404 missing; 25 MB
GET  /api/strips/{id}             -> 404 not_found | 404 expired (booth TTL) | strip (+expiresAt)
GET  /api/strips/{id}/audio       -> audio/wav, Cache-Control max-age=AUDIO_TTL, immutable
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api")
# TODO(S2): implement the routes above with tests in tests/test_api.py (httpx TestClient, temp DATA_DIR).
