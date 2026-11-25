# @interlacejs/hls-adapter

## 0.3.0

### Minor Changes

- f8b63d4: New `refreshSource` option: when signed URLs expire (a 401/403 from the stream, hls.js giving up on a network error, or a plain or fallback video failing to load), the adapter fetches fresh ones and reloads from the same position and play state.

## 0.2.0

### Minor Changes

- c7fa8c1: New package: `HlsVideoAdapter`, an HLS `VideoAdapter` built on hls.js (peer dependency). It extends `NativeVideoAdapter`, exposes the stream's quality levels (deduped by height, highest first) with an optional remembered preference, plays HLS natively on Safari/iOS, and falls back to an MP4 `fallbackSrc` on unsupported browsers or unrecoverable errors while keeping the playback position.

### Patch Changes

- Updated dependencies [c7fa8c1]
  - @interlacejs/core@0.3.0
  - @interlacejs/native-adapter@0.0.6
