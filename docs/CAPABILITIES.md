# Bot Capabilities & Feature Overview

This document outlines the current operational capabilities of the Parkour Bot. It serves as a checklist of expected behaviors and a reference for the bot's state-of-the-art navigation and movement systems as of current development.

## 1. Core Movement & Physics
The bot utilizes a sub-stepping physics engine to ensure consistency across varying frame rates.
- **Locomotion**: Smooth acceleration and turning on ground.
- **Multi-Jump System**: Supports single, double, and triple jumps with decreasing force multipliers.
- **Dashing**: High-speed horizontal burst to clear large gaps or move through hazardous zones.
- **Crouch & Slide**: 
    - **Active Sliding**: Preserve momentum by entering a slide from a run.
    - **Proactive Crouch**: Automatically lowers height to move under low-clearance obstacles.
    - **Air-Tucking**: Tucking in mid-air to clear narrow vertical windows.

## 2. Advanced Environmental Interaction
The bot is designed to treat walls and tight spaces as navigation opportunities rather than obstacles.
- **Wall Navigation**:
    - **Wall Slide**: Controlled descent down vertical surfaces.
    - **Vertical Climbing**: Actively scales walls using a rhythmic climbing state.
    - **Wall Kick-offs**: Precise directional jumps away from walls to gain horizontal distance.
- **Climbing Patterns**:
    - **Tic-Tac**: Rapidly zig-zagging between two close walls to scale vertical shafts.
    - **Shaft Climb**: Specialized single-wall "hop" cadence for extremely narrow corridors.
    - **Wall-Step Launch**: Intelligently identifies tall, narrow pillars and treats them as "vertical steps" to be launched onto.

## 3. Targeting & Intelligent Navigation
The "Brain" of the bot orchestrates movement based on a hierarchical targeting system.
- **NavGraph Pathfinding**: Uses a global navigation graph to find multi-step paths between platform nodes.
- **Target Evaluation (Scoring)**:
    - **Vertical Bias**: Prioritizes upward progress.
    - **Novelty (Exploration)**: Uses visit counts to penalize frequently visited areas and encourage exploration of new platforms.
    - **Fairness**: Tracks "unreachable" memories to avoid getting stuck on seductive but impossible targets.
- **Local Solving**: When the global graph lacks a specific edge, the `LocalSolver` simulates immediate maneuvers (jumps/walks) to find tiny "micro-paths" to nearby ledges.
- **Coordinate Mode**: Can navigate toward raw (x, y) coordinates for free-form traversal when no platform nodes are available.

## 4. Stability & Recovery Systems
The bot includes multiple layers of "Anti-Stall" logic to handle the unpredictable nature of web layouts.
- **Stagnation Watchdogs**:
    - **Progress Stagnation**: Detects when the bot hasn't improved its distance to the target for several seconds and triggers a reroute.
    - **FSM Watchdog**: Monitors for "decision loops" where the bot is stuck in a navigation state (like alignment) without acting.
- **Resilience Mechanisms**:
    - **Island Escape**: Specifically detects when the bot is on a "dead-end" platform and triggers emergency hops or directed edge-drops.
    - **Trajectory Prediction**: Predicts landing points mid-jump. If a failure (undershoot/overshoot) is detected, the bot identifies the failure early and transitions to a recovery state.
    - **Ceiling Bonk Recovery**: Tracks repeated head-collisions and forces a horizontal escape maneuver to break out of ceiling traps.
    - **Breadcrumb Recovery**: Maintains a short history of successful positions to backtrack when completely lost.

## 5. Deployment & Telemetry
- **Dynamic Re-Scanning**: Monitors the DOM for changes (scrolls, layout shifts) and automatically updates its internal world model and navigation graph.
- **Telemetry Integration**: Reports diagnostics (stalls, falls, successes) to a telemetry service for aggregate behavior analysis.
