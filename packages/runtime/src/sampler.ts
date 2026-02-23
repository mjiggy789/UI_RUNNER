
import { Collider, ColliderKind, ColliderFlags, ColliderMeta, Config } from '@parkour-bot/shared';

const DEFAULT_COLLIDERS = [
    'header', 'nav', 'footer', 'aside',
    '.card', '.panel', '.box',
    'button', 'a',
    '[data-bot-solid]',
    '[data-bot-oneway]'
];

const DEFAULT_DENY = [
    'input', 'select', 'textarea',
    'iframe', 'video', 'audio',
    '[aria-hidden="true"]',
    '.cookie-banner', '.modal', '.popup', '.toast',
    '[data-bot-ignore]', '[data-bot-ignore] *'
];

const MIN_WIDTH = 8;
const MIN_HEIGHT = 4;
const MIN_BUTTON_WIDTH = 8;
const MIN_BUTTON_HEIGHT = 4;
const TEXT_SURFACE_SELECTOR = 'div, p, section, article, li';
const MAX_TEXT_CANDIDATE_CHECKS = 800;
const MIN_TEXT_LENGTH = 10;
const MIN_TEXT_SURFACE_WIDTH = 80;
const MIN_TEXT_SURFACE_HEIGHT = 16;
const MAX_TEXT_SURFACE_AREA_RATIO = 0.4;
const MAX_TEXT_CONTAINER_CHILDREN = 12;
const MAX_TEXT_CONTAINER_AREA_RATIO = 0.15;

// Heuristic tuning constants for one-way vs fully solid behavior.
const LARGE_WRAPPER_AREA_RATIO = 0.6;
const INLINE_LIKE_TAGS = new Set([
    'a', 'button', 'label', 'span', 'strong', 'em', 'b', 'i',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'small'
]);
const STRUCTURAL_ONEWAY_TAGS = new Set(['header', 'nav', 'footer', 'main']);
const SOLID_WALL_MIN_WIDTH = 24;
const SOLID_WALL_MIN_HEIGHT = 120;
const SOLID_WALL_ASPECT = 1.8;
const SOLID_SLAB_MIN_WIDTH = 220;
const SOLID_SLAB_MIN_HEIGHT = 88;
const SOLID_SLAB_ASPECT = 1.6;
const SOLID_BLOCK_MIN_SIZE = 64;
const SOLID_BLOCK_MAX_ASPECT = 2.2;
const SOLID_BLOCK_MAX_AREA_RATIO = 0.22;
const WIDE_SURFACE_ONEWAY_TAGS = new Set(['section', 'article', 'main', 'aside', 'div']);
const WIDE_SURFACE_ONEWAY_MIN_WIDTH_RATIO = 0.78;
const WIDE_SURFACE_ONEWAY_MIN_HEIGHT = 70;
const WIDE_SURFACE_ONEWAY_MIN_ASPECT = 2.2;
const WIDE_SURFACE_ONEWAY_MIN_AREA_RATIO = 0.07;

export class DOMSampler {
    config: Partial<Config>;
    colliderSelector: string;
    denySelector: string;

    constructor(config: Partial<Config>) {
        this.config = config;

        // Merge defaults with config
        const configColliders = config.colliders || [];
        const configDeny = config.deny || [];

        this.colliderSelector = [...DEFAULT_COLLIDERS, ...configColliders].join(',');
        this.denySelector = [...DEFAULT_DENY, ...configDeny].join(',');
    }

    private isButtonLike(el: Element): boolean {
        const tag = el.tagName.toLowerCase();
        if (tag === 'button') return true;
        if (tag === 'a' && !!el.getAttribute('href')) return true;

        const role = el.getAttribute('role')?.toLowerCase();
        if (role === 'button') return true;

        const cls = (el.getAttribute('class') || '').toLowerCase();
        if (cls.includes('btn') || cls.includes('button')) return true;

        return false;
    }

    private isTextSurfaceCandidate(el: Element): boolean {
        if (!(el instanceof HTMLElement)) return false;
        if (el.matches(this.denySelector)) return false;
        if (this.isButtonLike(el)) return false;

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) {
            return false;
        }
        if (style.display === 'inline' || style.display === 'contents') return false;
        if (style.pointerEvents === 'none') return false;

        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length < MIN_TEXT_LENGTH) return false;

        const rect = el.getBoundingClientRect();
        if (rect.width < MIN_TEXT_SURFACE_WIDTH || rect.height < MIN_TEXT_SURFACE_HEIGHT) return false;

        const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
        const area = rect.width * rect.height;
        if (area > viewportArea * MAX_TEXT_SURFACE_AREA_RATIO) return false;

        if (el.children.length > MAX_TEXT_CONTAINER_CHILDREN && area > viewportArea * MAX_TEXT_CONTAINER_AREA_RATIO) {
            return false;
        }

        return true;
    }

    scan(): Collider[] {
        const colliders: Collider[] = [];
        let idCounter = 1;
        const seen = new Set<Element>();

        // 1. Initial candidate selection
        const allCandidates: Collider[] = [];
        const selection = document.querySelectorAll(this.colliderSelector);

        selection.forEach((el) => {
            if (el.matches(this.denySelector)) return;
            seen.add(el);
            const collider = this.extractCollider(el, idCounter++);
            if (collider) allCandidates.push(collider);
        });

        // 1b. Text-bearing surfaces (content blocks) so the bot can traverse text divs.
        const textSelection = document.querySelectorAll(TEXT_SURFACE_SELECTOR);
        let checkedText = 0;
        for (let i = 0; i < textSelection.length && checkedText < MAX_TEXT_CANDIDATE_CHECKS; i++) {
            const el = textSelection[i];
            checkedText++;

            if (seen.has(el)) continue;
            if (!this.isTextSurfaceCandidate(el)) continue;

            seen.add(el);
            const collider = this.extractCollider(el, idCounter++);
            if (collider) allCandidates.push(collider);
        }

        // 2. Visual Occlusion Filter: Remove colliders that are completely inside another
        const filtered = allCandidates.filter(target => {
            if (target.el && this.isButtonLike(target.el)) {
                // Preserve button-like affordances even when nested inside cards.
                return true;
            }

            const isContained = allCandidates.some(other => {
                if (target === other) return false;
                return target.aabb.x1 >= other.aabb.x1 &&
                    target.aabb.x2 <= other.aabb.x2 &&
                    target.aabb.y1 >= other.aabb.y1 &&
                    target.aabb.y2 <= other.aabb.y2;
            });
            return !isContained;
        });

        return filtered;
    }

    private backgroundIsOpaque(color: string): boolean {
        if (!color || color === 'transparent') return false;

        const rgba = color.match(/^rgba\(([^)]+)\)$/i);
        if (rgba) {
            const parts = rgba[1].split(',').map(p => p.trim());
            const alpha = Number.parseFloat(parts[3] ?? '1');
            return Number.isFinite(alpha) && alpha > 0.2;
        }

        const hsla = color.match(/^hsla\(([^)]+)\)$/i);
        if (hsla) {
            const parts = hsla[1].split(',').map(p => p.trim());
            const alpha = Number.parseFloat(parts[3] ?? '1');
            return Number.isFinite(alpha) && alpha > 0.2;
        }

        // rgb()/hex()/named colors are treated as visible fill.
        return true;
    }

    /**
     * Decides whether an element should behave as one-way (platform-like)
     * or fully solid (wall/block-like). Explicit data attributes win.
     */
    private inferOneWay(el: Element, rect: DOMRect, style: CSSStyleDeclaration): boolean {
        if (el.hasAttribute('data-bot-solid')) return false;
        if (el.hasAttribute('data-bot-oneway')) return true;

        const tag = el.tagName.toLowerCase();
        const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
        const area = rect.width * rect.height;
        const aspect = rect.width / Math.max(rect.height, 1);

        // Keep page-sized wrappers pass-through so the bot does not get trapped.
        if (area > viewportArea * LARGE_WRAPPER_AREA_RATIO) return true;

        if (INLINE_LIKE_TAGS.has(tag) || STRUCTURAL_ONEWAY_TAGS.has(tag)) return true;

        // Very wide content bands are usually floor-like lanes, not hard walls.
        const wideSurface =
            WIDE_SURFACE_ONEWAY_TAGS.has(tag) &&
            rect.width >= window.innerWidth * WIDE_SURFACE_ONEWAY_MIN_WIDTH_RATIO &&
            rect.height >= WIDE_SURFACE_ONEWAY_MIN_HEIGHT &&
            (rect.width / Math.max(rect.height, 1)) >= WIDE_SURFACE_ONEWAY_MIN_ASPECT &&
            area >= viewportArea * WIDE_SURFACE_ONEWAY_MIN_AREA_RATIO;
        if (wideSurface) return true;

        const verticalWall =
            rect.width >= SOLID_WALL_MIN_WIDTH &&
            rect.height >= SOLID_WALL_MIN_HEIGHT &&
            (rect.height / Math.max(rect.width, 1)) >= SOLID_WALL_ASPECT;

        const thickHorizontalSlab =
            rect.width >= SOLID_SLAB_MIN_WIDTH &&
            rect.height >= SOLID_SLAB_MIN_HEIGHT &&
            (rect.width / Math.max(rect.height, 1)) >= SOLID_SLAB_ASPECT;

        const chunkyBlock =
            aspect >= (1 / SOLID_BLOCK_MAX_ASPECT) &&
            aspect <= SOLID_BLOCK_MAX_ASPECT &&
            Math.min(rect.width, rect.height) >= SOLID_BLOCK_MIN_SIZE &&
            area <= viewportArea * SOLID_BLOCK_MAX_AREA_RATIO;

        const borderWidth =
            Number.parseFloat(style.borderTopWidth || '0') +
            Number.parseFloat(style.borderRightWidth || '0') +
            Number.parseFloat(style.borderBottomWidth || '0') +
            Number.parseFloat(style.borderLeftWidth || '0');

        const hasVisibleFill = this.backgroundIsOpaque(style.backgroundColor);
        const isStickyBar =
            (style.position === 'fixed' || style.position === 'sticky') &&
            rect.width >= window.innerWidth * 0.85 &&
            rect.height < 140;

        let solidScore = 0;
        if (verticalWall) solidScore += 2;
        if (thickHorizontalSlab) solidScore += 2;
        if (chunkyBlock) solidScore += 2;
        if (borderWidth >= 4) solidScore += 1;
        if (hasVisibleFill) solidScore += 1;
        if (isStickyBar) solidScore -= 2;

        return solidScore < 2;
    }

    private extractCollider(el: Element, id: number): Collider | null {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isButtonLike = this.isButtonLike(el);
        const minWidth = isButtonLike ? MIN_BUTTON_WIDTH : MIN_WIDTH;
        const minHeight = isButtonLike ? MIN_BUTTON_HEIGHT : MIN_HEIGHT;

        // 2. Size thresholds
        if (rect.width < minWidth || rect.height < minHeight) return null;

        // 3. Visibility check
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) {
            return null;
        }

        // 4. Region check (viewport culling)
        // Check if completely off-screen (though getBoundingClientRect is relative to viewport)
        if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
            // If using 'viewport' region, filtering here is good.
            // If 'full' region, we might want to keep it? 
            // Design doc says "Filter invisible/out-of-region elements".
            // Let's assume viewport region for now or slightly larger.
            const MARGIN = 1000;
            if (
                rect.bottom < -MARGIN ||
                rect.top > window.innerHeight + MARGIN ||
                rect.right < -MARGIN ||
                rect.left > window.innerWidth + MARGIN
            ) {
                return null;
            }
        }

        // 5. Viewport-space AABB (simulation runs in viewport-space CSS pixels)
        let viewportAABB = {
            x1: rect.left,
            y1: rect.top,
            x2: rect.right,
            y2: rect.bottom
        };

        // 6. Clip by overflow:hidden ancestors
        viewportAABB = this.clipByAncestors(el, viewportAABB);

        // After clipping, re-check size thresholds
        const clippedW = viewportAABB.x2 - viewportAABB.x1;
        const clippedH = viewportAABB.y2 - viewportAABB.y1;
        if (clippedW < minWidth || clippedH < minHeight) return null;

        // Check for rounded corners
        const radius = parseFloat(style.borderRadius);

        const oneWay = this.inferOneWay(el, rect, style);

        // Flags
        const flags: ColliderFlags = {
            solid: true,
            oneWay,
            climbable: true
        };

        const meta: ColliderMeta = {
            radius: isNaN(radius) ? 0 : radius,
            z: (() => {
                const parsed = style.zIndex !== 'auto' ? Number.parseInt(style.zIndex, 10) : Number.NaN;
                return Number.isFinite(parsed) ? parsed : undefined;
            })()
        };

        return {
            id,
            el,
            aabb: viewportAABB,
            kind: 'rect',
            flags,
            meta
        };
    }

    /**
     * Walk ancestors to find overflow-clipping containers and intersect
     * the collider AABB with each clipping bounds. This ensures colliders
     * hidden behind scroll containers or overflow:hidden panels are trimmed
     * to only their visible portion.
     */
    private clipByAncestors(
        el: Element,
        aabb: { x1: number; y1: number; x2: number; y2: number }
    ): { x1: number; y1: number; x2: number; y2: number } {
        let clipped = { ...aabb };
        let ancestor = el.parentElement;

        // Walk up max 20 levels to avoid perf hit on deeply nested DOMs
        let depth = 0;
        while (ancestor && ancestor !== document.documentElement && depth < 20) {
            const ancestorStyle = window.getComputedStyle(ancestor);
            const overflowX = ancestorStyle.overflowX;
            const overflowY = ancestorStyle.overflowY;

            const isClippingX = overflowX === 'hidden' || overflowX === 'clip' || overflowX === 'scroll' || overflowX === 'auto';
            const isClippingY = overflowY === 'hidden' || overflowY === 'clip' || overflowY === 'scroll' || overflowY === 'auto';

            if (isClippingX || isClippingY) {
                const ancestorRect = ancestor.getBoundingClientRect();

                if (isClippingX) {
                    clipped.x1 = Math.max(clipped.x1, ancestorRect.left);
                    clipped.x2 = Math.min(clipped.x2, ancestorRect.right);
                }
                if (isClippingY) {
                    clipped.y1 = Math.max(clipped.y1, ancestorRect.top);
                    clipped.y2 = Math.min(clipped.y2, ancestorRect.bottom);
                }

                // Early exit if fully clipped away
                if (clipped.x1 >= clipped.x2 || clipped.y1 >= clipped.y2) {
                    return { x1: 0, y1: 0, x2: 0, y2: 0 };
                }
            }

            ancestor = ancestor.parentElement;
            depth++;
        }

        return clipped;
    }
}
