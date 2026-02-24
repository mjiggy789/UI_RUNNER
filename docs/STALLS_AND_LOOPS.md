# Failure Modes: Stalls and Ping-Pong Loops

This document analyzes known scenarios where the bot's navigation logic can fail, leading to repetitive "ping-ponging" between states or permanent "stalling" on a platform.

---

## 1. Global Recovery & Escalation
When specific tactical mitigations fail, the bot uses a high-level watchdog to break infinite loops.

### A. Signature-Based Escalation
- **Trigger**: The bot receives the same `failReason` at the same general location (`signature`) 4 times.
- **Symptom**: Tactical reroutes are failing to find a way out of a complex geometric trap.
- **Mitigation**: 
    1. `trackLoopIncident`: Registers the failure signature and count. The signature is now keyed to the *final locked target*, making it stable even as specific reroute waypoints change.
    2. `LOCK_GIVE_UP`: If a specific final lock accumulates 4 glitch-loops (across all its sub-waypoint reroutes), the bot abandons the target entirely. This prevents infinite cycles of rerouting that never reach the goal.
    3. `LOOP_FALLBACK`: Forces a "Hard Reset." The bot abandons its current target and chooses a random nearby platform or the global nearest reachable platform to completely clear its state.
- **Status**: Active monitoring system.

## Diagnostic Cheat Sheet
When observing a loop, check these logs:
- `LOOP_WARN`: Bot is flipping direction too fast while stalled.
- `GLITCH_LOOP`: High-confidence loop detected; forcing a reroute.
- `BREADCRUMB_POP`: Bot is "backing up" to a previous known-good platform because it's stuck.
- `PLAN_FAILURE`: General timeout reaching a target. Now uses a **Dynamic Timeout window** (base 4.5s + extensions for proximity, velocity progress, and active reroute status).
- `TIC_TAC_STALL`: Bot failed to gain vertical progress during a Tic-Tac maneuver.
- `EDGE_DROP_FAIL`: Bot was blocked by a wall at a platform edge while trying to drop.
- `LOOP_SIG`: Escalation tracker identifies a recurring failure pattern.
- `LOOP_FALLBACK`: Hard reset triggered; bot is warping/rerouting to a random fallback platform.
- `MANUAL_STALL_RETRY`: Bot is giving a manual target extra time to resolve.
- `MANUAL_GIVE_UP`: Bot abandoned an unreachable manual coordinate target.
