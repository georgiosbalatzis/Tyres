/** Build-time only: official F1 session schedules + Open-Meteo forecasts. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import venues from '../data/reference/weekend-venues.json' with { type: 'json' };
import { localDate, Weekend, weekendProblems } from '../src/domain/weekend.ts';
import { buildData } from './build-data.ts';
import { parseSessions, parseWeather } from './lib/weekend-sources.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'data/weekends');
const now = new Date();
async function get(url: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'F1Stories-Tyres/1.0 (+https://f1stories.gr)' },
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}
function offset(date: string, days: number) {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}
await mkdir(OUT, { recursive: true });
const { records } = await buildData({ write: false });
let failures = 0;
// Small batches keep source traffic bounded.
for (let i = 0; i < records.length; i += 3) {
  await Promise.all(
    records.slice(i, i + 3).map(async (r) => {
      const venue = venues[r.circuit.trackId as keyof typeof venues];
      if (!venue) {
        console.warn(`${r.id}: venue/date unavailable`);
        return;
      }
      const [slug, timeZone] = venue as [string, string];
      const scheduleUrl = `https://www.formula1.com/en/racing/${r.season}/${slug}`;
      const file = path.join(OUT, `${r.id}.json`);
      const previous = await readFile(file, 'utf8')
        .then((s) => {
          const previous = Weekend.parse(JSON.parse(s));
          return previous.raceId === r.id && !weekendProblems(previous).length ? previous : null;
        })
        .catch(() => null);
      const w: Weekend = {
        raceId: r.id,
        timeZone,
        dates: r.race.endDate ? [offset(r.race.endDate, -2), offset(r.race.endDate, -1), r.race.endDate] : [],
        sessions: [],
        scheduleUrl,
        scheduleRetrievedAt: null,
        weather: null,
      };
      try {
        const sessions = parseSessions(await (await get(scheduleUrl)).text(), r.season);
        const dates = [...new Set(sessions.map((s) => localDate(s.start, timeZone)))].sort();
        // Catch stale/redirection schedules rather than attaching another race's dates.
        if (
          dates.length !== 3 ||
          (r.race.endDate && Math.abs(Date.parse(dates[2]!) - Date.parse(r.race.endDate)) > 86400000)
        )
          throw new Error('Official schedule does not match this weekend');
        const candidate = { ...w, sessions, dates, scheduleRetrievedAt: now.toISOString() };
        const problems = weekendProblems(candidate);
        if (problems.length) throw new Error(problems.join('; '));
        Object.assign(w, candidate);
      } catch (err) {
        console.warn(`${r.id}: ${(err as Error).message}`);
        if (previous?.sessions.length) {
          w.sessions = previous.sessions;
          w.dates = previous.dates;
          w.scheduleRetrievedAt = previous.scheduleRetrievedAt;
        }
      }
      if (w.dates.length !== 3) {
        failures++;
        console.warn(`${r.id}: no weekend dates available`);
        return;
      }
      try {
        const today = localDate(now.toISOString(), timeZone);
        if (w.dates[0]! <= offset(today, 15) && w.dates[2]! <= offset(today, 15)) {
          const track = JSON.parse(
            await readFile(path.join(ROOT, 'data/tracks', `${r.circuit.trackId}.json`), 'utf8'),
          );
          const geo = (await (
            await get(
              `https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/${track.source.upstreamId}.geojson`,
            )
          ).json()) as { features: { geometry: { coordinates: number[][] } }[] };
          const points = geo.features[0]?.geometry.coordinates;
          if (
            !points?.length ||
            points.some((p) => p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))
          )
            throw new Error('Invalid circuit coordinates');
          const longitude = points.reduce((sum, p) => sum + p[0]!, 0) / points.length;
          const latitude = points.reduce((sum, p) => sum + p[1]!, 0) / points.length;
          const historical = w.dates[2]! < today;
          const endpoint = historical
            ? 'https://historical-forecast-api.open-meteo.com/v1/forecast'
            : 'https://api.open-meteo.com/v1/forecast';
          const query = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),
            timezone: timeZone,
            start_date: w.dates[0]!,
            end_date: w.dates[2]!,
            daily:
              'weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_probability_max',
          });
          w.weather = {
            kind: historical ? 'archived-forecast' : 'forecast',
            retrievedAt: now.toISOString(),
            latitude,
            longitude,
            sourceUrl: `${endpoint}?${query}`,
            days: parseWeather(await (await get(`${endpoint}?${query}`)).json(), w.dates),
          };
        }
      } catch (err) {
        failures++;
        console.warn(`${r.id}: ${(err as Error).message}`);
        // Preserve a valid dated snapshot on transient outages. The UI marks stale forecasts.
        if (previous?.weather && previous.dates.join() === w.dates.join()) w.weather = previous.weather;
      }
      const parsed = Weekend.parse(w);
      const problems = weekendProblems(parsed);
      if (problems.length) throw new Error(`${r.id}: ${problems.join('; ')}`);
      await writeFile(file, `${JSON.stringify(parsed, null, 2)}\n`);
      console.log(`${r.id}: ${w.sessions.length} sessions, ${w.weather?.kind ?? 'weather unavailable'}`);
    }),
  );
}
if (failures) console.warn(`${failures} weather source requests failed; available snapshots were retained.`);
