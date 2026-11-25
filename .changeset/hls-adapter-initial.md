---
"@interlacejs/hls-adapter": minor
---

New package: `HlsVideoAdapter`, an HLS `VideoAdapter` built on hls.js (peer dependency). It extends `NativeVideoAdapter`, exposes the stream's quality levels (deduped by height, highest first) with an optional remembered preference, plays HLS natively on Safari/iOS, and falls back to an MP4 `fallbackSrc` on unsupported browsers or unrecoverable errors while keeping the playback position.
