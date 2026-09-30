# F1 Stories — Tyre Intelligence

An unofficial, interactive look at each Formula 1 weekend's tyre challenge: the compounds Pirelli
brings, how hard the circuit works the tyres, setup limits, and the circuit itself — on a generic 3D
single-seater, a circuit model and a fully accessible data table.

- Opens on the **latest Pirelli race preview** in the dataset (by publication time).
- Every value links to its Pirelli source; missing values read "Not provided".
- Static site for **GitHub Pages**: no backend, no runtime calls to Pirelli.

Unofficial. Not affiliated with or endorsed by Pirelli, Formula 1 or the FIA.

## Requirements

Node 24+ (scripts are TypeScript run natively by Node), npm.

## Install and develop

```bash
npm ci
npm run dev          # builds public/data from data/, then starts Vite on http://localhost:5173
```

Useful commands:

| Command | What it does |
|---|---|
| `npm run check` | Lint (Biome), typecheck, unit tests, production build |
| `npm run test:e2e` | Playwright browser tests (desktop + mobile) against the production build |
| `npm run build` | `data:build` + `vite build` → `dist/` including `/{year}/{slug}/` pages and `404.html` |
| `npm run preview` | Serve `dist/` locally |

First Playwright run: `npx playwright install chromium`.

## How the data works

```
press.pirelli.com ─► data/generated/   (automation, regenerable)
humans           ─► data/overrides/    (manual, never touched by automation)
                     └─► npm run data:build ─► public/data/  (validated, published)
```

Pirelli publishes some values (compounds, circuit length, publication time) in the article
text and metadata, but the 1–5 track ratings, pressures, camber limits, laps and pit-loss appear
**only in the preview graphic**. Automation fills what the text supports and marks the rest for
review. Details: [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md), [docs/DATA-PIPELINE.md](docs/DATA-PIPELINE.md).

### Updating data

```bash
npm run data:update                 # polite discovery since 1 Jan (≤ 40 pages, 5 s apart)
npm run data:update -- --since 2026-09-01 --max 10
npm run data:update -- --url https://press.pirelli.com/<article>/   # one known article
npm run data:build                  # merge + validate; prints conflicts and problems
```

`review-report.md` lists what still needs a human. In CI, the scheduled workflow opens a PR with
generated changes and posts the report to an issue labelled `data-review`.

### Manual corrections (overrides)

1. Open the official preview graphic linked in the record's `source.previewAssetUrl`.
2. Create or edit `data/overrides/{season}/{id}.json` (e.g. `data/overrides/2026/2026-bh.json`).
   Only include the fields you are setting; everything else comes from `data/generated/`.
   Use `null` for values Pirelli does not publish for that race.
3. Set `provenance.<group>` to `{ "method": "infographic-transcription" | "manual", "sourceUrl", "retrievedAt" }`.
4. Set `validation.status` to `verified` only after checking every value against the source.
5. `npm run data:build && npm test` — the build rejects out-of-range values and inconsistent
   records (e.g. race distance ≠ laps × length) and names the problem.

The JSON Schemas in `data/schemas/` (generated from `src/domain/schema.ts`) give editor autocompletion.

### Adding track geometry

1. Map the circuit in `data/reference/circuits.json` (track id, names/aliases, upstream id).
2. `npm run track:import -- <upstream-id> <track-id> "<Circuit name>"` — imports a centre-line from
   [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT), projects it to metres and
   simplifies it into `data/tracks/<track-id>.json`. `npm run track:import -- --all` imports every
   circuit used by a race record.
3. Sector boundaries stay `null` unless a reliable, licensed source exists.

## Deployment (GitHub Pages)

1. Push the repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Actions → General → Workflow permissions:** allow GitHub Actions to create pull
   requests (needed by the data-update workflow).
4. Pushes to `main` run **CI**; when it passes, **Deploy to GitHub Pages** builds with the correct
   project base path (from `actions/configure-pages`) and deploys.

Workflows (`.github/workflows/`):

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | push, PR | lint, typecheck, data validation, unit tests, build, Playwright |
| `deploy.yml` | CI success on `main`, manual | build with Pages base path → `actions/deploy-pages` |
| `update-pirelli.yml` | every 6 h, manual | discover → normalise → validate → PR + review issue |

PRs opened with the default `GITHUB_TOKEN` do not trigger CI automatically (GitHub rule); re-run CI
from the PR or close/reopen it. Actions are pinned by commit SHA; Dependabot keeps them current.

## Project layout

```
data/        generated/ overrides/ tracks/ reference/ schemas/ sources/
docs/        ARCHITECTURE, DATA-SOURCES, DATA-PIPELINE, DESIGN-SYSTEM
scripts/     update-pirelli.ts, build-data.ts, import-track.ts, check-sources.ts, pirelli/*
src/domain/  schema, selection (latest race), URL state, derived metrics, formatting
src/ui/      templates (shared by browser + prerender), controller, SVG fallback
src/three/   viewer, procedural car, tyre shader, circuit ribbon, studio
tests/       unit/ (Vitest), e2e/ (Playwright), fixtures/
```

## Credits and licences

- Tyre and circuit data: Pirelli Motorsport press area (facts only, always linked).
- Circuit outlines: bacinger/f1-circuits, MIT — `data/tracks/LICENSE-f1-circuits.md`.
- Typeface: Archivo, SIL Open Font Licence 1.1 — `src/assets/fonts/LICENSE-Archivo-OFL.txt`.
- 3D car: procedural and generic, built in `src/three/car.ts`.
