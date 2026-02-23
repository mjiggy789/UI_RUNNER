import { Collider } from '@parkour-bot/shared';

const CHECKSUM_QUANTIZE_PX = 4;
const CHECKSUM_SAMPLE_COUNT = 96;

export interface WorldChecksum {
    colliderCount: number;
    solidCount: number;
    oneWayCount: number;
    keyHash: number;
}

function quantizeForChecksum(value: number): number {
    return Math.round(value / CHECKSUM_QUANTIZE_PX);
}

export function computeWorldChecksum(colliders: Iterable<Collider>): WorldChecksum {
    let colliderCount = 0;
    let solidCount = 0;
    let oneWayCount = 0;
    const solids: Collider[] = [];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const c of colliders) {
        colliderCount++;
        if (c.kind !== 'rect' || !c.flags.solid) continue;
        solids.push(c);
        solidCount++;
        if (c.flags.oneWay) oneWayCount++;
        minX = Math.min(minX, c.aabb.x1);
        minY = Math.min(minY, c.aabb.y1);
        maxX = Math.max(maxX, c.aabb.x2);
        maxY = Math.max(maxY, c.aabb.y2);
    }

    const keyHashes: number[] = [];
    for (const c of solids) {
        // Translation-invariant signature: shape and relative placement only.
        const relX = quantizeForChecksum(c.aabb.x1 - minX);
        const relY = quantizeForChecksum(c.aabb.y1 - minY);
        const qWidth = quantizeForChecksum(c.aabb.x2 - c.aabb.x1);
        const qHeight = quantizeForChecksum(c.aabb.y2 - c.aabb.y1);
        const typeSeed = c.flags.oneWay ? 0x9e3779b9 : 0x7f4a7c15;
        const h1 = Math.imul((relX + 17) | 0, 73856093);
        const h2 = Math.imul((relY + 23) | 0, 19349663);
        const h3 = Math.imul((qWidth + 29) | 0, 83492791);
        const h4 = Math.imul((qHeight + 31) | 0, 1597334677);
        keyHashes.push((h1 ^ h2 ^ h3 ^ h4 ^ typeSeed) >>> 0);
    }

    keyHashes.sort((a, b) => a - b);
    let hash = 2166136261 >>> 0; // FNV offset basis
    hash ^= (colliderCount >>> 0);
    hash = Math.imul(hash, 16777619) >>> 0;
    hash ^= (solidCount >>> 0);
    hash = Math.imul(hash, 16777619) >>> 0;
    hash ^= (oneWayCount >>> 0);
    hash = Math.imul(hash, 16777619) >>> 0;
    if (solids.length > 0) {
        const spanX = quantizeForChecksum(maxX - minX) >>> 0;
        const spanY = quantizeForChecksum(maxY - minY) >>> 0;
        hash ^= spanX;
        hash = Math.imul(hash, 16777619) >>> 0;
        hash ^= spanY;
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    const sampleCount = Math.min(CHECKSUM_SAMPLE_COUNT, keyHashes.length);
    if (sampleCount > 0) {
        const step = keyHashes.length / sampleCount;
        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.min(keyHashes.length - 1, Math.floor(i * step));
            hash ^= keyHashes[idx] >>> 0;
            hash = Math.imul(hash, 16777619) >>> 0; // FNV prime
        }
    }

    return {
        colliderCount,
        solidCount,
        oneWayCount,
        keyHash: hash >>> 0
    };
}
