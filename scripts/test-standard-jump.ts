
import { World } from '../packages/runtime/src/world';
import { NavGraph } from '../packages/runtime/src/planner';
import { Collider } from '@parkour-bot/shared';

(global as any).window = { innerWidth: 1000, innerHeight: 800, addEventListener: () => {}, setTimeout: () => {} };
(global as any).document = { body: {} };
(global as any).MutationObserver = class { observe() {} };
(global as any).ResizeObserver = class { observe() {} };

const world = new World({});

// A simple jump scenario
// Plat A: x=0..100, y=500
const platA: Collider = {
    id: 1,
    kind: 'rect',
    flags: { solid: true, oneWay: false, climbable: true },
    aabb: { x1: 0, y1: 500, x2: 100, y2: 520 },
    meta: { }
};

// Plat B: x=200..300, y=500 (Gap 100)
const platB: Collider = {
    id: 2,
    kind: 'rect',
    flags: { solid: true, oneWay: false, climbable: true },
    aabb: { x1: 200, y1: 500, x2: 300, y2: 520 },
    meta: { }
};

world.colliders.set(1, platA);
world.grid.insert(platA);
world.colliders.set(2, platB);
world.grid.insert(platB);

const graph = new NavGraph(world);
graph.update(performance.now());

const nodeA = graph.nodes.get(1);
const edges = nodeA ? nodeA.edges : [];

console.log(`Edges from A to B (Gap 100): ${edges.length}`);
edges.forEach(e => console.log(` - ${e.action} to ID${e.toId}`));

if (edges.length === 0) {
    console.log("FAIL: Standard jump broken!");
} else {
    console.log("SUCCESS: Standard jump found.");
}
