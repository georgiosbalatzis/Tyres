# F1 Stories — TYRES. (Race Desk)

TYRES is the fourth **Race Desk** product of f1stories.gr, after THE GRID, TELEMETRY and GHOST CAR. It's an unofficial,
interactive visualisation of Pirelli F1 race-preview data, built as a static site on GitHub Pages
(`georgiosbalatzis.github.io/Tyres/`). It must look and behave like part of f1stories.gr, not like a separate app.
Stack: Vite + TypeScript + Three.js (lazy), zod/mini, Biome, Vitest, Playwright. Node ≥ 24 (runs `.ts` scripts natively).

## Hard rules

- **Static only.** There's no runtime backend and no runtime fetches to Pirelli, f1stories.gr or any third party. The browser loads
  only same-origin files. Links to f1stories.gr are fine; fetching from it is not.
- **Never invent Pirelli data.** Unknown means `null`, and the UI shows `STRINGS.el.notProvided` ("Δεν δόθηκε"). Never show 0 or a guess.
  Every value needs provenance (`source` + `provenance.*`).
- **Generated vs overrides.** `data/generated/` is written only by `scripts/update-pirelli.ts`. `data/overrides/` is
  human-controlled and never written by automation. Merge order is generated → override (the override wins field by field, and an
  explicit `null` means not published).
- **Status honesty.** Only a human sets `validation.status: "verified"`. AI/vision transcriptions use `"transcribed"`.
  Test data uses `"fixture"` and is never published. The status is always visible, both in the signal band and in the source panel.
- **Derived ≠ official.** Anything computed from 1–5 ratings lives in `src/domain/derivedMetrics.ts` and carries the
  derived label `STRINGS[lang].derived` ("Παράγωγη απεικόνιση…"). Never call it temperature.
- **One WebGL canvas**, lazy-loaded, as progressive enhancement. Every fact shown in 3D must also exist as HTML text. The SVG
  fallback must keep working.
- **No team-specific or unlicensed 3D models, logos or Pirelli artwork.** Link to Pirelli sources, and don't hotlink or
  reproduce their graphics. "Pirelli" is never part of the product name.
- **HTML only through `src/ui/html.ts`.** The `html` tagged template escapes everything, and `setHtml` is the single DOM sink. Never render scraped HTML.
- **Base path:** never hard-code a leading `/` for assets or links. Use `import.meta.env.BASE_URL` (runtime) or
  `%BASE_URL%` (index.html). The `BASE_PATH` env var sets it at build.

## F1 Stories family contract (non-negotiable)

The source of truth is **f1StoriesPage**: `styles/editorial.css`, `docs/design-tokens.md`, `docs/race-desk-architecture.md`,
`partials/nav.html`, `partials/footer.html`, `scripts/theme-init.js`. The closest sibling to copy from is **Telemetry**
(`georgiosbalatzis/f1-telemetry-dashboard`: `src/index.css` "Site chrome", `src/copy.ts`, `docs/RACE_DESK.md`).
When in doubt, open the live pages and compare: <https://f1stories.gr/standings/> and
<https://georgiosbalatzis.github.io/f1-telemetry-dashboard/>.

- **Language.** The UI is Greek (`<html lang="el">`). English stays only for product names (`TYRES`, `THE GRID`, `TELEMETRY`,
  `GHOST CAR`, set with `lang="en"`), the band slogan, F1 terms (C1–C5, Hard/Medium/Soft, psi, camber, pit stop) and data values
  (race and circuit names come from Pirelli and are never translated). Article embeds keep `el` and `en`.
- **All wording lives in `src/ui/strings.ts`.** `STRINGS.el`/`STRINGS.en` hold the shared panel vocabulary (page and embeds),
  and `PAGE` holds page-only Greek copy. Never put literal UI copy in templates, `app.ts` or `index.html`, except the masthead,
  Race Desk and footer markup copied from the site.
- **Global masthead = the site's nav.** It has the same seven links in the same order: Αρχική · Άρθρα · YouTube · Βαθμολογία · **Δεδομένα**
  (current, `aria-current="page"`) · Συντάκτες · BetCast. TYRES never appears in the global nav. On the right sit the next-GP countdown
  (`src/ui/countdown.ts`, mirroring the calendar in `f1StoriesPage/scripts/shared-nav.js`), the theme toggle and the mobile menu.
- **Race Desk hero.** This is the kicker `F1 STORIES / RACE DESK` (not a heading) on a 1px ink rule. The switcher sits on the same rule with exactly
  `THE GRID · TELEMETRY · GHOST CAR · TYRES`, TYRES current, same-tab links, no ↗. The H1 is `TYRES.`, set in Barlow Condensed 700 with
  the dot in `--c-signal`, followed by the descriptor. The race name is the H2 below it. The aside reads "Κάθε γόμα, μια ιστορία."
- **Signal band.** It's a full-width `--c-signal` band in `--c-signal-ink` text, showing preview/season/round/status on the left and
  `EVERY COMPOUND COUNTS.` on the right.
- **Controls.** Selects are underlined (no box), and tabs are underlined *below* the label with a 3px signal bar. The Race Desk switcher marks the current
  product with a bar *above*. The two levels must never look alike. Panels are unboxed: a 2px ink top rule plus an uppercase 12px
  title. No bordered cards, pills or shadows, and no rounded panels.
- **Footer = the site's colophon.** It has the sponsors strip ("ΜΑΖΙ ΣΤΗΝ ΕΚΚΙΝΗΣΗ", six partners), the ink colophon (wordmark + mission),
  the section index, social icons and legal links. TYRES's credits (Pirelli disclaimer, circuit outlines, 3D model, fonts) go in
  the colophon meta line, the same slot Telemetry uses for "Δεδομένα από OpenF1".
- **Theme contract.** The `localStorage` key is `f1stories-theme` (`light` | `dark`). It's resolved before paint in `public/theme.js`: stored value →
  OS `prefers-color-scheme` → dark. It's written only when the reader presses the toggle. `<html data-theme>` is always set explicitly.
  The 3D bench (`.canvas-host`) is dark in both themes. The colophon is the fixed ink block (`--c-colophon-*`) in both themes.
- **Container.** The max width is 1476px. Gutters are 48px, then 32px at ≤1199px, 22px at ≤767px and 17px at ≤359px (same as `editorial.css`).
  The masthead is fixed, 75px tall on desktop and 67px at ≤991px. Desktop nav links appear from 992px.

## Design language

Paper and ink, with racing red `--c-signal` reserved for brand marks (wordmark dot, H1 dot, current bars, signal band, probe sweep).
Otherwise colour is reserved for data. Use role tokens (`--c-bg/surface/raised/rule/text/text-2/accent/signal/signal-ink`) and never raw hex,
so both themes work. The values equal the canonical tokens in `f1StoriesPage/docs/design-tokens.md`; the mapping table is in
`docs/DESIGN-SYSTEM.md`. `--c-text-2` is never used for small text on `--c-raised` (4.48:1 in light).
Tyre colours: hard is `--c-hard` (white), medium is `--c-medium` (yellow) and soft is `--c-soft` (red). Compound names are set as text with
`--c-{hard,medium,soft}-text`. The demand heat scale runs `--heat-1…5`, teal → red.
IBM Plex Sans (400–600) is used for text, with tabular figures and no monospace. Barlow Condensed 700 is used only for the wordmark, the `TYRES.` H1,
the Race Desk switcher, the band slogan and the sidebar title. Uppercase letter-spacing (.12–.13em) is used only for kickers, panel titles,
field labels and compound names (HARD/MEDIUM/SOFT); tabs and buttons stay sentence case. Focus is `outline: 2px solid var(--c-accent); outline-offset: 5px` (inset −4px inside scrollers). Targets are ≥ 44px.
See `docs/DESIGN-SYSTEM.md`.

## Article embeds

`/embed/{el|en}/{season}/{slug}/{panel}/` pages (`src/ui/embed.ts`, `src/styles/embed.css`) are iframed into
f1stories.gr articles (`blog-module/blog/article-script.js` there whitelists this origin). Keep them script-free (the `3d` panel
is the single exception: it loads the viewer only on request) and keep provenance and status in the footer. Keep every row a
fixed height that never wraps, so a panel's height is the same at every width (an e2e test checks it). They're light by default; `#dark`
switches to charcoal (the site's theme bridge sets it).

## Commands

```
npm run dev            # data:build + vite
npm run check          # lint + typecheck + unit tests + build
npm run test:e2e       # Playwright against the production build under /Tyres/
npm run data:update    # polite Pirelli discovery (network)
npm run data:build     # merge + validate → public/data
npm run site:check     # network: has f1stories.gr's nav/footer/Race Desk/calendar drifted from our copy?
npm run track:import -- <bacinger-id> <track-id> "<name>"
```

Tests are required for domain logic, parsers and anything touching data integrity or the shared shell (nav order, current
items, Race Desk links). Update `tests/fixtures/pirelli/` when Pirelli markup changes, rather than loosening the parser.

Docs: `docs/ARCHITECTURE.md`, `docs/DATA-SOURCES.md`, `docs/DATA-PIPELINE.md`, `docs/DESIGN-SYSTEM.md`. `docs/REDESIGN-GUIDE.md` is the
history of the Race Desk redesign (how it was planned and where the result departs from the plan); it is not a to-do list.
