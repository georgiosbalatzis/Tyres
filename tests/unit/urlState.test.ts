import { describe, expect, it } from 'vitest';
import type { Manifest } from '../../src/domain/schema.ts';
import { parseLocation, racePath, resolveRequest } from '../../src/domain/urlState.ts';
import { summary } from '../fixtures/races.ts';

const BASE = '/Tyres/';
const manifest: Manifest = {
  schemaVersion: 1,
  generatedAt: '2026-09-30T00:00:00Z',
  latest: '2026-bh',
  years: [
    {
      year: 2026,
      races: [
        summary({ id: '2026-bh', slug: 'sepang', publishedAt: '2026-09-29T10:00:00Z' }),
        summary({ id: '2026-az', slug: 'baku', publishedAt: '2026-09-21T10:00:00Z' }),
      ],
    },
    {
      year: 2025,
      races: [summary({ id: '2025-sg', slug: 'marina-bay', publishedAt: '2025-09-29T10:00:00Z' })],
    },
  ],
};
const latest = manifest.years[0]!.races[0]!;

describe('parseLocation', () => {
  it('reads the static path under the GitHub Pages base', () => {
    expect(parseLocation('/Tyres/2026/baku/', '', BASE)).toEqual({ year: 2026, race: 'baku' });
  });

  it('lets the query override the path', () => {
    expect(parseLocation('/Tyres/2026/baku/', '?year=2025&race=marina-bay', BASE)).toEqual({
      year: 2025,
      race: 'marina-bay',
    });
  });

  it('normalises case and ignores malformed tokens', () => {
    expect(parseLocation('/Tyres/', '?year=2026&race=BAKU', BASE)).toEqual({ year: 2026, race: 'baku' });
    expect(parseLocation('/Tyres/', '?year=20x6&race=<script>', BASE)).toEqual({ year: null, race: null });
  });

  it('treats the site root as "no request"', () => {
    expect(parseLocation('/Tyres/', '', BASE)).toEqual({ year: null, race: null });
    expect(parseLocation('/Tyres/index.html', '', BASE)).toEqual({ year: null, race: null });
  });

  it('works with a root base in development', () => {
    expect(parseLocation('/2026/sepang/', '', '/')).toEqual({ year: 2026, race: 'sepang' });
  });
});

describe('resolveRequest', () => {
  it('returns latest without a notice for an empty request', () => {
    expect(resolveRequest(manifest, { year: null, race: null }, latest)).toEqual({
      race: latest,
      notice: null,
    });
  });

  it('finds races by slug or id', () => {
    expect(resolveRequest(manifest, { year: 2026, race: 'baku' }, latest).race?.id).toBe('2026-az');
    expect(resolveRequest(manifest, { year: 2026, race: 'az' }, latest).race?.id).toBe('2026-az');
  });

  it('falls back to latest with a notice for an unknown race', () => {
    const r = resolveRequest(manifest, { year: 2026, race: 'atlantis' }, latest);
    expect(r.race?.id).toBe('2026-bh');
    expect(r.notice).toMatch(/atlantis/);
  });

  it('falls back to latest with a notice for an unknown year', () => {
    const r = resolveRequest(manifest, { year: 1999, race: 'monza' }, latest);
    expect(r.race?.id).toBe('2026-bh');
    expect(r.notice).toMatch(/1999/);
  });

  it('selects the latest preview of a requested year when no race is given', () => {
    expect(resolveRequest(manifest, { year: 2025, race: null }, latest).race?.id).toBe('2025-sg');
  });
});

describe('racePath', () => {
  it('builds real static paths under the base', () => {
    expect(racePath(BASE, { season: 2026, slug: 'sepang' })).toBe('/Tyres/2026/sepang/');
  });
});
