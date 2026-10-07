import * as z from 'zod/mini';

export const SESSION_IDS = [
  'fp1',
  'fp2',
  'fp3',
  'sprint-qualifying',
  'sprint',
  'qualifying',
  'race',
] as const;
export type SessionId = (typeof SESSION_IDS)[number];
const percent = z.nullable(z.number().check(z.gte(0), z.lte(100)));
const temperature = z.nullable(z.number().check(z.gte(-90), z.lte(65)));
export const WeatherDay = z.object({
  date: z.iso.date(),
  code: z.nullable(z.int().check(z.gte(0), z.lte(99))),
  highC: temperature,
  lowC: temperature,
  humidityPct: percent,
  rainChancePct: percent,
});
export const Weekend = z.object({
  raceId: z.string().check(z.regex(/^\d{4}-[a-z0-9-]{1,40}$/)),
  timeZone: z.string().check(z.minLength(1), z.maxLength(80)),
  dates: z.array(z.iso.date()).check(z.length(3)),
  sessions: z
    .array(z.object({ id: z.enum(SESSION_IDS), start: z.iso.datetime({ offset: true }) }))
    .check(z.maxLength(7)),
  scheduleUrl: z.url({ protocol: /^https$/ }),
  scheduleRetrievedAt: z.nullable(z.iso.datetime({ offset: true })),
  weather: z.nullable(
    z.object({
      kind: z.enum(['forecast', 'archived-forecast']),
      retrievedAt: z.iso.datetime({ offset: true }),
      latitude: z.number().check(z.gte(-90), z.lte(90)),
      longitude: z.number().check(z.gte(-180), z.lte(180)),
      sourceUrl: z.url({ protocol: /^https$/ }),
      days: z.array(WeatherDay).check(z.length(3)),
    }),
  ),
});
export type Weekend = z.infer<typeof Weekend>;
export type WeatherDay = z.infer<typeof WeatherDay>;

export function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function weekendProblems(w: Weekend): string[] {
  const problems: string[] = [];
  try {
    localDate(new Date().toISOString(), w.timeZone);
  } catch {
    return ['Invalid time zone'];
  }
  if (new Set(w.dates).size !== 3 || w.dates.some((date, i) => i > 0 && date <= w.dates[i - 1]!))
    problems.push('Dates must be unique and ordered');
  for (let i = 1; i < 3; i++)
    if (Date.parse(w.dates[i]!) - Date.parse(w.dates[i - 1]!) !== 86400000)
      problems.push('Dates must be consecutive');
  const ids = w.sessions.map((s) => s.id);
  if (new Set(ids).size !== ids.length) problems.push('Duplicate session');
  const expected = ids.includes('sprint')
    ? ['fp1', 'sprint-qualifying', 'sprint', 'qualifying', 'race']
    : ['fp1', 'fp2', 'fp3', 'qualifying', 'race'];
  if (ids.length && (ids.length !== 5 || expected.some((id) => !ids.includes(id as SessionId))))
    problems.push('Incomplete session schedule');
  if (w.sessions.some((s) => !w.dates.includes(localDate(s.start, w.timeZone))))
    problems.push('Session outside weekend');
  if (w.weather) {
    if (w.weather.days.some((d, i) => d.date !== w.dates[i]))
      problems.push('Weather dates do not match weekend');
    if (w.weather.days.some((d) => d.highC != null && d.lowC != null && d.highC < d.lowC))
      problems.push('High temperature below low');
  }
  return problems;
}

export type Condition =
  | 'sun'
  | 'partial'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'unknown';
export function weatherCondition(code: number | null): Condition {
  if (code === 0 || code === 1) return 'sun';
  if (code === 2) return 'partial';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code ?? -1)) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return 'snow';
  if ([95, 96, 99].includes(code ?? -1)) return 'storm';
  return 'unknown';
}
