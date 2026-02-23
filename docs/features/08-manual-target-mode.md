# Manual Target Mode

## Purpose
Let the user override auto-exploration and direct the bot to a chosen destination.

## How it works
- Double-click sets manual target.
- Clicking a platform creates a strategic lock on that platform ID.
- Locked platform targets still use graph routing, so bot can take intermediate steps.
- Manual targets are stored in page coordinates and translated each tick by scroll offset.
- This keeps the intended target stable relative to document content while scrolling.
- Auto target scoring/picking stays paused until manual mode is cleared.

## Use cases
- Validate pathfinding around difficult geometry.
- Force-test specific climbs or routes.
- Reproduce edge-case failures at exact locations.

## Key files
- `packages/runtime/src/index.ts`
- `packages/runtime/src/brain.ts`
