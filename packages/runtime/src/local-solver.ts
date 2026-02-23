import { Collider, AABB } from '@parkour-bot/shared';
import { World } from './world';
import { NavGraph, NavEdge, PlannerContext } from './planner';
import { Pose } from './controller';

const LOCAL_SEARCH_RADIUS_X = 380;
const LOCAL_SEARCH_RADIUS_Y_UP = 250;
const LOCAL_SEARCH_RADIUS_Y_DOWN = 180;
const MIN_PLATFORM_SIZE = 20;

export class LocalSolver {
    constructor(private world: World, private graph: NavGraph) {}

    solve(pose: Pose, target: { x: number, y: number } | null, context: PlannerContext): NavEdge | null {
        if (!pose.grounded || pose.groundedId === null) return null;

        const groundedCollider = this.world.colliders.get(pose.groundedId);
        if (!groundedCollider) return null;

        const searchAABB: AABB = {
            x1: pose.x - LOCAL_SEARCH_RADIUS_X,
            y1: pose.y - LOCAL_SEARCH_RADIUS_Y_UP,
            x2: pose.x + pose.width + LOCAL_SEARCH_RADIUS_X,
            y2: pose.y + pose.height + LOCAL_SEARCH_RADIUS_Y_DOWN
        };

        const candidates = this.world.query(searchAABB);
        const validCandidates = candidates.filter(c => {
            if (c.id === groundedCollider.id) return false; // Not current platform
            if (c.kind !== 'rect' || !c.flags.solid) return false;
            if ((c.aabb.x2 - c.aabb.x1) < MIN_PLATFORM_SIZE) return false;

            // Simple overhead check to discard obviously bad landing spots
            const cx = (c.aabb.x1 + c.aabb.x2) / 2;
            const headroomProbe: AABB = {
                x1: cx - 10,
                y1: c.aabb.y1 - 42, // Bot height approx 40
                x2: cx + 10,
                y2: c.aabb.y1 - 2
            };
            const overhead = this.world.query(headroomProbe);
            for (const b of overhead) {
                if (b.id !== c.id && b.kind === 'rect' && b.flags.solid && !b.flags.oneWay) return false;
            }
            return true;
        });

        const maneuvers: { edge: NavEdge; score: number }[] = [];
        const graphNode = this.graph.nodes.get(groundedCollider.id);
        const timeNow = performance.now();

        for (const candidate of validCandidates) {
             const landingPenalty = this.graph.getLandingPenalty(candidate);
             // Use the graph's primitive to build the edge
             const edge = this.graph.buildManeuverEdge(groundedCollider, candidate, landingPenalty);

             if (edge) {
                 // Check if this maneuver is blacklisted/invalidated in the global graph
                 if (graphNode) {
                     const isBlacklisted = graphNode.edges.some(e =>
                         e.toId === edge.toId &&
                         e.invalidUntil > timeNow &&
                         // If maneuverId matches (specific block) OR it's a generic block (no maneuverId in block record? usually they have one)
                         // NavGraph.invalidateEdge uses "blocked:..." if generic.
                         (e.maneuverId === edge.maneuverId || e.cost === Infinity)
                     );
                     if (isBlacklisted) continue;
                 }

                 const score = this.scoreManeuver(edge, pose, target, candidate);
                 maneuvers.push({ edge, score });
             }
        }

        maneuvers.sort((a, b) => b.score - a.score);

        if (maneuvers.length > 0) {
            return maneuvers[0].edge;
        }

        return null;
    }

    private scoreManeuver(edge: NavEdge, pose: Pose, target: { x: number, y: number } | null, toCollider: Collider): number {
        // 1. Safety & Feasibility (Margin)
        const landingWidth = edge.landingMaxX - edge.landingMinX;
        let score = landingWidth * 0.15; // Reward forgiving landings

        // 2. Base Cost Penalty (avoids complex/risky moves like wall jumps if a simple walk/drop works)
        score -= edge.cost * 0.1;

        // 3. Goal Progress
        if (target) {
            const botCx = pose.x + pose.width / 2;
            const botFeetY = pose.y + pose.height;
            const currentDist = Math.hypot(target.x - botCx, target.y - botFeetY);

            const landingCx = (edge.landingMinX + edge.landingMaxX) / 2;
            const newDist = Math.hypot(target.x - landingCx, target.y - edge.landingY);

            const progress = currentDist - newDist;
            score += progress * 1.2;

            // Bonus for vertical gain if target is above
            if (target.y < botFeetY) { // Target is above
                const verticalGain = botFeetY - edge.landingY; // positive if going up
                if (verticalGain > 0) {
                    score += verticalGain * 2.5; // Strong bias for climbing if target is up
                }
            } else if (target.y > botFeetY + 50) { // Target is significantly below
                 const verticalDrop = edge.landingY - botFeetY; // positive if going down
                 if (verticalDrop > 0) {
                     score += verticalDrop * 0.8; // Some bonus for going down
                 }
            }
        } else {
            // No specific target (e.g. escaping loop without lock)
            // Prefer upward mobility and distance from current stuck spot
            const verticalGain = (pose.y + pose.height) - edge.landingY;
            if (verticalGain > 0) score += verticalGain * 1.5;

            // Prefer moves that actually move us somewhere
            score += 20;
        }

        // 4. Run-up Feasibility Check
        // If the takeoff zone is very far from current position, it might be hard to reach if we are stuck.
        // But generally we assume we can run on the platform.
        // A small penalty for very distant takeoff zones could help break local stutters.
        const botCx = pose.x + pose.width / 2;
        const takeoffCx = (edge.takeoffMinX + edge.takeoffMaxX) / 2;
        const distToTakeoff = Math.abs(takeoffCx - botCx);
        score -= distToTakeoff * 0.05;

        return score;
    }
}
