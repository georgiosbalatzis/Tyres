/**
 * ParsedArticle + preview signals → a *partial* race record for data/generated/.
 * Only facts actually present in the page are filled. Everything that Pirelli publishes solely in the
 * infographic is null and listed in `missing`, and the record is marked needs-review.
 */
import { SCHEMA_VERSION } from '../../src/domain/schema.ts';
import {
  type CircuitRef,
  circuitFromText,
  circuitLengthFromText,
  compoundsFromText,
  type ParsedArticle,
  type PreviewSignals,
} from './parse.ts';

export const INFOGRAPHIC_ONLY = [
  'race dates',
  'laps',
  'race distance',
  'lap record',
  'pit-stop loss',
  'characteristic ratings',
  'starting pressures',
  'camber limits',
] as const;

export function normalize(
  a: ParsedArticle,
  sig: PreviewSignals,
  circuits: CircuitRef[],
  retrievedAt: string,
) {
  const circuit = circuitFromText(a, circuits);
  const lengthKm = circuitLengthFromText(a.paragraphs);
  const compounds = compoundsFromText(a.paragraphs);
  const missing: string[] = [...INFOGRAPHIC_ONLY];
  if (!circuit) missing.unshift('circuit identity');
  if (lengthKm == null) missing.push('circuit length');
  if (!compounds) missing.push('compounds');

  const textProv = { method: 'article-text' as const, sourceUrl: a.url, retrievedAt };
  const record = {
    schemaVersion: SCHEMA_VERSION,
    id: `${sig.season}-${sig.eventCode}`,
    season: sig.season,
    round: sig.round,
    slug: circuit?.trackId ?? sig.eventCode,
    eventCode: sig.eventCode,
    race: {
      name: sig.grandPrix,
      officialName: null,
      location: circuit?.location ?? null,
      countryCode: circuit?.countryCode ?? null,
      startDate: null,
      endDate: null,
    },
    circuit: {
      trackId: circuit?.trackId ?? null,
      name: circuit?.name ?? null,
      lengthKm,
      laps: null,
      raceDistanceKm: null,
      lapRecord: null,
      pitStopLoss: null,
    },
    compounds,
    characteristics: {
      traction: null,
      braking: null,
      tyreStress: null,
      asphaltAbrasion: null,
      asphaltGrip: null,
      lateral: null,
      trackEvolution: null,
    },
    setup: { minimumStartingPressurePsi: null, expectedRunningPressurePsi: null, camberLimitDeg: null },
    source: {
      publisher: 'Pirelli' as const,
      articleTitle: a.headline ?? `${sig.season} ${sig.grandPrix} preview`,
      articleUrl: a.url,
      publishedAt: a.datePublished,
      previewAssetUrl: sig.infographicUrl,
      retrievedAt,
    },
    provenance: {
      event: {
        method: 'media-filename' as const,
        sourceUrl: sig.infographicUrl,
        retrievedAt,
        note: 'Season and Grand Prix from article JSON-LD keywords; round and event code from the infographic file name.',
      },
      ...(circuit || lengthKm != null ? { circuit: textProv } : {}),
      ...(compounds ? { compounds: textProv } : {}),
    },
    validation: {
      status: 'needs-review' as const,
      notes: [`Automatically ingested. Not yet entered from the official graphic: ${missing.join(', ')}.`],
    },
  };
  return { record, missing };
}
