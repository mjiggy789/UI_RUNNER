import { Collider, AABB } from '@parkour-bot/shared';
import { World } from './world';

const NARROW_STEP_WIDTH = 52;
const VERY_NARROW_STEP_WIDTH = 36;
const PILLAR_ASPECT_RATIO = 2.4;
const NARROW_STEP_PENALTY = 120;
const VERY_NARROW_STEP_PENALTY = 90;
const PILLAR_STEP_PENALTY = 220;

const MIN_STAND_WIDTH = 20;
const TAKEOFF_PAD = 10;
const LANDING_PAD = 10;
const TAKEOFF_SAMPLE_STEP = 14;
const LANDING_SAMPLE_STEP = 18;
const MAX_JUMP_HORIZ = 340;
const MAX_JUMP_UP = 220;
const MAX_DROP = 920;
const MAX_WALL_JUMP_GAP = 260;
const MAX_WALL_JUMP_RISE = 320;
const WALLISH_WIDTH = 82;
const WALLISH_MIN_HEIGHT = 170;
const CONTROLLER_GRAVITY = 1500;
const CONTROLLER_JUMP_SPEED = 600;
const CONTROLLER_AIR_ACCEL = 800;
const CONTROLLER_AIR_SPEED = 350;
const CONTROLLER_WALL_KICK_SPEED = 525;
const BALLISTIC_STEP_SEC = 1 / 60;
const BALLISTIC_MAX_TIME_SEC = 2.0;
const BALLISTIC_LANDING_DEPTH = 240;
const LANDING_MARGIN_MIN = 6;
const LANDING_MARGIN_MAX = 12;
const EDGE_BACKOFF_BASE_MS = 5000;
const EDGE_BACKOFF_MULTIPLIER = 3;
const EDGE_BACKOFF_MAX_MS = 180000;
const EDGE_BACKOFF_DECAY_MS = 45000;
const EDGE_BACKOFF_MAX_STRIKES = 7;

export type NavAction =
    | 'walk'
    | 'drop-edge'
    | 'drop'
    | 'jump-gap'
    | 'jump-high'
    | 'jump-down'
    | 'wall-jump'
    | 'rail-latch';

export interface PlannerContext {
    jumpReady: boolean;
    airJumpsAvailable: number;
    railLatchReady: boolean;
}

export const DEFAULT_PLANNER_CONTEXT: PlannerContext = {
    jumpReady: true,
    airJumpsAvailable: 2,
    railLatchReady: true
};

export interface NavEdge {
    toId: number;
    action: NavAction;
    cost: number;
    invalidUntil: number;
    failureReason: string | null;
    maneuverId: string;
    takeoffMinX: number;
    takeoffMaxX: number;
    landingMinX: number;
    landingMaxX: number;
    takeoffY: number;
    landingY: number;
    facing: -1 | 1;
    requiresJump: boolean;
    requiredAirJumps: number;
    requiresRailLatch: boolean;
}

export interface NavNode {
    id: number;
    collider: Collider;
    edges: NavEdge[];
}

export interface NavPathOptions {
    maxStates?: number;
    context?: Partial<PlannerContext>;
}

export interface NavPathResult {
    nodes: number[];
    edges: NavEdge[];
    totalCost: number;
}

type PlannerState = {
    nodeId: number;
    jumpReady: boolean;
    airJumpsAvailable: number;
    railLatchReady: boolean;
};

type ParentRef = {
    fromKey: string;
    edge: NavEdge;
};

type BandResult = {
    takeoffMinX: number;
    takeoffMaxX: number;
    landingMinX: number;
    landingMaxX: number;
    takeoffY: number;
    landingY: number;
    facing: -1 | 1;
};

type EdgeBackoffState = {
    strikes: number;
    lastTs: number;
    lastCategory: string;
};

export class NavGraph {
    world: World;
    nodes: Map<number, NavNode> = new Map();
    lastUpdate: number = 0;
    private edgeBackoff: Map<string, EdgeBackoffState> = new Map();

    constructor(world: World) {
        this.world = world;
    }

    /**
     * Periodically rebuilds the maneuver graph from active colliders.
     * Edges store explicit takeoff/landing bands and execution requirements.
     */
    update(timeNow: number) {
        if (timeNow - this.lastUpdate < 1000) return;
        this.lastUpdate = timeNow;

        const newNodes = new Map<number, NavNode>();
        for (const [id, c] of this.world.colliders.entries()) {
            if (c.kind !== 'rect' || !c.flags.solid) continue;
            const existing = this.nodes.get(id);
            newNodes.set(id, {
                id,
                collider: c,
                // Keep active invalidations, then append newly discovered feasible maneuvers.
                edges: existing ? existing.edges.filter((e) => e.invalidUntil > timeNow) : []
            });
        }

        for (const [, node] of newNodes.entries()) {
            this.discoverEdges(node, newNodes, timeNow);
        }

        this.nodes = newNodes;
    }

    private discoverEdges(node: NavNode, allNodes: Map<number, NavNode>, timeNow: number) {
        const c1 = node.collider;
        const width1 = c1.aabb.x2 - c1.aabb.x1;
        if (width1 < MIN_STAND_WIDTH) return;

        const searchAABB: AABB = {
            x1: c1.aabb.x1 - MAX_JUMP_HORIZ - 40,
            x2: c1.aabb.x2 + MAX_JUMP_HORIZ + 40,
            y1: c1.aabb.y1 - MAX_WALL_JUMP_RISE - 160,
            y2: c1.aabb.y1 + MAX_DROP
        };

        const candidates = this.world.query(searchAABB);
        node.edges = node.edges.filter((e) => e.invalidUntil > timeNow);
        const blockedManeuvers = new Set(node.edges.map((e) => e.maneuverId));
        const existingManeuvers = new Set(node.edges.map((e) => e.maneuverId));

        for (const c2 of candidates) {
            if (c2.id === node.id || c2.kind !== 'rect' || !c2.flags.solid) continue;
            const width2 = c2.aabb.x2 - c2.aabb.x1;
            if (width2 < MIN_STAND_WIDTH) continue;

            const landingPenalty = this.getLandingPenalty(c2);
            const maybeEdge = this.buildManeuverEdge(c1, c2, landingPenalty);
            if (!maybeEdge) continue;
            if (blockedManeuvers.has(maybeEdge.maneuverId)) continue;
            if (existingManeuvers.has(maybeEdge.maneuverId)) continue;
            node.edges.push(maybeEdge);
            existingManeuvers.add(maybeEdge.maneuverId);
        }
    }

    public buildManeuverEdge(from: Collider, to: Collider, landingPenalty: number): NavEdge | null {
        const fromCenterX = (from.aabb.x1 + from.aabb.x2) / 2;
        const toCenterX = (to.aabb.x1 + to.aabb.x2) / 2;
        const dy = from.aabb.y1 - to.aabb.y1; // positive => target higher
        const dxGap = Math.max(0, Math.max(from.aabb.x1 - to.aabb.x2, to.aabb.x1 - from.aabb.x2));
        const centerDx = Math.abs(toCenterX - fromCenterX);
        const bands = this.findManeuverBands(from, to);
        if (!bands) return null;

        const fromIsWallish = this.isWallish(from);
        const toIsWallish = this.isWallish(to);
        let action: NavAction;
        let requiresJump = false;
        let requiredAirJumps = 0;
        let requiresRailLatch = false;
        let costBase = 0;

        if (Math.abs(dy) <= 14 && dxGap <= 42) {
            action = 'walk';
            costBase = dxGap + 12;
        } else if (dy < -18 && dxGap <= 54) {
            action = 'drop-edge';
            costBase = Math.abs(dy) * 0.45 + 18;
        } else if (dy < -18 && dy >= -MAX_DROP && centerDx <= MAX_JUMP_HORIZ + 20) {
            action = 'jump-down';
            requiresJump = true;
            costBase = Math.hypot(centerDx, -dy) * 0.7 + 45;
        } else if (
            dy > 18 &&
            (fromIsWallish || toIsWallish) &&
            centerDx <= MAX_WALL_JUMP_GAP &&
            dy <= MAX_WALL_JUMP_RISE
        ) {
            action = 'wall-jump';
            requiresJump = true;
            costBase = Math.hypot(centerDx, dy) * 1.7 + 86;
        } else if (dy > 18 && dy <= MAX_JUMP_UP && centerDx <= MAX_JUMP_HORIZ + 40) {
            action = 'jump-high';
            requiresJump = true;
            costBase = Math.hypot(centerDx, dy) * 1.95 + 88;
        } else if (centerDx <= MAX_JUMP_HORIZ + 60 && Math.abs(dy) <= 84) {
            action = 'jump-gap';
            requiresJump = true;
            costBase = centerDx * 1.48 + Math.abs(dy) * 0.6 + 52;
        } else {
            return null;
        }

        const takeoffSpan = Math.max(6, bands.takeoffMaxX - bands.takeoffMinX);
        const landingSpan = Math.max(6, bands.landingMaxX - bands.landingMinX);
        const bandPenalty = Math.max(0, 38 - takeoffSpan) * 1.1 + Math.max(0, 48 - landingSpan) * 0.9;

        return {
            toId: to.id,
            action,
            cost: costBase + landingPenalty + bandPenalty,
            invalidUntil: 0,
            failureReason: null,
            maneuverId: `${from.id}->${to.id}:${action}:${Math.round(bands.takeoffMinX)}-${Math.round(bands.takeoffMaxX)}:${Math.round(bands.landingMinX)}-${Math.round(bands.landingMaxX)}`,
            takeoffMinX: bands.takeoffMinX,
            takeoffMaxX: bands.takeoffMaxX,
            landingMinX: bands.landingMinX,
            landingMaxX: bands.landingMaxX,
            takeoffY: bands.takeoffY,
            landingY: bands.landingY,
            facing: bands.facing,
            requiresJump,
            requiredAirJumps,
            requiresRailLatch
        };
    }

    public findManeuverBands(from: Collider, to: Collider): BandResult | null {
        const fromMinX = from.aabb.x1 + TAKEOFF_PAD;
        const fromMaxX = from.aabb.x2 - TAKEOFF_PAD;
        const landingMin = to.aabb.x1 + LANDING_PAD;
        const landingMax = to.aabb.x2 - LANDING_PAD;
        if (fromMinX >= fromMaxX || landingMin >= landingMax) return null;

        const dy = from.aabb.y1 - to.aabb.y1;
        const landingSafetyPx = this.getLandingSafetyPx(to, dy);
        const safeLandingMin = landingMin + landingSafetyPx;
        const safeLandingMax = landingMax - landingSafetyPx;
        if (safeLandingMin >= safeLandingMax) return null;

        const fromCenterX = (from.aabb.x1 + from.aabb.x2) / 2;
        const toCenterX = (to.aabb.x1 + to.aabb.x2) / 2;
        const facing: -1 | 1 = toCenterX >= fromCenterX ? 1 : -1;
        const edgeAnchor = facing > 0 ? fromMaxX : fromMinX;
        const takeoffMin = Math.max(fromMinX, edgeAnchor + (facing > 0 ? -58 : -8));
        const takeoffMax = Math.min(fromMaxX, edgeAnchor + (facing > 0 ? 8 : 58));
        if (takeoffMin >= takeoffMax) return null;

        const takeoffY = from.aabb.y1 - 6;
        const landingY = to.aabb.y1 - 6;
        const allowWallKickEnvelope = this.isWallish(from) || this.isWallish(to);
        const validTakeoffXs: number[] = [];
        const validLandingXs: number[] = [];

        for (let tx = takeoffMin; tx <= takeoffMax + 0.001; tx += TAKEOFF_SAMPLE_STEP) {
            if (!this.hasTakeoffHeadroom(tx, from)) continue;
            const ballisticWindow = this.getBallisticLandingWindow(
                tx,
                takeoffY,
                landingY,
                facing,
                allowWallKickEnvelope
            );
            if (!ballisticWindow) continue;

            const ballisticLandingMin = Math.max(safeLandingMin, ballisticWindow.minX);
            const ballisticLandingMax = Math.min(safeLandingMax, ballisticWindow.maxX);
            if (ballisticLandingMin >= ballisticLandingMax) continue;

            const landingSamples = this.getLandingSamples(ballisticLandingMin, ballisticLandingMax);
            for (const lx of landingSamples) {
                if (!this.world.hasLineOfSight(tx, takeoffY, lx, landingY)) continue;
                if (!this.hasTravelClearance(tx, takeoffY, lx, landingY, from.id, to.id)) continue;
                validTakeoffXs.push(tx);
                validLandingXs.push(lx);
            }
        }

        if (validTakeoffXs.length === 0 || validLandingXs.length === 0) return null;
        return {
            takeoffMinX: Math.max(takeoffMin, Math.min(...validTakeoffXs)),
            takeoffMaxX: Math.min(takeoffMax, Math.max(...validTakeoffXs)),
            landingMinX: Math.max(landingMin, Math.min(...validLandingXs)),
            landingMaxX: Math.min(landingMax, Math.max(...validLandingXs)),
            takeoffY,
            landingY,
            facing
        };
    }

    private getLandingSafetyPx(target: Collider, dy: number): number {
        const width = target.aabb.x2 - target.aabb.x1;
        let safety = 8;
        if (Math.abs(dy) > 120) safety += 2;
        if (width <= 90) safety += 1;
        if (width <= 62) safety += 2;
        return Math.max(LANDING_MARGIN_MIN, Math.min(LANDING_MARGIN_MAX, safety));
    }

    private getLandingSamples(minX: number, maxX: number): number[] {
        const mid = (minX + maxX) / 2;
        if (maxX - minX < 8) return [mid];
        const edgeInset = Math.min(6, (maxX - minX) * 0.25);
        return [minX + edgeInset, mid, maxX - edgeInset];
    }

    private getBallisticLandingWindow(
        takeoffX: number,
        takeoffY: number,
        landingY: number,
        facing: -1 | 1,
        allowWallKick: boolean
    ): { minX: number; maxX: number } | null {
        const speedSeeds = allowWallKick
            ? [0, 120, 220, 320, CONTROLLER_AIR_SPEED, CONTROLLER_WALL_KICK_SPEED]
            : [0, 120, 220, 320, CONTROLLER_AIR_SPEED];
        const landingXs: number[] = [];

        for (const seed of speedSeeds) {
            let x = takeoffX;
            let y = takeoffY;
            let vx = facing * seed;
            let vy = -CONTROLLER_JUMP_SPEED;
            let prevX = x;
            let prevY = y;

            for (let t = BALLISTIC_STEP_SEC; t <= BALLISTIC_MAX_TIME_SEC; t += BALLISTIC_STEP_SEC) {
                const targetVx = facing * CONTROLLER_AIR_SPEED;
                if (vx < targetVx) vx = Math.min(targetVx, vx + CONTROLLER_AIR_ACCEL * BALLISTIC_STEP_SEC);
                else if (vx > targetVx) vx = Math.max(targetVx, vx - CONTROLLER_AIR_ACCEL * BALLISTIC_STEP_SEC);

                vy += CONTROLLER_GRAVITY * BALLISTIC_STEP_SEC;
                x += vx * BALLISTIC_STEP_SEC;
                y += vy * BALLISTIC_STEP_SEC;

                // Detect descending intersection with the candidate landing Y.
                if (vy >= 0 && prevY <= landingY && y >= landingY) {
                    const denom = y - prevY;
                    const alpha = Math.abs(denom) < 1e-6 ? 1 : Math.max(0, Math.min(1, (landingY - prevY) / denom));
                    const landingX = prevX + (x - prevX) * alpha;
                    landingXs.push(landingX);
                    break;
                }

                // Bail once we are clearly below and falling away from the landing plane.
                if (vy >= 0 && y > landingY + BALLISTIC_LANDING_DEPTH) break;

                prevX = x;
                prevY = y;
            }
        }

        if (landingXs.length === 0) return null;
        return {
            minX: Math.min(...landingXs),
            maxX: Math.max(...landingXs)
        };
    }

    private hasTakeoffHeadroom(takeoffX: number, from: Collider): boolean {
        const probe: AABB = {
            x1: takeoffX - 11,
            x2: takeoffX + 11,
            y1: from.aabb.y1 - 56,
            y2: from.aabb.y1 - 2
        };
        const blockers = this.world.query(probe);
        for (const c of blockers) {
            if (c.id === from.id) continue;
            if (c.kind !== 'rect' || !c.flags.solid || c.flags.oneWay) continue;
            return false;
        }
        return true;
    }

    private hasTravelClearance(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        fromId: number,
        toId: number
    ): boolean {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist <= 1) return true;
        const steps = Math.max(3, Math.ceil(dist / 30));

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const px = x1 + dx * t;
            const py = y1 + dy * t;
            const probe: AABB = {
                x1: px - 8,
                x2: px + 8,
                y1: py - 14,
                y2: py + 10
            };
            const hits = this.world.query(probe);
            for (const c of hits) {
                if (c.id === fromId || c.id === toId) continue;
                if (c.kind !== 'rect' || !c.flags.solid) continue;
                // Allow upward pass through one-way floors.
                if (c.flags.oneWay && py < c.aabb.y1 + 2) continue;
                return false;
            }
        }
        return true;
    }

    public isWallish(c: Collider): boolean {
        const width = c.aabb.x2 - c.aabb.x1;
        const height = c.aabb.y2 - c.aabb.y1;
        return !c.flags.oneWay && width <= WALLISH_WIDTH && height >= WALLISH_MIN_HEIGHT;
    }

    public getLandingPenalty(c: Collider): number {
        const width = c.aabb.x2 - c.aabb.x1;
        const height = c.aabb.y2 - c.aabb.y1;
        const aspect = height / Math.max(width, 1);

        let penalty = 0;
        if (width <= NARROW_STEP_WIDTH) penalty += NARROW_STEP_PENALTY;
        if (width <= VERY_NARROW_STEP_WIDTH) penalty += VERY_NARROW_STEP_PENALTY;
        if (!c.flags.oneWay && width <= NARROW_STEP_WIDTH + 8 && aspect >= PILLAR_ASPECT_RATIO) {
            penalty += PILLAR_STEP_PENALTY;
        }
        return penalty;
    }

    private isEdgeExecutable(edge: NavEdge, context: PlannerContext): boolean {
        if (edge.requiresRailLatch && !context.railLatchReady) return false;
        if (edge.requiredAirJumps > context.airJumpsAvailable) return false;
        if (edge.requiresJump && !context.jumpReady && edge.requiredAirJumps === 0) return false;
        return true;
    }

    private makeStateKey(state: PlannerState): string {
        return `${state.nodeId}|j${state.jumpReady ? 1 : 0}|a${state.airJumpsAvailable}|r${state.railLatchReady ? 1 : 0}`;
    }

    private applyEdgeState(state: PlannerState, edge: NavEdge): PlannerState {
        let jumpReady = state.jumpReady;
        let airJumpsAvailable = state.airJumpsAvailable;

        if (edge.requiresJump) {
            if (state.jumpReady) {
                jumpReady = false;
            }
            if (edge.requiredAirJumps > 0) {
                airJumpsAvailable = Math.max(0, airJumpsAvailable - edge.requiredAirJumps);
            }
        } else {
            // Regain jump-ready when pathing through non-jump edges.
            jumpReady = true;
        }

        return {
            nodeId: edge.toId,
            jumpReady,
            airJumpsAvailable,
            railLatchReady: state.railLatchReady
        };
    }

    private heuristic(nodeId: number, tx: number, ty: number): number {
        const node = this.nodes.get(nodeId);
        if (!node) return Infinity;
        const c = node.collider;
        const cx = (c.aabb.x1 + c.aabb.x2) / 2;
        const cy = c.aabb.y1;
        const dx = Math.abs(cx - tx);
        const dy = cy - ty;
        return dx + (dy > 0 ? dy * 3 : Math.abs(dy) * 0.5);
    }

    private mergeContext(context?: Partial<PlannerContext>): PlannerContext {
        return {
            jumpReady: context?.jumpReady ?? DEFAULT_PLANNER_CONTEXT.jumpReady,
            airJumpsAvailable: context?.airJumpsAvailable ?? DEFAULT_PLANNER_CONTEXT.airJumpsAvailable,
            railLatchReady: context?.railLatchReady ?? DEFAULT_PLANNER_CONTEXT.railLatchReady
        };
    }

    private getEdgeBackoffKey(fromId: number, toId: number, maneuverId?: string): string {
        return maneuverId ? `${fromId}->${toId}|${maneuverId}` : `${fromId}->${toId}`;
    }

    private classifyFailureReason(reason: string): string {
        const tag = reason.toLowerCase();
        if (tag.includes('undershoot') || tag.includes('short')) return 'short';
        if (tag.includes('overshoot') || tag.includes('long')) return 'long';
        if (tag.includes('ceiling') || tag.includes('bonk')) return 'bonk';
        if (tag.includes('blocked') || tag.includes('wall')) return 'blocked';
        if (tag.includes('timeout') || tag.includes('stuck')) return 'stall';
        if (tag.includes('trajectory')) return 'trajectory';
        return 'generic';
    }

    private computeBackoffDuration(key: string, reason: string, requestedMs: number, now: number): { durationMs: number; strikes: number; category: string } {
        const category = this.classifyFailureReason(reason);
        const prev = this.edgeBackoff.get(key);

        let strikes = 1;
        if (prev) {
            const decaySteps = Math.floor((now - prev.lastTs) / EDGE_BACKOFF_DECAY_MS);
            const decayed = Math.max(0, prev.strikes - decaySteps);
            strikes = Math.min(EDGE_BACKOFF_MAX_STRIKES, decayed + 1);
        }

        const base = Math.max(EDGE_BACKOFF_BASE_MS, requestedMs);
        const durationMs = Math.min(
            EDGE_BACKOFF_MAX_MS,
            base * Math.pow(EDGE_BACKOFF_MULTIPLIER, Math.max(0, strikes - 1))
        );

        this.edgeBackoff.set(key, {
            strikes,
            lastTs: now,
            lastCategory: category
        });

        return { durationMs, strikes, category };
    }

    /**
     * Temporarily blacklist an edge. If maneuverId is provided, invalidate only that maneuver.
     */
    invalidateEdge(
        fromId: number,
        toId: number,
        reason: string,
        durationMs: number = 5000,
        maneuverId?: string
    ) {
        const node = this.nodes.get(fromId);
        if (!node) return;

        const now = performance.now();
        const edgeKey = this.getEdgeBackoffKey(fromId, toId, maneuverId);
        const backoff = this.computeBackoffDuration(edgeKey, reason, durationMs, now);
        let edge: NavEdge | undefined;
        if (maneuverId) {
            edge = node.edges.find((e) => e.toId === toId && e.maneuverId === maneuverId);
        } else {
            edge = node.edges
                .filter((e) => e.toId === toId)
                .sort((a, b) => a.cost - b.cost)[0];
        }

        if (edge) {
            edge.invalidUntil = now + backoff.durationMs;
            edge.failureReason = `${reason}:${backoff.category}:x${backoff.strikes}`;
            return;
        }

        node.edges.push({
            toId,
            action: 'walk',
            cost: Infinity,
            invalidUntil: now + backoff.durationMs,
            failureReason: `${reason}:${backoff.category}:x${backoff.strikes}`,
            maneuverId: maneuverId ?? `blocked:${fromId}->${toId}`,
            takeoffMinX: 0,
            takeoffMaxX: 0,
            landingMinX: 0,
            landingMaxX: 0,
            takeoffY: 0,
            landingY: 0,
            facing: 1,
            requiresJump: false,
            requiredAirJumps: 0,
            requiresRailLatch: false
        });
    }

    getBestEdge(
        fromId: number,
        toId: number,
        context?: Partial<PlannerContext>,
        timeNow: number = performance.now()
    ): NavEdge | null {
        const node = this.nodes.get(fromId);
        if (!node) return null;
        const merged = this.mergeContext(context);
        const edges = node.edges
            .filter((e) => e.toId === toId && e.invalidUntil <= timeNow && this.isEdgeExecutable(e, merged))
            .sort((a, b) => a.cost - b.cost);
        return edges[0] ?? null;
    }

    getOutgoingEdges(
        fromId: number,
        context?: Partial<PlannerContext>,
        timeNow: number = performance.now()
    ): NavEdge[] {
        const node = this.nodes.get(fromId);
        if (!node) return [];
        const merged = this.mergeContext(context);
        return node.edges
            .filter((e) => e.invalidUntil <= timeNow && this.isEdgeExecutable(e, merged))
            .sort((a, b) => a.cost - b.cost);
    }

    /**
     * A* pathfinding where node expansion includes cooldown/action resources.
     */
    findPathDetailed(startId: number, targetId: number, options?: NavPathOptions): NavPathResult | null {
        if (!this.nodes.has(startId) || !this.nodes.has(targetId)) return null;
        if (startId === targetId) return { nodes: [startId], edges: [], totalCost: 0 };

        const maxStates = options?.maxStates ?? 160;
        const context = this.mergeContext(options?.context);
        const targetNode = this.nodes.get(targetId)!;
        const tx = (targetNode.collider.aabb.x1 + targetNode.collider.aabb.x2) / 2;
        const ty = targetNode.collider.aabb.y1;
        const timeNow = performance.now();

        const startState: PlannerState = {
            nodeId: startId,
            jumpReady: context.jumpReady,
            airJumpsAvailable: Math.max(0, context.airJumpsAvailable),
            railLatchReady: context.railLatchReady
        };

        const startKey = this.makeStateKey(startState);
        const openSet = new Set<string>([startKey]);
        const stateByKey = new Map<string, PlannerState>([[startKey, startState]]);
        const cameFrom = new Map<string, ParentRef>();
        const gScore = new Map<string, number>([[startKey, 0]]);
        const fScore = new Map<string, number>([[startKey, this.heuristic(startId, tx, ty)]]);

        let expanded = 0;
        while (openSet.size > 0 && expanded++ < maxStates) {
            let currentKey = '';
            let currentF = Infinity;
            for (const key of openSet) {
                const score = fScore.get(key) ?? Infinity;
                if (score < currentF) {
                    currentF = score;
                    currentKey = key;
                }
            }
            if (!currentKey) break;

            const currentState = stateByKey.get(currentKey);
            if (!currentState) {
                openSet.delete(currentKey);
                continue;
            }

            if (currentState.nodeId === targetId) {
                return this.reconstructDetailedPath(currentKey, cameFrom, gScore);
            }

            openSet.delete(currentKey);
            const node = this.nodes.get(currentState.nodeId);
            if (!node) continue;

            for (const edge of node.edges) {
                if (edge.invalidUntil > timeNow) continue;
                if (!this.isEdgeExecutable(edge, currentState)) continue;

                const nextState = this.applyEdgeState(currentState, edge);
                const nextKey = this.makeStateKey(nextState);
                if (!stateByKey.has(nextKey)) stateByKey.set(nextKey, nextState);

                const tentativeG = (gScore.get(currentKey) ?? Infinity) + edge.cost;
                const prevG = gScore.get(nextKey) ?? Infinity;
                if (tentativeG >= prevG) continue;

                cameFrom.set(nextKey, { fromKey: currentKey, edge });
                gScore.set(nextKey, tentativeG);
                fScore.set(nextKey, tentativeG + this.heuristic(nextState.nodeId, tx, ty));
                openSet.add(nextKey);
            }
        }

        return null;
    }

    findPath(startId: number, targetId: number, maxNodes: number = 50): number[] | null {
        const detailed = this.findPathDetailed(startId, targetId, {
            maxStates: Math.max(80, maxNodes * 3),
            context: DEFAULT_PLANNER_CONTEXT
        });
        return detailed ? detailed.nodes : null;
    }

    estimateCost(startId: number, targetId: number, context?: Partial<PlannerContext>): number {
        const detailed = this.findPathDetailed(startId, targetId, { maxStates: 200, context });
        return detailed ? detailed.totalCost : Infinity;
    }

    private reconstructDetailedPath(
        finalKey: string,
        cameFrom: Map<string, ParentRef>,
        gScore: Map<string, number>
    ): NavPathResult {
        const nodes: number[] = [];
        const edges: NavEdge[] = [];
        let curr = finalKey;

        const parseNode = (key: string) => {
            const nodePart = key.split('|')[0];
            return Number(nodePart);
        };

        nodes.unshift(parseNode(curr));
        while (cameFrom.has(curr)) {
            const parent = cameFrom.get(curr)!;
            edges.unshift(parent.edge);
            curr = parent.fromKey;
            nodes.unshift(parseNode(curr));
        }

        return {
            nodes,
            edges,
            totalCost: gScore.get(finalKey) ?? Infinity
        };
    }
}
