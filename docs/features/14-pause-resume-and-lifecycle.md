# Pause, Resume, and Runtime Lifecycle

## Purpose
Control runtime execution safely while preserving mount integrity.

## How it works
- Floating action button toggles pause/resume (`enabled` state).
- Paused state hides canvas and skips movement/render updates.
- Runtime keeps a single active instance and cleans up on `stop()`.
- Pause FAB is tagged `data-bot-ignore`, so it never becomes a collider surface.

## Key files
- `packages/runtime/src/mount.ts`
- `packages/runtime/src/index.ts`
- `packages/runtime/src/sampler.ts`
