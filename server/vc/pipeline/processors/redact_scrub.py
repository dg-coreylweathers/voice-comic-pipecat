"""RedactScrub: while Redact is on, the browser must not receive the unredacted Flux text of the visitor. The Nova
layer (VcLayer) carries the redacted words. This processor marks/rewrites what RTVI emits as user-input (or the
observer is configured so) to "[redacted: see transcript layer]"; it never changes what reaches Claude.
Exact mechanism (frame rewrite vs RTVIObserver subclass) is the S1 builder's call; acceptance is in LANES.md."""
