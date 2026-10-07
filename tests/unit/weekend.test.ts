import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSessions, parseWeather } from '../../scripts/lib/weekend-sources.ts';
import { localDate, Weekend, weatherCondition, weekendProblems } from '../../src/domain/weekend.ts';
import { weatherPreview } from '../../src/ui/weather.ts';

const standard = Weekend.parse(JSON.parse(readFileSync('data/weekends/2026-bh.json', 'utf8')));
const sprint = Weekend.parse(JSON.parse(readFileSync('data/weekends/2026-mi.json', 'utf8')));
const officialMarkup = (events: { name: string; startDate: string }[]) =>
  `<script type="application/ld+json">${JSON.stringify({ '@type': 'SportsEvent', subEvent: events })}</script>`;

describe('weekend sources and data', () => {
  it('extracts both official formats without inferring session times', () => {
    for (const w of [standard, sprint]) {
      const names = {
        fp1: 'Practice 1',
        fp2: 'Practice 2',
        fp3: 'Practice 3',
        'sprint-qualifying': 'Sprint Qualifying',
        sprint: 'Sprint',
        qualifying: 'Qualifying',
        race: 'Race',
      };
      const page = officialMarkup(
        w.sessions.map((s) => ({ name: `${names[s.id]} - Grand Prix`, startDate: s.start })),
      );
      expect(parseSessions(page, 2026)).toEqual(w.sessions);
      expect(() => parseSessions(page, 2025)).toThrow('No official');
    }
    expect(() => parseSessions('<html>No timetable</html>', 2026)).toThrow();
    expect(() => parseSessions(officialMarkup([{ name: 'Race', startDate: 'not a date' }]), 2026)).toThrow();
  });

  it('has three sourced days and complete schedules for every published snapshot', () => {
    for (const file of readdirSync('data/weekends')) {
      const w = Weekend.parse(JSON.parse(readFileSync(`data/weekends/${file}`, 'utf8')));
      expect(weekendProblems(w), file).toEqual([]);
      expect(w.scheduleUrl).toMatch(/^https:\/\/www\.formula1\.com\/en\/racing\//);
      expect(w.scheduleRetrievedAt).not.toBeNull();
      expect(w.weather?.days).toHaveLength(3);
      expect(w.weather?.sourceUrl).toContain('open-meteo.com/v1/forecast');
    }
  });

  it('rejects wrong dates, incomplete schedules, invalid time zones and contradictory temperatures', () => {
    expect(weekendProblems({ ...standard, sessions: standard.sessions.slice(1) })).toContain(
      'Incomplete session schedule',
    );
    expect(weekendProblems({ ...standard, dates: ['2026-10-01', '2026-10-02', '2026-10-04'] })).toContain(
      'Dates must be consecutive',
    );
    expect(weekendProblems({ ...standard, timeZone: 'Not/AZone' })).toContain('Invalid time zone');
    const bad = structuredClone(standard);
    bad.weather!.days[0]!.highC = -20;
    expect(weekendProblems(bad)).toContain('High temperature below low');
  });

  it('handles unknown weather codes and distinct forms of precipitation', () => {
    expect(weatherCondition(null)).toBe('unknown');
    expect(weatherCondition(0)).toBe('sun');
    expect(weatherCondition(2)).toBe('partial');
    expect(weatherCondition(48)).toBe('fog');
    expect(weatherCondition(53)).toBe('drizzle');
    expect(weatherCondition(81)).toBe('rain');
    expect(weatherCondition(75)).toBe('snow');
    expect(weatherCondition(95)).toBe('storm');
  });

  it('preserves null readings and rejects invalid percentages or missing days', () => {
    const response = {
      daily: {
        time: standard.dates,
        weather_code: [0, 2, 95],
        temperature_2m_max: [null, 23, 25],
        temperature_2m_min: [null, 12, 13],
        relative_humidity_2m_mean: [null, 75, 80],
        precipitation_probability_max: [null, 90, 100],
      },
    };
    expect(parseWeather(response, standard.dates)[0]!.humidityPct).toBeNull();
    expect(() => parseWeather(response, ['2099-01-01'])).toThrow('Weather missing');
    response.daily.precipitation_probability_max[1] = 110;
    expect(() => parseWeather(response, standard.dates)).toThrow();
  });

  it('groups sessions by track date even across UTC midnight', () => {
    expect(localDate('2026-05-02T01:00:00Z', 'America/New_York')).toBe('2026-05-01');
  });
});

describe('weather preview', () => {
  it('renders three days with metric weather, standard sessions and source attribution', () => {
    const out = weatherPreview(standard).value;
    expect(out.match(/class="weather-day" /g)).toHaveLength(3);
    for (const session of ['fp1', 'fp2', 'fp3', 'qualifying', 'race'])
      expect(out).toContain(`data-session="${session}"`);
    expect(out).toContain('°C');
    expect(out).toContain('Υγρασία');
    expect(out).toContain('Πιθανότητα βροχής');
    expect(out).toContain('Αρχειοθετημένη πρόγνωση');
    expect(out).toContain('CC BY 4.0');
    expect(out).toContain('07:30'); // FP1 at 04:30 UTC → Athens summer time.
    expect(weatherPreview(standard, standard.timeZone).value).toContain('12:30');
  });

  it('renders sprint sessions instead of FP2 and FP3', () => {
    const out = weatherPreview(sprint).value;
    expect(out).toContain('data-session="sprint-qualifying"');
    expect(out).toContain('data-session="sprint"');
    expect(out).not.toContain('data-session="fp2"');
    expect(out).not.toContain('data-session="fp3"');
    expect(out).toContain('Τριήμερο Sprint');
    const shifted = structuredClone(sprint);
    shifted.sessions[0]!.start = '2026-05-01T23:00:00Z';
    expect(weatherPreview(shifted).value).toContain('<small>2 Μαΐ</small>');
  });

  it('keeps the schedule when forecasts are absent and flags stale forecasts', () => {
    const out = weatherPreview({ ...standard, weather: null }).value;
    expect(out).toContain('έως 16 ημέρες');
    expect(out).toContain('data-session="race"');
    expect(out).not.toContain('weather-sources"><a href="undefined');
    const old = structuredClone(standard);
    old.weather!.kind = 'forecast';
    expect(weatherPreview(old, 'Europe/Athens', new Date('2026-10-10T12:00:00Z')).value).toContain(
      'παλαιότερη από 24 ώρες',
    );
    expect(weatherPreview(null).value).toContain('Δεν υπάρχει διαθέσιμο πρόγραμμα');
  });
});
