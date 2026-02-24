import { Collider, AABB } from '@parkour-bot/shared';

const CELL_SIZE = 120;

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
