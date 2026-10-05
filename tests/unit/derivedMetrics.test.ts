import { describe, expect, it } from 'vitest';
import {
  CAR_VIEWS,
  deriveView,
  HEAT_STOPS,
  heatColour,
  mix,
  NO_DATA_COLOUR,
  norm,
} from '../../src/domain/derivedMetrics.ts';
import { PAGE, STRINGS } from '../../src/ui/strings.ts';
import { fixtureRace } from '../fixtures/races.ts';

const TEXT = PAGE.derivedText;

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
    const v = deriveView(fixtureRace(), 'longitudinal', TEXT); // braking 5, traction 1
    expect(v.corners.FL.intensity).toBeCloseTo(0.65);
    expect(v.corners.RL.intensity).toBeCloseTo(0.35);
    expect(v.corners.FL.intensity).toBe(v.corners.FR.intensity);
  });

  it('never invents values: a missing rating yields null intensity and "Δεν δόθηκε"', () => {
    const r = fixtureRace();
    r.characteristics.lateral = null;
    const v = deriveView(r, 'lateral', TEXT);
    expect(v.corners.FL.intensity).toBeNull();
    expect(v.corners.FL.display).toBe('Δεν δόθηκε');
  });

  it('maps pressures on a fixed psi scale and labels them as minimums', () => {
    const v = deriveView(fixtureRace(), 'pressures', TEXT); // 24 / 22 psi on 18–30
    expect(v.corners.FL.intensity).toBeCloseTo(0.5);
    expect(v.corners.RL.display).toBe('22,0 psi ελάχιστο');
  });

  it('never describes derived colours as temperature', () => {
    for (const view of CAR_VIEWS)
      expect(deriveView(fixtureRace(), view, TEXT).method.toLowerCase()).not.toMatch(/θερμοκρασ|temperature/);
    expect(`${PAGE.derivedLabel} ${PAGE.derivedNote}`).toBe(STRINGS.el.derived);
    expect(STRINGS.el.derived).toMatch(/όχι θερμοκρασία/);
  });

  it('uses scale endpoints and a neutral for missing data', () => {
    expect(heatColour(0)).toBe(HEAT_STOPS[0]);
    expect(heatColour(1)).toBe(HEAT_STOPS[4]);
    expect(heatColour(null)).toBe(NO_DATA_COLOUR);
    expect(HEAT_STOPS).not.toContain(NO_DATA_COLOUR);
  });
});

describe('circuit ribbon fit', () => {
  it('keeps tall (north–south) layouts inside the depth budget', async () => {
    const { ribbonGeometry } = await import('../../src/three/circuit.ts');
    const tall = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * Math.PI * 2;
      return [Math.cos(a) * 300, Math.sin(a) * 1000] as [number, number];
    });
    const { geometry } = ribbonGeometry(
      {
        schemaVersion: 1,
        id: 't',
        name: 't',
        points: tall,
        lengthM: 4000,
        sectors: null,
        source: { name: 'x', url: 'https://x.test/', license: 'MIT', upstreamId: 'x' },
      },
      0,
      0,
    );
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.max.z - box.min.z).toBeLessThanOrEqual(3.41);
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(5.41);
  });
});
