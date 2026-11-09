import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import circuits from '../../data/reference/circuits.json' with { type: 'json' };
import venues from '../../data/reference/weekend-venues.json' with { type: 'json' };
import { pathLength } from '../../scripts/import-track.ts';
import { parseWeather } from '../../scripts/lib/weekend-sources.ts';
import { normalize } from '../../scripts/pirelli/normalize.ts';
import { circuitFromText, type ParsedArticle } from '../../scripts/pirelli/parse.ts';
import { parseWith, type RaceRecord, TrackShape } from '../../src/domain/schema.ts';
import { findRace } from '../../src/domain/selection.ts';
import { Weekend } from '../../src/domain/weekend.ts';
import { circuitInfo } from '../../src/ui/circuitInfo.ts';
import { circuitSvg } from '../../src/ui/fallbackSvg.ts';
import { PAGE, STRINGS } from '../../src/ui/strings.ts';
import { weatherPreview } from '../../src/ui/weather.ts';
import { fixtureRace, summary } from '../fixtures/races.ts';

const CASES = [
  {
    trackId: 'las-vegas',
    upstreamId: 'us-2023',
    name: 'Las Vegas Strip Circuit',
    publishedM: 6200,
    grandPrix: 'Las Vegas Grand Prix',
    eventCode: 'lv',
    f1Slug: 'las-vegas',
    timeZone: 'America/Los_Angeles',
    // Saturday-night race: Thu–Sat local, Fri–Sun UTC.
    dates: ['2099-11-19', '2099-11-20', '2099-11-21'],
    starts: [
      '2099-11-20T00:30:00Z',
      '2099-11-20T04:00:00Z',
      '2099-11-21T00:30:00Z',
      '2099-11-21T04:00:00Z',
      '2099-11-22T04:00:00Z',
    ],
    coordinates: [
      [-115.16, 36.11],
      [-115.18, 36.13],
    ],
  },
  {
    trackId: 'lusail',
    upstreamId: 'qa-2004',
    name: 'Lusail International Circuit',
    publishedM: 5420,
    grandPrix: 'Qatar Grand Prix',
    eventCode: 'qa',
    f1Slug: 'qatar',
    timeZone: 'Asia/Qatar',
    dates: ['2099-11-20', '2099-11-21', '2099-11-22'],
    starts: [
      '2099-11-20T13:30:00Z',
      '2099-11-20T17:00:00Z',
      '2099-11-21T14:30:00Z',
      '2099-11-21T18:00:00Z',
      '2099-11-22T16:00:00Z',
    ],
    coordinates: [
      [51.45, 25.48],
      [51.46, 25.5],
    ],
  },
] as const;
type Case = (typeof CASES)[number];

const trackFile = (id: string) => JSON.parse(readFileSync(`data/tracks/${id}.json`, 'utf8'));
const article = (text: string): ParsedArticle => ({
  url: 'https://press.pirelli.com/fixture/',
  headline: 'Fixture headline',
  datePublished: '2099-11-16T10:00:00+01:00',
  keywords: [],
  media: [],
  paragraphs: [text],
});
function raceFor(c: Case, endDate: string | null = c.dates[2]): RaceRecord {
  const base = fixtureRace();
  return {
    ...base,
    id: `2099-${c.eventCode}`,
    slug: c.trackId,
    eventCode: c.eventCode,
    race: { ...base.race, name: c.grandPrix, startDate: null, endDate },
    circuit: { ...base.circuit, trackId: c.trackId, name: c.name },
  };
}

// update-weekends.ts is a top-level script: every run below replaces its network and disk writes.
const NAMES = ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race'];
async function runWeekendUpdate(
  record: RaceRecord,
  respond: (url: string) => Response,
  { now = '2099-11-10T12:00:00Z' } = {},
) {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(now) });
  const writes = new Map<string, string>();
  const requests: string[] = [];
  vi.doMock('../../scripts/build-data.ts', () => ({ buildData: async () => ({ records: [record] }) }));
  vi.doMock('node:fs/promises', async (original) => {
    const fs = await original<typeof import('node:fs/promises')>();
    return {
      ...fs,
      mkdir: async () => undefined,
      writeFile: async (file: string, body: string) => void writes.set(path.basename(file), body),
      readFile: (async (file: string, encoding: BufferEncoding) => {
        return fs.readFile(file, encoding);
      }) as typeof fs.readFile,
    };
  });
  vi.stubGlobal('fetch', async (url: string) => {
    requests.push(String(url));
    return respond(String(url));
  });
  await import('../../scripts/update-weekends.ts');
  const body = writes.get(`${record.id}.json`);
  return { requests, weekend: body ? Weekend.parse(JSON.parse(body)) : null };
}
const openMeteoCalls = (requests: string[]) => requests.filter((u) => u.includes('open-meteo.com'));
function officialResponses(c: Case) {
  return (url: string) => {
    if (url.includes('formula1.com'))
      return new Response(
        `<script type="application/ld+json">${JSON.stringify({
          '@type': 'SportsEvent',
          subEvent: c.starts.map((startDate, i) => ({ name: `${NAMES[i]} - ${c.grandPrix}`, startDate })),
        })}</script>`,
      );
    if (url.includes('bacinger'))
      return Response.json({ features: [{ geometry: { coordinates: c.coordinates } }] });
    if (url.includes('open-meteo.com'))
      return Response.json({
        daily: {
          time: c.dates,
          weather_code: [0, 63, 95],
          temperature_2m_max: [18, 16, 15],
          temperature_2m_min: [9, 8, 7],
          relative_humidity_2m_mean: [40, 55, 60],
          precipitation_probability_max: [5, 70, 90],
        },
      });
    throw new Error(`unexpected request: ${url}`);
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.doUnmock('../../scripts/build-data.ts');
  vi.doUnmock('node:fs/promises');
});

describe.each(CASES)('$trackId circuit', (c) => {
  it('has schema-valid imported geometry that matches its reference row and published length', () => {
    const parsed = parseWith(TrackShape, trackFile(c.trackId));
    if (!parsed.ok) throw new Error(parsed.error);
    const t = parsed.value;
    expect(t).toMatchObject({ id: c.trackId, name: c.name, sectors: null });
    expect(t.source).toMatchObject({
      name: 'bacinger/f1-circuits',
      license: 'MIT',
      upstreamId: c.upstreamId,
      url: `https://github.com/bacinger/f1-circuits/blob/master/circuits/${c.upstreamId}.geojson`,
    });
    expect(circuits.circuits.find((x) => x.trackId === c.trackId)).toMatchObject({
      name: c.name,
      upstreamId: c.upstreamId,
    });
    expect(t.points.flat().every(Number.isFinite)).toBe(true);
    // Local metres around the centroid: a lon/lat or unprojected import would fail these.
    expect(Math.max(...t.points.flat().map(Math.abs))).toBeLessThan(5000);
    expect(new Set(t.points.map(String)).size).toBe(t.points.length);
    expect(t.lengthM).toBe(Math.round(pathLength(t.points as [number, number][], true)));
    expect(Math.abs(t.lengthM - c.publishedM) / c.publishedM).toBeLessThan(0.01);
  });

  it('resolves from Pirelli text to the track file, slug and weekend venue', () => {
    const a = article(`Next is the ${c.name}, where the race will be run.`);
    expect(circuitFromText(a, circuits.circuits)?.trackId).toBe(c.trackId);
    const { record } = normalize(
      a,
      {
        season: 2099,
        grandPrix: c.grandPrix,
        round: 22,
        eventCode: c.eventCode,
        infographicUrl: 'https://content.presspage.com/fixture.jpg',
      },
      circuits.circuits,
      '2099-11-17T00:00:00Z',
    );
    expect(record).toMatchObject({
      id: `2099-${c.eventCode}`,
      slug: c.trackId,
      circuit: { trackId: c.trackId, name: c.name },
    });
    expect(trackFile(record.circuit.trackId!).source.upstreamId).toBe(c.upstreamId);
    expect(venues[c.trackId]).toEqual([c.f1Slug, c.timeZone]);
  });

  it('renders the real outline instead of the missing-track plate', () => {
    const track = parseWith(TrackShape, trackFile(c.trackId));
    if (!track.ok) throw new Error(track.error);
    const r = raceFor(c);
    const race = summary({ id: r.id, slug: r.slug });
    expect(
      findRace(
        {
          schemaVersion: 1,
          generatedAt: '2099-01-01T00:00:00Z',
          latest: r.id,
          years: [{ year: r.season, races: [race] }],
        },
        r.season,
        c.trackId,
      ),
    ).toEqual(race);
    expect(track.value.id).toBe(r.circuit.trackId);
    expect(circuitSvg(track.value, c.name).value).toContain('class="fallback-circuit"');
    expect(circuitSvg(track.value, c.name).value).not.toContain(PAGE.noOutline);
    const info = circuitInfo(r, track.value, '/Tyres/').value;
    expect(info).toContain('class="fallback-circuit"');
    expect(info).not.toContain(STRINGS.el.noTrack);
    // Control: the plate this replaces.
    expect(circuitSvg(null, c.name).value).toContain(PAGE.noOutline);
    expect(circuitInfo(r, null, '/Tyres/').value).toContain(STRINGS.el.noTrack);
  });

  it('renders a mocked weather response for activation after clearance', async () => {
    const { weekend } = await runWeekendUpdate(raceFor(c), officialResponses(c));
    const response = await officialResponses(c)('https://api.open-meteo.com/v1/forecast').json();
    const weather: NonNullable<Weekend['weather']> = {
      kind: 'forecast',
      retrievedAt: '2099-11-10T12:00:00Z',
      longitude: (c.coordinates[0][0] + c.coordinates[1][0]) / 2,
      latitude: (c.coordinates[0][1] + c.coordinates[1][1]) / 2,
      sourceUrl: 'https://api.open-meteo.com/v1/forecast',
      days: parseWeather(response, [...c.dates]),
    };
    const out = weatherPreview({ ...weekend!, weather }, c.timeZone, new Date('2099-11-10T13:00:00Z')).value;
    expect(out.match(/class="weather-day" /g)).toHaveLength(3);
    expect(out).toContain('data-session="race"');
    expect(out).toContain('data-condition="storm"');
    expect(out).toContain('18°C');
    expect(out).toContain('90%');
    expect(out).toContain('open-meteo.com');
    expect(out).not.toContain(PAGE.weather.noForecast);
  });

  it('keeps known dates and renders without a forecast when every request fails', async () => {
    const { requests, weekend } = await runWeekendUpdate(raceFor(c), () => {
      throw new TypeError('fetch failed');
    });
    expect(openMeteoCalls(requests)).toEqual([]);
    expect(weekend).toMatchObject({ weather: null, sessions: [], scheduleRetrievedAt: null });
    const out = weatherPreview(weekend, c.timeZone).value;
    expect(out).toContain(PAGE.weather.noForecast);
    expect(out).toContain(PAGE.weather.noSchedule);
  });

  it('writes no weekend for an undated record when the schedule source fails', async () => {
    const { requests, weekend } = await runWeekendUpdate(raceFor(c, null), () => {
      throw new TypeError('fetch failed');
    });
    expect(openMeteoCalls(requests)).toEqual([]);
    expect(weekend).toBeNull();
  });
});

it('keeps existing races, manifest and circuit validation unchanged when the two tracks are added', async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2099-01-01T00:00:00Z') });
  const { buildData } = await import('../../scripts/build-data.ts');
  const present = await buildData({ write: false });
  vi.resetModules();
  vi.doMock('node:fs/promises', async (original) => {
    const fs = await original<typeof import('node:fs/promises')>();
    return {
      ...fs,
      readdir: (async (...args: Parameters<typeof fs.readdir>) => {
        const entries = await fs.readdir(...args);
        return String(args[0]).endsWith('/data/tracks')
          ? entries.filter(
              (entry) =>
                !['las-vegas.json', 'lusail.json'].includes(
                  String(typeof entry === 'string' ? entry : entry.name),
                ),
            )
          : entries;
      }) as typeof fs.readdir,
    };
  });
  const absent = await (await import('../../scripts/build-data.ts')).buildData({ write: false });
  expect(present.records).toEqual(absent.records);
  expect(present.manifest).toEqual(absent.manifest);
  expect(present.problems).toEqual(absent.problems);
  expect(present.warnings.filter((w) => !w.includes('no track shape'))).toEqual(
    absent.warnings.filter((w) => !w.includes('no track shape')),
  );
  expect(present.warnings.filter((w) => w.includes('no track shape'))).toEqual(
    absent.warnings.filter(
      (w) => w.includes('no track shape') && !CASES.some((c) => w.includes(`"${c.trackId}"`)),
    ),
  );
});
