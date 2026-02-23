# Telemetry

## Purpose
Collect coarse runtime events when telemetry feature flag is enabled.

## How it works
- Runtime sends telemetry only if `features.enableTelemetry` is `true`.
- Current runtime event: `boot`.
- Payload envelope includes `type`, `payload`, and `timestamp`.
- Telemetry service accepts `POST /event` and logs JSON payloads.

## Key files
- `packages/runtime/src/index.ts`
- `services/telemetry/src/index.ts`
- `packages/shared/src/types/index.ts`
