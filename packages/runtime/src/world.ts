
import { Collider, Config, AABB } from '@parkour-bot/shared';
import { DOMSampler } from './sampler';
import { computeWorldChecksum, type WorldChecksum } from './world-checksum';
import { Pose } from './controller';

const CELL_SIZE = 120;
const MAX_COLLIDERS = 2500;
const RESCAN_THROTTLE_MS = 500;

export class SpatialGrid {
    // Map key "x,y" -> Set of collider IDs
    cells: Map<string, number[]> = new Map();

    key(x: number, y: number) {
        return `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;
    }

    insert(collider: Collider) {
        const startX = Math.floor(collider.aabb.x1 / CELL_SIZE);
        const endX = Math.floor(collider.aabb.x2 / CELL_SIZE);
        const startY = Math.floor(collider.aabb.y1 / CELL_SIZE);
        const endY = Math.floor(collider.aabb.y2 / CELL_SIZE);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const k = `${x},${y}`;
                if (!this.cells.has(k)) {
                    this.cells.set(k, []);
                }
                this.cells.get(k)?.push(collider.id);
            }
        }
    }

    query(aabb: AABB, allColliders: Map<number, Collider>): Collider[] {
        const startX = Math.floor(aabb.x1 / CELL_SIZE);
        const endX = Math.floor(aabb.x2 / CELL_SIZE);
        const startY = Math.floor(aabb.y1 / CELL_SIZE);
        const endY = Math.floor(aabb.y2 / CELL_SIZE);

        const resultIds = new Set<number>();

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const k = `${x},${y}`;
                const cell = this.cells.get(k);
                if (cell) {
                    for (const id of cell) {
                        resultIds.add(id);
                    }
                }
            }
        }

        const results: Collider[] = [];
        for (const id of resultIds) {
            const c = allColliders.get(id);
            // Precise AABB check
            if (c && this.intersect(aabb, c.aabb)) {
                results.push(c);
            }
        }
        return results;
    }

    intersect(a: AABB, b: AABB) {
        return (
            a.x1 < b.x2 &&
            a.x2 > b.x1 &&
            a.y1 < b.y2 &&
            a.y2 > b.y1
        );
    }

    clear() {
        this.cells.clear();
    }
}

export class World {
    config: Partial<Config>;
    sampler: DOMSampler;
    colliders: Map<number, Collider> = new Map();
    grid: SpatialGrid = new SpatialGrid();
    revision: number = 0;
    checksum: WorldChecksum = { colliderCount: 0, solidCount: 0, oneWayCount: 0, keyHash: 0 };

    lastScrollY: number = 0;
    rescanTimeout: number | undefined;
    getPose: (() => Pose) | null = null;

    constructor(config: Partial<Config>) {
        this.config = config;
        this.sampler = new DOMSampler(config);
        this.lastScrollY = window.scrollY;
    }

    setPoseProvider(provider: () => Pose) {
        this.getPose = provider;
    }

    init() {
        this.fullRescan();
        this.setupObservers();
    }

    private updateChecksum() {
        this.checksum = computeWorldChecksum(this.colliders.values());
    }

    fullRescan(referencePoint?: { x: number; y: number }) {
        const list = this.sampler.scan();

        // Prioritize colliders near the bot/reference point to ensure navigation doesn't break
        // if the page is huge.
        const ref = referencePoint || (this.getPose ? this.getPose() : null);
        if (ref) {
            // Sort in place: closer elements first
            list.sort((a, b) => {
                const acx = (a.aabb.x1 + a.aabb.x2) / 2;
                const acy = a.aabb.y1; // Top edge matters most
                const bcx = (b.aabb.x1 + b.aabb.x2) / 2;
                const bcy = b.aabb.y1;

                const distA = Math.abs(acx - ref.x) + Math.abs(acy - ref.y);
                const distB = Math.abs(bcx - ref.x) + Math.abs(bcy - ref.y);
                return distA - distB;
            });
        }

        if (list.length > MAX_COLLIDERS) {
            console.warn(`ParkourBot: Collider limit reached (${list.length} > ${MAX_COLLIDERS}). Truncating.`);
            list.length = MAX_COLLIDERS;
        }

        // Preserve collider identity across rescans by reusing IDs for the same DOM element.
        // This keeps brain lock/target references stable while scrolling or during layout updates.
        const prevIdByElement = new Map<Element, number>();
        let maxPrevId = 0;
        for (const c of this.colliders.values()) {
            if (c.id > maxPrevId) maxPrevId = c.id;
            if (c.el) prevIdByElement.set(c.el, c.id);
        }

        const usedIds = new Set<number>();
        let nextFreshId = maxPrevId + 1;
        for (const c of list) {
            const existingId = c.el ? prevIdByElement.get(c.el) : undefined;
            if (existingId !== undefined && !usedIds.has(existingId)) {
                c.id = existingId;
                usedIds.add(existingId);
                continue;
            }

            while (usedIds.has(nextFreshId)) nextFreshId++;
            c.id = nextFreshId;
            usedIds.add(nextFreshId);
            nextFreshId++;
        }

        this.colliders.clear();
        this.grid.clear();

        for (const c of list) {
            this.colliders.set(c.id, c);
            this.grid.insert(c);
        }

        this.revision++;
        this.updateChecksum();

        console.log(`ParkourBot: World rebuilt with ${list.length} colliders.`);
    }

    throttledRescan() {
        if (this.rescanTimeout) return;
        this.rescanTimeout = window.setTimeout(() => {
            this.fullRescan();
            this.rescanTimeout = undefined;
        }, RESCAN_THROTTLE_MS);
    }

    setupObservers() {
        // Scroll handler for delta updates
        window.addEventListener('scroll', () => {
            const currentScroll = window.scrollY;
            const deltaY = currentScroll - this.lastScrollY;
            this.lastScrollY = currentScroll;

            if (Math.abs(deltaY) > 0) {
                this.shiftWorld(0, -deltaY);
            }
        });

        // Mutation Observer
        const observer = new MutationObserver(() => this.throttledRescan());
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'hidden']
        });

        // Resize Observer (on body to detect major layout shifts)
        const resize = new ResizeObserver(() => this.throttledRescan());
        resize.observe(document.body);
    }

    shiftWorld(dx: number, dy: number) {
        if (this.colliders.size === 0) return;

        // Update all collider positions
        // Ideally we should also optimize the grid update
        // For MVP: Rebuild grid on scroll (might be expensive but correct)
        this.grid.clear();

        for (const c of this.colliders.values()) {
            c.aabb.x1 += dx;
            c.aabb.x2 += dx;
            c.aabb.y1 += dy;
            c.aabb.y2 += dy;

            this.grid.insert(c);
        }
        this.revision++;
        // Translation-invariant checksum is unchanged under uniform world shifts.
    }

    getAll(): Collider[] {
        return Array.from(this.colliders.values());
    }

    /**
     * Performs a course-grained line-of-sight check between two points.
     * Returns true if there are no solid obstacles in the path.
     */
    hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return true;

        const steps = Math.ceil(dist / 12); // Check every ~12px for high precision
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const px = x1 + dx * t;
            const py = y1 + dy * t;

            // Small point query (14x14 box to catch thin elements safely)
            const colliding = this.query({
                x1: px - 7,
                y1: py - 7,
                x2: px + 7,
                y2: py + 7
            });

            // If we hit any solid rectangular obstacle (not one-way), LOS is broken
            for (const c of colliding) {
                if (c.kind === 'rect' && c.flags.solid && !c.flags.oneWay) {
                    return false;
                }
            }
        }
        return true;
    }

    query(aabb: AABB): Collider[] {
        return this.grid.query(aabb, this.colliders);
    }

    getRevision(): number {
        return this.revision;
    }

    getChecksum(): WorldChecksum {
        return { ...this.checksum };
    }
}
