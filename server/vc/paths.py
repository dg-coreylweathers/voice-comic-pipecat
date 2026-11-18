"""Where the shared contracts and the built client live. The repo layout is preserved in the Docker image
(/app/server, /app/shared, /app/web/dist), so the same relative paths work locally and in production."""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SHARED_DIR = Path(os.environ.get("VC_SHARED_DIR", REPO_ROOT / "shared"))
DIST_DIR = Path(os.environ.get("VC_DIST_DIR", REPO_ROOT / "web" / "dist"))
ASSETS_DIR = Path(__file__).resolve().parent / "assets"
