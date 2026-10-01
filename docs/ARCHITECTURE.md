# Architecture

## Constraints that shape everything

- **Static GitHub Pages.** No runtime backend, no runtime scraping, no CORS
  dependency. The browser only ever loads files from our own origin.
- **Official provenance.** Every value comes from Pirelli (or is explicitly
  labelled as derived). Missing is shown as "Not provided", never as 0.
- **3D is progressive enhancement.** The page is complete, readable and
  indexable before Three.js loads, and remains so if it never does.

```
press.pirelli.com ──► scripts/update-pirelli.ts ──► data/generated/{year}/{id}.json   (machine, regenerable)
                                                        │
                           humans ──────────────────► data/overrides/{year}/{id}.json   (never overwritten by automation)
                                                        │
bacinger/f1-circuits ──► scripts/import-track.ts ──► data/tracks/{trackId}.json
                                                        │
                         scripts/build-data.ts  merge → validate → public/data/{manifest.json, races/*.json, tracks/*.json}
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
src/
  main.ts                 boot: fetch manifest → resolve selection → render → lazy-load 3D
  domain/
    schema.ts             zod/mini schema for race records, tracks, manifest (single source of truth)
    selection.ts          latest-race logic, year switching, prev/next
    urlState.ts           ?year=&race= and /{year}/{slug}/ parsing + serialising
    derivedMetrics.ts     visualisation-only mapping of 1–5 ratings → per-tyre intensities
    format.ts             "Not provided", units, dates
  ui/
    html.ts               escaping tagged template (the only way HTML strings are built)
    templates.ts          pure render functions (used at runtime AND in the prerender)
    fallbackSvg.ts        SVG car plan-view + SVG circuit (no-WebGL / pre-3D state)
    app.ts                controller: events, state, history, transitions
  three/                  loaded via dynamic import only
    viewer.ts             renderer, camera, controls, loop, visibility/resize handling
    studio.ts             lights, environment, floor contact shadow
    car.ts                procedural generic single-seater (fallback if the GLB fails)
    tyre.ts               tyre geometry + demand shader
    circuit.ts            extruded ribbon from track points
    modelLoader.ts        loads public/models/f1car.glb (CC BY 4.0), recolours it, swaps in procedural demand tyres
  styles/                 tokens.css, base.css, layout.css, components.css
```

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

- `/embed/{el|en}/{season}/{slug}/{summary|compounds|demands|car|setup|circuit|3d}/` is
  prerendered for every race from `embed.html` + `src/ui/embed.ts` +
  `src/styles/embed.css`. Language is a path segment (not `?lang=`) so the pages stay
  static and script-free (`script-src 'none'`), `noindex`, canonical to the race page.
- Greek labels, number and date formats live in `STRINGS` in `src/ui/embed.ts` (one
  glossary to review). Pirelli's own names (races, circuits) stay as published.
- **Fixed height:** every row has a fixed height and never wraps (ellipsis), so a
  panel is equally tall at 300 px and 968 px and a fixed iframe `height` fits. An
  e2e test enforces it. No script on f1stories.gr is needed.
- Every embed shows its source, publication date and data status, and links to the
  full race page.
- `car` (tyre demand by corner) is the derived visualisation as four small car plans
  (longitudinal, lateral, tyre stress, braking/traction) with front and rear values as
  text, and always carries the "Derived visualisation … not temperature" label.
- `3d` is the one embed with a script (`embed-3d.html` → `src/embed3d.ts`, CSP
  `script-src 'self'`). It arrives as a complete poster: mode tabs, the flat drawing
  on the dark bench, and the readout text (`embedReadout`, rendered at build time and
  again in the browser). The Three.js viewer and the car model load only when the
  reader presses "Προβολή σε 3D", into the same fixed-height stage, so the iframe
  height is identical before and after. The model's CC BY credit sits under the stage.
- The "Embed" dialog on the main page (desktop) previews a panel, measures its height
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
| Manifest fetch fails | Prerendered race stays; notice "Race list unavailable"; selectors disabled |
| Race JSON fails / fails validation | Previous race stays; notice names the race; others remain selectable |
| Track JSON missing | Circuit shows "Track outline not available" plate; facts unaffected |
| WebGL unavailable / context lost / shader error | SVG car + circuit remain; notice; no retry loop |
| three chunk fails to load | Same as WebGL unavailable |
| Unknown year / race in URL | Latest race + notice |
| Partial Pirelli record | Missing values render "Not provided"; status badge "Needs review" |

All async entry points are wrapped; `window.onerror`/`unhandledrejection`
report to a visually hidden live region instead of breaking the page.

## Performance budget

| Asset | Budget |
|---|---|
| Critical JS (main chunk, gz) | ≤ 22 KB (measured 21 KB: app + templates + zod/mini) |
| CSS (gz) | ≤ 10 KB |
| Fonts | 1 variable woff2 latin subset, preloaded |
| three chunk (gz) | ≤ 170 KB (measured 156 KB), loaded after first paint |
| Per-race JSON | ≤ 4 KB |
| Track JSON | ≤ 12 KB |
| Renderer | DPR ≤ 1.75 (≤ 1.5 on coarse-pointer screens), MSAA off on low-core touch devices, render-on-demand, paused when hidden/off-screen/in Data mode |

### Measured (Lighthouse 12, local production preview, 2026-09-30)

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Desktop (`/`) | 100 | 100 | 100 | 100 |
| Mobile (`/`, simulated slow 4G, 4× CPU) | 99 | 100 | 100 | 100 |
| Desktop (`/2026/baku/`, after review fixes) | 100 | 100 | 100 | 100 |
| Mobile (`/2026/baku/`, after review fixes) | 96 | 100 | 100 | 100 |

Mobile LCP ≈ 1.7–2.5 s (simulated), TBT 70–120 ms (Three.js setup on a 4× throttled CPU), CLS 0.

Before the fixes above desktop scored 68 (TBT 520 ms from a synchronous WebGL probe
and shader compile; Speed Index 5.4 s from default auto-rotation repainting). Auto-rotate
is now off by default.
