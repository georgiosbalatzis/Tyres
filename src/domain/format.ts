import type { CharacteristicKey, DataStatus, RaceRecord } from './schema.ts';

export const NOT_PROVIDED = 'Not provided';

export const CHARACTERISTICS: { key: CharacteristicKey; label: string; explain: string }[] = [
  {
    key: 'traction',
    label: 'Traction',
    explain: 'How much the layout asks of the rear tyres when accelerating out of slow corners.',
  },
  {
    key: 'braking',
    label: 'Braking',
    explain: 'Frequency and severity of heavy braking zones, mostly felt by the front tyres.',
  },
  {
    key: 'tyreStress',
    label: 'Tyre stress',
    explain: 'Pirelli’s overall rating of the combined forces the tyre structure has to absorb.',
  },
  {
    key: 'asphaltAbrasion',
    label: 'Asphalt abrasion',
    explain: 'How rough the surface is. Higher means more wear on the tread.',
  },
  {
    key: 'asphaltGrip',
    label: 'Asphalt grip',
    explain: 'Grip offered by the surface itself. Low grip can cause sliding and overheating.',
  },
  { key: 'lateral', label: 'Lateral', explain: 'Sideways load from fast and long corners.' },
  {
    key: 'trackEvolution',
    label: 'Track evolution',
    explain: 'How much grip improves over the weekend as rubber is laid down.',
  },
  {
    key: 'downforce',
    label: 'Downforce',
    explain: 'Aerodynamic downforce level teams run. Published on 2025-format previews only.',
  },
];

/** Ratings shown for a record: the seven core ones always, downforce only when the source format includes it. */
export function characteristicsFor(record: RaceRecord) {
  return CHARACTERISTICS.filter(
    (c) => c.key !== 'downforce' || record.characteristics.downforce !== undefined,
  );
}

export const STATUS_TEXT: Record<DataStatus, { label: string; explain: string }> = {
  verified: {
    label: 'Verified',
    explain: 'Every value checked by a person against the official Pirelli source.',
  },
  transcribed: {
    label: 'Transcribed',
    explain: 'Values read from the official Pirelli preview graphic and awaiting human confirmation.',
  },
  'needs-review': {
    label: 'Needs review',
    explain: 'Found automatically. Some values are not published in text and have not been entered yet.',
  },
  fixture: { label: 'Development fixture', explain: 'Test data. Not official.' },
};

export const RACE_LABEL_ORDER = ['hard', 'medium', 'soft'];

export function fixed(value: number | null | undefined, digits: number, unit = ''): string {
  return value == null ? NOT_PROVIDED : `${value.toFixed(digits)}${unit}`;
}

export function signedDeg(value: number | null | undefined): string {
  return value == null ? NOT_PROVIDED : `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}°`;
}

const MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' });
const FULL = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function eventDates(race: RaceRecord['race']): string | null {
  const { startDate: s, endDate: e } = race;
  if (!s || !e) return null;
  const a = new Date(`${s}T00:00:00Z`);
  const b = new Date(`${e}T00:00:00Z`);
  const year = b.getUTCFullYear();
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${DAY.format(a)}–${MONTH.format(b)} ${year}`
    : `${MONTH.format(a)} – ${MONTH.format(b)} ${year}`;
}

/** Publication time as shown to readers: date plus the source's local time and UTC offset. */
export function publishedText(iso: string | null): string {
  if (!iso) return NOT_PROVIDED;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(iso);
  if (!m) return NOT_PROVIDED;
  const date = FULL.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
  const offset = m[6] === 'Z' ? 'UTC' : `UTC${m[6]!.replace(':00', '')}`;
  return `${date}, ${m[4]}:${m[5]} ${offset}`;
}

export function shortDate(iso: string | null): string {
  if (!iso) return NOT_PROVIDED;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? NOT_PROVIDED : FULL.format(new Date(t));
}

export function compoundCssVar(raceLabel: string): string {
  return RACE_LABEL_ORDER.includes(raceLabel) ? `var(--c-${raceLabel})` : 'var(--c-text-2)';
}
