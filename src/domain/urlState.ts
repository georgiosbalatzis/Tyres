import type { Manifest, ManifestRace } from './schema.ts';
import { findRace, pickLatest } from './selection.ts';

export type Requested = { year: number | null; race: string | null };

const YEAR = /^\d{4}$/;
const SLUG = /^[a-z0-9-]{1,40}$/;

/**
 * Reads the requested race from the URL. Query (?year=&race=) wins over the static path (/{year}/{slug}/).
 * Only well-formed tokens are returned; anything else is treated as absent.
 */
export function parseLocation(pathname: string, search: string, base: string): Requested {
  const params = new URLSearchParams(search);
  const qYear = params.get('year');
  const qRace = params.get('race')?.toLowerCase() ?? null;

  const rel = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '');
  const [pYear, pRace] = rel.toLowerCase().split('/').filter(Boolean);

  const year = qYear ?? pYear ?? null;
  const race = qRace ?? (qYear ? null : (pRace ?? null));
  return {
    year: year && YEAR.test(year) ? Number(year) : null,
    race: race && SLUG.test(race) ? race : null,
  };
}

export type Resolution = { race: ManifestRace | null; notice: string | null };

/** Resolves a request against the manifest; anything unknown falls back to `latest` with an explanatory notice. */
export function resolveRequest(manifest: Manifest, req: Requested, latest: ManifestRace | null): Resolution {
  if (req.year == null && req.race == null) return { race: latest, notice: null };
  if (req.year != null && req.race != null) {
    const hit = findRace(manifest, req.year, req.race);
    if (hit) return { race: hit, notice: null };
    const hasYear = manifest.years.some((y) => y.year === req.year);
    return {
      race: latest,
      notice: hasYear
        ? `No preview for “${req.race}” in ${req.year}. Showing the latest preview instead.`
        : `No previews for ${req.year} yet. Showing the latest preview instead.`,
    };
  }
  if (req.year != null) {
    const inYear = pickLatest(manifest.years.find((y) => y.year === req.year)?.races ?? []);
    if (inYear) return { race: inYear, notice: null };
    return { race: latest, notice: `No previews for ${req.year} yet. Showing the latest preview instead.` };
  }
  return { race: latest, notice: 'That link is missing a season. Showing the latest preview instead.' };
}

/** Canonical path for a race; these are real prerendered files on GitHub Pages. */
export function racePath(base: string, race: Pick<ManifestRace, 'season' | 'slug'>): string {
  return `${base}${race.season}/${race.slug}/`;
}

/* ------------------------------------------------------------------ article embeds */

export const EMBED_LANGS = ['el', 'en'] as const;
export type EmbedLang = (typeof EMBED_LANGS)[number];
export const EMBED_PANELS = ['summary', 'compounds', 'demands', 'car', 'setup', 'circuit'] as const;
export type EmbedPanel = (typeof EMBED_PANELS)[number];

/** Script-free embed page for f1stories.gr articles: /embed/{lang}/{season}/{slug}/{panel}/ */
export function embedPath(
  base: string,
  lang: EmbedLang,
  race: Pick<ManifestRace, 'season' | 'slug'>,
  panel: EmbedPanel,
) {
  return `${base}embed/${lang}/${race.season}/${race.slug}/${panel}/`;
}
