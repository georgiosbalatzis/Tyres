# Design system — TYRES. in the F1 Stories Race Desk

TYRES. is the fourth **Race Desk** product of f1stories.gr, after THE GRID, TELEMETRY and GHOST CAR. It is built to
look and behave like part of that site, not like a separate app: the same masthead, the same Race Desk hero and red
band, the same underlined controls and unboxed panels, the same footer, the same theme contract. The 3D bench is the
one thing here that has no sibling.

Sources of truth, in order: `f1StoriesPage/styles/editorial.css` and `docs/design-tokens.md` (values),
`docs/race-desk-architecture.md` (hierarchy and naming), `partials/nav.html` and `partials/footer.html` (shell markup),
`scripts/theme-init.js` (theme). The closest sibling to copy from is Telemetry
(`f1-telemetry-dashboard`, `src/index.css` "Site chrome", `src/copy.ts`). When in doubt, open the live pages:
<https://f1stories.gr/standings/> and <https://georgiosbalatzis.github.io/f1-telemetry-dashboard/>.

## Page anatomy

Top to bottom, as in `index.html` and `mainRegions` in `src/ui/page.ts`:

| Band | What it is | Styles |
|---|---|---|
| Masthead | Fixed, 75 px (67 px ≤ 991 px). The site's seven links with **Δεδομένα** current, the next-GP countdown, theme toggle, mobile menu | `shell.css` |
| Race Desk hero | Kicker `F1 STORIES / RACE DESK` on a 1 px ink rule; switcher `THE GRID · TELEMETRY · GHOST CAR · TYRES` on the same rule; `TYRES.` H1; Greek descriptor; race name and circuit; aside tagline ≥ 1024 px | `shell.css` |
| Signal band | `--c-signal` band, 58 px: preview · season · round · **data status**, and `EVERY COMPOUND COUNTS.` from 1024 px | `shell.css` |
| Scope row | Season and Grand Prix selects, previous/next, Ενσωμάτωση (desktop only) | `app.css` |
| Key figures | Six ruled cells: compounds, circuit length, laps, race distance, pit-stop loss, lap record | `app.css` |
| Tabs | Μονοθέσιο · Πίστα · Ελαστικά · Πίνακας | `app.css` |
| Stage + sidebar | The 3D bench / flat drawing / data table, with sub-views and the corner readout, beside **ΔΕΛΤΙΟ ΕΛΑΣΤΙΚΩΝ** (compounds, track demands, setup limits) | `app.css`, `bench.css` |
| Panels | Source (provenance and status), season compounds, archive of all previews | `app.css`, `season.css` |
| Sponsors + colophon | "ΜΑΖΙ ΣΤΗΝ ΕΚΚΙΝΗΣΗ" strip, then the ink colophon with the credits | `shell.css` |

Two levels of "current" coexist on purpose: **Δεδομένα** in the masthead (the global section) and **TYRES** in the
Race Desk switcher (the product). TYRES never appears in the masthead, and the switcher's current item is marked by a
3 px signal bar *above*, while the tabs mark theirs by a 3 px bar *below*, so the two levels never look alike.

## Themes

`public/theme.js` (blocking, same-origin) resolves the theme before first paint: the stored `f1stories-theme`
(`light` | `dark`) → the OS `prefers-color-scheme` → dark. It always sets `<html data-theme>` explicitly, writes storage
only when the reader presses the toggle, leaves unknown stored values (such as `auto`) alone, and migrates this app's
old `theme` key once. The same key is shared with Telemetry, Ghost Car and BetCast (same github.io origin); a theme
chosen on f1stories.gr is not visible here until the apps are served under one origin.

The 3D bench (`.canvas-host`) is dark in both themes. The colophon and sponsor strip use fixed values
(`--c-colophon-*`, `--c-sponsor-*`). Article embeds are light by default and switch to charcoal with a `#dark`
fragment.

## Colour

Role tokens in `src/styles/tokens.css`. **Values equal the canonical tokens**; the mapping is how a rule from the main
site or Telemetry is ported.

| TYRES | Light | Dark | f1StoriesPage | Telemetry | Use |
|---|---|---|---|---|---|
| `--c-bg` | `#f2eee4` | `#1b1a19` | `--bg-base` | `--bg` | page background |
| `--c-surface` | `#e9e3d6` | `#242321` | `--bg-surface` | `--surface` | masthead, hero gradient, option lists |
| `--c-raised` | `#dfd9ca` | `#2e2c29` | `--bg-surface-alt` | `--surface-soft` | selected states in the season strip |
| `--c-rule` | `#c8c8b9` | `#4b5146` | `--border` | `--line` | rules between rows |
| `--c-text` | `#20251f` | `#eee8db` | `--text-primary` | `--text`, `--ink` | primary text, 2 px panel rules, underlines |
| `--c-text-2` | `#5b6256` | `#b6bbac` | `--text-secondary` | `--text-muted` | secondary text, units, labels |
| `--c-accent` | `#a82e1c` | `#ff775f` | `--accent` | `--accent`, `--focus` | focus ring, hover |
| `--c-accent-hover` | `#8e281a` | `#ff947f` | `--accent-hover` | `--accent-hover` | alternate interaction tone |
| `--c-accent-muted` | `#ed4c3214` | `#ed4c3214` | `--accent-muted` | `--accent-muted` | selected wash; never the only indicator |
| `--c-signal` | `#ed4c32` | `#ed4c32` | `--signal` | `--signal` | brand marks only (below) |
| `--c-signal-ink` | `#17191b` | `#17191b` | `--signal-ink` | `--signal-ink` | text on a signal fill (4.77 : 1) |
| `--c-ink`, `--c-paper` | `#20251f`, `#e9e3d6` | same | `--ink`, `--paper` | — | fixed brand constants |
| `--c-colophon-bg` / `-text` / `-text-2` / `-rule` | `#20251f` / `#e9e3d6` / `#c0bfb2` / 18 % paper | same | `--ink`… | `--colophon-*` | footer |
| `--c-sponsor-paper` / `-text` | `#f2eee4` / `#5b6256` | same | — | `--sponsor-*` | sponsor hover chip |

Rules that follow from the contract:

- `--c-signal` is for **brand marks only**: wordmark dot, the `TYRES.` dot, current bars and underlines, the signal band,
  the race-change sweep, the notice edge. Never use it as a small-text colour; use `--c-accent` for readable red text.
- `--c-text-2` is not approved for small text on `--c-raised` (4.48 : 1 in light). Use `--c-text` there.
- Never raw hex in components. The exceptions in page CSS are deliberate: the tyre sidewall art (`.disc`), a mask, and
  the site's own translucent washes in `shell.css`.

### Data colours (kept local, never brand colours)

| Token | Meaning |
|---|---|
| `--c-hard` `#f2f1ec`, `--c-medium` `#f5c518`, `--c-soft` `#e5322d` | Hard, Medium, Soft compound |
| `--c-{hard,medium,soft}-text` | compound names set as text (light `#20251f` `#7a5a00` `#b3261e`; dark `#f2f1ec` `#f5c518` `#ff6258`) |
| `--c-inter`, `--c-wet` | intermediate, wet (reserved) |
| `--heat-1…5` | demand scale, teal → green → amber → orange → red |
| `--c-nodata` | missing data, never a scale colour |

The heat scale is never called temperature. Adjacent steps differ in lightness as well as hue, and every value is also
printed as a number.

## Typography

**IBM Plex Sans** (variable 400–600, Latin, Latin-ext and **Greek** subsets) for everything. **Barlow Condensed 700**
for the wordmark, the `TYRES.` H1, the Race Desk switcher, the band slogan and the sidebar title. Both are SIL OFL and
self-hosted. No monospace except the embed dialog's code box.

| Role | Settings |
|---|---|
| H1 `TYRES.` | Barlow 700, `clamp(64px, 10vw, 150px)`, line-height .84, signal dot |
| Race name (hero) | Plex 400, 20 px → 30 px ≥ 1024 px, tracking −.02em |
| Wordmark | Barlow 700, 28 px (25.6 / 23.2 px on smaller screens), tracking −.035em |
| Race Desk switcher | Barlow 700, 15 px, tracking .06em |
| Kicker, panel title, field label | Plex 600, 11–12 px, uppercase, tracking .12em. Uppercase is used only for these and compound names |
| Tabs, buttons | Plex 400/600, sentence case |
| Figures | Plex 600, tabular numerals, `clamp(1.25rem, 1rem + .6vw, 1.625rem)` |
| Body, units, captions | Plex 400, 13–16 px; units and notes in `--c-text-2` |

Greek uses a decimal comma (`5,543 km`). Product names (`TYRES`, `THE GRID`…) are set with `lang="en"`.

## Geometry, rules, focus

- **Container** `--shell-max` 1476 px with `--gutter` 48 px, then 32 px ≤ 1199 px, 22 px ≤ 767 px and 17 px ≤ 359 px.
  The masthead, hero, band, scope row, stage, sponsors and colophon share it, so their left edges line up at every width.
- **Rules** are 1 px for structure; **2 px ink** opens a panel (`.section-title`); **3 px signal** marks current state
  (tabs, switcher, archive, selected compound).
- **No boxes.** Panels, compounds, corner readouts and sub-view chips are ruled rows, not bordered cards. Radius is 0 for
  panels and 2 px for the few controls that keep an outline; no shadows.
- **Focus** `outline: 2px solid var(--c-accent); outline-offset: 5px` (2 px on the switcher, −4 px inside scrollers and
  the tab strip, −5 px on the mobile menu rows, `--c-signal-ink` on the band). Targets are ≥ 44 px (menu rows 52 px).
- **Nav links** show a 2 px signal stub under the current link; hover draws it full width.

## Components

- **Scope row.** Underlined selects (no box; 1.5 px ink bottom border, signal when focused), a 28 px outlined square for
  previous/next inside a 44 px target whose label is spoken, and a quiet text action for Ενσωμάτωση.
- **Key figures.** `dl` of ruled cells: label (11 px tracked), figure, unit, note. Missing = `Δεν δόθηκε` in `--c-text-2`,
  never `0`.
- **Tabs (`.mode`).** Underlined below the label; selected = `--c-text`, weight 600, 3 px signal bar. `aria-pressed` buttons.
- **Sub-views (`.chip`).** Quiet text toggles; selected = `--c-accent-muted` wash. A different shape from the tabs.
- **Corner readout.** 2 × 2 ruled rows with a 3 px heat-colour stripe, the corner name, and the derived value. Below it
  the heat legend and the derived note (`STRINGS.el.derived`).
- **Compounds.** Rows: sidewall disc (the tyre-sidewall ring in the compound colour), role name in compound-text colour,
  C-number. Interactive in the Ελαστικά mode; selected = signal edge + wash.
- **Rating scale.** Five graduations in the heat colour for the value, the number printed (`4/5`); missing = empty scale.
- **Source strip.** Six ruled cells (source, publisher, published, retrieved, record, status). The status cell always
  carries the status label and its explanation.
- **Season strip, archive.** The season strip is a table of compound choices by round (`season.css`). The archive
  lists every preview in columns by season; the current race has a signal edge and `aria-current`.
- **Embed dialog (author tool).** Unboxed form, 2 px ink top rule, text radios, an ink primary button that turns signal on
  hover. Desktop only.
- **Derived label.** Anything computed by us carries `STRINGS.el.derived` ("Παράγωγη απεικόνιση με βάση τα χαρακτηριστικά
  πίστας της Pirelli…") and a method note.

## The bench (3D and drawings)

"Wind-tunnel model on a test bench": a graphite car with carbon aero surfaces so the only saturated colour is the tyre
data. Matte rubber (roughness .92), satin paint (.45), carbon (.35), brushed wheel rims. Warm key from front-left-high,
cool fill, strong rim, `RoomEnvironment` at low intensity, a baked contact shadow; no bloom or post-processing. The
bench is the charcoal scope with a faint 40 px measurement grid, 16 : 11 on desktop and 4 : 3 on phones. View tools
(reset, auto-rotate) are transparent 44 px squares ruled in paper, like the colophon's social icons. The SVG fallback
shows the same derived colours and geometry, and every fact in 3D also exists as HTML text.

## Motion

| Moment | Motion | Duration |
|---|---|---|
| Race change | A racing-red probe line sweeps the bench; panels dim to 25 % and back; ratings re-grow; figures count to the new value | 700 ms, `cubic-bezier(.2,.7,.1,1)` |
| Race Desk bar, tab and nav underline | `scaleX` from the left | 350 ms, `cubic-bezier(.22,.68,0,1.02)` |
| Mode change | Camera eases to the mode's framing | 450 ms |
| Opening | One camera settle when the 3D view first appears | 900 ms |
| Auto-rotate | Off by default; the play control starts it; pauses on interaction | user-controlled |

`prefers-reduced-motion: reduce` turns the sweep, the bars and underlines, the tab and sponsor transitions into instant
changes, and keeps auto-rotate off.

## Language

The page is Greek (`<html lang="el">`). English stays only for product names, the band slogan, F1 terms (C1–C5,
Hard/Medium/Soft, psi, camber, pit stop, FP2) and data values (Pirelli's race and circuit names are not translated).
All wording lives in `src/ui/strings.ts`: `STRINGS` (shared with the article embeds, Greek and English) and `PAGE`
(page-only Greek). Informal second person singular, sentence case, `«»` quotes, "γόμα" for compound, "ελαστικά" for tyres,
"πίστα" for circuit, "προεπισκόπηση" for preview.

## Article embeds and images

Embeds (`src/ui/embed.ts`, `src/styles/embed.css`) share the tokens and read as the articles do: a 2 px ink top rule, a
tracked kicker, ruled rows of fixed height that never wrap, and a footer with provenance, status and the TYRES link.
They are script-free (the 3D embed excepted). The social card (`src/ui/ogCard.ts`) is the Race Desk title on paper: the
kicker and TYRES mark on the rule, the race, the compound discs, the circuit outline in ink and the signal band. The
generic card (no race) carries no compound numbers and no race facts.

## Mobile

- Below 992 px the nav links become a native `popover` panel of 52 px rows; Esc and light-dismiss work without script.
- Below 768 px the switcher wraps onto its own sub-rule under the kicker and spreads its four items across the width.
- The tab strip scrolls sideways; the sub-view chips scroll sideways to the screen edge; the sidebar stacks under the
  stage. The embed tool is hidden.
- The countdown shows fully at 768–991 px and ≥ 1200 px, time only at 576–767 px, and is hidden below that.

## Keeping parity

The shell is copied, not imported (the apps are separate deployments). When f1stories.gr changes its nav, footer,
Race Desk switcher or next-race calendar, update `index.html`, `src/ui/countdown.ts` and `src/styles/shell.css` to match.
`npm run site:check` (network, `scripts/check-site.ts`) fetches the site's `partials/nav.html`, `partials/footer.html`,
`standings/index.html` (the Race Desk switcher), `scripts/shared-nav.js` (the calendar), `docs/design-tokens.json` and the
logo, and reports every difference from our copies; it exits 1 on drift. It is not part of `npm run check` or CI, because
it needs the network and depends on another repository's current state. `tests/e2e/shell.spec.ts` pins the nav order, the single current item, the switcher, the 44 px targets, the masthead
layering and the colophon.
