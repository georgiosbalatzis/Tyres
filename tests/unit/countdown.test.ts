import { describe, expect, it } from 'vitest';
import { CALENDAR, formatCountdown, nextRace } from '../../src/ui/countdown.ts';

describe('masthead countdown', () => {
  it('picks the earliest race that has not started', () => {
    const now = Date.parse('2026-10-05T11:24:00Z');
    expect(nextRace(now)?.name).toBe('Singapore GP');
    expect(nextRace(Date.parse('2026-10-11T12:00:00Z'))?.name).toBe('US GP'); // starting now is not upcoming
  });

  it('is null once the calendar has run out', () => {
    expect(nextRace(Date.parse('2027-01-01T00:00:00Z'))).toBeNull();
  });

  it('keeps the site calendar in order and complete', () => {
    const starts = CALENDAR.map((r) => Date.parse(r.start));
    expect(CALENDAR.length).toBe(22);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(CALENDAR.some((r) => r.name === 'São Paulo GP')).toBe(true);
  });

  it('formats like the site', () => {
    expect(formatCountdown(0)).toBe('0d 0h 0m');
    expect(formatCountdown(59_000)).toBe('0d 0h 0m');
    expect(formatCountdown(((24 + 2) * 60 + 3) * 60_000)).toBe('1d 2h 3m');
  });
});
