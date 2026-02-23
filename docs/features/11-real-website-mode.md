# Real Website Mode

## Purpose
Replace training grounds with a realistic long-scroll test page for live DOM traversal.

## How it works
- Hides `#game-stage` and injects `#pkb-real-site`.
- Injected layout is a 90s/00s MySpace-style indieweb page (banner, nav strip, profile panel, cards, blogroll, guestbook, footer).
- Applies `data-bot-oneway` and structural sections to create platform variety.
- Enables document scrolling while active.
- On mode toggle, runtime performs rescan + respawn to rebuild world state.

## Key files
- `packages/runtime/src/index.ts`
