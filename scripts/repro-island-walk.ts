
import { World } from '../packages/runtime/src/world';
import { NavGraph } from '../packages/runtime/src/planner';
import { Collider } from '@parkour-bot/shared';

(global as any).window = { innerWidth: 1000, innerHeight: 800, addEventListener: () => {}, setTimeout: () => {} };
(global as any).document = { body: {} };
(global as any).MutationObserver = class { observe() {} };
(global as any).ResizeObserver = class { observe() {} };

const world = new World({});

// Platform A: x=0..100, y=500
const platA: Collider = {
    id: 1,
    kind: 'rect',
    flags: { solid: true, oneWay: false, climbable: true },
    aabb: { x1: 0, y1: 500, x2: 100, y2: 520 },
    meta: { }
};

// Platform B: x=110..200, y=500 (Gap 10, same height)
const platB: Collider = {
    id: 2,
    kind: 'rect',
    flags: { solid: true, oneWay: false, climbable: true },
    aabb: { x1: 110, y1: 500, x2: 200, y2: 520 },
    meta: { }
};

// Ceiling above A: y=450 (Gap 50px)
const ceilingA: Collider = {
    id: 3,
    kind: 'rect',
    flags: { solid: true, oneWay: false, climbable: false },
    aabb: { x1: 0, y1: 440, x2: 100, y2: 450 },
    meta: { }
};

world.colliders.set(1, platA);
world.grid.insert(platA);
world.colliders.set(2, platB);
world.grid.insert(platB);
world.colliders.set(3, ceilingA);
world.grid.insert(ceilingA);

const graph = new NavGraph(world);
graph.update(performance.now());

const nodeA = graph.nodes.get(1);
const edges = nodeA ? nodeA.edges : [];

console.log(`Edges from A: ${edges.length}`);
edges.forEach(e => console.log(` - ${e.action} to ID${e.toId}`));

if (edges.length === 0) {
    console.log("FAIL: No edges found (Island Panic)");
} else {
    console.log("SUCCESS: Edges found");
}
