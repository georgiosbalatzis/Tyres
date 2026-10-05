import type { CharacteristicKey, RaceRecord } from './schema.ts';

// English helpers below serve only the maintainer's review sheet (scripts/review-sheet.ts); the page uses STRINGS.el.
export const NOT_PROVIDED = 'Not provided';

export const CHARACTERISTICS: { key: CharacteristicKey }[] = (
  [
    'traction',
    'braking',
    'tyreStress',
    'asphaltAbrasion',
    'asphaltGrip',
    'lateral',
    'trackEvolution',
    'downforce',
  ] as const
).map((key) => ({ key }));

/** Ratings shown for a record: the seven core ones always, downforce only when the source format includes it. */
export function characteristicsFor(record: RaceRecord) {
  return CHARACTERISTICS.filter(
    (c) => c.key !== 'downforce' || record.characteristics.downforce !== undefined,
  );
}

export const RACE_LABEL_ORDER = ['hard', 'medium', 'soft'];

export function fixed(value: number | null | undefined, digits: number, unit = ''): string {
  return value == null ? NOT_PROVIDED : `${value.toFixed(digits)}${unit}`;
}

export function signedDeg(value: number | null | undefined): string {
  return value == null ? NOT_PROVIDED : `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}°`;
}

export function compoundCssVar(raceLabel: string): string {
  return RACE_LABEL_ORDER.includes(raceLabel) ? `var(--c-${raceLabel})` : 'var(--c-text-2)';
}
