# World Index and Live Sync

## Purpose
Keep a fast, queryable, up-to-date collider world.

## How it works
- Stores colliders in a uniform-grid spatial index.
- Caps collider count at `1500` and truncates beyond cap.
- Supports full rescans and throttled rescans.
- On page scroll, shifts collider coordinates by scroll delta.
- Uses `MutationObserver` and `ResizeObserver` to react to layout/DOM changes.
- Provides LOS queries (`hasLineOfSight`) for planning and scoring.

## Key files
- `packages/runtime/src/world.ts`
