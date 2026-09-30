import { describe, expect, it } from 'vitest';
import { crossCheck, parseWith, RaceRecord } from '../../src/domain/schema.ts';
import { fixtureRace } from '../fixtures/races.ts';

const ok = (r: unknown) => parseWith(RaceRecord, r).ok;

describe('race schema', () => {
  it('accepts a complete record', () => {
    expect(ok(fixtureRace())).toBe(true);
  });

  it('accepts null for every factual field (partial Pirelli preview)', () => {
    const r = fixtureRace({
      round: null,
      compounds: null,
      circuit: {
        trackId: null,
        name: null,
        lengthKm: null,
        laps: null,
        raceDistanceKm: null,
        lapRecord: null,
        pitStopLoss: null,
      },
      characteristics: {
        traction: null,
        braking: null,
        tyreStress: null,
        asphaltAbrasion: null,
        asphaltGrip: null,
        lateral: null,
        trackEvolution: null,
      },
      setup: { minimumStartingPressurePsi: null, expectedRunningPressurePsi: null, camberLimitDeg: null },
    });
    expect(ok(r)).toBe(true);
  });

  it.each([0, 6, 2.5, -1])('rejects rating %s', (v) => {
    const r = fixtureRace();
    r.characteristics.braking = v;
    expect(ok(r)).toBe(false);
  });

  it('keeps downforce optional (2025 format only)', () => {
    const r = fixtureRace();
    r.characteristics.downforce = 4;
    expect(ok(r)).toBe(true);
  });

  it('rejects implausible pressures and positive camber', () => {
    const a = fixtureRace();
    a.setup.minimumStartingPressurePsi = { front: -5, rear: 22 };
    expect(ok(a)).toBe(false);
    const b = fixtureRace();
    b.setup.camberLimitDeg = { front: 3, rear: -2 };
    expect(ok(b)).toBe(false);
  });

  it('accepts future compound identifiers but rejects garbage', () => {
    const a = fixtureRace({ compounds: [{ raceLabel: 'soft', compound: 'C7' }] });
    expect(ok(a)).toBe(true);
    const b = fixtureRace({ compounds: [{ raceLabel: 'soft', compound: 'c3<script>' }] });
    expect(ok(b)).toBe(false);
  });

  it('only accepts https source URLs', () => {
    const r = fixtureRace();
    r.source.articleUrl = 'javascript:alert(1)';
    expect(ok(r)).toBe(false);
    r.source.articleUrl = 'http://press.pirelli.com/x/';
    expect(ok(r)).toBe(false);
  });

  it('requires timezone-qualified publication timestamps', () => {
    const r = fixtureRace();
    r.source.publishedAt = '2026-09-29 10:36';
    expect(ok(r)).toBe(false);
  });
});

describe('crossCheck', () => {
  it('flags race distance inconsistent with laps × length', () => {
    const r = fixtureRace();
    r.circuit.raceDistanceKm = 250;
    expect(crossCheck(r)[0]).toMatch(/raceDistanceKm/);
  });

  it('flags reversed dates, duplicate compounds and id/season mismatch', () => {
    const r = fixtureRace({ id: '2098-fa' });
    r.race.startDate = '2099-06-01';
    r.compounds = [
      { raceLabel: 'hard', compound: 'C1' },
      { raceLabel: 'hard', compound: 'C1' },
    ];
    expect(crossCheck(r)).toHaveLength(4);
  });

  it('passes a consistent record', () => {
    expect(crossCheck(fixtureRace())).toEqual([]);
  });
});
