"""Beat 2 wiring. Lane S1.

flux_stt.event_handler("on_eager_end_of_turn")(service, transcript) -> VcEager(phase="predicted")
flux_stt.event_handler("on_turn_resumed")(service)                  -> VcEager(phase="withdrawn", reason="turn_resumed")
The EagerObserver (observers/eager_observer.py) emits "withdrawn"(cancelled|timeout) on UserTurnResponseCancelFrame
and "released"(heldMs) on the first UserStoppedSpeakingFrame after a prediction.
"""
