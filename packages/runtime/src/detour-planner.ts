import { Collider, AABB } from '@parkour-bot/shared';
import { World } from './world';
import { NavGraph, NavEdge, PlannerContext } from './planner';
import { LocalSolver } from './local-solver';
import { Pose } from './controller';

const MIN_PLATFORM_SIZE = 20;
const DETOUR_HISTORY_TTL = 8000;
const MAX_CANDIDATES = 12;

interface DetourResult {
    type: 'waypoint' | 'coordinate' | 'maneuver';
    target: Collider | { x: number, y: number };
    edge?: NavEdge;
    reason: string;
}

interface ScoredCandidate {
    collider: Collider;
    score: number;
    pathCost: number;
}

export class DetourPlanner {
    private failureMemory: Map<string, number> = new Map();

    constructor(
        private world: World,
        private graph: NavGraph,
        private localSolver: LocalSolver
    ) {}

    public getDetour(
        pose: Pose,
        lockedTarget: Collider | null,
        failedTarget: Collider | null,
        context: PlannerContext,
        failures: string[]
    ): DetourResult | null {
        // Prune failure memory
        const now = performance.now();
        for (const [key, expiry] of this.failureMemory.entries()) {
            if (now > expiry) this.failureMemory.delete(key);
        }

        // Record current failure context if provided
        if (pose.groundedId !== null && failedTarget) {
            const key = this.getFailureKey(pose.groundedId, `detour-${failedTarget.id}`);
            this.failureMemory.set(key, now + DETOUR_HISTORY_TTL);
        }

        if (!pose.grounded || pose.groundedId === null) {
            // Can't plan detours in air reliably without graph node context
            return null;
        }

        const startId = pose.groundedId;
        // Reachability Gate: Ensure we can pathfind at all from here
        if (!this.graph.nodes.has(startId)) return null;

        // 1. Candidate Generation
        // Build a bounded pool of reachable platforms around the current area
        const botCx = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const searchRadiusX = 500;
        const searchRadiusY = 300;

        const searchAABB: AABB = {
            x1: botCx - searchRadiusX,
            y1: botFeetY - searchRadiusY,
            x2: botCx + searchRadiusX,
            y2: botFeetY + searchRadiusY
        };

        const nearby = this.world.query(searchAABB).filter(c => {
            if (c.kind !== 'rect' || !c.flags.solid) return false;
            if ((c.aabb.x2 - c.aabb.x1) < MIN_PLATFORM_SIZE) return false;
            if (c.id === startId) return false; // Don't detour to self
            if (lockedTarget && c.id === lockedTarget.id) return false; // Already trying to go there
            return true;
        });

        // 2. Score Candidates & Apply Reachability Gate
        const candidates: ScoredCandidate[] = [];

        for (const c of nearby) {
            // Check Reachability (A* path exists)
            // Use relaxed context to find *any* possible path, even if tight
            const path = this.graph.findPathDetailed(startId, c.id, { context, maxStates: 100 });
            if (!path) continue; // Reachability Gate: Skip unreachable

            // Check if this specific edge/target combo is blacklisted
            const failureKey = this.getFailureKey(startId, `detour-${c.id}`);
            if (this.failureMemory.has(failureKey)) continue;

            const score = this.scoreCandidate(pose, c, lockedTarget, path.totalCost);
            candidates.push({ collider: c, score, pathCost: path.totalCost });
        }

        // Sort by score descending
        candidates.sort((a, b) => b.score - a.score);
        const topCandidates = candidates.slice(0, MAX_CANDIDATES);

        // 3. Reroute Priority Integration
        // (1) Graph waypoint that measurably reduces goal distance
        // (2) Local stepping-stone with >= 24px progress
        // (3) Nearest reroute waypoint pool

        if (lockedTarget) {
            const goalCx = (lockedTarget.aabb.x1 + lockedTarget.aabb.x2) / 2;
            const goalY = lockedTarget.aabb.y1;
            const currentDistToGoal = Math.hypot(goalCx - botCx, goalY - botFeetY);

            // Priority 1: Graph waypoint reducing distance significantly
            for (const cand of topCandidates) {
                const candCx = (cand.collider.aabb.x1 + cand.collider.aabb.x2) / 2;
                const distToGoalFromCand = Math.hypot(goalCx - candCx, goalY - cand.collider.aabb.y1);

                // Heuristic improvement: path cost to candidate + remaining dist < current dist
                if (cand.pathCost + distToGoalFromCand < currentDistToGoal * 0.85) {
                    return {
                        type: 'waypoint',
                        target: cand.collider,
                        reason: 'heuristic-reduction'
                    };
                }
            }

            // Priority 2: Local stepping stone (measurable progress)
            for (const cand of topCandidates) {
                const candCx = (cand.collider.aabb.x1 + cand.collider.aabb.x2) / 2;
                const distToGoalFromCand = Math.hypot(goalCx - candCx, goalY - cand.collider.aabb.y1);

                if (currentDistToGoal - distToGoalFromCand >= 24) {
                    return {
                        type: 'waypoint',
                        target: cand.collider,
                        reason: 'stepping-stone'
                    };
                }
            }
        }

        // Priority 3: Best from the pool (already sorted by score)
        if (topCandidates.length > 0) {
            return {
                type: 'waypoint',
                target: topCandidates[0].collider,
                reason: 'best-scoring-detour'
            };
        }

        // 4. Local Maneuver Synthesis (optional but high value)
        // If no reachable platform waypoint improves progress, try to synthesize a single-hop maneuver
        const localEdge = this.localSolver.solve(pose, lockedTarget ? {
            x: (lockedTarget.aabb.x1 + lockedTarget.aabb.x2) / 2,
            y: lockedTarget.aabb.y1
        } : null, context);

        if (localEdge) {
            // Check if this maneuver is blacklisted
            const maneuverKey = this.getFailureKey(startId, `maneuver-${localEdge.maneuverId}`);
            if (!this.failureMemory.has(maneuverKey)) {
                return {
                    type: 'maneuver',
                    target: { x: (localEdge.landingMinX + localEdge.landingMaxX) / 2, y: localEdge.landingY }, // Coordinate target for the maneuver
                    edge: localEdge,
                    reason: 'local-maneuver-synthesis'
                };
            }
        }

        // 5. Escalate (return null, let Brain handle coordinate bias)
        return null;
    }

    private scoreCandidate(pose: Pose, candidate: Collider, lockedTarget: Collider | null, pathCost: number): number {
        let score = 50;

        const botCx = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const candCx = (candidate.aabb.x1 + candidate.aabb.x2) / 2;
        const candY = candidate.aabb.y1;

        // Clearance Margin: prefer wider platforms
        const width = candidate.aabb.x2 - candidate.aabb.x1;
        if (width > 60) score += 10;
        if (width > 100) score += 5;

        // LOS Robustness: multiple sampled rays
        // Check center, left quarter, right quarter
        const losCenter = this.world.hasLineOfSight(botCx, botFeetY - 20, candCx, candY - 10);
        const losLeft = this.world.hasLineOfSight(botCx, botFeetY - 20, candCx - width * 0.25, candY - 10);
        const losRight = this.world.hasLineOfSight(botCx, botFeetY - 20, candCx + width * 0.25, candY - 10);

        let losCount = 0;
        if (losCenter) losCount++;
        if (losLeft) losCount++;
        if (losRight) losCount++;
        score += losCount * 5;

        // Run-up Availability on CURRENT platform (implied by NavGraph feasibility, but we can reward "easy" jumps)
        // We don't have easy access to current platform geometry here without passing it,
        // but we can infer from `pathCost` - lower cost usually means easier/shorter traversal.
        score -= pathCost * 0.1;

        // Heuristic Goal Reduction
        if (lockedTarget) {
            const goalCx = (lockedTarget.aabb.x1 + lockedTarget.aabb.x2) / 2;
            const goalY = lockedTarget.aabb.y1;
            const distToGoal = Math.hypot(goalCx - candCx, goalY - candY);

            // Prefer candidates closer to the goal
            score -= distToGoal * 0.1;

            // Vertical progress bonus (if goal is above)
            if (goalY < botFeetY && candY < botFeetY) {
                score += (botFeetY - candY) * 0.2;
            }
        }

        return score;
    }

    private getFailureKey(groundedId: number, failureTag: string): string {
        return `${groundedId}|${failureTag}`;
    }
}
