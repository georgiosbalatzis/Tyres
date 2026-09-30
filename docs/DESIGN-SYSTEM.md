# Design system — "Drawing sheet"

The page is treated as an **engineering drawing sheet** for one race weekend:
a framed sheet with registration marks, a large working viewport, specification
columns, and a **title block** in the corner that carries provenance — publisher,
publication time, revision, status — the way a technical drawing carries its
issuer and revision. Colour is reserved for data: the chrome is neutral, and hue
appears only where it means something (tyre compounds, demand heat).

One bold element: the viewport with the circuit name set huge in condensed type
behind it. Everything else is quiet and exact.

## Colour

| Token | Hex | Use |
|---|---|---|
| `--c-carbon` | `#16181b` | page background (graphite, slightly cool — not `#111`) |
| `--c-gunmetal` | `#1e2226` | sheet/panel surfaces |
| `--c-steel` | `#2b3036` | raised controls, selected rows |
| `--c-rule` | `#3a4047` | rules, frame, registration marks |
| `--c-paper` | `#ebe7df` | primary text (warm drafting-paper white) |
| `--c-graphite` | `#959ca5` | secondary text, units (≥ 6.5:1 on carbon) |
| `--c-probe` | `#9ccbdc` | interactive accent: focus ring, active mode, selection (pale wind-tunnel blue) |

### Semantic colours (data only)

| Token | Hex | Meaning |
|---|---|---|
| `--c-hard` | `#f2f1ec` | Hard compound |
| `--c-medium` | `#f5c518` | Medium compound |
| `--c-soft` | `#e5322d` | Soft compound |
| `--c-inter` | `#3fae49` | Intermediate (reserved) |
| `--c-wet` | `#2f7fd0` | Wet (reserved) |
| Heat 1→5 | `#2f8f9d` `#7fb069` `#e9c46a` `#f08c3a` `#d9412b` | Demand scale (derived visualisation) |

The heat scale runs cool teal → green → amber → orange → red. It is **never**
labelled "temperature". Adjacent steps differ in lightness as well as hue so
the scale survives deuteranopia; every heat value is also printed as a number.

## Typography

One family: **Archivo** (variable: weight 100–900, width 62–125), OFL,
self-hosted.

| Role | Settings |
|---|---|
| Circuit name (hero) | wdth 62, wght 800, `clamp(3.5rem, 11vw, 11rem)`, line-height .82, tracking −0.02em |
| Race title | wdth 75, wght 700, 1.75–2.5rem |
| Section heading | wdth 100, wght 650, 1rem, sentence case |
| Body | wdth 100, wght 400, 1rem/1.5, max 68ch |
| Figures (specs) | wdth 87, wght 600, `font-variant-numeric: tabular-nums`, 1.5–2.25rem |
| Unit / caption | wdth 100, wght 450, .8125rem, `--c-graphite` |
| Mode tabs, compound names | wdth 75, wght 700, uppercase, tracking .06em — the **only** uppercase in the UI |

No monospace; tabular figures from Archivo do the alignment work. Scale ratio
≈ 1.25 (major third).

## Spacing, grid, rules

- Spacing scale (rem): 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6.
- Desktop ≥ 1180 px: 12-col grid. Left spec column 3 cols, viewport 6, right
  spec column 3. Bottom band: compounds 8 + title block 4.
- Tablet 760–1179 px: viewport full width; left + right columns sit side by side
  beneath it; bottom band stacks.
- Mobile < 760 px: single column, 16 px gutters. Order: header → race identity
  → viewport (4:5) → mode bar → selected-mode panel → specs → compounds →
  title block.
- Rules are 1 px `--c-rule`. The sheet frame has corner registration marks
  (L-shaped, 12 px). Rules only separate groups that differ in kind; rows
  inside a group are separated by space, not lines.
- Radius: 0 for sheet and panels, 2 px for controls, 999 px only for the
  compound disc. Hierarchy comes from rules and space, not shadows.

## Surfaces

Flat. The sheet (`--c-gunmetal`) sits on the carbon page with the frame rule
and registration marks. The viewport is carbon with a faint 40 px measurement
grid (4 % paper) to read as a test bench. No glass, no blur, no drop shadows.

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
| Race change (hero) | A single vertical **probe line** sweeps across the viewport; as it passes, tyres re-tint, the circuit ribbon redraws, rating fills re-grow, figures tick to new values | 700 ms total, `cubic-bezier(.2,.7,.1,1)` |
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
- Hero circuit name drops behind the viewport top edge instead of overlapping it.
