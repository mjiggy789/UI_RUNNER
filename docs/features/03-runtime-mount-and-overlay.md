# Runtime Mount and Overlay

## Purpose
Create a non-intrusive rendering layer over any website.

## How it works
- Inserts fixed host node (`#pk-bot-host`) with `pointer-events: none`.
- Uses Shadow DOM when available; iframe fallback otherwise.
- Creates full-screen canvas sized to viewport times device-pixel ratio.
- Handles resize via stable bound listener and cleanup on destroy.
- Creates pause/resume FAB with `pointer-events: auto` so users can control runtime.
- Runtime controls (FAB/settings/log overlays) are tagged `data-bot-ignore` to avoid collider sampling.

## Key files
- `packages/runtime/src/mount.ts`
- `packages/runtime/src/styles.ts`
- `packages/runtime/src/index.ts`
