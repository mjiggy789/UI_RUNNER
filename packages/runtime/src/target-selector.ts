import { Collider, AABB } from '@parkour-bot/shared';
import { Pose } from './controller';
import type { Brain } from './brain';

export const MIN_PLATFORM_SIZE = 20;
const MAX_SINGLE_HOP = 200;
const RECENT_TARGET_BLOCK_COUNT = 8;
export const FAR_TARGET_MIN_DIST = 700;
export const COORD_TARGET_BASE_PROB = 0.18;
export const COORD_TARGET_REPEAT_BONUS = 0.28;
export const COORD_TARGET_FAR_BONUS = 0.1;
export const ENABLE_COORDINATE_TARGETS = false;
export const REGION_BLACKLIST_TTL_MS = 7000;
export const TARGET_PICK_DOMINANCE_GAP = 18;
export const ISLAND_MODE_FREEZE_SEC = 2.4;
export const ESCALATION_TIMER_FLOOR = 0.45;

export class TargetSelector {
    constructor(private brain: Brain) {}

    getGraphComponents(): { idByNode: Map<number, number>; sizeByComponent: Map<number, number> } {
        const idByNode = new Map<number, number>();
        const sizeByComponent = new Map<number, number>();
        const adjacency = new Map<number, Set<number>>();

        for (const [nodeId, node] of this.brain.graph.nodes.entries()) {
            if (!adjacency.has(nodeId)) adjacency.set(nodeId, new Set<number>());
            for (const edge of node.edges) {
                if (!adjacency.has(edge.toId)) adjacency.set(edge.toId, new Set<number>());
                adjacency.get(nodeId)!.add(edge.toId);
                adjacency.get(edge.toId)!.add(nodeId);
            }
        }

        let componentId = 0;
        for (const nodeId of adjacency.keys()) {
            if (idByNode.has(nodeId)) continue;
            const queue: number[] = [nodeId];
            idByNode.set(nodeId, componentId);
            let size = 0;
            while (queue.length > 0) {
                const current = queue.shift();
                if (current === undefined) break;
                size++;
                const neighbors = adjacency.get(current);
                if (!neighbors) continue;
                for (const next of neighbors) {
                    if (idByNode.has(next)) continue;
                    idByNode.set(next, componentId);
                    queue.push(next);
                }
            }
            sizeByComponent.set(componentId, size);
            componentId++;
        }

        return { idByNode, sizeByComponent };
    }

    findReachableMainlandCandidate(pose: Pose, botCx: number, botFeetY: number): Collider | null {
        if (!pose.grounded || pose.groundedId === null) return null;
        const startId = pose.groundedId;
        if (!this.brain.graph.nodes.has(startId)) return null;

        const now = performance.now();
        const { idByNode, sizeByComponent } = this.getGraphComponents();
        const startComponent = idByNode.get(startId) ?? -1;
        const global = this.brain.world.getAll().filter((c) => {
            if (c.kind !== 'rect' || !c.flags.solid) return false;
            if ((c.aabb.x2 - c.aabb.x1) < MIN_PLATFORM_SIZE) return false;
            if (c.id === startId) return false;
            if (this.brain.targetPlatform && c.id === this.brain.targetPlatform.id) return false;
            if (this.brain.recentWarpDestinations.includes(c.id)) return false;
            if (this.brain.isRegionTargetBlacklisted(startId, c.id)) return false;
            return true;
        });

        let best: { collider: Collider; score: number } | null = null;
        for (const c of global) {
            if (!this.brain.graph.nodes.has(c.id)) continue;
            const path = this.brain.findPathWithContext(startId, c.id, pose, true, 240);
            if (!path || path.nodes.length < 2) continue;

            const node = this.brain.graph.nodes.get(c.id);
            const validExitCount = node
                ? node.edges.reduce((count, edge) => count + (edge.invalidUntil <= now ? 1 : 0), 0)
                : 0;
            if (validExitCount <= 0) continue;

            const cx = (c.aabb.x1 + c.aabb.x2) / 2;
            const dist = Math.hypot(cx - botCx, c.aabb.y1 - botFeetY);
            const compId = idByNode.get(c.id) ?? -1;
            const compSize = sizeByComponent.get(compId) ?? 1;
            const crossComponentBonus = compId !== startComponent ? 170 : 0;
            const routePotential = Math.min(120, validExitCount * 14 + compSize * 1.8);
            const corridorPenalty = this.brain.getCorridorFailurePenalty(startId, c.id);
            const score = crossComponentBonus + routePotential + Math.min(110, dist * 0.12) - path.totalCost * 0.34 - corridorPenalty;
            if (!best || score > best.score) {
                best = { collider: c, score };
            }
        }

        return best?.collider ?? null;
    }

    findDirectedEscapeBase(pose: Pose, botCx: number, botFeetY: number): Collider | null {
        const groundedId = pose.groundedId;
        const { idByNode, sizeByComponent } = this.getGraphComponents();
        const currentComponent = groundedId !== null ? (idByNode.get(groundedId) ?? -1) : -1;
        const candidates = this.brain.world.getAll().filter((c) => {
            if (c.kind !== 'rect' || !c.flags.solid) return false;
            if ((c.aabb.x2 - c.aabb.x1) < MIN_PLATFORM_SIZE) return false;
            if (groundedId !== null && c.id === groundedId) return false;
            if (this.brain.recentWarpDestinations.includes(c.id)) return false;
            return true;
        });

        let best: { collider: Collider; score: number } | null = null;
        for (const c of candidates) {
            const cx = (c.aabb.x1 + c.aabb.x2) / 2;
            const dist = Math.hypot(cx - botCx, c.aabb.y1 - botFeetY);
            const compId = idByNode.get(c.id) ?? -1;
            const compSize = sizeByComponent.get(compId) ?? 1;
            const routePotential = this.brain.graph.nodes.has(c.id)
                ? Math.min(120, (this.brain.graph.nodes.get(c.id)?.edges.length ?? 0) * 9 + compSize * 2.2)
                : 0;
            const crossComponentBonus = compId !== currentComponent ? 180 : 0;
            const verticalBonus = c.aabb.y1 < botFeetY ? 36 : 0;
            const score = crossComponentBonus + routePotential + verticalBonus + Math.min(140, dist * 0.18);
            if (!best || score > best.score) {
                best = { collider: c, score };
            }
        }

        return best?.collider ?? null;
    }

    scoreTarget(pose: Pose, c: Collider, avgVisits: number, now: number, pathCost: number | null = null): number {
        const botCx = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const platCx = (c.aabb.x1 + c.aabb.x2) / 2;
        const platW = c.aabb.x2 - c.aabb.x1;
        const platH = c.aabb.y2 - c.aabb.y1;

        const dx = Math.abs(platCx - botCx);
        const dy = botFeetY - c.aabb.y1; // positive = platform is above bot
        const dist = Math.hypot(dx, dy);

        let score = 50; // Base score

        // 1. Distance — favor medium/long routes to reduce repetitive local loops.
        if (dist < 80) score -= 18;
        else if (dist < 220) score += 4;
        else if (dist < 520) score += 12;
        else if (dist < 900) score += 18;
        else if (dist < 1500) score += 12;
        else score += 4;

        // 2. Vertical gain — STRONG upward preference
        if (dy > 20) {
            const heightBonus = Math.min(dy * 0.12, 35);   // Up to +35 for height
            score += heightBonus;
            if (dy > 40 && dy <= MAX_SINGLE_HOP) score += 15; // Sweet spot for direct jump
            else if (dy > MAX_SINGLE_HOP) score += 8;         // Waypoint routing helps
        } else if (dy < -20) {
            score -= Math.min(Math.abs(dy) * 0.06, 20);
        }

        // 3. Novelty / anti-repeat
        const visits = this.brain.visitCounts.get(c.id) || 0;
        if (visits === 0) {
            score += 20;   // Never-visited bonus — actively seek new platforms
        } else {
            score -= Math.min(48, visits * 8);
        }
        const fairnessDelta = visits - avgVisits;
        if (fairnessDelta > 0.5) {
            score -= Math.min(22, fairnessDelta * 4);
        }
        if (this.brain.recentArrivals.slice(-12).includes(c.id)) {
            score -= 32;
        }

        // 4. Exploration — reward unvisited vertical territory
        if (c.aabb.y1 < this.brain.highestReached) {
            score += 20;
        }

        // 5. Commitment Stickiness (Hysteresis) to prevent Ping-Ponging
        if (this.brain.lockedTargetId !== null && c.id === this.brain.lockedTargetId) {
            score += 200; // Tremendous stickiness so the bot does not abandon a strategic target
        } else if (this.brain.targetPlatform !== null && c.id === this.brain.targetPlatform.id) {
            score += 150; // Stickiness for immediate waypoint
        }

        // 5. Reachability
        if (dy > 0 && dy <= MAX_SINGLE_HOP && dx < 500) {
            score += 10;
        }
        if (dy > MAX_SINGLE_HOP && dx < 100) {
            score += 5;
        }

        // 6. Path Complexity Penalty — avoid physically close targets that require convoluted graph traversal
        if (pathCost !== null) {
            const costExcess = Math.max(0, pathCost - dist);
            score -= (costExcess * 0.25);
        }

        // Penalize isolated/dead-end nodes to avoid selecting platforms that immediately trap reroutes.
        const node = this.brain.graph.nodes.get(c.id);
        if (!node) {
            score -= 22;
        } else {
            const viableExits = node.edges.reduce((count, e) => count + (e.invalidUntil <= now ? 1 : 0), 0);
            if (viableExits === 0) score -= 28;
            else if (viableExits === 1) score -= 10;
            else score += Math.min(8, (viableExits - 1) * 2);
        }

        // Avoid no-op picks that are almost on top of the bot and offer little progress.
        if (dist < 55 && Math.abs(dy) < 24) {
            score -= 24;
        }

        // Penalize highly vertical surfaces as primary targets (prevents wall-center lock).
        const verticalRatio = platH / Math.max(platW, 1);
        if (verticalRatio > 2.5) score -= 45;
        else if (verticalRatio > 1.7) score -= 20;

        // 7. Line of sight bonus
        const hasLOS = this.brain.world.hasLineOfSight(botCx, pose.y + pose.height / 2, platCx, c.aabb.y1);
        if (hasLOS) score += 10;

        const breadcrumbPenalty = this.brain.getBreadcrumbPenaltyForTarget(c.id, now);
        if (breadcrumbPenalty > 0) score -= breadcrumbPenalty;

        // 8. Random noise — breaks determinism across page refreshes.
        //    ±15 is enough to shuffle similarly-scored candidates without
        //    letting a bad platform beat a clearly better one.
        score += (Math.random() - 0.5) * 30;

        return score;
    }

    getRecentBlockedTargetIds(currentGroundedId: number | null): Set<number> {
        const blocked = new Set<number>();
        const recent = this.brain.recentArrivals.slice(-RECENT_TARGET_BLOCK_COUNT);
        for (const id of recent) blocked.add(id);

        if (currentGroundedId !== null) {
            this.brain.pruneRegionBlacklist();
            const unreachable = this.brain.recentUnreachable.get(currentGroundedId);
            if (unreachable) {
                const now = performance.now();
                for (const entry of unreachable) {
                    if (now - entry.time < REGION_BLACKLIST_TTL_MS) {
                        blocked.add(entry.targetId);
                    }
                }
            }

            const regionEntries = this.brain.regionBlacklist.get(currentGroundedId);
            if (regionEntries) {
                const now = performance.now();
                for (const entry of regionEntries.values()) {
                    if (entry.targetId !== null && entry.expiresAt > now) {
                        blocked.add(entry.targetId);
                    }
                }
            }
        }
        return blocked;
    }

    tryPickCoordinateTarget(pose: Pose, candidates: Collider[], preferFar: boolean, force: boolean = false): boolean {
        if (candidates.length === 0) return false;
        if (!force && performance.now() - this.brain.lastCoordinateFallbackTime < 8000) return false;

        const botCx = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const minDist = preferFar ? FAR_TARGET_MIN_DIST : 280;

        const strictRanked = candidates
            .filter(c => {
                if (c.kind !== 'rect' || !c.flags.solid) return false;
                if ((c.aabb.x2 - c.aabb.x1) < MIN_PLATFORM_SIZE) return false;
                if (pose.groundedId !== null && c.id === pose.groundedId) return false;
                if (this.brain.targetPlatform && c.id === this.brain.targetPlatform.id) return false;
                if (this.brain.recentWarpDestinations.includes(c.id)) return false;
                if (pose.groundedId !== null && this.brain.isRegionTargetBlacklisted(pose.groundedId, c.id)) return false;
                return true;
            })
            .map(c => {
                const cx = (c.aabb.x1 + c.aabb.x2) / 2;
                const cy = c.aabb.y1;
                const dist = Math.hypot(cx - botCx, cy - botFeetY);
                return { collider: c, dist };
            })
            .sort((a, b) => b.dist - a.dist);

        let ranked = strictRanked;
        if (ranked.length === 0) {
            ranked = candidates
                .filter(c => {
                    if (c.kind !== 'rect' || !c.flags.solid) return false;
                    if ((c.aabb.x2 - c.aabb.x1) < MIN_PLATFORM_SIZE) return false;
                    if (pose.groundedId !== null && c.id === pose.groundedId) return false;
                    if (this.brain.targetPlatform && c.id === this.brain.targetPlatform.id) return false;
                    return true;
                })
                .map(c => {
                    const cx = (c.aabb.x1 + c.aabb.x2) / 2;
                    const cy = c.aabb.y1;
                    const dist = Math.hypot(cx - botCx, cy - botFeetY);
                    return { collider: c, dist };
                })
                .sort((a, b) => b.dist - a.dist);
            if (ranked.length > 0) {
                this.brain.recordLog('RELAX_RECENCY', pose, 'coordinate fallback relaxed recent warp exclusions');
            }
        }

        if (ranked.length === 0) return false;
        const farPool = ranked.filter(r => r.dist >= minDist);
        const sourcePool = farPool.length > 0 ? farPool : ranked;
        const sampleLimit = Math.min(12, sourcePool.length);
        if (sampleLimit === 0) return false;

        for (let i = 0; i < sampleLimit; i++) {
            const pick = sourcePool[Math.floor(Math.random() * sampleLimit)];
            const base = pick.collider;
            const baseCx = (base.aabb.x1 + base.aabb.x2) / 2;
            const baseW = Math.max(20, base.aabb.x2 - base.aabb.x1);

            const xJitter = (Math.random() - 0.5) * Math.min(360, baseW + 240);
            const x = Math.max(20, Math.min(window.innerWidth - 20, baseCx + xJitter));

            const preferAbove = Math.random() < 0.75;
            const yCandidate = preferAbove
                ? base.aabb.y1 - (70 + Math.random() * 220)
                : base.aabb.y1 + (35 + Math.random() * 140);
            const y = Math.max(30, Math.min(window.innerHeight - 30, yCandidate));

            // Ensure target coordinate is in free space with enough room for the bot
            const probe: AABB = { x1: x - 12, y1: y - 42, x2: x + 12, y2: y + 2 };
            const blocked = this.brain.world.query(probe).some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);
            if (blocked) continue;

            const coordDist = Math.hypot(x - botCx, y - botFeetY);
            if (coordDist < minDist * 0.85) continue;

            this.brain.targetPlatform = null;
            this.brain.clearTargetLock();
            this.brain.targetX = x;
            this.brain.autoTargetY = y;
            this.brain.currentState = 'seek';
            this.brain.bestProgressDist = Infinity;
            this.brain.progressStagnationTimer = Math.max(this.brain.progressStagnationTimer, ESCALATION_TIMER_FLOOR);
            this.brain.fsmStagnationTimer = Math.max(this.brain.fsmStagnationTimer, ESCALATION_TIMER_FLOOR);
            this.brain.approachPhase = 'direct';
            this.brain.approachX = null;
            this.brain.seekDiagTimer = 0;
            this.brain.lastSeekPose = null;
            this.brain.stallTimer = 0;
            this.brain.facingFlipTimer = 0;
            this.brain.facingFlipCount = 0;
            this.brain.lastFacingSeen = 0;
            this.brain.loopWarned = false;
            this.brain.moveCommitDir = 0;
            this.brain.moveCommitTimer = 0;
            this.brain.dropEdgeX = null;
            this.brain.dropGroundId = null;
            this.brain.dropLockTimer = 0;
            this.brain.navState = 'nav-ready';
            this.brain.takeoffZone = null;
            this.brain.patienceTimer = 0;
            this.brain.breadcrumbStack = [];
            this.brain.rememberWarpDestination(base.id);
            this.brain.boostRecoveryPressure('coordinate-escape');

            this.brain.lastCoordinateFallbackTime = performance.now();
            // Force commitment to this recovery mode (suppress retargeting)
            this.brain.targetSelectFreezeTimer = Math.max(this.brain.targetSelectFreezeTimer, this.brain.islandModeActive ? ISLAND_MODE_FREEZE_SEC : 2.0);

            this.brain.resetManeuverTracking();
            this.brain.resetShaftClimbState();
            this.brain.resetTicTacState();
            this.brain.recordLog(
                'NEW_COORD_TARGET',
                pose,
                `coord(${Math.round(x)},${Math.round(y)}) base=ID${base.id} dist=${Math.round(coordDist)} far=${preferFar ? 'y' : 'n'}`
            );
            return true;
        }

        return false;
    }

    describeCandidateForLog(pose: Pose, s: { collider: Collider; score: number }): string {
        const c = s.collider;
        const botCx = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const cx = (c.aabb.x1 + c.aabb.x2) / 2;
        const dx = Math.round(cx - botCx);
        const dy = Math.round(botFeetY - c.aabb.y1);
        const prediction = this.brain.predictTrajectory(pose, cx);
        const reachable =
            prediction.landingX >= c.aabb.x1 - 20 &&
            prediction.landingX <= c.aabb.x2 + 20 &&
            Math.abs(prediction.landingY - c.aabb.y1) < 120;
        const hasLOS = this.brain.world.hasLineOfSight(botCx, pose.y + pose.height / 2, cx, c.aabb.y1);
        const landingDx = Math.round(prediction.landingX - cx);
        const landingDy = Math.round(prediction.landingY - c.aabb.y1);
        const width = Math.round(c.aabb.x2 - c.aabb.x1);
        const height = Math.round(c.aabb.y2 - c.aabb.y1);
        return `ID${c.id} s=${Math.round(s.score)} d=(${dx},${dy}) land=(${landingDx},${landingDy}) ${reachable ? 'reach' : 'nreach'} ${hasLOS ? 'los' : 'nlos'} ${c.flags.oneWay ? '1w' : 'solid'} sz=${width}x${height}`;
    }

    findWaypointBelow(pose: Pose, finalTarget: Collider): Collider | null {
        const botFeetY = pose.y + pose.height;
        const targetY = finalTarget.aabb.y1;
        const botCx = pose.x + pose.width / 2;

        // Search between bot and target vertically, prefer horizontally close
        const searchAABB: AABB = {
            x1: botCx - 500,
            y1: targetY,
            x2: botCx + 500,
            y2: botFeetY
        };

        const candidates = this.brain.world.query(searchAABB).filter(c => {
            if (c.id === finalTarget.id) return false;
            const w = c.aabb.x2 - c.aabb.x1;
            if (w < MIN_PLATFORM_SIZE) return false;
            // Must be above the bot
            if (c.aabb.y1 >= botFeetY - 10) return false;
            // Must be below the final target (it's a stepping stone)
            if (c.aabb.y1 <= targetY + 10) return false;
            // Must be within reachable hop height
            const hopHeight = botFeetY - c.aabb.y1;
            if (hopHeight > MAX_SINGLE_HOP) return false;
            if (hopHeight < 30) return false;
            // Don't re-pick the current platform
            if (pose.grounded && pose.groundedId === c.id) return false;
            return true;
        });

        if (candidates.length === 0) return null;

        // Score waypoints: prefer HIGH platforms that are HORIZONTALLY CLOSE.
        // Pure "pick highest" causes the bot to fly across the map for a barely-higher platform.
        candidates.sort((a, b) => {
            const aCx = (a.aabb.x1 + a.aabb.x2) / 2;
            const bCx = (b.aabb.x1 + b.aabb.x2) / 2;
            // Height gain (higher = lower y1 = better, want to maximize)
            const aHeight = botFeetY - a.aabb.y1;
            const bHeight = botFeetY - b.aabb.y1;
            // Horizontal distance penalty
            const aDx = Math.abs(aCx - botCx);
            const bDx = Math.abs(bCx - botCx);
            // Score: height gain minus horizontal penalty (weighted)
            const aScore = aHeight - aDx * 0.5;
            const bScore = bHeight - bDx * 0.5;
            return bScore - aScore; // Descending
        });
        return candidates[0];
    }
}