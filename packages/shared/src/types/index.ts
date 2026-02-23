export interface AABB {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface ColliderMeta {
    radius?: number;
    z?: number;
    clip?: AABB;
}

export interface ColliderFlags {
    solid: boolean;
    oneWay: boolean;
    climbable: boolean;
}

export declare type ColliderKind = 'rect' | 'capsule' | 'polyline';

export interface Collider {
    id: number;
    // el is optional reference used in runtime, may not be serializable
    el?: Element;
    aabb: AABB;
    kind: ColliderKind;
    flags: ColliderFlags;
    meta: ColliderMeta;
}

export interface Config {
    key: string;
    bot: 'on' | 'off';
    colliders: string[]; // selector list
    deny: string[]; // selector list
    theme: 'neon' | 'pixel' | 'minimal';
    z?: number;
    region?: 'viewport' | 'hero' | 'full';
}

export interface FeatureFlags {
    enableTelemetry: boolean;
    enablePremium: boolean;
}

// Telemetry event schema placeholder
export interface TelemetryEvent {
    type: string;
    payload: Record<string, unknown>;
    timestamp: number;
}

export interface SignedConfig {
    config: Config;
    features: FeatureFlags;
    allowed: boolean;
    killSwitch: boolean;
    notBefore: number;
    notAfter: number;
    signature: string;
    version: string;
}
