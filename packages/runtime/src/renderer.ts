import { Controller } from './controller';
import { Collider } from '@parkour-bot/shared';
import { SpriteRenderer } from './sprites';
import type { BrainDebugAABB } from './brain';

export interface DebugVisualizationSettings {
    master: boolean;
    colliders: boolean;
    colliderIds: boolean;
    stateLabel: boolean;
    targeting: boolean;
    trajectory: boolean;
    route: boolean;
    steering: boolean;
    probes: boolean;
    ticTac: boolean;
    inputVector: boolean;
    hud: boolean;
    timers: boolean;
}

export const DEFAULT_DEBUG_VISUALIZATION_SETTINGS: DebugVisualizationSettings = {
    master: true,
    colliders: true,
    colliderIds: true,
    stateLabel: true,
    targeting: true,
    trajectory: true,
    route: true,
    steering: true,
    probes: true,
    ticTac: true,
    inputVector: true,
    hud: false,
    timers: true
};

export class Renderer {
    ctx: CanvasRenderingContext2D | null = null;
    canvas: HTMLCanvasElement;
    spriteRenderer: SpriteRenderer;

    constructor(canvas: HTMLCanvasElement, theme: any = 'neon') {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.spriteRenderer = new SpriteRenderer(theme);
    }

    private drawProbe(
        ctx: CanvasRenderingContext2D,
        aabb: BrainDebugAABB | null,
        stroke: string,
        fill: string,
        label: string,
        dashed: boolean = false
    ) {
        if (!aabb) return;
        ctx.save();
        if (dashed) ctx.setLineDash([4, 3]);
        ctx.strokeStyle = stroke;
        ctx.fillStyle = fill;
        ctx.lineWidth = 1.3;
        const w = aabb.x2 - aabb.x1;
        const h = aabb.y2 - aabb.y1;
        ctx.fillRect(aabb.x1, aabb.y1, w, h);
        ctx.strokeRect(aabb.x1, aabb.y1, w, h);
        ctx.setLineDash([]);
        ctx.font = '11px monospace';
        ctx.fillStyle = stroke;
        ctx.fillText(label, aabb.x1 + 2, aabb.y1 - 2);
        ctx.restore();
    }

    private fmtNumber(value: number | null, digits: number = 0): string {
        if (value === null || !Number.isFinite(value)) return '-';
        return value.toFixed(digits);
    }

    draw(
        controller: Controller,
        colliders: Collider[],
        debug: boolean = false,
        visualizations: Partial<DebugVisualizationSettings> = DEFAULT_DEBUG_VISUALIZATION_SETTINGS
    ) {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const viz: DebugVisualizationSettings = {
            ...DEFAULT_DEBUG_VISUALIZATION_SETTINGS,
            ...visualizations
        };

        const { pose } = controller;
        const brainTargetX = controller.brainTargetX;
        const brainTargetY = controller.brainTargetY;
        const brainState = controller.brainState || 'unknown';
        const behaviorState = pose.state || 'idle';
        const brainCurrentTargetId = controller.brainCurrentTargetId;
        const brainLockedTargetId = controller.brainLockedTargetId;
        const brainLockedTargetX = controller.brainLockedTargetX;
        const brainLockedTargetY = controller.brainLockedTargetY;
        const brainDebug = controller.brainDebugData;
        const hasSubTarget =
            brainCurrentTargetId !== null &&
            brainLockedTargetId !== null &&
            brainCurrentTargetId !== brainLockedTargetId &&
            brainLockedTargetX !== null &&
            brainLockedTargetY !== null;
        const debugEnabled = debug && viz.master;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.scale(dpr, dpr);

        if (debugEnabled && (viz.colliders || viz.colliderIds)) {
            ctx.lineWidth = 2;
            ctx.font = '10px monospace';
            for (const c of colliders) {
                const w = c.aabb.x2 - c.aabb.x1;
                const h = c.aabb.y2 - c.aabb.y1;
                if (viz.colliders) {
                    ctx.strokeStyle = c.flags.oneWay ? 'rgba(255, 255, 0, 0.5)' : 'rgba(0, 255, 0, 0.5)';
                    ctx.strokeRect(c.aabb.x1, c.aabb.y1, w, h);
                }
                if (viz.colliderIds) {
                    ctx.fillStyle = '#00ff66';
                    ctx.fillText(`ID:${c.id}`, c.aabb.x1 + 2, c.aabb.y1 + 12);
                }
            }
        }

        this.spriteRenderer.draw(ctx, pose, brainState, controller.brainManualMode);

        if (debugEnabled) {
            const botCenterX = pose.x + pose.width / 2;
            const botCenterY = pose.y + pose.height / 2;

            if (viz.stateLabel) {
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;
                ctx.font = 'bold 14px sans-serif';
                const stateText = `State: ${brainState.toUpperCase()}`;
                const textX = botCenterX - ctx.measureText(stateText).width / 2;
                const textY = pose.y - 10;
                ctx.strokeText(stateText, textX, textY);
                ctx.fillText(stateText, textX, textY);
            }

            if (
                brainTargetX !== null
                && brainTargetX !== undefined
                && brainTargetY !== null
                && brainTargetY !== undefined
            ) {
                const tx = brainTargetX;
                const ty = brainTargetY;
                const targetColor = hasSubTarget ? '#f59e0b' : '#ff0055';

                if (viz.targeting) {
                    ctx.strokeStyle = hasSubTarget ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 0, 85, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(botCenterX, botCenterY);
                    ctx.lineTo(tx, ty);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                if (viz.trajectory) {
                    let simX = botCenterX;
                    let simY = botCenterY;
                    let simVx = pose.vx;
                    let simVy = pose.vy;
                    const gravity = 1500;
                    const airAccel = 800;
                    const dt = 1 / 60;
                    const targetAbove = (pose.y + pose.height) - ty;

                    if (pose.grounded && targetAbove > 40) {
                        simVy = -600;
                        if (Math.abs(simVx) < 100) simVx = tx > simX ? 250 : -250;
                    }

                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(simX, simY);
                    for (let i = 0; i < 90; i++) {
                        const distX = tx - simX;
                        if (Math.abs(distX) > 10) {
                            simVx += (distX > 0 ? airAccel : -airAccel) * dt;
                            if (Math.abs(simVx) > 350) simVx = Math.sign(simVx) * 350;
                        }
                        simVy += gravity * dt;
                        simX += simVx * dt;
                        simY += simVy * dt;
                        ctx.lineTo(simX, simY);
                        if (simY > 1200) break;
                    }
                    ctx.stroke();

                    if (!pose.grounded && pose.jumps < 3 && targetAbove > 50) {
                        let ghostX = botCenterX;
                        let ghostY = botCenterY;
                        let ghostVx = pose.vx;
                        const ghostForceMult = pose.jumps >= 2 ? 1.05 : 1.15;
                        let ghostVy = -600 * ghostForceMult;

                        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
                        ctx.setLineDash([2, 5]);
                        ctx.beginPath();
                        ctx.moveTo(ghostX, ghostY);
                        for (let i = 0; i < 60; i++) {
                            const distX = tx - ghostX;
                            if (Math.abs(distX) > 10) ghostVx += (distX > 0 ? airAccel : -airAccel) * dt;
                            if (Math.abs(ghostVx) > 350) ghostVx = Math.sign(ghostVx) * 350;
                            ghostVy += gravity * dt;
                            ghostX += ghostVx * dt;
                            ghostY += ghostVy * dt;
                            ctx.lineTo(ghostX, ghostY);
                            if (ghostY > 1200) break;
                        }
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                }

                if (viz.targeting || viz.route) {
                    const size = 10;
                    ctx.strokeStyle = targetColor;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(tx - size, ty - size);
                    ctx.lineTo(tx + size, ty + size);
                    ctx.moveTo(tx + size, ty - size);
                    ctx.lineTo(tx - size, ty + size);
                    ctx.stroke();

                    const currentLabel = hasSubTarget
                        ? `STEP ID:${brainCurrentTargetId}`
                        : (brainCurrentTargetId !== null ? `TARGET ID:${brainCurrentTargetId}` : 'TARGET COORD');
                    ctx.fillStyle = targetColor;
                    ctx.font = 'bold 12px monospace';
                    ctx.fillText(currentLabel, tx - 40, ty - 14);
                }

                if (viz.route && hasSubTarget && brainLockedTargetX !== null && brainLockedTargetY !== null && brainLockedTargetId !== null) {
                    const ftx = brainLockedTargetX;
                    const fty = brainLockedTargetY;
                    ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(tx, ty);
                    ctx.lineTo(ftx, fty);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    const finalSize = 12;
                    ctx.strokeStyle = '#22c55e';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(ftx - finalSize / 2, fty - finalSize / 2, finalSize, finalSize);
                    ctx.fillStyle = '#22c55e';
                    ctx.font = 'bold 12px monospace';
                    ctx.fillText(`FINAL ID:${brainLockedTargetId}`, ftx - 46, fty - 14);
                }
            }

            if (viz.steering && brainDebug) {
                const steerBaseY = pose.y + pose.height + 22;
                const navTargetX = brainDebug.navTargetX;
                if (navTargetX !== null) {
                    ctx.strokeStyle = 'rgba(248, 250, 252, 0.5)';
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.moveTo(navTargetX, steerBaseY - 16);
                    ctx.lineTo(navTargetX, steerBaseY + 8);
                    ctx.stroke();
                    ctx.fillStyle = '#e2e8f0';
                    ctx.font = '11px monospace';
                    ctx.fillText('navX', navTargetX - 14, steerBaseY - 20);
                }

                if (navTargetX !== null && brainDebug.deadzone !== null) {
                    ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(navTargetX - brainDebug.deadzone, steerBaseY);
                    ctx.lineTo(navTargetX + brainDebug.deadzone, steerBaseY);
                    ctx.stroke();
                    ctx.fillStyle = '#7dd3fc';
                    ctx.fillText(`dead:${this.fmtNumber(brainDebug.deadzone, 0)}`, navTargetX - 34, steerBaseY + 14);
                }

                if (navTargetX !== null && brainDebug.stickyBand !== null) {
                    ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([3, 2]);
                    ctx.beginPath();
                    ctx.moveTo(navTargetX - brainDebug.stickyBand, steerBaseY + 6);
                    ctx.lineTo(navTargetX + brainDebug.stickyBand, steerBaseY + 6);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#facc15';
                    ctx.fillText(`stick:${this.fmtNumber(brainDebug.stickyBand, 0)}`, navTargetX - 36, steerBaseY + 22);
                }

                if (brainDebug.moveDir !== 0) {
                    const arrowLen = 22 * brainDebug.moveDir;
                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(botCenterX, steerBaseY + 24);
                    ctx.lineTo(botCenterX + arrowLen, steerBaseY + 24);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(botCenterX + arrowLen, steerBaseY + 24);
                    ctx.lineTo(botCenterX + arrowLen - (6 * brainDebug.moveDir), steerBaseY + 20);
                    ctx.moveTo(botCenterX + arrowLen, steerBaseY + 24);
                    ctx.lineTo(botCenterX + arrowLen - (6 * brainDebug.moveDir), steerBaseY + 28);
                    ctx.stroke();
                }
            }

            if (viz.probes && brainDebug) {
                this.drawProbe(
                    ctx,
                    brainDebug.wallProbeLeft,
                    brainDebug.wallProbeLeftHit ? '#22c55e' : '#60a5fa',
                    brainDebug.wallProbeLeftHit ? 'rgba(34, 197, 94, 0.14)' : 'rgba(96, 165, 250, 0.1)',
                    'wall-L'
                );
                this.drawProbe(
                    ctx,
                    brainDebug.wallProbeRight,
                    brainDebug.wallProbeRightHit ? '#22c55e' : '#60a5fa',
                    brainDebug.wallProbeRightHit ? 'rgba(34, 197, 94, 0.14)' : 'rgba(96, 165, 250, 0.1)',
                    'wall-R'
                );
                this.drawProbe(
                    ctx,
                    brainDebug.overheadProbe,
                    brainDebug.overheadBlocked ? '#ef4444' : '#22c55e',
                    brainDebug.overheadBlocked ? 'rgba(239, 68, 68, 0.16)' : 'rgba(34, 197, 94, 0.14)',
                    'overhead'
                );
                this.drawProbe(
                    ctx,
                    brainDebug.ceilingHeadProbe,
                    brainDebug.ceilingBlocked ? '#ef4444' : '#22c55e',
                    brainDebug.ceilingBlocked ? 'rgba(239, 68, 68, 0.16)' : 'rgba(34, 197, 94, 0.14)',
                    'ceiling'
                );
                this.drawProbe(
                    ctx,
                    brainDebug.ceilingEscapeWallProbeLeft,
                    brainDebug.ceilingEscapeWallLeft ? '#f97316' : '#64748b',
                    brainDebug.ceilingEscapeWallLeft ? 'rgba(249, 115, 22, 0.12)' : 'rgba(100, 116, 139, 0.08)',
                    'escape-L'
                );
                this.drawProbe(
                    ctx,
                    brainDebug.ceilingEscapeWallProbeRight,
                    brainDebug.ceilingEscapeWallRight ? '#f97316' : '#64748b',
                    brainDebug.ceilingEscapeWallRight ? 'rgba(249, 115, 22, 0.12)' : 'rgba(100, 116, 139, 0.08)',
                    'escape-R'
                );
                this.drawProbe(
                    ctx,
                    brainDebug.airTuckProbe,
                    brainDebug.airTuckWanted ? '#fb7185' : '#64748b',
                    brainDebug.airTuckWanted ? 'rgba(251, 113, 133, 0.16)' : 'rgba(100, 116, 139, 0.08)',
                    'air-tuck',
                    true
                );
                this.drawProbe(
                    ctx,
                    brainDebug.gapProbe,
                    brainDebug.gapProbeHasGround === false ? '#ef4444' : '#22c55e',
                    brainDebug.gapProbeHasGround === false ? 'rgba(239, 68, 68, 0.18)' : 'rgba(34, 197, 94, 0.12)',
                    'gap',
                    true
                );

                if (brainDebug.dropPlannedEdgeX !== null) {
                    const dropX = brainDebug.dropPlannedEdgeX;
                    ctx.strokeStyle = '#a855f7';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([6, 4]);
                    ctx.beginPath();
                    ctx.moveTo(dropX, pose.y - 48);
                    ctx.lineTo(dropX, pose.y + pose.height + 80);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#d8b4fe';
                    ctx.font = '11px monospace';
                    const dir = brainDebug.dropDirection === 0 ? '0' : (brainDebug.dropDirection > 0 ? 'R' : 'L');
                    ctx.fillText(`drop:${dir}`, dropX + 4, pose.y - 52);
                }
            }

            if (viz.ticTac && brainDebug) {
                const tictacY = pose.y - 32;
                if (brainDebug.ticTacCorridorLeft !== null && brainDebug.ticTacCorridorRight !== null) {
                    const leftX = botCenterX - brainDebug.ticTacCorridorLeft;
                    const rightX = botCenterX + brainDebug.ticTacCorridorRight;
                    ctx.strokeStyle = brainDebug.ticTacEligible ? '#f59e0b' : 'rgba(148, 163, 184, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(leftX, tictacY);
                    ctx.lineTo(rightX, tictacY);
                    ctx.stroke();
                    ctx.fillStyle = '#f59e0b';
                    ctx.font = 'bold 11px monospace';
                    const widthText = `corridor:${this.fmtNumber(brainDebug.ticTacCorridorWidth, 0)}`;
                    ctx.fillText(widthText, botCenterX - ctx.measureText(widthText).width / 2, tictacY - 4);
                }

                if (brainDebug.ticTacActive || brainDebug.ticTacEligible) {
                    const tagColor = brainDebug.ticTacActive ? '#22c55e' : '#facc15';
                    ctx.fillStyle = tagColor;
                    ctx.font = 'bold 12px monospace';
                    const state = brainDebug.ticTacActive ? 'tic-tac active' : 'tic-tac ready';
                    ctx.fillText(state, botCenterX - 34, pose.y - 46);

                    if (brainDebug.ticTacDir !== 0) {
                        const dirLen = 24 * brainDebug.ticTacDir;
                        ctx.strokeStyle = tagColor;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(botCenterX, pose.y - 54);
                        ctx.lineTo(botCenterX + dirLen, pose.y - 54);
                        ctx.stroke();
                    }
                }
            }

            if (viz.inputVector) {
                const lookAhead = pose.facing * 50;
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(botCenterX, botCenterY);
                ctx.lineTo(botCenterX + lookAhead, pose.y + pose.height + 20);
                ctx.stroke();
            }
        }

        if (viz.hud) {
            const hudX = 20;
            const lineH = 18;
            const lines: { text: string; color: string; bold?: boolean }[] = [];

            lines.push({ text: `State: ${brainState.toUpperCase()}`, color: '#94a3b8' });
            lines.push({ text: `Behavior: ${behaviorState.toUpperCase()}`, color: '#7dd3fc' });
            lines.push({ text: `Settings: [S]  Debug: [D]`, color: '#64748b' });

            if (hasSubTarget && viz.route) {
                lines.push({ text: `Route: STEP -> FINAL`, color: '#fbbf24', bold: true });
                lines.push({ text: `  ${brainCurrentTargetId} -> ${brainLockedTargetId}`, color: '#86efac' });
            }

            if (brainDebug) {
                lines.push({
                    text: `Calc: dx=${this.fmtNumber(brainDebug.targetDx, 0)} h=${this.fmtNumber(brainDebug.heightDiff, 0)} moveDx=${this.fmtNumber(brainDebug.moveDx, 0)}`,
                    color: '#cbd5e1'
                });
                lines.push({
                    text: `Steer: dir=${brainDebug.moveDir} dead=${this.fmtNumber(brainDebug.deadzone, 0)} stick=${this.fmtNumber(brainDebug.stickyBand, 0)}`,
                    color: '#cbd5e1'
                });
                lines.push({
                    text: `Wall: dir=${brainDebug.wallDir} L=${brainDebug.wallProbeLeftHit ? 'hit' : '-'} R=${brainDebug.wallProbeRightHit ? 'hit' : '-'}`,
                    color: '#cbd5e1'
                });
                lines.push({
                    text: `TicTac: elig=${brainDebug.ticTacEligible ? 'y' : 'n'} active=${brainDebug.ticTacActive ? 'y' : 'n'} dir=${brainDebug.ticTacDir}`,
                    color: '#cbd5e1'
                });
                lines.push({
                    text: `Ceiling: overhead=${brainDebug.overheadBlocked ? 'block' : 'clear'} head=${brainDebug.ceilingBlocked ? 'block' : 'clear'}`,
                    color: '#cbd5e1'
                });
                lines.push({
                    text: `AirTuck: ${brainDebug.airTuckWanted ? 'on' : 'off'}`,
                    color: brainDebug.airTuckWanted ? '#fda4af' : '#cbd5e1'
                });
                lines.push({
                    text: `Gap/Drop: ground=${brainDebug.gapProbeHasGround === null ? '-' : (brainDebug.gapProbeHasGround ? 'yes' : 'no')} drop=${this.fmtNumber(brainDebug.dropPlannedEdgeX, 0)}`,
                    color: '#cbd5e1'
                });
                lines.push({
                    text: `Maneuver: ${brainDebug.maneuverFromId ?? '-'}->${brainDebug.maneuverToId ?? '-'} takeoff=${this.fmtNumber(brainDebug.maneuverDistToTakeoff, 0)} los=${brainDebug.maneuverLOS ? 'yes' : 'no'} gain=${this.fmtNumber(brainDebug.maneuverVerticalGain, 0)} stall=${brainDebug.maneuverStagnation.toFixed(2)}`,
                    color: '#cbd5e1'
                });

                if (viz.timers) {
                    lines.push({
                        text: `Timers: stagn=${brainDebug.timers.progressStagnation.toFixed(2)} jumpCD=${brainDebug.timers.jumpCooldown.toFixed(2)} wallCD=${brainDebug.timers.wallDecision.toFixed(2)}`,
                        color: '#fcd34d'
                    });
                    lines.push({
                        text: `Timers: wallSlide=${brainDebug.timers.wallSlide.toFixed(2)} ceilSup=${brainDebug.timers.ceilingSuppress.toFixed(2)} retry=${brainDebug.timers.retryCount}`,
                        color: '#fcd34d'
                    });
                }
            }

            if (controller.brainHitConfirmed) {
                const hitId = controller.brainLastHitId;
                const hitLabel = hitId !== null ? `ID:${hitId}` : 'COORD';
                lines.push({ text: `Hit confirmed: ${hitLabel}`, color: '#00ffaa', bold: true });
            }

            if (controller.brainStrictMode) {
                lines.push({ text: `Strict Mode ON`, color: '#f59e0b', bold: true });
                const retries = controller.brainRetryCount || 0;
                if (retries > 0) lines.push({ text: `Attempt #${retries + 1}`, color: '#94a3b8' });
            }

            ctx.font = '13px monospace';
            const maxTextW = lines.reduce((maxW, line) => Math.max(maxW, ctx.measureText(line.text).width), 0);
            const panelW = Math.max(220, maxTextW + 24);
            const panelH = lines.length * lineH + 18;
            const panelY = (this.canvas.height / dpr) - panelH - 20;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const maybeRoundRect = ctx as CanvasRenderingContext2D & {
                roundRect?: (x: number, y: number, w: number, h: number, radii: number) => void;
            };
            if (typeof maybeRoundRect.roundRect === 'function') {
                maybeRoundRect.roundRect(hudX - 10, panelY, panelW, panelH, 8);
            } else {
                ctx.rect(hudX - 10, panelY, panelW, panelH);
            }
            ctx.fill();
            ctx.stroke();

            let currentLineY = panelY + 20;
            for (const line of lines) {
                ctx.font = `${line.bold ? 'bold ' : ''}13px monospace`;
                ctx.fillStyle = line.color;
                ctx.fillText(line.text, hudX, currentLineY);
                currentLineY += lineH;
            }
        }

        ctx.restore();
    }
}
