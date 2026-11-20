import * as z from 'zod/mini';
import { SESSION_IDS, type SessionId, WeatherDay } from '../../src/domain/weekend.ts';

const names: Record<string, SessionId> = {
  'Practice 1': 'fp1',
  'Practice 2': 'fp2',
  'Practice 3': 'fp3',
  'Sprint Qualifying': 'sprint-qualifying',
  Sprint: 'sprint',
  Qualifying: 'qualifying',
  Race: 'race',
};
/** Only official SportsEvent JSON-LD is read; no session times are inferred. */
export function parseSessions(page: string, season: number) {
  for (const match of page.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let data: unknown;
    try {
      data = JSON.parse(match[1]!);
    } catch {
      continue;
    }
    const candidates = Array.isArray(data) ? data : [data];
    for (const candidate of candidates) {
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        !('subEvent' in candidate) ||
        !Array.isArray(candidate.subEvent)
      )
        continue;
      const sessions: { id: SessionId; start: string }[] = [];
      for (const event of candidate.subEvent) {
        if (!event || typeof event.name !== 'string' || typeof event.startDate !== 'string') continue;
        const id = names[event.name.split(' - ')[0]];
        if (
          !id ||
          !event.startDate.startsWith(`${season}-`) ||
          !z.iso.datetime({ offset: true }).safeParse(event.startDate).success
        )
          continue;
        sessions.push({ id, start: event.startDate });
      }
      if (sessions.length && sessions.every((s) => SESSION_IDS.includes(s.id)))
        return sessions.sort((a, b) => a.start.localeCompare(b.start));
    }
  }
  throw new Error('No official session schedule found');
}

const nullableNumbers = z.array(z.nullable(z.number()));
const ForecastResponse = z.object({
  daily: z.object({
    time: z.array(z.iso.date()),
    weather_code: nullableNumbers,
    temperature_2m_max: nullableNumbers,
    temperature_2m_min: nullableNumbers,
    relative_humidity_2m_mean: nullableNumbers,
    precipitation_probability_max: nullableNumbers,
  }),
});
export function parseWeather(input: unknown, dates: string[]) {
  const { daily: d } = ForecastResponse.parse(input);
  return dates.map((date) => {
    const i = d.time.indexOf(date);
    if (i < 0) throw new Error(`Weather missing for ${date}`);
    return WeatherDay.parse({
      date,
      code: d.weather_code[i] ?? null,
      highC: d.temperature_2m_max[i] ?? null,
      lowC: d.temperature_2m_min[i] ?? null,
      humidityPct: d.relative_humidity_2m_mean[i] ?? null,
      rainChancePct: d.precipitation_probability_max[i] ?? null,
    });
  });
}
