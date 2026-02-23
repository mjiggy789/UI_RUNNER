# Math Models Used in This Project

## Purpose
This document summarizes the math foundations for runtime movement, collision handling, pathfinding, trajectory estimation, and scoring.

## 1) Coordinate System and Units
- Simulation is in viewport-space CSS pixels.
- `x` grows right, `y` grows downward.
- Velocity units are px/s.
- Time is seconds from frame `dt`.
- Runtime uses fixed substeps (`dt <= 1/60`) for stable collision resolution.

## 2) Kinematic Movement Model
- Gravity:
`vy = min(vy + GRAVITY * dt, TERMINAL_VELOCITY)`
- Position:
`x = x + vx * dt`
`y = y + vy * dt`
- Ground damping:
`vx = vx * DAMPING^(dt * 60)`
- Air steering applies bounded acceleration toward desired horizontal speed.

### Key constants (`packages/runtime/src/controller.ts`)
- `GRAVITY = 1500`
- `TERMINAL_VELOCITY = 1000`
- `MOVE_SPEED = 350`
- `JUMP_FORCE = -600`
- `MAX_TOTAL_JUMPS = 3`
- `DOUBLE_JUMP_FORCE_MULT = 1.15`, `TRIPLE_JUMP_FORCE_MULT = 1.05`

## 3) Hitbox Transform Model
- Base body dimensions are `20x40`.
- Crouch/slide and airborne tuck use `20x20` (height compression only).
- Width is not dynamically squeezed.
- Feet anchor is preserved during height changes:
`y = y + (oldHeight - newHeight)`

## 4) Collision Math (AABB)
- Bot and colliders are AABBs.
- Intersection test:
`a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1`
- Overlap depths:
`overlapX = min(a.x2, b.x2) - max(a.x1, b.x1)`
`overlapY = min(a.y2, b.y2) - max(a.y1, b.y1)`
- Resolution runs axis-by-axis (X then Y).
- One-way platforms are only solid when falling from above.

## 5) Spatial Index and LOS
- World uses uniform grid cells (`CELL_SIZE = 120`).
- Collider insertion/query maps AABBs to cell ranges via `floor(coord / CELL_SIZE)`.
- Line-of-sight (LOS) samples points along a segment:
`steps = ceil(distance / 35)`
`p(t) = (x1 + dx*t, y1 + dy*t)`.
- Any non-one-way solid hit breaks LOS.

## 6) Navigation Graph and A*
- Nodes are platforms; edges are candidate traversals.
- Geometry terms:
`dx = horizontal gap`
`dy = sourceTopY - targetTopY`.
- Representative edge costs (`packages/runtime/src/planner.ts`):
- `walk`: `dx + 10` for near-level close transitions
- `jump-gap`: `dx * 1.5 + 50`
- `jump-high`: `hypot(dx, dy) * 2 + 100`
- `drop/jump-down`: `hypot(dx, -dy) * 0.5`
- Heuristic biases strongly upward when below goal:
`h = abs(cx - tx) + upPenalty`

## 7) Jump Gauge Approximation
- Gauged jumps are solved by a time sweep over `t` in `[0.16, 0.66]`.
- Required launch speed:
`requiredJumpSpeed = (heightDiff / t) + 0.5*g*t`
- Gauge:
`gauge = requiredJumpSpeed / fullJumpSpeed`
- Candidate accepted if gauge and horizontal error score are in bounds.

## 8) Trajectory Prediction
- Brain simulates a short forward trajectory window using gravity + steering bounds.
- Stops when blocked or out of practical bounds.
- Predicted landing is used for reroute/abort decisions and candidate filtering.

## 9) Takeoff Zone Search
- For high jumps, brain scans local takeoff samples on source platform.
- Candidate must pass:
- LOS check to landing region.
- Ceiling clearance probe above takeoff.
- First viable result defines a small takeoff interval.

## 10) Target Scoring and Selection
- Score combines distance, vertical gain, novelty, repeat penalties, fairness, LOS bonus, and shape heuristics.
- Route choice uses weighted probabilistic sampling:
`P(i) ∝ exp((score_i - maxScore)/T)`
with temperature adjusted to encourage exploration.

## 11) Loop/Stall Detection
- Progress baseline:
`bestProgressDist = min(bestProgressDist, hypot(targetDx, targetDy))`
- Additional loop metrics include low displacement, rapid facing flips, and repeated failed transitions.
- System can reroute, invalidate graph edges, or recover to breadcrumbs.

## 12) Probe-Based Micro-Decisions
- Brain evaluates local AABB probes for:
- wall contacts
- overhead/ceiling blocking
- gap detection
- drop-edge planning
- tic-tac corridor width
- airborne tuck eligibility
- These probe outputs are mirrored into debug snapshot for visualization.

## Key files
- `packages/runtime/src/controller.ts`
- `packages/runtime/src/brain.ts`
- `packages/runtime/src/planner.ts`
- `packages/runtime/src/world.ts`
- `packages/runtime/src/sampler.ts`
- `packages/runtime/src/renderer.ts`
