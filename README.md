# F1 Stories — TYRES.

An unofficial, interactive look at each Formula 1 weekend's tyre challenge: the compounds Pirelli
brings, how hard the circuit works the tyres, setup limits, and the circuit itself — on a generic 3D
single-seater, a circuit model and a fully accessible data table.

TYRES. is the fourth **Race Desk** product of [f1stories.gr](https://f1stories.gr), after THE GRID, TELEMETRY and
GHOST CAR. The page is in Greek and wears the site's masthead, theme and footer; see
[docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md).

- Opens on the **latest Pirelli race preview** in the dataset (by publication time).
- Every value links to its Pirelli source; missing values read "Δεν δόθηκε" (Not provided).
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
| `npm run og` | Render a Race Desk social card per race into `dist/og/`, the generic `dist/og.png` and every panel image into `dist/img/` (needs Playwright Chromium; the deploy workflow runs it) |

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

### Verifying transcribed values

```bash
npm run data:review                            # writes review-sheet.html: official graphic beside our values
open review-sheet.html
npm run data:verify -- 2026-bh --by "Your Name"   # only after checking every value
```

`data:verify` sets `validation.status` to `verified` with a dated note naming who checked it.

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

## Embedding in f1stories.gr articles

Open a race, press **Ενσωμάτωση** (desktop), choose a panel and language, and copy the
iframe snippet into the article. Choose **Image** for a PNG of the same panel
(social posts, newsletters) with ready alt text; images are rendered at deploy.
**Season compounds** embeds the season's compound choices by round. Embeds live at
`/Tyres/embed/{el|en}/{season}/{slug}/{panel}/`, are script-free and keep a fixed
height. Corrections to the data update every embed automatically. Details in
`docs/ARCHITECTURE.md` → Article embeds.

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
docs/        ARCHITECTURE, DATA-SOURCES, DATA-PIPELINE, DESIGN-SYSTEM, REDESIGN-GUIDE (history)
scripts/     update-pirelli.ts, build-data.ts, import-track.ts, check-sources.ts, pirelli/*
src/domain/  schema, selection (latest race), URL state, derived metrics, formatting
src/ui/      strings (all wording), templates (shared by browser + prerender), page, controller, embeds, SVG fallback
src/styles/  tokens, shell (site chrome), app, bench, season, embed
src/three/   viewer, GLB car loader (procedural fallback), tyre shader, circuit ribbon, studio
tests/       unit/ (Vitest), e2e/ (Playwright), fixtures/
```

## Credits and licences

- Tyre and circuit data: Pirelli Motorsport press area (facts only, always linked).
- Circuit outlines: bacinger/f1-circuits, MIT — `data/tracks/LICENSE-f1-circuits.md`.
- Typefaces: IBM Plex Sans and Barlow Condensed, SIL Open Font Licence 1.1 — `src/assets/fonts/LICENSE-*-OFL.txt`.
- F1 Stories logo (`public/logo-nav.webp`): F1 Stories' own mark, from the f1StoriesPage repo.
- 3D car: “Low Poly-F1” by salasilma13, CC BY 4.0 (Sketchfab) — `public/models/LICENSE-f1car.txt`; the same model the F1 Stories ghostcar uses. Tyres are procedural (`src/three/tyre.ts`); `src/three/car.ts` is the fallback car.
