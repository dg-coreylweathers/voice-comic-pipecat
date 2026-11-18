"""Beat 1: the ONLY module that imports pipecat.expressive (alpha, pinned 1.16.0). Lane S1.

build_perception_reader() -> PerceptionReader(sources=[PipecatToneSource(), PipecatVoiceSource()])
Models load once per process (module-level cache) from the Hugging Face cache baked into the image
(HF_HOME=/opt/hf, HF_HUB_OFFLINE=1 at runtime). vc.prefetch downloads them at docker build time.
"""
