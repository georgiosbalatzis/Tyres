# Data pipeline

## Layers and merge order

```
data/generated/{year}/{id}.json   written only by scripts/update-pirelli.ts
        │  validate (schema, partial allowed)
        ▼
data/overrides/{year}/{id}.json   written only by humans (or a reviewed transcription PR)
        │  deep-merge: override wins field-by-field; null in an override is an explicit "not published"
        ▼
validate (strict ranges, cross-field checks)
        ▼
public/data/races/{id}.json + public/data/manifest.json   (build artefact, git-ignored)
```

- `manifest.json` is the season index: one summary per published race (id, slug,
  round, name, dates, status) plus its `compounds`, so season views (the compound
  strip) need no per-race fetch. It is built from the same validated records.
- A record may exist **only** in overrides (e.g. a race discovered before the
  automation existed). It must then carry its own `source`.
- Automation never writes to `data/overrides/`.
- A record that fails validation is **excluded** and reported; the build
  continues with the rest. The build fails only if **zero** races are publishable
  or the manifest cannot be written.
- `validation.status` is taken from the override if present, else from the
  generated record. Only a human sets `verified`.

### Provenance

Each record has a top-level `source` (the article) and a `provenance` map with
one entry per field group (`event`, `circuit`, `compounds`, `characteristics`,
`setup`) describing `{ method, sourceUrl, retrievedAt, note? }`, where `method`
is one of `article-jsonld`, `article-text`, `media-filename`,
`infographic-transcription`, `manual`.

## IDs, slugs, and the latest race

- `id` = `{season}-{eventCode}` from the infographic filename (`2026-bh`), stable
  and derived from the source.
- `slug` = the circuit's track id (`sepang`), used in URLs. Unique per season;
  a collision marks the record `needs-review` until an override sets `slug`.
- **Latest** = publishable race with the greatest `source.publishedAt`.
  Fallbacks, in order, when timestamps are missing: `season` desc → `round`
  desc → `race.startDate` desc → `id` asc (deterministic tiebreak). See
  `src/domain/selection.ts` and its tests.

## Ingestion: `npm run data:update`

`scripts/update-pirelli.ts`:

1. **Discover** — conditional GET of `press.pirelli.com/sitemap.xml`
   (`If-None-Match` / `If-Modified-Since`, cached in `.cache/pirelli/`). Keep
   English article URLs with `lastmod` ≥ `--since` (default: 1 Jan of the
   current season) that are not already classified in
   `data/sources/pirelli-index.json`.
2. **Fetch** — sequential, `Crawl-delay` respected (≥ 5 s), identifying
   User-Agent, 3 retries with exponential backoff on 429/5xx, 20 s timeout,
   hard cap of `--max` pages per run (default 40).
3. **Parse** (`scripts/pirelli/parse.ts`, pure) — JSON-LD, media kit files,
   plain body text. Raw HTML never leaves this function.
4. **Classify** — the three-signal rule in DATA-SOURCES.md. Non-previews are
   remembered in the index so they are never fetched again.
5. **Normalise** (`scripts/pirelli/normalize.ts`, pure) — builds a partial record:
   season, round, event code, GP name, published time, circuit (via
   `data/reference/circuits.json`), text-derived length/compounds, and marks
   every infographic-only field `null` with status `needs-review`.
6. **Write** — `data/generated/{year}/{id}.json` (only if content changed) and
   `review-report.md` listing missing fields per race.

Then `npm run data:build` merges, validates and writes the publishable dataset.

### Image-only fields

- **A. Free core (default):** a human opens the infographic linked in
  `source.previewAssetUrl`, fills `data/overrides/{year}/{id}.json`, sets
  `validation.status` to `verified`, opens a PR.
- **B. Optional local tool:** any local vision-capable assistant may draft the
  override; drafts must use status `transcribed` and
  `provenance.*.method: "infographic-transcription"`.
  `node scripts/lib/transcribe.ts <file.json>` turns a compact transcription list into
  override files with consistent provenance (see the type at the top of that script).
- **Verification:** `npm run data:review` renders `review-sheet.html` with each official
  graphic beside the merged values; `npm run data:verify -- <id> --by "<name>"` is the only
  place `verified` is set.
- **C. Optional CI vision:** not implemented. If ever added it must be gated on a
  deliberately configured secret, write only `transcribed` drafts to a PR, and
  never to `main`.

A new race with only partial data still publishes: compounds and circuit length
from the text appear; everything else reads "Not provided" and the status badge
says the record is awaiting review.

## Automation

`.github/workflows/update-pirelli.yml` runs every 6 hours (and on demand):
update → build data → test. If `data/` changed it pushes branch
`data/pirelli-update` and opens/updates a PR. If the review report is non-empty
it is attached as an artefact and posted to a single tracking issue
(`data-review`). No paid services, no secrets beyond `GITHUB_TOKEN`.

## Tracks

`npm run track:import -- my-1999 sepang "Sepang International Circuit"`
downloads the upstream GeoJSON (MIT), projects lon/lat to local metres
(equirectangular about the centroid — error < 0.1 % at circuit scale),
simplifies with Ramer–Douglas–Peucker (1.5 m tolerance), rounds to 0.1 m and
writes `data/tracks/sepang.json`. `sectors` is always `null` unless a reliable
source is added. Map a new circuit in `data/reference/circuits.json`.
