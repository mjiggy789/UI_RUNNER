# Themes and Sprites

## Purpose
Render the bot with different visual styles while preserving shared pose data.

## Supported themes
- `neon`
- `pixel`
- `minimal`

## How it works
- Theme is provided via config.
- `SpriteRenderer` dispatches draw implementation per theme.
- Neon theme adapts color/skew from movement form:
  - seek: green
  - idle/general: cyan
  - slide or compressed-height (crouch/air tuck): red override

## Key files
- `packages/runtime/src/sprites.ts`
- `packages/shared/src/types/index.ts`
