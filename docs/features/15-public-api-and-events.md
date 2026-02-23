# Public API and Events

## Global API
`window.ParkourBot` exposes:
- `init(config)`
- `rescan()`
- `setEnabled(boolean)`
- `destroy()`

## Runtime instance
- Active runtime is also exposed as `window.ParkourBotInstance` for internal/debug access.

## Events
- `parkour-bot:ready`: runtime initialized and tick loop started.
- `parkour-bot:state`: emitted when enabled/disabled state changes.

## Key files
- `packages/runtime/src/index.ts`
