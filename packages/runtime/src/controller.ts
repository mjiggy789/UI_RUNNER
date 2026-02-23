
import { AABB, Collider } from '@parkour-bot/shared';
import { World } from './world';
import type { BrainDebugSnapshot } from './brain';

const GRAVITY = 1500;
const TERMINAL_VELOCITY = 1000;
const DAMPING = 0.8;
const MOVE_SPEED = 350;
const GROUND_RUN_ACCEL = 2300;
const GROUND_TURN_ACCEL = 3200;
const JUMP_FORCE = -600;
const MAX_TOTAL_JUMPS = 3;
const DOUBLE_JUMP_FORCE_MULT = 1.15;
const TRIPLE_JUMP_FORCE_MULT = 1.05;
const GAUGED_JUMP_MIN = 0.2;
const GAUGED_JUMP_MAX = 0.7;
const CROUCH_ACTIVATION_TIME = 0.09;
const CROUCH_LATCH_TIME = 0.22;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER_TIME = 0.12;
const CLIMB_SPEED = -300;
const CLIMB_STALL_TIMEOUT = 0.35;
const CLIMB_PROGRESS_MIN = 6;
const SLIDE_ENTRY_BOOST_SPEED = 550;
const CROUCH_WALK_SPEED = 150;
const CONTINUOUS_SLIDE_MIN_SPEED = 140;
const SLIDE_ACCEL = 2600;

export interface Pose {
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    grounded: boolean;
    groundedId: number | null;
    jumps: number;
    state: 'idle' | 'run' | 'jump' | 'fall' | 'wall-slide' | 'double-jump' | 'triple-jump' | 'slide' | 'climb';
    facing: 1 | -1;
    ceilingBonk?: boolean;
}

export interface ControlInput {
    left: boolean;
    right: boolean;
    jump: boolean;
    down: boolean;
    up: boolean;
    jumpGauge?: number | null;
}

export class Controller {
    pose: Pose;
    world: World;
    prevJumpInput: boolean = false;
    spawnX: number;
    spawnY: number;
    brainTargetX: number | null = null;
    brainTargetY: number | null = null;
    brainState: string = 'unknown';
    brainHitConfirmed: boolean = false;
    brainLastHitId: number | null = null;
    brainStrictMode: boolean = false;
    brainRetryCount: number = 0;
    brainManualMode: boolean = false;
    brainCurrentTargetId: number | null = null;
    brainLockedTargetId: number | null = null;
    brainLockedTargetX: number | null = null;
    brainLockedTargetY: number | null = null;
    brainDebugData: BrainDebugSnapshot | null = null;
    private crouchInputTimer: number = 0;
    private coyoteTimer: number = 0;
    private jumpBufferTimer: number = 0;
    private jumpBufferGauge: number | null = null;
    private climbStallTimer: number = 0;
    private lastClimbY: number | null = null;
    private crouchLatchTimer: number = 0;
    private slideMoveDir: 1 | -1 = 1;

    private clampJumpGauge(gauge: number | null | undefined): number | null {
        if (gauge === null || gauge === undefined || !Number.isFinite(gauge)) return null;
        return Math.max(GAUGED_JUMP_MIN, Math.min(GAUGED_JUMP_MAX, gauge));
    }

    private getAirJumpForce(nextJumpCount: number): number {
        if (nextJumpCount >= 3) return JUMP_FORCE * TRIPLE_JUMP_FORCE_MULT;
        return JUMP_FORCE * DOUBLE_JUMP_FORCE_MULT;
    }

    private doGroundJump(dropThrough: boolean, jumpGauge: number | null = null) {
        if (dropThrough) {
            // Drop down through one-way platform.
            this.pose.y += 10;
            this.pose.grounded = false;
            this.pose.state = 'fall';
            this.pose.vy = 50;
            return;
        }

        const gauge = this.clampJumpGauge(jumpGauge);
        this.pose.vy = gauge !== null ? JUMP_FORCE * gauge : JUMP_FORCE;
        this.pose.grounded = false;
        this.pose.state = 'jump';
        this.pose.jumps = 1;
    }

    constructor(world: World, startX: number, startY: number) {
        this.world = world;
        this.spawnX = startX;
        this.spawnY = startY;
        this.pose = {
            x: startX,
            y: startY,
            vx: 0,
            vy: 0,
            width: 20,
            height: 40,
            grounded: false,
            groundedId: null,
            jumps: 0,
            state: 'idle',
            facing: 1,
            ceilingBonk: false
        };
        this.slideMoveDir = this.pose.facing;
    }

    respawn() {
        this.pose.x = this.spawnX;
        this.pose.y = this.spawnY;
        this.pose.vx = 0;
        this.pose.vy = 0;
        this.pose.width = 20;
        this.pose.height = 40;
        this.pose.grounded = false;
        this.pose.groundedId = null;
        this.pose.jumps = 0;
        this.pose.state = 'idle';
        this.pose.facing = 1;
        this.pose.ceilingBonk = false;

        this.prevJumpInput = false;
        this.crouchInputTimer = 0;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.jumpBufferGauge = null;
        this.climbStallTimer = 0;
        this.lastClimbY = null;
        this.crouchLatchTimer = 0;
        this.slideMoveDir = this.pose.facing;
    }

    update(dt: number, input: ControlInput) {
        this.pose.ceilingBonk = false;
        // Substepping to prevent tunneling at low framerates
        const MAX_STEP = 1 / 60;
        let timeRemaining = dt;
        while (timeRemaining > 0) {
            const stepDt = Math.min(timeRemaining, MAX_STEP);
            this.singleStep(stepDt, input);
            timeRemaining -= stepDt;
        }
    }

    private isTouchingSolidWall(dir: 1 | -1): boolean {
        const wallCheck = {
            x1: this.pose.x + (dir > 0 ? this.pose.width : -5),
            y1: this.pose.y + 8,
            x2: this.pose.x + (dir > 0 ? this.pose.width + 5 : 0),
            y2: this.pose.y + this.pose.height - 8
        };
        return this.world.query(wallCheck).some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);
    }

    private hasSolid(aabb: AABB): boolean {
        return this.world.query(aabb).some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);
    }

    private singleStep(dt: number, input: ControlInput) {
        // 0. Crouch / Slide State Management
        const wasSliding = this.pose.state === 'slide';
        const NORMAL_HEIGHT = 40;
        const CROUCH_HEIGHT = 20;

        let targetHeight = NORMAL_HEIGHT;

        // Check if standing up is possible (only when crouched)
        const feetY = this.pose.y + this.pose.height; // Logic anchor is feet
        let canStandUp = true;
        if (this.pose.height < NORMAL_HEIGHT) {
            // Probe ONLY the gap the bot would grow into (above current head)
            const standUpCheck = {
                x1: this.pose.x + 2,
                y1: feetY - NORMAL_HEIGHT,       // Where head WOULD be at full height
                x2: this.pose.x + this.pose.width - 2,
                y2: this.pose.y                  // Current head position
            };
            canStandUp = !this.world.query(standUpCheck).some(c => c.kind === 'rect' && c.flags.solid && !c.flags.oneWay);
        }

        // Debounce crouch intent to avoid one-frame false positives from AI look-ahead probes.
        if (this.pose.grounded && input.down) this.crouchInputTimer += dt;
        else this.crouchInputTimer = 0;

        // Proactive crouch when full-height headroom ahead is blocked but crouched height is clear.
        let crouchForClearance = false;
        if (this.pose.grounded && (input.left || input.right) && !input.jump) {
            const dir = input.right ? 1 : -1;
            const lookAhead = [10, 18, 26];
            for (const offset of lookAhead) {
                const x1 = dir > 0 ? this.pose.x + this.pose.width + offset - 8 : this.pose.x - offset - 8;
                const x2 = x1 + 16;
                const fullHeadProbe = {
                    x1,
                    y1: feetY - NORMAL_HEIGHT + 2,
                    x2,
                    y2: feetY - CROUCH_HEIGHT - 2
                };
                const crouchBodyProbe = {
                    x1,
                    y1: feetY - CROUCH_HEIGHT + 2,
                    x2,
                    y2: feetY - 2
                };
                if (this.hasSolid(fullHeadProbe) && !this.hasSolid(crouchBodyProbe)) {
                    crouchForClearance = true;
                    break;
                }
            }
        }

        if (crouchForClearance) {
            this.crouchLatchTimer = CROUCH_LATCH_TIME;
        } else {
            this.crouchLatchTimer = Math.max(0, this.crouchLatchTimer - dt);
        }

        // Determine intent: grounded crouch/slide, airborne tuck, or forced crouch when stand-up is blocked.
        const wantsAirTuck = !this.pose.grounded && input.down;
        const wantCrouch =
            wantsAirTuck ||
            this.crouchInputTimer >= CROUCH_ACTIVATION_TIME ||
            this.crouchLatchTimer > 0 ||
            !canStandUp;

        if (wantCrouch) {
            targetHeight = CROUCH_HEIGHT;
        }

        // Apply Height Change (Squash downwards)
        if (this.pose.height !== targetHeight) {
            const diff = this.pose.height - targetHeight;
            this.pose.height = targetHeight;
            this.pose.y += diff; // Move top down/up to keep feet fixed
        }

        // 1. Apply gravity
        this.pose.vy += GRAVITY * dt;
        if (this.pose.vy > TERMINAL_VELOCITY) this.pose.vy = TERMINAL_VELOCITY;

        // 2. Horizontal movement
        const targetVx = input.left ? -MOVE_SPEED : input.right ? MOVE_SPEED : 0;

        if (this.pose.grounded) {
            // Snappy ground movement (modified by state)
            if (wantCrouch) {
                // Slide / Crouch walk: once sliding starts, keep momentum directional.
                this.pose.state = 'slide';
                const requestedDir = input.left ? -1 : input.right ? 1 : 0;

                if (!wasSliding) {
                    const entryDir: 1 | -1 =
                        requestedDir !== 0
                            ? requestedDir as 1 | -1
                            : this.pose.vx !== 0
                                ? (Math.sign(this.pose.vx) > 0 ? 1 : -1)
                                : this.pose.facing;
                    this.slideMoveDir = entryDir;
                }

                if (requestedDir !== 0) {
                    this.slideMoveDir = requestedDir as 1 | -1;
                }

                let moveDir = this.slideMoveDir;
                if (this.isTouchingSolidWall(moveDir)) {
                    const opposite = (moveDir === 1 ? -1 : 1) as 1 | -1;
                    // If blocked, allow explicit opposite input or auto-flip to avoid idle-in-slide.
                    if (requestedDir === opposite || requestedDir === 0 || requestedDir === moveDir) {
                        moveDir = requestedDir !== 0 ? requestedDir as 1 | -1 : opposite;
                        this.slideMoveDir = moveDir;
                    }
                }

                this.pose.facing = this.slideMoveDir;

                if (!wasSliding && Math.abs(this.pose.vx) > 300) {
                    this.pose.vx = this.slideMoveDir * SLIDE_ENTRY_BOOST_SPEED;
                }

                const desiredSpeed = Math.max(CROUCH_WALK_SPEED, CONTINUOUS_SLIDE_MIN_SPEED);
                const targetSlideVx = this.slideMoveDir * desiredSpeed;
                const delta = targetSlideVx - this.pose.vx;
                const step = SLIDE_ACCEL * dt;
                if (Math.abs(delta) <= step) {
                    this.pose.vx = targetSlideVx;
                } else {
                    this.pose.vx += Math.sign(delta) * step;
                }

                if (Math.abs(this.pose.vx) < CONTINUOUS_SLIDE_MIN_SPEED * 0.6) {
                    this.pose.vx = this.slideMoveDir * CONTINUOUS_SLIDE_MIN_SPEED;
                }
            } else {
                // Standard Run
                if (input.left || input.right) {
                    this.pose.facing = input.left ? -1 : 1;
                    this.slideMoveDir = this.pose.facing;
                    this.pose.state = 'run';
                    // Preserve momentum out of a slide
                    if (Math.abs(this.pose.vx) > MOVE_SPEED && Math.sign(this.pose.vx) === this.pose.facing) {
                        this.pose.vx *= Math.pow(0.95, dt * 60);
                        if (Math.abs(this.pose.vx) < MOVE_SPEED) {
                            this.pose.vx = this.pose.facing * MOVE_SPEED;
                        }
                    } else {
                        const delta = targetVx - this.pose.vx;
                        const turning = this.pose.vx !== 0 && Math.sign(this.pose.vx) !== Math.sign(targetVx);
                        const accel = turning ? GROUND_TURN_ACCEL : GROUND_RUN_ACCEL;
                        const step = accel * dt;
                        if (Math.abs(delta) <= step) {
                            this.pose.vx = targetVx;
                        } else {
                            this.pose.vx += Math.sign(delta) * step;
                        }
                    }
                } else {
                    this.pose.vx *= Math.pow(DAMPING, dt * 60);
                    if (Math.abs(this.pose.vx) < 10) this.pose.vx = 0;
                    this.pose.state = 'idle';
                }
            }
        } else {
            // Air control (less snappy)
            const airAccel = 800; // units per second squared
            if (input.left || input.right) {
                this.pose.facing = input.left ? -1 : 1;
                // Move towards target velocity
                if (this.pose.vx < targetVx) {
                    this.pose.vx += airAccel * dt;
                    if (this.pose.vx > targetVx) this.pose.vx = targetVx;
                } else if (this.pose.vx > targetVx) {
                    this.pose.vx -= airAccel * dt;
                    if (this.pose.vx < targetVx) this.pose.vx = targetVx;
                }
            } else {
                // Air drag
                this.pose.vx *= 0.95;
            }
        }

        // 3. Jump & Wall Jump & Double Jump
        const jumpPressed = input.jump && !this.prevJumpInput;
        if (jumpPressed) {
            this.jumpBufferTimer = JUMP_BUFFER_TIME;
            this.jumpBufferGauge = this.clampJumpGauge(input.jumpGauge ?? null);
        } else {
            this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
            if (this.jumpBufferTimer <= 0) this.jumpBufferGauge = null;
        }

        if (this.pose.grounded) this.coyoteTimer = COYOTE_TIME;
        else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

        // Reset jumps if grounded or wall sliding/climbing
        if (this.pose.grounded || this.pose.state === 'wall-slide' || this.pose.state === 'climb') {
            this.pose.jumps = 0;
        }

        let wallJumped = false;

        // Wall jump keeps strict edge-trigger behavior.
        if (jumpPressed && (this.pose.state === 'wall-slide' || this.pose.state === 'climb')) {
            const wallDir = this.pose.facing; // Facing is locked to wall during slide/climb
            const moveDir = input.left ? -1 : input.right ? 1 : 0;

            this.pose.vy = JUMP_FORCE;

            // If moving away from wall or no input, do a big kick-off.
            if (moveDir === -wallDir || moveDir === 0) {
                this.pose.vx = -wallDir * MOVE_SPEED * 1.5;
                this.pose.facing = -wallDir as 1 | -1;
            } else {
                // Climbing: moving towards the wall, do a vertical scale hop.
                this.pose.vx = wallDir * 50;
            }

            this.pose.state = 'jump';
            this.pose.jumps = 1;
            this.jumpBufferTimer = 0;
            this.jumpBufferGauge = null;
            this.coyoteTimer = 0;
            wallJumped = true;
        }

        // Buffered jump + coyote-time jump window for forgiving edge timing.
        const canGroundJump = this.pose.grounded || this.coyoteTimer > 0;
        if (this.jumpBufferTimer > 0 && canGroundJump && !wallJumped) {
            const canDropThrough = input.down && this.pose.grounded;
            this.doGroundJump(canDropThrough, this.jumpBufferGauge);
            this.jumpBufferTimer = 0;
            this.jumpBufferGauge = null;
            this.coyoteTimer = 0;
        } else if (jumpPressed && !wallJumped && this.pose.jumps < MAX_TOTAL_JUMPS) {
            const nextJumpCount = this.pose.jumps + 1;
            this.pose.vy = this.getAirJumpForce(nextJumpCount);
            this.pose.jumps = nextJumpCount;
            this.pose.state = nextJumpCount >= 3 ? 'triple-jump' : 'double-jump';
            this.jumpBufferTimer = 0;
            this.jumpBufferGauge = null;
        }
        this.prevJumpInput = input.jump;

        // 4. Integrate Position (X)
        this.pose.x += this.pose.vx * dt;
        this.solveCollisions(true, dt); // Resolve X

        // 5. Integrate Position (Y)
        this.pose.y += this.pose.vy * dt;
        this.pose.grounded = false; // Assume air until collision proves otherwise
        this.pose.groundedId = null;
        this.solveCollisions(false, dt); // Resolve Y

        // Landing jump-buffer: jump immediately on landing if queued.
        if (this.pose.grounded && this.jumpBufferTimer > 0) {
            this.doGroundJump(false, this.jumpBufferGauge);
            this.jumpBufferTimer = 0;
            this.jumpBufferGauge = null;
            this.coyoteTimer = 0;
        }

        const inputWallDir = input.left ? -1 : input.right ? 1 : 0;
        const touchingInputWall = inputWallDir !== 0 ? this.isTouchingSolidWall(inputWallDir as 1 | -1) : false;

        let justStallKicked = false;
        // If we are climbing, force an exit when input/wall contact is lost or we stall vertically.
        if (!this.pose.grounded && this.pose.state === 'climb') {
            const touchingFacingWall = this.isTouchingSolidWall(this.pose.facing);

            if (!input.up || !touchingFacingWall) {
                this.pose.state = this.pose.vy > 0 ? 'fall' : 'jump';
                this.climbStallTimer = 0;
                this.lastClimbY = null;
                justStallKicked = true; // explicitly block immediate re-entry into climb on frame 2
            } else {
                // Maintain a steady climb rate; avoids tiny, jittery vertical increments.
                this.pose.vy = CLIMB_SPEED;

                if (this.lastClimbY === null) this.lastClimbY = this.pose.y;
                const climbed = this.lastClimbY - this.pose.y;
                if (climbed > CLIMB_PROGRESS_MIN) {
                    this.lastClimbY = this.pose.y;
                    this.climbStallTimer = 0;
                } else {
                    this.climbStallTimer += dt;
                }

                if (this.climbStallTimer > CLIMB_STALL_TIMEOUT) {
                    const kickDir = (-this.pose.facing) as 1 | -1;
                    this.pose.vy = JUMP_FORCE * 0.9;
                    this.pose.vx = kickDir * MOVE_SPEED * 1.2;
                    this.pose.facing = kickDir;
                    this.pose.state = 'jump';
                    this.climbStallTimer = 0;
                    this.lastClimbY = null;
                    justStallKicked = true;
                }
            }
        } else {
            this.climbStallTimer = 0;
            this.lastClimbY = null;
        }

        // Wall Slide / Climb entry & active:
        if (!this.pose.grounded && this.pose.state !== 'climb' && touchingInputWall && !justStallKicked) {
            if (input.up) {
                this.pose.state = 'climb';
                this.pose.vy = CLIMB_SPEED;
                this.pose.facing = inputWallDir as 1 | -1;
            } else if (this.pose.vy > 0) {
                this.pose.state = 'wall-slide';
                this.pose.vy *= 0.8; // Friction
                if (this.pose.vy > 100) this.pose.vy = 100; // Cap slide speed
                this.pose.facing = inputWallDir as 1 | -1;
            }
        } else if (!this.pose.grounded && this.pose.state === 'wall-slide' && !touchingInputWall) {
            // Break out of wall slide if we stop holding towards the wall
            this.pose.state = this.pose.vy > 0 ? 'fall' : 'jump';
        }

        // State updates
        if (!this.pose.grounded) {
            if (this.pose.jumps === 0 && this.coyoteTimer <= 0 && this.pose.state !== 'wall-slide' && this.pose.state !== 'climb') {
                this.pose.jumps = 1;
            }
            if (this.pose.state === 'wall-slide' || this.pose.state === 'climb') {
                // keep state
            } else if ((this.pose.state === 'double-jump' || this.pose.state === 'triple-jump') && this.pose.vy <= 0) {
                // keep jump animation while moving up
            } else {
                this.pose.state = this.pose.vy > 0 ? 'fall' : 'jump';
            }
        }

        // Screen bounds (Reset)
        if (this.pose.y > window.innerHeight + 100) {
            this.pose.x = this.spawnX;
            this.pose.y = this.spawnY;
            this.pose.vx = 0;
            this.pose.vy = 0;
            this.pose.state = 'idle';
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;
            this.jumpBufferGauge = null;
            this.crouchLatchTimer = 0;
        }
    }

    private solveCollisions(resolveX: boolean, dt: number) {
        let aabb: AABB = {
            x1: this.pose.x,
            y1: this.pose.y,
            x2: this.pose.x + this.pose.width,
            y2: this.pose.y + this.pose.height
        };

        const candidates = this.world.query(aabb);

        for (const c of candidates) {
            // Re-calculate the overlap based on updated aabb
            if (
                aabb.x2 <= c.aabb.x1 ||
                aabb.x1 >= c.aabb.x2 ||
                aabb.y2 <= c.aabb.y1 ||
                aabb.y1 >= c.aabb.y2
            ) continue;

            const overlapX = Math.min(aabb.x2, c.aabb.x2) - Math.max(aabb.x1, c.aabb.x1);
            const overlapY = Math.min(aabb.y2, c.aabb.y2) - Math.max(aabb.y1, c.aabb.y1);

            if (resolveX) {
                // Resolve horizontal
                if (c.flags.oneWay) continue;

                if (overlapY > 0) {
                    const prevX2 = this.pose.x - this.pose.vx * dt + this.pose.width;
                    const prevX1 = this.pose.x - this.pose.vx * dt;

                    if (this.pose.vx > 0 && prevX2 <= c.aabb.x1 + 10) { // Hit from the left
                        this.pose.x -= overlapX;
                        this.pose.vx = 0;
                        aabb.x1 -= overlapX;
                        aabb.x2 -= overlapX;
                    } else if (this.pose.vx < 0 && prevX1 >= c.aabb.x2 - 10) { // Hit from the right
                        this.pose.x += overlapX;
                        this.pose.vx = 0;
                        aabb.x1 += overlapX;
                        aabb.x2 += overlapX;
                    } else if (overlapX < overlapY) {
                        // Fallback resolution for overlaps when not moving into the wall horizontally (e.g. expansion, spawn)
                        const centerX = this.pose.x + this.pose.width / 2;
                        const colliderCenterX = (c.aabb.x1 + c.aabb.x2) / 2;
                        if (centerX < colliderCenterX) {
                            this.pose.x -= overlapX;
                            if (this.pose.vx > 0) this.pose.vx = 0;
                            aabb.x1 -= overlapX;
                            aabb.x2 -= overlapX;
                        } else {
                            this.pose.x += overlapX;
                            if (this.pose.vx < 0) this.pose.vx = 0;
                            aabb.x1 += overlapX;
                            aabb.x2 += overlapX;
                        }
                    }
                }
            } else {
                // Resolve vertical
                const prevY2 = this.pose.y - this.pose.vy * dt + this.pose.height;
                const prevY1 = this.pose.y - this.pose.vy * dt;

                if (c.flags.oneWay) {
                    const isFalling = this.pose.vy > 0;
                    const isAbove = prevY2 <= c.aabb.y1 + 5; // tolerance
                    if (!isFalling || !isAbove) continue;
                }

                if (overlapX > 0) {
                    if (this.pose.vy > 0 && prevY2 <= c.aabb.y1 + 15) { // Hit top from above
                        this.pose.y -= overlapY;
                        this.pose.grounded = true;
                        this.pose.groundedId = c.id;
                        this.pose.vy = 0;
                        aabb.y1 -= overlapY;
                        aabb.y2 -= overlapY;
                    } else if (this.pose.vy < 0 && !c.flags.oneWay && prevY1 >= c.aabb.y2 - 15) { // Hit ceiling from below
                        this.pose.y += overlapY;
                        this.pose.vy = 0;
                        this.pose.ceilingBonk = true;
                        aabb.y1 += overlapY;
                        aabb.y2 += overlapY;
                    } else if (overlapY <= overlapX && !c.flags.oneWay) {
                        // Fallback vertical resolution
                        const centerY = this.pose.y + this.pose.height / 2;
                        const colliderCenterY = (c.aabb.y1 + c.aabb.y2) / 2;
                        if (centerY < colliderCenterY) {
                            this.pose.y -= overlapY;
                            this.pose.grounded = true;
                            this.pose.groundedId = c.id;
                            if (this.pose.vy > 0) this.pose.vy = 0;
                            aabb.y1 -= overlapY;
                            aabb.y2 -= overlapY;
                        } else {
                            this.pose.y += overlapY;
                            if (this.pose.vy < 0) {
                                this.pose.vy = 0;
                                this.pose.ceilingBonk = true;
                            }
                            aabb.y1 += overlapY;
                            aabb.y2 += overlapY;
                        }
                    }
                }
            }
        }
    }

    private intersect(a: AABB, b: AABB) {
        return (
            a.x1 < b.x2 &&
            a.x2 > b.x1 &&
            a.y1 < b.y2 &&
            a.y2 > b.y1
        );
    }
}
