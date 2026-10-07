# Architecture

## Constraints that shape everything

- **Static GitHub Pages.** No runtime backend, no runtime scraping, no CORS
  dependency. The browser only ever loads files from our own origin.
- **Official provenance.** Weekend facts come from Pirelli; circuit debut years
  come from linked official Formula 1 history. Computed values are explicitly
  labelled as derived. Missing is shown as "Δεν δόθηκε" (Not provided), never as 0.
- **3D is progressive enhancement.** The page is complete, readable and
  indexable before Three.js loads, and remains so if it never does.
- **Part of the F1 Stories family.** The page wears the f1stories.gr shell (masthead, Race Desk hero,
  signal band, sponsors, colophon) and its theme contract; see `docs/DESIGN-SYSTEM.md`. The shell is
  copied from the main site and Telemetry, not imported: the apps are separate deployments.

```
press.pirelli.com ──► scripts/update-pirelli.ts ──► data/generated/{year}/{id}.json   (machine, regenerable)
                                                        │
                           humans ──────────────────► data/overrides/{year}/{id}.json   (never overwritten by automation)
                                                        │
bacinger/f1-circuits ──► scripts/import-track.ts ──► data/tracks/{trackId}.json
                                                        │
                         scripts/build-data.ts  merge → validate → public/data/{manifest.json, races/*.json, tracks/*.json, weekends/*.json}
                                                        │
                         vite build + prerender plugin → dist/ (index.html, /{year}/{slug}/index.html, 404.html)
                                                        │
                                                GitHub Pages (actions/deploy-pages)
```

## Stack decision

The repository was an empty WebStorm TypeScript scaffold, so there was nothing to
preserve.

| Criterion | A: Vite + TS + Three.js | B: Vite + React + R3F | C: Astro + island |
|---|---|---|---|
| GitHub Pages | ✔ static | ✔ static | ✔ static |
| Core JS before 3D | ~15 KB | +45 KB React runtime before anything | ~0 KB, island hydrates |
| WebGL control | Direct, one canvas, explicit render loop | Declarative, reconciler overhead per frame | Same as A inside island |
| Per-race static pages | Small Vite plugin (~80 lines) | Needs SSG add-on | Native |
| Dependencies | three, zod | + react, react-dom, @react-three/fiber, drei | + astro + integration |
| Maintainability | Plain TS modules | Familiar to React devs | Two mental models |

**Chosen: A — Vite + TypeScript + Three.js.** This is one highly interactive
page with a handful of panels. React would add a runtime and a render model
without solving a problem we have; Astro's routing strength is covered by a
small prerender plugin that renders the same HTML templates used at runtime.
Runtime dependencies are **three** (lazy-loaded) and **zod** (the `zod/mini`
tree-shakable build, used for both build-time and runtime validation).

Dev dependencies: vite, typescript, vitest, @playwright/test, @biomejs/biome
(lint + format in one tool instead of ESLint + Prettier + plugins).

No Tailwind, no UI kit, no GSAP. Motion uses CSS transitions, the Web Animations
API and the Three.js render loop.

## Runtime modules

```
index.html                static shell: skip link, masthead, Race Desk hero, signal band, scope row, sponsors,
                          colophon, with <!--app:…--> placeholders for everything that depends on the race
embed.html, embed-3d.html templates for the article embeds
public/theme.js           blocking theme resolver (f1stories-theme → OS → dark)
src/
  main.ts                 boot: imports tokens.css, shell.css, app.css, then starts the controller
  domain/
    weekend.ts            weather/session schema, cross-field checks, track-local dates and WMO condition mapping
    schema.ts             zod/mini schema for race records, tracks, manifest (single source of truth)
    selection.ts          latest-race logic, year switching, prev/next
    urlState.ts           ?year=&race= and /{year}/{slug}/ parsing + serialising; typed ResolveNotice
    derivedMetrics.ts     visualisation-only mapping of 1–5 ratings → per-tyre intensities (text supplied by the UI)
    format.ts             rating list, compound colour variables, English helpers for the review sheet only
  ui/
    weather.ts            shared prerender/runtime three-day weather and standard/Sprint session columns
    strings.ts            ALL wording: STRINGS (page + embeds, el/en), fmt() number and date formats, PAGE (page-only Greek)
    html.ts               escaping tagged template (the only way HTML strings are built)
    templates.ts          pure render functions (used at runtime AND in the prerender): identity, band, specs, ratings,
                          setup, compounds, titleBlock, readout, dataTable, archive, stepper, embedDialog, credits
    page.ts               whole-page composition for the prerender: fills the index.html placeholders, head and SEO
    embed.ts              article embed panels and the season strip
    ogCard.ts             1200×630 social card (race and generic)
    countdown.ts          bundled F1 calendar (mirrors the main site) and the masthead's next-GP countdown
    fallbackSvg.ts        SVG car plan-view + SVG circuit (no-WebGL / pre-3D state)
    app.ts                controller: events, state, history, transitions, countdown, embed dialog
  three/                  loaded via dynamic import only
    viewer.ts             renderer, camera, controls, loop, visibility/resize handling
    studio.ts             lights, environment, floor contact shadow
    car.ts                procedural generic single-seater (fallback if the GLB fails)
    tyre.ts               tyre geometry + demand shader
    circuit.ts            extruded ribbon from track points
    modelLoader.ts        loads public/models/f1car.glb (CC BY 4.0), recolours it, swaps in procedural demand tyres
  styles/
    tokens.css            fonts and role tokens (canonical values), both themes; imported by the page and the embeds
    shell.css             masthead, Race Desk hero, signal band, sponsors, colophon (ported from Telemetry/the main site)
    app.css               base, scope row, key figures, tabs, stage, sidebar, panels, archive, embed dialog
    bench.css             the dark test bench and its drawings (shared with the 3D embed)
    season.css            the season strip (page and embed)
    embed.css             article embeds
```

### Page composition

`index.html` holds the parts that never change per race. `renderPage` (`src/ui/page.ts`) fills the placeholders at
build time, and `app.ts` re-renders the same regions with the same functions when the race changes:

| Placeholder | Filled by |
|---|---|
| `<!--app:head-->` | title, description, canonical, Open Graph, JSON-LD (Greek, from `PAGE.seo`) |
| `<!--app:identity-->` | `identity(r)`: race name, circuit, location, dates (the hero's second line) |
| `<!--app:band-->` | `band(r)`: preview, season, round, **data status** (the signal band) |
| `<!--app:stepper-->` | `stepper(...)`: previous/next as real links |
| `<!--app:main-->` | `mainRegions(ctx)`: key figures, tabs, stage, sidebar, source, season, archive |
| `<!--app:credits-->` | `credits()`: the Pirelli disclaimer and attributions in the colophon |
| `<!--app:embedDialog-->` | `embedDialog()`: the author tool |
| `<!--app:notice-->`, `<!--app:boot-->` | the 404 notice; the JSON the browser boots from |

The footer year is stamped at build. The masthead's countdown is filled in the browser from the bundled calendar and
stays hidden once the calendar has run out.

### Data flow at runtime

1. HTML arrives **already rendered** for the latest race (or the race of the
   static page requested) — title, facts, ratings, compounds, source block,
   SVG circuit.
2. `main.ts` fetches `data/manifest.json` (≈2 KB) and the selected race record,
   validates both with zod, and hydrates controls.
3. An `IntersectionObserver` on the viewport plus `requestIdleCallback` triggers
   `import('./three/viewer')`. The viewer creates its own WebGL2 context (no
   separate probe — a throwaway context cost ~260 ms of main thread); if that fails
   the SVG fallback stays and a notice explains why. Scene setup is split across
   tasks and shaders compile with `compileAsync`, so no long task blocks input.
   `Save-Data` users get a "Load 3D view" button instead of an automatic download.
4. Race changes fetch one small JSON (cached in a `Map`), re-render panels, and
   call `viewer.setRace()` which interpolates tyre uniforms and rebuilds the
   circuit ribbon.

## Routing and SEO

- **Static per-race pages** `/{year}/{slug}/index.html` are generated at build
  time with race-specific `<title>`, description, canonical, Open Graph and the
  prerendered content. They are real files, so GitHub Pages serves them without
  SPA tricks.
- `index.html` is the latest race.
- In-app navigation uses `history.pushState` to the matching static path, so
  refresh and sharing always land on a real file.
- The `?year=2026&race=sepang` query form is also accepted on any page (and
  normalised with `replaceState`). Invalid or unknown values fall back to the
  latest race with an inline notice.
- `404.html` is a copy of the index shell: unknown paths show the latest race
  with a "page not found" notice instead of a blank GitHub 404.

## Article embeds

f1stories.gr articles embed single panels as iframes, the same way they embed the
telemetry dashboard and ghostcar (`georgiosbalatzis.github.io` is already allowed by
the site's CSP and its author tool's iframe whitelist).

- `/embed/{el|en}/{season}/{slug}/{summary|compounds|demands|car|setup|circuit|circuit-info|3d}/` is
  prerendered for every race from `embed.html` + `src/ui/embed.ts` +
  `src/styles/embed.css`. Language is a path segment (not `?lang=`) so the pages stay
  static and script-free (`script-src 'none'`), `noindex`, canonical to the race page.
- Greek and English labels, number and date formats live in `STRINGS` in `src/ui/strings.ts` (one
  glossary to review, shared with the main page). Pirelli's own names (races, circuits) stay as published.
- **Fixed height:** panels reserve fixed row heights so they are equally tall at
  300 px and 968 px and a fixed iframe `height` fits. Compact panels use ellipsis;
  the full circuit sheet permits wrapping as described below. An e2e test
  enforces the height. No script on f1stories.gr is needed.
- **Full circuit sheet** (`circuit-info`) shares `src/ui/circuitInfo.ts` with the
  main tab: host flag and location, map, five facts (length, first championship
  Grand Prix, lap record with driver/year, laps, distance), and linked sources.
  This panel allows text to wrap inside reserved row heights instead of using
  ellipsis, so all circuit information stays readable and iframe height remains
  constant. Opening the embed dialog from that tab preselects this panel. Both
  language variants and their PNG images are generated for every race.
- Every embed shows its source, publication date and data status, and links to the
  full race page.
- `car` (tyre demand by corner) is the derived visualisation as four small car plans
  (longitudinal, lateral, tyre stress, braking/traction) with front and rear values as
  text, and always carries the "Derived visualisation … not temperature" label.
- **Theme:** embeds are light by default. A `#dark` fragment on the iframe URL switches
  one to the charcoal theme through CSS `:target` (`<div class="e-root" id="dark">`),
  with no script, no reload and the same height. f1stories.gr sets the fragment from its
  `data-theme` in `article-script.js` (`setupTyreEmbeds`, f1StoriesPage PR #235).
- **Panel images** (social posts, newsletters): `scripts/og-images.ts` screenshots every
  static panel in both languages from the built embed pages at deploy, into
  `/img/{el|en}/{season}/{slug}/{panel}.png` (720 px panel + 40 px paper margin, at 2×;
  the footer shows the site address instead of "Open in …"). The same script renders a Race Desk social
  card per race (`/og/{season}/{slug}.png`) and the generic `/og.png` used by the 404 page. The dialog's Image format
  gives an `<img>` whose alt text is the panel's own text, read from the preview.
- **Season strip** (`seasonStrip` in `src/ui/embed.ts`, styles in `season.css`): compound
  choices by round as a table (C-range rows, round columns, a tyre-ring marker in the
  weekend role's colour). On the race page under the title block (current round
  highlighted, re-rendered from the manifest on race change), and as the season embed
  `/embed/{el|en}/{season}/season/` + image `/img/{lang}/{season}/season.png`. In the
  embed it scrolls sideways when narrow, with a permanent scrollbar so the height stays
  constant. The footer counts previews by status.
- `3d` is the one embed with a script (`embed-3d.html` → `src/embed3d.ts`, CSP
  `script-src 'self'`). It arrives as a complete poster: mode tabs, the flat drawing
  on the dark bench, and the readout text (`embedReadout`, rendered at build time and
  again in the browser). The Three.js viewer and the car model load only when the
  reader presses "Προβολή σε 3D", into the same fixed-height stage, so the iframe
  height is identical before and after. The model's CC BY credit sits under the stage.
- The "Ενσωμάτωση" dialog on the main page (desktop) previews a panel, measures its height
  from the same-origin preview and copies a ready iframe snippet.
- Dev: `npm run dev` serves embed routes on the fly (see `configureServer` in
  `vite.config.ts`).

## GitHub Pages base path

Project sites live under `/<repo>/`. Vite's `base` is read from `BASE_PATH`
(default `/`). The deploy workflow sets it from
`actions/configure-pages` → `base_path`. All runtime URLs are built from
`import.meta.env.BASE_URL`; never hard-code a leading `/`.

## Failure handling

| Situation | Behaviour |
|---|---|
| Manifest fetch fails | Prerendered race stays; notice (`PAGE.notice.manifestFailed`); selectors disabled |
| Race JSON fails / fails validation | Previous race stays; notice names the race; others remain selectable |
| Track JSON missing | Circuit shows the "no outline" plate (`PAGE.noOutline`); facts unaffected |
| WebGL unavailable / context lost / shader error | SVG car + circuit remain; notice; no retry loop |
| three chunk fails to load | Same as WebGL unavailable |
| Unknown year / race in URL | Latest race + notice |
| Partial Pirelli record | Missing values render "Δεν δόθηκε"; the status in the signal band and source strip reads "Χρειάζεται έλεγχο" |

All async entry points are wrapped; `window.onerror`/`unhandledrejection`
report to a visually hidden live region instead of breaking the page.

## Performance budget

| Asset | Budget | Measured (2026-10-05) |
|---|---|---|
| Critical JS (main + shared chunk, gz) | ≤ 22 KB | **29.7 KB** (5.3 KB app + 24.4 KB zod/mini and the preload helper) — over budget |
| CSS (gz) | ≤ 10 KB | 8.8 KB page, 4.5 KB embeds |
| Fonts | preload only what the first paint needs | Plex Latin (40 KB), Plex Greek (16 KB) and Barlow 700 (15 KB) are preloaded; Latin-ext (26 KB) loads on demand |
| three chunk (gz) | ≤ 170 KB | **177.6 KB** — over budget, loaded after first paint |
| Per-race JSON | ≤ 4 KB | unchanged |
| Track JSON | ≤ 12 KB | unchanged |
| Renderer | DPR ≤ 1.75 (≤ 1.5 on coarse-pointer screens), MSAA off on low-core touch devices, render-on-demand, paused when hidden/off-screen/in Data mode | unchanged |

The two over-budget lines predate the Race Desk redesign (the same chunks measured 26.6 KB and 177.7 KB before it); the
redesign added about 3 KB to the critical JS (the strings and the countdown calendar). They are recorded, not fixed.

### Measured (Lighthouse 12, local production preview, 2026-10-05, after the redesign)

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Desktop (`/Tyres/`) | 100 | 100 | 100 | 100 |
| Mobile (`/Tyres/`, simulated slow 4G, 4× CPU) | 100 | 100 | 100 | 100 |

Mobile LCP 1.8 s, desktop LCP 0.4 s, TBT 0 ms, CLS 0. Auto-rotate stays off by default (it once cost Speed Index 5.4 s
on desktop), and the viewer creates its own WebGL context instead of probing for one.

## Weekend weather

`update-weekends.ts` reads the merged publishable records, resolves official F1
race routes and host time zones, extracts five-session schedules, and queries
Open-Meteo using upstream circuit coordinates. It writes validated separate
`data/weekends/{raceId}.json` snapshots. `build-data.ts` publishes them, writes
`null` for missing snapshots, and emits `weekend.schema.json`; no other record
schema or human verification status changes.

Vite includes the selected snapshot in prerendered HTML and boot JSON. Race
navigation fetches the new race's track and weekend in parallel, then commits both
under the existing navigation token. The weather tab hides the 3D desk and pauses
its render loop. Missing/invalid weather never blocks tyre data navigation.
Three track-local day columns remain horizontal, with an internal scroller on
phones. The user chooses Greece or track time for sessions; times crossing a local
calendar day carry an explicit date. Daily weather stays tied to track-local days.

Forecast refreshes are a deployment-time network step and a six-hour scheduled
redeploy on `main`. Development and offline builds use the checked-in snapshots.
The weather data pipeline never calls external services from the visitor's browser.
