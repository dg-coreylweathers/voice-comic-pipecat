"""Service factories from catalog entries. Lane S1. Every Deepgram service gets mip_opt_out=deps.config.mip_opt_out.

- flux_stt(listen, cfg): DeepgramFluxSTTService(api_key, settings=Settings(model, eot_threshold,
  eager_eot_threshold, eot_timeout_ms, keyterm=cfg.keyterms, redact="numbers" if cfg.redact else None),
  enable_eager_end_of_turn=True)
- nova_stt(tap_listen, cfg, *, diarize): DeepgramSTTService(settings: model nova-3, language, interim_results,
  smart_format, redact=["pii","pci","numbers"] if cfg.redact, diarize, keyterm)
- tts_switcher(speak, cfg): ServiceSwitcher([DeepgramFluxTTSService(voice=flux default/selected),
  DeepgramTTSService(voice=aura default/selected)]); initial active = family of cfg.speak_key
- llm(think, prompt): AnthropicLLMService(api_key, settings=Settings(model, system_instruction=prompt,
  max_tokens, enable_prompt_caching=True, **thinking/effort from the catalog entry))
- llm_settings_for(think): the FULL settings delta for a live model switch (model + thinking + effort, the unused
  one explicitly cleared) so Haiku's effort never leaks into Sonnet 5.5 and vice versa.
"""
