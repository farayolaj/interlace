# @interlace/native-adapter

## 0.0.6

### Patch Changes

- Updated dependencies [c7fa8c1]
  - @interlacejs/core@0.3.0

## 0.0.5

### Patch Changes

- f0a2ccf: Stop blocking hooks from being skipped by seeking past them. The controller now detects any forward jump past unfinished blocking content on `tick` (seeks whose event arrives after a tick has read the new time, scrubbing while paused, and dropped frames), then opens the content, pauses and seeks back to it.

  Seeks made through `adapter.seek()` (such as resuming from a saved position) are not treated as skips: adapters now emit a synchronous `programmaticSeek` event, which the player forwards to the new `controller.setPosition()`. Custom adapters should emit `programmaticSeek` from `seek()`.

- Updated dependencies [f0a2ccf]
- Updated dependencies [8aabf79]
  - @interlacejs/core@0.2.0

## 0.0.4

### Patch Changes

- Fix published package entry points: the `exports` map pointed at `./src/index.ts`, which is not included in the published tarball (only `dist/` ships), breaking resolution in strict resolvers like Vite. The `exports` map now points at the built `dist` files with proper `types`/`import`/`require` conditions, and the `module` field no longer references a non-existent `dist/index.mjs`.
- Updated dependencies
  - @interlacejs/core@0.1.3

## 0.0.2

### Patch Changes

- Add per-package READMEs so every published npm page documents its install, its API surface, and where the full walkthrough lives.
- Updated dependencies
  - @interlacejs/core@0.1.1

## 0.0.1

### Patch Changes

- Updated dependencies [c2405af]
- Updated dependencies [bfccabf]
  - @interlace/core@0.1.0
