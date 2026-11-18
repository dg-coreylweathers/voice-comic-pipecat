"""Download the perception models into the Hugging Face cache at `docker build` time, so the first visitor never
waits on a download and the runtime can set HF_HUB_OFFLINE=1. Public models, no token needed.

  uv run python -m vc.prefetch            # writes to $HF_HOME (Dockerfile: /opt/hf)

Variants/precisions match the PipecatVoiceSource / PipecatToneSource defaults used in vc.pipeline.perception
(voice: base int8, tone: fp16). If perception switches to `tiny`, prefetch it here too.
"""

from __future__ import annotations

import time


def main() -> None:
    from pipecat.classifiers.tone.model import PipecatToneReaderModel
    from pipecat.classifiers.voice.model import PipecatVoiceReaderModel

    for name, load in (
        ("voice-reader base/int8", lambda: PipecatVoiceReaderModel.download(variant="base", precision="int8")),
        ("tone-models fp16", lambda: PipecatToneReaderModel.download(precision="fp16")),
    ):
        t = time.monotonic()
        load()
        print(f"prefetched {name} in {time.monotonic() - t:.1f}s", flush=True)


if __name__ == "__main__":
    main()
