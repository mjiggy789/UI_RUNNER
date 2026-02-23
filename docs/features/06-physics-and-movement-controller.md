# Physics and Movement Controller

## Purpose
Simulate bot movement and collisions in viewport-space.

## How it works
- Fixed-step substepping reduces tunneling at low frame rates.
- Applies gravity, terminal velocity, damping, and bounded air control.
- Movement states: `idle`, `run`, `jump`, `fall`, `wall-slide`, `double-jump`, `triple-jump`, `slide`, `climb`.
- Wall systems:
  - wall-slide friction and capped descent speed
  - climb with stall detection and forced breakout hop
  - immediate re-entry guard after stall-kick
- Crouch/slide and airborne tuck are height-based body compression (`20x40` to `20x20`).
- Width remains fixed at `20` (no squeeze-mode width shrinking).
- One-way platforms support jump-through/drop-through rules.
- Collisions resolve axis-by-axis with overlap correction.
- Tracks `groundedId` for precise support identity.
- Respawns to spawn point if bot falls below screen bounds.

## Key files
- `packages/runtime/src/controller.ts`
