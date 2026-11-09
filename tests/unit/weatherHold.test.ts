import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RaceRecord } from '../../src/domain/schema.ts';
import { Weekend, weekendProblems } from '../../src/domain/weekend.ts';
import { PAGE } from '../../src/ui/strings.ts';
import { weatherPreview } from '../../src/ui/weather.ts';
import { fixtureRace } from '../fixtures/races.ts';

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
  it.each([
    ['inside the forecast window', '2099-11-10T12:00:00Z'],
    ['after the completed weekend', '2099-11-25T12:00:00Z'],
  ])('holds weather requests %s while writing the schedule', async (_label, now) => {
    const warn = vi.spyOn(console, 'warn');
    const { requests, weekend } = await runWeekendUpdate(raceFor(c), officialResponses(c), { now });
    expect(requests).toEqual([`https://www.formula1.com/en/racing/2099/${c.f1Slug}`]);
    expect(openMeteoCalls(requests)).toEqual([]);
    expect(requests.filter((url) => url.includes('bacinger'))).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    expect(weekend).not.toBeNull();
    expect(weekendProblems(weekend!)).toEqual([]);
    expect(weekend).toMatchObject({ timeZone: c.timeZone, dates: c.dates, weather: null });
    expect(weekend!.sessions).toHaveLength(5);
    expect(weekend!.scheduleRetrievedAt).not.toBeNull();
    expect(weatherPreview(weekend!, c.timeZone).value).toContain(PAGE.weather.noForecast);
  });
});

it('still requests weather for an unheld venue', async () => {
  const c = CASES[0];
  const record = raceFor(c);
  record.circuit.trackId = 'miami';
  const { requests, weekend } = await runWeekendUpdate(record, officialResponses(c));
  expect(requests).toContain(
    'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/us-2022.geojson',
  );
  expect(openMeteoCalls(requests)).toHaveLength(1);
  expect(weekend?.weather?.kind).toBe('forecast');
});
