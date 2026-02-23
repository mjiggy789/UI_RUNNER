# DOM Sampling and Colliders

## Purpose
Convert real DOM elements into physics colliders.

## How it works
- Merges default selectors with config-provided selectors.
- Skips denylisted and invisible elements.
- Ignores runtime controls via deny selector (`[data-bot-ignore]` and descendants).
- Applies min-size checks and viewport relevance filtering.
- Clips collider bounds by overflow-clipping ancestors.
- Writes collider metadata (`radius`, optional numeric `z`).
- Infers one-way versus fully solid behavior with geometry heuristics:
  - vertical walls and thick slabs bias solid
  - wide structural surfaces and bars bias one-way
- Supports explicit overrides with `data-bot-solid` and `data-bot-oneway`.
- Removes colliders fully contained by another collider.

## Key files
- `packages/runtime/src/sampler.ts`
- `packages/shared/src/types/index.ts`
