import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildData, calendarRoundForWeekend } from '../../scripts/build-data.ts';
import { mergeRecord } from '../../scripts/lib/merge.ts';
import { normalize } from '../../scripts/pirelli/normalize.ts';
import {
  circuitLengthFromText,
  compoundsFromText,
  decodeEntities,
  parseArticle,
  previewSignals,
} from '../../scripts/pirelli/parse.ts';
import { isCandidateUrl, sitemapEntries } from '../../scripts/update-pirelli.ts';
import { parseWith, RaceRecord } from '../../src/domain/schema.ts';
import { compareLatest } from '../../src/domain/selection.ts';

const FIX = path.resolve(import.meta.dirname, '../fixtures/pirelli');
const load = (name: string) =>
  parseArticle(readFileSync(path.join(FIX, `${name}.html`), 'utf8'), `https://press.pirelli.com/${name}/`);
const circuits = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '../../data/reference/circuits.json'), 'utf8'),
).circuits;

describe('Pirelli article parser (fixtures from press.pirelli.com)', () => {
  it('reads JSON-LD, media kit and body text of the 2026 Sepang preview', () => {
    const a = load('bh26-preview');
    expect(a.headline).toBe('Sepang reopens its doors to Formula 1 after nine years');
    expect(a.datePublished).toBe('2026-09-29T10:36:03+02:00');
    expect(a.keywords).toContain('2026 Bahrain Grand Prix');
    expect(a.media.map((m) => m.filename)).toContain('16-bh26-preview-en.jpg');
    expect(a.paragraphs.join(' ')).not.toMatch(/Navigation text|boilerplate/);
  });

  it('classifies previews by content signals, not URL slugs', () => {
    expect(previewSignals(load('bh26-preview'))).toMatchObject({
      season: 2026,
      round: 16,
      eventCode: 'bh',
      grandPrix: 'Bahrain Grand Prix',
    });
    expect(previewSignals(load('az26-preview'))).toMatchObject({ season: 2026, round: 15, eventCode: 'az' });
    expect(previewSignals(load('bh23-preview'))).toMatchObject({ season: 2023, round: 1, eventCode: 'bh' });
    expect(previewSignals(load('az26-race'))).toBeNull(); // race report: same keywords, no preview infographic
  });

  it('accepts an infographic without the -en suffix (2026 Las Vegas)', () => {
    const a = {
      ...load('az26-preview'),
      keywords: ['Formula 1', '2026 Las Vegas Grand Prix'],
      media: [{ filename: '21-lv26-preview.jpg', url: 'https://example.test/21-lv26-preview.jpg' }],
    };
    expect(previewSignals(a)).toMatchObject({
      season: 2026,
      round: 21,
      eventCode: 'lv',
      grandPrix: 'Las Vegas Grand Prix',
    });
  });

  it('extracts compounds from both phrasings used by Pirelli', () => {
    expect(compoundsFromText(load('bh26-preview').paragraphs)?.map((c) => c.compound)).toEqual([
      'C2',
      'C3',
      'C4',
    ]);
    expect(compoundsFromText(load('az26-preview').paragraphs)?.map((c) => c.compound)).toEqual([
      'C3',
      'C4',
      'C5',
    ]);
  });

  it('returns null rather than guessing when prose is ambiguous', () => {
    expect(compoundsFromText(load('bh23-preview').paragraphs)).toBeNull();
    expect(
      compoundsFromText(['Last year the selection was the C1, C2 and C3; this year C1 and C2 again.']),
    ).toBeNull();
    expect(
      circuitLengthFromText(['The circuit is 5.412 km long.', 'The new track is 5.300 km long.']),
    ).toBeNull();
  });

  it('decodes entities without producing markup', () => {
    expect(decodeEntities('Mo&#235;t &amp; Chandon &lt;b&gt;')).toBe('Moët & Chandon <b>');
  });

  it('normalises into a schema-valid partial record that invents nothing', () => {
    const a = load('bh26-preview');
    const { record, missing } = normalize(a, previewSignals(a)!, circuits, '2026-09-30T00:00:00Z');
    const parsed = parseWith(RaceRecord, record);
    expect(parsed.ok).toBe(true);
    expect(record).toMatchObject({ id: '2026-bh', slug: 'sepang', validation: { status: 'needs-review' } });
    expect(record.circuit.lengthKm).toBe(5.543);
    expect(record.circuit.laps).toBeNull();
    expect(Object.values(record.characteristics).every((v) => v === null)).toBe(true);
    expect(missing).toContain('characteristic ratings');
  });
});

describe('sitemap discovery', () => {
  it('parses entries and keeps English article URLs only', () => {
    const xml = `<urlset><url><loc>https://press.pirelli.com/a-preview/</loc><lastmod>2026-09-29</lastmod></url>
      <url><loc>https://press.pirelli.com/it/un-articolo/</loc><lastmod>2026-09-29</lastmod></url></urlset>`;
    const entries = sitemapEntries(xml);
    expect(entries).toHaveLength(2);
    expect(entries.filter((e) => isCandidateUrl(e.url)).map((e) => e.url)).toEqual([
      'https://press.pirelli.com/a-preview/',
    ]);
  });
});

describe('override merge', () => {
  it('lets overrides win, keeps generated values that are not overridden, and replaces arrays', () => {
    const { value, conflicts } = mergeRecord(
      { circuit: { lengthKm: 5.5, laps: null }, compounds: [{ compound: 'C1' }, { compound: 'C2' }] },
      { circuit: { laps: 56 }, compounds: [{ compound: 'C3' }] },
    );
    expect(value).toEqual({ circuit: { lengthKm: 5.5, laps: 56 }, compounds: [{ compound: 'C3' }] });
    expect(conflicts.map((c) => c.path)).toEqual(['compounds']);
  });

  it('treats an explicit null override as "not published"', () => {
    expect(
      mergeRecord({ circuit: { lapRecord: { time: '1:00.000' } } }, { circuit: { lapRecord: null } }).value,
    ).toEqual({
      circuit: { lapRecord: null },
    });
  });

  it('never reports bookkeeping differences as conflicts', () => {
    const { conflicts } = mergeRecord(
      { source: { retrievedAt: 'a' }, validation: { status: 'needs-review' } },
      { source: { retrievedAt: 'b' }, validation: { status: 'verified' } },
    );
    expect(conflicts).toEqual([]);
  });
});

describe('publishable dataset', () => {
  it('validates every committed record and selects the latest publication', async () => {
    const { manifest, problems, records } = await buildData({ write: false });
    expect(problems).toEqual([]);
    expect(records.length).toBeGreaterThanOrEqual(6);
    const latest = manifest.years.flatMap((year) => year.races).find((race) => race.id === manifest.latest);
    expect(latest).toBeDefined();
    expect(
      manifest.years.flatMap((year) => year.races).every((race) => compareLatest(latest!, race) <= 0),
    ).toBe(true);
    expect(records.every((r) => r.validation.status !== 'fixture')).toBe(true);
  });
});

describe('override audit', () => {
  it('reports a null override that hides a value Pirelli has since published', () => {
    const { conflicts } = mergeRecord({ circuit: { laps: 56 } }, { circuit: { laps: null } });
    expect(conflicts.map((c) => c.path)).toEqual(['circuit.laps']);
  });
});

describe('calendar round reconciliation', () => {
  it('resolves official round numbers from weekend dates, tolerating UTC midnight shifts', () => {
    expect(calendarRoundForWeekend(2026, ['2026-11-06', '2026-11-07', '2026-11-08'])).toBe(20);
    // Las Vegas local race day is Sat 2026-11-21 while UTC start is Sun 2026-11-22T04:00Z.
    expect(calendarRoundForWeekend(2026, ['2026-11-19', '2026-11-20', '2026-11-21'])).toBe(21);
    expect(calendarRoundForWeekend(2026, ['2026-11-27', '2026-11-28', '2026-11-29'])).toBe(22);
    expect(calendarRoundForWeekend(2026, ['2026-12-04', '2026-12-05', '2026-12-06'])).toBe(23);
    expect(calendarRoundForWeekend(2025, ['2025-12-05', '2025-12-06', '2025-12-07'])).toBeNull();
    expect(calendarRoundForWeekend(2026, undefined)).toBeNull();
  });
});
