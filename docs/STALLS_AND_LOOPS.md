# Failure Modes: Stalls and Ping-Pong Loops

This document analyzes known scenarios where the bot's navigation logic can fail, leading to repetitive "ping-ponging" between states or permanent "stalling" on a platform.

---

## 1. Physical & Environmental Stalls
These occur when the physics environment prevents the bot's intended movement from completing.

### A. The "Head-Bang" Stall
- **Trigger**: The bot targets a platform above it but has a solid ceiling directly overhead or in its jump arc.
- **Symptom**: Bot stands still or jumps repeatedly into the ceiling without gaining height.
- **Mitigation**: 
    1. `ceilingJumpSuppressTimer` and `ceilingBonkCount` detect repeated hits and force a reroute.
    2. Proactive Ceiling Detection: Bot checks the vertical space required for a jump based on target height difference before leaping.
    3. Trapped Ceiling Escape: If blocked while trying to reach a higher target, the bot forces horizontal movement to seek an opening ("ceiling exit") regardless of its original target direction.
- **Status**: Resolved. The bot now proactively avoids blocked arcs and seeks exits via `ceilingBonkCount` and `ceilingJumpSuppressTimer`.

### B. The "Narrow Corridor" Tic-Tac Trap
- **Trigger**: Bot is in a vertical corridor wide enough for physics but too narrow for the "horizontal velocity" requirement of a wall-jump.
- **Symptom**: Bot slides to the floor, immediately tries to tic-tac, fails to reach the next wall, and repeats.
- **Mitigation**: 
    1. `TIC_TAC_MIN_GAP_WIDTH` (65px) prevents attempts in excessively narrow shafts where single-wall climbing is more reliable.
    2. `ticTacStallTimer` detects if the bot is failing to gain vertical progress (y < bestY - 10px) over a 1.2s window and aborts the maneuver.
- **Status**: Resolved. Aborts failed attempts via `ticTacStallTimer` to allow fallback or path invalidation.

### C. One-Way "Down" Trap
- **Trigger**: Bot's target is significantly below it, but it's standing on a solid (not one-way) floor that spans the entire width of the gap.
- **Symptom**: Bot runs back and forth on the edge, looking for a way down that doesn't exist.
- **Mitigation**: 
    1. `EDGE_DROP_PLAN` stickiness increased (2.5s) to prevent oscillation between edges if one is slightly closer but blocked.
    2. `edge-drop-wall-hop` breakout: Bot will attempt to jump over low walls at the edge if it's stuck trying to drop.
    3. `EDGE_DROP_FAIL` detection: If the bot remains stuck at an edge for >2.5s, it invalidates the graph edge between the current platform and the target, forcing a reroute through a different exit.
- **Status**: Resolved. Prevents permanent loops in enclosed rooms by blacklisting unreachable paths via `EDGE_DROP_FAIL` detection.

---

## 2. Targeting & Pathfinding Loops
These occur when the high-level planner picks targets that are reachable in theory but fail in practice.

### A. The "Ghost Reachable" Path
- **Trigger**: The `NavGraph` thinks a jump is possible (Line-of-Sight is clear), but the specific acceleration/momentum curve of the physics controller misses the landing by a few pixels.
- **Symptom**: Bot jumps, falls back to the *start* platform, and immediately tries the same jump again.
- **Mitigation**: `invalidateEdge` on failure. If a transition fails (missed landing), that specific edge is blacklisted for 5 seconds.
- **Status**: Resolved. Managed via `invalidateActiveManeuver` and `BREADCRUMB_POP` logic.

---

## 3. Manual Mode & Collision Stalls

### A. The "Embedded Target" Stall
- **Trigger**: User clicks a component that is technically solid but buried inside another element or has no headroom.
- **Symptom**: Bot stands against the wall of the container, "vibrating" as it tries to move into the unreachable space.
- **Mitigation**: 
    1. Headroom and Burial checks in `pickNewTarget`.
    2. Manual Target Burial Adjustment: Clicking inside a solid block now automatically adjusts the target coordinate to the nearest safe surface above it.
- **Status**: Resolved. Coordinate snapping logic in `pickNewTarget` ensures targets are always placed on valid surfaces.

### B. The "Precision Click" Stall
- **Trigger**: User sets a manual coordinate (`autoTargetY`) exactly on a corner or thin ledge.
- **Symptom**: Bot reaches the X coordinate but is slightly off on Y, or arrives but immediately slides off due to friction, then tries to climb back.
- **Mitigation**: 
    1. `hitConfirmedTimer` and arrival "dwell" windows.
    2. Manual Stagnation Retries: Manual targets now allow up to 3 "retries" (resetting the stagnation timer) before the bot gives up. This accommodates precision centering while preventing infinite hangs on ledges.
- **Status**: Resolved. Precision centering is handled via `hitConfirmedTimer` and stagnation-based retries.

---

## 4. Global Recovery & Escalation
When specific tactical mitigations fail, the bot uses a high-level watchdog to break infinite loops.

### A. Signature-Based Escalation
- **Trigger**: The bot receives the same `failReason` at the same general location (`signature`) 5 times within 60 seconds.
- **Symptom**: Tactical reroutes are failing to find a way out of a complex geometric trap.
- **Mitigation**: 
    1. `trackLoopIncident`: Registers the failure signature and count.
    2. `LOOP_FALLBACK`: Forces a "Hard Reset." The bot abandons its current target and chooses a random nearby platform or the global nearest reachable platform to completely clear its state.
- **Status**: Fully Implemented.


## Diagnostic Cheat Sheet
When observing a loop, check these logs:
- `LOOP_WARN`: Bot is flipping direction too fast while stalled.
- `GLITCH_LOOP`: High-confidence loop detected; forcing a reroute.
- `BREADCRUMB_POP`: Bot is "backing up" to a previous known-good platform because it's stuck.
- `PLAN_FAILURE`: General timeout (4.5s) reaching a target.
- `TIC_TAC_STALL`: Bot failed to gain vertical progress during a Tic-Tac maneuver.
- `EDGE_DROP_FAIL`: Bot was blocked by a wall at a platform edge while trying to drop.
- `LOOP_SIG`: Escalation tracker identifies a recurring failure pattern.
- `LOOP_FALLBACK`: Hard reset triggered; bot is warping/rerouting to a random fallback platform.
- `MANUAL_STALL_RETRY`: Bot is giving a manual target extra time to resolve.
- `MANUAL_GIVE_UP`: Bot abandoned an unreachable manual coordinate target.
