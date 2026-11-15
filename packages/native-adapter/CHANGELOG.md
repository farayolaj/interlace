# @interlace/native-adapter

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
