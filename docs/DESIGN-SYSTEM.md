# Design system — F1 Stories editorial

Tyre Intelligence is a section of **f1stories.gr** and wears its identity: warm
paper and ink, IBM Plex Sans, the Barlow Condensed "F1 STORIES." wordmark, a
measured racing-red signal, and uppercase letter-spaced kickers. The shared
masthead (logo, wordmark, links back to the main site, theme toggle) and the
dark ink colophon match the main site. Reference: `styles/editorial.css` in
georgiosbalatzis/f1StoriesPage.

Inside that frame the page still reads as a technical sheet: a dark **test
bench** viewport with the circuit name set huge behind it, specification
columns divided by rules, and a **title block** carrying provenance (publisher,
publication time, status). Colour is reserved for data. The only brand hue is
`--c-signal`, used for marks: the wordmark dot, nav underline, kicker rule,
notice edge and race-change sweep.

## Themes

**Light is the default.** `public/theme.js` (blocking, same-origin, CSP-safe)
applies a saved `data-theme="dark"` before first paint and wires every
`[data-theme-toggle]`. It does not follow the OS setting, by design. The
viewport bench (`.canvas-host`) and the colophon use the charcoal tokens in
both themes. Always use role tokens, never raw hex, so a rule works in every
scope.

## Colour

| Token | Light | Dark / bench | Use |
|---|---|---|---|
| `--c-bg` | `#f2eee4` | `#1b1a19` | page background |
| `--c-surface` | `#e9e3d6` | `#242321` | nav, quiet panels |
| `--c-raised` | `#dfd9ca` | `#2e2c29` | selects, selected controls, notice |
| `--c-rule` | `#c8c8b9` | `#4b5146` | rules between groups |
| `--c-rule-strong` | ink | `#6d6861` | rules that open a section (masthead strip, section titles, title block) |
| `--c-control` | `#73766a` | `#7d8275` | control borders (≥ 3:1 on every surface) |
| `--c-text` | `#20251f` | `#eee8db` | primary text; also the selected-state border and the ink block of the active mode tab |
| `--c-text-2` | `#545b50` | `#b6bbac` | secondary text, units (≥ 4.5:1 on every surface) |
| `--c-accent` | `#a82e1c` | `#ff775f` | focus ring, hovered links (readable signal red) |

Brand constants (same in both themes): `--c-ink #20251f`, `--c-paper #e9e3d6`, `--c-signal #ed4c32`.

### Semantic colours (data only)

| Token | Hex | Meaning |
|---|---|---|
| `--c-hard` | `#f2f1ec` | Hard compound |
| `--c-medium` | `#f5c518` | Medium compound |
| `--c-soft` | `#e5322d` | Soft compound |
| `--c-{hard,medium,soft}-text` | light `#20251f` `#7a5a00` `#b3261e` / dark `#f2f1ec` `#f5c518` `#ff6258` | Compound names set as text |
| `--c-inter` | `#3fae49` | Intermediate (reserved) |
| `--c-wet` | `#2f7fd0` | Wet (reserved) |
| Heat 1→5 | `#2f8f9d` `#7fb069` `#e9c46a` `#f08c3a` `#d9412b` | Demand scale (derived visualisation) |

The heat scale runs cool teal → green → amber → orange → red. It is **never**
labelled "temperature". Adjacent steps differ in lightness as well as hue so
the scale survives deuteranopia; every heat value is also printed as a number.

## Typography

**IBM Plex Sans** (variable `wght` 400–600) for everything, and **Barlow
Condensed 700** for the wordmark and the hero circuit name. Both are SIL OFL and
self-hosted.

| Role | Settings |
|---|---|
| Circuit name (hero, on the bench) | Barlow Condensed 700, `--fs-hero`, line-height 1 |
| Wordmark | Barlow Condensed 700, 1.75rem, tracking −0.035em, red full stop |
| Race title | Plex 600, `--fs-title`, line-height 1.05, tracking −0.025em |
| Kicker / section title / mode tab / compound name | Plex 600, .75rem, uppercase, tracking .13em. This is the only uppercase in the UI |
| Body | Plex 400, 1rem/1.5, max 72ch |
| Figures (specs) | Plex 600, tabular-nums, `--fs-figure` |
| Unit / caption | Plex 400–500, .8125rem, `--c-text-2` |

No monospace; tabular figures do the alignment work.

## Spacing, grid, rules

- Spacing scale (rem): 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4.
- Container: `min(1476px, 100%)` with `--gutter` side padding (16–48 px), as on f1stories.gr.
- Desktop ≥ 1180 px: three columns (identity/specs/compounds · viewport · demands), title block full width below.
- Tablet 760–1179 px: identity + specs side by side, then the viewport and other bands full width.
- Mobile < 760 px: single column. Nav links collapse into a native `popover` menu below 992 px.
- Rules are 1 px. Outer columns sit flush with the gutter; inner column edges get 1.5rem beside their rule.
- Radius: 0 for panels, 2 px for controls, 50 % for nav icon buttons and compound discs. No shadows.

## Surfaces

Flat paper, with a 3.5 % inline-SVG noise grain in light mode only (as on
f1stories.gr). The viewport is the charcoal bench with a faint 40 px
measurement grid. The colophon is an ink block with the wordmark and the
site's mission line.

## Data components

- **Rating scale:** five graduations on a baseline; filled segments up to the
  value use the heat colour for that value; the number is printed at the end
  (`4/5`). Missing = empty scale + "Not provided".
- **Spec figure:** value in figure style + unit in caption style + label above.
- **Compound disc:** a tyre-sidewall ring in the semantic colour with the
  C-number inside, and the race label (HARD/MEDIUM/SOFT) beside it.
- **Title block:** 2×3 grid of small cells (Publisher, Published, Retrieved,
  Status, Round, Source link) bordered with rules, like a drawing title block.
- **Derived label:** any visual computed by us carries the tag "Derived
  visualisation" and a link to the method note.

## Iconography

Few icons, drawn inline as 1.5 px strokes on a 20 px grid: chevrons
(prev/next), reset (circular arrow), play/pause (auto-rotate). No icon fonts,
no emoji.

## Motion

| Moment | Motion | Duration |
|---|---|---|
| Race change (hero) | A single vertical racing-red **probe line** sweeps across the viewport; as it passes, tyres re-tint, the circuit ribbon redraws, rating fills re-grow, figures tick to new values | 700 ms total, `cubic-bezier(.2,.7,.1,1)` |
| Mode change | Camera eases to the mode's framing | 450 ms |
| Circuit draw-on | Ribbon draws along its length once per race | 600 ms |
| Opening | One camera settle into the studio framing when the 3D view first appears | 900 ms |
| Auto-rotate | Off by default (calm page); play control starts it; pauses on interaction, resumes after 3 s | continuous, user-controllable |

`prefers-reduced-motion: reduce` → all of the above become instant cross-fades
(≤ 120 ms opacity), auto-rotate off, no probe sweep.

## 3D rendering aesthetic

"Wind-tunnel model on a test bench": a satin **graphite** livery with carbon
aero surfaces so the only saturated colour on the car is the tyre data. Matte
rubber (roughness 0.92), satin paint (0.45), carbon (0.35 + faint weave),
brushed metal wheel rims (metalness 0.9, roughness 0.35).
Lights: warm key from front-left-high, cool fill, strong rim from behind,
`RoomEnvironment` PMREM at low intensity for reflections, a baked radial
contact shadow under the car. No bloom, no post-processing.

## Mobile adaptations

- One WebGL canvas, 4:5 aspect, full bleed within gutters.
- Mode bar becomes a 4-button segmented control (44 px targets) under the
  viewport; submodes become a horizontally scrollable chip row — no labels
  are placed over the canvas.
- Tyre selection via a 2×2 corner grid of buttons (FL FR / RL RR), mirroring the car.
- Hero circuit name sits behind the car inside the bench, never over HTML text.
