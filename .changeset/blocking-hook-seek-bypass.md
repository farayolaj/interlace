---
"@interlacejs/core": patch
"@interlacejs/native-adapter": patch
"@interlacejs/player": patch
---

Stop blocking hooks from being skipped by seeking past them. The controller now detects any forward jump past unfinished blocking content on `tick` (seeks whose event arrives after a tick has read the new time, scrubbing while paused, and dropped frames), then opens the content, pauses and seeks back to it.

Seeks made through `adapter.seek()` (such as resuming from a saved position) are not treated as skips: adapters now emit a synchronous `programmaticSeek` event, which the player forwards to the new `controller.setPosition()`. Custom adapters should emit `programmaticSeek` from `seek()`.
