# Data sources

Every factual value shown on the site must trace back to one of the sources
below. Research was carried out on **2026-09-30**; re-check the structural notes
when a parser starts failing.

## 1. Pirelli press area — `press.pirelli.com` (primary)

| | |
|---|---|
| Purpose | Weekend-specific race previews: compounds, circuit facts, track characteristic ratings, setup limits |
| Platform | Presspage newsroom (server-rendered HTML) |
| robots.txt | `Allow: /`, `Crawl-delay: 5`, search query URLs disallowed |
| Licence / terms | Press material. Infographics carry "Copyright © Pirelli {year}. Rights free for media use." We still **do not** republish the artwork — we extract facts, rewrite them into our own interface and link back |
| Access | Build time only (GitHub Action / local script). Never from the visitor's browser |

### How previews are exposed

- **Discovery index:** `https://press.pirelli.com/sitemap.xml` (~7.6 MB, ~6 300
  English URLs) with a `<lastmod>` per article. This is the only reliable index:
  `https://press.pirelli.com/feed` answers `200 application/xml` with an **empty
  body** (checked 2026-09-30), and there is no public JSON API.
- **Slugs are not reliable.** Up to 2023 previews used
  `/{year}-{name}-grand-prix---preview/`. Since 2024 they use editorial titles
  (`/sepang-reopens-its-doors-to-formula-1-after-nine-years/`,
  `/the-heat-is-on-in-budapest/`). Discovery therefore classifies pages by
  content, not by URL.
- **Structured data per article:** one `<script type="application/ld+json">`
  schema.org `Article` with `headline`, `datePublished` (ISO 8601 with offset,
  e.g. `2026-09-29T10:36:03+02:00`), `dateModified`, and `keywords`, e.g.
  `["Pirelli","2026 Season","Formula 1","2026 Bahrain Grand Prix","news"]`.
  This has been stable from 2023 to 2026.
- **Media kit:** gallery anchors carry `data-filename`, `data-sourcepath`
  (`https://content.presspage.com/uploads/2363/{uuid}/{file}`), `data-title`.
  The preview infographic follows **`{round}-{event}{yy}-preview-en.jpg`**
  (e.g. `16-bh26-preview-en.jpg`: round 16, event code `bh`, 2026). Seen
  consistently 2023–2026. Older seasons also ship
  `trackcharacteristics-{event}{yy}-en.jpg` and
  `pressures-camber-preview-{event}{yy}-en.png`.

### Classification rule (all must hold)

1. JSON-LD `keywords` contains `Formula 1`.
2. JSON-LD `keywords` contains `{year} {Name} Grand Prix`.
3. The media kit contains a file matching `^\d{1,2}-[a-z]{2,3}\d{2}-preview-en\.(jpg|png)$`.

Race reports, qualifying and practice articles share (1) and (2) but not (3).
Compound-announcement articles (`tyre-compound-selections-for-…`) share none of
the media pattern.

### Text versus image-only

| Field | Where it lives | Automated? |
|---|---|---|
| Publication time | JSON-LD `datePublished` | Yes |
| Season, Grand Prix name | JSON-LD `keywords` | Yes |
| Round number, event code | Infographic filename | Yes |
| Circuit name | Article prose (usually) | Yes, matched against `data/reference/circuits.json` |
| Circuit length | Article prose (sometimes, e.g. "the circuit is 5.543 km long") | Yes, conservative regex |
| Compounds C1–C6 | Article prose (usually, e.g. "the C2, C3 and C4 compounds") | Yes, conservative regex |
| Laps, race distance, lap record, pit-stop loss | **Infographic only** | No — manual override |
| 1–5 characteristic ratings | **Infographic only** | No — manual override |
| Minimum starting pressures, camber limits | **Infographic only** | No — manual override |
| Event dates | Infographic header (2026 format); Pirelli calendar (no year) | Manual override |
| Per-tyre longitudinal/lateral energy colour map | Infographic only, qualitative | **Not captured** — too subjective to transcribe |

Layout differences between seasons (important for historical data):

- **2025 infographic:** eight ratings including **Downforce**; no pit-stop loss;
  no expected running pressure; no event dates in the header.
- **2026 infographic:** seven ratings (no Downforce); pit-stop loss labelled
  either "Estimate" or "Average"; minimum starting pressure **and** expected
  stabilised running pressure; event dates in the header.

The schema is therefore permissive: every field is nullable and extra ratings
(`downforce`) are optional.

## 2. Pirelli F1 calendar — `pirelli.com/tyres/en-ww/motorsport/car/formula-1/calendar`

| | |
|---|---|
| Purpose | Season index / cross-check of which events exist |
| Structure | Next.js page; events embedded as escaped JSON (`title`, `event_date` like `"26 Jun - 28 Jun"` without year, `text` = full sponsor GP name, `flag`, `description`) |
| robots.txt | Path allowed for `*` |
| Limitations | Only the current season; dates have no year; descriptions are generic evergreen prose, not weekend-specific; on 2026-09-30 it still omitted the rescheduled Bahrain GP at Sepang. |

**Relationship to previews:** the calendar is a planning index; the press
preview is the authoritative, weekend-specific source and wins on conflict. We
do not republish calendar descriptions (copyrighted prose).

## 3. Circuit geometry — `github.com/bacinger/f1-circuits`

| | |
|---|---|
| Purpose | Track centre-lines for the circuit visualisation |
| Licence | MIT, © 2019-2025 Tomislav Bacinger — full text in `data/tracks/LICENSE-f1-circuits.md` |
| Format | GeoJSON LineString, WGS84 lon/lat, one file per layout (`my-1999`, `az-2016`, `es-2026`, …) |
| Caveats | Upstream states the initial data came from a community Google My Maps layer. No per-point elevation, no sector boundaries, no guaranteed race direction or start/finish index. We therefore show **no sectors and no direction arrows**. |
| Import | `npm run track:import -- <upstream-id> <track-id>` projects to local metres and simplifies (see DATA-PIPELINE.md) |

Fallback if a layout is missing upstream: OpenStreetMap `highway=raceway` ways
(ODbL — requires attribution and share-alike for the derived database; keep
such files separate and note it in the track file's `source`).

## 4. Fonts

Archivo (variable, `wght` + `wdth` axes) by Omnibus-Type, SIL Open Font Licence
1.1, bundled locally via `@fontsource-variable/archivo`. No runtime font CDN.

## 5. What we deliberately do not use

- Pirelli / Formula 1 logos and the preview infographic artwork.
- Hot-linked Pirelli images.
- Formula1.com, FIA timing, or any paid API.
- Scraped prose beyond short factual extracts.

## Data status vocabulary

| Status | Meaning |
|---|---|
| `verified` | A human compared every published value with the official source |
| `transcribed` | Values were read from the official infographic (e.g. by an AI-assisted pass) and await human confirmation |
| `needs-review` | Automated ingestion found the article but some fields are missing or ambiguous |
| `fixture` | Development-only record. Never deployed (`build-data` rejects fixtures unless `--allow-fixtures`) |

As of 2026-09-30 the dataset holds 18 races: 2025 Singapore and Abu Dhabi, and every
2026 preview published so far (rounds 1–16; the April Bahrain and Saudi Arabian rounds
were not held, and the Bahrain GP runs as round 16 at Sepang). All were transcribed from
the official graphics and are marked `transcribed` until a person verifies them
(`npm run data:review`). Known source quirks, recorded in each record's notes:

- Monaco's media file is numbered `05-mc26`, the same as Canada's `05-ca26`; the record uses
  round 6 from the calendar order (`data:build` now warns about duplicate rounds).
- The Monaco header omits the month ("05-07/2026"); June comes from the Pirelli calendar.
- The Canada header gives 22–25 May, the calendar 22–24 May; the graphic is used.
- The Melbourne graphic has no expected running pressure.
