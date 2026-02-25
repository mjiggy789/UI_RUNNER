# Navigation Failures & Physics Edge Cases

This document details known scenarios where the bot's navigation logic can fail due to complex geometry, physics interactions, or sensor limitations.

---

## 1. Common Physics Traps & Geometry Edge Cases

The bot operates in a continuous physics simulation where discrete logic (pathfinding) meets continuous execution (velocity, collision). Discrepancies between the two often lead to "traps."

### A. Ceiling Traps (`CEILING_BONK`)
- **The Issue**: The bot attempts a jump, but its `CEILING_ARC_PROBE` detects a collision with a ceiling tile before the apex. This is a `CEILING_BONK`.
- **Mechanism**:
  - Before jumping, the bot simulates a parabolic arc (`CEILING_ARC_PROBE_SAMPLES = 10` steps).
  - If any sample point intersects a solid block, the jump is suppressed or modified.
  - If a jump is attempted anyway (due to momentum or urgency) and hits the ceiling, it registers a `CEILING_BONK`.
- **Failure Mode**: Repeated bonks (3 hits = `CEILING_BONK_REROUTE_HITS`) trigger a "Ceiling Loop" condition, forcing an immediate reroute to escape the area.
- **Real Example: "The Mushroom Cap"**:
  - **Scenario**: A platform with a low overhang (like a mushroom cap).
  - **Result**: The bot tries to jump *up* to the cap's edge but hits the underside. The planner sees a valid path to the edge, but the local physics simulation detects the overhang too late.
  - **Fix**: The `CEILING_ARC_PROBE` detects the overhang and invalidates the upward jump, forcing the bot to find a path around the cap.

### B. Wall Stalls (`TIC_TAC_STALL`, `SHAFT_CLIMB`)
- **The Issue**: The bot gets stuck in a loop of wall-kicking without gaining height, or fails to climb a narrow shaft.
- **Mechanism**:
  - **Tic-Tac**: During wall-to-wall jumps, the bot tracks its vertical progress (`ticTacBestY`). If it fails to climb higher for 1.2 seconds (`TIC_TAC_STALL`), it aborts the maneuver.
  - **Shaft Climb**: In narrow vertical corridors (< 280px wide), the bot enters `SHAFT_CLIMB` mode. If the corridor widens unexpectedly or has uneven walls, the bot may lose grip.
- **Real Example: "The Infinite Shaft"**:
  - **Scenario**: A vertical shaft with slippery walls or small protrusions that block upward momentum.
  - **Result**: The bot kicks back and forth, gaining only a few pixels per jump, eventually timing out.
  - **Fix**: The `TIC_TAC_STALL` timer forces the bot to abandon the climb and fall back to the ground to rethink its path.

### C. Floor & Ledge Issues (`EDGE_DROP_FAIL`, `DOWN_SEALED`)
- **The Issue**: The bot intends to drop down but gets stuck on the edge or finds the gap too small.
- **Mechanism**:
  - **Edge Drop**: The bot aligns with the platform edge (`EDGE_DROP_INTENT`). If it doesn't fall within `EDGE_DROP_INTENT_STUCK_WINDOW` (0.72s), it assumes the edge is blocked by invisible geometry or a tiny lip.
  - **Down Sealed**: Before dropping through a floor, the bot checks if the gap below is wide enough (> 20px). If not, it marks the area as `DOWN_SEALED` and refuses to drop.
- **Real Example: "The False Ledge"**:
  - **Scenario**: A platform with a decorative non-solid top layer that looks like a floor but isn't colliding.
  - **Result**: The bot tries to stand on the "fake" floor, falls through, and gets confused about its vertical position relative to the target.
  - **Fix**: The `DOWN_SEALED` check prevents the bot from attempting to squeeze through gaps that are visually open but physically blocked.

### D. Line of Sight (LOS) Failures
- **The Issue**: The planner believes a path is clear, but the bot hits an obstacle during execution.
- **Mechanism**:
  - **Raycasting**: The `hasLineOfSight` function casts a ray from the bot's center to the target. It samples points every 35 pixels.
  - **Grazing**: If an obstacle is thin (< 35px) or positioned exactly between sample points, the ray might "miss" it, reporting a clear path when one doesn't exist.
- **Real Example: "The Grazing Collision"**:
  - **Scenario**: A thin floating platform or a corner that barely protrudes into the jump path.
  - **Result**: The bot clips the corner during a jump, loses momentum, and falls.
  - **Fix**: The `CEILING_ARC_PROBE` provides a more robust, arc-based check for jump clearance, catching obstacles that simple linear LOS might miss.

---

## 2. Global Recovery & Escalation

When specific tactical mitigations fail, the bot uses a high-level watchdog to break infinite loops.

### A. Signature-Based Escalation
- **Trigger**: The bot receives the same `failReason` at the same general location (`signature`) 4 times.
- **Symptom**: Tactical reroutes are failing to find a way out of a complex geometric trap.
- **Mitigation**:
    1. `trackLoopIncident`: Registers the failure signature and count.
    2. `LOCK_GIVE_UP`: If a specific final lock accumulates 4 glitch-loops, the bot abandons the target entirely.
    3. `LOOP_FALLBACK`: Forces a "Hard Reset." The bot abandons its current target and chooses a random nearby platform or the global nearest reachable platform.

## Diagnostic Cheat Sheet
When observing a loop, check these logs:
- `LOOP_WARN`: Bot is flipping direction too fast while stalled.
- `GLITCH_LOOP`: High-confidence loop detected; forcing a reroute.
- `BREADCRUMB_POP`: Bot is "backing up" to a previous known-good platform because it's stuck.
- `PLAN_FAILURE`: General timeout reaching a target.
- `TIC_TAC_STALL`: Bot failed to gain vertical progress during a Tic-Tac maneuver.
- `EDGE_DROP_FAIL`: Bot was blocked by a wall at a platform edge while trying to drop.
- `LOOP_SIG`: Escalation tracker identifies a recurring failure pattern.
- `LOOP_FALLBACK`: Hard reset triggered; bot is warping/rerouting to a random fallback platform.
- `MANUAL_STALL_RETRY`: Bot is giving a manual target extra time to resolve.
- `MANUAL_GIVE_UP`: Bot abandoned an unreachable manual coordinate target.
