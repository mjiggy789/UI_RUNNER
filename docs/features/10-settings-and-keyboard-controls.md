# Settings and Keyboard Controls

## Purpose
Provide live runtime control and fine-grained debug inspection without external tooling.

## Keyboard controls
- `D`: Toggle debug-visualization master switch.
- `S`: Open/close settings modal.
- `R`: Respawn bot and reset brain/controller state.

## Settings modal toggles
### Behavior
- Strict Mode
- Manual Mode
- Real Website Mode

### Debug visualizations
- Debug Visualizations (master)
- Collider Bounds
- Collider IDs
- State Label
- Target Intent
- Trajectory Preview
- Route Links
- Steering Math
- Collision Probes
- Tic-Tac Logic
- Input Vector
- Debug HUD
- Timer Breakdown

## Notes
- Enabling any individual visualization auto-enables debug master.
- Settings overlay is `data-bot-ignore` so it is never sampled as geometry.

## Key files
- `packages/runtime/src/index.ts`
- `packages/runtime/src/renderer.ts`
