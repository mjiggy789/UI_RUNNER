# Math Models Used in This Project

## Purpose
This document summarizes the math foundations for runtime movement, collision handling, pathfinding, trajectory estimation, and scoring.

## 1) Coordinate System and Units
- Simulation is in viewport-space CSS pixels.
- `x` grows right, `y` grows downward.
- Velocity units are px/s.
- Time is seconds from frame `dt`.
- Runtime uses fixed substeps (`dt <= 1/60`) for stable collision resolution.

### Key Physics Constants
- `GRAVITY = 1500 px/s²`
- `TERMINAL_VELOCITY = 1000 px/s`
- `MOVE_SPEED = 350 px/s` (Air: 350 px/s)
- `JUMP_SPEED = 600 px/s` (Initial impulse)
- `AIR_ACCEL = 800 px/s²` (Steering authority)
- `WALL_KICK_SPEED = 525 px/s`
- `MAX_TOTAL_JUMPS = 3` (1 ground + 2 air)

## 2) Kinematic Movement Model
- **Gravity**: `vy = min(vy + GRAVITY * dt, TERMINAL_VELOCITY)`
- **Position**:
  - `x = x + vx * dt`
  - `y = y + vy * dt`
- **Ground Friction**:
  - `vx = vx * DAMPING^(dt * 60)` (where DAMPING ≈ 0.82)
- **Air Steering**:
  - Applies bounded acceleration (`AIR_ACCEL`) toward desired direction.
  - Clamped to `MOVE_SPEED` unless external forces (bumpers/explosions) exceed it.

## 3) Collision Math (AABB)
- Bot and colliders are Axis-Aligned Bounding Boxes (AABB).
- **Intersection Test**:
  - `a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1`
- **Resolution**:
  - Separation is Axis-Separate (X then Y).
  - **One-Way Platforms**: Only solid when `vy > 0` and `bottom_prev <= top_platform`.
- **Ceiling Bonk**:
  - Vertical collision with a solid block zeros out `vy` immediately.

## 4) Navigation Process: Band Generation
The planner generates valid "maneuver edges" between platforms by simulating physics trajectories.

### A. Scanning (`findManeuverBands`)
1. **Source Scan**: The planner iterates along the edge of the source platform (`takeoffMin` to `takeoffMax`).
2. **Trajectory Simulation**: For each sample point `tx`, it simulates a ballistic arc using:
   - `vx = facing * speed` (Testing speeds: 0, 120, 220, 320, 350, 525)
   - `vy_initial = -600`
   - `gravity = 1500`
3. **Intersection**: It checks if the parabola intersects the target platform's top surface (`landingY`) within a valid range.
4. **Validation**:
   - **Headroom**: Is there space to jump?
   - **Line of Sight**: Is the straight line from `tx` to `lx` clear of obstacles?
   - **Travel Clearance**: Does the full body fit along the arc?

### B. Band Merging
- Valid samples are aggregated into continuous "bands": `[takeoffMinX, takeoffMaxX] -> [landingMinX, landingMaxX]`.
- This creates a robust "launch window" rather than a single pixel-perfect point.

## 5) Local Solver Process
When the pre-computed graph fails (due to dynamic obstacles or edge cases), the `LocalSolver` attempts to synthesize a solution on the fly.

1. **Search Radius**: Scans strictly local colliders (`380px` horiz, `250px` vert).
2. **Ad-Hoc Edge Generation**:
   - Reuses `buildManeuverEdge` logic to generate temporary edges to all nearby reachable surfaces.
   - Bypasses graph connectivity checks (assumes "blind" jump).
3. **Scoring**:
   - Penalizes difficult jumps (e.g., precise landings).
   - Bonuses for vertical gain (climbing) or distance-to-target reduction.
4. **Execution**: If a valid local edge is found, it is injected into the active execution pipeline immediately.

## 6) Trajectory Prediction (`predictTrajectory`)
Used for runtime safety checks and "Abort" decisions.

- **Steps**: 45 iterations (approx 1.5 seconds).
- **Time Step**: Fixed `1/30s`.
- **Logic**:
  - Simulates gravity and air drag.
  - Steers towards the target X (simple P-controller).
  - Stops on first solid collision.
- **Outcome**: Returns the final `(landingX, landingY)`. If this point misses the target platform, the bot may abort the jump mid-air or trigger a reroute.

## 7) Target Scoring
Route choice uses weighted probabilistic sampling (Softmax).

- `Score = 50 (base)`
- **Distance**: -18 (too close) to +18 (medium-far).
- **Vertical**: +12 to +35 (climbing preference).
- **Novelty**: -8 per previous visit (avoids loops).
- **Exploration**: +20 if above highest-reached point.
- **Probability**: `P(i) ∝ exp((score_i - maxScore) / T)`

## 8) Loop Detection Metrics
- **Stall Timer**: Accumulates when `vx` is low but input is active.
- **Facing Flips**: Counts rapid Left/Right switches (ping-ponging).
- **Progress Scalar**: Measures improvements in `(dx, dy, dist)` over a 36-frame window. If scalar < 4.0, progress is "Flat".
