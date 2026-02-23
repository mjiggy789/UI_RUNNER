import { Pose } from './controller';
import { World } from './world';
import { LocalSolver } from './local-solver';
import type { WorldChecksum } from './world-checksum';
import { NavGraph, NavEdge, PlannerContext, NavPathResult } from './planner';
import { Collider, AABB } from '@parkour-bot/shared';

const VIEW_DIST = 1900;
const MAX_LOG_ENTRIES = 260;
const MIN_PLATFORM_SIZE = 20;
const MAX_SINGLE_HOP = 200;  // Max height a double-jump can cover (~200px with physics)
const MAX_TOTAL_JUMPS = 3;
const GAUGED_JUMP_MIN = 0.2;
const GAUGED_JUMP_MAX = 0.7;
const PLANNER_GRAVITY = 1500;
const PLANNER_FULL_JUMP_SPEED = 600;
const GAUGE_TIME_MIN = 0.16;
const GAUGE_TIME_MAX = 0.66;
const GAUGE_TIME_STEP = 0.04;
const RECENT_TARGET_BLOCK_COUNT = 8;
const FAR_TARGET_MIN_DIST = 700;
const COORD_TARGET_BASE_PROB = 0.18;
const COORD_TARGET_REPEAT_BONUS = 0.28;
const COORD_TARGET_FAR_BONUS = 0.1;
const ENABLE_COORDINATE_TARGETS = false;
const SEEK_DIAG_INTERVAL = 1.35;
const SEEK_TIMEOUT_NEAR_DX = 150;
const SEEK_TIMEOUT_NEAR_DY = 210;
const SEEK_TIMEOUT_RETRY_GRACE = 2;
const SEEK_TIMEOUT_NEAR_EXTEND = 2.8;
const SEEK_TIMEOUT_PROGRESS_EXTEND = 3.8;
const SEEK_TIMEOUT_REROUTE_EXTEND = 5.2;
const SEEK_TIMEOUT_PROGRESS_VX = 85;
const LOOP_WARN_STALL = 1.0;
const LOOP_WARN_FLIPS = 3;
const LOOP_DETECT_STALL = 1.6;
const LOOP_DETECT_FLIPS = 5;
const LOOP_RECOVERY_COOLDOWN = 2.5;
const CEILING_BONK_WINDOW = 0.8;
const CEILING_BONK_REROUTE_HITS = 3;
const CEILING_BONK_SUPPRESS_BASE = 0.3;
const CEILING_BONK_SUPPRESS_STEP = 0.15;
const CEILING_ARC_PROBE_TIME = 0.62;
const CEILING_ARC_PROBE_SAMPLES = 10;
const CEILING_ARC_PROBE_HALF_WIDTH = 9;
const CEILING_ARC_PROBE_HEIGHT_ABOVE = 20;
const CEILING_ARC_PROBE_HEIGHT_BELOW = 2;
const CEILING_ARC_GRAVITY = 1500;
const CEILING_ARC_JUMP_SPEED = 600;
const CEILING_ARC_AIR_ACCEL = 800;
const CEILING_ARC_TARGET_VX = 350;
const CEILING_ARC_INVALIDATE_COOLDOWN = 0.9;
const STEER_DEADZONE_BASE = 18;
const STEER_DEADZONE_NEAR = 36;
const STEER_DEADZONE_SLIDE = 34;
const STEER_COMMIT_HOLD_BASE = 0.24;
const STEER_COMMIT_HOLD_NEAR = 0.32;
const STEER_COMMIT_STICKY_EXTRA = 14;
const STEER_COMMIT_FLIP_GUARD = 150;
const NAV_ZONE_EXIT_MARGIN = 26;
const NAV_ZONE_SLIP_GRACE = 0.22;
const WALL_DECISION_COOLDOWN = 0.22;
const WALL_DECISION_COOLDOWN_FAST = 0.12;
const WALL_CLIMB_PREFER_HEIGHT = 16;
const WALL_HOP_RETRY_HEIGHT = 26;
const WALL_SLIDE_HOP_DOWNWARD_SPEED = 120;
const WALL_SLIDE_FORCE_HOP_TIME = 0.11;
const WALL_TARGET_BIAS_DIST = 70;
const WALL_TARGET_MIN_DX = 120;
const CEILING_ESCAPE_LATCH = 0.28;
const WALL_STEP_MAX_WIDTH = 76;
const WALL_STEP_MIN_HEIGHT = 170;
const WALL_STEP_MIN_ASPECT = 2.1;
const WALL_STEP_FACE_OFFSET = 14;
const WALL_STEP_LAUNCH_DIST = 60;
const WALL_STEP_LAUNCH_MIN_VX = 120;
const OVERHEAD_LOCK_MAX_DX = 34;
const OVERHEAD_LOCK_MIN_HEIGHT = 14;
const OVERHEAD_LOCK_MAX_HEIGHT = 240;
const WAYPOINT_STICKY_MS = 2500;
const TIC_TAC_MIN_HEIGHT = 54;
const TIC_TAC_SCAN_DIST = 220;
const TIC_TAC_MIN_OVERLAP_Y = 12;
const TIC_TAC_MIN_GAP_WIDTH = 65;
const TIC_TAC_MAX_GAP_WIDTH = 280;
const TIC_TAC_WALL_HOLD_TIME = 0.08;
const TIC_TAC_JUMP_COOLDOWN = 0.09;
const TIC_TAC_PERSIST_TIME = 0.28;
const SHAFT_MIN_EXTRA_WIDTH = 8;
const SHAFT_EXIT_MARGIN = 18;
const SHAFT_HOP_COOLDOWN = 0.16;
const SHAFT_STALL_WINDOW = 1.1;
const SHAFT_MIN_VERTICAL_GAIN = 8;
const MANEUVER_STALL_WINDOW = 1.1;
const MANEUVER_MIN_DIST_IMPROVEMENT = 4;
const MANEUVER_MIN_VERTICAL_GAIN = 6;
const WAYPOINT_SWITCH_HOLD_MS = 1350;
const WAYPOINT_SWITCH_MARGIN = 85;
const WAYPOINT_RECENT_SWITCH_WINDOW_MS = 3200;
const WAYPOINT_RECENT_SWITCH_PENALTY = 140;
const DOWN_SEAL_SAMPLE_STEP = 18;
const DOWN_SEAL_SCAN_DEPTH = 26;
const DOWN_SEAL_SAMPLE_HALF = 3;
const DOWN_SEAL_SIDE_WALL_DEPTH = 90;
const DOWN_SEAL_MIN_COVERAGE = 0.92;
const DOWN_SEAL_MAX_OPEN_RUN = 1;
const DOWN_SEAL_REROUTE_COOLDOWN = 0.9;
const EDGE_DROP_INTENT_STUCK_WINDOW = 0.72;
const EDGE_DROP_INTENT_FALL_VY = 55;
const BOT_STAND_WIDTH = 20;
const BOT_STAND_HEIGHT = 40;
const MANUAL_SAFE_HEADROOM = 44;
const MANUAL_SAFE_LEDGE_WIDTH = 34;
const MANUAL_SAFE_EDGE_MARGIN = 12;
const MANUAL_SNAP_RADIUS_X = 260;
const MANUAL_SNAP_RADIUS_Y = 320;
const BREADCRUMB_COST_LOOKBACK = 5;
const BREADCRUMB_COST_EDGE_INVALID_MS = 7000;
const BREADCRUMB_COST_TTL_MS = 10000;
const BREADCRUMB_COST_BASE = 48;
const BREADCRUMB_COST_STEP = 12;
const BREADCRUMB_COST_MAX = 170;
const LOOP_SIGNATURE_WINDOW_MS = 60000;
const LOOP_SIGNATURE_ESCALATE_COUNT = 5;
const LOOP_FALLBACK_IDLE_MIN = 0.22;
const LOOP_FALLBACK_IDLE_MAX = 0.45;
const WORLD_CHECKSUM_COLLIDER_TOL = 2;
const WORLD_CHECKSUM_ONEWAY_TOL = 1;
const WORLD_CHECKSUM_DRIFT_CONFIRM_REVISIONS = 2;
const WORLD_CHECKSUM_REPLAN_COOLDOWN = 0.55;
const PROGRESS_WINDOW_TICKS = 36;
const PROGRESS_SCALAR_EPS = 4;
const PROGRESS_REPLAN_EPS = 8;
const PROGRESS_REPLAN_GATE_TICKS = 10;
const PROGRESS_FLAT_RESET_TICKS = 52;
const PROGRESS_RESET_COOLDOWN = 0.9;
const PING_PONG_COMMIT_MIN = 0.65;
const PING_PONG_COMMIT_MAX = 1.1;

export interface BrainLogEntry {
    time: string;
    event: string;
    botX: number;
    botY: number;
    botVx: number;
    botVy: number;
    botState: string;
    targetId: number | null;
    targetX: number | null;
    targetY: number | null;
    lockId: number | null;
    targetDx: number | null;
    targetDy: number | null;
    brainState: string;
    phase: string;
    grounded: boolean;
    groundedId: number | null;
    retry: number;
    timer: number;
    detail: string;
}

type BrainInput = {
    left: boolean;
    right: boolean;
    jump: boolean;
    down: boolean;
    up: boolean;
    jumpGauge: number | null;
};

type ProgressSample = {
    absDx: number;
    absDy: number;
    dist: number;
};

type CeilingArcProbeResult = {
    blocked: boolean;
    clearance: number;
};

type CorridorProbeResult = {
    leftDist: number;
    rightDist: number;
    width: number;
    leftWallX: number;
    rightWallX: number;
};

type DownSealResult = {
    sealed: boolean;
    coverage: number;
    leftWall: boolean;
    rightWall: boolean;
    openRun: number;
};

type ManualStandPose = {
    platform: Collider;
    x: number;
    y: number;
    normalX: number;
    normalY: number;
    ledgeWidth: number;
    requiresHeadroom: boolean;
    score: number;
};

type TransitionTrace = {
    fromId: number;
    toId: number;
};

type BreadcrumbPenaltyState = {
    value: number;
    appliedAt: number;
    expiresAt: number;
};

export interface BrainDebugAABB {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface BrainDebugSnapshot {
    tick: number;
    state: 'idle' | 'seek';
    poseState: Pose['state'];
    navState: string;
    approachPhase: 'direct' | 'backup' | 'charge';
    botCenterX: number;
    botFeetY: number;
    targetX: number | null;
    targetY: number | null;
    targetDx: number | null;
    heightDiff: number | null;
    navTargetX: number | null;
    moveDx: number | null;
    moveDir: -1 | 0 | 1;
    shouldMoveHorizontally: boolean;
    deadzone: number | null;
    stickyBand: number | null;
    wallDir: -1 | 0 | 1;
    wallProbeLeft: BrainDebugAABB | null;
    wallProbeRight: BrainDebugAABB | null;
    wallProbeLeftHit: boolean;
    wallProbeRightHit: boolean;
    ticTacEligible: boolean;
    ticTacActive: boolean;
    ticTacDir: -1 | 0 | 1;
    ticTacWallHoldTimer: number;
    ticTacJumpTimer: number;
    ticTacPersistTimer: number;
    ticTacCorridorWidth: number | null;
    ticTacCorridorLeft: number | null;
    ticTacCorridorRight: number | null;
    shaftActive: boolean;
    shaftDir: -1 | 0 | 1;
    shaftCorridorWidth: number | null;
    overheadAligned: boolean;
    overheadProbe: BrainDebugAABB | null;
    overheadBlocked: boolean;
    ceilingHeadProbe: BrainDebugAABB | null;
    ceilingBlocked: boolean;
    ceilingEscapeWallProbeLeft: BrainDebugAABB | null;
    ceilingEscapeWallProbeRight: BrainDebugAABB | null;
    ceilingEscapeWallLeft: boolean;
    ceilingEscapeWallRight: boolean;
    ceilingArcBlocked: boolean;
    ceilingArcClearanceLeft: number | null;
    ceilingArcClearanceRight: number | null;
    airTuckProbe: BrainDebugAABB | null;
    airTuckWanted: boolean;
    gapProbe: BrainDebugAABB | null;
    gapProbeHasGround: boolean | null;
    dropPlannedEdgeX: number | null;
    dropDirection: -1 | 0 | 1;
    takeoffZone: { minX: number; maxX: number; facing: 1 | -1 } | null;
    maneuverId: string | null;
    maneuverFromId: number | null;
    maneuverToId: number | null;
    maneuverDistToTakeoff: number | null;
    maneuverLOS: boolean;
    maneuverVerticalGain: number | null;
    maneuverStagnation: number;
    maneuverCommitted?: boolean;
    timers: {
        progressStagnation: number;
        jumpCooldown: number;
        wallDecision: number;
        wallSlide: number;
        ceilingSuppress: number;
        retryCount: number;
    };
}

export class Brain {
    world: World;
    targetPlatform: Collider | null = null;
    lockedTargetId: number | null = null;
    targetX: number | null = null;
    isFirstTarget: boolean = true;
    currentState: 'idle' | 'seek' = 'idle';
    bestProgressDist: number = Infinity;
    progressStagnationTimer: number = 0;
    fsmStagnationTimer: number = 0;
    hitConfirmedTimer: number = 0;
    lastHitId: number | null = null;
    jumpCooldown: number = 0;
    retryCount: number = 0;
    strictMode: boolean = false;
    platformHistory: number[] = [];
    recentArrivals: number[] = [];
    recentWarpDestinations: number[] = [];
    visitCounts: Map<number, number> = new Map();  // ID → visit count
    highestReached: number = Infinity;              // lowest Y value (highest point) bot has stood on
    log: BrainLogEntry[] = [];
    manualMode: boolean = false;
    manualTargetY: number | null = null;
    autoTargetY: number | null = null;
    approachPhase: 'direct' | 'backup' | 'charge' = 'direct';
    approachX: number | null = null;
    moveCommitDir: -1 | 0 | 1 = 0;
    moveCommitTimer: number = 0;
    dropEdgeX: number | null = null;
    dropGroundId: number | null = null;
    dropLockTimer: number = 0;
    seekDiagTimer: number = 0;
    lastSeekPose: { x: number; y: number } | null = null;
    stallTimer: number = 0;
    facingFlipTimer: number = 0;
    facingFlipCount: number = 0;
    lastFacingSeen: 1 | -1 | 0 = 0;
    loopCooldown: number = 0;
    loopWarned: boolean = false;
    lastModeSeen: 'idle' | 'seek' | null = null;
    lastBehaviorSeen: Pose['state'] | null = null;
    lastFormSeen: string | null = null;
    lastSupportSeen: string | null = null;
    lastIntentSeen: string | null = null;
    ceilingBonkWindow: number = 0;
    ceilingBonkCount: number = 0;
    ceilingJumpSuppressTimer: number = 0;
    navSlipTimer: number = 0;
    wallDecisionTimer: number = 0;
    ceilingEscapeTimer: number = 0;
    ceilingEscapeDir: -1 | 0 | 1 = 0;
    ceilingArcInvalidateTimer: number = 0;
    wallSlideTimer: number = 0;
    waypointStickyUntil: number = 0;
    waypointOriginId: number | null = null;
    lastWaypointSwitchTime: number = 0;
    waypointSwitchTimes: number[] = [];
    ticTacActive: boolean = false;
    ticTacDir: -1 | 0 | 1 = 0;
    ticTacJumpTimer: number = 0;
    ticTacPersistTimer: number = 0;
    ticTacWallHoldTimer: number = 0;
    ticTacStallTimer: number = 0;
    strandedTimer: number = 0;
    strandedTargetId: number | null = null;
    ticTacBestY: number = Infinity;
    shaftClimbActive: boolean = false;
    shaftClimbWallDir: -1 | 1 = 1;
    shaftCorridorLeftX: number | null = null;
    shaftCorridorRightX: number | null = null;
    shaftHopTimer: number = 0;
    shaftStallTimer: number = 0;
    shaftBestY: number = Infinity;
    sealedDownIntentGrounds: Set<number> = new Set();
    worldRevisionSeen: number = 0;
    worldChecksumSeen: WorldChecksum = { colliderCount: 0, solidCount: 0, oneWayCount: 0, keyHash: 0 };
    worldChecksumDriftStreak: number = 0;
    worldChecksumDriftSignature: string | null = null;
    worldChecksumReplanCooldown: number = 0;
    downSealRerouteTimer: number = 0;
    dropIntentStuckTimer: number = 0;
    dropIntentGroundId: number | null = null;
    dropIntentEdgeX: number | null = null;
    progressSamples: ProgressSample[] = [];
    progressAnchor: string | null = null;
    progressFlatTicks: number = 0;
    progressScalar: number = Infinity;
    progressResetCooldown: number = 0;
    targetSelectFreezeTimer: number = 0;
    loopSignatureHits: Map<string, number[]> = new Map();
    lockFailCount: number = 0;
    lastCoordinateFallbackTime: number = 0;
    localSolver: LocalSolver;
    private recentUnreachable: Map<number, { targetId: number; time: number }[]> = new Map();

    // --- State Machine ---
    navState: 'nav-align' | 'nav-approach' | 'nav-ready' | 'nav-commit' | 'nav-recovery' = 'nav-align';
    takeoffZone: { minX: number, maxX: number, facing: 1 | -1 } | null = null;
    patienceTimer: number = 0;
    takeoffCache: Map<number, { takeoffX: number, gauge: number | null }> = new Map();
    breadcrumbStack: number[] = [];
    recentTransitions: TransitionTrace[] = [];
    breadcrumbTargetPenalty: Map<number, BreadcrumbPenaltyState> = new Map();
    activeManeuver: NavEdge | null = null;
    activeManeuverFromId: number | null = null;
    activeManeuverToId: number | null = null;
    bestDistToTakeoff: number = Infinity;
    bestLOS: number = 0;
    bestVerticalGain: number = Number.NEGATIVE_INFINITY;
    maneuverStagnationTimer: number = 0;
    maneuverStartFeetY: number | null = null;
    maneuverCommitted: boolean = false;
    graph: NavGraph;
    debugSnapshot: BrainDebugSnapshot = {
        tick: 0,
        state: 'idle',
        poseState: 'idle',
        navState: 'nav-align',
        approachPhase: 'direct',
        botCenterX: 0,
        botFeetY: 0,
        targetX: null,
        targetY: null,
        targetDx: null,
        heightDiff: null,
        navTargetX: null,
        moveDx: null,
        moveDir: 0,
        shouldMoveHorizontally: false,
        deadzone: null,
        stickyBand: null,
        wallDir: 0,
        wallProbeLeft: null,
        wallProbeRight: null,
        wallProbeLeftHit: false,
        wallProbeRightHit: false,
        ticTacEligible: false,
        ticTacActive: false,
        ticTacDir: 0,
        ticTacWallHoldTimer: 0,
        ticTacJumpTimer: 0,
        ticTacPersistTimer: 0,
        ticTacCorridorWidth: null,
        ticTacCorridorLeft: null,
        ticTacCorridorRight: null,
        shaftActive: false,
        shaftDir: 0,
        shaftCorridorWidth: null,
        overheadAligned: false,
        overheadProbe: null,
        overheadBlocked: false,
        ceilingHeadProbe: null,
        ceilingBlocked: false,
        ceilingEscapeWallProbeLeft: null,
        ceilingEscapeWallProbeRight: null,
        ceilingEscapeWallLeft: false,
        ceilingEscapeWallRight: false,
        ceilingArcBlocked: false,
        ceilingArcClearanceLeft: null,
        ceilingArcClearanceRight: null,
        airTuckProbe: null,
        airTuckWanted: false,
        gapProbe: null,
        gapProbeHasGround: null,
        dropPlannedEdgeX: null,
        dropDirection: 0,
        takeoffZone: null,
        maneuverId: null,
        maneuverFromId: null,
        maneuverToId: null,
        maneuverDistToTakeoff: null,
        maneuverLOS: false,
        maneuverVerticalGain: null,
        maneuverStagnation: 0,
        maneuverCommitted: false,
        timers: {
            progressStagnation: 0,
            jumpCooldown: 0,
            wallDecision: 0,
            wallSlide: 0,
            ceilingSuppress: 0,
            retryCount: 0
        }
    };
    private lastGroundedId: number | null = null;
    private lastReplanTime: number = 0;

    constructor(world: World) {
        this.world = world;
        this.graph = new NavGraph(world);
        this.localSolver = new LocalSolver(world, this.graph);
        this.worldRevisionSeen = world.getRevision();
        this.worldChecksumSeen = world.getChecksum();
        this.resetWorldChecksumDriftTracking();
    }

    setManualTarget(x: number, y: number): { x: number; y: number } | null {
        this.manualMode = true;
        this.clearTargetLock();
        this.resetSeekDiagnostics();

        const hit = this.world.query({ x1: x - 5, y1: y - 5, x2: x + 5, y2: y + 5 })
            .filter((c) => c.kind === 'rect' && c.flags.solid);
        const preferred = hit.reduce<Collider | null>((best, c) => {
            if (!best) return c;
            const cDist = Math.abs(((c.aabb.x1 + c.aabb.x2) / 2) - x) + Math.abs(c.aabb.y1 - y) * 1.2;
            const bestDist = Math.abs(((best.aabb.x1 + best.aabb.x2) / 2) - x) + Math.abs(best.aabb.y1 - y) * 1.2;
            return cDist < bestDist ? c : best;
        }, null);

        const strictPose = this.findManualStandPose(x, y, preferred, true);
        const snapped = strictPose ?? this.findManualStandPose(x, y, preferred, false);
        if (!snapped) {
            this.targetPlatform = null;
            this.targetX = null;
            this.manualTargetY = null;
            this.autoTargetY = null;
            this.recordLog(
                'MANUAL_TARGET_REJECT',
                this.manualLogPose(x, y),
                `raw=(${Math.round(x)},${Math.round(y)}) no stand pose with ledge>=${MANUAL_SAFE_LEDGE_WIDTH}`
            );
            this.currentState = 'idle';
            return null;
        }

        this.targetPlatform = snapped.platform;
        this.lockedTargetId = snapped.platform.id;
        this.targetX = snapped.x;
        this.manualTargetY = snapped.y;
        this.autoTargetY = null;
        this.recordLog(
            'MANUAL_TARGET',
            this.manualLogPose(x, y),
            `raw=(${Math.round(x)},${Math.round(y)}) -> snap=(${Math.round(snapped.x)},${Math.round(snapped.y)}) ID${snapped.platform.id} n=(${snapped.normalX},${snapped.normalY}) head=${snapped.requiresHeadroom ? `>=${MANUAL_SAFE_HEADROOM}` : 'relaxed'} ledge=${Math.round(snapped.ledgeWidth)}`
        );
        if (
            Math.abs(snapped.x - x) > 2
            || Math.abs(snapped.y - y) > 2
            || (preferred !== null && preferred.id !== snapped.platform.id)
        ) {
            this.recordLog(
                'MANUAL_TARGET_SNAP',
                this.manualLogPose(snapped.x, snapped.y),
                `selected ID${snapped.platform.id} score=${snapped.score.toFixed(1)}`
            );
        }

        this.currentState = 'seek';
        this.bestProgressDist = Infinity;
        this.progressStagnationTimer = 0;
        this.fsmStagnationTimer = 0;
        this.retryCount = 0;
        this.moveCommitDir = 0;
        this.moveCommitTimer = 0;
        this.dropEdgeX = null;
        this.dropGroundId = null;
        this.dropLockTimer = 0;
        this.resetDropIntentTracking();
        this.navState = 'nav-align';
        this.takeoffZone = null;
        this.patienceTimer = 0;
        this.navSlipTimer = 0;
        this.wallDecisionTimer = 0;
        this.ceilingEscapeTimer = 0;
        this.ceilingEscapeDir = 0;
        this.ceilingArcInvalidateTimer = 0;
        this.wallSlideTimer = 0;
        this.waypointStickyUntil = 0;
        this.waypointOriginId = null;
        this.lastWaypointSwitchTime = 0;
        this.waypointSwitchTimes = [];
        this.resetManeuverTracking();
        this.resetTicTacState();
        this.resetShaftClimbState();
        this.resetDropIntentTracking();
        this.sealedDownIntentGrounds.clear();
        this.downSealRerouteTimer = 0;
        this.worldRevisionSeen = this.world.getRevision();
        this.worldChecksumSeen = this.world.getChecksum();
        this.resetWorldChecksumDriftTracking();
        this.recentTransitions = [];
        this.breadcrumbTargetPenalty.clear();
        this.loopSignatureHits.clear();
        return { x: snapped.x, y: snapped.y };
    }

    clearManualTarget() {
        this.manualMode = false;
        this.clearTargetLock();
        this.resetSeekDiagnostics();
        this.manualTargetY = null;
        this.autoTargetY = null;
        this.targetX = null;
        this.currentState = 'idle';
        this.bestProgressDist = Infinity;
        this.progressStagnationTimer = 0;
        this.fsmStagnationTimer = 0;
        this.approachPhase = 'direct';
        this.approachX = null;
        this.moveCommitDir = 0;
        this.moveCommitTimer = 0;
        this.dropEdgeX = null;
        this.dropGroundId = null;
        this.dropLockTimer = 0;
        this.navState = 'nav-align';
        this.takeoffZone = null;
        this.patienceTimer = 0;
        this.navSlipTimer = 0;
        this.wallDecisionTimer = 0;
        this.ceilingEscapeTimer = 0;
        this.ceilingEscapeDir = 0;
        this.ceilingArcInvalidateTimer = 0;
        this.wallSlideTimer = 0;
        this.waypointStickyUntil = 0;
        this.waypointOriginId = null;
        this.lastWaypointSwitchTime = 0;
        this.waypointSwitchTimes = [];
        this.resetManeuverTracking();
        this.resetTicTacState();
        this.resetShaftClimbState();
        this.resetDropIntentTracking();
        this.sealedDownIntentGrounds.clear();
        this.downSealRerouteTimer = 0;
        this.worldRevisionSeen = this.world.getRevision();
        this.worldChecksumSeen = this.world.getChecksum();
        this.resetWorldChecksumDriftTracking();
        this.recentTransitions = [];
        this.breadcrumbTargetPenalty.clear();
        this.loopSignatureHits.clear();
    }

    updateManualTarget(x: number, y: number): { x: number; y: number } | null {
        if (!this.manualMode) return null;
        const preferred = this.lockedTargetId !== null
            ? this.world.colliders.get(this.lockedTargetId) ?? this.targetPlatform
            : this.targetPlatform;
        const strictPose = this.findManualStandPose(x, y, preferred, true);
        const snapped = strictPose ?? this.findManualStandPose(x, y, preferred, false);
        if (!snapped) {
            if (this.targetX !== null && this.manualTargetY !== null) {
                return { x: this.targetX, y: this.manualTargetY };
            }
            return null;
        }

        this.targetPlatform = snapped.platform;
        this.lockedTargetId = snapped.platform.id;
        this.targetX = snapped.x;
        this.manualTargetY = snapped.y;
        this.autoTargetY = null;
        return { x: snapped.x, y: snapped.y };
    }

    resetForRespawn() {
        this.currentState = 'idle';
        this.targetPlatform = null;
        this.targetX = null;
        this.isFirstTarget = true;
        this.clearTargetLock();

        this.bestProgressDist = Infinity;
        this.progressStagnationTimer = 0;
        this.fsmStagnationTimer = 0;
        this.hitConfirmedTimer = 0;
        this.lastHitId = null;
        this.jumpCooldown = 0;
        this.retryCount = 0;
        this.platformHistory = [];
        this.recentArrivals = [];
        this.recentWarpDestinations = [];
        this.visitCounts.clear();
        this.lockFailCount = 0;
        this.highestReached = Infinity;

        this.manualTargetY = null;
        this.autoTargetY = null;
        this.approachPhase = 'direct';
        this.approachX = null;
        this.moveCommitDir = 0;
        this.moveCommitTimer = 0;
        this.dropEdgeX = null;
        this.dropGroundId = null;
        this.dropLockTimer = 0;
        this.resetDropIntentTracking();

        this.resetSeekDiagnostics();
        this.navState = 'nav-align';
        this.takeoffZone = null;
        this.patienceTimer = 0;
        this.takeoffCache.clear();
        this.breadcrumbStack = [];

        this.lastGroundedId = null;
        this.lastReplanTime = 0;
        this.lastModeSeen = null;
        this.lastBehaviorSeen = null;
        this.lastFormSeen = null;
        this.lastSupportSeen = null;
        this.lastIntentSeen = null;
        this.ceilingBonkWindow = 0;
        this.ceilingBonkCount = 0;
        this.ceilingJumpSuppressTimer = 0;
        this.navSlipTimer = 0;
        this.wallDecisionTimer = 0;
        this.ceilingEscapeTimer = 0;
        this.ceilingEscapeDir = 0;
        this.ceilingArcInvalidateTimer = 0;
        this.wallSlideTimer = 0;
        this.waypointStickyUntil = 0;
        this.waypointOriginId = null;
        this.lastWaypointSwitchTime = 0;
        this.waypointSwitchTimes = [];
        this.resetManeuverTracking();
        this.resetTicTacState();
        this.resetShaftClimbState();
        this.resetDropIntentTracking();
        this.sealedDownIntentGrounds.clear();
        this.downSealRerouteTimer = 0;
        this.worldRevisionSeen = this.world.getRevision();
        this.worldChecksumSeen = this.world.getChecksum();
        this.resetWorldChecksumDriftTracking();
        this.recentTransitions = [];
        this.breadcrumbTargetPenalty.clear();
        this.loopSignatureHits.clear();
        this.lastCoordinateFallbackTime = 0;
    }

    private getTargetY(): number | null {
        if (this.targetPlatform) return this.targetPlatform.aabb.y1;
        if (this.manualMode) return this.manualTargetY;
        return this.autoTargetY;
    }

    private getLockedTarget(): Collider | null {
        if (this.lockedTargetId === null) return null;
        return this.world.colliders.get(this.lockedTargetId) || null;
    }

    private clearTargetLock() {
        this.lockedTargetId = null;
    }

    private manualLogPose(x: number, y: number): Pose {
        return {
            x,
            y,
            vx: 0,
            vy: 0,
            width: BOT_STAND_WIDTH,
            height: BOT_STAND_HEIGHT,
            grounded: false,
            groundedId: null,
            jumps: 0,
            state: 'idle',
            facing: 1
        };
    }

    private buildManualStandPose(
        platform: Collider,
        referenceX: number,
        referenceY: number,
        preferredId: number | null,
        requiresHeadroom: boolean
    ): ManualStandPose | null {
        if (platform.kind !== 'rect' || !platform.flags.solid) return null;

        const platformWidth = platform.aabb.x2 - platform.aabb.x1;
        if (platformWidth < MANUAL_SAFE_LEDGE_WIDTH) return null;

        const standMinX = platform.aabb.x1 + MANUAL_SAFE_EDGE_MARGIN;
        const standMaxX = platform.aabb.x2 - MANUAL_SAFE_EDGE_MARGIN;
        if (standMinX >= standMaxX) return null;

        const snappedX = Math.max(standMinX, Math.min(standMaxX, referenceX));
        const snappedY = platform.aabb.y1;

        const bodyProbe: AABB = {
            x1: snappedX - BOT_STAND_WIDTH / 2 + 1,
            y1: snappedY - BOT_STAND_HEIGHT,
            x2: snappedX + BOT_STAND_WIDTH / 2 - 1,
            y2: snappedY - 1
        };
        const bodyBlocked = this.world.query(bodyProbe).some((c) =>
            c.id !== platform.id
            && c.kind === 'rect'
            && c.flags.solid
            && !c.flags.oneWay
        );
        if (bodyBlocked) return null;

        if (requiresHeadroom) {
            const headroomProbe: AABB = {
                x1: snappedX - BOT_STAND_WIDTH / 2 + 2,
                y1: snappedY - MANUAL_SAFE_HEADROOM,
                x2: snappedX + BOT_STAND_WIDTH / 2 - 2,
                y2: snappedY - BOT_STAND_HEIGHT + 1
            };
            const headBlocked = this.world.query(headroomProbe).some((c) =>
                c.id !== platform.id
                && c.kind === 'rect'
                && c.flags.solid
                && !c.flags.oneWay
            );
            if (headBlocked) return null;
        }

        let score = Math.abs(snappedX - referenceX) + Math.abs(snappedY - referenceY) * 1.15;
        if (preferredId !== null && platform.id === preferredId) score -= 28;
        if (this.graph.nodes.has(platform.id)) score -= 12;
        if (platform.flags.oneWay) score += 10;

        return {
            platform,
            x: snappedX,
            y: snappedY,
            normalX: 0,
            normalY: -1,
            ledgeWidth: standMaxX - standMinX,
            requiresHeadroom,
            score
        };
    }

    private findManualStandPose(
        rawX: number,
        rawY: number,
        preferred: Collider | null,
        requiresHeadroom: boolean
    ): ManualStandPose | null {
        const preferredId = preferred?.id ?? null;
        if (preferred) {
            const direct = this.buildManualStandPose(preferred, rawX, rawY, preferredId, requiresHeadroom);
            if (direct) return direct;
        }

        let best: ManualStandPose | null = null;
        const nearby = this.world.query({
            x1: rawX - MANUAL_SNAP_RADIUS_X,
            y1: rawY - MANUAL_SNAP_RADIUS_Y,
            x2: rawX + MANUAL_SNAP_RADIUS_X,
            y2: rawY + MANUAL_SNAP_RADIUS_Y
        });
        for (const c of nearby) {
            const pose = this.buildManualStandPose(c, rawX, rawY, preferredId, requiresHeadroom);
            if (!pose) continue;
            if (!best || pose.score < best.score) best = pose;
        }
        if (best) return best;

        for (const c of this.world.colliders.values()) {
            const pose = this.buildManualStandPose(c, rawX, rawY, preferredId, requiresHeadroom);
            if (!pose) continue;
            if (!best || pose.score < best.score) best = pose;
        }
        return best;
    }

    private getPlatformAimX(platform: Collider, _referenceX: number): number {
        const min = platform.aabb.x1 + 14;
        const max = platform.aabb.x2 - 14;
        const center = (platform.aabb.x1 + platform.aabb.x2) / 2;
        if (min >= max) return center;
        // Keep platform targets stationary: always aim at a stable center anchor.
        return Math.max(min, Math.min(max, center));
    }

    private setStationaryPlatformTarget(platform: Collider, referenceX: number, forceReanchor: boolean = false) {
        const samePlatform = this.targetPlatform?.id === platform.id;
        this.targetPlatform = platform;
        if (!samePlatform || forceReanchor || this.targetX === null) {
            this.targetX = this.getPlatformAimX(platform, referenceX);
        }
        this.autoTargetY = null;
        this.lockFailCount = 0;
    }

    private isSteerDirectionBlocked(pose: Pose, dir: -1 | 1): boolean {
        const probe: AABB = {
            x1: dir > 0 ? pose.x + pose.width : pose.x - 8,
            y1: pose.y + 8,
            x2: dir > 0 ? pose.x + pose.width + 8 : pose.x,
            y2: pose.y + pose.height - 8
        };
        return this.world.query(probe).some((c) =>
            c.kind === 'rect'
            && c.flags.solid
            && !c.flags.oneWay
        );
    }

    private sanitizeAutoTargetToPlatform(pose: Pose) {
        if (this.manualMode) return;

        // Keep platform reference fresh across world mutations.
        if (this.targetPlatform) {
            const refreshed = this.world.colliders.get(this.targetPlatform.id);
            if (!refreshed || refreshed.kind !== 'rect' || !refreshed.flags.solid) {
                this.targetPlatform = null;
                this.targetX = null;
                this.autoTargetY = null;
                this.currentState = 'idle';
                this.navState = 'nav-align';
                this.takeoffZone = null;
                this.patienceTimer = 0;
                this.resetManeuverTracking();
                this.recordLog('TARGET_SANITIZE', pose, 'dropped stale platform target');
                return;
            }
            this.targetPlatform = refreshed;
            this.autoTargetY = null;
            if (this.targetX === null) {
                this.targetX = this.getPlatformAimX(refreshed, pose.x + pose.width / 2);
            }
            return;
        }

        // If we still have a lock, force target back onto that platform instead of free-space coordinates.
        if (this.lockedTargetId !== null) {
            const locked = this.world.colliders.get(this.lockedTargetId);
            if (locked && locked.kind === 'rect' && locked.flags.solid) {
                this.setStationaryPlatformTarget(locked, pose.x + pose.width / 2, this.targetX === null);
                return;
            }
            this.clearTargetLock();
        }

        // Auto mode must never chase floating coordinate targets (unless explicit coordinate set).
        // Only clear if we have a stale targetX but no platform and no explicit coordinate target.
        if (this.targetPlatform === null && this.targetX !== null && this.autoTargetY === null) {
            this.targetX = null;
            this.autoTargetY = null;
            this.currentState = 'idle';
            this.navState = 'nav-align';
            this.takeoffZone = null;
            this.patienceTimer = 0;
            this.resetManeuverTracking();
            this.recordLog('TARGET_SANITIZE', pose, 'cleared non-platform target');
        }
    }

    private getPlannerContext(pose: Pose, relaxed: boolean = false): PlannerContext {
        return {
            jumpReady: relaxed ? true : (this.jumpCooldown <= 0.02 || !pose.grounded),
            airJumpsAvailable: relaxed ? (MAX_TOTAL_JUMPS - 1) : Math.max(0, MAX_TOTAL_JUMPS - pose.jumps),
            railLatchReady: true
        };
    }

    private getPlanningStartId(pose: Pose): number | null {
        if (pose.groundedId !== null && this.graph.nodes.has(pose.groundedId)) return pose.groundedId;
        const candidates = this.world.query({ x1: pose.x - 300, y1: 0, x2: pose.x + 300, y2: window.innerHeight });
        const startPick = candidates.reduce((best, c) => {
            if (!this.graph.nodes.has(c.id)) return best;
            if (c.aabb.y1 < pose.y + pose.height) return best;
            const dist = Math.hypot(
                (c.aabb.x1 + c.aabb.x2) / 2 - (pose.x + pose.width / 2),
                c.aabb.y1 - (pose.y + pose.height)
            );
            return dist < best.dist ? { id: c.id, dist } : best;
        }, { id: -1, dist: Infinity });
        return startPick.id !== -1 ? startPick.id : null;
    }

    private findPathWithContext(
        startId: number,
        targetId: number,
        pose: Pose,
        relaxed: boolean = false,
        maxStates: number = 180
    ): NavPathResult | null {
        return this.graph.findPathDetailed(startId, targetId, {
            maxStates,
            context: this.getPlannerContext(pose, relaxed)
        });
    }

    private estimatePathCost(startId: number, targetId: number, pose: Pose, relaxed: boolean = false): number {
        return this.graph.estimateCost(startId, targetId, this.getPlannerContext(pose, relaxed));
    }

    private getLandingBand(platform: Collider, edge: NavEdge | null): { minX: number; maxX: number; y: number } | null {
        const baseMin = platform.aabb.x1 + 10;
        const baseMax = platform.aabb.x2 - 10;
        if (baseMin >= baseMax) return null;
        if (!edge) return { minX: baseMin, maxX: baseMax, y: platform.aabb.y1 };
        const minX = Math.max(baseMin, edge.landingMinX);
        const maxX = Math.min(baseMax, edge.landingMaxX);
        if (minX >= maxX) return null;
        return { minX, maxX, y: platform.aabb.y1 };
    }

    private getActiveLandingBand(): { minX: number; maxX: number; y: number } | null {
        if (!this.targetPlatform) return null;
        return this.getLandingBand(this.targetPlatform, this.activeManeuver);
    }

    private isEmergencyJumpReason(reason: string): boolean {
        return reason === 'gap-jump'
            || reason === 'drop-through'
            || reason === 'intermediate-edge-hop'
            || reason.startsWith('offscreen');
    }

    private isNavReadyForJump(pose: Pose, reason: string, botCenterX: number, botFeetY: number, targetY: number | null): boolean {
        if (!pose.grounded) return true;
        if (this.isEmergencyJumpReason(reason)) return true;
        const isUpwardGoal = targetY !== null && (botFeetY - targetY) > 12;
        if (!isUpwardGoal) return true;
        const isOverheadLockJump = reason.startsWith('overhead-lock');
        const bypassTakeoffGate = isOverheadLockJump && this.takeoffZone === null;
        if (!bypassTakeoffGate && this.navState !== 'nav-ready') return false;
        if (!bypassTakeoffGate && this.patienceTimer > 0) return false;
        if (this.takeoffZone) {
            if (botCenterX < this.takeoffZone.minX || botCenterX > this.takeoffZone.maxX) return false;
        }

        const launchHeadProbe: AABB = {
            x1: pose.x + 2,
            y1: pose.y - 44,
            x2: pose.x + pose.width - 2,
            y2: pose.y - 2
        };
        const launchHeadBlocked = this.world.query(launchHeadProbe)
            .some((c) => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);
        if (launchHeadBlocked) return false;

        const landingBand = this.getActiveLandingBand();
        if (!landingBand) return true;
        const landingMid = (landingBand.minX + landingBand.maxX) / 2;
        return this.world.hasLineOfSight(botCenterX, botFeetY - 26, landingMid, landingBand.y - 8);
    }

    private setActiveManeuver(edge: NavEdge | null, fromId: number | null, pose: Pose) {
        if (!edge || fromId === null) {
            this.activeManeuver = null;
            this.activeManeuverFromId = null;
            this.activeManeuverToId = null;
            this.bestDistToTakeoff = Infinity;
            this.bestLOS = 0;
            this.bestVerticalGain = Number.NEGATIVE_INFINITY;
            this.maneuverStagnationTimer = 0;
            this.maneuverStartFeetY = null;
            this.approachPhase = 'direct';
            this.approachX = null;
            this.maneuverCommitted = false;
            return;
        }

        const changed =
            this.activeManeuver === null ||
            this.activeManeuver.maneuverId !== edge.maneuverId ||
            this.activeManeuverFromId !== fromId;

        this.activeManeuver = edge;
        this.activeManeuverFromId = fromId;
        this.activeManeuverToId = edge.toId;

        if (changed) {
            this.bestDistToTakeoff = Infinity;
            this.bestLOS = 0;
            this.bestVerticalGain = Number.NEGATIVE_INFINITY;
            this.maneuverStagnationTimer = 0;
            this.maneuverStartFeetY = pose.y + pose.height;
            this.maneuverCommitted = false;

            // --- Backup & Charge Logic ---
            const needsSpeed = edge.action === 'jump-gap' || edge.action === 'jump-high';
            if (needsSpeed) {
                const floor = this.world.colliders.get(fromId);
                if (floor) {
                    const botCx = pose.x + pose.width / 2;
                    const jumpDir = edge.facing;
                    const takeoffX = (edge.takeoffMinX + edge.takeoffMaxX) / 2;
                    const distToTakeoff = Math.abs(takeoffX - botCx);

                    // If we are already near the takeoff point and jump direction is AWAY from us,
                    // we need to back up to gain momentum.
                    const isFacingAway = (jumpDir > 0 && botCx > takeoffX - 60) || (jumpDir < 0 && botCx < takeoffX + 60);

                    if (isFacingAway && distToTakeoff < 140) {
                        const backupX = jumpDir > 0 ? floor.aabb.x1 + 35 : floor.aabb.x2 - 35;
                        const roomToBackup = Math.abs(backupX - botCx);
                        if (roomToBackup > 100) {
                            this.approachPhase = 'backup';
                            this.approachX = backupX;
                            this.recordLog('NAV_BACKUP', pose, `room=${Math.round(roomToBackup)} dist=${Math.round(distToTakeoff)}`);
                            return;
                        }
                    }
                }
            }
            this.approachPhase = 'charge';
            this.approachX = null;
        }
    }

    private syncActiveManeuver(pose: Pose) {
        if (!this.targetPlatform) {
            this.setActiveManeuver(null, null, pose);
            return;
        }

        if (!pose.grounded) {
            if (this.activeManeuver) {
                this.maneuverCommitted = true;
            }
            return;
        }

        if (this.activeManeuver && this.maneuverCommitted && pose.groundedId === this.activeManeuverFromId) {
            this.invalidateActiveManeuver(pose, 'missed-landing', 5000);
        }

        if (pose.groundedId === null) {
            this.setActiveManeuver(null, null, pose);
            return;
        }

        const edge = this.graph.getBestEdge(
            pose.groundedId,
            this.targetPlatform.id,
            this.getPlannerContext(pose)
        );
        this.setActiveManeuver(edge, edge ? pose.groundedId : null, pose);
    }

    private invalidateActiveManeuver(pose: Pose, reason: string, durationMs: number = 5200) {
        if (!this.activeManeuver || this.activeManeuverFromId === null || this.activeManeuverToId === null) return;
        this.graph.invalidateEdge(
            this.activeManeuverFromId,
            this.activeManeuverToId,
            reason,
            durationMs,
            this.activeManeuver.maneuverId
        );
        this.recordLog('MANEUVER_INVALIDATE', pose, `${reason}: ${this.activeManeuver.maneuverId}`);
    }

    private updateManeuverProgress(pose: Pose, dt: number): boolean {
        if (!this.activeManeuver || this.activeManeuverFromId === null) {
            this.maneuverStagnationTimer = 0;
            return false;
        }

        // Only track "stagnation" while we are on the source platform.
        // If we leave (jump/fall), we don't reset the timer until we land somewhere else.
        if (!pose.grounded || pose.groundedId !== this.activeManeuverFromId) {
            // We are executing the jump or have arrived elsewhere. 
            // Return false to indicate no progress *check* needed this frame, but don't reset timer.
            return false;
        }

        const botCenterX = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const edge = this.activeManeuver;

        let distToTakeoff = 0;
        if (botCenterX < edge.takeoffMinX) distToTakeoff = edge.takeoffMinX - botCenterX;
        else if (botCenterX > edge.takeoffMaxX) distToTakeoff = botCenterX - edge.takeoffMaxX;

        const landingMid = (edge.landingMinX + edge.landingMaxX) / 2;
        const los = this.world.hasLineOfSight(botCenterX, botFeetY - 26, landingMid, edge.landingY) ? 1 : 0;
        const verticalGain = this.maneuverStartFeetY !== null ? this.maneuverStartFeetY - botFeetY : 0;

        let improved = false;
        if (distToTakeoff + MANEUVER_MIN_DIST_IMPROVEMENT < this.bestDistToTakeoff) {
            this.bestDistToTakeoff = distToTakeoff;
            improved = true;
        }
        if (los > this.bestLOS) {
            this.bestLOS = los;
            improved = true;
        }
        if (verticalGain > this.bestVerticalGain + MANEUVER_MIN_VERTICAL_GAIN) {
            this.bestVerticalGain = verticalGain;
            improved = true;
        }

        if (improved) this.maneuverStagnationTimer = 0;
        else this.maneuverStagnationTimer += dt;

        if (this.maneuverStagnationTimer >= MANEUVER_STALL_WINDOW) {
            this.invalidateActiveManeuver(pose, 'maneuver-no-progress');
            this.maneuverStagnationTimer = 0;
            this.bestDistToTakeoff = Infinity;
            this.bestLOS = 0;
            this.bestVerticalGain = Number.NEGATIVE_INFINITY;
            this.reroute(pose, 'maneuver-no-progress');
            return true;
        }

        return false;
    }

    private noteWaypointSwitch(now: number) {
        this.lastWaypointSwitchTime = now;
        this.waypointSwitchTimes.push(now);
        const cutoff = now - WAYPOINT_RECENT_SWITCH_WINDOW_MS;
        this.waypointSwitchTimes = this.waypointSwitchTimes.filter((t) => t >= cutoff);
    }

    private getWaypointSwitchPenalty(now: number): number {
        const cutoff = now - WAYPOINT_RECENT_SWITCH_WINDOW_MS;
        this.waypointSwitchTimes = this.waypointSwitchTimes.filter((t) => t >= cutoff);
        return this.waypointSwitchTimes.length * WAYPOINT_RECENT_SWITCH_PENALTY;
    }

    private resetManeuverTracking() {
        this.activeManeuver = null;
        this.activeManeuverFromId = null;
        this.activeManeuverToId = null;
        this.bestDistToTakeoff = Infinity;
        this.bestLOS = 0;
        this.bestVerticalGain = Number.NEGATIVE_INFINITY;
        this.maneuverStagnationTimer = 0;
        this.maneuverCommitted = false;
    }

    private resetShaftClimbState() {
        this.shaftClimbActive = false;
        this.shaftClimbWallDir = 1;
        this.shaftCorridorLeftX = null;
        this.shaftCorridorRightX = null;
        this.shaftHopTimer = 0;
        this.shaftStallTimer = 0;
        this.shaftBestY = Infinity;
    }

    private resetDropIntentTracking() {
        this.dropIntentStuckTimer = 0;
        this.dropIntentGroundId = null;
        this.dropIntentEdgeX = null;
    }

    private resetTicTacState() {
        this.ticTacActive = false;
        this.ticTacDir = 0;
        this.ticTacJumpTimer = 0;
        this.ticTacPersistTimer = 0;
        this.ticTacWallHoldTimer = 0;
        this.ticTacStallTimer = 0;
        this.ticTacBestY = Infinity;
    }

    private resetWorldChecksumDriftTracking() {
        this.worldChecksumDriftStreak = 0;
        this.worldChecksumDriftSignature = null;
        this.worldChecksumReplanCooldown = 0;
    }

    private getWorldChecksumSignature(sum: WorldChecksum): string {
        return `${sum.colliderCount}|${sum.solidCount}|${sum.oneWayCount}|${sum.keyHash}`;
    }

    private didWorldChecksumDriftSignificantly(prev: WorldChecksum, next: WorldChecksum): boolean {
        const colliderDelta = Math.abs(next.colliderCount - prev.colliderCount);
        const solidDelta = Math.abs(next.solidCount - prev.solidCount);
        const oneWayDelta = Math.abs(next.oneWayCount - prev.oneWayCount);
        const hashChanged = next.keyHash !== prev.keyHash;

        return colliderDelta > WORLD_CHECKSUM_COLLIDER_TOL
            || solidDelta > WORLD_CHECKSUM_COLLIDER_TOL
            || oneWayDelta > WORLD_CHECKSUM_ONEWAY_TOL
            || hashChanged;
    }

    private markTargetUnreachable(groundedId: number, targetId: number) {
        const now = performance.now();
        const list = this.recentUnreachable.get(groundedId) || [];
        list.push({ targetId, time: now });
        // Prune old entries (5s lifetime)
        const fresh = list.filter(e => now - e.time < 5000);
        this.recentUnreachable.set(groundedId, fresh);
    }

    private isTargetUnreachable(groundedId: number, targetId: number): boolean {
        const list = this.recentUnreachable.get(groundedId);
        if (!list) return false;
        const now = performance.now();
        // Lazy cleanup during read
        const fresh = list.filter(e => now - e.time < 5000);
        if (fresh.length !== list.length) {
            if (fresh.length === 0) this.recentUnreachable.delete(groundedId);
            else this.recentUnreachable.set(groundedId, fresh);
        }
        return fresh.some(e => e.targetId === targetId);
    }

    private invalidatePlanForWorldDrift(pose: Pose, prev: WorldChecksum, next: WorldChecksum) {
        if (this.worldChecksumReplanCooldown > 0) return;

        this.recordLog(
            'WORLD_CHECKSUM',
            pose,
            `c:${prev.colliderCount}->${next.colliderCount} s:${prev.solidCount}->${next.solidCount} ow:${prev.oneWayCount}->${next.oneWayCount} h:${prev.keyHash}->${next.keyHash}`
        );

        this.takeoffCache.clear();
        this.invalidateActiveManeuver(pose, 'world-checksum-drift', 4000);
        this.resetManeuverTracking();
        this.dropEdgeX = null;
        this.dropGroundId = null;
        this.dropLockTimer = 0;
        this.resetDropIntentTracking();
        this.moveCommitDir = 0;
        this.moveCommitTimer = 0;
        this.sealedDownIntentGrounds.clear();
        this.downSealRerouteTimer = 0;

        if (this.currentState === 'seek') {
            this.reroute(pose, 'world-checksum-drift');
        }
        this.worldChecksumReplanCooldown = WORLD_CHECKSUM_REPLAN_COOLDOWN;
    }

    private measureCorridor(pose: Pose): CorridorProbeResult | null {
        const y1 = pose.y + 6;
        const y2 = pose.y + pose.height - 6;
        const leftProbe: AABB = {
            x1: pose.x - TIC_TAC_SCAN_DIST,
            y1,
            x2: pose.x + 2,
            y2
        };
        const rightProbe: AABB = {
            x1: pose.x + pose.width - 2,
            y1,
            x2: pose.x + pose.width + TIC_TAC_SCAN_DIST,
            y2
        };

        let leftDist = Number.POSITIVE_INFINITY;
        let leftWallX = Number.NaN;
        for (const c of this.world.query(leftProbe)) {
            if (c.kind !== 'rect' || !c.flags.solid || c.flags.oneWay) continue;
            const overlapY = Math.min(y2, c.aabb.y2) - Math.max(y1, c.aabb.y1);
            if (overlapY < TIC_TAC_MIN_OVERLAP_Y) continue;

            const dist = pose.x - c.aabb.x2;
            if (dist < -6) continue;
            const clamped = Math.max(0, dist);
            if (clamped < leftDist) {
                leftDist = clamped;
                leftWallX = c.aabb.x2;
            }
        }

        let rightDist = Number.POSITIVE_INFINITY;
        let rightWallX = Number.NaN;
        for (const c of this.world.query(rightProbe)) {
            if (c.kind !== 'rect' || !c.flags.solid || c.flags.oneWay) continue;
            const overlapY = Math.min(y2, c.aabb.y2) - Math.max(y1, c.aabb.y1);
            if (overlapY < TIC_TAC_MIN_OVERLAP_Y) continue;

            const dist = c.aabb.x1 - (pose.x + pose.width);
            if (dist < -6) continue;
            const clamped = Math.max(0, dist);
            if (clamped < rightDist) {
                rightDist = clamped;
                rightWallX = c.aabb.x1;
            }
        }

        if (!Number.isFinite(leftDist) || !Number.isFinite(rightDist)) return null;
        const width = leftDist + pose.width + rightDist;
        return { leftDist, rightDist, width, leftWallX, rightWallX };
    }

    private measureTicTacCorridor(pose: Pose): CorridorProbeResult | null {
        const corridor = this.measureCorridor(pose);
        if (!corridor) return null;
        if (corridor.width < TIC_TAC_MIN_GAP_WIDTH || corridor.width > TIC_TAC_MAX_GAP_WIDTH) return null;
        return corridor;
    }

    private measureNarrowShaftCorridor(
        pose: Pose,
        corridorHint: CorridorProbeResult | null = null
    ): CorridorProbeResult | null {
        const corridor = corridorHint ?? this.measureCorridor(pose);
        if (!corridor) return null;
        const minWidth = pose.width + SHAFT_MIN_EXTRA_WIDTH;
        if (corridor.width < minWidth) return null;
        if (corridor.width >= TIC_TAC_MIN_GAP_WIDTH) return null;
        return corridor;
    }

    private probeCeilingArcClearance(pose: Pose, dir: -1 | 1): CeilingArcProbeResult {
        const startBodyAABB: AABB = {
            x1: pose.x,
            y1: pose.y,
            x2: pose.x + pose.width,
            y2: pose.y + pose.height
        };
        const overlapsStart = (b: AABB) =>
            startBodyAABB.x1 < b.x2
            && startBodyAABB.x2 > b.x1
            && startBodyAABB.y1 < b.y2
            && startBodyAABB.y2 > b.y1;

        const dt = CEILING_ARC_PROBE_TIME / CEILING_ARC_PROBE_SAMPLES;
        let simX = pose.x + pose.width / 2;
        let simY = pose.y + 2;
        let simVx = dir > 0 ? Math.max(0, pose.vx) : Math.min(0, pose.vx);
        let simVy = -CEILING_ARC_JUMP_SPEED;
        let clearSamples = 0;

        for (let i = 0; i < CEILING_ARC_PROBE_SAMPLES; i++) {
            const targetVx = dir * CEILING_ARC_TARGET_VX;
            if (simVx < targetVx) simVx = Math.min(targetVx, simVx + CEILING_ARC_AIR_ACCEL * dt);
            else if (simVx > targetVx) simVx = Math.max(targetVx, simVx - CEILING_ARC_AIR_ACCEL * dt);

            simVy += CEILING_ARC_GRAVITY * dt;
            simX += simVx * dt;
            simY += simVy * dt;

            const probe: AABB = {
                x1: simX - CEILING_ARC_PROBE_HALF_WIDTH,
                x2: simX + CEILING_ARC_PROBE_HALF_WIDTH,
                y1: simY - CEILING_ARC_PROBE_HEIGHT_ABOVE,
                y2: simY + CEILING_ARC_PROBE_HEIGHT_BELOW
            };

            const blocked = this.world.query(probe).some((c) =>
                c.kind === 'rect'
                && c.flags.solid
                && !c.flags.oneWay
                && !overlapsStart(c.aabb)
            );
            if (blocked) break;
            clearSamples++;
        }

        return {
            blocked: clearSamples < CEILING_ARC_PROBE_SAMPLES,
            clearance: clearSamples / CEILING_ARC_PROBE_SAMPLES
        };
    }

    private assessDownwardSeal(groundedCollider: Collider): DownSealResult {
        const edgePad = 6;
        const xMin = groundedCollider.aabb.x1 + edgePad;
        const xMax = groundedCollider.aabb.x2 - edgePad;
        if (xMax <= xMin + 2) {
            return { sealed: false, coverage: 0, leftWall: false, rightWall: false, openRun: 0 };
        }

        const sampleY = groundedCollider.aabb.y2 + DOWN_SEAL_SCAN_DEPTH;
        const samples: number[] = [];
        for (let x = xMin; x <= xMax + 0.001; x += DOWN_SEAL_SAMPLE_STEP) {
            samples.push(Math.min(x, xMax));
        }
        if (samples.length === 0 || samples[samples.length - 1] < xMax - 1) {
            samples.push(xMax);
        }

        let blockedCount = 0;
        let openRun = 0;
        let maxOpenRun = 0;
        for (const sx of samples) {
            const probe: AABB = {
                x1: sx - DOWN_SEAL_SAMPLE_HALF,
                x2: sx + DOWN_SEAL_SAMPLE_HALF,
                y1: sampleY - 8,
                y2: sampleY + 8
            };
            const blocked = this.world.query(probe).some((c) =>
                c.id !== groundedCollider.id
                && c.kind === 'rect'
                && c.flags.solid
                && !c.flags.oneWay
            );
            if (blocked) {
                blockedCount++;
                openRun = 0;
            } else {
                openRun++;
                if (openRun > maxOpenRun) maxOpenRun = openRun;
            }
        }

        const coverage = samples.length > 0 ? blockedCount / samples.length : 0;
        const leftWallProbe: AABB = {
            x1: groundedCollider.aabb.x1 - 18,
            x2: groundedCollider.aabb.x1 + 2,
            y1: groundedCollider.aabb.y1 + 2,
            y2: groundedCollider.aabb.y2 + DOWN_SEAL_SIDE_WALL_DEPTH
        };
        const rightWallProbe: AABB = {
            x1: groundedCollider.aabb.x2 - 2,
            x2: groundedCollider.aabb.x2 + 18,
            y1: groundedCollider.aabb.y1 + 2,
            y2: groundedCollider.aabb.y2 + DOWN_SEAL_SIDE_WALL_DEPTH
        };
        const leftWall = this.world.query(leftWallProbe).some((c) =>
            c.id !== groundedCollider.id
            && c.kind === 'rect'
            && c.flags.solid
            && !c.flags.oneWay
        );
        const rightWall = this.world.query(rightWallProbe).some((c) =>
            c.id !== groundedCollider.id
            && c.kind === 'rect'
            && c.flags.solid
            && !c.flags.oneWay
        );

        const sealed = coverage >= DOWN_SEAL_MIN_COVERAGE
            && maxOpenRun <= DOWN_SEAL_MAX_OPEN_RUN
            && leftWall
            && rightWall;
        return { sealed, coverage, leftWall, rightWall, openRun: maxOpenRun };
    }

    private getProgressAnchor(targetX: number, targetY: number | null): string {
        const targetKind = this.targetPlatform
            ? `platform:${this.targetPlatform.id}`
            : (this.manualMode ? 'manual' : 'coord');
        return `${targetKind}:${Math.round(targetX)}:${targetY !== null ? Math.round(targetY) : '-'}`;
    }

    private resetProgressTracking(anchor: string | null = null) {
        this.progressSamples = [];
        this.progressAnchor = anchor;
        this.progressFlatTicks = 0;
        this.progressScalar = Infinity;
    }

    private updateProgressScalar(
        targetX: number,
        targetY: number | null,
        targetDx: number,
        targetDy: number | null,
        currentDist: number,
        hasGoalPressure: boolean
    ): number {
        const anchor = this.getProgressAnchor(targetX, targetY);
        if (this.progressAnchor !== anchor) {
            this.resetProgressTracking(anchor);
        }

        if (!hasGoalPressure) {
            this.resetProgressTracking(anchor);
            return this.progressScalar;
        }

        const sample: ProgressSample = {
            absDx: Math.abs(targetDx),
            absDy: Math.abs(targetDy ?? 0),
            dist: currentDist
        };
        this.progressSamples.push(sample);
        if (this.progressSamples.length > PROGRESS_WINDOW_TICKS) {
            this.progressSamples.shift();
        }

        if (this.progressSamples.length < 2) {
            this.progressScalar = Infinity;
            return this.progressScalar;
        }

        const first = this.progressSamples[0];
        let minAbsDx = first.absDx;
        let minAbsDy = first.absDy;
        let minDist = first.dist;
        for (const s of this.progressSamples) {
            if (s.absDx < minAbsDx) minAbsDx = s.absDx;
            if (s.absDy < minAbsDy) minAbsDy = s.absDy;
            if (s.dist < minDist) minDist = s.dist;
        }

        const bestXDeltaImprovement = Math.max(0, first.absDx - minAbsDx);
        const bestYImprovement = Math.max(0, first.absDy - minAbsDy);
        const targetDistanceReduction = Math.max(0, first.dist - minDist);
        this.progressScalar = Math.max(bestXDeltaImprovement, bestYImprovement, targetDistanceReduction);

        if (this.progressScalar < PROGRESS_SCALAR_EPS) this.progressFlatTicks++;
        else this.progressFlatTicks = 0;

        return this.progressScalar;
    }

    private isReplanGateOpen(): boolean {
        if (this.targetSelectFreezeTimer > 0) return false;
        if (this.currentState !== 'seek') return true;
        if (this.progressSamples.length < 2) return true;
        return this.progressFlatTicks >= PROGRESS_REPLAN_GATE_TICKS || this.progressScalar <= PROGRESS_REPLAN_EPS;
    }

    private getPingPongCommitWindow(): number {
        return PING_PONG_COMMIT_MIN + Math.random() * (PING_PONG_COMMIT_MAX - PING_PONG_COMMIT_MIN);
    }

    private forceProgressResetAndReselect(pose: Pose, reason: string) {
        if (this.progressResetCooldown > 0) return;

        const failureTag = 'progress-flat';
        if (this.activeManeuver && this.activeManeuverFromId !== null) {
            this.invalidateActiveManeuver(pose, failureTag, 5000);
        } else if (pose.groundedId !== null && this.targetPlatform) {
            this.graph.invalidateEdge(pose.groundedId, this.targetPlatform.id, failureTag, 5000);
        }

        this.recordLog(
            'PROGRESS_FLAT_RESET',
            pose,
            `${reason} scalar=${Number.isFinite(this.progressScalar) ? this.progressScalar.toFixed(1) : '-'} flat=${this.progressFlatTicks}`
        );

        this.currentState = 'idle';
        this.clearTargetLock();
        this.targetPlatform = null;
        this.targetX = null;
        this.autoTargetY = null;
        this.bestProgressDist = Infinity;
        this.progressStagnationTimer = 0;
        this.approachPhase = 'direct';
        this.approachX = null;
        this.moveCommitDir = 0;
        this.moveCommitTimer = 0;
        this.dropEdgeX = null;
        this.dropGroundId = null;
        this.dropLockTimer = 0;
        this.navState = 'nav-align';
        this.takeoffZone = null;
        this.patienceTimer = 0;
        this.progressResetCooldown = PROGRESS_RESET_COOLDOWN;
        this.targetSelectFreezeTimer = 0;
        this.resetProgressTracking();
        this.resetManeuverTracking();
        this.resetShaftClimbState();
        this.pickNewTarget(pose);
    }

    private resetSeekDiagnostics() {
        this.seekDiagTimer = 0;
        this.lastSeekPose = null;
        this.stallTimer = 0;
        this.facingFlipTimer = 0;
        this.facingFlipCount = 0;
        this.lastFacingSeen = 0;
        this.loopCooldown = 0;
        this.loopWarned = false;
        this.targetSelectFreezeTimer = 0;
        this.resetProgressTracking();
        this.resetShaftClimbState();
        this.resetDropIntentTracking();
    }

    private getBodyForm(pose: Pose): string {
        const crouched = pose.height <= 24;
        if (crouched) return 'crouch';
        return 'normal';
    }

    private emitTransitionLogs(pose: Pose, input: BrainInput) {
        if (this.lastModeSeen === null) this.lastModeSeen = this.currentState;
        else if (this.lastModeSeen !== this.currentState) {
            this.recordLog('MODE_SHIFT', pose, `${this.lastModeSeen} -> ${this.currentState}`);
            this.lastModeSeen = this.currentState;
        }

        if (this.lastBehaviorSeen === null) this.lastBehaviorSeen = pose.state;
        else if (this.lastBehaviorSeen !== pose.state) {
            this.recordLog('BEHAVIOR_SHIFT', pose, `${this.lastBehaviorSeen} -> ${pose.state}`);
            this.lastBehaviorSeen = pose.state;
        }

        const form = this.getBodyForm(pose);
        if (this.lastFormSeen === null) this.lastFormSeen = form;
        else if (this.lastFormSeen !== form) {
            this.recordLog('FORM_SHIFT', pose, `${this.lastFormSeen} -> ${form}`);
            this.lastFormSeen = form;
        }

        const support = pose.grounded ? `ground:${pose.groundedId ?? '-'}` : 'air';
        if (this.lastSupportSeen === null) this.lastSupportSeen = support;
        else if (this.lastSupportSeen !== support) {
            this.recordLog('SUPPORT_SHIFT', pose, `${this.lastSupportSeen} -> ${support}`);
            this.lastSupportSeen = support;
        }

        const dir = input.left ? 'L' : input.right ? 'R' : '-';
        const jump = input.jump ? (input.jumpGauge === null ? 'Jfull' : `Jg${input.jumpGauge.toFixed(2)}`) : '-';
        const intent = `${dir}|d:${input.down ? 1 : 0}|u:${input.up ? 1 : 0}|${jump}`;
        if (this.lastIntentSeen === null) this.lastIntentSeen = intent;
        else if (this.lastIntentSeen !== intent) {
            this.recordLog('INTENT_SHIFT', pose, `${this.lastIntentSeen} -> ${intent}`);
            this.lastIntentSeen = intent;
        }
    }

    recordLog(event: string, pose: Pose, detail: string = '') {
        const botCenterX = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const targetY = this.getTargetY();
        const targetDx = this.targetX !== null ? this.targetX - botCenterX : null;
        const targetDy = targetY !== null ? botFeetY - targetY : null;
        const entry: BrainLogEntry = {
            time: new Date().toISOString().slice(11, 23),
            event,
            botX: Math.round(pose.x),
            botY: Math.round(pose.y),
            botVx: Math.round(pose.vx),
            botVy: Math.round(pose.vy),
            botState: pose.state,
            targetId: this.targetPlatform?.id ?? null,
            targetX: this.targetX !== null ? Math.round(this.targetX) : null,
            targetY: targetY !== null ? Math.round(targetY) : null,
            lockId: this.lockedTargetId,
            targetDx: targetDx !== null ? Math.round(targetDx) : null,
            targetDy: targetDy !== null ? Math.round(targetDy) : null,
            brainState: this.currentState,
            phase: this.approachPhase,
            grounded: pose.grounded,
            groundedId: pose.groundedId ?? null,
            retry: this.retryCount,
            timer: Math.round(this.progressStagnationTimer * 10) / 10,
            detail
        };
        this.log.push(entry);
        if (this.log.length > MAX_LOG_ENTRIES) this.log.shift();

        if (this.lockedTargetId !== null) {
            if (event === 'PLAN_FAILURE' || event === 'GRAPH_FAIL' || event === 'seek-timeout' || event === 'stuck' || event === 'ABORT_MOVE') {
                this.lockFailCount++;
                if (this.lockFailCount >= 4) {
                    this.recordLog('LOCK_GIVE_UP', pose, `fail count ${this.lockFailCount} >= 4`);
                    this.clearTargetLock();
                    this.targetPlatform = null;
                    this.targetX = null;
                    this.autoTargetY = null;
                    this.currentState = 'idle';
                    this.navState = 'nav-align';
                    this.takeoffZone = null;
                    this.patienceTimer = 0;
                    this.resetManeuverTracking();
                }
            }
        }

        // Dispatch significant events for telemetry
        if (event === 'PLAN_FAILURE' || event.startsWith('REROUTE')) {
            window.dispatchEvent(new CustomEvent('parkour-bot:diagnostic', {
                detail: {
                    type: event.toLowerCase(),
                    moveDx: targetDx,
                    targetId: this.targetPlatform?.id,
                    retry: this.retryCount,
                    reason: detail
                }
            }));
        }
    }

    getLogText(errorsOnly: boolean = false): string {
        const ERRORS = [
            'PLAN_FAILURE', 'ABORT_MOVE', 'GIVE_UP_ABORT', 'MANUAL_GIVE_UP',
            'CEILING_LOOP', 'GLITCH_LOOP', 'LOOP_FALLBACK', 'TIC_TAC_STALL',
            'EDGE_DROP_FAIL', 'NAV_APPROACH_FAIL', 'JUMP_BLOCKED', 'CEILING_BONK',
            'OFFSCREEN_RESET', 'MANEUVER_INVALIDATE', 'BREADCRUMB_POP'
        ];

        const filtered = errorsOnly
            ? this.log.filter(e => ERRORS.some(err => e.event.includes(err)) || e.event.includes('FAIL') || e.event.includes('LOOP'))
            : this.log;

        if (filtered.length === 0) return errorsOnly ? 'No error events recorded.' : 'No events recorded yet.';

        const lines = filtered.map(e => {
            const pos = `bot(${e.botX},${e.botY})`;
            const vel = `v(${e.botVx},${e.botVy})`;
            const tgt = e.targetId !== null
                ? `tgt:ID${e.targetId}(${e.targetX},${e.targetY})`
                : `tgt:none`;
            const lock = e.lockId !== null ? `lock:${e.lockId}` : 'lock:-';
            const delta = e.targetDx !== null && e.targetDy !== null
                ? `d(${e.targetDx},${e.targetDy})`
                : 'd(-,-)';
            const state = `[${e.brainState}/${e.botState}]`;
            const support = e.grounded
                ? `g:${e.groundedId !== null ? e.groundedId : 'y'}`
                : 'air';
            const retry = e.retry > 0 ? `retry:${e.retry}` : '';
            const detail = e.detail ? `| ${e.detail}` : '';
            return `${e.time} ${e.event.padEnd(18)} ${state.padEnd(16)} ${pos.padEnd(16)} ${vel.padEnd(14)} ${tgt.padEnd(24)} ${lock.padEnd(9)} ${delta.padEnd(12)} ${e.phase.padEnd(7)} ${support.padEnd(6)} t:${e.timer}s ${retry} ${detail}`;
        });
        return lines.join('\n');
    }

    getRawLog(errorsOnly: boolean = false): BrainLogEntry[] {
        const ERRORS = [
            'PLAN_FAILURE', 'ABORT_MOVE', 'GIVE_UP_ABORT', 'MANUAL_GIVE_UP',
            'CEILING_LOOP', 'GLITCH_LOOP', 'LOOP_FALLBACK', 'TIC_TAC_STALL',
            'EDGE_DROP_FAIL', 'NAV_APPROACH_FAIL', 'JUMP_BLOCKED', 'CEILING_BONK',
            'OFFSCREEN_RESET', 'MANEUVER_INVALIDATE', 'BREADCRUMB_POP'
        ];
        return errorsOnly
            ? this.log.filter(e => ERRORS.some(err => e.event.includes(err)) || e.event.includes('FAIL') || e.event.includes('LOOP'))
            : this.log;
    }


    think(pose: Pose, dt: number): BrainInput {
        const input: BrainInput = { left: false, right: false, jump: false, down: false, up: false, jumpGauge: null };
        let loggedJumpBlocked = false;
        const requestJump = (gauge: number | null = null, reason: string = 'generic') => {
            const botCenterXNow = pose.x + pose.width / 2;
            const botFeetYNow = pose.y + pose.height;
            if (!this.isNavReadyForJump(pose, reason, botCenterXNow, botFeetYNow, targetY)) {
                if (!loggedJumpBlocked) {
                    this.recordLog('JUMP_BLOCKED', pose, `${reason} nav-not-ready state=${this.navState}`);
                    loggedJumpBlocked = true;
                }
                return;
            }

            const wallJumpIntent =
                (pose.state === 'wall-slide' || pose.state === 'climb') &&
                (reason.startsWith('wall-') || reason.startsWith('climb-') || reason === 'idle-wall-slide-kickoff');
            if (this.jumpCooldown > 0 && !wallJumpIntent) {
                if (!loggedJumpBlocked) {
                    this.recordLog('JUMP_BLOCKED', pose, `${reason} cooldown=${this.jumpCooldown.toFixed(2)}`);
                    loggedJumpBlocked = true;
                }
                return;
            }

            const suppressCeilingJump = this.ceilingJumpSuppressTimer > 0 && pose.grounded && reason !== 'drop-through';
            if (suppressCeilingJump) {
                if (!loggedJumpBlocked) {
                    this.recordLog('JUMP_SUPPRESS', pose, `${reason} ceiling-bonk suppress=${this.ceilingJumpSuppressTimer.toFixed(2)}`);
                    loggedJumpBlocked = true;
                }
                return;
            }

            if (!input.jump) {
                input.jump = true;
                input.jumpGauge = gauge;
                this.recordLog('JUMP_INTENT', pose, `${reason} ${gauge === null ? 'full' : `g=${gauge.toFixed(2)}`}`);
                return;
            }

            // Full jumps override gauged jumps; weaker gauges can refine existing gauged intent.
            if (gauge === null) {
                if (input.jumpGauge !== null) {
                    this.recordLog('JUMP_INTENT_UPGRADE', pose, `${reason} gauged->full`);
                }
                input.jumpGauge = null;
            } else if (input.jumpGauge !== null) {
                const nextGauge = Math.min(input.jumpGauge, gauge);
                if (Math.abs(nextGauge - input.jumpGauge) > 0.01) {
                    this.recordLog('JUMP_INTENT_TUNE', pose, `${reason} g=${nextGauge.toFixed(2)}`);
                }
                input.jumpGauge = nextGauge;
            }
        };

        this.graph.update(performance.now());

        const worldRevision = this.world.getRevision();
        const worldChecksum = this.world.getChecksum();
        if (worldRevision !== this.worldRevisionSeen) {
            const checksumDrift = this.didWorldChecksumDriftSignificantly(this.worldChecksumSeen, worldChecksum);
            if (checksumDrift) {
                const nextSig = this.getWorldChecksumSignature(worldChecksum);
                if (this.worldChecksumDriftSignature === nextSig) {
                    this.worldChecksumDriftStreak += 1;
                } else {
                    this.worldChecksumDriftSignature = nextSig;
                    this.worldChecksumDriftStreak = 1;
                }

                if (this.worldChecksumDriftStreak >= WORLD_CHECKSUM_DRIFT_CONFIRM_REVISIONS) {
                    this.invalidatePlanForWorldDrift(pose, this.worldChecksumSeen, worldChecksum);
                    this.worldChecksumDriftStreak = 0;
                    this.worldChecksumDriftSignature = null;
                } else {
                    this.recordLog(
                        'WORLD_CHECKSUM_PENDING',
                        pose,
                        `drift ${this.worldChecksumDriftStreak}/${WORLD_CHECKSUM_DRIFT_CONFIRM_REVISIONS} c:${this.worldChecksumSeen.colliderCount}->${worldChecksum.colliderCount} s:${this.worldChecksumSeen.solidCount}->${worldChecksum.solidCount} ow:${this.worldChecksumSeen.oneWayCount}->${worldChecksum.oneWayCount}`
                    );
                }
            } else {
                this.worldChecksumDriftStreak = 0;
                this.worldChecksumDriftSignature = null;
            }
            if (this.sealedDownIntentGrounds.size > 0) {
                this.recordLog(
                    'DOWN_SEAL_CLEAR',
                    pose,
                    `world rev ${this.worldRevisionSeen} -> ${worldRevision}; cleared=${this.sealedDownIntentGrounds.size}`
                );
            }
            this.sealedDownIntentGrounds.clear();
            this.downSealRerouteTimer = 0;
            this.worldRevisionSeen = worldRevision;
            this.worldChecksumSeen = worldChecksum;
        }

        // Re-evaluate the best waypoint if we have a locked target
        if (this.lockedTargetId !== null) {
            const now = performance.now();
            const groundedChanged = pose.groundedId !== this.lastGroundedId;
            const timeDrivenRefresh = now - this.lastReplanTime > 1500;
            if (groundedChanged || (timeDrivenRefresh && this.isReplanGateOpen())) {
                this.updateWaypoint(pose);
                this.lastGroundedId = pose.groundedId;
                this.lastReplanTime = now;
            }
        }
        this.syncActiveManeuver(pose);
        this.sanitizeAutoTargetToPlatform(pose);

        if (this.moveCommitTimer > 0) this.moveCommitTimer -= dt;
        if (this.dropLockTimer > 0) this.dropLockTimer -= dt;
        if (this.progressResetCooldown > 0) this.progressResetCooldown -= dt;
        if (this.worldChecksumReplanCooldown > 0) this.worldChecksumReplanCooldown -= dt;
        if (this.targetSelectFreezeTimer > 0) this.targetSelectFreezeTimer -= dt;
        if (this.ceilingBonkWindow > 0) this.ceilingBonkWindow -= dt;
        else this.ceilingBonkCount = 0;
        if (this.ceilingJumpSuppressTimer > 0) this.ceilingJumpSuppressTimer -= dt;
        if (this.navSlipTimer > 0) this.navSlipTimer -= dt;
        if (this.wallDecisionTimer > 0) this.wallDecisionTimer -= dt;
        if (this.ceilingEscapeTimer > 0) this.ceilingEscapeTimer -= dt;
        else this.ceilingEscapeDir = 0;
        if (this.ceilingArcInvalidateTimer > 0) this.ceilingArcInvalidateTimer -= dt;
        if (this.shaftHopTimer > 0) this.shaftHopTimer -= dt;
        if (this.downSealRerouteTimer > 0) this.downSealRerouteTimer -= dt;
        if (pose.state === 'wall-slide') this.wallSlideTimer += dt;
        else this.wallSlideTimer = 0;
        if (this.ticTacJumpTimer > 0) this.ticTacJumpTimer -= dt;
        if (this.ticTacPersistTimer > 0) this.ticTacPersistTimer -= dt;
        if (pose.grounded) this.resetTicTacState();

        const isSupported = pose.grounded;
        const botCenterX = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        let targetX = this.targetX;
        let targetY = this.getTargetY();
        let heightDiff = targetY !== null ? botFeetY - targetY : 0;
        const debugSnapshot: BrainDebugSnapshot = {
            tick: performance.now(),
            state: this.currentState,
            poseState: pose.state,
            navState: this.navState,
            approachPhase: this.approachPhase,
            botCenterX,
            botFeetY,
            targetX,
            targetY,
            targetDx: targetX !== null ? targetX - botCenterX : null,
            heightDiff: targetY !== null ? heightDiff : null,
            navTargetX: targetX,
            moveDx: null,
            moveDir: 0,
            shouldMoveHorizontally: false,
            deadzone: null,
            stickyBand: null,
            wallDir: 0,
            wallProbeLeft: null,
            wallProbeRight: null,
            wallProbeLeftHit: false,
            wallProbeRightHit: false,
            ticTacEligible: false,
            ticTacActive: this.ticTacActive,
            ticTacDir: this.ticTacDir,
            ticTacWallHoldTimer: this.ticTacWallHoldTimer,
            ticTacJumpTimer: this.ticTacJumpTimer,
            ticTacPersistTimer: this.ticTacPersistTimer,
            ticTacCorridorWidth: null,
            ticTacCorridorLeft: null,
            ticTacCorridorRight: null,
            shaftActive: this.shaftClimbActive,
            shaftDir: this.shaftClimbActive ? this.shaftClimbWallDir : 0,
            shaftCorridorWidth: null,
            overheadAligned: false,
            overheadProbe: null,
            overheadBlocked: false,
            ceilingHeadProbe: null,
            ceilingBlocked: false,
            ceilingEscapeWallProbeLeft: null,
            ceilingEscapeWallProbeRight: null,
            ceilingEscapeWallLeft: false,
            ceilingEscapeWallRight: false,
            ceilingArcBlocked: false,
            ceilingArcClearanceLeft: null,
            ceilingArcClearanceRight: null,
            airTuckProbe: null,
            airTuckWanted: false,
            gapProbe: null,
            gapProbeHasGround: null,
            dropPlannedEdgeX: null,
            dropDirection: 0,
            takeoffZone: this.takeoffZone
                ? { minX: this.takeoffZone.minX, maxX: this.takeoffZone.maxX, facing: this.takeoffZone.facing }
                : null,
            maneuverId: this.activeManeuver ? this.activeManeuver.maneuverId : null,
            maneuverFromId: this.activeManeuverFromId,
            maneuverToId: this.activeManeuverToId,
            maneuverDistToTakeoff: Number.isFinite(this.bestDistToTakeoff) ? this.bestDistToTakeoff : null,
            maneuverLOS: this.bestLOS > 0,
            maneuverVerticalGain: Number.isFinite(this.bestVerticalGain) ? this.bestVerticalGain : null,
            maneuverStagnation: this.maneuverStagnationTimer,
            maneuverCommitted: this.maneuverCommitted,
            timers: {
                progressStagnation: this.progressStagnationTimer,
                jumpCooldown: this.jumpCooldown,
                wallDecision: this.wallDecisionTimer,
                wallSlide: this.wallSlideTimer,
                ceilingSuppress: this.ceilingJumpSuppressTimer,
                retryCount: this.retryCount
            }
        };

        if (pose.ceilingBonk) {
            this.ceilingBonkCount = this.ceilingBonkWindow > 0 ? this.ceilingBonkCount + 1 : 1;
            this.ceilingBonkWindow = CEILING_BONK_WINDOW;
            const suppressFor = CEILING_BONK_SUPPRESS_BASE + Math.min(this.ceilingBonkCount, 3) * CEILING_BONK_SUPPRESS_STEP;
            this.ceilingJumpSuppressTimer = Math.max(this.ceilingJumpSuppressTimer, suppressFor);
            this.recordLog('CEILING_BONK', pose, `count=${this.ceilingBonkCount} suppress=${this.ceilingJumpSuppressTimer.toFixed(2)}`);

            if (this.ceilingBonkCount >= CEILING_BONK_REROUTE_HITS && this.currentState === 'seek') {
                this.recordLog('CEILING_LOOP', pose, `reroute after ${this.ceilingBonkCount} bonks`);

                // CRITICAL FIX: If we have an active maneuver, invalidate it so the planner finds a different way.
                if (this.activeManeuver && this.activeManeuverFromId !== null) {
                    this.invalidateActiveManeuver(pose, 'ceiling-block', 8500);
                } else if (pose.groundedId !== null && this.targetPlatform) {
                    this.graph.invalidateEdge(pose.groundedId, this.targetPlatform.id, 'ceiling-block', 8500);
                }

                this.reroute(pose, 'ceiling-bonk-loop');
                this.ceilingBonkCount = 0;
                this.ceilingBonkWindow = 0;
                this.ceilingJumpSuppressTimer = Math.max(this.ceilingJumpSuppressTimer, 0.55);
            }
        }

        // Track highest point reached (for exploration scoring)
        if (pose.grounded && pose.y < this.highestReached) {
            this.highestReached = pose.y;
        }

        // Timer Intelligence: 
        if (pose.state !== 'idle' && pose.state !== 'run') {
            this.progressStagnationTimer = Math.max(0, this.progressStagnationTimer - dt * 1.5);
        }

        // 1. Reset if off-screen
        if (pose.y > window.innerHeight + 200) {
            this.recordLog('OFFSCREEN_RESET', pose, `y=${Math.round(pose.y)} target=${this.targetPlatform?.id ?? this.lockedTargetId ?? '-'}`);
            this.currentState = 'idle';
            this.clearTargetLock();
            this.resetSeekDiagnostics();
            this.targetPlatform = null;
            this.targetX = null;
            this.autoTargetY = null;
            this.bestProgressDist = Infinity;
            this.progressStagnationTimer = 0;
            this.approachPhase = 'direct';
            this.approachX = null;
            this.moveCommitDir = 0;
            this.moveCommitTimer = 0;
            this.dropEdgeX = null;
            this.dropGroundId = null;
            this.dropLockTimer = 0;
            this.resetDropIntentTracking();
            this.targetSelectFreezeTimer = 0;
            this.resetProgressTracking();
            this.resetTicTacState();
            this.resetShaftClimbState();
            this.sealedDownIntentGrounds.clear();
            this.downSealRerouteTimer = 0;
        }

        // Trajectory Sanity Check
        // Only abort when the bot is clearly falling with no recovery:
        //  - Skip during backup/charge (deliberate maneuver)
        //  - Require significant downward velocity (vy > 300, truly falling not just a hop)
        //  - Don't abort within the first 1.5s of seeking (give the approach time to develop)
        const inApproachManeuver = this.approachPhase === 'backup' || this.approachPhase === 'charge';
        const elapsedSeekTime = this.progressStagnationTimer;
        if (this.currentState === 'seek' && targetX !== null && !pose.grounded && pose.vy > 300 && !inApproachManeuver && elapsedSeekTime > 1.5) {
            const landingBand = this.getActiveLandingBand();
            const bounds = landingBand
                ? { minX: landingBand.minX, maxX: landingBand.maxX }
                : this.targetPlatform
                    ? { minX: this.targetPlatform.aabb.x1 + 10, maxX: this.targetPlatform.aabb.x2 - 10 }
                    : targetX;
            const prediction = this.predictTrajectory(pose, bounds);
            const ty = targetY || 1000;
            const bandY = landingBand?.y ?? ty;
            const verticalMiss = prediction.landingY > bandY + 250 || prediction.landingY > 1200;
            let horizontalMiss = false;
            if (landingBand) {
                horizontalMiss = prediction.landingX < landingBand.minX - 48 || prediction.landingX > landingBand.maxX + 48;
            } else if (this.targetPlatform) {
                horizontalMiss = prediction.landingX < this.targetPlatform.aabb.x1 - 100 || prediction.landingX > this.targetPlatform.aabb.x2 + 100;
            } else {
                horizontalMiss = Math.abs(prediction.landingX - targetX) > 220;
            }
            const targetBelow = targetY !== null && targetY > botFeetY + 20;
            const nearHorizontal = Math.abs(targetX - botCenterX) < 180;
            const likelyRecoverableDrop = targetBelow && nearHorizontal;
            const shouldAbortSeek = verticalMiss && horizontalMiss && !likelyRecoverableDrop;
            let trajectoryFailure = 'trajectory-abort';
            if (landingBand) {
                if (prediction.landingX < landingBand.minX - 48) trajectoryFailure = 'trajectory-undershoot';
                else if (prediction.landingX > landingBand.maxX + 48) trajectoryFailure = 'trajectory-overshoot';
            } else if (this.targetPlatform) {
                if (prediction.landingX < this.targetPlatform.aabb.x1 - 100) trajectoryFailure = 'trajectory-undershoot';
                else if (prediction.landingX > this.targetPlatform.aabb.x2 + 100) trajectoryFailure = 'trajectory-overshoot';
            }
            if (verticalMiss && trajectoryFailure === 'trajectory-abort') {
                trajectoryFailure = 'trajectory-short';
            }
            if (pose.ceilingBonk || this.ceilingBonkCount > 0) {
                trajectoryFailure = 'trajectory-bonk';
            }

            if (shouldAbortSeek) {
                // Do not abandon an active platform target; recover via reroute.
                if (this.targetPlatform || this.getLockedTarget()) {
                    this.recordLog('ABORT_MOVE', pose, `${trajectoryFailure} -> reroute land=(${Math.round(prediction.landingX)},${Math.round(prediction.landingY)})`);
                    this.invalidateActiveManeuver(pose, trajectoryFailure, 5000);
                    if (!this.activeManeuver && pose.groundedId !== null && this.targetPlatform) {
                        this.graph.invalidateEdge(pose.groundedId, this.targetPlatform.id, trajectoryFailure, 5000);
                    }
                    this.approachPhase = 'direct';
                    this.approachX = null;
                    this.moveCommitDir = 0;
                    this.moveCommitTimer = 0;
                    this.dropEdgeX = null;
                    this.dropGroundId = null;
                    this.dropLockTimer = 0;
                    this.reroute(pose, 'abort-move');
                } else {
                    this.recordLog('ABORT_MOVE', pose, `trajectory missing land=(${Math.round(prediction.landingX)},${Math.round(prediction.landingY)})`);
                    this.recordLog('GIVE_UP_ABORT', pose, `no lock/manual target to recover`);
                    this.currentState = 'idle';
                    this.clearTargetLock();
                    this.targetPlatform = null;
                    this.targetX = null;
                    this.autoTargetY = null;
                    this.bestProgressDist = Infinity;
                    this.progressStagnationTimer = 0;
                    this.approachPhase = 'direct';
                    this.approachX = null;
                    this.moveCommitDir = 0;
                    this.moveCommitTimer = 0;
                    this.dropEdgeX = null;
                    this.dropGroundId = null;
                    this.dropLockTimer = 0;
                    this.navState = 'nav-align';
                    this.takeoffZone = null;
                    this.patienceTimer = 0;
                }
            }
        }

        if (this.hitConfirmedTimer > 0) {
            this.hitConfirmedTimer -= dt;
        }

        if (this.currentState !== 'seek') {
            this.seekDiagTimer = 0;
            this.lastSeekPose = null;
            this.stallTimer = 0;
            this.facingFlipTimer = 0;
            this.facingFlipCount = 0;
            this.lastFacingSeen = 0;
            this.loopWarned = false;
            this.resetProgressTracking();
        }

        // 2. State Machine
        if (this.currentState === 'idle') {
            this.pickNewTarget(pose);
            if (pose.state === 'wall-slide') {
                requestJump(null, 'idle-wall-slide-kickoff');
            }
            // If we picked a target, ensure we update our local context for the seek block below
            targetX = this.targetX;
            targetY = this.getTargetY();
            heightDiff = targetY !== null ? botFeetY - targetY : 0;
            debugSnapshot.state = this.currentState;
            debugSnapshot.targetX = targetX;
            debugSnapshot.targetY = targetY;
            debugSnapshot.targetDx = targetX !== null ? targetX - botCenterX : null;
            debugSnapshot.heightDiff = targetY !== null ? heightDiff : null;
        }

        if (this.currentState === 'seek') {
            if (targetX !== null) {
                const targetDy = targetY !== null ? Math.round(botFeetY - targetY) : null;
                const targetDx = Math.round(targetX - botCenterX);

                // Track state-space progress (min distance-to-goal)
                const currentDist = Math.hypot(targetDx, targetDy ?? 0);
                if (currentDist < this.bestProgressDist - 5) {
                    this.bestProgressDist = currentDist;
                    this.progressStagnationTimer = 0;
                }

                const hasGoalPressure = Math.abs(targetDx) > 12 || (targetDy !== null && Math.abs(targetDy) > 16);
                this.updateProgressScalar(targetX, targetY, targetDx, targetDy, currentDist, hasGoalPressure);

                if (this.progressFlatTicks >= PROGRESS_FLAT_RESET_TICKS) {
                    if (this.manualMode && this.retryCount < 3) {
                        this.retryCount++;
                        this.progressStagnationTimer = 0;
                        this.resetProgressTracking(this.getProgressAnchor(targetX, targetY));
                        this.recordLog(
                            'MANUAL_STALL_RETRY',
                            pose,
                            `retry ${this.retryCount}/3 flat=${this.progressFlatTicks} scalar=${Number.isFinite(this.progressScalar) ? this.progressScalar.toFixed(1) : '-'}`
                        );
                    } else {
                        if (this.manualMode) {
                            this.recordLog('MANUAL_GIVE_UP', pose, `flat progress scalar after ${this.retryCount} retries`);
                        }
                        this.forceProgressResetAndReselect(pose, 'progress-scalar-flat');
                        this.debugSnapshot = debugSnapshot;
                        this.emitTransitionLogs(pose, input);
                        return input;
                    }
                }

                // Count stagnation whenever an active target still requires movement.
                // We cannot rely on input flags here because movement intent is decided later in this tick.
                const isTryingToMove = hasGoalPressure || !pose.grounded || pose.state === 'wall-slide' || pose.state === 'climb';
                if (isTryingToMove && this.navState !== 'nav-ready') {
                    this.progressStagnationTimer += dt;
                }

                // FSM Watchdog: separate timer for "not getting ready to jump"
                // Unlike progressStagnationTimer, this does NOT reset when distance improves.
                if (this.navState !== 'nav-ready' && this.navState !== 'nav-commit') {
                    this.fsmStagnationTimer += dt;
                } else {
                    this.fsmStagnationTimer = 0;
                }

                // Eject if stagnant for too long (Progress Metric Timeout OR FSM Stagnation)
                if (this.progressStagnationTimer > 4.5 || this.fsmStagnationTimer > 4.5) {
                    const reason = this.progressStagnationTimer > 4.5 ? 'progress-stagnation' : 'fsm-stagnation';
                    const nearTarget = targetY !== null
                        && Math.abs(targetDx) < SEEK_TIMEOUT_NEAR_DX
                        && targetDy !== null
                        && Math.abs(targetDy) < SEEK_TIMEOUT_NEAR_DY;

                    if (this.manualMode && this.retryCount < 3) {
                        this.retryCount++;
                        this.progressStagnationTimer = 0;
                        this.fsmStagnationTimer = 0;
                        this.recordLog('MANUAL_STALL_RETRY', pose, `retry ${this.retryCount}/3 dx=${Math.round(targetDx)} dy=${targetDy !== null ? Math.round(targetDy) : '-'} reason=${reason}`);
                    } else {
                        if (this.manualMode) {
                            this.recordLog('MANUAL_GIVE_UP', pose, `stalled at manual target after ${this.retryCount} retries`);
                        }
                        this.retryCount++;
                        this.recordLog('PLAN_FAILURE', pose, `${reason} t=${Math.max(this.progressStagnationTimer, this.fsmStagnationTimer).toFixed(1)} dist=${Math.round(currentDist)} lock=${this.lockedTargetId ?? '-'}`);

                        if (this.navState === 'nav-approach' && this.targetPlatform) {
                            this.recordLog('NAV_APPROACH_FAIL', pose, 'timeout before takeoff zone');
                            this.takeoffCache.delete(this.targetPlatform.id);
                        }
                        this.invalidateActiveManeuver(pose, 'seek-timeout', 5000);
                        if (!this.activeManeuver && pose.groundedId !== null && this.targetPlatform) {
                            this.graph.invalidateEdge(pose.groundedId, this.targetPlatform.id, 'seek-timeout', 5000);
                        }
                        this.bestProgressDist = Infinity;
                        this.progressStagnationTimer = 0;
                        this.fsmStagnationTimer = 0;
                        this.attemptBreadcrumbRecovery(pose, 'seek-timeout');
                    }
                }

                if (this.updateManeuverProgress(pose, dt)) {
                    this.debugSnapshot = debugSnapshot;
                    this.emitTransitionLogs(pose, input);
                    return input;
                }

                const dx = targetX - botCenterX;
                let shouldMoveHorizontally = true;
                const targetIsWallStep = !!this.targetPlatform
                    && !this.targetPlatform.flags.oneWay
                    && (this.targetPlatform.aabb.x2 - this.targetPlatform.aabb.x1) <= WALL_STEP_MAX_WIDTH
                    && (this.targetPlatform.aabb.y2 - this.targetPlatform.aabb.y1) >= WALL_STEP_MIN_HEIGHT
                    && ((this.targetPlatform.aabb.y2 - this.targetPlatform.aabb.y1) / Math.max(this.targetPlatform.aabb.x2 - this.targetPlatform.aabb.x1, 1)) >= WALL_STEP_MIN_ASPECT;

                // ==== Auto-Waypoint Routing for tall climbs ====
                if (pose.grounded
                    && this.targetPlatform
                    && this.lockedTargetId !== null
                    && this.targetPlatform.id === this.lockedTargetId
                    && heightDiff > MAX_SINGLE_HOP) {
                    const waypoint = this.findWaypointBelow(pose, this.targetPlatform);
                    if (waypoint) {
                        this.recordLog('WAYPOINT', pose, `hop via ID${waypoint.id} -> lock ID${this.lockedTargetId} (hdiff ${Math.round(heightDiff)} > ${MAX_SINGLE_HOP})`);
                        this.targetPlatform = waypoint;
                        const wpCx = (waypoint.aabb.x1 + waypoint.aabb.x2) / 2;
                        this.targetX = wpCx;
                        this.bestProgressDist = Infinity;
                        this.progressStagnationTimer = 0;
                        this.fsmStagnationTimer = 0;
                        this.approachPhase = 'direct';
                        this.approachX = null;
                        return this.think(pose, 0);
                    }
                }

                // Intermediate platform launch logic
                if (!targetIsWallStep && pose.grounded && this.targetPlatform && Math.abs(dx) > 20) {
                    if (heightDiff > 60) {
                        const feetQuery = { x1: pose.x - 5, y1: botFeetY - 2, x2: pose.x + pose.width + 5, y2: botFeetY + 10 };
                        const groundBelow = this.world.query(feetQuery).filter(c => c.kind === 'rect' && c.flags.solid);
                        if (groundBelow.length > 0) {
                            const currentPlatform = groundBelow[0];
                            if (currentPlatform.id !== this.targetPlatform.id) {
                                const goingRight = dx > 0;
                                const edgeX = goingRight ? currentPlatform.aabb.x2 : currentPlatform.aabb.x1;
                                const distToEdge = goingRight ? edgeX - (pose.x + pose.width) : pose.x - edgeX;
                                if (distToEdge < 30 && distToEdge > -5) {
                                    shouldMoveHorizontally = false;
                                    requestJump(null, 'intermediate-edge-hop');
                                }
                            }
                        }
                    }
                }

                // Ledge Retargeting for head-bonking avoidance
                let smartTargetX = targetX;
                if (targetIsWallStep && this.targetPlatform) {
                    if (targetX > botCenterX) {
                        smartTargetX = this.targetPlatform.aabb.x1 - WALL_STEP_FACE_OFFSET;
                    } else {
                        smartTargetX = this.targetPlatform.aabb.x2 + WALL_STEP_FACE_OFFSET;
                    }
                } else if (heightDiff > 60 && this.targetPlatform && !this.targetPlatform.flags.oneWay) {
                    if (targetX > botCenterX) {
                        smartTargetX = this.targetPlatform.aabb.x1 - 30;
                    } else {
                        smartTargetX = this.targetPlatform.aabb.x2 + 30;
                    }
                }

                let navTargetX = smartTargetX;

                // --- Navigation FSM Pipeline ---
                if (pose.grounded && targetY !== null && heightDiff > 20 && this.targetPlatform && pose.groundedId !== null) {
                    if (this.navState === 'nav-align') {
                        const plannedEdge = this.graph.getBestEdge(
                            pose.groundedId,
                            this.targetPlatform.id,
                            this.getPlannerContext(pose)
                        );
                        if (plannedEdge) {
                            this.takeoffZone = {
                                minX: plannedEdge.takeoffMinX,
                                maxX: plannedEdge.takeoffMaxX,
                                facing: plannedEdge.facing
                            };
                            this.setActiveManeuver(plannedEdge, pose.groundedId, pose);
                            this.navState = 'nav-approach';
                            this.patienceTimer = 0.24;
                            this.recordLog(
                                'NAV_ALIGN',
                                pose,
                                `edge=${plannedEdge.action} tz=[${Math.round(plannedEdge.takeoffMinX)},${Math.round(plannedEdge.takeoffMaxX)}] land=[${Math.round(plannedEdge.landingMinX)},${Math.round(plannedEdge.landingMaxX)}]`
                            );
                        } else {
                            const currentFloor = this.world.colliders.get(pose.groundedId);
                            if (currentFloor) {
                                const cached = this.takeoffCache.get(this.targetPlatform.id);
                                if (cached) {
                                    this.takeoffZone = {
                                        minX: cached.takeoffX - 10,
                                        maxX: cached.takeoffX + 10,
                                        facing: targetX > botCenterX ? 1 : -1
                                    };
                                    this.navState = 'nav-approach';
                                    this.patienceTimer = 0.24;
                                    this.recordLog('NAV_ALIGN', pose, `cached tz=[${Math.round(this.takeoffZone.minX)},${Math.round(this.takeoffZone.maxX)}]`);
                                } else {
                                    const tz = this.calculateTakeoffZone(pose, currentFloor, this.targetPlatform, heightDiff);
                                    if (tz) {
                                        this.takeoffZone = tz;
                                        this.navState = 'nav-approach';
                                        this.patienceTimer = 0.24;
                                        this.recordLog('NAV_ALIGN', pose, `fallback tz=[${Math.round(tz.minX)},${Math.round(tz.maxX)}]`);
                                    } else {
                                        const localEdge = this.localSolver.solve(
                                            pose,
                                            { x: targetX!, y: targetY! },
                                            this.getPlannerContext(pose)
                                        );

                                        if (localEdge) {
                                            this.recordLog('LOCAL_SOLVE', pose, `align-fail rescue -> ID${localEdge.toId}`);
                                            this.executeLocalManeuver(pose, localEdge);
                                        } else {
                                            this.takeoffZone = null;
                                            this.navState = 'nav-approach';
                                            this.patienceTimer = 0.32;
                                            this.markTargetUnreachable(pose.groundedId, this.targetPlatform.id);
                                            this.recordLog('NAV_ALIGN_FAIL', pose, `no feasible edge ID${pose.groundedId}->ID${this.targetPlatform.id}`);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (this.navState === 'nav-approach') {
                        if (this.approachPhase === 'backup' && this.approachX !== null) {
                            navTargetX = this.approachX;
                            if (Math.abs(botCenterX - this.approachX) < 22) {
                                this.approachPhase = 'charge';
                                this.approachX = null;
                                this.recordLog('NAV_CHARGE', pose, 'run-up complete');
                            }
                        } else if (this.takeoffZone) {
                            if (botCenterX < this.takeoffZone.minX) {
                                navTargetX = this.takeoffZone.minX + 4;
                            } else if (botCenterX > this.takeoffZone.maxX) {
                                navTargetX = this.takeoffZone.maxX - 4;
                            } else {
                                this.navState = 'nav-ready';
                                this.navSlipTimer = 0;
                                this.patienceTimer = Math.max(this.patienceTimer, 0.12);
                                this.recordLog('NAV_READY', pose, `entered tz phase=${this.approachPhase}`);
                            }
                        } else {
                            navTargetX = smartTargetX;
                        }
                    }

                    if (this.navState === 'nav-ready') {
                        if (this.takeoffZone) {
                            const jumpDir = this.takeoffZone.facing;
                            // Target the FAR side of the zone to maintain momentum during charge
                            navTargetX = jumpDir > 0 ? this.takeoffZone.maxX - 5 : this.takeoffZone.minX + 5;

                            const outsideZone =
                                botCenterX < this.takeoffZone.minX - NAV_ZONE_EXIT_MARGIN
                                || botCenterX > this.takeoffZone.maxX + NAV_ZONE_EXIT_MARGIN;
                            if (outsideZone) {
                                this.navSlipTimer += dt;
                                if (this.navSlipTimer >= NAV_ZONE_SLIP_GRACE) {
                                    this.navState = 'nav-approach';
                                    this.navSlipTimer = 0;
                                    this.recordLog('NAV_SLIP', pose, `fell out of tz`);
                                }
                            } else {
                                this.navSlipTimer = 0;
                                const landingBand = this.getActiveLandingBand();
                                const landingMid = landingBand ? (landingBand.minX + landingBand.maxX) / 2 : targetX;
                                const launchLOS = landingMid !== null
                                    ? this.world.hasLineOfSight(botCenterX, botFeetY - 26, landingMid, (landingBand?.y ?? targetY) - 8)
                                    : true;
                                const launchHeadProbe: AABB = {
                                    x1: pose.x + 2,
                                    y1: pose.y - 44,
                                    x2: pose.x + pose.width - 2,
                                    y2: pose.y - 2
                                };
                                const launchHeadBlocked = this.world.query(launchHeadProbe)
                                    .some((c) => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);

                                const jumpDir = this.takeoffZone.facing;
                                const isChargingAtSpeed = (jumpDir > 0 && pose.vx > 100) || (jumpDir < 0 && pose.vx < -100);

                                if (isChargingAtSpeed) {
                                    this.patienceTimer = 0;
                                } else if (Math.abs(pose.vx) < 50 && launchLOS && !launchHeadBlocked) {
                                    this.patienceTimer -= dt;
                                } else {
                                    this.patienceTimer = Math.max(this.patienceTimer, 0.08);
                                }

                                if (this.patienceTimer > 0) {
                                    input.jump = false;
                                    input.jumpGauge = null;
                                }
                            }
                        } else {
                            this.navState = 'nav-align';
                        }
                    }
                } else {
                    this.navState = 'nav-align';
                    this.navSlipTimer = 0;
                    navTargetX = smartTargetX;
                    if (this.approachPhase !== 'direct') {
                        this.approachPhase = 'direct';
                        this.approachX = null;
                    }
                }

                // Wall Interaction
                let wallDir: -1 | 0 | 1 = 0;
                if (pose.state === 'wall-slide') {
                    wallDir = pose.facing;
                    debugSnapshot.wallDir = wallDir;
                } else {
                    const wallRightProbe = { x1: pose.x + pose.width, y1: pose.y + 10, x2: pose.x + pose.width + 25, y2: pose.y + pose.height - 10 };
                    const wallLeftProbe = { x1: pose.x - 25, y1: pose.y + 10, x2: pose.x, y2: pose.y + pose.height - 10 };
                    const wallRight = this.world.query(wallRightProbe);
                    const wallLeft = this.world.query(wallLeftProbe);
                    const wallRightHit = wallRight.some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);
                    const wallLeftHit = wallLeft.some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);

                    if (wallRightHit) wallDir = 1;
                    else if (wallLeftHit) wallDir = -1;

                    debugSnapshot.wallProbeRight = wallRightProbe;
                    debugSnapshot.wallProbeLeft = wallLeftProbe;
                    debugSnapshot.wallProbeRightHit = wallRightHit;
                    debugSnapshot.wallProbeLeftHit = wallLeftHit;
                    debugSnapshot.wallDir = wallDir as -1 | 0 | 1;
                }

                const corridor = this.measureCorridor(pose);
                const ticTacCorridor = corridor && corridor.width >= TIC_TAC_MIN_GAP_WIDTH && corridor.width <= TIC_TAC_MAX_GAP_WIDTH
                    ? corridor
                    : null;
                const narrowShaftCorridor = this.measureNarrowShaftCorridor(pose, corridor);
                if (ticTacCorridor) this.ticTacPersistTimer = TIC_TAC_PERSIST_TIME;
                debugSnapshot.ticTacCorridorWidth = ticTacCorridor ? ticTacCorridor.width : null;
                debugSnapshot.ticTacCorridorLeft = ticTacCorridor ? ticTacCorridor.leftDist : null;
                debugSnapshot.ticTacCorridorRight = ticTacCorridor ? ticTacCorridor.rightDist : null;
                debugSnapshot.shaftCorridorWidth = corridor ? corridor.width : null;

                // Dedicated narrow-shaft mode: single-wall climb with controlled hop cadence.
                if (this.shaftClimbActive) {
                    const insideStoredBounds = corridor !== null
                        && this.shaftCorridorLeftX !== null
                        && this.shaftCorridorRightX !== null
                        && botCenterX >= this.shaftCorridorLeftX - SHAFT_EXIT_MARGIN
                        && botCenterX <= this.shaftCorridorRightX + SHAFT_EXIT_MARGIN;
                    const noLongerUpwardGoal = targetY === null || heightDiff < 8;
                    if (!insideStoredBounds || (noLongerUpwardGoal && pose.grounded)) {
                        this.recordLog('SHAFT_CLIMB_END', pose, insideStoredBounds ? 'goal-level' : 'exit-bounds');
                        this.resetShaftClimbState();
                    }
                }

                if (!this.shaftClimbActive && narrowShaftCorridor && targetY !== null && heightDiff > 20) {
                    const targetDir: -1 | 1 = targetX >= botCenterX ? 1 : -1;
                    const preferRight = targetDir > 0;
                    const wallDir = preferRight
                        ? (narrowShaftCorridor.rightDist <= narrowShaftCorridor.leftDist ? 1 : -1)
                        : (narrowShaftCorridor.leftDist <= narrowShaftCorridor.rightDist ? -1 : 1);
                    this.shaftClimbActive = true;
                    this.shaftClimbWallDir = wallDir;
                    this.shaftCorridorLeftX = narrowShaftCorridor.leftWallX;
                    this.shaftCorridorRightX = narrowShaftCorridor.rightWallX;
                    this.shaftHopTimer = 0;
                    this.shaftStallTimer = 0;
                    this.shaftBestY = pose.y;
                    this.recordLog(
                        'SHAFT_CLIMB_START',
                        pose,
                        `w=${Math.round(narrowShaftCorridor.width)} dir=${wallDir > 0 ? 'R' : 'L'}`
                    );
                }

                const ticTacEligible =
                    targetY !== null &&
                    heightDiff > TIC_TAC_MIN_HEIGHT &&
                    !pose.grounded &&
                    !this.shaftClimbActive &&
                    (ticTacCorridor !== null || this.ticTacPersistTimer > 0);
                debugSnapshot.ticTacEligible = ticTacEligible;
                let ticTacHandled = false;

                if (this.shaftClimbActive) {
                    this.resetTicTacState();
                    this.ticTacPersistTimer = 0;
                    debugSnapshot.shaftActive = true;
                    debugSnapshot.shaftDir = this.shaftClimbWallDir;
                    debugSnapshot.ticTacEligible = false;
                    debugSnapshot.ticTacActive = false;
                    debugSnapshot.ticTacDir = 0;
                    ticTacHandled = true;

                    if (wallDir !== 0) {
                        this.shaftClimbWallDir = wallDir as -1 | 1;
                        debugSnapshot.shaftDir = this.shaftClimbWallDir;
                    }

                    input.down = false;
                    input.up = true;
                    input.left = this.shaftClimbWallDir < 0;
                    input.right = this.shaftClimbWallDir > 0;
                    input.jumpGauge = null;

                    if (pose.grounded && this.wallDecisionTimer <= 0) {
                        requestJump(null, 'shaft-climb-kickoff');
                        this.wallDecisionTimer = WALL_DECISION_COOLDOWN_FAST;
                        this.shaftHopTimer = SHAFT_HOP_COOLDOWN;
                    } else if ((pose.state === 'wall-slide' || pose.state === 'climb')
                        && this.shaftHopTimer <= 0
                        && this.wallDecisionTimer <= 0) {
                        const shouldHop = pose.state === 'wall-slide'
                            ? pose.vy >= 15 || this.shaftStallTimer > 0.45
                            : (pose.vy >= -10 || this.shaftStallTimer > 0.35);
                        if (shouldHop) {
                            requestJump(null, 'shaft-climb-hop');
                            this.wallDecisionTimer = WALL_DECISION_COOLDOWN_FAST;
                            this.shaftHopTimer = SHAFT_HOP_COOLDOWN;
                        }
                    }

                    if (pose.y < this.shaftBestY - SHAFT_MIN_VERTICAL_GAIN) {
                        this.shaftBestY = pose.y;
                        this.shaftStallTimer = 0;
                    } else {
                        this.shaftStallTimer += dt;
                    }

                    if (this.shaftStallTimer > SHAFT_STALL_WINDOW && this.wallDecisionTimer <= 0) {
                        requestJump(null, 'shaft-climb-stall-hop');
                        this.wallDecisionTimer = WALL_DECISION_COOLDOWN_FAST;
                        this.shaftHopTimer = SHAFT_HOP_COOLDOWN;
                        this.shaftStallTimer = SHAFT_STALL_WINDOW * 0.45;
                        this.recordLog('SHAFT_CLIMB_STALL', pose, `w=${corridor ? Math.round(corridor.width) : '-'} dir=${this.shaftClimbWallDir > 0 ? 'R' : 'L'}`);
                    }
                } else {
                    debugSnapshot.shaftActive = false;
                    debugSnapshot.shaftDir = 0;
                }

                if (ticTacEligible && (wallDir !== 0 || pose.state === 'wall-slide' || pose.state === 'climb' || this.ticTacActive)) {
                    if (!this.ticTacActive) {
                        const initDir = wallDir !== 0
                            ? (wallDir === 1 ? -1 : 1)
                            : (targetX !== null && targetX >= botCenterX ? 1 : -1);
                        this.ticTacActive = true;
                        this.ticTacDir = initDir as -1 | 1;
                        this.ticTacWallHoldTimer = 0;
                        this.ticTacJumpTimer = 0;
                        this.recordLog('TIC_TAC_START', pose, `dir=${initDir > 0 ? 'R' : 'L'} gap=${ticTacCorridor ? Math.round(ticTacCorridor.width) : '-'}`);
                    }

                    ticTacHandled = true;
                    input.down = false;
                    input.up = true;
                    input.jumpGauge = null;
                    debugSnapshot.ticTacActive = true;
                    debugSnapshot.ticTacDir = this.ticTacDir;

                    if (wallDir !== 0) {
                        this.ticTacWallHoldTimer += dt;
                        // Stick to the wall briefly, then kick away to the opposite wall.
                        input.left = wallDir < 0;
                        input.right = wallDir > 0;

                        const canKick = this.ticTacJumpTimer <= 0
                            && (pose.state === 'wall-slide' || pose.state === 'climb' || pose.vy >= 25);
                        const shouldKick = canKick
                            && (this.ticTacWallHoldTimer >= TIC_TAC_WALL_HOLD_TIME || this.ticTacDir === wallDir);
                        if (shouldKick) {
                            const awayDir = (wallDir === 1 ? -1 : 1) as -1 | 1;
                            input.left = awayDir < 0;
                            input.right = awayDir > 0;
                            requestJump(null, awayDir > 0 ? 'tic-tac-right-kick' : 'tic-tac-left-kick');
                            this.ticTacDir = awayDir;
                            this.ticTacJumpTimer = TIC_TAC_JUMP_COOLDOWN;
                            this.ticTacWallHoldTimer = 0;
                            debugSnapshot.ticTacDir = this.ticTacDir;
                        }
                    } else {
                        this.ticTacWallHoldTimer = 0;
                        const steerDir = this.ticTacDir !== 0
                            ? this.ticTacDir
                            : ((targetX !== null && targetX >= botCenterX) ? 1 : -1);
                        input.left = steerDir < 0;
                        input.right = steerDir > 0;
                    }

                    if (pose.y < this.ticTacBestY - 10) {
                        this.ticTacBestY = pose.y;
                        this.ticTacStallTimer = 0;
                    } else {
                        this.ticTacStallTimer += dt;
                    }

                    if (this.ticTacStallTimer > 1.2) {
                        this.recordLog('TIC_TAC_STALL', pose, `y=${Math.round(pose.y)} h=${Math.round(heightDiff)}`);
                        this.resetTicTacState();
                        ticTacHandled = false;
                    }
                } else if (this.ticTacActive && (pose.grounded || heightDiff < TIC_TAC_MIN_HEIGHT * 0.5 || this.ticTacPersistTimer <= 0)) {
                    this.recordLog('TIC_TAC_END', pose, `grounded=${pose.grounded ? 'y' : 'n'} h=${Math.round(heightDiff)}`);
                    this.resetTicTacState();
                    debugSnapshot.ticTacActive = false;
                    debugSnapshot.ticTacDir = 0;
                }

                if (!ticTacHandled && wallDir !== 0 && targetX !== null && targetY !== null && heightDiff > 20) {
                    const targetDir = Math.sign(targetX - botCenterX) || 1;
                    if (targetDir !== wallDir) {
                        if ((pose.state === 'wall-slide' || pose.state === 'climb') && this.wallDecisionTimer <= 0) {
                            requestJump(null, 'wall-reverse-hop');
                            this.wallDecisionTimer = WALL_DECISION_COOLDOWN;
                        }
                    } else {
                        // Keep pressing into the wall while climbing upward to avoid losing wall contact.
                        if (wallDir > 0) input.right = true;
                        else input.left = true;

                        if (pose.state === 'wall-slide') {
                            const climbCeilingBlocked = this.world.query({
                                x1: pose.x + 4,
                                y1: pose.y - 14,
                                x2: pose.x + pose.width - 4,
                                y2: pose.y - 2
                            }).some(c => c.flags.solid && !c.flags.oneWay);

                            const preferClimb = heightDiff > WALL_CLIMB_PREFER_HEIGHT && !climbCeilingBlocked;
                            const forceHop = this.wallSlideTimer >= WALL_SLIDE_FORCE_HOP_TIME && pose.vy >= 20;
                            if (preferClimb) {
                                input.up = true;
                            }

                            if (forceHop && this.wallDecisionTimer <= 0) {
                                requestJump(null, climbCeilingBlocked ? 'wall-slide-timeout-ceiling-hop' : 'wall-slide-timeout-hop');
                                this.wallDecisionTimer = WALL_DECISION_COOLDOWN_FAST;
                            } else if (!preferClimb && (heightDiff > WALL_HOP_RETRY_HEIGHT || pose.vy >= WALL_SLIDE_HOP_DOWNWARD_SPEED) && this.wallDecisionTimer <= 0) {
                                requestJump(null, climbCeilingBlocked ? 'wall-slide-ceiling-hop' : 'wall-slide-retry-hop');
                                this.wallDecisionTimer = WALL_DECISION_COOLDOWN_FAST;
                            }
                        } else if (pose.state === 'climb') {
                            // Break out with a jump if we stall vertically (vy >= 0 means gravity pulled us down or we hit ceiling)
                            if (heightDiff > 70 && pose.vy >= 0 && this.wallDecisionTimer <= 0) {
                                input.up = false;
                                requestJump(null, 'climb-stall-hop');
                                this.wallDecisionTimer = WALL_DECISION_COOLDOWN;
                            } else if (heightDiff > 70) {
                                input.up = true; // keep climbing
                            } else if (this.wallDecisionTimer <= 0) {
                                requestJump(null, 'climb-breakout-hop');
                                this.wallDecisionTimer = WALL_DECISION_COOLDOWN;
                            }
                        } else if (Math.abs(targetX - botCenterX) > WALL_TARGET_MIN_DX) {
                            const wallBiasX = botCenterX + (wallDir * WALL_TARGET_BIAS_DIST);
                            navTargetX = (navTargetX + wallBiasX) / 2;
                        }
                    }
                }

                // Special launch behavior for tall wall-column subtargets:
                // run at the face and trigger jump quickly to start wall-slide/climb.
                const wallLaunchAllowed = this.navState === 'nav-ready';
                if (!ticTacHandled && targetIsWallStep && this.targetPlatform && pose.grounded && wallLaunchAllowed && !input.down) {
                    const faceX = targetX > botCenterX
                        ? this.targetPlatform.aabb.x1 - WALL_STEP_FACE_OFFSET
                        : this.targetPlatform.aabb.x2 + WALL_STEP_FACE_OFFSET;
                    navTargetX = faceX;
                    const launchDir = faceX > botCenterX ? 1 : -1;
                    const nearLaunch = Math.abs(faceX - botCenterX) <= WALL_STEP_LAUNCH_DIST;
                    const carryingSpeed = pose.vx * launchDir >= WALL_STEP_LAUNCH_MIN_VX;
                    const headClear = !this.world.query({
                        x1: pose.x + 2,
                        y1: pose.y - 36,
                        x2: pose.x + pose.width - 2,
                        y2: pose.y - 2
                    }).some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);

                    if (nearLaunch && carryingSpeed && headClear && this.wallDecisionTimer <= 0) {
                        requestJump(null, 'wall-step-launch');
                        this.wallDecisionTimer = WALL_DECISION_COOLDOWN_FAST;
                    }
                }

                // Final Horizontal Movement
                debugSnapshot.navTargetX = navTargetX;
                const moveDx = navTargetX - botCenterX;
                debugSnapshot.moveDx = moveDx;
                if (!ticTacHandled) {
                    const nearAndLevel = pose.grounded && this.targetPlatform && Math.abs(moveDx) < 60 && Math.abs(heightDiff) < 40;
                    const speedDeadzoneBoost = pose.grounded ? Math.min(14, Math.abs(pose.vx) * 0.03) : 0;
                    let deadzone = (nearAndLevel ? STEER_DEADZONE_NEAR : STEER_DEADZONE_BASE) + speedDeadzoneBoost;
                    if (pose.state === 'slide') deadzone = Math.max(deadzone, STEER_DEADZONE_SLIDE);
                    const stickyBand = deadzone + STEER_COMMIT_STICKY_EXTRA;
                    debugSnapshot.deadzone = deadzone;
                    debugSnapshot.stickyBand = stickyBand;
                    debugSnapshot.shouldMoveHorizontally = shouldMoveHorizontally;

                    let moveDir: -1 | 0 | 1 = 0;
                    const commitActive = this.moveCommitDir !== 0 && this.moveCommitTimer > 0;
                    const commitBlocked = commitActive
                        ? this.isSteerDirectionBlocked(pose, this.moveCommitDir as -1 | 1)
                        : false;
                    if (shouldMoveHorizontally) {
                        if (commitActive && !commitBlocked) {
                            // During commit windows, keep one direction unless physically blocked.
                            moveDir = this.moveCommitDir;
                        } else if (this.moveCommitDir !== 0 && this.moveCommitTimer > 0 && Math.abs(moveDx) <= stickyBand) {
                            // Keep current commitment while crossing center to prevent jitter flips.
                            moveDir = this.moveCommitDir;
                        } else if (Math.abs(moveDx) > deadzone) {
                            moveDir = moveDx > 0 ? 1 : -1;
                        }
                    }

                    if (moveDir !== 0) {
                        const flippingNearCenter = this.moveCommitDir !== 0
                            && moveDir !== this.moveCommitDir
                            && this.moveCommitTimer > 0
                            && Math.abs(moveDx) < STEER_COMMIT_FLIP_GUARD;
                        const enforceCommit = commitActive && !commitBlocked && moveDir !== this.moveCommitDir;
                        if (enforceCommit || flippingNearCenter) {
                            moveDir = this.moveCommitDir;
                        } else if (moveDir !== this.moveCommitDir) {
                            this.moveCommitDir = moveDir;
                            const nextCommit = nearAndLevel ? STEER_COMMIT_HOLD_NEAR : STEER_COMMIT_HOLD_BASE;
                            this.moveCommitTimer = Math.max(this.moveCommitTimer, nextCommit);
                        }
                    } else if (this.moveCommitTimer <= 0) {
                        this.moveCommitDir = 0;
                    }

                    if (moveDir > 0) input.right = true;
                    else if (moveDir < 0) input.left = true;

                    // Takeoff Slip Guard: when in nav-ready, maintain charging direction even if we slightly overshoot the center.
                    if (this.navState === 'nav-ready' && this.takeoffZone) {
                        const chargeDir = this.takeoffZone.facing;
                        const inZone = botCenterX >= this.takeoffZone.minX - 4 && botCenterX <= this.takeoffZone.maxX + 4;
                        if (inZone) {
                            input.left = chargeDir < 0;
                            input.right = chargeDir > 0;
                            moveDir = chargeDir as -1 | 1;
                        }
                    }
                    debugSnapshot.moveDir = moveDir;

                    if (
                        moveDir === 0
                        && this.approachPhase !== 'backup'
                        && this.approachPhase !== 'charge'
                        && this.moveCommitTimer <= 0
                    ) {
                        this.moveCommitTimer = 0;
                    }

                    // If the target is almost straight above us and within a reasonable jump band,
                    // suppress lateral dithering and commit to a vertical ascent attempt.
                    const overheadAligned =
                        pose.grounded &&
                        targetX !== null &&
                        targetY !== null &&
                        this.approachPhase === 'direct' &&
                        heightDiff > OVERHEAD_LOCK_MIN_HEIGHT &&
                        heightDiff < OVERHEAD_LOCK_MAX_HEIGHT &&
                        Math.abs(targetX - botCenterX) <= OVERHEAD_LOCK_MAX_DX;
                    debugSnapshot.overheadAligned = overheadAligned;
                    if (overheadAligned) {
                        const verticalCeilingQuery = {
                            x1: pose.x + 2,
                            y1: pose.y - 40,
                            x2: pose.x + pose.width - 2,
                            y2: pose.y - 2
                        };
                        const hasHardCeiling = this.world.query(verticalCeilingQuery)
                            .some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);
                        const insideTakeoffZone = this.takeoffZone === null
                            || (botCenterX >= this.takeoffZone.minX && botCenterX <= this.takeoffZone.maxX);
                        const canCommitVerticalLock = this.takeoffZone === null
                            || this.navState === 'nav-ready'
                            || (this.navState === 'nav-approach' && insideTakeoffZone);
                        debugSnapshot.overheadProbe = verticalCeilingQuery;
                        debugSnapshot.overheadBlocked = hasHardCeiling;
                        if (!hasHardCeiling && canCommitVerticalLock) {
                            input.left = false;
                            input.right = false;
                            this.moveCommitDir = 0;
                            this.moveCommitTimer = 0;

                            const canVerticalJumpPlan = this.navState === 'nav-ready' || this.takeoffZone === null;
                            if (canVerticalJumpPlan && !input.jump && !input.down) {
                                const gauge = this.computeGaugedJump(pose, targetX - botCenterX, heightDiff);
                                if (gauge !== null) requestJump(gauge, 'overhead-lock-jump');
                                else requestJump(null, 'overhead-lock-full-jump');
                            }
                        }
                    }

                    // --- Ceiling Entrapment Guardrail ---
                    // If we need to go up but a ceiling is blocking the jump, force horizontal movement to find an opening.
                    const isStalledUnderCeiling = targetY !== null && heightDiff > 15 && !input.jump;
                    if (isStalledUnderCeiling && pose.grounded) {
                        const standingHeadY = pose.y + pose.height - 40;
                        const headProbe = { x1: pose.x + 2, y1: standingHeadY - 14, x2: pose.x + pose.width - 2, y2: pose.y - 2 };
                        const ceilingAbove = this.world.query(headProbe).some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);
                        const preferredEscape = this.moveCommitDir !== 0
                            ? this.moveCommitDir
                            : (targetX > botCenterX ? 1 : -1);
                        const arcLeft = this.probeCeilingArcClearance(pose, -1);
                        const arcRight = this.probeCeilingArcClearance(pose, 1);
                        const preferredArc = preferredEscape > 0 ? arcRight : arcLeft;
                        const arcBlocked = preferredArc.blocked;

                        // Also consider we are blocked if we keep bonking
                        const forceEscape = ceilingAbove || arcBlocked || (this.ceilingJumpSuppressTimer > 0.1 && this.ceilingBonkCount > 0);

                        debugSnapshot.ceilingHeadProbe = headProbe;
                        debugSnapshot.ceilingBlocked = ceilingAbove;
                        debugSnapshot.ceilingArcBlocked = arcBlocked;
                        debugSnapshot.ceilingArcClearanceLeft = arcLeft.clearance;
                        debugSnapshot.ceilingArcClearanceRight = arcRight.clearance;

                        if (forceEscape) {
                            if (arcBlocked && this.ceilingArcInvalidateTimer <= 0) {
                                const reason = 'ceiling-arc-block';
                                if (this.activeManeuver && this.activeManeuverFromId !== null) {
                                    this.invalidateActiveManeuver(pose, reason, 9000);
                                } else if (pose.groundedId !== null && this.targetPlatform) {
                                    this.graph.invalidateEdge(pose.groundedId, this.targetPlatform.id, reason, 9000);
                                }
                                this.ceilingArcInvalidateTimer = CEILING_ARC_INVALIDATE_COOLDOWN;
                                this.recordLog(
                                    'CEILING_ARC_BLOCK',
                                    pose,
                                    `L=${arcLeft.clearance.toFixed(2)} R=${arcRight.clearance.toFixed(2)} pref=${preferredEscape > 0 ? 'R' : 'L'}`
                                );
                            }

                            let escapeDir: -1 | 1 = (this.ceilingEscapeTimer > 0 && this.ceilingEscapeDir !== 0
                                ? this.ceilingEscapeDir
                                : preferredEscape) as -1 | 1;

                            // Bias toward direction with higher free-arc clearance.
                            if (arcRight.clearance > arcLeft.clearance + 0.08) escapeDir = 1;
                            else if (arcLeft.clearance > arcRight.clearance + 0.08) escapeDir = -1;

                            const wallDist = 30;
                            const wallBoxR = { x1: pose.x + pose.width, y1: pose.y, x2: pose.x + pose.width + wallDist, y2: pose.y + pose.height - 10 };
                            const wallBoxL = { x1: pose.x - wallDist, y1: pose.y, x2: pose.x, y2: pose.y + pose.height - 10 };
                            const wallR = this.world.query(wallBoxR).some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);
                            const wallL = this.world.query(wallBoxL).some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);

                            debugSnapshot.ceilingEscapeWallProbeRight = wallBoxR;
                            debugSnapshot.ceilingEscapeWallProbeLeft = wallBoxL;
                            debugSnapshot.ceilingEscapeWallRight = wallR;
                            debugSnapshot.ceilingEscapeWallLeft = wallL;

                            // Force seek an opening
                            if (wallR && !wallL) escapeDir = -1;
                            else if (wallL && !wallR) escapeDir = 1;

                            if (!wallR || !wallL) {
                                this.ceilingEscapeDir = escapeDir;
                                this.ceilingEscapeTimer = CEILING_ESCAPE_LATCH;
                                input.left = (escapeDir === -1);
                                input.right = (escapeDir === 1);
                                // If we're escaping, we definitely shouldn't be jumping yet
                                input.jump = false;
                                input.jumpGauge = null;
                                const reason = ceilingAbove
                                    ? 'blocked'
                                    : (arcBlocked ? 'arc-blocked' : 'suppressed');
                                this.recordLog(
                                    'CEILING_ESCAPE',
                                    pose,
                                    `dir=${escapeDir > 0 ? 'R' : 'L'} reason=${reason} L=${arcLeft.clearance.toFixed(2)} R=${arcRight.clearance.toFixed(2)}`
                                );
                            } else {
                                this.ceilingEscapeDir = 0;
                                this.ceilingEscapeTimer = 0;
                            }
                        }
                    }
                } else {
                    // Tic-tac mode owns lateral steering and jump timing.
                    this.moveCommitDir = 0;
                    this.moveCommitTimer = 0;
                    input.down = false;
                    if (input.left) input.right = false;
                    else if (input.right) input.left = false;
                    debugSnapshot.deadzone = null;
                    debugSnapshot.stickyBand = null;
                    debugSnapshot.moveDir = this.ticTacDir as -1 | 0 | 1;
                    debugSnapshot.shouldMoveHorizontally = true;
                }

                const loopRecovered = this.runSeekDiagnostics(pose, dt, moveDx, heightDiff, input);
                if (loopRecovered) {
                    // Avoid compounding loop correction with same-frame crouch/drop intents.
                    input.down = false;
                }

                // Arrival Check
                // Two ways to register a hit on a platform target:
                //  A) Grounded on it: groundedId matches, feet near top, close on X
                //  B) Body overlap: bot's AABB overlaps the platform's AABB (airborne touch counts)
                // This ensures the bot registers hits when jumping through elements on arbitrary sites.
                const botCenterY = pose.y + pose.height / 2;
                let isOnTargetPlatform = false;
                if (this.targetPlatform) {
                    const tp = this.targetPlatform;
                    // A) Grounded on the platform
                    const feetNearTop = Math.abs(botFeetY - tp.aabb.y1) <= 15;
                    const groundedHit = isSupported && pose.groundedId === tp.id && Math.abs(targetX - botCenterX) <= 35 && feetNearTop;
                    // B) Body overlaps the platform AABB (touching/passing through it)
                    //    No X-to-targetX check needed — if the bot is physically touching the element, it's a hit.
                    //    Min overlap of 5px prevents single-pixel grazes from counting.
                    const botAABB = { x1: pose.x, y1: pose.y, x2: pose.x + pose.width, y2: botFeetY };
                    const overlapX = Math.min(botAABB.x2, tp.aabb.x2) - Math.max(botAABB.x1, tp.aabb.x1);
                    const overlapY = Math.min(botAABB.y2, tp.aabb.y2) - Math.max(botAABB.y1, tp.aabb.y1);
                    const touchHit = overlapX > 5 && overlapY > 5;
                    isOnTargetPlatform = groundedHit || touchHit;
                }
                if (isOnTargetPlatform) {
                    this.lockFailCount = 0;
                }
                // Manual targets: bot center proximity, no grounded requirement
                // Manual targets: tighter center proximity since we don't have platform boundaries.
                const isNearManualTarget = !this.targetPlatform && targetY !== null && Math.abs(targetX - botCenterX) <= 15 && Math.abs(botCenterY - targetY) <= 15;

                if (isOnTargetPlatform || isNearManualTarget) {
                    this.recordLog('ARRIVED', pose, isOnTargetPlatform ? `platform ID:${this.targetPlatform!.id}` : 'coord match');
                    const arrivedId = this.targetPlatform ? this.targetPlatform.id : null;
                    this.lastHitId = arrivedId;
                    // Track visits
                    if (arrivedId !== null) {
                        const prevArrivalId = this.recentArrivals.length > 0
                            ? this.recentArrivals[this.recentArrivals.length - 1]
                            : null;
                        this.visitCounts.set(arrivedId, (this.visitCounts.get(arrivedId) || 0) + 1);
                        this.recentArrivals.push(arrivedId);
                        if (this.recentArrivals.length > 16) this.recentArrivals.shift();
                        if (prevArrivalId !== null && prevArrivalId !== arrivedId) {
                            this.recentTransitions.push({ fromId: prevArrivalId, toId: arrivedId });
                            if (this.recentTransitions.length > 24) this.recentTransitions.shift();
                        }

                        if (this.breadcrumbStack.length === 0 || this.breadcrumbStack[this.breadcrumbStack.length - 1] !== arrivedId) {
                            this.breadcrumbStack.push(arrivedId);
                            if (this.breadcrumbStack.length > 15) this.breadcrumbStack.shift();
                        }

                        // Cache the takeoff coordinates if we just arrived using a calculated takeoff zone
                        if (this.takeoffZone && this.navState === 'nav-ready') {
                            const cachedTx = (this.takeoffZone.minX + this.takeoffZone.maxX) / 2;
                            this.takeoffCache.set(arrivedId, { takeoffX: cachedTx, gauge: null });
                        }
                    }
                    const lockId = this.lockedTargetId;
                    const waypointArrival = arrivedId !== null && lockId !== null && arrivedId !== lockId;
                    if (waypointArrival) {
                        const locked = this.getLockedTarget();
                        if (locked) {
                            this.setStationaryPlatformTarget(locked, botCenterX);
                            this.currentState = 'seek';
                            this.bestProgressDist = Infinity;
                            this.progressStagnationTimer = 0;
                            this.retryCount = 0;
                            this.approachPhase = 'direct';
                            this.approachX = null;
                            this.moveCommitDir = 0;
                            this.moveCommitTimer = 0;
                            this.dropEdgeX = null;
                            this.dropGroundId = null;
                            this.dropLockTimer = 0;
                            this.recordLog('RESUME_LOCK', pose, `waypoint ID${arrivedId} -> final ID${lockId}`);
                            this.waypointStickyUntil = 0;
                            this.waypointOriginId = null;
                            this.fsmStagnationTimer = 0;
                        } else {
                            // Locked target disappeared (DOM changed). Fall back cleanly.
                            this.recordLog('GIVE_UP_LOCK', pose, `locked target missing after waypoint ID${arrivedId}`);
                            this.clearTargetLock();
                            this.hitConfirmedTimer = 0.5;
                            this.currentState = 'idle';
                            this.bestProgressDist = Infinity;
                            this.progressStagnationTimer = 0;
                            this.fsmStagnationTimer = 0;
                            this.targetPlatform = null;
                            this.targetX = null;
                            this.autoTargetY = null;
                            this.retryCount = 0;
                            this.approachPhase = 'direct';
                            this.approachX = null;
                            this.moveCommitDir = 0;
                            this.moveCommitTimer = 0;
                            this.dropEdgeX = null;
                            this.dropGroundId = null;
                            this.dropLockTimer = 0;
                            this.navState = 'nav-align';
                            this.takeoffZone = null;
                            this.patienceTimer = 0;
                        }
                    } else {
                        // Final target (or manual coordinate) completed.
                        if (arrivedId !== null && lockId !== null && arrivedId === lockId) {
                            this.clearTargetLock();
                        }
                        this.hitConfirmedTimer = 0.5;
                        this.currentState = 'idle';
                        this.bestProgressDist = Infinity;
                        this.progressStagnationTimer = 0;
                        this.fsmStagnationTimer = 0;
                        this.targetPlatform = null;
                        this.targetX = null;
                        this.autoTargetY = null;
                        this.retryCount = 0;
                        this.approachPhase = 'direct';
                        this.approachX = null;
                        this.moveCommitDir = 0;
                        this.moveCommitTimer = 0;
                        this.dropEdgeX = null;
                        this.dropGroundId = null;
                        this.dropLockTimer = 0;
                        this.navState = 'nav-align';
                        this.takeoffZone = null;
                        this.patienceTimer = 0;
                    }
                } else {
                    // Progress metric already handles timeouts, but we still want stuck/fall physics detections
                    // If we fall strictly below
                    if (isSupported && this.targetPlatform && (pose.y - this.targetPlatform.aabb.y1) > 200) {
                        // Allow brief grace period for dropping through
                        if (this.progressStagnationTimer > 1.0) {
                            this.retryCount++;
                            this.recordLog('FELL_BELOW', pose, `dy=${Math.round(pose.y - this.targetPlatform.aabb.y1)} retries=${this.retryCount}`);
                            if (this.retryCount % 5 === 0) {
                                this.recordLog('PERSIST_RETRY', pose, `lock=${this.lockedTargetId ?? '-'} attempts=${this.retryCount}`);
                            }
                            this.bestProgressDist = Infinity;
                            this.progressStagnationTimer = 0;
                            this.fsmStagnationTimer = 0;
                            this.attemptBreadcrumbRecovery(pose, 'fell-below-target');
                        }
                    }

                    // Specific physical snags: if moving super slowly while holding direction AND progressStagnationTimer proves it's not a tiny bump
                    if (this.approachPhase !== 'backup' && this.approachPhase !== 'charge') {
                        // If vx is very low despite input, and not just starting out:
                        const tryingHoriz = input.left || input.right;
                        if (tryingHoriz && pose.grounded && Math.abs(pose.vx) < 10 && this.progressStagnationTimer > 2.0) {
                            this.recordLog('STUCK', pose, `vx=${Math.round(pose.vx)} dx=${Math.round(targetX - botCenterX)} h=${Math.round(heightDiff)} phase=${this.approachPhase}`);
                            if (input.down && (input.left || input.right)) {
                                this.recordLog('STUCK_CROUCH_PATH', pose, `hold-crouch dir=${input.left ? 'L' : 'R'} dx=${Math.round(targetX - botCenterX)}`);
                            } else {
                                requestJump(null, 'stuck-recovery-hop');
                            }
                            // Reset local progress to prevent instant re-trigger
                            this.bestProgressDist = Infinity;
                            this.progressStagnationTimer = 0;
                            this.fsmStagnationTimer = 0;

                            // Unlike pure stagnation, physical stuck means we tried an edge and completely snagged.
                            const nearTarget = targetX !== null && targetY !== null
                                && Math.abs(targetX - botCenterX) < 140
                                && Math.abs(heightDiff) < 220;

                            if (isSupported && this.targetPlatform && (!nearTarget || this.retryCount > 1)) {
                                if (this.navState === 'nav-approach') {
                                    this.recordLog('NAV_APPROACH_FAIL', pose, 'stuck before takeoff zone');
                                    this.takeoffCache.delete(this.targetPlatform.id);
                                }
                                this.invalidateActiveManeuver(pose, 'stuck', 5000);
                                if (!this.activeManeuver && pose.groundedId !== null && this.targetPlatform) {
                                    this.graph.invalidateEdge(pose.groundedId, this.targetPlatform.id, 'stuck', 5000);
                                }
                                this.attemptBreadcrumbRecovery(pose, 'stuck');
                            }
                        }
                    }
                }
            }
        }

        // 3. Gap Handling (skip during backup phase — bot is deliberately retreating)
        const targetIsBelow = targetY !== null && targetY > (botFeetY + 10);
        const lookAhead = input.right ? 25 : input.left ? -25 : 0;
        const jumpAllowed = this.navState === 'nav-ready';

        if (lookAhead !== 0 && pose.grounded && this.currentState === 'seek' && this.approachPhase !== 'backup' && !targetIsBelow && !input.down) {
            const projectedFeet = { x1: pose.x + (input.right ? pose.width : 0) + lookAhead, y1: botFeetY, x2: pose.x + (input.right ? pose.width : 0) + lookAhead + 10, y2: botFeetY + 40 };
            const projectedHasGround = this.world.query(projectedFeet).some(c => c.kind === 'rect');
            debugSnapshot.gapProbe = projectedFeet;
            debugSnapshot.gapProbeHasGround = projectedHasGround;
            if (!projectedHasGround) {
                const gapGauge = targetX !== null ? this.computeGaugedJump(pose, targetX - botCenterX, heightDiff) : null;
                const hadJumpIntent = input.jump;
                requestJump(gapGauge, 'gap-jump');
                if (!hadJumpIntent && gapGauge !== null && input.jump) {
                    this.recordLog('GAUGED_JUMP', pose, `reason=gap g=${gapGauge.toFixed(2)} dx=${Math.round(Math.abs(targetX! - botCenterX))} h=${Math.round(heightDiff)}`);
                }
            }
        }

        // 3b. Low Ceiling Handling (Crouch/Slide)
        const currentBodyAABB = { x1: pose.x, y1: pose.y, x2: pose.x + pose.width, y2: botFeetY };
        const isOverlap = (b: { x1: number, y1: number, x2: number, y2: number }) =>
            currentBodyAABB.x1 < b.x2 && currentBodyAABB.x2 > b.x1 && currentBodyAABB.y1 < b.y2 && currentBodyAABB.y2 > b.y1;
        let crouchClearancePath = false;
        const suppressCeilingJump = this.ceilingJumpSuppressTimer > 0 && pose.grounded;

        const lookAheadCrouch = input.right ? 42 : input.left ? -42 : 0;
        const shouldConsiderCrouch =
            lookAheadCrouch !== 0 &&
            pose.grounded &&
            !input.jump &&
            this.approachPhase !== 'charge';

        if (shouldConsiderCrouch) {
            const ahead = Math.abs(lookAheadCrouch);
            const headBox = {
                x1: input.right ? pose.x + pose.width : pose.x - ahead,
                y1: botFeetY - 38,
                x2: input.right ? pose.x + pose.width + ahead : pose.x,
                y2: botFeetY - 22
            };
            const kneeBox = {
                x1: headBox.x1,
                y1: botFeetY - 18,
                x2: headBox.x2,
                y2: botFeetY - 2
            };

            const headBang = this.world.query(headBox).some(c => c.kind === 'rect' && c.flags.solid && !isOverlap(c.aabb));
            const kneeClear = !this.world.query(kneeBox).some(c => c.kind === 'rect' && c.flags.solid && !isOverlap(c.aabb));

            if (headBang && kneeClear) {
                input.down = true;
                crouchClearancePath = true;
                this.recordLog('CROUCH_PATH', pose, `dir=${input.right ? 'R' : 'L'} clearance=low-head`);
            }
        }

        // Air tuck: while jumping toward higher targets, compress height to pass low overhead slots.
        const shouldConsiderAirTuck =
            !pose.grounded &&
            targetY !== null &&
            heightDiff > 12 &&
            pose.state !== 'wall-slide' &&
            pose.state !== 'climb';

        if (shouldConsiderAirTuck) {
            const travelDir = input.right ? 1 : input.left ? -1 : (pose.vx > 25 ? 1 : pose.vx < -25 ? -1 : 0);
            const leadX = travelDir * 10;
            const airTuckProbe = {
                x1: pose.x + 2 + leadX,
                y1: pose.y - 14,
                x2: pose.x + pose.width - 2 + leadX,
                y2: pose.y + 12
            };
            const nearCeiling = this.world.query(airTuckProbe)
                .some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay && !isOverlap(c.aabb));
            const nearTargetColumn = targetX === null || Math.abs(targetX - botCenterX) <= 130;
            const upwardOrEarlyFall = pose.vy < 120;
            const airTuckWanted = nearCeiling && nearTargetColumn && upwardOrEarlyFall;

            debugSnapshot.airTuckProbe = airTuckProbe;
            debugSnapshot.airTuckWanted = airTuckWanted;
            if (airTuckWanted) input.down = true;
        } else {
            debugSnapshot.airTuckProbe = null;
            debugSnapshot.airTuckWanted = false;
        }

        // Low Ceiling / Head Bang
        if (pose.grounded && (input.left || input.right)) {
            const wallCheckDist = 30;
            const tDir = input.right ? 1 : -1;
            const wallBox = { x1: tDir > 0 ? pose.x + pose.width : pose.x - wallCheckDist, y1: pose.y, x2: tDir > 0 ? pose.x + pose.width + wallCheckDist : pose.x, y2: pose.y + pose.height - 10 };
            if (this.world.query(wallBox).some(c => c.kind === 'rect' && c.flags.solid && !isOverlap(c.aabb)) && heightDiff > 10) {
                if (crouchClearancePath || input.down || suppressCeilingJump) {
                    // In tight horizontal lanes, keep crouching rather than forcing a jump.
                    if (suppressCeilingJump) input.down = true;
                    input.jump = false;
                    input.jumpGauge = null;
                } else {
                    const ceilingQuery = { x1: pose.x + 2, y1: pose.y - 30, x2: pose.x + pose.width - 2, y2: pose.y - 2 };
                    if (!this.world.query(ceilingQuery).some(c => c.flags.solid && !c.flags.oneWay && !isOverlap(c.aabb))) requestJump(null, 'wall-bang-hop');
                }
            }

            // High Ground Jump (skip during backup phase — don't jump while retreating)
            if (jumpAllowed && targetX !== null && this.approachPhase !== 'backup' && heightDiff > 12 && !input.down && !input.jump && !crouchClearancePath && !suppressCeilingJump) {
                // Check if target requires more height than current ceiling allows
                const clearanceNeeded = Math.min(100, heightDiff + 10);
                const ceilingQuery = {
                    x1: pose.x + 2,
                    y1: pose.y - clearanceNeeded,
                    x2: pose.x + pose.width - 2,
                    y2: pose.y - 2
                };

                const blockedByCeiling = this.world.query(ceilingQuery).some(c => c.flags.solid && !c.flags.oneWay && !isOverlap(c.aabb));

                if (!blockedByCeiling) {
                    const dxAbs = Math.abs(targetX - botCenterX);
                    const gauge = this.approachPhase === 'direct'
                        ? this.computeGaugedJump(pose, targetX - botCenterX, heightDiff)
                        : null;

                    if (gauge !== null) {
                        requestJump(gauge, 'direct-gauged-jump');
                        if (input.jump) {
                            this.recordLog('GAUGED_JUMP', pose, `reason=direct g=${gauge.toFixed(2)} dx=${Math.round(dxAbs)} h=${Math.round(heightDiff)}`);
                        }
                    } else if (heightDiff > 20 && dxAbs < 160) {
                        // Only auto-jump if we are reasonably close horizontally.
                        // Otherwise, walk until we reach the gap/edge.
                        requestJump(null, 'direct-full-jump');
                    }
                }
            }
        }

        // Drop Down (for full-width headers/footers where walking off the edge isn't possible)
        // If target is significantly below us and we are horizontally aligned, drop through!
        const groundedCollider = pose.groundedId !== null ? this.world.colliders.get(pose.groundedId) : undefined;

        // If target is below and we're standing on a solid platform, commit to an edge drop plan.
        if (pose.grounded && groundedCollider && !groundedCollider.flags.oneWay && targetX !== null && targetY !== null && heightDiff < -30) {
            const seal = this.assessDownwardSeal(groundedCollider);
            const downSealed = this.sealedDownIntentGrounds.has(groundedCollider.id);
            if (seal.sealed && !downSealed) {
                this.sealedDownIntentGrounds.add(groundedCollider.id);
                this.recordLog(
                    'DOWN_SEALED',
                    pose,
                    `ground=ID${groundedCollider.id} cov=${seal.coverage.toFixed(2)} open=${seal.openRun} walls=${seal.leftWall && seal.rightWall ? 'yy' : `${seal.leftWall ? 'y' : 'n'}${seal.rightWall ? 'y' : 'n'}`}`
                );
                this.invalidateActiveManeuver(pose, 'down-sealed', 8000);
                if (!this.activeManeuver && this.targetPlatform) {
                    this.graph.invalidateEdge(groundedCollider.id, this.targetPlatform.id, 'down-sealed', 8000);
                }
                this.reroute(pose, 'down-sealed');
                this.downSealRerouteTimer = DOWN_SEAL_REROUTE_COOLDOWN;
            }

            if (this.sealedDownIntentGrounds.has(groundedCollider.id)) {
                this.dropEdgeX = null;
                this.dropGroundId = null;
                this.dropLockTimer = 0;
                debugSnapshot.dropPlannedEdgeX = null;
                debugSnapshot.dropDirection = 0;
                if (this.downSealRerouteTimer <= 0) {
                    this.reroute(pose, 'down-sealed');
                    this.downSealRerouteTimer = DOWN_SEAL_REROUTE_COOLDOWN;
                }
            } else {
                const edgePad = 6;
                const leftEdge = groundedCollider.aabb.x1 + edgePad;
                const rightEdge = groundedCollider.aabb.x2 - edgePad;

                const hasWallAtEdge = (edgeX: number, dir: -1 | 1) => {
                    const probe = {
                        x1: dir > 0 ? edgeX : edgeX - 18,
                        y1: pose.y + 8,
                        x2: dir > 0 ? edgeX + 18 : edgeX,
                        y2: pose.y + pose.height - 8
                    };
                    return this.world.query(probe).some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay && c.id !== groundedCollider.id);
                };

                const leftBlocked = hasWallAtEdge(leftEdge, -1);
                const rightBlocked = hasWallAtEdge(rightEdge, 1);
                const leftScore = Math.abs(targetX - leftEdge) + (leftBlocked ? 1000 : 0);
                const rightScore = Math.abs(targetX - rightEdge) + (rightBlocked ? 1000 : 0);

                const desiredEdge = rightScore <= leftScore ? rightEdge : leftEdge;
                const sameGround = this.dropGroundId === groundedCollider.id;
                const shouldReuseDropPlan = sameGround && this.dropEdgeX !== null && this.dropLockTimer > 0;
                const chosenEdge = shouldReuseDropPlan ? this.dropEdgeX! : desiredEdge;
                const dropRight = Math.abs(chosenEdge - rightEdge) <= Math.abs(chosenEdge - leftEdge);
                const dropBlocked = dropRight ? rightBlocked : leftBlocked;

                if (!shouldReuseDropPlan) {
                    this.dropEdgeX = chosenEdge;
                    this.dropGroundId = groundedCollider.id;
                    this.dropLockTimer = 2.5; // Increased stickiness to ensure we reach the edge
                    this.recordLog(
                        'EDGE_DROP_PLAN',
                        pose,
                        `ground=ID${groundedCollider.id} edge=${Math.round(chosenEdge)} blocked=${dropBlocked ? 'y' : 'n'} targetDx=${Math.round(targetX - botCenterX)}`
                    );
                }

                const dropDir: -1 | 1 = dropRight ? 1 : -1;
                const dropExitX = chosenEdge + dropDir * (pose.width * 0.75 + 4);
                const distFromEdge = Math.abs(chosenEdge - botCenterX);
                const atEdge = distFromEdge < 26;

                debugSnapshot.dropPlannedEdgeX = chosenEdge;
                debugSnapshot.dropDirection = dropDir;

                // Intent-stuck: we reached the drop edge and intend to fall, but downward motion never starts.
                // In this physics model, downward velocity is +vy.
                const intendsDrop = atEdge && !dropBlocked;
                if (intendsDrop) {
                    const sameIntent =
                        this.dropIntentGroundId === groundedCollider.id
                        && this.dropIntentEdgeX !== null
                        && Math.abs(this.dropIntentEdgeX - chosenEdge) < 2;
                    if (!sameIntent) {
                        this.dropIntentGroundId = groundedCollider.id;
                        this.dropIntentEdgeX = chosenEdge;
                        this.dropIntentStuckTimer = 0;
                    }

                    const startedFalling = !pose.grounded || pose.vy >= EDGE_DROP_INTENT_FALL_VY;
                    if (startedFalling) {
                        this.resetDropIntentTracking();
                    } else {
                        this.dropIntentStuckTimer += dt;
                    }

                    if (!startedFalling && this.dropIntentStuckTimer > EDGE_DROP_INTENT_STUCK_WINDOW) {
                        this.recordLog(
                            'EDGE_DROP_INTENT_STUCK',
                            pose,
                            `ground=ID${groundedCollider.id} vy=${Math.round(pose.vy)} t=${this.dropIntentStuckTimer.toFixed(2)}`
                        );
                        if (this.targetPlatform) {
                            this.graph.invalidateEdge(groundedCollider.id, this.targetPlatform.id, 'edge-drop-intent-stuck', 6000);
                        }
                        this.invalidateActiveManeuver(pose, 'edge-drop-intent-stuck', 6000);
                        this.resetManeuverTracking();
                        this.dropEdgeX = null;
                        this.dropGroundId = null;
                        this.dropLockTimer = 0;
                        this.resetDropIntentTracking();
                        this.reroute(pose, 'edge-drop-intent-stuck');
                    }
                } else {
                    this.resetDropIntentTracking();
                }

                // Breakout logic for walled edges
                if (atEdge && dropBlocked) {
                    if (this.progressStagnationTimer > 1.2 && this.wallDecisionTimer <= 0) {
                        requestJump(null, 'edge-drop-wall-hop');
                        this.wallDecisionTimer = WALL_DECISION_COOLDOWN;
                    }

                    // If persistently blocked even after jump attempts, invalidate the edge/target.
                    if (this.progressStagnationTimer > 2.5) {
                        this.recordLog('EDGE_DROP_FAIL', pose, `blocked by wall at edge ID${groundedCollider.id}`);
                        if (this.targetPlatform) {
                            this.graph.invalidateEdge(groundedCollider.id, this.targetPlatform.id, 'edge-drop-blocked', 5000);
                        }
                        this.invalidateActiveManeuver(pose, 'edge-drop-blocked');
                        this.resetManeuverTracking(); // Force re-evaluation
                    }
                }

                // Horizontal Steering
                input.right = dropDir > 0;
                input.left = dropDir < 0;

                // Keep crouch only when we explicitly detected a low-clearance horizontal path.
                if (!crouchClearancePath) {
                    input.down = false;
                }
            }
        } else if (!pose.grounded || !groundedCollider || groundedCollider.flags.oneWay) {
            this.dropEdgeX = null;
            this.dropGroundId = null;
            this.dropLockTimer = 0;
            debugSnapshot.dropPlannedEdgeX = null;
            debugSnapshot.dropDirection = 0;
            this.downSealRerouteTimer = 0;
        }

        const canDropThroughGround = !!groundedCollider?.flags.oneWay;

        if (pose.grounded && canDropThroughGround && targetX !== null && heightDiff < -30) {
            const dx = Math.abs(targetX - botCenterX);
            if (dx < 70) {
                input.down = true;
                requestJump(null, 'drop-through');
            }
        }

        // Air jumps: choose between double or triple based on target gap.
        if (!pose.grounded && pose.state !== 'wall-slide' && pose.jumps < MAX_TOTAL_JUMPS && targetX !== null) {
            const dx = Math.abs(targetX - botCenterX);
            const descending = pose.vy > 50;
            const shouldDouble =
                pose.jumps < 2 &&
                ((heightDiff > 80 && descending) ||
                    (dx > 150 && heightDiff > 60 && pose.vy > 50 && pose.vy < 220));

            const shouldTriple =
                pose.jumps >= 2 &&
                ((heightDiff > 150 && pose.vy > 110) ||
                    (dx > 220 && heightDiff > 70 && pose.vy > 70));

            if (shouldDouble || shouldTriple) {
                requestJump(null, shouldTriple ? 'triple-air-jump' : 'double-air-jump');
                if (shouldTriple) {
                    this.recordLog('TRIPLE_JUMP', pose, `dx=${Math.round(dx)} h=${Math.round(heightDiff)} vy=${Math.round(pose.vy)}`);
                }
            }
        }

        // Jump Cooldown
        const wallActionJump = input.jump && (pose.state === 'wall-slide' || pose.state === 'climb');
        if (this.jumpCooldown > 0) {
            this.jumpCooldown -= dt;
            if (!wallActionJump) {
                input.jump = false;
                input.jumpGauge = null;
            }
        } else if (input.jump) {
            this.jumpCooldown = wallActionJump ? 0.08 : 0.15;
        }

        debugSnapshot.state = this.currentState;
        debugSnapshot.poseState = pose.state;
        debugSnapshot.navState = this.navState;
        debugSnapshot.approachPhase = this.approachPhase;
        debugSnapshot.ticTacActive = this.ticTacActive;
        debugSnapshot.ticTacDir = this.ticTacDir;
        debugSnapshot.ticTacWallHoldTimer = this.ticTacWallHoldTimer;
        debugSnapshot.ticTacJumpTimer = this.ticTacJumpTimer;
        debugSnapshot.ticTacPersistTimer = this.ticTacPersistTimer;
        debugSnapshot.takeoffZone = this.takeoffZone
            ? { minX: this.takeoffZone.minX, maxX: this.takeoffZone.maxX, facing: this.takeoffZone.facing }
            : null;
        debugSnapshot.maneuverId = this.activeManeuver ? this.activeManeuver.maneuverId : null;
        debugSnapshot.maneuverFromId = this.activeManeuverFromId;
        debugSnapshot.maneuverToId = this.activeManeuverToId;
        debugSnapshot.maneuverDistToTakeoff = Number.isFinite(this.bestDistToTakeoff) ? this.bestDistToTakeoff : null;
        debugSnapshot.maneuverLOS = this.bestLOS > 0;
        debugSnapshot.maneuverVerticalGain = Number.isFinite(this.bestVerticalGain) ? this.bestVerticalGain : null;
        debugSnapshot.maneuverStagnation = this.maneuverStagnationTimer;
        debugSnapshot.maneuverCommitted = this.maneuverCommitted;
        debugSnapshot.timers = {
            progressStagnation: this.progressStagnationTimer,
            jumpCooldown: this.jumpCooldown,
            wallDecision: this.wallDecisionTimer,
            wallSlide: this.wallSlideTimer,
            ceilingSuppress: this.ceilingJumpSuppressTimer,
            retryCount: this.retryCount
        };
        this.debugSnapshot = debugSnapshot;

        this.emitTransitionLogs(pose, input);
        return input;
    }

    private getBreadcrumbPenaltyForTarget(targetId: number, now: number): number {
        const state = this.breadcrumbTargetPenalty.get(targetId);
        if (!state) return 0;
        if (now >= state.expiresAt) {
            this.breadcrumbTargetPenalty.delete(targetId);
            return 0;
        }
        const life = Math.max(1, state.expiresAt - state.appliedAt);
        const remain = (state.expiresAt - now) / life;
        return state.value * Math.max(0, Math.min(1, remain));
    }

    private applyBreadcrumbPopCost(pose: Pose, reason: string, rewoundToId: number) {
        const now = performance.now();
        const tailTransitions = this.recentTransitions.slice(-BREADCRUMB_COST_LOOKBACK);
        const penalties = new Map<number, number>();

        for (let i = tailTransitions.length - 1; i >= 0; i--) {
            const trace = tailTransitions[i];
            const recencyIndex = tailTransitions.length - 1 - i; // 0 = newest
            const decay = Math.max(0.35, 1 - recencyIndex * 0.18);
            const base = Math.round((BREADCRUMB_COST_BASE + BREADCRUMB_COST_STEP * recencyIndex) * decay);

            this.graph.invalidateEdge(trace.fromId, trace.toId, 'breadcrumb-pop-cost', BREADCRUMB_COST_EDGE_INVALID_MS);
            penalties.set(trace.toId, (penalties.get(trace.toId) || 0) + base);
            penalties.set(trace.fromId, (penalties.get(trace.fromId) || 0) + Math.round(base * 0.45));
        }

        const targetTail = this.platformHistory.slice(-BREADCRUMB_COST_LOOKBACK);
        for (let i = targetTail.length - 1; i >= 0; i--) {
            const targetId = targetTail[i];
            const recencyIndex = targetTail.length - 1 - i;
            const add = Math.round((BREADCRUMB_COST_BASE * 0.5 + BREADCRUMB_COST_STEP * recencyIndex) * 0.7);
            penalties.set(targetId, (penalties.get(targetId) || 0) + add);
        }

        penalties.delete(rewoundToId);
        let appliedCount = 0;
        for (const [id, add] of penalties.entries()) {
            if (!this.world.colliders.has(id)) continue;
            const current = this.getBreadcrumbPenaltyForTarget(id, now);
            const next = Math.min(BREADCRUMB_COST_MAX, current + add);
            this.breadcrumbTargetPenalty.set(id, {
                value: next,
                appliedAt: now,
                expiresAt: now + BREADCRUMB_COST_TTL_MS
            });
            appliedCount++;
        }

        if (appliedCount > 0) {
            this.recordLog(
                'BREADCRUMB_COST',
                pose,
                `${reason}: penalized=${appliedCount} lookback=${tailTransitions.length} ttl=${Math.round(BREADCRUMB_COST_TTL_MS / 1000)}s`
            );
        }
    }

    private shouldTrackLoopReason(reason: string): boolean {
        return reason.includes('loop')
            || reason.includes('stuck')
            || reason.includes('timeout')
            || reason.includes('sealed')
            || reason.includes('abort')
            || reason.includes('no-progress')
            || reason.includes('flat');
    }

    private buildLoopSignature(pose: Pose, failReason: string): string {
        const platformId = pose.groundedId ?? -1;
        const targetId = this.targetPlatform?.id ?? this.lockedTargetId ?? -1;
        const state = this.currentState === 'seek' ? this.navState : this.currentState;
        const edgeId = this.activeManeuver
            ? `${this.activeManeuverFromId ?? '?'}>${this.activeManeuver.toId}:${this.activeManeuver.action}`
            : 'none';
        return `(${platformId},${targetId},${state},${edgeId},${failReason})`;
    }

    private triggerLoopHardFallback(pose: Pose, signature: string, reason: string) {
        const botCx = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const primeFallbackTarget = (pick: Collider, mode: 'local-random' | 'global-nearest' | 'local-reachable' | 'local-reachable-biased') => {
            this.lockedTargetId = pick.id;
            this.setStationaryPlatformTarget(pick, botCx, true);
            this.resetManeuverTracking();
            this.currentState = 'seek';
            this.bestProgressDist = Infinity;
            this.progressStagnationTimer = 0;
            this.fsmStagnationTimer = 0;
            this.approachPhase = 'direct';
            this.approachX = null;
            this.moveCommitDir = 0;
            this.moveCommitTimer = 0;
            this.dropEdgeX = null;
            this.dropGroundId = null;
            this.dropLockTimer = 0;
            this.targetSelectFreezeTimer = Math.max(this.targetSelectFreezeTimer, 0.3);
            this.recentWarpDestinations.push(pick.id);
            if (this.recentWarpDestinations.length > 5) this.recentWarpDestinations.shift();
            this.recordLog('LOOP_FALLBACK', pose, `sig=${signature} ${reason}: ${mode} ID${pick.id}`);
            window.dispatchEvent(new CustomEvent('parkour-bot:diagnostic', {
                detail: {
                    type: 'loop_fallback',
                    reason,
                    mode,
                    targetId: pick.id
                }
            }));
        };
        const searchAABB: AABB = {
            x1: botCx - 420,
            y1: botFeetY - 260,
            x2: botCx + 420,
            y2: botFeetY + 220
        };
        let pool = this.world.query(searchAABB).filter((c) => {
            if (c.kind !== 'rect' || !c.flags.solid) return false;
            if ((c.aabb.x2 - c.aabb.x1) < MIN_PLATFORM_SIZE) return false;
            if (this.targetPlatform && c.id === this.targetPlatform.id) return false;
            if (pose.grounded && pose.groundedId === c.id) return false;
            if (this.recentWarpDestinations.includes(c.id)) return false;
            return true;
        });

        if (pool.length === 0) {
            this.recordLog('LOOP_FALLBACK', pose, `strict pool empty, relaxing exclusions (allow recent warps)`);
            pool = this.world.query(searchAABB).filter((c) => {
                if (c.kind !== 'rect' || !c.flags.solid) return false;
                if ((c.aabb.x2 - c.aabb.x1) < MIN_PLATFORM_SIZE) return false;
                if (this.targetPlatform && c.id === this.targetPlatform.id) return false;
                if (pose.grounded && pose.groundedId === c.id) return false;
                // Allow recentWarpDestinations here as last resort
                return true;
            });
        }

        const idleTime = LOOP_FALLBACK_IDLE_MIN + Math.random() * (LOOP_FALLBACK_IDLE_MAX - LOOP_FALLBACK_IDLE_MIN);
        if (pool.length > 0 && pose.grounded && pose.groundedId !== null) {
            const startId = pose.groundedId;
            const reachablePool = pool.filter((c) =>
                this.findPathWithContext(startId, c.id, pose, true) !== null
            );
            if (reachablePool.length > 0) {
                // Select with bias toward escaping local region (furthest)
                reachablePool.sort((a, b) => {
                    const distA = Math.hypot(((a.aabb.x1 + a.aabb.x2) / 2) - botCx, a.aabb.y1 - botFeetY);
                    const distB = Math.hypot(((b.aabb.x1 + b.aabb.x2) / 2) - botCx, b.aabb.y1 - botFeetY);
                    return distB - distA; // Descending
                });
                const topCount = Math.min(3, reachablePool.length);
                const pick = reachablePool[Math.floor(Math.random() * topCount)];
                primeFallbackTarget(pick, 'local-reachable-biased');
                return;
            }
        } else if (pool.length > 0 && !pose.grounded) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            primeFallbackTarget(pick, 'local-random');
            return;
        }

        // If reachable set is empty, escalate to non-local escape strategy
        if (this.tryPickCoordinateTarget(pose, this.world.getAll(), true)) {
            this.recordLog('LOOP_FALLBACK', pose, `sig=${signature} ${reason}: escalated to non-local coord`);
            window.dispatchEvent(new CustomEvent('parkour-bot:diagnostic', {
                detail: {
                    type: 'loop_fallback',
                    reason,
                    mode: 'coordinate',
                    targetX: this.targetX,
                    targetY: this.autoTargetY
                }
            }));
            return;
        }

        const globalPool = this.world.getAll().filter((c) => {
            if (c.kind !== 'rect' || !c.flags.solid) return false;
            if ((c.aabb.x2 - c.aabb.x1) < MIN_PLATFORM_SIZE) return false;
            if (this.targetPlatform && c.id === this.targetPlatform.id) return false;
            if (pose.grounded && pose.groundedId === c.id) return false;
            if (this.recentWarpDestinations.includes(c.id)) return false;
            return true;
        });
        if (globalPool.length > 0) {
            let nearest = globalPool[0];
            let bestDist = Infinity;
            for (const c of globalPool) {
                const cx = (c.aabb.x1 + c.aabb.x2) / 2;
                const dist = Math.hypot(cx - botCx, c.aabb.y1 - botFeetY);
                if (dist < bestDist) {
                    bestDist = dist;
                    nearest = c;
                }
            }
            primeFallbackTarget(nearest, 'global-nearest');
            return;
        }

        this.currentState = 'idle';
        this.targetPlatform = null;
        this.targetX = null;
        this.autoTargetY = null;
        this.targetSelectFreezeTimer = Math.max(this.targetSelectFreezeTimer, idleTime);
        this.recordLog('LOOP_FALLBACK', pose, `sig=${signature} ${reason}: idle ${idleTime.toFixed(2)}s`);
    }

    private trackLoopIncident(pose: Pose, failReason: string): boolean {
        if (!this.shouldTrackLoopReason(failReason)) return false;

        const now = performance.now();
        for (const [sig, hits] of this.loopSignatureHits.entries()) {
            const fresh = hits.filter((ts) => now - ts <= LOOP_SIGNATURE_WINDOW_MS);
            if (fresh.length === 0) this.loopSignatureHits.delete(sig);
            else if (fresh.length !== hits.length) this.loopSignatureHits.set(sig, fresh);
        }
        const signature = this.buildLoopSignature(pose, failReason);
        const prior = this.loopSignatureHits.get(signature) ?? [];
        const recent = prior.filter((ts) => now - ts <= LOOP_SIGNATURE_WINDOW_MS);
        recent.push(now);
        this.loopSignatureHits.set(signature, recent);

        this.recordLog('LOOP_SIG', pose, `${signature} count=${recent.length}/${LOOP_SIGNATURE_ESCALATE_COUNT}`);
        if (recent.length < LOOP_SIGNATURE_ESCALATE_COUNT) return false;

        this.triggerLoopHardFallback(pose, signature, failReason);
        this.loopSignatureHits.set(signature, [now]);
        return true;
    }

    /**
     * Multi-factor platform scoring for intelligent target selection.
     *
     * Factors:
     *  1. Distance        — prefer nearby but not trivially close
     *  2. Vertical gain   — strongly prefer upward targets (climbing is interesting)
     *  3. Novelty         — HARD penalty for repeat visits (uncapped, escalating)
     *  4. Exploration     — reward platforms above the "highestReached" watermark
     *  5. Reachability    — bonus for directly jumpable
     *  6. Fairness        — equalizer that penalises over-visited and rewards under-visited
     *  7. Line of sight   — visible platforms feel more intentional
     */
    private scoreTarget(pose: Pose, c: Collider, avgVisits: number, now: number): number {
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
        const visits = this.visitCounts.get(c.id) || 0;
        if (visits === 0) {
            score += 20;   // Never-visited bonus — actively seek new platforms
        } else {
            score -= Math.min(48, visits * 8);
        }
        const fairnessDelta = visits - avgVisits;
        if (fairnessDelta > 0.5) {
            score -= Math.min(22, fairnessDelta * 4);
        }
        if (this.recentArrivals.slice(-12).includes(c.id)) {
            score -= 32;
        }

        // 4. Exploration — reward unvisited vertical territory
        if (c.aabb.y1 < this.highestReached) {
            score += 20;
        }

        // 5. Reachability
        if (dy > 0 && dy <= MAX_SINGLE_HOP && dx < 500) {
            score += 10;
        }
        if (dy > MAX_SINGLE_HOP && dx < 100) {
            score += 5;
        }

        // Penalize highly vertical surfaces as primary targets (prevents wall-center lock).
        const verticalRatio = platH / Math.max(platW, 1);
        if (verticalRatio > 2.5) score -= 45;
        else if (verticalRatio > 1.7) score -= 20;

        // 7. Line of sight bonus
        const hasLOS = this.world.hasLineOfSight(botCx, pose.y + pose.height / 2, platCx, c.aabb.y1);
        if (hasLOS) score += 10;

        const breadcrumbPenalty = this.getBreadcrumbPenaltyForTarget(c.id, now);
        if (breadcrumbPenalty > 0) score -= breadcrumbPenalty;

        // 8. Random noise — breaks determinism across page refreshes.
        //    ±15 is enough to shuffle similarly-scored candidates without
        //    letting a bad platform beat a clearly better one.
        score += (Math.random() - 0.5) * 30;

        return score;
    }

    private getRecentBlockedTargetIds(currentGroundedId: number | null): Set<number> {
        const blocked = new Set<number>();
        const recent = this.recentArrivals.slice(-RECENT_TARGET_BLOCK_COUNT);
        for (const id of recent) blocked.add(id);

        if (currentGroundedId !== null) {
            const unreachable = this.recentUnreachable.get(currentGroundedId);
            if (unreachable) {
                const now = performance.now();
                for (const entry of unreachable) {
                    if (now - entry.time < 5000) {
                        blocked.add(entry.targetId);
                    }
                }
            }
        }
        return blocked;
    }

    private tryPickCoordinateTarget(pose: Pose, candidates: Collider[], preferFar: boolean): boolean {
        if (candidates.length === 0) return false;
        if (performance.now() - this.lastCoordinateFallbackTime < 8000) return false;

        const botCx = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const minDist = preferFar ? FAR_TARGET_MIN_DIST : 280;

        const ranked = candidates
            .filter(c => c.kind === 'rect' && c.flags.solid && (c.aabb.x2 - c.aabb.x1) >= MIN_PLATFORM_SIZE)
            .map(c => {
                const cx = (c.aabb.x1 + c.aabb.x2) / 2;
                const cy = c.aabb.y1;
                const dist = Math.hypot(cx - botCx, cy - botFeetY);
                return { collider: c, dist };
            })
            .sort((a, b) => b.dist - a.dist);

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
            const blocked = this.world.query(probe).some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);
            if (blocked) continue;

            const coordDist = Math.hypot(x - botCx, y - botFeetY);
            if (coordDist < minDist * 0.85) continue;

            this.targetPlatform = null;
            this.clearTargetLock();
            this.targetX = x;
            this.autoTargetY = y;
            this.currentState = 'seek';
            this.bestProgressDist = Infinity;
            this.progressStagnationTimer = 0;
            this.fsmStagnationTimer = 0;
            this.retryCount = 0;
            this.approachPhase = 'direct';
            this.approachX = null;
            this.seekDiagTimer = 0;
            this.lastSeekPose = null;
            this.stallTimer = 0;
            this.facingFlipTimer = 0;
            this.facingFlipCount = 0;
            this.lastFacingSeen = 0;
            this.loopWarned = false;
            this.moveCommitDir = 0;
            this.moveCommitTimer = 0;
            this.dropEdgeX = null;
            this.dropGroundId = null;
            this.dropLockTimer = 0;
            this.navState = 'nav-align';
            this.takeoffZone = null;
            this.patienceTimer = 0;
            this.breadcrumbStack = [];

            this.lastCoordinateFallbackTime = performance.now();
            this.resetManeuverTracking();
            this.resetShaftClimbState();
            this.resetTicTacState();
            this.recordLog(
                'NEW_COORD_TARGET',
                pose,
                `coord(${Math.round(x)},${Math.round(y)}) base=ID${base.id} dist=${Math.round(coordDist)} far=${preferFar ? 'y' : 'n'}`
            );
            return true;
        }

        return false;
    }

    private computeGaugedJump(pose: Pose, targetDx: number, heightDiff: number): number | null {
        // Gauged jumps are for upward targets where full jump would likely overshoot.
        if (heightDiff <= 6) return null;

        const dxAbs = Math.abs(targetDx);
        const expectedAirSpeed = Math.max(180, Math.min(420, Math.abs(pose.vx) > 40 ? Math.abs(pose.vx) : 300));

        let bestGauge: number | null = null;
        let bestScore = Number.POSITIVE_INFINITY;

        for (let t = GAUGE_TIME_MIN; t <= GAUGE_TIME_MAX + 1e-6; t += GAUGE_TIME_STEP) {
            const requiredJumpSpeed = (heightDiff / t) + (0.5 * PLANNER_GRAVITY * t);
            const gauge = requiredJumpSpeed / PLANNER_FULL_JUMP_SPEED;

            if (gauge < GAUGED_JUMP_MIN || gauge > GAUGED_JUMP_MAX) continue;

            const predictedDx = expectedAirSpeed * t;
            const xError = Math.abs(predictedDx - dxAbs);
            const centerBias = Math.abs(gauge - 0.45) * 22; // avoid always pinning min/max gauge
            const score = xError + centerBias;

            if (score < bestScore) {
                bestScore = score;
                bestGauge = gauge;
            }
        }

        if (bestGauge === null) return null;

        // If horizontal mismatch is too large, don't force a gauged jump.
        const allowedMismatch = Math.max(35, dxAbs * 0.8);
        if (bestScore > allowedMismatch + 12) return null;

        return Math.max(GAUGED_JUMP_MIN, Math.min(GAUGED_JUMP_MAX, bestGauge));
    }

    private describeCandidateForLog(pose: Pose, s: { collider: Collider; score: number }): string {
        const c = s.collider;
        const botCx = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const cx = (c.aabb.x1 + c.aabb.x2) / 2;
        const dx = Math.round(cx - botCx);
        const dy = Math.round(botFeetY - c.aabb.y1);
        const prediction = this.predictTrajectory(pose, cx);
        const reachable =
            prediction.landingX >= c.aabb.x1 - 20 &&
            prediction.landingX <= c.aabb.x2 + 20 &&
            Math.abs(prediction.landingY - c.aabb.y1) < 120;
        const hasLOS = this.world.hasLineOfSight(botCx, pose.y + pose.height / 2, cx, c.aabb.y1);
        const landingDx = Math.round(prediction.landingX - cx);
        const landingDy = Math.round(prediction.landingY - c.aabb.y1);
        const width = Math.round(c.aabb.x2 - c.aabb.x1);
        const height = Math.round(c.aabb.y2 - c.aabb.y1);
        return `ID${c.id} s=${Math.round(s.score)} d=(${dx},${dy}) land=(${landingDx},${landingDy}) ${reachable ? 'reach' : 'nreach'} ${hasLOS ? 'los' : 'nlos'} ${c.flags.oneWay ? '1w' : 'solid'} sz=${width}x${height}`;
    }

    private runSeekDiagnostics(
        pose: Pose,
        dt: number,
        moveDx: number,
        heightDiff: number,
        input: BrainInput
    ): boolean {
        this.seekDiagTimer += dt;
        if (this.seekDiagTimer >= SEEK_DIAG_INTERVAL) {
            this.seekDiagTimer = 0;
            this.recordLog(
                'SEEK_DIAG',
                pose,
                `dx=${Math.round(moveDx)} h=${Math.round(heightDiff)} phase=${this.approachPhase} lock=${this.lockedTargetId ?? '-'} stall=${this.stallTimer.toFixed(2)} flip=${this.facingFlipCount}`
            );
        }

        const movedDistance = this.lastSeekPose
            ? Math.hypot(pose.x - this.lastSeekPose.x, pose.y - this.lastSeekPose.y)
            : 999;
        this.lastSeekPose = { x: pose.x, y: pose.y };

        const isTryingMove = input.left || input.right;
        if (pose.grounded && isTryingMove && movedDistance < 2.2 && Math.abs(moveDx) > 28) {
            this.stallTimer += dt;
        } else {
            this.stallTimer = Math.max(0, this.stallTimer - dt * 0.7);
        }

        if (pose.grounded && isTryingMove && Math.abs(moveDx) < 220) {
            if (this.lastFacingSeen !== 0 && pose.facing !== this.lastFacingSeen) {
                this.facingFlipCount++;
                this.facingFlipTimer = 1.2;
            }
            this.lastFacingSeen = pose.facing;
        }

        if (this.facingFlipTimer > 0) {
            this.facingFlipTimer -= dt;
        } else {
            this.facingFlipCount = Math.max(0, this.facingFlipCount - 1);
        }

        if (this.loopCooldown > 0) this.loopCooldown -= dt;

        const loopWarning =
            this.loopCooldown <= 0 &&
            this.stallTimer > LOOP_WARN_STALL &&
            this.facingFlipCount >= LOOP_WARN_FLIPS;
        if (loopWarning && !this.loopWarned) {
            const commitWindow = this.getPingPongCommitWindow();
            const preferredCommitDir: -1 | 1 = input.right ? 1 : (input.left ? -1 : (moveDx >= 0 ? 1 : -1));
            this.targetSelectFreezeTimer = Math.max(this.targetSelectFreezeTimer, commitWindow);
            this.moveCommitTimer = Math.max(this.moveCommitTimer, commitWindow);
            this.moveCommitDir = preferredCommitDir;
            this.recordLog(
                'LOOP_WARN',
                pose,
                `flip=${this.facingFlipCount} stall=${this.stallTimer.toFixed(2)} dx=${Math.round(moveDx)} h=${Math.round(heightDiff)} phase=${this.approachPhase} commit=${commitWindow.toFixed(2)}`
            );
            window.dispatchEvent(new CustomEvent('parkour-bot:diagnostic', {
                detail: {
                    type: 'loop_warn',
                    moveDx,
                    heightDiff,
                    stallTimer: this.stallTimer,
                    flipCount: this.facingFlipCount,
                    phase: this.approachPhase
                }
            }));
            this.loopWarned = true;
        } else if (!loopWarning) {
            this.loopWarned = false;
        }

        const loopDetected =
            this.loopCooldown <= 0 &&
            ((this.stallTimer > LOOP_DETECT_STALL && this.facingFlipCount >= LOOP_DETECT_FLIPS) ||
            this.facingFlipCount > 12);
        if (loopDetected) {
            this.lockFailCount++;
            if (this.lockFailCount >= 4 && this.lockedTargetId !== null) {
                this.recordLog('LOCK_GIVE_UP', pose, `glitch-loop limit ${this.lockFailCount} >= 4`);
                this.clearTargetLock();
                this.targetPlatform = null;
                this.targetX = null;
                this.autoTargetY = null;
                this.currentState = 'idle';
                this.navState = 'nav-align';
                this.takeoffZone = null;
                this.patienceTimer = 0;
                this.resetManeuverTracking();
                // Return true to signal loop was handled (by aborting)
                return true;
            }

            const commitWindow = this.getPingPongCommitWindow();
            const preferredCommitDir: -1 | 1 = moveDx >= 0 ? 1 : -1;
            this.recordLog(
                'GLITCH_LOOP',
                pose,
                `flip=${this.facingFlipCount} stall=${this.stallTimer.toFixed(2)} dx=${Math.round(moveDx)} h=${Math.round(heightDiff)} phase=${this.approachPhase}`
            );

            // Try local solve
            const targetPos = (this.targetX !== null && this.autoTargetY !== null)
                ? { x: this.targetX, y: this.autoTargetY }
                : (this.targetPlatform ? { x: (this.targetPlatform.aabb.x1 + this.targetPlatform.aabb.x2) / 2, y: this.targetPlatform.aabb.y1 } : null);

            const localEdge = this.localSolver.solve(pose, targetPos, this.getPlannerContext(pose));
            if (localEdge) {
                this.recordLog('LOCAL_SOLVE', pose, `loop rescue -> ID${localEdge.toId}`);
                this.executeLocalManeuver(pose, localEdge);
                this.loopCooldown = LOOP_RECOVERY_COOLDOWN;
                this.stallTimer = 0;
                this.facingFlipCount = 0;
                this.loopWarned = false;
                return true;
            }

            window.dispatchEvent(new CustomEvent('parkour-bot:diagnostic', {
                detail: {
                    type: 'glitch_loop',
                    moveDx,
                    heightDiff,
                    stallTimer: this.stallTimer,
                    flipCount: this.facingFlipCount,
                    phase: this.approachPhase
                }
            }));
            this.invalidateActiveManeuver(pose, 'ping-pong', 5000);
            if (!this.activeManeuver && pose.groundedId !== null && this.targetPlatform) {
                this.graph.invalidateEdge(pose.groundedId, this.targetPlatform.id, 'ping-pong', 5000);
            }
            this.loopCooldown = LOOP_RECOVERY_COOLDOWN;
            this.stallTimer = 0;
            this.facingFlipCount = 0;
            this.loopWarned = false;
            this.reroute(pose, 'glitch-loop');
            this.targetSelectFreezeTimer = Math.max(this.targetSelectFreezeTimer, commitWindow);
            this.moveCommitDir = preferredCommitDir;
            this.moveCommitTimer = Math.max(this.moveCommitTimer, commitWindow);
            return true;
        }

        return false;
    }

    private pickNewTarget(pose: Pose) {
        const hasCommittedTarget =
            this.lockedTargetId !== null
            || this.targetPlatform !== null
            || this.targetX !== null
            || this.autoTargetY !== null;
        if (this.targetSelectFreezeTimer > 0 && hasCommittedTarget) {
            return;
        }
        if (this.manualMode) {
            // In manual mode, we only replan if the user clicked a platform (which sets lockedTargetId)
            if (this.lockedTargetId) {
                this.updateWaypoint(pose);
            }
            return;
        }

        const viewAABB: AABB = { x1: pose.x - VIEW_DIST, y1: 0, x2: pose.x + VIEW_DIST, y2: window.innerHeight };
        const candidates = this.world.query(viewAABB);

        // Filter to valid platforms (wide enough, not currently standing on)
        const valid = candidates.filter(c => {
            const w = c.aabb.x2 - c.aabb.x1;
            if (w < MIN_PLATFORM_SIZE) return false;
            // Don't target the platform we're standing on
            if (pose.grounded && (pose.groundedId === c.id || (pose.x + pose.width > c.aabb.x1 - 10 && pose.x < c.aabb.x2 + 10 && Math.abs(pose.y + pose.height - c.aabb.y1) < 20))) {
                return false;
            }

            // Headroom check: ensure there is enough space above the platform to stand
            const cx = (c.aabb.x1 + c.aabb.x2) / 2;
            const headroomProbe: AABB = {
                x1: cx - 10,
                y1: c.aabb.y1 - 42, // Bot is 40px high
                x2: cx + 10,
                y2: c.aabb.y1 - 2
            };
            const blockers = this.world.query(headroomProbe);
            for (const b of blockers) {
                if (b.id === c.id) continue;
                if (b.kind === 'rect' && b.flags.solid && !b.flags.oneWay) {
                    return false; // Trapped!
                }
            }

            // Burial check: ensure platform isn't completely contained within another solid block
            const burialProbe = { x1: c.aabb.x1 + 2, y1: c.aabb.y1 + 2, x2: c.aabb.x2 - 2, y2: c.aabb.y2 - 2 };
            if (this.world.query(burialProbe).some(b => b.id !== c.id && b.kind === 'rect' && b.flags.solid && !b.flags.oneWay && b.aabb.x1 <= c.aabb.x1 && b.aabb.x2 >= c.aabb.x2 && b.aabb.y1 <= c.aabb.y1 && b.aabb.y2 >= c.aabb.y2)) {
                return false; // Buried!
            }

            return true;
        });

        const pool = valid.length > 0
            ? valid
            : candidates.filter(c => {
                const w = c.aabb.x2 - c.aabb.x1;
                if (w < MIN_PLATFORM_SIZE) return false;
                if (pose.grounded && pose.groundedId === c.id) return false;
                return true;
            });
        if (pool.length === 0) {
            this.recordLog('NO_TARGETS', pose, `view=${candidates.length} valid=${valid.length}`);
            return;
        }

        if (this.isFirstTarget) {
            const botCx = pose.x + pose.width / 2;
            const botFeetY = pose.y + pose.height;
            let closest = pool[0];
            let minDist = Infinity;
            for (const c of pool) {
                const cx = (c.aabb.x1 + c.aabb.x2) / 2;
                const cy = c.aabb.y1;
                const dist = Math.hypot(cx - botCx, cy - botFeetY);
                if (dist < minDist) {
                    minDist = dist;
                    closest = c;
                }
            }
            this.lockedTargetId = closest.id;
            this.autoTargetY = null;
            this.isFirstTarget = false;
            this.recordLog('INIT_TARGET', pose, `closest ID${closest.id} dist=${Math.round(minDist)}`);
            this.updateWaypoint(pose);
            const target = this.targetPlatform || closest;
            this.setStationaryPlatformTarget(target, botCx, true);
            this.currentState = 'seek';
            this.breadcrumbStack = [];
            return;
        }

        const recentWindow = this.recentArrivals.slice(-10);
        const uniqueRecentCount = new Set(recentWindow).size;
        const repeatPressure = recentWindow.length >= 6
            && uniqueRecentCount <= Math.max(2, Math.floor(recentWindow.length * 0.45));
        const preferFar = repeatPressure || this.retryCount > 0 || Math.random() < 0.35;

        const blockedRecent = this.getRecentBlockedTargetIds(pose.groundedId);
        const recencyPool = blockedRecent.size > 0 ? pool.filter(c => !blockedRecent.has(c.id)) : pool;
        let scoringPool = recencyPool.length > 0 ? recencyPool : pool;
        if (recencyPool.length === 0 && blockedRecent.size > 0) {
            this.recordLog('RELAX_RECENCY', pose, 'no alternative targets, allowing recent/unreachable');
        }

        if (ENABLE_COORDINATE_TARGETS) {
            const coordPickChance = Math.min(
                0.72,
                COORD_TARGET_BASE_PROB
                + (repeatPressure ? COORD_TARGET_REPEAT_BONUS : 0)
                + (preferFar ? COORD_TARGET_FAR_BONUS : 0)
            );
            if (Math.random() < coordPickChance) {
                const coordPool = recencyPool.length > 0 ? recencyPool : pool;
                if (this.tryPickCoordinateTarget(pose, coordPool, preferFar)) {
                    return;
                }
            }
        }

        // --- GRAPH REACHABILITY FILTER ---
        const startId = this.getPlanningStartId(pose);
        if (startId !== null && this.graph.nodes.has(startId)) {
            const reachableNow = scoringPool.filter((c) =>
                this.findPathWithContext(startId, c.id, pose, false, 160) !== null
            );
            if (reachableNow.length > 0) {
                this.recordLog('GRAPH_FILTER', pose, `reachable-now=${reachableNow.length}/${scoringPool.length}`);
                scoringPool = reachableNow;
                this.strandedTimer = 0;
            } else {
                const reachableRelaxed = scoringPool.filter((c) =>
                    this.findPathWithContext(startId, c.id, pose, true, 180) !== null
                );
                if (reachableRelaxed.length > 0) {
                    this.recordLog('GRAPH_RELAX', pose, `reachable-relaxed=${reachableRelaxed.length}/${scoringPool.length}`);
                    scoringPool = reachableRelaxed;
                    this.strandedTimer = 0;
                } else {
                    this.recordLog('GRAPH_FAIL', pose, `no maneuver path from ID${startId}`);

                    // Attempt Local Solve
                    const localEdge = this.localSolver.solve(
                        pose,
                        this.targetPlatform ? { x: (this.targetPlatform.aabb.x1 + this.targetPlatform.aabb.x2) / 2, y: this.targetPlatform.aabb.y1 } : null,
                        this.getPlannerContext(pose)
                    );

                    if (localEdge) {
                        this.recordLog('LOCAL_SOLVE', pose, `synthesized escape ID${localEdge.toId} ${localEdge.action}`);
                        this.executeLocalManeuver(pose, localEdge);
                        return;
                    }

                    this.recordLog('ISLAND_CONDITION', pose, `ID${startId} has no exits (strict or relaxed). Immediate fallback.`);

                    this.triggerLoopHardFallback(pose, `island-ID${startId}`, 'island-trap');
                    return; // Abort target selection
                }
            }
        }
        this.recordLog(
            'TARGET_POOL',
            pose,
            `view=${candidates.length} valid=${valid.length} pool=${pool.length} blocked=${blockedRecent.size} scored=${scoringPool.length}`
        );

        // Compute average visits across all platforms for fairness equalizer
        let totalVisits = 0;
        let visitedCount = 0;
        for (const v of this.visitCounts.values()) {
            totalVisits += v;
            visitedCount++;
        }
        const avgVisits = visitedCount > 0 ? totalVisits / Math.max(visitedCount, scoringPool.length) : 0;

        // Score every candidate
        const scoreNow = performance.now();
        const scored = scoringPool.map(c => ({ collider: c, score: this.scoreTarget(pose, c, avgVisits, scoreNow) }));
        const scoredBeforeReachFilter = scored.length;

        // When airborne, filter to trajectory-reachable platforms if any exist
        if (!pose.grounded) {
            const reachable = scored.filter(s => {
                const cx = (s.collider.aabb.x1 + s.collider.aabb.x2) / 2;
                const prediction = this.predictTrajectory(pose, cx);
                return prediction.landingX >= s.collider.aabb.x1 - 20
                    && prediction.landingX <= s.collider.aabb.x2 + 20
                    && Math.abs(prediction.landingY - s.collider.aabb.y1) < 100;
            });
            if (reachable.length > 0) {
                scored.length = 0;
                scored.push(...reachable);
                this.recordLog('REACH_FILTER', pose, `airborne keep=${reachable.length}/${scoredBeforeReachFilter}`);
            } else {
                this.recordLog('REACH_FILTER_NONE', pose, `airborne keep=0/${scoredBeforeReachFilter} (fallback to score-only)`);
            }
        }

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        let weightedPool = scored;
        if (preferFar) {
            const botCx = pose.x + pose.width / 2;
            const botFeetY = pose.y + pose.height;
            const farScored = scored.filter(s => {
                const cx = (s.collider.aabb.x1 + s.collider.aabb.x2) / 2;
                const dist = Math.hypot(cx - botCx, s.collider.aabb.y1 - botFeetY);
                return dist >= FAR_TARGET_MIN_DIST;
            });
            if (farScored.length >= 2) {
                weightedPool = farScored;
                this.recordLog('FAR_BIAS', pose, `far=${farScored.length}/${scored.length}`);
            }
        }

        // Weighted random selection: top candidates get exponentially more chance
        // Softmax-style with temperature: P(i) ∝ e^(score_i / T)
        const T = preferFar ? 22 : 14;
        const top = weightedPool.slice(0, preferFar ? 12 : 8);
        if (top.length === 0) return;
        const maxScore = top[0].score;
        const weights = top.map(s => Math.exp((s.score - maxScore) / T));
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        let r = Math.random() * totalWeight;
        let picked = top[0];
        for (let i = 0; i < top.length; i++) {
            r -= weights[i];
            if (r <= 0) {
                picked = top[i];
                break;
            }
        }

        const finalTarget = picked.collider;
        this.lockedTargetId = finalTarget.id;
        this.autoTargetY = null;

        // Use the new centralized waypoint logic to find the first step in the path
        this.updateWaypoint(pose);
        const target = this.targetPlatform || finalTarget;

        // Record in history (longer window to reduce ping-ponging)
        this.platformHistory.push(finalTarget.id);
        if (this.platformHistory.length > 6) this.platformHistory.shift();

        // Reset breadcrumbs when picking a completely fresh new target choice
        this.breadcrumbStack = [];

        this.setStationaryPlatformTarget(target, pose.x + pose.width / 2, true);

        this.currentState = 'seek';
        this.bestProgressDist = Infinity;
        this.progressStagnationTimer = 0;
        this.fsmStagnationTimer = 0;
        this.approachPhase = 'direct';
        this.approachX = null;
        this.seekDiagTimer = 0;
        this.lastSeekPose = null;
        this.stallTimer = 0;
        this.facingFlipTimer = 0;
        this.facingFlipCount = 0;
        this.lastFacingSeen = 0;
        this.loopWarned = false;
        this.moveCommitDir = 0;
        this.moveCommitTimer = 0;
        this.dropEdgeX = null;
        this.dropGroundId = null;
        this.dropLockTimer = 0;
        this.navState = 'nav-align';
        this.takeoffZone = null;
        this.patienceTimer = 0;
        const topSummary = scored.slice(0, 3).map(s => this.describeCandidateForLog(pose, s)).join(' || ');
        const nearest = scoringPool.reduce((best, c) => {
            const cx = (c.aabb.x1 + c.aabb.x2) / 2;
            const cy = c.aabb.y1;
            const d = Math.hypot(cx - (pose.x + pose.width / 2), cy - (pose.y + pose.height));
            return d < best.dist ? { collider: c, dist: d } : best;
        }, { collider: scoringPool[0], dist: Number.POSITIVE_INFINITY });
        if (nearest.collider.id !== target.id) {
            const nearestScore = scored.find(s => s.collider.id === nearest.collider.id)?.score ?? 0;
            this.recordLog(
                'TARGET_SKIP_NEAR',
                pose,
                `near ID${nearest.collider.id} d=${Math.round(nearest.dist)} s=${Math.round(nearestScore)} vs pick ID${target.id} s=${Math.round(picked.score)}`
            );
        }
        this.recordLog('TARGET_DECIDE', pose, `pick ID${target.id} lock=${this.lockedTargetId} from ${scoringPool.length} | ${topSummary}`);
        this.recordLog('NEW_TARGET', pose, `ID${target.id} score:${Math.round(picked.score)}`);
    }

    private attemptBreadcrumbRecovery(pose: Pose, reason: string) {
        const lockedId = this.lockedTargetId;
        if (!lockedId || this.breadcrumbStack.length === 0) {
            this.reroute(pose, reason);
            return;
        }
        if (this.trackLoopIncident(pose, reason)) return;

        const strictContext = this.getPlannerContext(pose, false);
        while (this.breadcrumbStack.length > 0) {
            const candidateId = this.breadcrumbStack[this.breadcrumbStack.length - 1];
            if (this.world.colliders.has(candidateId) && this.graph.nodes.has(candidateId)) {
                const path = this.graph.findPathDetailed(candidateId, lockedId, { maxStates: 160, context: strictContext });
                if (path !== null) {
                    const c = this.world.colliders.get(candidateId)!;
                    this.recordLog('BREADCRUMB_POP', pose, `${reason}: rewinding to known-good node ID${candidateId}`);
                    this.applyBreadcrumbPopCost(pose, reason, candidateId);
                    this.setStationaryPlatformTarget(c, pose.x + pose.width / 2, true);
                    this.currentState = 'seek';
                    this.bestProgressDist = Infinity;
                    this.progressStagnationTimer = 0;
                    this.fsmStagnationTimer = 0;
                    this.approachPhase = 'direct';
                    this.approachX = null;
                    this.navState = 'nav-align';
                    this.takeoffZone = null;
                    this.patienceTimer = 0;
                    return;
                }
            }
            this.breadcrumbStack.pop();
        }

        // Relax constraints once before abandoning the lock.
        const startId = this.getPlanningStartId(pose);
        if (startId !== null && this.graph.nodes.has(startId)) {
            const relaxedPath = this.findPathWithContext(startId, lockedId, pose, true, 220);
            if (relaxedPath && relaxedPath.nodes.length > 1) {
                const waypoint = this.world.colliders.get(relaxedPath.nodes[1]);
                if (waypoint) {
                    this.recordLog('BREADCRUMB_RELAX', pose, `${reason}: relaxed path via ID${waypoint.id} -> lock ID${lockedId}`);
                    this.setStationaryPlatformTarget(waypoint, pose.x + pose.width / 2, true);
                    this.currentState = 'seek';
                    this.bestProgressDist = Infinity;
                    this.progressStagnationTimer = 0;
                    this.fsmStagnationTimer = 0;
                    this.approachPhase = 'direct';
                    this.approachX = null;
                    this.navState = 'nav-align';
                    this.takeoffZone = null;
                    this.patienceTimer = 0;
                    return;
                }
            }
        }

        // If no breadcrumb or relaxed path works, clear lock to avoid oscillation loops.
        this.recordLog('BREADCRUMB_EMPTY', pose, `${reason}: no feasible breadcrumb path; releasing lock`);
        this.clearTargetLock();
        this.targetPlatform = null;
        this.targetX = null;
        this.autoTargetY = null;
        this.currentState = 'idle';
        this.fsmStagnationTimer = 0;
        this.resetManeuverTracking();
    }

    private setSubTargetWaypoint(pose: Pose, waypoint: Collider, locked: Collider, reason: string, source: string) {
        this.setStationaryPlatformTarget(waypoint, pose.x + pose.width / 2, true);
        this.bestProgressDist = Infinity;
        this.progressStagnationTimer = 0;
        this.fsmStagnationTimer = 0;
        this.approachPhase = 'direct';
        this.approachX = null;
        this.moveCommitDir = 0;
        this.moveCommitTimer = 0;
        this.dropEdgeX = null;
        this.dropGroundId = null;
        this.dropLockTimer = 0;
        this.navState = 'nav-align';
        this.takeoffZone = null;
        this.patienceTimer = 0;
        this.noteWaypointSwitch(performance.now());
        this.syncActiveManeuver(pose);
        this.recordLog('SUBTARGET', pose, `${reason}: ${source} ID${waypoint.id} -> lock ID${locked.id}`);
    }

    private tryProgressSubTarget(pose: Pose, locked: Collider, reason: string): boolean {
        const botCx = pose.x + pose.width / 2;
        const botFeetY = pose.y + pose.height;
        const goalCx = (locked.aabb.x1 + locked.aabb.x2) / 2;
        const goalY = locked.aabb.y1;
        const directGoalDist = Math.hypot(goalCx - botCx, goalY - botFeetY);

        // 1) Prefer graph waypoint if available.
        const startId = this.getPlanningStartId(pose);
        if (startId !== null && this.graph.nodes.has(startId) && this.graph.nodes.has(locked.id)) {
            const route = this.findPathWithContext(startId, locked.id, pose, false, 220)
                ?? this.findPathWithContext(startId, locked.id, pose, true, 240);
            if (route && route.nodes.length > 1) {
                const waypointId = route.nodes[1];
                if (waypointId !== locked.id) {
                    const waypoint = this.world.colliders.get(waypointId);
                    if (waypoint) {
                        const wpCx = (waypoint.aabb.x1 + waypoint.aabb.x2) / 2;
                        const wpGoalDist = Math.hypot(goalCx - wpCx, goalY - waypoint.aabb.y1);
                        if (wpGoalDist + 8 < directGoalDist || route.totalCost < directGoalDist * 1.25) {
                            this.setSubTargetWaypoint(pose, waypoint, locked, reason, 'graph');
                            return true;
                        }
                    }
                }
            }
        }

        // 2) Local fallback: pick a nearby stepping-stone that makes measurable progress.
        const searchAABB: AABB = {
            x1: Math.min(botCx, goalCx) - 320,
            y1: Math.min(goalY, pose.y) - 140,
            x2: Math.max(botCx, goalCx) + 320,
            y2: Math.max(goalY, botFeetY) + 120
        };

        const nearby = this.world.query(searchAABB).filter(c => {
            if (c.kind !== 'rect' || !c.flags.solid) return false;
            if (c.id === locked.id) return false;
            if ((c.aabb.x2 - c.aabb.x1) < MIN_PLATFORM_SIZE) return false;
            if (pose.grounded && pose.groundedId === c.id) return false;
            return true;
        });

        let best: { collider: Collider; score: number } | null = null;
        for (const c of nearby) {
            if (!this.graph.nodes.has(c.id)) continue;
            const cx = (c.aabb.x1 + c.aabb.x2) / 2;
            const cy = c.aabb.y1;
            const candidateGoalDist = Math.hypot(goalCx - cx, goalY - cy);
            const progress = directGoalDist - candidateGoalDist;
            if (progress < 24) continue;

            if (startId !== null && this.graph.nodes.has(startId)) {
                const outgoing = this.graph.getBestEdge(startId, c.id, this.getPlannerContext(pose));
                if (!outgoing) continue;
            }

            const toGoal = this.graph.findPathDetailed(c.id, locked.id, {
                maxStates: 180,
                context: this.getPlannerContext(pose)
            });
            if (!toGoal) continue;

            const travelDist = Math.hypot(cx - botCx, cy - botFeetY);
            const overshootPenalty = cy < goalY - 50 ? 120 : 0;
            const altitudePotential = Math.max(0, botFeetY - cy);
            const score = toGoal.totalCost + travelDist * 0.55 + candidateGoalDist * 0.3 + overshootPenalty - altitudePotential * 0.18;

            if (!best || score < best.score) {
                best = { collider: c, score };
            }
        }

        if (!best) return false;
        this.setSubTargetWaypoint(pose, best.collider, locked, reason, 'local');
        return true;
    }

    private reroute(pose: Pose, reason: string = 'recovery') {
        if (this.trackLoopIncident(pose, reason)) return;
        const locked = this.getLockedTarget();
        const startId = this.getPlanningStartId(pose);

        if (locked && startId !== null && this.graph.nodes.has(startId)) {
            const directRoute = this.findPathWithContext(startId, locked.id, pose, false, 220)
                ?? this.findPathWithContext(startId, locked.id, pose, true, 240);
            if (directRoute && directRoute.nodes.length > 1) {
                const nextId = directRoute.nodes[1];
                const nextCollider = this.world.colliders.get(nextId);
                if (nextCollider) {
                    this.setSubTargetWaypoint(pose, nextCollider, locked, reason, 'graph-next');
                    return;
                }
            }
        }

        if (locked && this.tryProgressSubTarget(pose, locked, reason)) return;

        const tx = locked
            ? (locked.aabb.x1 + locked.aabb.x2) / 2
            : this.targetX;
        const ty = locked
            ? locked.aabb.y1
            : this.getTargetY();
        if (tx === null || ty === null) return;
        const searchAABB: AABB = { x1: Math.min(pose.x, tx) - 300, y1: Math.min(ty, pose.y) - 100, x2: Math.max(pose.x, tx) + 300, y2: Math.max(ty, pose.y) + 100 };
        const nearby = this.world.query(searchAABB).filter(c => {
            if (this.targetPlatform && c.id === this.targetPlatform.id && (!locked || c.id !== locked.id)) return false;
            return (c.aabb.x2 - c.aabb.x1) >= MIN_PLATFORM_SIZE && c.aabb.y1 < pose.y + pose.height && c.aabb.y1 > ty - 30;
        });
        const blockedRecent = this.getRecentBlockedTargetIds(pose.groundedId);
        const reroutePool = blockedRecent.size > 0
            ? nearby.filter(c => !blockedRecent.has(c.id))
            : nearby;
        const effectiveReroutePool = reroutePool.length > 0 ? reroutePool : nearby;

        let pick: Collider | null = null;
        if (effectiveReroutePool.length > 0) {
            const now = performance.now();
            const switchPenalty = this.getWaypointSwitchPenalty(now);
            let bestScore = Infinity;
            for (const c of effectiveReroutePool) {
                if (startId !== null && this.graph.nodes.has(startId)) {
                    const outgoing = this.graph.getBestEdge(startId, c.id, this.getPlannerContext(pose));
                    if (!outgoing) continue;
                }
                const cx = (c.aabb.x1 + c.aabb.x2) / 2;
                const cy = c.aabb.y1;
                const distFromBot = Math.hypot(cx - (pose.x + pose.width / 2), c.aabb.y1 - (pose.y + pose.height));
                const altitudePotential = Math.max(0, (pose.y + pose.height) - c.aabb.y1);
                const blockedPenalty = blockedRecent.has(c.id) ? 180 : 0;

                let costToLock = 0;
                if (locked) {
                    const toLock = this.findPathWithContext(c.id, locked.id, pose, false, 160)
                        ?? this.findPathWithContext(c.id, locked.id, pose, true, 200);
                    if (!toLock) continue;
                    costToLock = toLock.totalCost;
                } else {
                    costToLock = Math.abs(cy - ty) + Math.abs(cx - tx);
                }

                // Bias towards reducing distance to lock (costToLock) over just picking nearby nodes.
                const score = costToLock * 1.5 + distFromBot * 0.5 - altitudePotential * 0.22 + blockedPenalty + switchPenalty;
                if (score < bestScore) {
                    bestScore = score;
                    pick = c;
                }
            }
        }

        if (pick) {
            this.setStationaryPlatformTarget(pick, pose.x + pose.width / 2, true);
            this.bestProgressDist = Infinity;
            this.progressStagnationTimer = 0;
            this.fsmStagnationTimer = 0;
            this.approachPhase = 'direct';
            this.approachX = null;
            this.moveCommitDir = 0;
            this.moveCommitTimer = 0;
            this.dropEdgeX = null;
            this.dropGroundId = null;
            this.dropLockTimer = 0;
            this.noteWaypointSwitch(performance.now());
            this.syncActiveManeuver(pose);
            const relaxed = reroutePool.length === 0 && blockedRecent.size > 0;
            if (locked && pick.id !== locked.id) {
                this.recordLog('REROUTE', pose, relaxed
                    ? `${reason}: waypoint ID${pick.id} -> lock ID${locked.id} (relaxed recency)`
                    : `${reason}: waypoint ID${pick.id} -> lock ID${locked.id}`);
            } else {
                this.recordLog('REROUTE', pose, relaxed
                    ? `${reason}: waypoint ID${pick.id} (relaxed recency)`
                    : `${reason}: waypoint ID${pick.id}`);
            }
        } else {
            if (locked) {
                if (startId !== null && this.graph.nodes.has(startId)) {
                    const directEdge = this.graph.getBestEdge(startId, locked.id, this.getPlannerContext(pose))
                        ?? this.graph.getBestEdge(startId, locked.id, this.getPlannerContext(pose, true));
                    if (!directEdge) {
                        this.recordLog('REROUTE_UNLOCK', pose, `${reason}: lock ID${locked.id} unreachable, releasing`);
                        this.clearTargetLock();
                        this.targetPlatform = null;
                        this.targetX = null;
                        this.autoTargetY = null;
                        this.currentState = 'idle';
                        this.resetManeuverTracking();
                        return;
                    }
                    this.setActiveManeuver(directEdge, startId, pose);
                }
                this.setStationaryPlatformTarget(locked, pose.x + pose.width / 2, true);
                this.bestProgressDist = Infinity;
                this.progressStagnationTimer = 0;
                this.fsmStagnationTimer = 0;
                this.noteWaypointSwitch(performance.now());
                this.recordLog('REROUTE_LOCK', pose, `${reason}: direct lock ID${locked.id}`);
            } else {
                this.targetPlatform = null;
                this.targetX = null;
                this.autoTargetY = null;
                this.currentState = 'idle';
                this.navState = 'nav-align';
                this.takeoffZone = null;
                this.patienceTimer = 0;
                this.resetManeuverTracking();
                this.bestProgressDist = Infinity;
                this.progressStagnationTimer = 0;
                this.fsmStagnationTimer = 0;
                this.recordLog('REROUTE_BLIND', pose, `${reason}: no platform lock, reselection`);
                this.pickNewTarget(pose);
            }
            this.moveCommitDir = 0;
            this.moveCommitTimer = 0;
            this.dropEdgeX = null;
            this.dropGroundId = null;
            this.dropLockTimer = 0;
        }
    }

    /**
     * Find the best intermediate platform between the bot and a high target.
     * Returns a stepping-stone collider that is between the bot's Y and the target's Y,
     * within reachable hop distance.
     */
    private findWaypointBelow(pose: Pose, finalTarget: Collider): Collider | null {
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

        const candidates = this.world.query(searchAABB).filter(c => {
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

    private predictTrajectory(pose: Pose, txBounds: number | { minX: number, maxX: number }): { landingX: number; landingY: number } {
        let simX = pose.x + pose.width / 2;
        let simY = pose.y + pose.height / 2;
        let simVx = pose.vx;
        let simVy = pose.vy;
        const dt = 1 / 30;

        // Ignore colliders we are currently perfectly inside, to avoid simulating a crash instantly.
        const startAABB = { x1: pose.x, y1: pose.y, x2: pose.x + pose.width, y2: pose.y + pose.height };
        const isStartOverlap = (b: { x1: number, y1: number, x2: number, y2: number }) =>
            startAABB.x1 < b.x2 && startAABB.x2 > b.x1 && startAABB.y1 < b.y2 && startAABB.y2 > b.y1;

        for (let i = 0; i < 45; i++) {
            let distX = 0;
            if (typeof txBounds === 'number') {
                distX = txBounds - simX;
            } else {
                if (simX < txBounds.minX) distX = txBounds.minX - simX;
                else if (simX > txBounds.maxX) distX = txBounds.maxX - simX;
            }

            if (Math.abs(distX) > 10) {
                simVx += (distX > 0 ? 800 : -800) * dt;
                if (Math.abs(simVx) > 350) simVx = Math.sign(simVx) * 350;
            }
            simVy += 1500 * dt;
            simX += simVx * dt;
            simY += simVy * dt;

            const simAABB = { x1: simX - 10, y1: simY - 10, x2: simX + 10, y2: simY + 10 };
            const hit = this.world.query(simAABB).some(c => {
                if (c.kind !== 'rect' || !c.flags.solid) return false;
                if (isStartOverlap(c.aabb)) return false; // ignore initial enclosing container
                if (c.flags.oneWay && simVy < 0) return false; // moving up through one-way is safe
                return true; // We collided with something that should stop the simulation!
            });

            if (hit) break;
            if (simY > 1200) break;
        }
        return { landingX: simX, landingY: simY };
    }

    /**
     * Determines the optimal takeoff zone by scanning the current platform and testing Line of Sight.
     * Returns an interval [minX, maxX] on the current platform that provides a clear jump path.
     */
    /**
     * Logic to update the immediate waypoint for the current locked target.
     */
    private updateWaypoint(pose: Pose) {
        if (this.lockedTargetId === null) return;
        if (this.targetSelectFreezeTimer > 0) return;
        const now = performance.now();
        const locked = this.getLockedTarget();
        if (!locked) {
            this.clearTargetLock();
            return;
        }
        const startId = this.getPlanningStartId(pose);

        // Keep the current stepping stone briefly to avoid route thrash between near-equivalent paths.
        if (this.targetPlatform
            && this.targetPlatform.id !== this.lockedTargetId
            && this.waypointStickyUntil > now) {
            const sticky = this.world.colliders.get(this.targetPlatform.id);
            const sameOrigin = this.waypointOriginId === null || startId === null || startId === this.waypointOriginId;
            if (sticky && sameOrigin && this.graph.nodes.has(sticky.id)) {
                const stillConnects = this.findPathWithContext(sticky.id, this.lockedTargetId, pose, false, 160) !== null;
                const startConnects = startId === null || this.graph.getBestEdge(startId, sticky.id, this.getPlannerContext(pose)) !== null;
                if (stillConnects && startConnects) {
                    this.setStationaryPlatformTarget(sticky, pose.x + pose.width / 2);
                    return;
                }
            }
        }

        if (startId !== null && this.graph.nodes.has(startId)) {
            const route = this.findPathWithContext(startId, this.lockedTargetId, pose, false, 220);
            if (route && route.nodes.length > 1) {
                const wpId = route.nodes[1];
                const wpCollider = this.world.colliders.get(wpId);
                if (wpCollider) {
                    const isSwitching = this.targetPlatform?.id !== wpCollider.id;
                    const currentIsWaypoint = !!this.targetPlatform && this.targetPlatform.id !== this.lockedTargetId;
                    if (isSwitching && currentIsWaypoint && this.targetPlatform && this.graph.nodes.has(this.targetPlatform.id)) {
                        const holdActive = now - this.lastWaypointSwitchTime < WAYPOINT_SWITCH_HOLD_MS;
                        if (holdActive) {
                            const currentCost = this.estimatePathCost(this.targetPlatform.id, this.lockedTargetId, pose);
                            const proposedCost = this.estimatePathCost(wpCollider.id, this.lockedTargetId, pose);
                            const switchPenalty = this.getWaypointSwitchPenalty(now);
                            if (Number.isFinite(currentCost) && Number.isFinite(proposedCost)) {
                                const requiredGain = WAYPOINT_SWITCH_MARGIN + switchPenalty;
                                if (currentCost <= proposedCost + requiredGain) {
                                    this.setStationaryPlatformTarget(this.targetPlatform, pose.x + pose.width / 2);
                                    return;
                                }
                            }
                        }
                    }

                    if (isSwitching) {
                        this.setStationaryPlatformTarget(wpCollider, pose.x + pose.width / 2, true);
                        this.recordLog('PLAN_WAYPOINT', pose, `ID${startId} -> ID${wpId} -> Final ID${this.lockedTargetId}`);
                        this.bestProgressDist = Infinity;
                        this.progressStagnationTimer = 0;
                        this.fsmStagnationTimer = 0;
                        this.waypointStickyUntil = now + WAYPOINT_STICKY_MS;
                        this.waypointOriginId = startId;
                        this.noteWaypointSwitch(now);
                    } else {
                        this.setStationaryPlatformTarget(wpCollider, pose.x + pose.width / 2);
                    }

                    const firstEdge = route.edges.length > 0 ? route.edges[0] : null;
                    this.setActiveManeuver(firstEdge, firstEdge ? startId : null, pose);
                    return;
                }
            }

            // No route to lock under current cooldowns; try stepping-stone fallback before direct lock.
            if (this.tryProgressSubTarget(pose, locked, 'path-unreachable')) {
                return;
            }

            const directEdge = this.graph.getBestEdge(startId, locked.id, this.getPlannerContext(pose));
            if (!directEdge) {
                this.recordLog('PLAN_UNREACHABLE', pose, `ID${startId} -> ID${locked.id} no feasible maneuver`);
                return;
            }
            this.setActiveManeuver(directEdge, startId, pose);
        }

        // Direct fallback only when route edge is feasible or start node is unknown.
        if (this.targetPlatform?.id !== locked.id) {
            this.setStationaryPlatformTarget(locked, pose.x + pose.width / 2, true);
            this.bestProgressDist = Infinity;
            this.progressStagnationTimer = 0;
            this.fsmStagnationTimer = 0;
            this.noteWaypointSwitch(now);
        }
        this.waypointStickyUntil = 0;
        this.waypointOriginId = null;
    }

    private executeLocalManeuver(pose: Pose, edge: NavEdge) {
        if (pose.groundedId === null) return;

        // 1. Inject into graph so Planner can see it
        const node = this.graph.nodes.get(pose.groundedId);
        if (node) {
            const existingIdx = node.edges.findIndex((e) => e.maneuverId === edge.maneuverId);
            if (existingIdx >= 0) {
                node.edges[existingIdx] = edge;
            } else {
                node.edges.push(edge);
            }
        }

        // 2. Switch target
        const targetCollider = this.world.colliders.get(edge.toId);
        if (targetCollider) {
            this.setStationaryPlatformTarget(targetCollider, (edge.landingMinX + edge.landingMaxX) / 2, true);
            this.currentState = 'seek';
            this.navState = 'nav-align';

            // 3. Force the maneuver active immediately to prevent frame-perfect glitches
            this.setActiveManeuver(edge, pose.groundedId, pose);

            // 4. Reset stagnation timers so we don't abort immediately
            this.progressStagnationTimer = 0;
            this.fsmStagnationTimer = 0;

            window.dispatchEvent(new CustomEvent('parkour-bot:diagnostic', {
                detail: {
                    type: 'local_solve',
                    edge: edge.maneuverId
                }
            }));
        }
    }

    private calculateTakeoffZone(pose: Pose, currentFloor: Collider, targetFloor: Collider, heightDiff: number): { minX: number, maxX: number, facing: 1 | -1 } | null {
        // Find the safe playable bounds of the current platform
        const padding = 10;
        const myMinX = currentFloor.aabb.x1 + padding;
        const myMaxX = currentFloor.aabb.x2 - padding;

        if (myMinX > myMaxX) return null; // Platform too small

        // Determine landing zone safely on target
        const targetMinX = targetFloor.aabb.x1 + 10;
        const targetMaxX = targetFloor.aabb.x2 - 10;

        if (targetMinX > targetMaxX) return null;

        const targetCenterY = targetFloor.aabb.y1 - 10;

        // Determine required facing
        const dxToTarget = ((targetMinX + targetMaxX) / 2) - ((myMinX + myMaxX) / 2);
        const facing = dxToTarget >= 0 ? 1 : -1;

        // Sample points along the edge of the platform facing the target
        const step = 20;
        const startX = facing > 0 ? myMaxX : myMinX;
        const walkDir = -facing; // Walk backwards from edge

        const testPoints = [];
        for (let idx = 0; idx < 5; idx++) {
            const px = startX + walkDir * (idx * step);
            if (px < myMinX || px > myMaxX) break;
            testPoints.push(px);
        }

        // Test each point. First clear LOS wins as the "edge" of the zone.
        for (const px of testPoints) {
            // Target interval middle (or slightly favoring near edge)
            const targetLandingX = facing > 0 ? targetMinX + 15 : targetMaxX - 15;

            // Simple raycast to check if there's a hard block above or between
            // We use the world query to sample intermediate points
            const py = pose.y + pose.height; // Bot feet Y exactly on floor surface
            const hasClearLOS = this.world.hasLineOfSight(px, py - 40, targetLandingX, targetCenterY);

            // Also check immediate head clearance directly above the test point
            const ceilingProbe = { x1: px - 10, y1: py - 60, x2: px + 10, y2: py - 20 };
            const ceilingBlocked = this.world.query(ceilingProbe).some(c => c.flags.solid && !c.flags.oneWay);

            if (hasClearLOS && !ceilingBlocked) {
                // We found a valid edge point. The zone extends backwards ~30px for a "running start" tolerance.
                const zoneMin = facing > 0 ? px - 40 : px - 10;
                const zoneMax = facing > 0 ? px + 10 : px + 40;
                return {
                    minX: Math.max(myMinX, zoneMin),
                    maxX: Math.min(myMaxX, zoneMax),
                    facing
                };
            }
        }

        // No safe zone found (completely boxed in or blocked)
        return null;
    }
}
