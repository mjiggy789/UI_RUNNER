# Strict Mode

## Purpose
Increase commitment to current target before abandoning route.

## How it works
- Toggled from runtime settings modal.
- Strict mode raises tolerance for retries before giving up.
- Non-strict mode abandons sooner when movement appears stuck.
- Debug HUD shows strict status and current retry attempt count.

## Key files
- `packages/runtime/src/index.ts`
- `packages/runtime/src/brain.ts`
- `packages/runtime/src/renderer.ts`
