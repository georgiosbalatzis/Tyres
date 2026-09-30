import { describe, expect, it } from 'vitest';
import {
  CAR_VIEWS,
  DERIVED_LABEL,
  deriveView,
  HEAT_STOPS,
  heatColour,
  mix,
  NO_DATA_COLOUR,
  norm,
} from '../../src/domain/derivedMetrics.ts';
import { fixtureRace } from '../fixtures/races.ts';

describe('derived metrics (visualisation only)', () => {
  it('maps ratings 1–5 onto 0–1 and keeps null as null', () => {
    expect([1, 3, 5].map(norm)).toEqual([0, 0.5, 1]);
    expect(norm(null)).toBeNull();
    expect(norm(undefined)).toBeNull();
  });

  it('mixes with a missing input by falling back to the other', () => {
    expect(mix(1, 1, 0, 1)).toBe(0.5);
    expect(mix(null, 1, 0.4, 1)).toBe(0.4);
    expect(mix(null, 1, null, 1)).toBeNull();
  });

  it('weights braking to the fronts and traction to the rears (longitudinal)', () => {
    const v = deriveView(fixtureRace(), 'longitudinal'); // braking 5, traction 1
    expect(v.corners.FL.intensity).toBeCloseTo(0.65);
    expect(v.corners.RL.intensity).toBeCloseTo(0.35);
    expect(v.corners.FL.intensity).toBe(v.corners.FR.intensity);
  });

  it('never invents values: a missing rating yields null intensity and "Not provided"', () => {
    const r = fixtureRace();
    r.characteristics.lateral = null;
    const v = deriveView(r, 'lateral');
    expect(v.corners.FL.intensity).toBeNull();
    expect(v.corners.FL.display).toBe('Not provided');
  });

  it('maps pressures on a fixed psi scale and labels them as minimums', () => {
    const v = deriveView(fixtureRace(), 'pressures'); // 24 / 22 psi on 18–30
    expect(v.corners.FL.intensity).toBeCloseTo(0.5);
    expect(v.corners.RL.display).toBe('22.0 psi minimum');
  });

  it('never describes derived colours as temperature', () => {
    for (const view of CAR_VIEWS)
      expect(deriveView(fixtureRace(), view).method.toLowerCase()).not.toContain('temperature');
    expect(DERIVED_LABEL).toMatch(/Derived visualisation/);
  });

  it('uses scale endpoints and a neutral for missing data', () => {
    expect(heatColour(0)).toBe(HEAT_STOPS[0]);
    expect(heatColour(1)).toBe(HEAT_STOPS[4]);
    expect(heatColour(null)).toBe(NO_DATA_COLOUR);
    expect(HEAT_STOPS).not.toContain(NO_DATA_COLOUR);
  });
});
