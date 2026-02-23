# Bot Decision Reference (With Examples)

## Purpose
This document explains how the bot decides what to do, in execution order, with concrete examples and the exact debug/log signals to watch.

Scope:
- Strategic planning decisions (`Brain`)
- Movement-execution decisions (`Brain` + `Controller`)
- Recovery/reroute decisions
- Debug fields and log events that prove each decision fired

Source of truth:
- `packages/runtime/src/brain.ts`
- `packages/runtime/src/controller.ts`
- `packages/runtime/src/planner.ts`

## 1) One Tick Decision Order
On each frame (`brain.think()`), decisions happen in this sequence:
1. Refresh graph and waypoint (if locked target changed or stale).
2. Decay timers and cooldowns.
3. Handle ceiling-bonk suppression/reroute logic.
4. Handle catastrophic states (offscreen reset, trajectory abort).
5. Run top-level state machine:
   - `idle`: pick a new target
   - `seek`: execute route + movement + jumps + recovery
6. Run clearance/gap/drop/air-jump decisions.
7. Apply jump cooldown arbitration.
8. Publish `debugSnapshot` for renderer overlays.

## 2) Strategic Target Decisions

### Decision: Manual target type
- Trigger:
  - user double-clicks in manual mode
- Logic:
  - click on a solid platform => lock that platform ID
  - click empty space => coordinate target
- Example:
  - click on platform `ID15` => `lockedTargetId=15`, route planning enabled
  - click at `(940, 280)` with no collider hit => coordinate seek target
- Evidence:
  - log: `MANUAL_TARGET`

### Decision: Should we pick a coordinate target instead of a platform?
- Trigger:
  - during `pickNewTarget()`
- Logic:
  - chance starts at `0.18`, boosted by repeat pressure (`+0.28`) and far-bias mode (`+0.10`), capped at `0.72`
  - if chosen, generate randomized coordinate around candidate surfaces
- Example:
  - bot keeps revisiting same 2 platforms => repeat pressure true
  - coordinate pick chance becomes `0.56` or higher
  - bot picks `coord(1240, 310)` instead of platform center
- Evidence:
  - log: `NEW_COORD_TARGET`

### Decision: Should recent targets be blocked?
- Trigger:
  - during candidate pool build
- Logic:
  - last `5` arrivals are blocked (`RECENT_TARGET_BLOCK_COUNT=5`)
  - if pool becomes empty, recency restriction relaxes
- Example:
  - recent arrivals: `[2, 7, 2, 7, 2]`
  - `ID2` and `ID7` blocked
  - if nothing left, `RELAX_RECENCY` fires and they become eligible again
- Evidence:
  - log: `RELAX_RECENCY`

### Decision: Apply graph reachability filtering?
- Trigger:
  - grounded start node known and graph has nodes
- Logic:
  - default: keep only platforms with A* path from start
  - if repeat pressure is high, may skip hard filter (`GRAPH_RELAX_REPEAT_PROB=0.45`)
- Example:
  - from `ID4`, only `8/31` candidates are reachable => pool shrinks to those 8
- Evidence:
  - log: `GRAPH_FILTER`, `GRAPH_RELAX`, `GRAPH_FAIL`

### Decision: Airborne reachability filter
- Trigger:
  - bot is airborne during target pick
- Logic:
  - trajectory predictor checks if landing falls on candidate AABB neighborhood
  - if any pass, keep only passing subset
- Example:
  - scored pool `12`, trajectory-reachable `3` => keep 3
- Evidence:
  - log: `REACH_FILTER`, `REACH_FILTER_NONE`

### Decision: Prefer farther goals?
- Trigger:
  - repeat pressure, nonzero retry count, or random far-bias
- Logic:
  - requires distance >= `700` (`FAR_TARGET_MIN_DIST`)
  - if at least two far candidates exist, weighted pool switches to far-only
- Example:
  - top candidates are nearby loops; far pool has 4 options => choose from far pool
- Evidence:
  - log: `FAR_BIAS`

### Decision: Final platform choice from scored pool
- Trigger:
  - after scoring and filtering
- Logic:
  - softmax-like weighted pick:
    - temperature `T=14` (normal), `T=22` (far-bias)
  - prevents deterministic repetition
- Example:
  - top scores `[88, 84, 80]`
  - all can win, higher score just has greater probability
- Evidence:
  - log: `TARGET_DECIDE`, `NEW_TARGET`, `TARGET_SKIP_NEAR`

### Decision: Priority initiation target
- Trigger:
  - bot is (re)spawned (`isFirstTarget` is true)
- Logic:
  - bypass scoring/exploration/randomness
  - pick strictly closest solid surface from candidates
  - transition from `idle` to `seek` in the same tick
- Example:
  - bot is spawned in a tall skyscraper level; it ignores far target hooks and snaps to the nearest ledge to prevent falling
- Evidence:
  - log: `INIT_TARGET`

## 3) Route and Subtarget Decisions

### Decision: Use graph waypoint vs direct locked target
- Trigger:
  - locked target exists and path has intermediate node
- Logic:
  - set immediate `targetPlatform` to `path[1]`
  - sticky hold for `1700ms` to avoid route thrash (`WAYPOINT_STICKY_MS`)
- Example:
  - path `4 -> 9 -> 13 -> 14` => step target becomes `ID9` first
- Evidence:
  - log: `PLAN_WAYPOINT`
  - debug HUD/overlay: route step->final visuals

### Decision: Tall climb auto-waypoint fallback
- Trigger:
  - grounded, currently targeting final lock, and `heightDiff > 200` (`MAX_SINGLE_HOP`)
- Logic:
  - find intermediate platform between bot and goal
- Example:
  - final target is `260px` above => pick `ID6` as stepping-stone first
- Evidence:
  - log: `WAYPOINT`

### Decision: Reroute using progress subtarget
- Trigger:
  - recovery path needed (`seek-timeout`, loop, abort, etc.)
- Logic priority:
  1. graph waypoint that measurably reduces goal distance
  2. local stepping-stone fallback (`progress >= 24px`)
  3. nearest reroute waypoint pool
  4. locked target direct
  5. blind coordinate bias
- Example:
  - glitch loop near `ID10` while lock is `ID14`:
  - reroute picks local `ID11` if it shortens lock distance enough
- Evidence:
  - log: `SUBTARGET`, `REROUTE`, `REROUTE_LOCK`, `REROUTE_BLIND`

## 4) Seek Execution Decisions

### Decision: Progress stagnation timeout
- Trigger:
  - seek pressure active and not in `nav-ready`
  - `progressStagnationTimer > 4.5s`
- Logic:
  - manual mode: extend timer only
  - auto mode: increment retry, invalidate edge, breadcrumb recovery/reroute
- Example:
  - `dx=310` stays flat for ~5s => `PLAN_FAILURE`, recovery starts
- Evidence:
  - log: `PLAN_FAILURE`, `MANUAL_TIMEOUT`, `NAV_APPROACH_FAIL`
  - debug timers: `progressStagnation`

### Decision: Trajectory abort
- Trigger:
  - seeking, airborne, `vy > 300`, not in backup/charge, seek elapsed > `1.5s`
  - predicted landing misses vertically and horizontally
- Logic:
  - if locked/target platform exists => reroute
  - else => give up to idle
- Example:
  - predicted landing `x` is `240px` beyond target band and `y` far below => abort
- Evidence:
  - log: `ABORT_MOVE`, optionally `GIVE_UP_ABORT`

### Decision: Navigation FSM (`nav-align` -> `nav-approach` -> `nav-ready` -> `nav-commit`)
- Trigger:
  - grounded and target is above (`heightDiff > 20`)
- Logic:
  - compute or load takeoff zone
  - **Phase: Backup**: if too close to edge for momentum, move to far side of platform (`NAV_BACKUP` log).
  - **Phase: Charge**: sprint toward takeoff zone (`NAV_CHARGE` log).
  - **Phase: Run-through**: if entering zone at high speed (`|vx| > 100`), trigger jump instantly (patience=0).
  - hold patience (~`0.3s`) while inside zone and near-settled speed if not charging.
  - commit jump when ready.
- Example:
  - far gap requires speed; bot backs up 120px then sprints to edge and launches without stopping.
- Evidence:
  - log: `NAV_ALIGN`, `NAV_APPROACH`, `NAV_READY`, `NAV_BACKUP`, `NAV_CHARGE`, `NAV_SLIP`
  - debug: `takeoffZone`, `navState`, `approachPhase`

## 5) Steering Decisions

### Decision: Horizontal steer direction with anti-pingpong
- Trigger:
  - after nav target is computed
- Logic:
  - deadzone starts at `18`, near-target deadzone `36`, slide minimum `34`
  - sticky band = deadzone + `14`
  - commit-hold timers (`0.24s` base, `0.32s` near)
  - flip guard near centerline (`120px`)
- Example:
  - `moveDx` oscillates between `+9` and `-8` => stays committed, no rapid flip
- Evidence:
  - debug: `deadzone`, `stickyBand`, `moveDir`, `moveDx`

### Decision: Overhead lock vertical jump
- Trigger:
  - grounded, target above and nearly centered (`|dx| <= 34`)
  - `heightDiff` in `(14, 240)` and direct approach
- Logic:
  - if overhead probe clear: suppress lateral movement and jump vertical
- Example:
  - target directly above by `110px`, no ceiling in probe => `overhead-lock-jump`
- Evidence:
  - log jump reason: `overhead-lock-jump` / `overhead-lock-full-jump`
  - debug: `overheadAligned`, `overheadProbe`, `overheadBlocked`

### Decision: Ceiling escape
- Trigger:
  - grounded, need upward progress, but no lateral move and ceiling above
- Logic:
  - probe both sides; choose open direction and latch for `0.28s`
- Example:
  - ceiling blocked, right wall blocked, left open => forced left escape
- Evidence:
  - log: `CEILING_ESCAPE`
  - debug: `ceilingHeadProbe`, `ceilingEscapeWall*`

## 6) Wall, Climb, and Tic-Tac Decisions

### Decision: Wall direction probe
- Trigger:
  - each seek tick
- Logic:
  - use wall-slide facing if already wall-sliding
  - otherwise probe ±25px side boxes
- Example:
  - right probe hit => `wallDir=1`
- Evidence:
  - debug: `wallProbeLeft/Right`, hit flags, `wallDir`

### Decision: Tic-tac eligibility
- Trigger:
  - target above enough (`heightDiff > 54`), airborne, corridor present/recent
- Logic:
  - corridor width must be in `[40, 280]`
  - start/maintain alternating wall kicks
- Example:
  - shaft width `96px`, airborne near walls => tic-tac starts
- Evidence:
  - log: `TIC_TAC_START`, `TIC_TAC_END`
  - debug: `ticTacEligible`, `ticTacActive`, corridor metrics/timers

### Decision: Tic-tac kick timing
- Trigger:
  - tic-tac active and touching wall
- Logic:
  - hold on wall for `0.07s`, then jump away
  - kick cooldown `0.09s`
- Example:
  - wall contact at `t=0`; kick issued at `t=0.08` after hold threshold
- Evidence:
  - jump reason logs: `tic-tac-right-kick` / `tic-tac-left-kick`
  - debug: `ticTacWallHoldTimer`, `ticTacJumpTimer`, `ticTacDir`

### Decision: Non-tic-tac wall behavior
- Trigger:
  - wall detected, target above, tic-tac not handling
- Logic:
  - reverse-hop if moving against useful wall side
  - prefer climb when ceiling is clear and target is sufficiently high
  - force hop if wall-slide lingers or downward speed too high
- Example:
  - wall-slide for `0.12s` and still not gaining => timeout hop fired
- Evidence:
  - jump reasons: `wall-reverse-hop`, `wall-slide-timeout-hop`, `climb-stall-hop`

### Decision: Wall-step launch
- Trigger:
  - target platform is tall narrow wall column and launch geometry is favorable
- Logic:
  - run to wall face offset and launch if near face and carrying speed >= `120`
- Example:
  - near face (`<60px`) and speed `+150` => `wall-step-launch`
- Evidence:
  - jump reason: `wall-step-launch`

## 7) Clearance and Body-Form Decisions

### Decision: Ground crouch path
- Trigger:
  - grounded, moving laterally, no jump
  - head probe blocked but knee probe clear
- Logic:
  - set `down=true` to stay low under low ceiling
- Example:
  - head box collides, knee box clear => crouch path maintained
- Evidence:
  - log: `CROUCH_PATH`

### Decision: Air tuck (jump into overhead slot)
- Trigger:
  - airborne, target above, not in wall-slide/climb
  - near-ceiling probe hit in movement direction
  - near target column and still ascending/early-fall (`vy < 120`)
- Logic:
  - set `down=true` in air
  - controller compresses to `20x20` while airborne
- Example:
  - bot jumps toward target above, sees low lip overhead, tucks midair to fit
- Evidence:
  - debug: `airTuckProbe`, `airTuckWanted`
  - renderer HUD: `AirTuck: on`

### Decision: Ceiling-bonk suppression
- Trigger:
  - `pose.ceilingBonk` true
- Logic:
  - jump suppression timer accumulates (`0.3 + 0.15*bonkCount`, capped via logic)
  - reroute after repeated bonks in window (`>=3` within `0.8s`)
- Example:
  - 3 bonks in quick succession => `CEILING_LOOP` + reroute
- Evidence:
  - log: `CEILING_BONK`, `CEILING_LOOP`
  - debug timer: `ceilingSuppress`

## 8) Gap, Drop, and Jump Decisions

### Decision: Gap jump
- Trigger:
  - grounded, moving horizontally toward target, look-ahead has no ground
- Logic:
  - request gauged jump if available, else full jump
- Example:
  - forward probe detects void => `gap-jump` issued
- Evidence:
  - jump reason: `gap-jump`
  - debug: `gapProbe`, `gapProbeHasGround`

### Decision: Direct upward jump type (gauged vs full)
- Trigger:
  - grounded, target above, no crouch/ceiling suppression path
- Logic:
  - compute gauge in `[0.2, 0.7]` if good horizontal fit
  - else full jump when close enough (`dx < 160`, height condition)
- Example:
  - `heightDiff=95`, `dx=60` => `direct-gauged-jump`
  - `heightDiff=130`, gauge invalid but `dx=90` => `direct-full-jump`
- Evidence:
  - jump reasons: `direct-gauged-jump`, `direct-full-jump`
  - log: `GAUGED_JUMP`

### Decision: Solid-platform edge drop plan
- Trigger:
  - grounded on solid platform, target significantly below (`heightDiff < -30`)
- Logic:
  - score left/right edge, avoid blocked edge, lock chosen edge for ~`1.1s`
- Example:
  - right edge has wall, left edge clear => choose left drop edge
- Evidence:
  - log: `EDGE_DROP_PLAN`
  - debug: `dropPlannedEdgeX`, `dropDirection`

### Decision: One-way drop-through
- Trigger:
  - grounded on one-way platform, target below, horizontal alignment `dx < 70`
- Logic:
  - `down=true` + `drop-through` jump intent
- Example:
  - bot on one-way ledge with target directly below => instant drop-through
- Evidence:
  - jump reason: `drop-through`

### Decision: Air jump escalation
- Trigger:
  - airborne, not wall-slide, jumps left
- Logic:
  - double jump on moderate upward gap while descending
  - triple jump for larger gap/height with higher descent
- Example:
  - second-jump window with `heightDiff=170` and `vy=130` => triple jump
- Evidence:
  - jump reason: `double-air-jump` or `triple-air-jump`
  - log: `TRIPLE_JUMP` when triple fires

### Decision: Jump cooldown arbitration
- Trigger:
  - any jump request
- Logic:
  - normal cooldown `0.15s`
  - wall-action jumps use shorter cooldown `0.08s`
  - blocked intents logged
- Example:
  - two gap-jump requests in rapid sequence => second becomes `JUMP_BLOCKED`
- Evidence:
  - log: `JUMP_BLOCKED`, `JUMP_INTENT`, `JUMP_INTENT_UPGRADE`, `JUMP_INTENT_TUNE`
  - debug timer: `jumpCooldown`

## 9) Controller Execution Decisions

### Decision: Ground slide persistence
- Trigger:
  - crouch intent on ground
- Logic:
  - once sliding starts, keep a movement direction
  - if blocked by wall, auto-flip direction to avoid slide-idle
  - enforce minimum continuous slide speed
- Example:
  - enters slide at `vx=360`, no input => keeps sliding; if wall hit, flips and continues
- Evidence:
  - pose state: `slide`

### Decision: Wall jump style
- Trigger:
  - jump pressed during `wall-slide` or `climb`
- Logic:
  - away/no input => strong kick-off
  - into wall => near-vertical scale hop
- Example:
  - facing right wall and no left input => kicks left with strong horizontal velocity
- Evidence:
  - pose transitions: `wall-slide|climb -> jump`

### Decision: Climb stall breakout
- Trigger:
  - in `climb` with insufficient upward progress for `0.35s`
- Logic:
  - force breakout hop away from wall
- Example:
  - bot presses up on wall but gains <6px repeatedly => forced hop
- Evidence:
  - controller state and velocity change

## 10) Recovery Decisions

### Decision: Glitch loop detection and reroute
- Trigger:
  - grounded, low movement while trying, repeated facing flips
  - warning threshold: stall > `1.0s` and flips >= `3`
  - detect threshold: stall > `1.6s` and flips >= `5`
- Logic:
  - record warning, then reroute and start cooldown (`2.5s`)
- Example:
  - target nearly above causes left-right pingpong near centerline => `GLITCH_LOOP`
- Evidence:
  - log: `LOOP_WARN`, `GLITCH_LOOP`

### Decision: Breadcrumb rewind
- Trigger:
  - timeout/stuck/fall with locked target
- Logic:
  - pop breadcrumb stack until node with valid path to lock is found
- Example:
  - after failed climb to `ID14`, rewind to previous safe `ID9`
- Evidence:
  - log: `BREADCRUMB_POP`, `BREADCRUMB_EMPTY`

### Decision: Fell below target recovery
- Trigger:
  - grounded and far below target platform (`>200px`) for >`1.0s`
- Logic:
  - increment retries, optionally log persistent retries, recover via breadcrumbs
- Example:
  - misses upper chain and lands far below => recovery kicks in
- Evidence:
  - log: `FELL_BELOW`, `PERSIST_RETRY`

### Decision: Offscreen reset
- Trigger:
  - `pose.y > window.innerHeight + 200`
- Logic:
  - clear locks and state, reset to idle, clear target context
- Example:
  - bot falls out of scene bounds after failed traversal
- Evidence:
  - log: `OFFSCREEN_RESET`

## 11) Example End-to-End Scenarios

### Scenario A: Target directly above under low lip
1. Target selected and locked.
2. `overheadAligned=true` near centerline.
3. Jump requested.
4. Airborne near-ceiling probe hits => `airTuckWanted=true`.
5. Controller applies airborne tuck (`20x20`) and clears slot.
6. Arrival registered.

What to watch:
- Debug: `overheadAligned`, `airTuckWanted`, `ceilingBlocked`
- Log: `JUMP_INTENT`, optional `GAUGED_JUMP`, `ARRIVED`

### Scenario B: Narrow shaft climb (tic-tac)
1. Height difference exceeds tic-tac threshold.
2. Corridor width probe returns valid value.
3. `TIC_TAC_START` fires and direction initialized.
4. Wall hold timer reaches threshold; kick issued.
5. Alternating wall kicks continue until grounded or target height achieved.

What to watch:
- Debug: `ticTacEligible`, `ticTacActive`, corridor width, timers
- Log: `TIC_TAC_START`, kick jump reasons, `TIC_TAC_END`

### Scenario C: Pingpong near vertical target
1. Steering sees low displacement + frequent facing flips.
2. Loop warning triggers.
3. Loop detect threshold reached.
4. `GLITCH_LOOP` fires and `reroute('glitch-loop')` chooses a subtarget.

What to watch:
- Debug: `moveDx`, `moveDir`, timers
- Log: `LOOP_WARN`, `GLITCH_LOOP`, `REROUTE`/`SUBTARGET`

## 12) Fast Debug Checklist
When a behavior looks wrong, inspect in this order:
1. `targetX/targetY`, `lockedTargetId`, route overlay (step->final)
2. `navState` and `takeoffZone`
3. `moveDx`, `deadzone`, `stickyBand`, `moveDir`
4. wall/ceiling/gap/drop probes
5. `ticTac*` fields if vertical shaft climbing
6. `airTuckWanted` for tight overhead jumps
7. timers: stagnation, jump cooldown, wall decision, ceiling suppress
8. Brain log events around failure window
