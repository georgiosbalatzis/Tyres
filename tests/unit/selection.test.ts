import { describe, expect, it } from 'vitest';
import type { Manifest } from '../../src/domain/schema.ts';
import { neighbours, pickLatest, raceForYearChange, racesInYear } from '../../src/domain/selection.ts';
import { summary } from '../fixtures/races.ts';

describe('pickLatest', () => {
  it('chooses the most recent publication, not the highest round or nearest date', () => {
    const races = [
      summary({
        id: '2026-it',
        round: 13,
        publishedAt: '2026-09-01T14:36:31+02:00',
        startDate: '2026-09-04',
      }),
      // Higher round and later race date, but published earlier:
      summary({
        id: '2026-zz',
        round: 20,
        publishedAt: '2026-08-01T10:00:00+02:00',
        startDate: '2026-11-01',
      }),
      summary({
        id: '2026-bh',
        round: 16,
        publishedAt: '2026-09-29T10:36:03+02:00',
        startDate: '2026-10-02',
      }),
    ];
    expect(pickLatest(races)?.id).toBe('2026-bh');
  });

  it('compares instants, not strings, across timezones', () => {
    const races = [
      summary({ id: '2026-a', publishedAt: '2026-09-29T10:00:00+02:00' }), // 08:00Z
      summary({ id: '2026-b', publishedAt: '2026-09-29T09:00:00Z' }), // 09:00Z
    ];
    expect(pickLatest(races)?.id).toBe('2026-b');
  });

  it('falls back to season, round, start date, then id when timestamps are missing', () => {
    expect(pickLatest([summary({ id: '2025-x', round: 24 }), summary({ id: '2026-y', round: 1 })])?.id).toBe(
      '2026-y',
    );
    expect(pickLatest([summary({ id: '2026-a', round: 3 }), summary({ id: '2026-b', round: 5 })])?.id).toBe(
      '2026-b',
    );
    expect(pickLatest([summary({ id: '2026-b' }), summary({ id: '2026-a' })])?.id).toBe('2026-a');
  });

  it('prefers any timestamped record over records without one', () => {
    const races = [
      summary({ id: '2027-new', round: 1 }),
      summary({ id: '2026-old', publishedAt: '2026-01-01T00:00:00Z' }),
    ];
    expect(pickLatest(races)?.id).toBe('2026-old');
  });

  it('is deterministic regardless of input order', () => {
    const races = [
      summary({ id: '2026-a', publishedAt: '2026-05-01T00:00:00Z' }),
      summary({ id: '2026-b', publishedAt: '2026-05-01T00:00:00Z' }),
    ];
    expect(pickLatest(races)?.id).toBe(pickLatest([...races].reverse())?.id);
  });

  it('returns null for an empty dataset', () => {
    expect(pickLatest([])).toBeNull();
  });
});

const manifest: Manifest = {
  schemaVersion: 1,
  generatedAt: '2026-09-30T00:00:00Z',
  latest: '2026-bh',
  years: [
    {
      year: 2026,
      races: [
        summary({ id: '2026-bh', slug: 'sepang', round: 16, publishedAt: '2026-09-29T10:00:00Z' }),
        summary({ id: '2026-it', slug: 'monza', round: 13, publishedAt: '2026-09-01T10:00:00Z' }),
      ],
    },
    {
      year: 2025,
      races: [
        summary({ id: '2025-it', slug: 'monza', round: 16, publishedAt: '2025-09-01T10:00:00Z' }),
        summary({ id: '2025-ae', slug: 'yas-marina', round: 24, publishedAt: '2025-12-02T10:00:00Z' }),
      ],
    },
  ],
};

describe('year switching', () => {
  it('keeps the same circuit when the other season visited it', () => {
    expect(raceForYearChange(manifest, 2025, manifest.years[0]!.races[1]!)?.id).toBe('2025-it');
  });

  it('otherwise selects that season’s latest preview', () => {
    expect(raceForYearChange(manifest, 2025, manifest.years[0]!.races[0]!)?.id).toBe('2025-ae');
  });

  it('returns null for a season without data', () => {
    expect(raceForYearChange(manifest, 1999, null)).toBeNull();
  });

  it('orders races by round within a season', () => {
    expect(racesInYear(manifest, 2026).map((r) => r.id)).toEqual(['2026-it', '2026-bh']);
  });

  it('walks previous/next chronologically across seasons', () => {
    const it26 = manifest.years[0]!.races[1]!;
    expect(neighbours(manifest, it26).prev?.id).toBe('2025-ae');
    expect(neighbours(manifest, it26).next?.id).toBe('2026-bh');
    expect(neighbours(manifest, manifest.years[0]!.races[0]!).next).toBeNull();
  });
});
