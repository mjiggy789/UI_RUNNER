# Loader Bootstrap

## Purpose
Boot the runtime safely from a lightweight embed script.

## How it works
1. Reads script attributes: `data-key`, `data-bot`, `data-colliders`, `data-deny`, `data-theme`, `data-z`, `data-region`.
2. Detects client environment hints (`isMobile`, reduced motion, contrast preference).
3. Requests signed config from Config API (`/config`).
4. Loads versioned runtime script (`runtime-<hash>.js`) from CDN.
5. Calls `window.ParkourBot.init(combinedConfig)`.

## Key files
- `packages/loader/src/index.ts`
