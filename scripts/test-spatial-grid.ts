
import { SpatialGrid } from '@parkour-bot/runtime/world';
import { AABB } from '@parkour-bot/shared';

function check(condition: boolean, message: string) {
    if (!condition) {
        console.error(`FAILED: ${message}`);
        process.exit(1);
    }
}

const grid = new SpatialGrid();

console.log('Running SpatialGrid.intersect tests...');

// 1. Typical overlap
const a: AABB = { x1: 0, y1: 0, x2: 10, y2: 10 };
const b: AABB = { x1: 5, y1: 5, x2: 15, y2: 15 };
check(grid.intersect(a, b), 'Typical overlap should intersect');
check(grid.intersect(b, a), 'Typical overlap should intersect (symmetrical)');

// 2. A inside B
const c: AABB = { x1: 2, y1: 2, x2: 8, y2: 8 };
check(grid.intersect(a, c), 'Inner AABB should intersect');
check(grid.intersect(c, a), 'Inner AABB should intersect (symmetrical)');

// 3. Identical
check(grid.intersect(a, a), 'Identical AABBs should intersect');

// 4. Non-overlapping (separated)
const d: AABB = { x1: 20, y1: 20, x2: 30, y2: 30 };
check(!grid.intersect(a, d), 'Separated AABBs should not intersect');

// 5. Non-overlapping (to the left/right/above/below)
const left: AABB = { x1: -20, y1: 0, x2: -10, y2: 10 };
const right: AABB = { x1: 20, y1: 0, x2: 30, y2: 10 };
const above: AABB = { x1: 0, y1: -20, x2: 10, y2: -10 };
const below: AABB = { x1: 0, y1: 20, x2: 10, y2: 30 };

check(!grid.intersect(a, left), 'AABB to the left should not intersect');
check(!grid.intersect(a, right), 'AABB to the right should not intersect');
check(!grid.intersect(a, above), 'AABB above should not intersect');
check(!grid.intersect(a, below), 'AABB below should not intersect');

// 6. Edge cases: touching
const touchingRight: AABB = { x1: 10, y1: 0, x2: 20, y2: 10 };
const touchingLeft: AABB = { x1: -10, y1: 0, x2: 0, y2: 10 };
const touchingBottom: AABB = { x1: 0, y1: 10, x2: 10, y2: 20 };
const touchingTop: AABB = { x1: 0, y1: -10, x2: 10, y2: 0 };

check(!grid.intersect(a, touchingRight), 'AABBs touching at right edge should not intersect');
check(!grid.intersect(a, touchingLeft), 'AABBs touching at left edge should not intersect');
check(!grid.intersect(a, touchingBottom), 'AABBs touching at bottom edge should not intersect');
check(!grid.intersect(a, touchingTop), 'AABBs touching at top edge should not intersect');

// 7. Edge cases: corner touching
const touchingCorner: AABB = { x1: 10, y1: 10, x2: 20, y2: 20 };
check(!grid.intersect(a, touchingCorner), 'AABBs touching at corner should not intersect');

// 8. Zero size AABB (point)
const pointInside: AABB = { x1: 5, y1: 5, x2: 5, y2: 5 };
const pointOnEdge: AABB = { x1: 10, y1: 5, x2: 10, y2: 5 };
check(grid.intersect(a, pointInside), 'Point inside should intersect');
check(!grid.intersect(a, pointOnEdge), 'Point on edge should not intersect');

console.log('All SpatialGrid.intersect tests passed!');
