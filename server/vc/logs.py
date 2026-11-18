"""Logging rules. Booth mode: loguru at WARNING so no transcript or bot text is ever logged
(Pipecat logs `Generating TTS [text]` at DEBUG), no TranscriptionLogObserver anywhere."""

import sys

from loguru import logger

from vc.config import Config


def configure_logging(cfg: Config) -> None:
    logger.remove()
    logger.add(sys.stderr, level="WARNING" if cfg.booth_mode else "INFO", backtrace=False, diagnose=False)
