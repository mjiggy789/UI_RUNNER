# System Architecture: Planner, Mover, and Diagnostics

The Parkour Bot runtime is built as a layered system: a DOM-to-physics world model, a graph planner, a reactive movement controller, and a debug/inspection pipeline.

## 1. World Model and Graph
- The runtime samples DOM elements into collider AABBs.
- Colliders are indexed in a uniform-grid spatial structure for fast queries.
- A navigation graph (`NavGraph`) treats platforms as nodes and movement options (walk/jump/drop) as directed edges.
- Failed or unreliable transitions are temporarily invalidated so the planner avoids repeating bad routes.

## 2. High-Level Planner
- Chooses candidate goals with multi-factor scoring (distance, vertical gain, novelty/repeat pressure, and reachability bias).
- Runs A* over the graph to produce a route.
- Splits routing into:
  - **Final target**: strategic destination.
  - **Step target**: immediate stepping-stone waypoint for execution.

## 3. Low-Level Mover (Brain + Controller)
- `Brain` computes input intents (`left/right/jump/down/up`) from current pose and route state.
- `Controller` applies physics and collisions with fixed-step substepping.
- Movement supports:
  - Ground run and crouch-slide.
  - Wall-slide, climb, and wall-hop breakouts.
  - Tic-tac wall-to-wall ascent in narrow vertical corridors.
  - Air tuck (height compression while airborne) to pass tight overhead slots.
  - Momentum-based maneuvers: Backup (seeking run-up distance) and Charge (sprinting for takeoff).
- Hitbox behavior is height-only compression (`20x40 -> 20x20`); width squeezing is not used.

## 4. Progress and Recovery
- Progress is measured by distance-to-target improvement, not just static timers.
- Loop detection tracks stall duration, facing flips, and repeated failed approaches.
- Recovery tools include reroute, breadcrumb rewind, and edge invalidation cooldowns.

## 5. Diagnostics Pipeline
- Brain emits a per-tick debug snapshot of calculations and probes.
- Runtime forwards snapshot data to the renderer.
- Renderer draws toggleable overlays (targeting, trajectory, steering bands, probes, tic-tac state, timers, HUD).
- Settings modal exposes per-overlay toggles so inspection can be narrowed to one system at a time.

## 6. Runtime Loop
- Main loop runs on `requestAnimationFrame`.
- Tick order is: manual-target anchor update -> brain think -> controller update -> renderer draw.
- Pausing disables movement updates while keeping runtime mounted.
