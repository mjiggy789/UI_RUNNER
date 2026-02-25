# System Architecture: Planner, Mover, and Diagnostics

The Parkour Bot runtime is built as a layered system: a DOM-to-physics world model, a graph planner, a reactive movement controller, and a debug/inspection pipeline.

## 1. World Model and Graph
- The runtime samples DOM elements into collider AABBs.
- Colliders are indexed in a uniform-grid spatial structure for fast queries.
- A navigation graph (`NavGraph`) treats platforms as nodes and movement options (walk/jump/drop) as directed edges.
- Failed or unreliable transitions are temporarily invalidated so the planner avoids repeating bad routes.

## 2. Navigation Layer (Planner + Solvers)
The navigation system is split into three tiers of responsibility:

- **Global Planner (`NavGraph`)**:
  - Runs A* over the pre-computed graph to find long-distance routes.
  - Generates a sequence of platforms (nodes) and specific maneuvers (edges).
- **Detour Planner**:
  - Handles mid-route interruptions (e.g., dynamic obstacles, unexpected blocks).
  - Finds temporary sub-targets to route around the blockage without abandoning the final goal.
- **Local Solver**:
  - A fallback system used when the graph fails or contains gaps.
  - Raycasts for immediate, physics-valid jumps to nearby surfaces ("blind" jumps).
  - Bypasses the pre-computed graph to find ad-hoc solutions.

## 3. Low-Level Mover (Brain + Controller)
- **Brain**: The decision engine. It consumes the route from the Planner layer and computes input intents (`left/right/jump/down/up`).
  - Manages state machines for complex actions (Tic-Tac, Wall Climb).
  - Handles "Micro-Navigation" (local obstacle avoidance, ceiling escape).
- **Controller**: The physics engine. Applies velocity, gravity, and collision resolution with fixed-step substepping.
- **Movement Capabilities**:
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
