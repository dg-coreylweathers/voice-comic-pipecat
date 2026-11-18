"""`python -m vc`: run the service with uvicorn (one process, one event loop; bots run as tasks on it)."""

import uvicorn

from vc.config import load_config
from vc.logs import configure_logging


def main() -> None:
    cfg = load_config()
    configure_logging(cfg)
    uvicorn.run(
        "vc.app:create_app",
        factory=True,
        host="0.0.0.0",
        port=cfg.port,
        log_level="warning" if cfg.booth_mode else "info",
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()
