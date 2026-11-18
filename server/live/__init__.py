"""Python live harness (lane T): replaces the Node scripts/live.mjs. Real Deepgram + Anthropic, run with
`make docker-live` (VC_BASE points at the app container). Speaks RTVI over the Protobuf WebSocket like the browser
does, streams test/fixtures/*.wav at real time, and checks every vc.* message against vc.protocol. See docs/LANES.md."""
