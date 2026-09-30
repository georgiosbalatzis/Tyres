import type { Manifest, ManifestRace } from './schema.ts';

/**
 * "Latest" = the most recent Pirelli preview publication in the publishable dataset.
 * Not the nearest race date, not the highest round.
 *
 * Deterministic ordering, most recent first:
 *   1. publishedAt (records without it sort after all records that have it)
 *   2. season
 *   3. round
 *   4. startDate
 *   5. id (ascending, final tiebreak so equal inputs always produce the same answer)
 */
export function compareLatest(a: ManifestRace, b: ManifestRace): number {
  const pa = a.publishedAt ? Date.parse(a.publishedAt) : Number.NEGATIVE_INFINITY;
  const pb = b.publishedAt ? Date.parse(b.publishedAt) : Number.NEGATIVE_INFINITY;
  if (pa !== pb) return pb - pa > 0 ? 1 : -1;
  if (a.season !== b.season) return b.season - a.season;
  const ra = a.round ?? -1;
  const rb = b.round ?? -1;
  if (ra !== rb) return rb - ra;
  const da = a.startDate ?? '';
  const db = b.startDate ?? '';
  if (da !== db) return da < db ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function pickLatest(races: readonly ManifestRace[]): ManifestRace | null {
  return races.length ? [...races].sort(compareLatest)[0]! : null;
}

export function allRaces(manifest: Manifest): ManifestRace[] {
  return manifest.years.flatMap((y) => y.races);
}

export function findRace(manifest: Manifest, year: number, slugOrId: string): ManifestRace | null {
  const races = manifest.years.find((y) => y.year === year)?.races ?? [];
  const key = slugOrId.toLowerCase();
  return races.find((r) => r.slug === key || r.id === key || r.id === `${year}-${key}`) ?? null;
}

/** Races of a season in calendar order (round, then start date, then id). */
export function racesInYear(manifest: Manifest, year: number): ManifestRace[] {
  const races = manifest.years.find((y) => y.year === year)?.races ?? [];
  return [...races].sort(
    (a, b) =>
      (a.round ?? 99) - (b.round ?? 99) ||
      (a.startDate ?? '').localeCompare(b.startDate ?? '') ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Switching season: keep the same circuit if that season visited it, otherwise
 * go to that season's latest-published preview.
 */
export function raceForYearChange(
  manifest: Manifest,
  year: number,
  current: ManifestRace | null,
): ManifestRace | null {
  const races = racesInYear(manifest, year);
  if (!races.length) return null;
  const same = current ? races.find((r) => r.slug === current.slug) : undefined;
  return same ?? pickLatest(races);
}

/** Previous/next in a single chronological list across seasons. */
export function neighbours(
  manifest: Manifest,
  current: ManifestRace,
): { prev: ManifestRace | null; next: ManifestRace | null } {
  const ordered = [...manifest.years]
    .sort((a, b) => a.year - b.year)
    .flatMap((y) => racesInYear(manifest, y.year));
  const i = ordered.findIndex((r) => r.id === current.id);
  return {
    prev: i > 0 ? ordered[i - 1]! : null,
    next: i >= 0 && i < ordered.length - 1 ? ordered[i + 1]! : null,
  };
}
