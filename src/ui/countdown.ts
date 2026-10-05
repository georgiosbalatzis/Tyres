// Mirrors the fallback calendar in f1StoriesPage/scripts/shared-nav.js ("Next Race Countdown"); update both together,
// `npm run site:check` reports drift. Names stay as the site writes them ("Singapore GP"). No network: static only.
export const CALENDAR: readonly { name: string; start: string }[] = [
  { name: 'Australian GP', start: '2026-03-08T05:00:00Z' },
  { name: 'Chinese GP', start: '2026-03-15T07:00:00Z' },
  { name: 'Japanese GP', start: '2026-03-29T05:00:00Z' },
  { name: 'Miami GP', start: '2026-05-03T20:00:00Z' },
  { name: 'Canadian GP', start: '2026-05-24T18:00:00Z' },
  { name: 'Monaco GP', start: '2026-06-07T13:00:00Z' },
  { name: 'Catalunya GP', start: '2026-06-14T13:00:00Z' },
  { name: 'Austrian GP', start: '2026-06-28T13:00:00Z' },
  { name: 'British GP', start: '2026-07-05T14:00:00Z' },
  { name: 'Belgian GP', start: '2026-07-19T13:00:00Z' },
  { name: 'Hungarian GP', start: '2026-07-26T13:00:00Z' },
  { name: 'Dutch GP', start: '2026-08-23T13:00:00Z' },
  { name: 'Italian GP', start: '2026-09-06T13:00:00Z' },
  { name: 'Spanish GP', start: '2026-09-13T13:00:00Z' },
  { name: 'Azerbaijan GP', start: '2026-09-26T11:00:00Z' },
  { name: 'Singapore GP', start: '2026-10-11T12:00:00Z' },
  { name: 'US GP', start: '2026-10-25T19:00:00Z' },
  { name: 'Mexico City GP', start: '2026-11-01T20:00:00Z' },
  { name: 'São Paulo GP', start: '2026-11-08T17:00:00Z' },
  { name: 'Las Vegas GP', start: '2026-11-21T06:00:00Z' },
  { name: 'Qatar GP', start: '2026-11-29T14:00:00Z' },
  { name: 'Abu Dhabi GP', start: '2026-12-06T13:00:00Z' },
];

/** The earliest race that has not started yet, or null once the calendar has run out. */
export function nextRace(now: number, calendar = CALENDAR): { name: string; start: number } | null {
  const upcoming = calendar
    .map((race) => ({ name: race.name, start: Date.parse(race.start) }))
    .filter((race) => Number.isFinite(race.start) && race.start > now)
    .sort((a, b) => a.start - b.start);
  return upcoming[0] ?? null;
}

/** "6d 0h 36m", as the site's masthead shows it. */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  return `${days}d ${hours}h ${totalMinutes % 60}m`;
}
