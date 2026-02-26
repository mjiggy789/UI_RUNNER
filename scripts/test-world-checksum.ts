import { Collider } from '@parkour-bot/shared';
import { computeWorldChecksum } from '@parkour-bot/runtime/world-checksum';

function makeRect(
    id: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    oneWay: boolean = false
): Collider {
    return {
        id,
        aabb: { x1, y1, x2, y2 },
        kind: 'rect',
        flags: {
            solid: true,
            oneWay,
            climbable: true
        },
        meta: {}
    };
}

function check(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

const base: Collider[] = [
    makeRect(1, 10, 100, 210, 130, false),
    makeRect(2, 260, 210, 410, 238, true),
    makeRect(3, 450, 60, 478, 320, false),
    makeRect(4, 520, 340, 760, 372, false)
];

const shifted: Collider[] = base.map((c) => ({
    ...c,
    aabb: {
        x1: c.aabb.x1 + 137,
        y1: c.aabb.y1 - 221,
        x2: c.aabb.x2 + 137,
        y2: c.aabb.y2 - 221
    }
}));

const reIded: Collider[] = base.map((c, idx) => ({
    ...c,
    id: 100 + idx
}));

const structurallyChanged: Collider[] = base.map((c) => (
    c.id === 4
        ? { ...c, aabb: { ...c.aabb, x2: c.aabb.x2 + 12 } }
        : c
));

const oneWayFlip: Collider[] = base.map((c) => (
    c.id === 3
        ? { ...c, flags: { ...c.flags, oneWay: true } }
        : c
));

const sumBase = computeWorldChecksum(base);
const sumShifted = computeWorldChecksum(shifted);
const sumReIded = computeWorldChecksum(reIded);
const sumStructural = computeWorldChecksum(structurallyChanged);
const sumOneWayFlip = computeWorldChecksum(oneWayFlip);

check(
    JSON.stringify(sumShifted) === JSON.stringify(sumBase),
    'checksum should be invariant under uniform translation'
);

check(
    JSON.stringify(sumReIded) === JSON.stringify(sumBase),
    'checksum should be invariant to collider id churn'
);

check(
    sumStructural.keyHash !== sumBase.keyHash,
    'checksum hash should change when platform geometry changes'
);

check(
    sumOneWayFlip.oneWayCount !== sumBase.oneWayCount,
    'checksum counts should change when one-way topology changes'
);

console.log('world checksum regression checks passed');
