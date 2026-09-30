# F1 Stories — Tyre Intelligence

Unofficial interactive visualisation of Pirelli F1 race-preview data. Static site on GitHub Pages.
Stack: Vite + TypeScript + Three.js (lazy), zod/mini, Biome, Vitest, Playwright. Node ≥ 24 (runs `.ts` scripts natively).

## Hard rules

- **Static only.** No runtime backend, no runtime fetches to Pirelli or any third party. The browser loads only same-origin files.
- **Never invent Pirelli data.** Unknown = `null` → UI shows "Not provided". Never 0, never a guess. Every value needs provenance (`source` + `provenance.*`).
- **Generated vs overrides.** `data/generated/` is written only by `scripts/update-pirelli.ts`. `data/overrides/` is human-controlled and never written by automation. Merge order: generated → override (override wins field-by-field; explicit `null` = not published).
- **Status honesty.** Only a human sets `validation.status: "verified"`. AI/vision transcriptions use `"transcribed"`. Test data uses `"fixture"` and is never published.
- **Derived ≠ official.** Anything computed from 1–5 ratings lives in `src/domain/derivedMetrics.ts` and is labelled "Derived visualisation based on Pirelli circuit characteristics". Never call it temperature.
- **One WebGL canvas**, lazy-loaded, progressive enhancement. Every fact shown in 3D must also exist as HTML text. The SVG fallback must keep working.
- **No team-specific or unlicensed 3D models, logos or Pirelli artwork.** Link to Pirelli sources; don't hotlink or reproduce their graphics.
- **HTML only through `src/ui/html.ts`** (`html` tagged template escapes everything; `setHtml` is the single DOM sink). Never render scraped HTML.
- **Base path:** never hard-code a leading `/` for assets or links. Use `import.meta.env.BASE_URL` (runtime) or `%BASE_URL%` (index.html). `BASE_PATH` env sets it at build.

## Design language

"Drawing sheet": graphite neutrals, one pale probe-blue accent for interaction, colour reserved for data.
Tyre colours: hard `--c-hard` white, medium `--c-medium` yellow, soft `--c-soft` red (`--c-soft-text` for text).
Demand heat scale `--heat-1…5` teal → red. Archivo variable (wght + wdth) only; tabular figures, no monospace.
Uppercase only for mode tabs and compound names. See `docs/DESIGN-SYSTEM.md`.

## Commands

```
npm run dev            # data:build + vite
npm run check          # lint + typecheck + unit tests + build
npm run test:e2e       # Playwright against the production build under /Tyres/
npm run data:update    # polite Pirelli discovery (network)
npm run data:build     # merge + validate → public/data
npm run track:import -- <bacinger-id> <track-id> "<name>"
```

Tests are required for domain logic, parsers and anything touching data integrity. Update
`tests/fixtures/pirelli/` when Pirelli markup changes, rather than loosening the parser.

Docs: `docs/ARCHITECTURE.md`, `docs/DATA-SOURCES.md`, `docs/DATA-PIPELINE.md`, `docs/DESIGN-SYSTEM.md`.
