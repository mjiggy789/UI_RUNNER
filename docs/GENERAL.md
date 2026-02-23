# Parkour Bot Embed Service: General Overview

## What this project does
Parkour Bot Embed Service injects an autonomous parkour bot into a webpage. The bot treats DOM elements as platforms, navigates with physics + AI, and renders on a full-screen canvas overlay without hijacking page interaction.

## High-level architecture
1. Loader reads `data-*` options from the embed script.
2. Loader fetches signed config from the Config API and verifies it.
3. Loader pulls the versioned runtime bundle.
4. Runtime samples DOM into colliders, runs brain + controller, and renders the bot.
5. Optional telemetry events are sent to telemetry service.

## Runtime interaction model
- Keyboard controls: `D` debug master, `S` settings, `R` respawn.
- Settings modal includes behavior toggles plus per-visualization debug toggles.
- Pause/resume uses a floating action button.
- Runtime UI controls are marked with `data-bot-ignore` so they are never sampled as colliders.

## Tech stack
- Language: TypeScript (runtime/services), JavaScript build output
- Runtime APIs: `requestAnimationFrame`, Canvas 2D, Shadow DOM, observers
- Backend services: Node.js + Express
- Bundling: `esbuild` via `build.js`
- Workspace structure: npm workspaces (`packages/*`, `services/*`)
- Signing: `tweetnacl` + `tweetnacl-util`

## Repository layout
- `packages/loader`: bootstrap, config fetch, signature checks
- `packages/runtime`: mount, world sampling, physics controller, AI brain, renderer, runtime controls
- `packages/shared`: shared types/config contracts
- `services/config-api`: signed config endpoint
- `services/telemetry`: telemetry ingestion endpoint
- `release/`: build artifacts and manifest

## Local commands
- Build: `npm run build`
- Full local stack: `npm run dev:full`

## Documentation map
- Architecture: `docs/ARCHITECTURE.md`
- Math models: `docs/MATH.md`
- Feature-by-feature docs: `docs/features/FEATURE_INDEX.md`
- Decision reference with examples: `docs/features/18-decision-reference-with-examples.md`
