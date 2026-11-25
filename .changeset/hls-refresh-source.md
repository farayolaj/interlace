---
"@interlacejs/hls-adapter": minor
---

New `refreshSource` option: when signed URLs expire (a 401/403 from the stream, hls.js giving up on a network error, or a plain or fallback video failing to load), the adapter fetches fresh ones and reloads from the same position and play state.
