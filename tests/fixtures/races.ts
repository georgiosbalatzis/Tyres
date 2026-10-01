/**
 * DEVELOPMENT FIXTURE DATA — NOT OFFICIAL.
 * Clearly fictional races ("Fixture Alpha/Beta") used only by tests. Status is always "fixture",
 * and build-data refuses to publish fixtures.
 */
import type { ManifestRace, RaceRecord } from '../../src/domain/schema.ts';

export function fixtureRace(overrides: Partial<RaceRecord> = {}): RaceRecord {
  return {
    schemaVersion: 1,
    id: '2099-fa',
    season: 2099,
    round: 3,
    slug: 'fixture-alpha',
    eventCode: 'fa',
    race: {
      name: 'Fixture Alpha Grand Prix',
      officialName: null,
      location: 'Nowhere',
      countryCode: null,
      startDate: '2099-05-01',
      endDate: '2099-05-03',
    },
    circuit: {
      trackId: 'fixture-alpha',
      name: 'Fixture Alpha Ring',
      lengthKm: 5,
      laps: 60,
      raceDistanceKm: 300,
      lapRecord: null,
      pitStopLoss: { seconds: 20, kind: 'estimate' },
    },
    compounds: [
      { raceLabel: 'hard', compound: 'C1' },
      { raceLabel: 'medium', compound: 'C2' },
      { raceLabel: 'soft', compound: 'C3' },
    ],
    characteristics: {
      traction: 1,
      braking: 5,
      tyreStress: 3,
      asphaltAbrasion: null,
      asphaltGrip: 2,
      lateral: 4,
      trackEvolution: 3,
    },
    setup: {
      minimumStartingPressurePsi: { front: 24, rear: 22 },
      expectedRunningPressurePsi: null,
      camberLimitDeg: { front: -3, rear: -2 },
    },
    source: {
      publisher: 'Pirelli',
      articleTitle: 'Fixture article',
      articleUrl: 'https://press.pirelli.com/fixture/',
      publishedAt: '2099-04-28T10:00:00+02:00',
      previewAssetUrl: null,
      retrievedAt: '2099-04-29T00:00:00Z',
    },
    provenance: {},
    validation: { status: 'fixture', notes: ['Development fixture'] },
    ...overrides,
  };
}

export function summary(p: Partial<ManifestRace> & { id: string }): ManifestRace {
  return {
    slug: p.id.split('-').slice(1).join('-'),
    season: Number(p.id.slice(0, 4)),
    round: null,
    name: `${p.id} GP`,
    circuitName: null,
    location: null,
    startDate: null,
    publishedAt: null,
    status: 'fixture',
    compounds: null,
    ...p,
  };
}
