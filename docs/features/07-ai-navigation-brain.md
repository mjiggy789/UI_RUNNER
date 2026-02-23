# AI Navigation Brain

## Purpose
Generate movement intent to autonomously traverse complex DOM geometry.

## Architecture

### 1) High-level planner
- Maintains `NavGraph` of platforms and traversable transitions.
- Scores targets by distance, vertical gain, novelty, and repeat penalties.
- Computes route with A* and assigns:
  - final strategic target
  - immediate stepping-stone subtarget
- **Initiation Behavior**: On spawn/respawn, the bot prioritizes finding and moving to the strictly closest solid surface to establish a "home base" before starting sequential exploration.

### 2) Low-level mover FSM
- `nav-align`: derive takeoff/approach intent and steering constraints.
- `nav-approach`: position into takeoff corridor. Includes **Backup phase** (moving away to gain run-up distance) and **Charge phase** (sprinting towards takeoff).
- `nav-ready`: settle alignment for jump commitment. Supports **Run-through jumps** (instant trigger when at high speed) to maintain momentum.
- `nav-commit`: execute jump, wall, or route transition action.

## Special traversal behavior
- Wall-slide/climb decisioning with cooldown and breakout guards.
- Tic-tac wall-to-wall climbing in narrow vertical corridors.
- Ceiling escape steering when upward path is blocked.
- Air tuck decisioning to compress height while airborne under low overhead clearance.

## Recovery and anti-loop systems
- Progress stagnation timer based on real distance improvement.
- Facing-flip and stall diagnostics for ping-pong detection.
- Temporary edge invalidation on failed transitions.
- Breadcrumb-based rewind to known-good platforms.

## Debug data output
- Emits a per-frame `debugSnapshot` containing:
  - steering math (`navTargetX`, `deadzone`, sticky band, moveDir)
  - probe geometry/results (wall, ceiling, gap, drop, air tuck)
  - tic-tac eligibility/active timers
  - state machine and cooldown timers
- Snapshot is forwarded to renderer for toggleable overlays.

## Key files
- `packages/runtime/src/brain.ts`
- `packages/runtime/src/planner.ts`
- `packages/runtime/src/world.ts`
