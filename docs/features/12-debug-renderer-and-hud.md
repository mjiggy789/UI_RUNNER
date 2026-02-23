# Debug Renderer and HUD

## Purpose
Visualize world geometry and bot calculations for diagnosis and tuning.

## What it can render
- Collider bounds and collider IDs.
- Brain state label above bot.
- Target marker and intent line.
- Predicted trajectory and ghost air-jump arc.
- Route links from step target to final target.
- Steering diagnostics: nav target line, deadzone, sticky band, move-direction arrow.
- Probe overlays: wall, overhead/ceiling, ceiling-escape walls, gap probe, drop edge, air-tuck probe.
- Tic-tac overlays: corridor width, eligibility, active direction.
- Input/facing vector.
- Debug HUD with live calculation values and optional timer breakdown.

## Toggle model
- All overlays are independently toggleable in settings.
- A debug master switch gates all overlay rendering.

## Compatibility note
- Uses `roundRect` when available; falls back to `rect` on older browsers.

## Key files
- `packages/runtime/src/renderer.ts`
- `packages/runtime/src/index.ts`
- `packages/runtime/src/brain.ts`
