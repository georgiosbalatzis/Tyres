/**
 * Versioned data contract for race records, tracks and the manifest.
 * Shared by the build scripts (strict validation) and the browser (defensive validation).
 *
 * Conventions:
 * - Every factual field is nullable. `null` means "not published by the source" and renders as "Not provided".
 * - Ranges are plausibility guards against transcription/parsing errors, not physical limits.
 * - Compound identifiers are pattern-checked, not enumerated, so historical/future ranges (C0, C6, …) validate.
 */
import * as z from 'zod/mini';

export const SCHEMA_VERSION = 1;

const num = (min: number, max: number) => z.number().check(z.gte(min), z.lte(max));
const int = (min: number, max: number) => z.int().check(z.gte(min), z.lte(max));
const text = (max = 200) => z.string().check(z.minLength(1), z.maxLength(max));
const httpsUrl = z.url({ protocol: /^https$/ });
const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime({ offset: true });

export const Rating = z.nullable(int(1, 5));

export const DATA_STATUSES = ['verified', 'transcribed', 'needs-review', 'fixture'] as const;
export const PROVENANCE_METHODS = [
  'article-jsonld',
  'article-text',
  'media-filename',
  'infographic-transcription',
  'manual',
] as const;

const FrontRear = (min: number, max: number) =>
  z.object({ front: z.nullable(num(min, max)), rear: z.nullable(num(min, max)) });

const Provenance = z.object({
  method: z.enum(PROVENANCE_METHODS),
  sourceUrl: httpsUrl,
  retrievedAt: isoDateTime,
  note: z.optional(text(500)),
});

export const Compound = z.object({
  /** Weekend role. Known: hard | medium | soft. Pattern-checked for forward compatibility. */
  raceLabel: z.string().check(z.regex(/^[a-z][a-z-]{1,15}$/)),
  /** Pirelli compound identifier, e.g. C3. */
  compound: z.string().check(z.regex(/^C\d{1,2}$|^[A-Z][A-Z0-9-]{0,11}$/)),
});

export const Characteristics = z.object({
  traction: Rating,
  braking: Rating,
  tyreStress: Rating,
  asphaltAbrasion: Rating,
  asphaltGrip: Rating,
  lateral: Rating,
  trackEvolution: Rating,
  /** Present on 2025-format infographics only. */
  downforce: z.optional(Rating),
});

export const RaceRecord = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().check(z.regex(/^\d{4}-[a-z0-9-]{1,40}$/)),
  season: int(1950, 2100),
  round: z.nullable(int(1, 30)),
  slug: z.string().check(z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), z.maxLength(40)),
  eventCode: z.nullable(z.string().check(z.regex(/^[a-z]{2,3}$/))),
  race: z.object({
    name: text(),
    officialName: z.nullable(text()),
    location: z.nullable(text()),
    countryCode: z.nullable(z.string().check(z.regex(/^[A-Z]{2}$/))),
    startDate: z.nullable(isoDate),
    endDate: z.nullable(isoDate),
  }),
  circuit: z.object({
    trackId: z.nullable(z.string().check(z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))),
    name: z.nullable(text()),
    lengthKm: z.nullable(num(1, 10)),
    laps: z.nullable(int(1, 120)),
    raceDistanceKm: z.nullable(num(50, 450)),
    lapRecord: z.nullable(
      z.object({
        time: z.string().check(z.regex(/^\d:\d{2}\.\d{3}$/)),
        driver: text(80),
        year: int(1950, 2100),
      }),
    ),
    pitStopLoss: z.nullable(
      z.object({
        seconds: num(5, 60),
        kind: z.enum(['estimate', 'average', 'unspecified']),
      }),
    ),
  }),
  compounds: z.nullable(z.array(Compound).check(z.minLength(1), z.maxLength(6))),
  characteristics: Characteristics,
  setup: z.object({
    minimumStartingPressurePsi: z.nullable(FrontRear(10, 40)),
    expectedRunningPressurePsi: z.nullable(FrontRear(10, 40)),
    camberLimitDeg: z.nullable(FrontRear(-6, 0)),
  }),
  source: z.object({
    publisher: z.literal('Pirelli'),
    articleTitle: text(300),
    articleUrl: httpsUrl,
    publishedAt: z.nullable(isoDateTime),
    previewAssetUrl: z.nullable(httpsUrl),
    retrievedAt: isoDateTime,
  }),
  provenance: z.partialRecord(
    z.enum(['event', 'circuit', 'compounds', 'characteristics', 'setup']),
    Provenance,
  ),
  validation: z.object({
    status: z.enum(DATA_STATUSES),
    notes: z.array(text(500)),
  }),
});

export const TrackShape = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().check(z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  name: text(),
  /** Local planar coordinates in metres (x east, y north), centred on the layout. */
  points: z.array(z.tuple([z.number(), z.number()])).check(z.minLength(20), z.maxLength(5000)),
  lengthM: num(500, 10000),
  /** Sector boundaries are only set when a reliable source exists; otherwise null. */
  sectors: z.nullable(z.array(z.object({ index: int(1, 3), from: int(0, 5000), to: int(0, 5000) }))),
  source: z.object({
    name: text(),
    url: httpsUrl,
    license: text(80),
    upstreamId: text(80),
    note: z.optional(text(500)),
  }),
});

export const ManifestRace = z.object({
  id: RaceRecord.shape.id,
  slug: RaceRecord.shape.slug,
  season: RaceRecord.shape.season,
  round: RaceRecord.shape.round,
  name: text(),
  circuitName: z.nullable(text()),
  location: z.nullable(text()),
  startDate: z.nullable(isoDate),
  publishedAt: z.nullable(isoDateTime),
  status: z.enum(DATA_STATUSES),
});

export const Manifest = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  generatedAt: isoDateTime,
  latest: z.nullable(RaceRecord.shape.id),
  years: z.array(z.object({ year: int(1950, 2100), races: z.array(ManifestRace) })),
});

export type RaceRecord = z.infer<typeof RaceRecord>;
export type TrackShape = z.infer<typeof TrackShape>;
export type Manifest = z.infer<typeof Manifest>;
export type ManifestRace = z.infer<typeof ManifestRace>;
export type CharacteristicKey = keyof z.infer<typeof Characteristics>;
export type DataStatus = (typeof DATA_STATUSES)[number];

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseWith<T>(schema: z.ZodMiniType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: z.prettifyError(result.error) };
}

/** Cross-field checks that a per-field schema cannot express. Returns human-readable problems. */
export function crossCheck(record: RaceRecord): string[] {
  const problems: string[] = [];
  const { lengthKm, laps, raceDistanceKm } = record.circuit;
  if (lengthKm != null && laps != null && raceDistanceKm != null) {
    // Race distance is laps × length, minus the start-line offset; Pirelli figures agree within ~0.5 km.
    const diff = Math.abs(lengthKm * laps - raceDistanceKm);
    if (diff > 1.5)
      problems.push(`raceDistanceKm ${raceDistanceKm} differs from laps × length by ${diff.toFixed(2)} km`);
  }
  const { startDate, endDate } = record.race;
  if (startDate && endDate && startDate > endDate) problems.push('race.startDate is after race.endDate');
  if (!record.id.startsWith(`${record.season}-`)) problems.push('id must start with the season');
  const labels = record.compounds?.map((c) => c.raceLabel) ?? [];
  if (new Set(labels).size !== labels.length) problems.push('duplicate compound raceLabel');
  const ids = record.compounds?.map((c) => c.compound) ?? [];
  if (new Set(ids).size !== ids.length) problems.push('duplicate compound identifier');
  return problems;
}
