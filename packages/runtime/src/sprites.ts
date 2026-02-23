
import { Pose } from './controller';

export type Theme = 'neon' | 'pixel' | 'minimal';

export class SpriteRenderer {
    theme: Theme = 'neon';
    frameCount: number = 0;

    constructor(theme: Theme = 'neon') {
        this.theme = theme;
    }

    draw(ctx: CanvasRenderingContext2D, pose: Pose, brainState: string = 'unknown', manualMode: boolean = false) {
        this.frameCount++;

        switch (this.theme) {
            case 'pixel':
                this.drawPixelBot(ctx, pose);
                break;
            case 'minimal':
                this.drawMinimalBot(ctx, pose);
                break;
            case 'neon':
            default:
                this.drawNeonBot(ctx, pose, brainState, manualMode);
                break;
        }
    }

    private drawNeonBot(
        ctx: CanvasRenderingContext2D,
        pose: Pose,
        brainState: string,
        manualMode: boolean
    ) {
        const { x, y, width, height, facing, state } = pose;

        ctx.save();

        // State color contract:
        // - idle: light blue
        // - seek: green
        // - crouch/slide (including airborne tuck): red override
        const isCrouchLike = state === 'slide' || height < 40;
        let color = brainState === 'seek' ? '#22c55e' : '#7dd3fc';
        if (isCrouchLike) color = '#ff2244';

        ctx.shadowBlur = 15;
        ctx.shadowColor = color;

        ctx.fillStyle = color;

        // Draw body with skew for running/sliding
        let skew = 0;
        if (state === 'run') skew = facing * -0.2;
        if (state === 'slide') skew = facing * -0.5; // Extreme skew

        ctx.transform(1, 0, skew, 1, x + (skew > 0 ? 0 : width * 0.2), y);

        // Main body rect
        ctx.fillRect(0, 0, width, height);

        // Eyes/Visor
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';

        const eyeY = height * 0.25;
        const eyeW = width * 0.6;
        const eyeH = height * 0.15;

        if (facing === 1) {
            ctx.fillRect(width - eyeW + 2, eyeY, eyeW, eyeH);
        } else {
            ctx.fillRect(-2, eyeY, eyeW, eyeH);
        }

        ctx.restore();
    }

    private drawPixelBot(ctx: CanvasRenderingContext2D, pose: Pose) {
        // Simplified pixel art simulation
        const { x, y, width, height, facing } = pose;
        const pixelSize = 4;

        ctx.fillStyle = '#33cc33';

        // Snap to grid
        const sx = Math.floor(x / pixelSize) * pixelSize;
        const sy = Math.floor(y / pixelSize) * pixelSize;
        const w = Math.floor(width / pixelSize) * pixelSize;
        const h = Math.floor(height / pixelSize) * pixelSize;

        ctx.fillRect(sx, sy, w, h);

        // Eyes
        ctx.fillStyle = '#000';
        if (facing === 1) {
            ctx.fillRect(sx + w - pixelSize * 2, sy + pixelSize * 2, pixelSize, pixelSize);
        } else {
            ctx.fillRect(sx + pixelSize, sy + pixelSize * 2, pixelSize, pixelSize);
        }
    }

    private drawMinimalBot(ctx: CanvasRenderingContext2D, pose: Pose) {
        const { x, y, width, height } = pose;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
    }
}
